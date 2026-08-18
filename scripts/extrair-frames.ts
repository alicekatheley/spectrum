import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import fs from "fs";
import path from "path";

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const MAX_FRAMES = 8;
const MIN_FRAMES_FOR_DIFF = 10;

interface FrameCandidate {
  index: number;
  buffer: Buffer;
}

async function downloadAsset(url: string): Promise<Buffer> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Falha ao baixar asset: ${resp.status} ${url}`);
  return Buffer.from(await resp.arrayBuffer());
}

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
      const buffer = await sharp(gifBuffer, { animated: true, page: i, pages: 1 })
        .extract({ left: 0, top: 0, width: meta.width!, height: pageHeight })
        .png()
        .toBuffer();
      frames.push({ index: i, buffer });
    }
    return { frames, totalFrames };
  }

  const thumbs: Buffer[] = [];
  for (let i = 0; i < totalFrames; i++) {
    const thumb = await sharp(gifBuffer, { animated: true, page: i, pages: 1 })
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

  const ranked = diffs.map((d, i) => ({ i, d })).sort((a, b) => b.d - a.d);
  const chosen = new Set<number>([0, totalFrames - 1]);
  for (const { i } of ranked) {
    if (chosen.size >= MAX_FRAMES) break;
    chosen.add(i);
  }

  const sortedIndices = [...chosen].sort((a, b) => a - b);
  const frames: FrameCandidate[] = [];
  for (const i of sortedIndices) {
    const buffer = await sharp(gifBuffer, { animated: true, page: i, pages: 1 })
      .extract({ left: 0, top: 0, width: meta.width!, height: pageHeight })
      .png()
      .toBuffer();
    frames.push({ index: i, buffer });
  }
  return { frames, totalFrames };
}

async function main() {
  const outDir = process.argv[2];
  const explicitId = process.argv[3];
  if (!outDir) throw new Error("Uso: tsx extrair-frames.ts <pasta_de_saida> [id]");
  fs.mkdirSync(outDir, { recursive: true });

  const baseQuery = supabase
    .from("conteudos_links")
    .select("id, marca, nome_design, insider_original_url, storage_url");

  // Com id explícito, busca a linha independente de já ter sido analisada (uso: reverificação).
  const { data: rows, error } = explicitId
    ? await baseQuery.eq("id", explicitId).limit(1)
    : await baseQuery.is("mecanica_texto", null).limit(1);

  if (error) throw error;
  if (!rows || rows.length === 0) {
    console.log("Nenhum item pendente de análise encontrado.");
    return;
  }

  const row = rows[0];
  const assetUrl = row.storage_url ?? row.insider_original_url;
  const buffer = await downloadAsset(assetUrl);
  const isGif = row.nome_design.toLowerCase().endsWith(".gif");
  const tipoMidia: "gif" | "estatica" = isGif ? "gif" : "estatica";

  const { frames, totalFrames } = isGif
    ? await extractRepresentativeFrames(buffer)
    : { frames: [{ index: 0, buffer: await sharp(buffer).png().toBuffer() }], totalFrames: 1 };

  const framePaths: string[] = [];
  frames.forEach((f, i) => {
    const p = path.join(outDir, `frame_${i}_idx${f.index}.png`);
    fs.writeFileSync(p, f.buffer);
    framePaths.push(p);
  });

  const meta = {
    id: row.id,
    marca: row.marca,
    nomeDesign: row.nome_design,
    tipoMidia,
    totalFrames,
    framePaths,
  };
  fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify(meta, null, 2));
  console.log(JSON.stringify(meta, null, 2));
}

main().catch(err => {
  console.error("Erro:", err);
  process.exit(1);
});
