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
  headline, subheadline, direcionamento,
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
  direcionamento?: string;
}): string {
  const frameStateMap: Record<string, string> = {
    inicial:       'pristine and fully closed, perfectly sealed — pure anticipation, nothing revealed',
    intermediario: 'caught mid-action, the instant of being opened or pulled apart — motion frozen at peak energy',
    final:         'fully open and triumphant, the reward dramatically revealed and glowing center-stage',
  };
  const frameState = frameStateMap[frameName] ?? frameStateMap['inicial'];

  const hitRef = brandDna.hitFormula.split(/\n|\.\ /)[0].trim().replace(/\.$/, '');

  const paletaCores = Array.isArray(paleta?.cores) && (paleta!.cores as string[]).length > 0
    ? (paleta!.cores as string[]).join(', ')
    : brandDna.primaryColors.split(',').slice(0, 2).join(',').trim();

  const styleDesc = estiloIlustracao ?? brandDna.style;

  const comp  = compVariant.replace(/^Composition:\s*/i, '');
  const light = lightVariant.replace(/^Lighting:\s*/i,    '');

  const rewardPhrase = recompensa
    ? frameName === 'final'
      ? ` The reward — "${recompensa}" — is fully revealed, glowing and celebrated.`
      : ` The reward remains completely hidden inside.`
    : '';

  const prohibNote = brandDna.prohibitedColors ? ` ${brandDna.prohibitedColors}` : '';

  return [
    direcionamento
      ? `=== DIRECT USER VISUAL DIRECTION (HIGHEST PRIORITY — follow literally) ===\n"${direcionamento}"\nThis is the exact visual the user wants. Follow every detail: colors, objects, style, composition, lighting. Do NOT deviate, interpret, or "improve". Execute literally.`
      : '',
    `${styleDesc} illustration for a ${marca} luxury beauty email campaign banner.`,
    `Hero: ${mecanica ?? 'campaign mechanic object'}, ${frameState}. Scene: ${frameDescription}.${rewardPhrase}`,
    `Palette — ${paletaCores}. Background: ${brandDna.backgrounds}.${prohibNote}`,
    headline ? `=== CAMPAIGN COPY (text overlaid on this image) === Headline (top zone overlay): "${headline}"` : '',
    subheadline ? `Sub-headline (top zone overlay): "${subheadline}"` : '',
    recompensa ? `Reward/CTA (bottom zone overlay): "${recompensa}"` : '',
    `The image must visually harmonize with this copy — background tones, object colors, and overall mood should complement and not compete with the text above.`,
    `${comp} ${light}`,
    frameName !== 'inicial'
      ? `VISUAL CONSISTENCY RULE (CRITICAL): This is frame "${frameName}" of a 3-frame GIF sequence. The reference image provided is the PREVIOUS frame of this exact same GIF. You MUST match it precisely: same background color, same object style (3D/illustrated/photorealistic), same lighting direction, same color palette, same scale of the hero object. The ONLY thing that should change between frames is the STATE of the object (closed → action → revealed). Everything else must be identical.`
      : `VISUAL CONSISTENCY RULE: This is Frame 1 of a 3-frame GIF. Establish a strong, consistent visual style — the next 2 frames will use this image as their reference. Choose a clear style (3D illustrated OR photorealistic — not mixed), a solid background color, and a centered composition that works for all 3 states.`,
    `CRITICAL TEXT ZONE RULES — text will be composited over this image in production: TOP ZONE (top 28% of frame): MUST be clean, solid or near-solid background — no textures, no objects, no gradients. Must create strong contrast for the headline text: "${headline || 'HEADLINE'}". If headline will be dark/black → top zone must be light (off-white, cream, pale brand color). If headline will be white → top zone must be dark (deep brand color). BOTTOM ZONE (bottom 18% of frame): MUST also be clean for the CTA button overlay. Same background tone as top zone preferred. MIDDLE ZONE (middle 54%): The ONLY area for the hero mechanic object. Center it beautifully. This zone can be vibrant and detailed. CONSISTENCY RULE: All 3 frames of this GIF must use the same background color, same lighting direction, and same object scale. Do NOT vary the composition between frames.`,
    `All three animation frames must share identical background, object materials, lighting direction, and color scheme — only the mechanic state differs.`,
    `Visual reference: ${hitRef}.`,
    `No text, letters, numbers, symbols, watermarks, labels, or UI elements anywhere in the image. Pure illustration asset. Ultra-detailed 4K quality, luxury brand standard. Aspect ratio: ${aspectRatio}.`,
  ].join(' ');
}

export { VALID_IMAGE_MODELS, DEFAULT_IMAGE_MODEL, COMPOSITION_VARIANTS, LIGHTING_VARIANTS };
