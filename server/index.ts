import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import {
  supabase, supabaseCrmAi,
  getDatabaseDisparos, getMecanicasCatalog, getCrmAiMarcas, getCrmAiEstilos,
  buildVisualHitsBlock, autoRegisterMecanica,
  loadDisparosFromSupabase, loadMecanicasFromSupabase, loadCrmAiContext,
} from "./supabase.ts";
import {
  VALID_IMAGE_RATIOS, VALID_IMAGE_MODELS, DEFAULT_IMAGE_MODEL,
  COMPOSITION_VARIANTS, LIGHTING_VARIANTS, PIAPP_API_KEY,
} from "./data.ts";
import {
  getBrandDna, buildImagePrompt, uploadReferenceToPiApp, generateImageViaPiApp,
} from "./piapp.ts";
import { validateSubjectModoB, sanitizeAssunto, sanitizeBannerText, risksUnique } from "./validators.ts";
import { generatePautaContent, generateVariationContent } from "./gemini.ts";

export const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Endpoint para puxar o banco histórico caso o front queira listar
app.get("/api/historico", (req, res) => {
  res.json({ status: "success", data: getDatabaseDisparos() });
});

// Endpoint para retornar o catálogo de mecânicas (inclui as geradas pela IA)
app.get("/api/mecanicas", (req, res) => {
  res.json({ status: "success", data: getMecanicasCatalog() });
});

// Endpoint principal para geração de pautas por inteligência artificial
app.post("/api/generate-pauta", async (req, res) => {
  try {
    const { modo, input, aspectRatio: rawAspectRatio, direcionamentoIA, tipoGeracao: rawTipoGeracao, referenciaImagem } = req.body;
    let direcStr = typeof direcionamentoIA === 'string' ? direcionamentoIA.trim().replace(/[\r\n]+/g, ' ') : '';
    let direcHasInjection = false;
    if (direcStr) {
      const injectionPattern = /\b(ignore|esqueça|não\s+siga|desconsidere)\b.{0,80}\b(regra|playbook|instrução)/gi;
      if (injectionPattern.test(direcStr)) {
        direcHasInjection = true;
        direcStr = direcStr.replace(/\b(ignore|esqueça|não\s+siga|desconsidere)\b.{0,80}\b(regra|playbook|instrução)/gi, '[instrução removida por segurança]');
      }
    }

    let refImageData: { mimeType: string; data: string } | null = null;
    if (modo === 'B' && typeof referenciaImagem === 'string' && referenciaImagem.startsWith('data:')) {
      const [header, data] = referenciaImagem.split(',');
      const mimeType = header.replace('data:', '').replace(';base64', '');
      if (data && mimeType) refImageData = { mimeType, data };
    }

    const VALID_TIPO = ['texto', 'imagem', 'texto_imagem'];
    const tipoGeracao = VALID_TIPO.includes(rawTipoGeracao) ? rawTipoGeracao : 'texto_imagem';

    if (!input || !input.marca) {
      return res.status(400).json({ error: "A marca é obrigatória." });
    }

    const aspectRatio = VALID_IMAGE_RATIOS.includes(rawAspectRatio) ? rawAspectRatio : '1:1';
    const { marca } = input;

    const riscosIniciais: any[] = [];
    if (direcHasInjection) {
      riscosIniciais.push({
        campo: "direcionamentoIA",
        nivel: "alto",
        mensagem: "O campo de direcionamento continha instruções que tentavam contornar as regras do playbook. Essas instruções foram removidas por segurança.",
        alternativaSugerida: "Use o campo de direcionamento para orientar o conteúdo criativo, não para alterar regras de entregabilidade."
      });
    }
    if (modo === 'B' && input.boxTituloEmail) {
      riscosIniciais.push(...validateSubjectModoB(input.boxTituloEmail, marca));
    }

    const visualHitsBlock = buildVisualHitsBlock(marca);

    let pautasProps = await generatePautaContent({
      modo,
      input,
      marca,
      aspectRatio,
      tipoGeracao,
      direcStr,
      refImageData,
      databaseDisparos: getDatabaseDisparos(),
      visualHitsBlock,
      crmAiEstilos: getCrmAiEstilos(),
      mecanicasCatalog: getMecanicasCatalog(),
    });

    pautasProps = pautasProps.map((p: any, index: number) => {
      p.copy.preHeader = "Mas, vou precisar cancelar em breve";

      const combinedRiscos = [...(p.riscos || []), ...riscosIniciais];
      const { assunto: assuntoSanitizado, riscos: riscosFinais } = sanitizeAssunto(p.copy.assunto || "", marca, combinedRiscos);
      p.copy.assunto = assuntoSanitizado;
      p.copy.headlineBanner = sanitizeBannerText(p.copy.headlineBanner || "");
      p.copy.subHeadlineBanner = sanitizeBannerText(p.copy.subHeadlineBanner || "");

      return {
        id: `pauta-${Date.now()}-${index}`,
        marca,
        modo: modo === 'B' ? 'B' : 'A',
        tipoGeracao,
        copy: p.copy,
        ...(p.visual !== undefined ? { visual: p.visual } : {}),
        operacional: p.operacional,
        previsao: p.previsao,
        riscos: risksUnique(riscosFinais),
        status: 'rascunho',
        dataCriacao: new Date().toISOString()
      };
    });

    for (const p of pautasProps) {
      const mecanicaNova = p.operacional?.mecanicaEscolhida;
      if (mecanicaNova) autoRegisterMecanica(mecanicaNova).catch(() => {});
    }

    res.json({ status: "success", data: pautasProps });
  } catch (err: any) {
    console.error("Erro na geração de pauta no backend:", err);
    res.status(500).json({ error: "Erro interno ao processar a geração com a inteligência artificial do Gemini.", details: err.message });
  }
});

app.post("/api/generate-image", async (req, res) => {
  try {
    if (!PIAPP_API_KEY) {
      return res.status(500).json({ error: "PIAPP_API_KEY não configurada no servidor." });
    }

    const {
      frameName,
      frameDescription,
      aspectRatio: rawRatio,
      marca,
      pautaId,
      styleIndex: rawStyleIndex,
      imageModel: rawModel,
      estiloIlustracao,
      paleta,
      mecanica,
      recompensa,
      frameReferencia: rawFrameRef,
      referenciaImagem: rawRefImage,
      headline,
      subheadline,
      referenceFrameUrl,
      direcionamento,
    } = req.body;

    if (!frameDescription || typeof frameDescription !== 'string') {
      return res.status(400).json({ error: "frameDescription é obrigatório." });
    }
    const brandDna = getBrandDna(marca);
    if (!brandDna) {
      return res.status(400).json({ error: "marca inválida. Use 'Apice' ou 'Barbours'." });
    }

    const aspectRatio = VALID_IMAGE_RATIOS.includes(rawRatio) ? rawRatio : '1:1';
    const imageModel = VALID_IMAGE_MODELS.has(rawModel) ? rawModel : DEFAULT_IMAGE_MODEL;

    const mechanicSeed = (mecanica || frameDescription || '').split('').reduce(
      (acc: number, char: string) => acc + char.charCodeAt(0), 0
    );
    const styleIndex = typeof rawStyleIndex === 'number' && rawStyleIndex >= 0
      ? rawStyleIndex % COMPOSITION_VARIANTS.length
      : mechanicSeed % COMPOSITION_VARIANTS.length;
    const compVariant = COMPOSITION_VARIANTS[styleIndex];
    const lightVariant = LIGHTING_VARIANTS[mechanicSeed % LIGHTING_VARIANTS.length];

    const prompt = buildImagePrompt({
      frameName:        frameName as string,
      frameDescription: frameDescription as string,
      marca:            marca as string,
      brandDna,
      estiloIlustracao: estiloIlustracao as string | undefined,
      paleta:           paleta as { cores?: string[] } | undefined,
      mecanica:         mecanica as string | undefined,
      recompensa:       recompensa as string | undefined,
      aspectRatio,
      compVariant,
      lightVariant,
      headline:         headline as string | undefined,
      subheadline:      subheadline as string | undefined,
      direcionamento:   typeof direcionamento === 'string' && direcionamento.trim() ? direcionamento.trim() : undefined,
    });
    console.log(`[generate-image] Prompt (${(prompt.split(' ').length)} words): ${prompt.slice(0, 120)}…`);

    const referenceImageUrls: string[] = [];

    // 1. Imagem de referência do usuário
    if (typeof rawRefImage === 'string' && rawRefImage.startsWith('data:')) {
      try {
        const url = await uploadReferenceToPiApp(rawRefImage);
        referenceImageUrls.push(url);
        console.log('[generate-image] Referência do usuário enviada ao PiApp:', url);
      } catch (err: any) {
        console.warn('[generate-image] Upload de referência do usuário falhou (ignorando):', err.message);
      }
    }

    // 2. Frame anterior como referência de consistência visual (F2 usa F1, F3 usa F2)
    if (typeof referenceFrameUrl === 'string' && referenceFrameUrl.startsWith('data:')) {
      try {
        const url = await uploadReferenceToPiApp(referenceFrameUrl);
        referenceImageUrls.push(url);
        console.log(`[generate-image] Frame anterior (${frameName}) enviado como referência de consistência`);
      } catch (err: any) {
        console.warn('[generate-image] Upload do frame anterior falhou (ignorando):', err.message);
      }
    }

    const result = await generateImageViaPiApp(
      prompt, aspectRatio, imageModel,
      referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
    );

    let publicUrl: string | null = null;
    if (supabase && typeof pautaId === 'string' && pautaId) {
      try {
        const safeMarca = (marca as string).toLowerCase().replace(/[^a-z0-9]/g, '');
        const safeFrame = ((frameName as string) || 'frame').replace(/[^a-z0-9]/g, '');
        const storagePath = `${safeMarca}/${pautaId}/${safeFrame}.png`;
        const imageBuffer = Buffer.from(result.imageBytes, 'base64');

        const { error: uploadError } = await supabase.storage
          .from('campaign-images')
          .upload(storagePath, imageBuffer, { contentType: result.mimeType, upsert: true });

        if (uploadError) {
          console.warn('[generate-image] Upload ao Storage falhou:', uploadError.message);
        } else {
          const { data: urlData } = supabase.storage
            .from('campaign-images')
            .getPublicUrl(storagePath);
          publicUrl = urlData.publicUrl;
          console.log(`[generate-image] Imagem salva no Storage: ${publicUrl}`);
        }
      } catch (storageErr: any) {
        console.warn('[generate-image] Erro inesperado no Storage:', storageErr.message);
      }
    }

    if (supabase) {
      const crmAiMarcas = getCrmAiMarcas();
      const marcaId = crmAiMarcas[marca]?.marcaId ?? (marca === 'Apice' ? 1 : 2);
      supabase.rpc('crm_ai_insert_ia_output', {
        p_marca_id:   marcaId,
        p_tipo_canal: 'frame',
        p_analisado:  frameDescription,
        p_prompt:     prompt,
        p_modelo:     imageModel,
        p_parametros: { aspectRatio, frameName: frameName ?? null, mecanica: mecanica ?? null, recompensa: recompensa ?? null, pautaId: pautaId ?? null },
        p_imagens:    [{
          frame:        frameName ?? 'desconhecido',
          model:        imageModel,
          aspect_ratio: aspectRatio,
          mime_type:    result.mimeType,
          gerado_em:    new Date().toISOString(),
          storage_url:  publicUrl,
        }],
      }).then(({ error }: any) => {
        if (error) console.warn('[ia_outputs] Falha ao salvar via RPC:', error.message);
        else console.log(`[ia_outputs] Frame "${frameName}" (${marca}) registrado no crm_ai.`);
      });
    }

    res.json({ ...result, publicUrl });
  } catch (err: any) {
    console.error("[generate-image] Erro:", err);
    res.status(500).json({ error: "Falha ao gerar imagem com PiApp.", details: err.message });
  }
});

app.post("/api/generate-gif", async (req, res) => {
  try {
    if (!PIAPP_API_KEY) {
      return res.status(500).json({ error: "PIAPP_API_KEY não configurada no servidor." });
    }

    const {
      aspectRatio: rawRatio,
      marca,
      pautaId,
      styleIndex: rawStyleIndex,
      imageModel: rawModel,
      estiloIlustracao,
      paleta,
      mecanica,
      recompensa,
      frameInicial,
      frameIntermediario,
      frameFinal,
      referenciaImagem: rawRefImage,
    } = req.body;

    if (!frameInicial || !frameIntermediario || !frameFinal) {
      return res.status(400).json({ error: "frameInicial, frameIntermediario e frameFinal são obrigatórios." });
    }
    const brandDna = getBrandDna(marca);
    if (!brandDna) {
      return res.status(400).json({ error: "marca inválida. Use 'Apice' ou 'Barbours'." });
    }

    const aspectRatio = VALID_IMAGE_RATIOS.includes(rawRatio) ? rawRatio : '1:1';
    const imageModel = VALID_IMAGE_MODELS.has(rawModel) ? rawModel : DEFAULT_IMAGE_MODEL;

    const styleIndex = typeof rawStyleIndex === 'number' && rawStyleIndex >= 0
      ? rawStyleIndex % COMPOSITION_VARIANTS.length
      : Math.floor(Math.random() * COMPOSITION_VARIANTS.length);
    const compVariant = COMPOSITION_VARIANTS[styleIndex];
    const lightVariant = LIGHTING_VARIANTS[(styleIndex + 2) % LIGHTING_VARIANTS.length];

    const frames = [
      { frameName: 'inicial',       frameDescription: frameInicial as string },
      { frameName: 'intermediario', frameDescription: frameIntermediario as string },
      { frameName: 'final',         frameDescription: frameFinal as string },
    ];

    const sharedRefUrls: string[] = [];
    if (typeof rawRefImage === 'string' && rawRefImage.startsWith('data:')) {
      try {
        const refUrl = await uploadReferenceToPiApp(rawRefImage);
        sharedRefUrls.push(refUrl);
        console.log('[generate-gif] Referência do usuário enviada ao PiApp:', refUrl);
      } catch (err: any) {
        console.warn('[generate-gif] Upload de referência falhou (ignorando):', err.message);
      }
    }

    console.log(`[generate-gif] Gerando 3 frames em paralelo para ${marca} (${aspectRatio}, ${imageModel})`);

    const frameResults = await Promise.all(
      frames.map(async ({ frameName, frameDescription }) => {
        const prompt = buildImagePrompt({
          frameName,
          frameDescription,
          marca:            marca as string,
          brandDna,
          estiloIlustracao: estiloIlustracao as string | undefined,
          paleta:           paleta as { cores?: string[] } | undefined,
          mecanica:         mecanica as string | undefined,
          recompensa:       recompensa as string | undefined,
          aspectRatio,
          compVariant,
          lightVariant,
        });
        const result = await generateImageViaPiApp(
          prompt, aspectRatio, imageModel,
          sharedRefUrls.length > 0 ? sharedRefUrls : undefined,
        );
        return { frameName, ...result };
      })
    );

    const results = await Promise.all(
      frameResults.map(async ({ frameName, imageBytes, mimeType }) => {
        let publicUrl: string | null = null;
        if (supabase && typeof pautaId === 'string' && pautaId) {
          try {
            const safeMarca = (marca as string).toLowerCase().replace(/[^a-z0-9]/g, '');
            const storagePath = `${safeMarca}/${pautaId}/${frameName}.png`;
            const imgBuffer = Buffer.from(imageBytes, 'base64');
            const { error: uploadError } = await supabase.storage
              .from('campaign-images')
              .upload(storagePath, imgBuffer, { contentType: mimeType, upsert: true });
            if (!uploadError) {
              const { data: urlData } = supabase.storage.from('campaign-images').getPublicUrl(storagePath);
              publicUrl = urlData.publicUrl;
              console.log(`[generate-gif] Frame ${frameName} salvo no Storage: ${publicUrl}`);
            }
          } catch (storageErr: any) {
            console.warn(`[generate-gif] Storage falhou para ${frameName}:`, storageErr.message);
          }
        }
        return { frameName, imageBytes, mimeType, publicUrl };
      })
    );

    if (supabase) {
      const crmAiMarcas = getCrmAiMarcas();
      const marcaId = crmAiMarcas[marca]?.marcaId ?? (marca === 'Apice' ? 1 : 2);
      const gifInitialPrompt = buildImagePrompt({
        frameName: 'inicial', frameDescription: frameInicial as string,
        marca: marca as string, brandDna,
        estiloIlustracao: estiloIlustracao as string | undefined,
        paleta: paleta as { cores?: string[] } | undefined,
        mecanica: mecanica as string | undefined,
        recompensa: recompensa as string | undefined,
        aspectRatio, compVariant, lightVariant,
      });
      supabase.rpc('crm_ai_insert_ia_output', {
        p_marca_id:   marcaId,
        p_tipo_canal: 'frame',
        p_analisado:  `GIF batch: inicial, intermediario, final`,
        p_prompt:     frameResults[0] ? gifInitialPrompt : '',
        p_modelo:     imageModel,
        p_parametros: { aspectRatio, mecanica: mecanica ?? null, recompensa: recompensa ?? null, pautaId: pautaId ?? null, batch: true },
        p_imagens:    results.map(r => ({
          frame:        r.frameName,
          model:        imageModel,
          aspect_ratio: aspectRatio,
          mime_type:    r.mimeType,
          gerado_em:    new Date().toISOString(),
          storage_url:  r.publicUrl,
        })),
      }).then(({ error }: any) => {
        if (error) console.warn('[ia_outputs] Falha ao salvar gif batch:', error.message);
        else console.log(`[ia_outputs] GIF batch (${marca}) registrado no crm_ai.`);
      });
    }

    res.json({ frames: results });
  } catch (err: any) {
    console.error("[generate-gif] Erro:", err);
    res.status(500).json({ error: "Falha ao gerar GIF com PiApp.", details: err.message });
  }
});

app.post("/api/parse-estilo-visual", async (req, res) => {
  try {
    const { estiloVisualTexto, marca } = req.body;

    if (!estiloVisualTexto || typeof estiloVisualTexto !== 'string') {
      return res.json({
        corTexto: '#FFFFFF',
        corSubheadline: 'rgba(255,255,255,0.90)',
        estiloBotao: 'pill',
        corBotao: marca === 'Apice' ? '#688D65' : '#BF0F26',
        corTextoBotao: '#FFFFFF',
        tamanhoHeadline: 'grande',
        pesoFonte: '900',
        familiaFonte: 'Georgia, serif',
      });
    }

    const prompt = `Você é um parser de estilo visual. O usuário descreveu como quer que o texto apareça em um banner de email marketing. Extraia as informações e retorne APENAS um JSON válido sem markdown, sem explicações.

Descrição do usuário: "${estiloVisualTexto}"
Marca: ${marca}
Cor padrão da marca Apice: #688D65 (verde)
Cor padrão da marca Barbours: #BF0F26 (vermelho)

Retorne EXATAMENTE este JSON (sem backticks, sem markdown):
{
  "corTexto": "cor hex do texto principal/headline",
  "corSubheadline": "cor hex ou rgba do sub-headline (pode ter opacidade)",
  "estiloBotao": "pill" ou "retangular" ou "outline",
  "corBotao": "cor hex do fundo do botão",
  "corTextoBotao": "cor hex do texto dentro do botão",
  "tamanhoHeadline": "grande" ou "medio" ou "pequeno",
  "pesoFonte": "400" ou "600" ou "700" ou "900",
  "familiaFonte": "fonte CSS válida (ex: Georgia, serif ou Arial, sans-serif ou 'Playfair Display', serif)"
}

Se o usuário não mencionar um campo, use o valor padrão mais adequado para um banner de email marketing de marca de beleza.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text ?? '{}';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

    res.json(parsed);
  } catch (err) {
    console.error('[parse-estilo-visual] Erro:', err);
    res.json({
      corTexto: '#FFFFFF',
      corSubheadline: 'rgba(255,255,255,0.90)',
      estiloBotao: 'pill',
      corBotao: req.body.marca === 'Apice' ? '#688D65' : '#BF0F26',
      corTextoBotao: '#FFFFFF',
      tamanhoHeadline: 'grande',
      pesoFonte: '900',
      familiaFonte: 'Georgia, serif',
    });
  }
});

app.post("/api/generate-variation", async (req, res) => {
  try {
    const { pauta } = req.body;
    if (!pauta) {
      return res.status(400).json({ error: "Dados da pauta original são necessários." });
    }

    const parsedCopy = await generateVariationContent(pauta);
    res.json({ status: "success", data: parsedCopy });
  } catch (err: any) {
    console.error("Erro na geração de variação:", err);
    res.status(500).json({ error: "Erro ao gerar variação.", details: err.message });
  }
});

app.post("/api/approve-pauta", async (req, res) => {
  try {
    if (!supabaseCrmAi) {
      return res.status(500).json({ error: "Supabase não configurado." });
    }

    const { pauta, frameImages } = req.body;

    if (!pauta || !pauta.id) {
      return res.status(400).json({ error: "pauta inválida." });
    }

    const marcaId = pauta.marca === 'Apice' ? 1 : 2;

    const recomendacaoTexto = [
      `ASSUNTO: ${pauta.copy?.assunto ?? ''}`,
      `PRÉ-HEADER: ${pauta.copy?.preHeader ?? ''}`,
      `HEADLINE: ${pauta.copy?.headlineBanner ?? ''}`,
      `SUB-HEADLINE: ${pauta.copy?.subHeadlineBanner ?? ''}`,
      `CTA: ${pauta.copy?.ctaBotao ?? ''}`,
      `MECÂNICA: ${pauta.operacional?.mecanicaEscolhida ?? ''}`,
      `RECOMPENSA: ${pauta.operacional?.recompensaEscolhida ?? ''}`,
      `SEGMENTO: ${pauta.operacional?.segmentoRecomendado ?? ''}`,
      `DIA IDEAL: ${pauta.operacional?.diaRecomendado ?? ''}`,
      `HORÁRIO: ${pauta.operacional?.horarioRecomendado ?? ''}`,
    ].join('\n');

    const imagensGeradas = frameImages
      ? Object.entries(frameImages as Record<string, string>)
          .filter(([, src]) => !!src)
          .map(([frameName, src]) => ({
            frame: frameName,
            data_url: src,
            gerado_em: new Date().toISOString(),
          }))
      : [];

    const { data, error } = await supabaseCrmAi
      .from('ia_outputs')
      .insert({
        marca_id: marcaId,
        tipo_canal: 'email',
        o_que_foi_analisado: `Pauta ${pauta.modo} aprovada — ${pauta.operacional?.mecanicaEscolhida ?? ''} para ${pauta.marca}`,
        fontes_referenciadas: pauta.previsao?.casesReferencia
          ? { cases: pauta.previsao.casesReferencia }
          : null,
        modelo: 'gemini-2.5-flash',
        parametros: {
          modo: pauta.modo,
          tipoGeracao: pauta.tipoGeracao,
          pautaId: pauta.id,
          dataCriacao: pauta.dataCriacao,
        },
        recomendacao_texto: recomendacaoTexto,
        recomendacao_estruturada: {
          copy: pauta.copy,
          visual: pauta.visual,
          operacional: pauta.operacional,
          previsao: pauta.previsao,
          riscos: pauta.riscos,
        },
        imagens_geradas: imagensGeradas.length > 0 ? imagensGeradas : null,
        aprovado: true,
      })
      .select('output_id')
      .single();

    if (error) {
      console.error('[approve-pauta] Erro ao salvar no Supabase:', error.message);
      return res.status(500).json({ error: 'Erro ao salvar no Supabase.', details: error.message });
    }

    console.log(`[approve-pauta] Pauta ${pauta.id} (${pauta.marca}) salva em ia_outputs com output_id ${(data as any).output_id}`);
    res.json({ success: true, output_id: (data as any).output_id });
  } catch (err: any) {
    console.error('[approve-pauta] Erro inesperado:', err);
    res.status(500).json({ error: 'Erro interno.', details: err.message });
  }
});

const isProduction = process.env.NODE_ENV === "production";

export async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  await loadDisparosFromSupabase();
  await loadMecanicasFromSupabase();
  await loadCrmAiContext();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Express Server] Iniciado em http://localhost:${PORT}`);
  });
}
