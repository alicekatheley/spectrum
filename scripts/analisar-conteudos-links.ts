import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI, Type } from "@google/genai";
import sharp from "sharp";

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MAX_FRAMES = 8;
const MIN_FRAMES_FOR_DIFF = 10; // abaixo disso, usa todos os frames sem amostrar

interface FrameCandidate {
  index: number;
  buffer: Buffer;
}

async function downloadAsset(url: string): Promise<Buffer> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Falha ao baixar asset: ${resp.status} ${url}`);
  return Buffer.from(await resp.arrayBuffer());
}

// Extrai os frames de um GIF animado e devolve só os que marcam uma mudança visual real,
// pra não gastar tokens do Gemini em tweens quase-idênticos nem perder um "momento" de verdade.
async function extractRepresentativeFrames(gifBuffer: Buffer): Promise<{ frames: FrameCandidate[]; totalFrames: number }> {
  const base = sharp(gifBuffer, { animated: true });
  const meta = await base.metadata();
  const totalFrames = meta.pages ?? 1;
  const pageHeight = meta.pageHeight ?? meta.height!;

  if (totalFrames <= 1) {
    const buffer = await sharp(gifBuffer).png().toBuffer();
    return { frames: [{ index: 0, buffer }], totalFrames: 1 };
  }

  if (totalFrames <= MIN_FRAMES_FOR_DIFF) {
    const frames: FrameCandidate[] = [];
    for (let i = 0; i < totalFrames; i++) {
      const buffer = await sharp(gifBuffer, { animated: true, page: i })
        .extract({ left: 0, top: 0, width: meta.width!, height: pageHeight })
        .png()
        .toBuffer();
      frames.push({ index: i, buffer });
    }
    return { frames, totalFrames };
  }

  // GIF com muitos frames: mede diferença perceptual (grayscale 32x32) entre consecutivos
  const thumbs: Buffer[] = [];
  for (let i = 0; i < totalFrames; i++) {
    const thumb = await sharp(gifBuffer, { animated: true, page: i })
      .extract({ left: 0, top: 0, width: meta.width!, height: pageHeight })
      .resize(32, 32, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer();
    thumbs.push(thumb);
  }

  const diffs: number[] = [0];
  for (let i = 1; i < thumbs.length; i++) {
    let sum = 0;
    for (let p = 0; p < thumbs[i].length; p++) sum += Math.abs(thumbs[i][p] - thumbs[i - 1][p]);
    diffs.push(sum / thumbs[i].length);
  }

  const ranked = diffs
    .map((d, i) => ({ i, d }))
    .sort((a, b) => b.d - a.d);

  const chosen = new Set<number>([0, totalFrames - 1]);
  for (const { i } of ranked) {
    if (chosen.size >= MAX_FRAMES) break;
    chosen.add(i);
  }

  const sortedIndices = [...chosen].sort((a, b) => a - b);
  const frames: FrameCandidate[] = [];
  for (const i of sortedIndices) {
    const buffer = await sharp(gifBuffer, { animated: true, page: i })
      .extract({ left: 0, top: 0, width: meta.width!, height: pageHeight })
      .png()
      .toBuffer();
    frames.push({ index: i, buffer });
  }
  return { frames, totalFrames };
}

async function analisarComGemini(params: {
  marca: string;
  nomeDesign: string;
  tipoMidia: "gif" | "estatica";
  frames: FrameCandidate[];
  totalFrames: number;
}) {
  const { marca, nomeDesign, tipoMidia, frames, totalFrames } = params;

  const promptTexto = `Você está analisando um ${tipoMidia === "gif" ? `GIF animado (${totalFrames} frames no total, foram extraídos ${frames.length} frames representativos das mudanças visuais reais, em ordem)` : "banner estático"} de campanha de e-mail da marca ${marca}, chamado "${nomeDesign}". Este conteúdo está entre os de melhor performance (cliques) da marca — a análise vai virar referência para gerar novos criativos.

Descreva:
1. mecanicaTexto: a mecânica/interação do criativo em 1-3 frases (ex: "puxar uma fita revela o cupom por trás").
2. composicaoTexto: a composição visual geral — estilo de ilustração, paleta dominante, enquadramento, hierarquia entre objeto/texto/botão.
3. frames: um array com uma entrada por frame extraído, na mesma ordem em que foram enviados, descrevendo o que muda visualmente naquele frame especificamente (não repita a descrição geral).

Responda em português.`;

  const imageParts = frames.map(f => ({
    inlineData: { mimeType: "image/png", data: f.buffer.toString("base64") },
  }));

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: promptTexto }, ...imageParts] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          mecanicaTexto: { type: Type.STRING },
          composicaoTexto: { type: Type.STRING },
          frames: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                ordem: { type: Type.INTEGER },
                descricao: { type: Type.STRING },
              },
              required: ["ordem", "descricao"],
            },
          },
        },
        required: ["mecanicaTexto", "composicaoTexto", "frames"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}

async function main() {
  const { data: rows, error } = await supabase
    .from("conteudos_links")
    .select("id, marca, nome_design, insider_original_url, storage_url")
    .eq("status_analise", "pendente")
    .not("storage_url", "is", null)
    .limit(1);

  if (error) throw error;
  if (!rows || rows.length === 0) {
    console.log("Nenhum item pendente com storage_url encontrado.");
    return;
  }

  const row = rows[0];
  console.log(`\n[1/1] ${row.marca} — ${row.nome_design}`);
  console.log(`Fonte: ${row.storage_url}`);

  const assetUrl = row.storage_url ?? row.insider_original_url;
  const buffer = await downloadAsset(assetUrl);
  const isGif = row.nome_design.toLowerCase().endsWith(".gif");
  const tipoMidia: "gif" | "estatica" = isGif ? "gif" : "estatica";

  const { frames, totalFrames } = isGif
    ? await extractRepresentativeFrames(buffer)
    : { frames: [{ index: 0, buffer: await sharp(buffer).png().toBuffer() }], totalFrames: 1 };

  console.log(`Tipo: ${tipoMidia} | frames totais no GIF: ${totalFrames} | frames extraídos: ${frames.length} (índices: ${frames.map(f => f.index).join(", ")})`);

  const analise = await analisarComGemini({ marca: row.marca, nomeDesign: row.nome_design, tipoMidia, frames, totalFrames });

  console.log("\n=== Resultado Gemini ===");
  console.log(JSON.stringify(analise, null, 2));

  const { error: updateError } = await supabase
    .from("conteudos_links")
    .update({
      mecanica_texto: analise.mecanicaTexto,
      composicao_texto: analise.composicaoTexto,
      frames: analise.frames,
      tipo_midia: tipoMidia,
      analisado_em: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (updateError) throw updateError;
  console.log(`\nSalvo em conteudos_links (id=${row.id}, status_analise permanece "pendente" pra revisão).`);
}

main().catch(err => {
  console.error("Erro:", err);
  process.exit(1);
});
