import express from "express";
import path from "path";
import cron from "node-cron";
import { createServer as createViteServer } from "vite";
import {
  supabase, supabaseCrmAi,
  getDatabaseDisparos, getMecanicasCatalog, getCrmAiMarcas, getCrmAiEstilos,
  buildVisualHitsBlock, autoRegisterMecanica,
  loadDisparosFromSupabase, loadMecanicasFromSupabase, loadCrmAiContext,
  loadConteudosGifAprendizado, getConteudosGifAprendizado, getFeedbackAgenteGif,
} from "./supabase.ts";
import {
  VALID_IMAGE_RATIOS, VALID_IMAGE_MODELS, DEFAULT_IMAGE_MODEL,
  COMPOSITION_VARIANTS, LIGHTING_VARIANTS, PIAPP_API_KEY,
} from "./data.ts";
import {
  getBrandDna, buildImagePrompt, uploadReferenceToPiApp, generateImageViaPiApp,
} from "./piapp.ts";
import { validateSubjectModoB, sanitizeAssunto, sanitizeBannerText, risksUnique } from "./validators.ts";
import { aiProxyConfigurado } from "./ai-proxy.ts";
import {
  carregarContextoModelo, getContextoModelo, getContextoMarca, getStatusBigQuery,
  campanhasNaoClassificadas,
} from "./bigquery.ts";
import {
  generatePautaContent, generateVariationContent, generateGifAgentConcept, generateAbTestProposal,
  explicarCalendario,
  ai as geminiAi,
} from "./gemini.ts";

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
    const { modo, input, aspectRatio: rawAspectRatio, direcionamentoIA, tipoGeracao: rawTipoGeracao, referenciaImagem, referenciasImagem } = req.body;

    // Suporte a múltiplas referências — usa array se disponível, senão single
    const todasReferencias: string[] = Array.isArray(referenciasImagem) && referenciasImagem.length > 0
      ? referenciasImagem.slice(0, 4)
      : (referenciaImagem ? [referenciaImagem] : []);
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

    const inputSemEstilo = { ...input };
    delete (inputSemEstilo as any).estiloVisualTexto;
    const estiloDesignUsuario = (input as any).estiloDesign || '';

    let pautasProps = await generatePautaContent({
      modo,
      input: inputSemEstilo,
      marca,
      aspectRatio,
      tipoGeracao,
      direcStr,
      refImageData,
      databaseDisparos: getDatabaseDisparos(),
      visualHitsBlock,
      crmAiEstilos: getCrmAiEstilos(),
      mecanicasCatalog: getMecanicasCatalog(),
      estiloIlustracao: estiloDesignUsuario ? resolveEstiloDesign(estiloDesignUsuario) : undefined,
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
        dataCriacao: new Date().toISOString(),
        aspectRatio
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

app.post("/api/analyze-frame", async (req, res) => {
  try {
    const { imageDataUrl } = req.body;
    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      return res.status(400).json({ error: "imageDataUrl é obrigatório." });
    }

    const base64Data = imageDataUrl.split(',')[1];
    const mimeType = imageDataUrl.split(';')[0].split(':')[1] || 'image/png';

    const analysisPrompt = `Analyze this email marketing banner image and extract the following visual measurements. Be as precise as possible. Return ONLY a valid JSON object with no markdown, no explanation.

The image is 800x800 pixels (even if displayed differently).

Extract:
{
  "backgroundColor": "exact hex color of the main background (e.g. #1A7A3C)",
  "headlineFontSize": "estimated font size in pixels (e.g. 94)",
  "headlineFontWeight": "bold or extra-bold or black",
  "headlineColor": "exact hex color of headline text",
  "headlineTopPosition": "distance from top of image to headline text start in pixels",
  "headlineIsItalic": true or false,
  "subheadlineFontSize": "estimated font size in pixels",
  "subheadlineColor": "exact hex color of sub-headline text",
  "subheadlineTopPosition": "distance from top of image to sub-headline in pixels",
  "buttonWidth": "button width in pixels",
  "buttonHeight": "button height in pixels",
  "buttonBottomPosition": "distance from bottom of image to button center in pixels",
  "buttonBackgroundColor": "exact hex color of button background",
  "buttonTextColor": "exact hex color of button text",
  "buttonBorderRadius": "pill (if very rounded) or rectangle (if squared) or slight (if slightly rounded)",
  "buttonFontSize": "estimated font size of button text in pixels",
  "accentColors": ["any accent colors used in the text or highlights, as hex array"]
}`;

    const analysisResult = await geminiAi.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: analysisPrompt }, { inlineData: { mimeType, data: base64Data } }] }],
    });

    const text = (analysisResult.text ?? '').replace(/```json|```/g, '').trim();
    const metadata = JSON.parse(text);

    console.log('[analyze-frame] Metadados extraídos:', JSON.stringify(metadata, null, 2));
    res.json(metadata);

  } catch (err: any) {
    console.error('[analyze-frame] Erro:', err.message);
    res.status(500).json({ error: 'Falha ao analisar frame.', details: err.message });
  }
});

function resolveEstiloDesign(estilo: string): string {
  const map: Record<string, string> = {
    '3D Realista': 'photorealistic 3D render, soft studio lighting, high detail, cinematic quality',
    '3D Cartoon': '3D cartoon render, smooth surfaces, vibrant colors, playful and friendly style',
    '2D Cartoon': '2D flat cartoon illustration, bold outlines, clean shapes, bright palette',
    'Fotográfico': 'professional product photography, natural lighting, clean background, editorial style',
    'Ilustrado': 'hand-crafted editorial illustration, artistic brush strokes, warm and expressive style',
    'Minimalista': 'minimalist design, clean white space, simple geometric shapes, elegant composition',
    'Aquarela': 'soft watercolor painting style, translucent washes, delicate textures, artistic feel',
    'Neon/Bold': 'bold neon colors, high contrast, electric glow effects, energetic and vibrant style',
  };
  return map[estilo] ?? estilo;
}

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
      estiloDesignUsuario,
      paleta,
      mecanica,
      recompensa,
      frameReferencia: rawFrameRef,
      referenciaImagem: rawRefImage,
      referenciasImagem: rawRefImages,
      headline,
      subheadline,
      cta,
      referenceFrameUrl,
      referenceFrameUrls: rawFrameRefs,
      direcionamento,
      totalFrames,
      ajusteRegeneracao,
    } = req.body;

    if (!frameDescription || typeof frameDescription !== 'string') {
      return res.status(400).json({ error: "frameDescription é obrigatório." });
    }
    const brandDna = getBrandDna(marca);
    if (!brandDna) {
      return res.status(400).json({ error: "marca inválida. Use 'Apice' ou 'Barbours'." });
    }

    const isCustomPixels = typeof rawRatio === 'string' && (rawRatio as string).startsWith('custom_');
    let aspectRatio = '1:1';
    let customWidth = 0;
    let customHeight = 0;

    if (isCustomPixels) {
      const [w, h] = (rawRatio as string).replace('custom_', '').split('x').map(Number);
      if (w >= 100 && w <= 4000 && h >= 100 && h <= 4000) {
        customWidth = w;
        customHeight = h;
        const { pixelsToAspectRatio } = await import('./piapp.ts');
        aspectRatio = pixelsToAspectRatio(rawRatio as string);
        console.log(`[generate-image] Pixels ${w}x${h} → aspect_ratio ${aspectRatio}`);
      }
    } else if (VALID_IMAGE_RATIOS.includes(rawRatio)) {
      aspectRatio = rawRatio;
    }

    let imageModel = VALID_IMAGE_MODELS.has(rawModel) ? rawModel : DEFAULT_IMAGE_MODEL;

    const mechanicSeed = (mecanica || frameDescription || '').split('').reduce(
      (acc: number, char: string) => acc + char.charCodeAt(0), 0
    );
    const styleIndex = typeof rawStyleIndex === 'number' && rawStyleIndex >= 0
      ? rawStyleIndex % COMPOSITION_VARIANTS.length
      : mechanicSeed % COMPOSITION_VARIANTS.length;
    const compVariant = COMPOSITION_VARIANTS[styleIndex];
    const lightVariant = LIGHTING_VARIANTS[mechanicSeed % LIGHTING_VARIANTS.length];

    // referenceFrameUrls (plural) é o formato atual — [frame master, frame imediatamente anterior].
    // referenceFrameUrl (singular) fica como fallback de compatibilidade.
    const frameRefInputs: string[] = Array.isArray(rawFrameRefs) && rawFrameRefs.length > 0
      ? rawFrameRefs
      : (typeof referenceFrameUrl === 'string' && referenceFrameUrl.startsWith('data:') ? [referenceFrameUrl] : []);

    // Imagens de referência do produto real (enviadas pelo usuário) — contadas aqui para que o
    // prompt numere corretamente a ordem das imagens anexadas (produtos vêm ANTES dos frames no
    // array final enviado ao PiApp — ver loop de upload abaixo).
    const refImages: string[] = Array.isArray(rawRefImages) && rawRefImages.length > 0
      ? rawRefImages.slice(0, 4)
      : (typeof rawRefImage === 'string' && rawRefImage.startsWith('data:') ? [rawRefImage] : []);
    // Pra metadados de texto/botão, usar o frame imediatamente anterior (último da lista)
    const metadataSourceUrl = frameRefInputs[frameRefInputs.length - 1];

    // Extrair metadados visuais do frame anterior para injetar valores exatos no prompt de frames subsequentes
    let frameMetadata: Record<string, any> | undefined = undefined;
    if (typeof metadataSourceUrl === 'string' && metadataSourceUrl.startsWith('data:')
        && frameName !== 'frame_0' && frameName !== 'inicial') {
      try {
        const base64Ref = metadataSourceUrl.split(',')[1];
        const mimeRef = metadataSourceUrl.split(';')[0].split(':')[1] || 'image/png';
        const metaPrompt = `Analyze this email marketing banner image and extract the following visual measurements. Be as precise as possible. Return ONLY a valid JSON object with no markdown, no explanation.

The image is 800x800 pixels (even if displayed differently).

Extract:
{
  "backgroundColor": "exact hex color of the main background (e.g. #1A7A3C)",
  "headlineFontSize": "estimated font size in pixels (e.g. 94)",
  "headlineFontWeight": "bold or extra-bold or black",
  "headlineColor": "exact hex color of headline text",
  "headlineTopPosition": "distance from top of image to headline text start in pixels",
  "headlineIsItalic": true or false,
  "subheadlineFontSize": "estimated font size in pixels",
  "subheadlineColor": "exact hex color of sub-headline text",
  "subheadlineTopPosition": "distance from top of image to sub-headline in pixels",
  "buttonWidth": "button width in pixels",
  "buttonHeight": "button height in pixels",
  "buttonBottomPosition": "distance from bottom of image to button center in pixels",
  "buttonBackgroundColor": "exact hex color of button background",
  "buttonTextColor": "exact hex color of button text",
  "buttonBorderRadius": "pill (if very rounded) or rectangle (if squared) or slight (if slightly rounded)",
  "buttonFontSize": "estimated font size of button text in pixels",
  "accentColors": ["any accent colors used in the text or highlights, as hex array"]
}`;
        const metaResult = await geminiAi.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [{ role: 'user', parts: [{ text: metaPrompt }, { inlineData: { mimeType: mimeRef, data: base64Ref } }] }],
        });
        const metaText = (metaResult.text ?? '').replace(/```json|```/g, '').trim();
        frameMetadata = JSON.parse(metaText);
        console.log(`[generate-image] Metadados extraídos do frame anterior para ${frameName}:`, JSON.stringify(frameMetadata, null, 2));
      } catch (metaErr: any) {
        console.warn('[generate-image] Falha ao extrair metadados do frame anterior (ignorando):', metaErr.message);
      }
    }

    const prompt = buildImagePrompt({
      frameName:        frameName as string,
      frameDescription: frameDescription as string,
      marca:            marca as string,
      brandDna,
      estiloIlustracao: estiloDesignUsuario ? resolveEstiloDesign(estiloDesignUsuario as string) : estiloIlustracao as string | undefined,
      paleta:           paleta as { cores?: string[] } | undefined,
      mecanica:         mecanica as string | undefined,
      recompensa:       recompensa as string | undefined,
      aspectRatio,
      compVariant,
      lightVariant,
      headline:         headline as string | undefined,
      subheadline:      subheadline as string | undefined,
      cta:              cta as string | undefined,
      direcionamento:   typeof direcionamento === 'string' && direcionamento.trim() ? direcionamento.trim() : undefined,
      totalFrames:      typeof totalFrames === 'number' ? totalFrames : undefined,
      frameRefCount:    frameRefInputs.length,
      productRefCount:  refImages.length,
      ajusteRegeneracao: typeof ajusteRegeneracao === 'string' && ajusteRegeneracao.trim() ? ajusteRegeneracao.trim() : undefined,
      frameMetadata,
    });
    console.log(`[generate-image] Prompt (${(prompt.split(' ').length)} words): ${prompt.slice(0, 120)}…`);

    const referenceImageUrls: string[] = [];

    // 1. Imagens de referência do usuário (suporte a múltiplas) — refImages já computado acima
    for (const refImg of refImages) {
      if (typeof refImg === 'string' && refImg.startsWith('data:')) {
        try {
          const url = await uploadReferenceToPiApp(refImg);
          referenceImageUrls.push(url);
          console.log('[generate-image] Referência enviada ao PiApp:', url);
        } catch (uploadErr: any) {
          console.warn('[generate-image] Upload de referência falhou (ignorando):', uploadErr.message);
        }
      }
    }

    // 2. Frame(s) anterior(es) como referência de consistência visual — normalmente [master, imediatamente anterior]
    for (const frameRef of frameRefInputs) {
      if (typeof frameRef === 'string' && frameRef.startsWith('data:')) {
        try {
          const url = await uploadReferenceToPiApp(frameRef);
          referenceImageUrls.push(url);
          console.log(`[generate-image] Frame de referência (${frameName}) enviado ao PiApp`);
        } catch (err: any) {
          console.warn('[generate-image] Upload de frame de referência falhou (ignorando):', err.message);
        }
      }
    }

    if (referenceImageUrls.length > 0 && imageModel === 'wavespeed-gpt-image-2-t2i') {
      imageModel = 'wavespeed-gpt-image-2-edit';
      console.log('[generate-image] Referência de imagem detectada — trocando para wavespeed-gpt-image-2-edit');
    }

    const result = await generateImageViaPiApp(
      prompt, aspectRatio, imageModel,
      referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
    );

    let finalImageBytes = result.imageBytes;
    let finalMimeType = result.mimeType;

    if (customWidth > 0 && customHeight > 0) {
      try {
        // @ts-ignore — sharp types not exposed via package.json exports field
        const sharp = (await import('sharp')).default;
        const inputBuffer = Buffer.from(result.imageBytes, 'base64');
        const resizedBuffer = await sharp(inputBuffer)
          .resize(customWidth, customHeight, { fit: 'fill', kernel: 'lanczos3' })
          .png()
          .toBuffer();
        finalImageBytes = resizedBuffer.toString('base64');
        finalMimeType = 'image/png';
        console.log(`[generate-image] Imagem redimensionada para ${customWidth}x${customHeight}px`);
      } catch (resizeErr: any) {
        console.warn('[generate-image] Falha ao redimensionar, usando original:', resizeErr.message);
      }
    }

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

    res.json({ imageBytes: finalImageBytes, mimeType: finalMimeType, publicUrl });
  } catch (err: any) {
    console.error("[generate-image] Erro:", err);
    res.status(500).json({ error: "Falha ao gerar imagem com PiApp.", details: err.message });
  }
});

// Gera os 3 frames de um GIF em sequência (não em paralelo): frame 1 é a "master frame" e serve
// de referência visual pros frames 2 e 3, pra manter objeto/posição/layout consistentes entre eles.
// Extraído da rota /api/generate-gif pra ser reaproveitado pelo pipeline automático do agente.
async function generateGifFramesSequential(opts: {
  marca: string;
  pautaId?: string;
  aspectRatio: string;
  imageModel: string;
  estiloIlustracao?: string;
  paleta?: { cores?: string[] };
  mecanica?: string;
  recompensa?: string;
  frameInicial: string;
  frameIntermediario: string;
  frameFinal: string;
  sharedRefUrls?: string[];
  styleIndex?: number;
}): Promise<{
  results: Array<{ frameName: string; imageBytes: string; mimeType: string; publicUrl: string | null }>;
  imageModel: string;
  compVariant: string;
  lightVariant: string;
}> {
  const { marca, pautaId, frameInicial, frameIntermediario, frameFinal } = opts;
  const brandDna = getBrandDna(marca);
  if (!brandDna) throw new Error(`marca inválida: ${marca}`);

  const aspectRatio = opts.aspectRatio;
  let imageModel = opts.imageModel;
  const sharedRefUrls = opts.sharedRefUrls ?? [];

  const styleIndex = typeof opts.styleIndex === 'number' && opts.styleIndex >= 0
    ? opts.styleIndex % COMPOSITION_VARIANTS.length
    : Math.floor(Math.random() * COMPOSITION_VARIANTS.length);
  const compVariant = COMPOSITION_VARIANTS[styleIndex];
  const lightVariant = LIGHTING_VARIANTS[(styleIndex + 2) % LIGHTING_VARIANTS.length];

  const frames = [
    { frameName: 'inicial',       frameDescription: frameInicial },
    { frameName: 'intermediario', frameDescription: frameIntermediario },
    { frameName: 'final',         frameDescription: frameFinal },
  ];

  if (sharedRefUrls.length > 0 && imageModel === 'wavespeed-gpt-image-2-t2i') {
    imageModel = 'wavespeed-gpt-image-2-edit';
    console.log('[generate-gif] Referência de imagem detectada — trocando para wavespeed-gpt-image-2-edit');
  }

  console.log(`[generate-gif] Gerando ${frames.length} frames sequencialmente para ${marca} (${aspectRatio}, ${imageModel})`);

  const frameResults: Array<{ frameName: string; imageBytes: string; mimeType: string }> = [];
  let masterFrameRefUrl: string | undefined;

  // Cada frame é tentado individualmente — se um falhar (timeout, erro do PiApp etc.), os demais
  // seguem tentando normalmente em vez de abortar o lote inteiro. Antes, uma falha em qualquer
  // frame descartava os frames já gerados com sucesso e a pauta terminava sem nenhuma imagem;
  // agora ela sai com os frames que deram certo, em vez de "sem nada".
  for (const { frameName, frameDescription } of frames) {
    const prompt = buildImagePrompt({
      frameName,
      frameDescription,
      marca,
      brandDna,
      estiloIlustracao: opts.estiloIlustracao,
      paleta:           opts.paleta,
      mecanica:         opts.mecanica,
      recompensa:       opts.recompensa,
      aspectRatio,
      compVariant,
      lightVariant,
      totalFrames: frames.length,
      frameRefCount: masterFrameRefUrl ? 1 : 0,
      productRefCount: sharedRefUrls.length,
    });

    const referenceImageUrls = masterFrameRefUrl ? [...sharedRefUrls, masterFrameRefUrl] : sharedRefUrls;
    try {
      const result = await generateImageViaPiApp(
        prompt, aspectRatio, imageModel,
        referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
      );
      frameResults.push({ frameName, ...result });

      if (!masterFrameRefUrl) {
        try {
          masterFrameRefUrl = await uploadReferenceToPiApp(`data:${result.mimeType};base64,${result.imageBytes}`);
          console.log(`[generate-gif] Frame "${frameName}" definido como master frame de referência.`);
        } catch (err: any) {
          console.warn('[generate-gif] Falha ao subir master frame como referência (ignorando):', err.message);
        }
      }
    } catch (err: any) {
      console.warn(`[generate-gif] Falha ao gerar o frame "${frameName}" (pulando, mantendo os demais):`, err.message);
    }
  }

  if (frameResults.length === 0) {
    throw new Error('Nenhum frame pôde ser gerado.');
  }

  const results = await Promise.all(
    frameResults.map(async ({ frameName, imageBytes, mimeType }) => {
      let publicUrl: string | null = null;
      if (supabase && typeof pautaId === 'string' && pautaId) {
        try {
          const safeMarca = marca.toLowerCase().replace(/[^a-z0-9]/g, '');
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

  return { results, imageModel, compVariant, lightVariant };
}

// ─── Agente Autônomo de GIF ────────────────────────────────────────────────────
// Gera pautas modo 'C' automaticamente (10/dia via cron, mais regeneração imediata
// quando uma pauta é reprovada). Sem separação por marca no grounding (v1): o pool de
// conteudos_links usado como aprendizado é geral, só a marca de destino da pauta é
// escolhida em round-robin pra satisfazer o playbook/schema existentes.
const AGENTE_MARCAS: Array<'Apice' | 'Barbours'> = ['Apice', 'Barbours'];
let _agenteMarcaIndex = 0;

async function runAgenteGifPipeline(motivoRejeicaoAnterior?: string): Promise<any | null> {
  if (!supabase) return null;
  try {
    const marca = AGENTE_MARCAS[_agenteMarcaIndex % AGENTE_MARCAS.length];
    _agenteMarcaIndex++;

    const conteudosAprendizado = getConteudosGifAprendizado();
    const { aprovados, reprovados } = await getFeedbackAgenteGif();

    const concept = await generateGifAgentConcept({
      marca,
      conteudosAprendizado,
      feedbackAprovados: aprovados,
      feedbackRejeitados: reprovados,
      motivoRejeicaoAnterior,
    });

    if (!concept?.copy || !concept?.operacional) {
      console.warn('[agente-gif] Conceito retornado pelo Gemini veio incompleto, descartando esta rodada.');
      return null;
    }

    const combinedRiscos = [...(concept.riscos || [])];
    const { assunto: assuntoSanitizado, riscos: riscosFinais } = sanitizeAssunto(concept.copy.assunto || "", marca, combinedRiscos);
    concept.copy.assunto = assuntoSanitizado;
    concept.copy.preHeader = "Mas, vou precisar cancelar em breve";
    concept.copy.headlineBanner = sanitizeBannerText(concept.copy.headlineBanner || "");
    concept.copy.subHeadlineBanner = sanitizeBannerText(concept.copy.subHeadlineBanner || "");

    const pautaId = `pauta-agente-${Date.now()}`;
    const aspectRatio = '1:1';
    const frames: string[] = concept.visual?.frames ?? [];
    const frameInicial = frames[0];
    const frameIntermediario = frames[1] ?? frames[0];
    const frameFinal = frames[frames.length - 1] ?? frames[0];

    let frameUrls: Record<string, string> | undefined;
    if (PIAPP_API_KEY && frameInicial && frameFinal) {
      try {
        const { results } = await generateGifFramesSequential({
          marca,
          pautaId,
          aspectRatio,
          imageModel: DEFAULT_IMAGE_MODEL,
          estiloIlustracao: concept.visual?.estiloIlustracao,
          paleta: concept.visual?.paletaRecomendada,
          mecanica: concept.operacional?.mecanicaEscolhida,
          recompensa: concept.operacional?.recompensaEscolhida,
          frameInicial,
          frameIntermediario,
          frameFinal,
        });
        // Chaves "frame_0"/"frame_1"/"frame_2" (não "inicial"/"intermediario"/"final") pra casar
        // com a convenção de nomes que o GifViewer/reconstrução do front já ordena corretamente
        // (ordem alfabética == ordem cronológica). `results` já vem na ordem inicial→final.
        const urls: Record<string, string> = {};
        results.forEach((r, i) => { if (r.publicUrl) urls[`frame_${i}`] = r.publicUrl; });
        if (Object.keys(urls).length > 0) frameUrls = urls;
      } catch (err: any) {
        console.warn('[agente-gif] Falha ao gerar frames automaticamente (pauta fica sem imagem):', err.message);
      }
    }

    const pauta = {
      id: pautaId,
      marca,
      modo: 'C',
      tipo_geracao: 'imagem',
      copy: concept.copy,
      visual: concept.visual,
      operacional: concept.operacional,
      previsao: concept.previsao,
      riscos: risksUnique(riscosFinais),
      status: 'rascunho',
      data_criacao: new Date().toISOString(),
      aspect_ratio: aspectRatio,
      frame_urls: frameUrls ?? null,
    };

    const { error } = await supabase.from('pautas_geradas').upsert(pauta, { onConflict: 'id' });
    if (error) {
      console.warn('[agente-gif] Falha ao salvar pauta gerada:', error.message);
      return null;
    }

    console.log(`[agente-gif] Nova pauta gerada automaticamente: ${pauta.id} (${marca}) — mecânica "${pauta.operacional?.mecanicaEscolhida}"`);
    return pauta;
  } catch (err: any) {
    console.error('[agente-gif] Erro no pipeline automático:', err.message);
    return null;
  }
}

async function ensureDailyAgenteGifQuota() {
  if (!supabase) return;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('pautas_geradas')
    .select('id', { count: 'exact', head: true })
    .eq('modo', 'C')
    .gte('data_criacao', startOfDay.toISOString());
  if (error) {
    console.warn('[agente-gif] Falha ao checar cota diária:', error.message);
    return;
  }

  const faltam = 5 - (count ?? 0);
  if (faltam <= 0) return;

  console.log(`[agente-gif] Gerando ${faltam} pauta(s) automaticamente para completar a cota diária de 5.`);
  for (let i = 0; i < faltam; i++) {
    await runAgenteGifPipeline();
    // Espaça bem as chamadas — o tier gratuito do Gemini limita tokens de entrada por minuto,
    // e cada rodada carrega um bloco grande de grounding (GIFs analisados + feedback histórico).
    await new Promise(r => setTimeout(r, 20000));
  }
}

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
      referenciasImagem: rawRefImages,
    } = req.body;

    if (!frameInicial || !frameIntermediario || !frameFinal) {
      return res.status(400).json({ error: "frameInicial, frameIntermediario e frameFinal são obrigatórios." });
    }
    if (!getBrandDna(marca)) {
      return res.status(400).json({ error: "marca inválida. Use 'Apice' ou 'Barbours'." });
    }

    const aspectRatio = VALID_IMAGE_RATIOS.includes(rawRatio) ? rawRatio : '1:1';
    const imageModel = VALID_IMAGE_MODELS.has(rawModel) ? rawModel : DEFAULT_IMAGE_MODEL;

    const sharedRefUrls: string[] = [];
    const refImagesInput: string[] = Array.isArray(rawRefImages) && rawRefImages.length > 0
      ? rawRefImages.slice(0, 4)
      : (typeof rawRefImage === 'string' && rawRefImage.startsWith('data:') ? [rawRefImage] : []);

    for (const refImg of refImagesInput) {
      if (typeof refImg === 'string' && refImg.startsWith('data:')) {
        try {
          const refUrl = await uploadReferenceToPiApp(refImg);
          sharedRefUrls.push(refUrl);
          console.log('[generate-gif] Referência do usuário enviada ao PiApp:', refUrl);
        } catch (err: any) {
          console.warn('[generate-gif] Upload de referência falhou (ignorando):', err.message);
        }
      }
    }

    const {
      results, imageModel: finalImageModel, compVariant, lightVariant,
    } = await generateGifFramesSequential({
      marca, pautaId, aspectRatio, imageModel,
      estiloIlustracao, paleta, mecanica, recompensa,
      frameInicial, frameIntermediario, frameFinal,
      sharedRefUrls, styleIndex: typeof rawStyleIndex === 'number' && rawStyleIndex >= 0 ? rawStyleIndex : undefined,
    });

    if (supabase) {
      const crmAiMarcas = getCrmAiMarcas();
      const marcaId = crmAiMarcas[marca]?.marcaId ?? (marca === 'Apice' ? 1 : 2);
      const gifInitialPrompt = buildImagePrompt({
        frameName: 'inicial', frameDescription: frameInicial as string,
        marca: marca as string, brandDna: getBrandDna(marca)!,
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
        p_prompt:     results[0] ? gifInitialPrompt : '',
        p_modelo:     finalImageModel,
        p_parametros: { aspectRatio, mecanica: mecanica ?? null, recompensa: recompensa ?? null, pautaId: pautaId ?? null, batch: true },
        p_imagens:    results.map(r => ({
          frame:        r.frameName,
          model:        finalImageModel,
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

IMPORTANTE: O usuário pode mencionar a cor do botão de forma natural (ex: 'botão preto', 'CTA button black', 'black rectangular CTA button'). Extraia a cor exata em hex. Se não mencionar cor do botão, use a cor padrão da marca.

Retorne EXATAMENTE este JSON (sem backticks, sem markdown):
{
  "corTexto": "cor hex do texto principal/headline",
  "corSubheadline": "cor hex ou rgba do sub-headline",
  "estiloBotao": "pill ou retangular ou outline",
  "corBotao": "cor hex do fundo do botão — se o usuário mencionar 'preto' use #000000, 'branco' use #FFFFFF, 'vermelho' use #BF0F26, 'verde' use #1A8A4A, etc.",
  "corTextoBotao": "cor hex do texto dentro do botão — contraste com corBotao",
  "tamanhoHeadline": "grande ou medio ou pequeno",
  "pesoFonte": "400 ou 600 ou 700 ou 900",
  "familiaFonte": "fonte CSS válida",
  "familiaFonteSubheadline": "fonte CSS válida para sub-headline",
  "familiaFonteBotao": "fonte CSS válida para o texto do botão CTA — se não mencionar, use a mesma fonte do subtítulo"
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

// Leitura assistida do calendário. A IA recebe um plano PRONTO e o explica — ela não gera,
// ─── Contexto do modelo (BigQuery) ───────────────────────────────────────────
// Estado da conexão. A tela usa isto para decidir se pode gerar — e para dizer POR QUE
// não pode, quando não pode.
app.get("/api/calendario/status", (req, res) => {
  res.json({ status: "success", data: getStatusBigQuery() });
});

/**
 * Catálogo real, índices e viabilidade. É a rota que substitui o catálogo inventado.
 *
 * O 503 aqui não é preguiça de tratamento: sem estes dados o gerador NÃO TEM o que
 * usar, e a única alternativa a falhar é inventar — que é exatamente o defeito que
 * este endpoint existe para consertar. Falhar alto é o comportamento correto.
 */
app.get("/api/calendario/contexto", (req, res) => {
  const ctx = getContextoModelo();
  if (!ctx) {
    const { erro } = getStatusBigQuery();
    return res.status(503).json({
      error: "Contexto do modelo indisponível: sem conexão com o BigQuery.",
      detalhe: erro,
    });
  }
  const marca = typeof req.query.marca === "string" ? req.query.marca : null;
  if (!marca) return res.json({ status: "success", data: ctx });

  const doMarca = getContextoMarca(marca);
  if (!doMarca) {
    // Gocase cai aqui, e é o caso mais importante de distinguir: ela não está em
    // marca_config porque a tabela de pedidos é Spree e não tem UTM — atribuição
    // impossível (§2.9). Não é fila de trabalho, é bloqueio de origem.
    return res.status(404).json({
      error: `Marca "${marca}" não está no modelo.`,
      marcasDisponiveis: Object.keys(ctx),
    });
  }
  res.json({ status: "success", data: doMarca });
});

/**
 * O que o classificador de ofertas está perdendo. Diagnóstico de manutenção do
 * catálogo, não insumo do plano — por isso rota própria, sob demanda.
 */
app.get("/api/calendario/nao-classificadas", async (req, res) => {
  const marca = typeof req.query.marca === "string" ? req.query.marca : "";
  if (!marca) return res.status(400).json({ error: "Informe ?marca=" });
  try {
    const dados = await campanhasNaoClassificadas(marca);
    res.json({
      status: "success",
      data: dados,
      total: dados.reduce((a, d) => a + Number(d.envios), 0),
    });
  } catch (err: any) {
    res.status(503).json({ error: err.message });
  }
});

// não realoca e não estima. Se um dia esta rota passar a devolver números, o erro estará
// aqui, não no prompt: o payload de entrada já contém todos os números que a resposta pode
// citar (REGRA 1 do modelo).
app.post("/api/calendario/explicar", async (req, res) => {
  try {
    const { calendario, pergunta, eventosEspeciais } = req.body;
    if (!calendario?.slots?.length) {
      return res.status(400).json({ error: "Nenhum calendário gerado para explicar." });
    }
    // Sem chave, o SDK cai silenciosamente nas credenciais do gcloud e volta com um 403 de
    // escopo — erro que não tem nada a ver com a causa e manda quem for depurar para o lado
    // errado. Falhar aqui, dizendo o que falta, custa três linhas.
    //
    // A resolução da chave mora em ai-proxy.ts (área "calendario" → CALENDARIO_AI_KEY,
    // com AI_PROXY_KEY como padrão compartilhado). Duplicar a regra aqui foi o que
    // produziu o bug anterior: o guard continuou checando GEMINI_API_KEY depois que
    // as chaves mudaram e passou a acusar a variável errada.
    if (!aiProxyConfigurado("calendario")) {
      return res.status(503).json({
        error: "Nenhuma chave do AI proxy configurada — a leitura assistida está indisponível. O calendário acima continua válido: ele é gerado pelo modelo determinístico, sem IA.",
      });
    }

    const texto = await explicarCalendario({ calendario, pergunta, eventosEspeciais });
    res.json({ status: "success", data: { texto } });
  } catch (err: any) {
    console.error("Erro na leitura do calendário:", err);
    res.status(500).json({ error: "Erro ao ler o calendário.", details: err.message });
  }
});

app.post("/api/save-frame", async (req, res) => {
  try {
    const { pautaId, frameName, imageDataUrl } = req.body;
    if (!pautaId || !frameName || !imageDataUrl) {
      return res.status(400).json({ error: "Campos obrigatórios faltando." });
    }

    if (!supabase) {
      return res.status(500).json({ error: "Supabase não configurado." });
    }

    const base64Data = imageDataUrl.split(',')[1];
    const mimeType = imageDataUrl.split(';')[0].split(':')[1] || 'image/png';
    const buffer = Buffer.from(base64Data, 'base64');
    const fileName = `frames/${pautaId}/${frameName}.png`;

    const { error } = await supabase
      .storage
      .from('campaign-images')
      .upload(fileName, buffer, { contentType: mimeType, upsert: true });

    if (error) {
      console.error('[save-frame] Erro no upload:', error.message);
      return res.status(500).json({ error: error.message });
    }

    const { data: urlData } = supabase
      .storage
      .from('campaign-images')
      .getPublicUrl(fileName);

    console.log(`[save-frame] Frame salvo: ${urlData.publicUrl}`);
    res.json({ publicUrl: urlData.publicUrl });

  } catch (err: any) {
    console.error('[save-frame] Erro:', err.message);
    res.status(500).json({ error: err.message });
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

// Feedback humano (aprovar/reprovar) de uma pauta modo 'C' gerada pelo agente. Vira sinal de
// aprendizado (crm_ai.ia_outputs, tipo_canal='conceito') pra próximas rodadas de geração.
// Reprovação dispara regeneração imediata; aprovação dispara a proposta de teste A/B.
app.post("/api/feedback-agente-gif", async (req, res) => {
  try {
    if (!supabaseCrmAi) {
      return res.status(500).json({ error: "Supabase não configurado." });
    }

    const { pauta, aprovado, motivo } = req.body;
    if (!pauta || !pauta.id || typeof aprovado !== 'boolean') {
      return res.status(400).json({ error: "pauta e aprovado (boolean) são obrigatórios." });
    }

    const marcaId = pauta.marca === 'Apice' ? 1 : 2;

    const { error: feedbackError } = await supabaseCrmAi.from('ia_outputs').insert({
      marca_id: marcaId,
      tipo_canal: 'conceito',
      o_que_foi_analisado: `Conceito de GIF gerado pelo agente (${pauta.marca}) — mecânica "${pauta.operacional?.mecanicaEscolhida ?? ''}"`,
      fontes_referenciadas: pauta.previsao?.casesReferencia ? { conteudosInspiradores: pauta.previsao.casesReferencia } : null,
      modelo: 'gemini-2.5-flash',
      parametros: { pautaId: pauta.id, marca: pauta.marca },
      recomendacao_estruturada: {
        copy: pauta.copy,
        visual: pauta.visual,
        operacional: pauta.operacional,
        previsao: pauta.previsao,
        riscos: pauta.riscos,
      },
      aprovado,
      feedback_usuario: typeof motivo === 'string' && motivo.trim() ? motivo.trim() : null,
    });

    if (feedbackError) {
      console.error('[feedback-agente-gif] Erro ao salvar feedback:', feedbackError.message);
      return res.status(500).json({ error: 'Erro ao salvar feedback.', details: feedbackError.message });
    }

    let testeAb: any = null;
    if (aprovado) {
      try {
        const candidatos = getConteudosGifAprendizado();
        if (candidatos.length > 0 && supabase) {
          const proposta = await generateAbTestProposal({ marca: pauta.marca, pautaAprovada: pauta, candidatosHistoricos: candidatos });
          const { data, error: insertErr } = await supabase
            .from('teste_ab_propostas')
            .insert({
              marca: pauta.marca,
              pauta_id: pauta.id,
              variante_b_conteudo_id: proposta.conteudoId,
              racional: proposta.racional,
            })
            .select('*')
            .single();
          if (insertErr) console.warn('[feedback-agente-gif] Falha ao salvar proposta de A/B:', insertErr.message);
          else testeAb = data;
        }
      } catch (abErr: any) {
        console.warn('[feedback-agente-gif] Falha ao gerar proposta de A/B:', abErr.message);
      }
    } else {
      // Regeneração imediata, fora da cota diária — não bloqueia a resposta ao usuário.
      runAgenteGifPipeline(typeof motivo === 'string' ? motivo : undefined)
        .catch((err: any) => console.warn('[feedback-agente-gif] Falha na regeneração imediata:', err.message));
    }

    res.json({ success: true, testeAb });
  } catch (err: any) {
    console.error('[feedback-agente-gif] Erro inesperado:', err);
    res.status(500).json({ error: 'Erro interno.', details: err.message });
  }
});

app.get("/api/teste-ab", async (req, res) => {
  try {
    if (!supabase) return res.json({ status: "success", data: [] });
    const { data, error } = await supabase
      .from('teste_ab_propostas')
      .select('*, conteudos_links(nome_design, storage_url, marca)')
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('[teste-ab] Falha ao buscar propostas (provavelmente embed sem cache de FK):', error.message);
      const fallback = await supabase.from('teste_ab_propostas').select('*').order('created_at', { ascending: false });
      return res.json({ status: "success", data: fallback.data ?? [] });
    }
    res.json({ status: "success", data });
  } catch (err: any) {
    console.error('[teste-ab] Erro inesperado:', err);
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
  await loadConteudosGifAprendizado();
  await carregarContextoModelo();

  // Os índices são regerados por job no BigQuery; recarregar de manhã evita que um
  // processo de dev longo fique servindo um snapshot de semanas atrás sem avisar.
  cron.schedule('30 7 * * *', () => {
    carregarContextoModelo().catch((err: any) =>
      console.error('[BigQuery] Erro ao recarregar contexto:', err.message),
    );
  });

  // Agente autônomo de GIF: 10 pautas/dia via cron às 08h, mais catch-up no boot
  // (cobre o caso do processo de dev não estar rodando no horário agendado).
  cron.schedule('0 8 * * *', () => {
    ensureDailyAgenteGifQuota().catch((err: any) => console.error('[agente-gif] Erro no cron diário:', err.message));
  });
  ensureDailyAgenteGifQuota().catch((err: any) => console.error('[agente-gif] Erro no catch-up de boot:', err.message));

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Express Server] Iniciado em http://localhost:${PORT}`);
  });
}
