import {
  PIAPP_API_KEY, PIAPP_MCP_URL,
  BRAND_DNA_FALLBACK, VALID_IMAGE_MODELS, DEFAULT_IMAGE_MODEL,
  COMPOSITION_VARIANTS, LIGHTING_VARIANTS,
} from "./data.ts";
import { getCrmAiMarcas, getCrmAiHits } from "./supabase.ts";

export async function callPiAppMCP(method: string, params: any): Promise<any> {
  const resp = await fetch(PIAPP_MCP_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PIAPP_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const text = await resp.text();
  const dataLine = text.split('\n').find(l => l.startsWith('data: '));
  if (!dataLine) throw new Error(`PiApp MCP resposta inesperada: ${text.slice(0, 400)}`);
  const payload = dataLine.slice(6);
  try {
    return JSON.parse(payload);
  } catch {
    throw new Error(`PiApp MCP resposta não-JSON (${method}/${(params as any)?.name ?? ''}): ${payload.slice(0, 400)}`);
  }
}

export async function uploadReferenceToPiApp(base64DataUrl: string): Promise<string> {
  const refResp = await callPiAppMCP('tools/call', { name: 'upload_reference', arguments: {} });
  const refData = JSON.parse(refResp.result?.content?.[0]?.text ?? '{}');
  const { upload_url, upload_token, public_url } = refData;
  if (!upload_url || !upload_token || !public_url) {
    throw new Error('PiApp upload_reference não retornou URLs esperadas');
  }

  const [header, base64Data] = base64DataUrl.split(',');
  const mimeType = header.replace('data:', '').replace(';base64', '');
  const imageBuffer = Buffer.from(base64Data, 'base64');

  const putResp = await fetch(upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType, 'Authorization': `Bearer ${upload_token}` },
    body: imageBuffer,
  });
  if (!putResp.ok) {
    const errText = await putResp.text().catch(() => '');
    throw new Error(`Falha no upload de referência PiApp: ${putResp.status} ${errText.slice(0, 200)}`);
  }
  return public_url;
}

export function pixelsToAspectRatio(customRatio: string): string {
  if (!customRatio.startsWith('custom_')) return customRatio;
  const [w, h] = customRatio.replace('custom_', '').split('x').map(Number);
  if (!w || !h) return '1:1';

  const ratio = w / h;

  const options: { ratio: number; value: string }[] = [
    { ratio: 1,     value: '1:1'  },
    { ratio: 0.75,  value: '3:4'  },
    { ratio: 1.333, value: '4:3'  },
    { ratio: 1.778, value: '16:9' },
    { ratio: 0.563, value: '9:16' },
  ];

  let closest = options[0];
  let minDiff = Math.abs(ratio - options[0].ratio);
  for (const opt of options) {
    const diff = Math.abs(ratio - opt.ratio);
    if (diff < minDiff) { minDiff = diff; closest = opt; }
  }

  return closest.value;
}

export async function generateImageViaPiApp(
  prompt: string,
  aspectRatio: string,
  model: string = DEFAULT_IMAGE_MODEL,
  referenceImageUrls?: string[],
): Promise<{ imageBytes: string; mimeType: string }> {
  const genArgs: Record<string, any> = { prompt, model, aspect_ratio: aspectRatio, quality: 'standard' };
  if (referenceImageUrls && referenceImageUrls.length > 0) {
    genArgs.reference_image_urls = referenceImageUrls;
  }

  // 1. Disparar geração
  const genResp = await callPiAppMCP('tools/call', {
    name: 'generate_image',
    arguments: genArgs,
  });

  const genData = JSON.parse(genResp.result?.content?.[0]?.text ?? '{}');
  const jobId: string = genData.job_id;
  if (!jobId) throw new Error('PiApp não retornou job_id');

  // 2. Polling até all_done (máx 90s, intervalo 3s)
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const checkResp = await callPiAppMCP('tools/call', {
      name: 'check_jobs',
      arguments: { job_ids: [jobId] },
    });
    const checkData = JSON.parse(checkResp.result?.content?.[0]?.text ?? '{}');
    if (!checkData.all_done) continue;

    const job = checkData.jobs?.[0];
    if (!job || job.status === 'error') throw new Error(job?.error ?? 'Geração de imagem falhou no PiApp');

    // 3. Buscar imagem e converter para base64
    const imgResp = await fetch(job.output_url);
    if (!imgResp.ok) throw new Error(`Falha ao baixar imagem: ${imgResp.status}`);
    const buffer = await imgResp.arrayBuffer();
    const mimeType = imgResp.headers.get('content-type') ?? 'image/png';
    const imageBytes = Buffer.from(buffer).toString('base64');
    return { imageBytes, mimeType };
  }

  throw new Error('Timeout: geração de imagem no PiApp excedeu 90 segundos');
}

// Returns brand context for PiApp prompt — uses live crm_ai data when loaded, falls back to hardcoded
export function getBrandDna(marca: string) {
  const fallback = BRAND_DNA_FALLBACK[marca];
  if (!fallback) return null;

  const crmAiMarcas = getCrmAiMarcas();
  const crmAiHits = getCrmAiHits();
  const loaded = crmAiMarcas[marca];
  const hits = crmAiHits[marca] ?? [];

  let hitFormula = fallback.hitFormula;
  if (hits.length > 0) {
    const hitLines = hits.slice(0, 5).map((h, i) =>
      `${i + 1}. "${h.mecanicaNome}" (${h.receita} receita, ${h.taxaAbertura} abertura): ${h.descricaoVisual.split('\n')[0]}`
    ).join('\n');
    hitFormula = `Proven revenue-driving visual patterns for ${marca} (real campaign data from Supabase):\n${hitLines}\nRule: ONE dominant central 3D illustrated object. Human interaction element. Clean solid background. No clutter.`;
  }

  const primaryColors = loaded?.paletaFormatada
    ? `Primary: ${loaded.primaryHex} | Secondary: ${loaded.secondaryHex} | Full palette: ${loaded.paletaFormatada}`
    : fallback.primaryColors;

  return {
    style: fallback.style,
    primaryColors,
    backgrounds: fallback.backgrounds,
    hitFormula,
    prohibitedColors: fallback.prohibitedColors,
  };
}

export function buildImagePrompt({
  frameName, frameDescription, marca, brandDna,
  estiloIlustracao, paleta, mecanica, recompensa,
  aspectRatio, compVariant, lightVariant,
  headline, subheadline, cta, direcionamento, totalFrames, frameMetadata,
}: {
  frameName: string;
  frameDescription: string;
  marca: string;
  brandDna: { style: string; primaryColors: string; backgrounds: string; hitFormula: string; prohibitedColors: string };
  estiloIlustracao: string | undefined;
  paleta: { cores?: string[] } | undefined;
  mecanica: string | undefined;
  recompensa: string | undefined;
  aspectRatio: string;
  compVariant: string;
  lightVariant: string;
  headline?: string;
  subheadline?: string;
  cta?: string;
  direcionamento?: string;
  totalFrames?: number;
  frameMetadata?: {
    backgroundColor?: string;
    headlineFontSize?: string;
    headlineFontWeight?: string;
    headlineColor?: string;
    headlineTopPosition?: string;
    headlineIsItalic?: boolean;
    subheadlineFontSize?: string;
    subheadlineColor?: string;
    subheadlineTopPosition?: string;
    buttonWidth?: string;
    buttonHeight?: string;
    buttonBottomPosition?: string;
    buttonBackgroundColor?: string;
    buttonTextColor?: string;
    buttonBorderRadius?: string;
    buttonFontSize?: string;
    accentColors?: string[];
  };
}): string {
  const frameStateMap: Record<string, string> = {
    inicial:       'pristine and fully closed, perfectly sealed — pure anticipation, nothing revealed',
    intermediario: 'caught mid-action, the instant of being opened or pulled apart — motion frozen at peak energy',
    final:         'fully open and triumphant, the reward dramatically revealed and glowing center-stage',
  };
  const frameState = frameStateMap[frameName] ?? frameStateMap['inicial'];
  const hitRef = brandDna.hitFormula.split(/\n|\. /)[0].trim().replace(/\.$/, '');
  const paletaCores = Array.isArray(paleta?.cores) && (paleta!.cores as string[]).length > 0
    ? (paleta!.cores as string[]).join(', ')
    : brandDna.primaryColors.split(',').slice(0, 2).join(',').trim();
  const styleDesc = estiloIlustracao ?? brandDna.style;
  const rewardPhrase = recompensa
    ? frameName === 'final'
      ? ` The reward — "${recompensa}" — is fully revealed, glowing and celebrated.`
      : ` The reward remains completely hidden inside.`
    : '';
  const prohibNote = brandDna.prohibitedColors ? ` ${brandDna.prohibitedColors}` : '';

  // Quando há direcionamento do usuário, NÃO usar compVariant/lightVariant
  // pois o usuário já especificou composição e iluminação
  const compositionBlock = direcionamento
    ? ''
    : `${compVariant.replace(/^Composition:\s*/i, '')} ${lightVariant.replace(/^Lighting:\s*/i, '')}`;

  const totalFramesLabel = `frame ${parseInt(frameName.replace('frame_', '')) + 1} of ${totalFrames ?? 3}`;

  const consistencyBlock = frameName === 'frame_0' || frameName === 'inicial'
    ? `FRAME 1 — ESTABLISH FIXED LAYOUT:
You are creating the MASTER FRAME that all other frames must copy exactly.
Define and lock these elements permanently:

TEXT LAYOUT (must be pixel-identical in all frames):
- HEADLINE: top-aligned, full width, large bold uppercase font, same size filling ~90% of the top area width
- SUB-HEADLINE: immediately below headline, same font weight and color scheme, centered
- CTA BUTTON: bottom center, fixed width (~55% of frame), fixed height, same border-radius, same colors

IMPORTANT: Choose specific values now and stick to them:
- Headline font size: pick one size that fits the text in 1-2 lines and keep it
- Button: pick pill OR rectangle — do not change between frames
- Text colors: pick exact colors now — do not vary in subsequent frames

The hero object (ribbon/scissors/etc) occupies the MIDDLE area only.`

    : `FRAME ${parseInt(frameName.replace('frame_', '')) + 1} — COPY MASTER FRAME EXACTLY:

The reference image is Frame 1 — the MASTER FRAME. You must reproduce it with ONE change only.
${frameMetadata ? `
EXTRACTED MEASUREMENTS FROM MASTER FRAME (use these EXACT values):
- Background color: ${frameMetadata.backgroundColor ?? 'match reference'}
- Headline: font-size ${frameMetadata.headlineFontSize ?? 'match reference'}px, weight ${frameMetadata.headlineFontWeight ?? 'bold'}, color ${frameMetadata.headlineColor ?? 'match reference'}, italic: ${frameMetadata.headlineIsItalic ? 'YES' : 'NO'}, top position: ${frameMetadata.headlineTopPosition ?? 'match reference'}px from top
- Sub-headline: font-size ${frameMetadata.subheadlineFontSize ?? 'match reference'}px, color ${frameMetadata.subheadlineColor ?? 'match reference'}, top position: ${frameMetadata.subheadlineTopPosition ?? 'match reference'}px from top
- Button: ${frameMetadata.buttonWidth ?? 'match reference'}px wide × ${frameMetadata.buttonHeight ?? 'match reference'}px tall, ${frameMetadata.buttonBorderRadius ?? 'match reference'} shape, background ${frameMetadata.buttonBackgroundColor ?? 'match reference'}, text color ${frameMetadata.buttonTextColor ?? 'match reference'}, font-size ${frameMetadata.buttonFontSize ?? 'match reference'}px, bottom position: ${frameMetadata.buttonBottomPosition ?? 'match reference'}px from bottom
${frameMetadata.accentColors?.length ? `- Accent colors: ${frameMetadata.accentColors.join(', ')}` : ''}
These are EXACT pixel measurements. Do NOT deviate from them.` : ''}
COPY THESE ELEMENTS PIXEL-FOR-PIXEL from the reference:
✓ Headline: exact same font size, weight, color, position, line breaks
✓ Sub-headline: exact same font size, weight, color, position, line breaks
✓ CTA button: exact same width, height, border-radius, background color, text size, text color, position
✓ Background color: identical
✓ Overall composition and margins: identical

ONLY CHANGE: the position/state of the animated hero element (${
  frameName === 'frame_1' || frameName === 'intermediario'
    ? 'mid-action state'
    : 'final/revealed state'
})

If you change ANYTHING about the text layout, font size, button size or colors compared to the reference image, that is a CRITICAL ERROR.
The viewer will see these as an animation — any text movement or size change creates a distracting flicker.`;

  return [
    // 1. Direcionamento do usuário — prioridade máxima
    direcionamento
      ? `=== DIRECT USER VISUAL DIRECTION — HIGHEST PRIORITY — OVERRIDE EVERYTHING BELOW IF CONFLICT ===\n"${direcionamento}"\nFollow every detail literally: colors, objects, style, composition, lighting, background. Do NOT deviate.\nFor this specific frame (${frameName}): apply the direction above to show the object in state: ${frameState}.`
      : '',

    // 2. Descrição base
    `${styleDesc} illustration for a ${marca} luxury beauty email campaign banner.`,
    `Hero: ${mecanica ?? 'campaign mechanic object'}, ${frameState}. Scene: ${frameDescription}.${rewardPhrase}`,
    `Palette — ${paletaCores}. Background: ${brandDna.backgrounds}.${prohibNote}`,

    // 3. Copy da campanha
    headline || subheadline
      ? `=== CAMPAIGN COPY (for color harmony reference only — DO NOT render text) ===
Headline text that will be overlaid: "${headline}"
Sub-headline text that will be overlaid: "${subheadline}"
Use this copy ONLY to choose harmonious background colors and palette. Do NOT render any text in the image.`
      : '',
    recompensa ? `Reward/CTA: "${recompensa}"` : '',
    `Background and palette must harmonize with copy above — complement, never compete.`,

    // 4. Composição (só quando não há direcionamento)
    compositionBlock,

    // 5. Consistência entre frames
    consistencyBlock,

    // 6. Zonas de texto
    `COMPOSITION ZONES:
- TOP ZONE (top 30%): Leave COMPLETELY EMPTY — clean solid background only. Text will be overlaid here in post-production. NO objects, textures, gradients or decorations in this zone.
- MIDDLE ZONE (middle 50%): Hero object only — centered beautifully.
- BOTTOM ZONE (bottom 20%): Leave COMPLETELY EMPTY — clean solid background only. CTA button will be overlaid here. NO objects in this zone.`,

    // 7. Restrições finais
    `NO TEXT anywhere in the image — no letters, numbers, symbols, watermarks or UI elements. Pure illustration asset only. Ultra-detailed 4K quality, luxury brand standard. Aspect ratio: ${aspectRatio}.`,
  ].filter(Boolean).join('\n\n');
}

export { VALID_IMAGE_MODELS, DEFAULT_IMAGE_MODEL, COMPOSITION_VARIANTS, LIGHTING_VARIANTS };
