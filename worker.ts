const SUPABASE_URL = 'https://krxuwejvkdkrjrppcwsw.supabase.co';
const PIAPP_MCP_URL = 'https://piapp-v2.vercel.app/api/ai/mcp';

interface Env {
  SUPABASE_KEY: string;
  SUPABASE_SERVICE_KEY: string;
  PIAPP_API_KEY: string;
  GOGROUP_TOKEN: string;
  INSIDER_API_KEY_APICE?: string;
  INSIDER_API_KEY_BARBOURS?: string;
  INSIDER_API_KEY_RITUARIA?: string;
  INSIDER_API_KEY_LESCENT?: string;
  INSIDER_API_KEY_KOKESHI?: string;
  INSIDER_API_KEY_GOCASE?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

const BRAND_DNA: Record<string, any> = {
  Apice: {
    primaryColors: 'Forest Green #688D65, Magenta #D553A5, Aqua #AAD4C7, Off-White #F4F1E5',
    backgrounds: 'Clean off-white #F4F1E5 or soft aqua tint.',
    style: 'Clean 2D organic or soft 3D digital illustration, warm feminine mood',
    prohibitedColors: 'Avoid harsh neons and cold blues.',
  },
  Barbours: {
    primaryColors: 'Ruby Red #BF0F26, Gold #AA834B, Merlot #4F080E, Pink Blush #FFCCD5',
    backgrounds: 'Pastel pink #FFCCD5, OR Off-White #E7E3D8, OR deep Merlot #4F080E.',
    style: 'Premium 3D illustrated luxury editorial style, dramatic studio lighting',
    prohibitedColors: 'NEVER use green, orange, yellow or cold blue.',
  },
};

const hardcodedDisparos = [
  { id: 'EMA-101', marca: 'Apice', mecanica: 'Abra o presente', disparos: 1, receitaMedia: 8767, performance: 'excelente' },
  { id: 'EMA-102', marca: 'Apice', mecanica: 'Abra a caixa', disparos: 3, receitaMedia: 6312, performance: 'hit' },
  { id: 'EMA-103', marca: 'Apice', mecanica: 'Abra a carta', disparos: 3, receitaMedia: 4711, performance: 'medio' },
  { id: 'EMA-104', marca: 'Apice', mecanica: 'Puxe o Adesivo', disparos: 6, receitaMedia: 6348, performance: 'hit' },
  { id: 'EMA-105', marca: 'Apice', mecanica: 'Corte o fio', disparos: 5, receitaMedia: 6048, performance: 'hit' },
  { id: 'EMA-106', marca: 'Apice', mecanica: 'Jogo da Velha', disparos: 3, receitaMedia: 6880, performance: 'hit' },
  { id: 'EMA-107', marca: 'Apice', mecanica: 'Rasgue o papel', disparos: 3, receitaMedia: 5508, performance: 'medio' },
  { id: 'EMA-108', marca: 'Apice', mecanica: 'Puxe o post-it', disparos: 3, receitaMedia: 4658, performance: 'medio' },
  { id: 'EMA-109', marca: 'Apice', mecanica: 'Estoure o balão', disparos: 2, receitaMedia: 3854, performance: 'fraco' },
  { id: 'EMA-110', marca: 'Apice', mecanica: 'Puxe o cupom', disparos: 1, receitaMedia: 2415, performance: 'aposentar' },
  { id: 'EMA-201', marca: 'Barbours', mecanica: 'Abra o presente', disparos: 8, receitaMedia: 13295, performance: 'dominante' },
  { id: 'EMA-204', marca: 'Barbours', mecanica: 'Abra a caixa', disparos: 6, receitaMedia: 12691, performance: 'dominante' },
  { id: 'EMA-205', marca: 'Barbours', mecanica: 'Abra a carta', disparos: 1, receitaMedia: 9658, performance: 'medio' },
  { id: 'EMA-206', marca: 'Barbours', mecanica: 'Corte o fio', disparos: 2, receitaMedia: 11346, performance: 'hit' },
  { id: 'EMA-207', marca: 'Barbours', mecanica: 'Rasgue o papel', disparos: 1, receitaMedia: 6321, performance: 'incompativel' },
  { id: 'EMA-208', marca: 'Barbours', mecanica: 'Estoure o balão', disparos: 1, receitaMedia: 19220, performance: 'outlier' },
  { id: 'EMA-209', marca: 'Barbours', mecanica: 'Puxe o cupom', disparos: 2, receitaMedia: 12600, performance: 'hit' },
];

const DEFAULT_MECANICAS = ['Abra o presente','Abra a caixa','Abra a carta','Puxe o Adesivo','Corte o fio','Jogo da Velha','Rasgue o papel','Puxe o post-it','Estoure o balão','Puxe o cupom'];

async function callGemini(prompt: string, systemPrompt: string, token: string): Promise<string> {
  const res = await fetch('https://ai-proxy.gogroupbr.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: 'gpt-5.5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('[callGemini] Gogroup proxy erro:', JSON.stringify(err));
    throw new Error(JSON.stringify(err));
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '[]';
}

async function callPiApp(method: string, params: any, apiKey: string): Promise<any> {
  const resp = await fetch(PIAPP_MCP_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params })
  });
  const text = await resp.text();
  const dataLine = text.split('\n').find((l: string) => l.startsWith('data: '));
  if (!dataLine) throw new Error('PiApp unexpected response');
  return JSON.parse(dataLine.slice(6));
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mimeType: string } {
  const [header, base64Data] = dataUrl.split(',');
  const mimeType = header.replace('data:', '').replace(';base64', '');
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return { bytes, mimeType };
}

async function uploadReferenceToPiApp(dataUrl: string, apiKey: string): Promise<string> {
  const { bytes, mimeType } = dataUrlToBytes(dataUrl);
  const ext = mimeType.split('/')[1] || 'png';
  const refResp = await callPiApp('tools/call', { name: 'upload_reference', arguments: { filename: `reference-${Date.now()}.${ext}`, content_type: mimeType } }, apiKey);
  const refText = refResp.result?.content?.[0]?.text ?? '{}';
  const refData = JSON.parse(refText);
  const { upload_url, upload_token, public_url } = refData;
  if (!upload_url || !upload_token || !public_url) throw new Error(`PiApp upload_reference não retornou URLs esperadas: ${refText.slice(0, 300)}`);
  const putResp = await fetch(upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType, 'Authorization': `Bearer ${upload_token}` },
    body: bytes.buffer as ArrayBuffer,
  });
  if (!putResp.ok) throw new Error(`Falha no upload de referência PiApp: ${putResp.status}`);
  return public_url;
}

async function uploadReferences(rawRefImage: unknown, rawRefImages: unknown, apiKey: string): Promise<string[]> {
  const inputs: string[] = Array.isArray(rawRefImages) && rawRefImages.length > 0
    ? rawRefImages.slice(0, 4)
    : (typeof rawRefImage === 'string' && rawRefImage.startsWith('data:') ? [rawRefImage] : []);
  const urls: string[] = [];
  for (const img of inputs) {
    if (typeof img === 'string' && img.startsWith('data:')) {
      try {
        urls.push(await uploadReferenceToPiApp(img, apiKey));
      } catch (err: any) {
        console.error('[uploadReferences] Falha ao enviar referência (ignorando):', err.message);
      }
    }
  }
  return urls;
}

function resolveImageModel(requestedModel: string, hasReference: boolean): string {
  if (hasReference && requestedModel === 'wavespeed-gpt-image-2-t2i') {
    return 'wavespeed-gpt-image-2-edit';
  }
  return requestedModel;
}

async function generateImage(prompt: string, aspectRatio: string, model: string, apiKey: string, refUrls?: string[]) {
  const genArgs: any = { prompt, model, aspect_ratio: aspectRatio, quality: 'standard' };
  if (refUrls?.length) genArgs.reference_image_urls = refUrls;
  const genResp = await callPiApp('tools/call', { name: 'generate_image', arguments: genArgs }, apiKey);
  const jobId = JSON.parse(genResp.result?.content?.[0]?.text ?? '{}').job_id;
  if (!jobId) throw new Error('No job_id from PiApp');
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const check = await callPiApp('tools/call', { name: 'check_jobs', arguments: { job_ids: [jobId] } }, apiKey);
    const checkData = JSON.parse(check.result?.content?.[0]?.text ?? '{}');
    if (!checkData.all_done) continue;
    const job = checkData.jobs?.[0];
    if (!job || job.status === 'error') throw new Error(job?.error ?? 'Generation failed');
    const imgResp = await fetch(job.output_url);
    const buffer = await imgResp.arrayBuffer();
    // Usar loop em vez de spread para evitar stack overflow com imagens grandes
    const uint8Array = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      binary += String.fromCharCode(...uint8Array.subarray(i, i + chunkSize));
    }
    const imageBytes = btoa(binary);
    return { imageBytes, mimeType: imgResp.headers.get('content-type') ?? 'image/png' };
  }
  throw new Error('Timeout after 90s');
}

async function supabaseUpload(bucket: string, path: string, data: Uint8Array, mimeType: string, supabaseKey: string) {
  return fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': mimeType, 'x-upsert': 'true' },
    body: data.buffer as ArrayBuffer
  });
}

const FRAME_STATE_HINTS: Record<string, string> = {
  inicial: 'pristine and fully closed, perfectly sealed — pure anticipation, nothing revealed',
  intermediario: 'caught mid-action, the instant of being opened or pulled apart — motion frozen at peak energy',
  final: 'fully open and triumphant, the reward dramatically revealed and glowing center-stage',
};

const NAMED_FRAME_NUMBERS: Record<string, number> = { inicial: 1, intermediario: 2, final: 3 };

function buildFramePrompt({
  frameName, frameDescription, marca, brandDna, estiloIlustracao, paleta, mecanica, recompensa,
  headline, subheadline, direcionamento, aspectRatio, frameRefCount = 0, productRefCount = 0, totalFrames,
  ajusteRegeneracao,
}: {
  frameName?: string; frameDescription: string; marca: string; brandDna: any;
  estiloIlustracao?: string; paleta?: { cores?: string[] }; mecanica?: string; recompensa?: string;
  headline?: string; subheadline?: string; direcionamento?: string; aspectRatio: string; frameRefCount?: number;
  productRefCount?: number; totalFrames?: number; ajusteRegeneracao?: string;
}): string {
  const paletaCores = Array.isArray(paleta?.cores) && paleta!.cores!.length ? paleta!.cores!.join(', ') : brandDna.primaryColors;
  const frameState = frameName ? FRAME_STATE_HINTS[frameName] : undefined;
  const rewardPhrase = recompensa
    ? (frameName === 'final' ? ` The reward item(s) described above are fully revealed, glowing and celebrated — visually only, no text or labels.` : ` The reward remains completely hidden inside.`)
    : '';
  const isFirstFrame = frameName === 'inicial' || frameName === 'frame_0';
  const frameNumber = frameName
    ? (NAMED_FRAME_NUMBERS[frameName] ?? (parseInt(frameName.replace('frame_', '')) + 1 || 1))
    : undefined;
  const isLastFrame = totalFrames !== undefined && frameNumber === totalFrames;

  // Instrução só positiva, sem repetir palavras como "vignette"/"darkening"/"dimming" —
  // modelos de imagem lidam mal com negação e mencionar o efeito indesejado repetidamente
  // tende a reforçá-lo em vez de evitá-lo.
  // IMPORTANTE: essa regra de brilho/uniformidade só entra na descrição do FRAME 1 (que
  // estabelece a luz do zero). Repeti-la em todo frame de uma cadeia de edição-com-referência
  // faz cada geração "reforçar" brilho/uniformidade em cima da anterior, e o resultado vai
  // clareando/embranquecendo cumulativamente a cada frame. Frames 2+ devem só COPIAR a
  // exposição do frame mestre, nunca reaplicar a regra de brilho independentemente.
  const lightingRule = `Lighting: soft, natural studio light, perfectly even across the whole frame — a plain, clean gradient or solid background with NO brightness falloff toward any edge (top, bottom, or sides must be exactly as exposed as the center, no darker and no brighter). No visible light rays, sunburst, lens flare, glow bursts, halo, bloom, backlight glare, or radiating beams of light anywhere in the image; no washed-out or overexposed patches. Keep the lighting flat, simple and photographic, not stylized.`;
  const cameraLockRule = `Camera and lighting stay fixed across frames: same zoom, framing, crop and light setup. Only the hero element's state/position changes (per the scene below), and only as a small continuous step from the previous frame — never a jump. Any OTHER object mentioned in the scene (secondary props, reward items, background elements) must stay at the EXACT SAME position and scale as in the reference frame — zero drift. Reproduce the master frame's exact exposure, brightness and contrast — do NOT re-apply or increase brightness/evenness independently; copy it as-is, even if it looks slightly uneven. The camera and lighting themselves never change.`;

  // As imagens de referência são anexadas NESTA ORDEM EXATA (não pode divergir do texto,
  // senão o modelo confunde "foto do produto real" com "frame mestre"): produtos primeiro,
  // depois frame mestre, depois frame anterior. O texto abaixo precisa numerar na mesma ordem.
  const refLabels: string[] = [];
  for (let i = 0; i < productRefCount; i++) {
    refLabels.push(`[${refLabels.length + 1}] REAL PRODUCT REFERENCE PHOTO — this shows the actual physical product(s) that must appear in the scene. Reproduce it EXACTLY: same color, texture, material, proportions, logo/branding/pull-tab text. Never restyle, redesign or substitute it.`);
  }
  if (ajusteRegeneracao) {
    // Modo de ajuste pontual: a referência de frame anexada é a imagem ATUAL deste mesmo
    // frame (antes da edição), não o mestre nem o frame anterior — o rótulo precisa refletir
    // isso, senão o modelo trata como "outro frame da sequência" em vez de "edite esta imagem".
    if (frameRefCount >= 1) {
      refLabels.push(`[${refLabels.length + 1}] THE CURRENT VERSION OF THIS EXACT FRAME, BEFORE THE EDIT — reproduce it pixel-for-pixel except for the specific change requested above. This is not a different frame in a sequence — it is this frame's starting point.`);
    }
  } else {
    if (frameRefCount >= 1) {
      refLabels.push(`[${refLabels.length + 1}] FRAME 1 (the master frame) — match its background, composition, framing and lighting.`);
    }
    if (frameRefCount >= 2) {
      refLabels.push(`[${refLabels.length + 1}] the immediately preceding frame — use ONLY to continue the hero element's motion/state naturally, not for background/composition.`);
    }
  }
  const refOrderBlock = refLabels.length > 0
    ? `REFERENCE IMAGES ATTACHED, IN THIS EXACT ORDER:\n${refLabels.join('\n')}`
    : '';

  const consistencyBlock = ajusteRegeneracao
    ? (frameRefCount >= 1 ? `Reproduce the attached reference image closely — same background, composition, framing, lighting and every object's position — except for the specific change requested above.` : '')
    : frameRefCount >= 1
      ? `FRAME ${frameNumber} — reproduce the master frame's background, composition, framing and lighting closely. ${cameraLockRule}`
      : (isFirstFrame ? `FRAME 1 — MASTER FRAME: establish the composition, background color, camera framing and lighting now; every later frame will match it. ${lightingRule}` : '');

  return [
    ajusteRegeneracao
      ? `=== ⚠️ ONE-OFF RE-GENERATION REQUEST FOR THIS EXACT FRAME — ABSOLUTE HIGHEST PRIORITY, OVERRIDE EVERYTHING BELOW IF CONFLICT ===\n"${ajusteRegeneracao}"\nApply this change to FRAME ${frameNumber} specifically. Keep everything else about the frame — product identity, position, composition, background, lighting — exactly as it already was, changing ONLY what this instruction asks for.`
      : '',
    direcionamento
      ? `=== USER DIRECTION (may describe the FULL sequence of ${totalFrames ?? '?'} frames) ===\n"${direcionamento}"\n⚠️ This is FRAME ${frameNumber}${isFirstFrame ? ' (the FIRST frame)' : isLastFrame ? ' (the LAST frame)' : ' (a MIDDLE frame)'} of the sequence. Apply ONLY the part of the direction above that describes FRAME ${frameNumber} (it may be labeled "Frame ${frameNumber}" or similar in the text). IGNORE the descriptions of the other frames — they do not apply here.`
      : '',
    refOrderBlock,
    `${estiloIlustracao || brandDna.style} illustration for ${marca} email banner.`,
    isFirstFrame
      ? `Hero: ${mecanica || 'mechanic'}${frameState ? `, ${frameState}` : ''}. Scene (full establishing description — defines the fixed layout every later frame must match): ${frameDescription}.${rewardPhrase}`
      : `Hero: ${mecanica || 'mechanic'}${frameState ? `, ${frameState}` : ''}. ONLY THIS CHANGES vs the reference frame: ${frameDescription}.${rewardPhrase} Everything not mentioned here (background, secondary props, reward items not yet revealed) must remain pixel-identical to the reference image — do not re-imagine or reposition it.`,
    `Palette: ${paletaCores}.${direcionamento ? '' : ` Background: ${brandDna.backgrounds}.`} ${brandDna.prohibitedColors}`,
    consistencyBlock,
    `ZONES: TOP 30% empty. MIDDLE 50% hero. BOTTOM 20% empty. ABSOLUTELY NO TEXT of any kind anywhere in the image — no letters, words, numbers, or symbols, even if they relate to this campaign. This is a pure background/product illustration; all copy is added separately afterward. 4K. Ratio: ${aspectRatio}.`
  ].filter(Boolean).join('\n\n');
}

function sanitize(text: string): string {
  return ['%','OFF','GRÁTIS','GRATIS','R$'].reduce((t, w) => t.replace(new RegExp(w.replace('$','\\$'), 'gi'), ''), text).trim();
}

function normalizePauta(p: any, marca: string, modo: string, tipoGeracao: string, index: number, qtdFrames: number = 3, aspectRatio: string = '1:1'): any {
  return {
    id: `pauta-${Date.now()}-${index}`,
    marca,
    modo: modo === 'B' ? 'B' : modo === 'C' ? 'C' : 'A',
    tipoGeracao,
    copy: {
      assunto: sanitize(String(p.copy?.assunto ?? '')),
      preHeader: 'Mas, vou precisar cancelar em breve',
      headlineBanner: sanitize(String(p.copy?.headlineBanner ?? '')),
      subHeadlineBanner: sanitize(String(p.copy?.subHeadlineBanner ?? '')),
      ctaBotao: String(p.copy?.ctaBotao ?? ''),
    },
    visual: {
      formato: String(p.visual?.formato ?? 'GIF animado'),
      paletaRecomendada: {
        nome: String(p.visual?.paletaRecomendada?.nome ?? 'Paleta da marca'),
        cores: Array.isArray(p.visual?.paletaRecomendada?.cores) ? p.visual.paletaRecomendada.cores : [],
      },
      estiloIlustracao: String(p.visual?.estiloIlustracao ?? ''),
      frames: Array.isArray(p.visual?.frames) ? p.visual.frames.slice(0, qtdFrames) : [],
      posicaoCta: String(p.visual?.posicaoCta ?? 'Inferior centralizado'),
      tipografia: String(p.visual?.tipografia ?? ''),
    },
    operacional: {
      mecanicaEscolhida: String(p.operacional?.mecanicaEscolhida ?? ''),
      justificativaMecanica: String(p.operacional?.justificativaMecanica ?? ''),
      recompensaEscolhida: String(p.operacional?.recompensaEscolhida ?? ''),
      diaRecomendado: String(p.operacional?.diaRecomendado ?? ''),
      horarioRecomendado: String(p.operacional?.horarioRecomendado ?? ''),
      segmentoRecomendado: String(p.operacional?.segmentoRecomendado ?? ''),
    },
    previsao: {
      aberturaEsperada: String(p.previsao?.aberturaEsperada ?? '-'),
      ctorEsperado: String(p.previsao?.ctorEsperado ?? '-'),
      receitaEsperada: String(p.previsao?.receitaEsperada ?? '-'),
      casesReferencia: Array.isArray(p.previsao?.casesReferencia) ? p.previsao.casesReferencia : [],
      confianca: String(p.previsao?.confianca ?? 'alta'),
      confiancaMotivo: String(p.previsao?.confiancaMotivo ?? ''),
    },
    riscos: Array.isArray(p.riscos)
      ? p.riscos.map((r: any) => typeof r === 'string'
          ? { campo: 'geral', nivel: 'baixo', mensagem: r, alternativaSugerida: '' }
          : { campo: String(r.campo ?? 'geral'), nivel: String(r.nivel ?? 'baixo'), mensagem: String(r.mensagem ?? ''), alternativaSugerida: String(r.alternativaSugerida ?? '') })
      : [],
    status: 'rascunho',
    dataCriacao: new Date().toISOString(),
    aspectRatio,
  };
}

// ─── Agente Autônomo de GIF ─────────────────────────────────────────────────
// Gera pautas modo 'C' sem intervenção humana na criação. Agendado pela plataforma
// GoDeploy via createCronJob apontando pra /tasks/agente-gif-tick (NÃO usar
// setInterval/node-cron aqui — o runtime é serverless, sem processo de longa duração).
// Sem separação por marca no grounding (v1): o pool de conteudos_links é lido
// inteiro, só a marca de destino da pauta é sorteada pra satisfazer o playbook/schema.
const AGENTE_PLAYBOOK: Record<string, string> = {
  // v1: conceitos GENÉRICOS, sem identidade visual/nichada de marca — o mesmo conteúdo pode ser
  // usado por Apice, Barbours ou qualquer marca futura que ganhe acesso à Insider. Nada de
  // "cabelo" (Apice) ou "beleza/perfume" (Barbours) hardcoded no racional ou na mecânica.
  Apice: 'Tom acolhedor e próximo, em 1ª pessoa. Assunto: 20-45 caracteres.',
  Barbours: 'Tom direto e elegante, estilo push-notification. Assunto: 20-45 caracteres.',
};

async function supabaseRestGet(path: string, key: string): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Supabase GET ${path} falhou: ${res.status} ${await res.text()}`);
  return res.json();
}

async function supabaseRpc(fn: string, args: any, key: string): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Supabase RPC ${fn} falhou: ${res.status} ${await res.text()}`);
  return res.json();
}

async function supabaseUpsertPauta(pautaRow: any, key: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/pautas_geradas?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: key, Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(pautaRow),
  });
  if (!res.ok) throw new Error(`Upsert pautas_geradas falhou: ${res.status} ${await res.text()}`);
}

async function loadConteudosGifAprendizado(key: string): Promise<any[]> {
  try {
    // status_analise reflete revisão humana do TEXTO da análise, não curadoria do GIF — hoje
    // nenhuma linha tem status 'aprovado' porque esse fluxo nunca foi usado. O sinal real de
    // "já foi analisado" é mecanica_texto IS NOT NULL; só excluímos 'descartado'.
    return await supabaseRestGet(
      `conteudos_links?select=id,marca,nome_design,storage_url,insider_original_url,mecanica_texto,composicao_texto&tipo_midia=eq.gif&status_analise=neq.descartado&mecanica_texto=not.is.null`,
      key,
    );
  } catch (err: any) {
    console.error('[agente-gif] Falha ao carregar conteudos_links:', err.message);
    return [];
  }
}

async function getFeedbackAgenteGif(key: string): Promise<{ aprovados: any[]; reprovados: any[] }> {
  try {
    const rows = await supabaseRpc('crm_ai_get_conceito_feedback', { limit_n: 15 }, key);
    const list = Array.isArray(rows) ? rows : [];
    return {
      aprovados: list.filter((r: any) => r.aprovado === true),
      reprovados: list.filter((r: any) => r.aprovado === false),
    };
  } catch (err: any) {
    console.error('[agente-gif] Falha ao carregar feedback:', err.message);
    return { aprovados: [], reprovados: [] };
  }
}

function amostra<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  return [...arr].sort(() => Math.random() - 0.5).slice(0, max);
}

async function generateGifAgentConcept(params: {
  marca: string; conteudosAprendizado: any[]; feedbackAprovados: any[]; feedbackRejeitados: any[];
  motivoRejeicaoAnterior?: string; token: string;
}): Promise<any> {
  const { marca, conteudosAprendizado, feedbackAprovados, feedbackRejeitados, motivoRejeicaoAnterior, token } = params;
  const gifs = amostra(conteudosAprendizado, 15);
  const gifsBlock = gifs.length > 0
    ? gifs.map((c: any, i: number) => `${i + 1}. [${c.marca}] "${c.nome_design}" — ${c.mecanica_texto} | Composição: ${c.composicao_texto}`).join('\n')
    : 'Nenhum GIF analisado disponível ainda.';
  const aprovadosBlock = feedbackAprovados.length > 0
    ? feedbackAprovados.map((f: any, i: number) => `${i + 1}. Aprovado: "${f.recomendacao_estruturada?.operacional?.mecanicaEscolhida ?? '?'}"`).join('\n')
    : 'Nenhum conceito aprovado ainda — este é um dos primeiros.';
  const reprovadosBlock = feedbackRejeitados.length > 0
    ? feedbackRejeitados.map((f: any, i: number) => `${i + 1}. REPROVADO: "${f.recomendacao_estruturada?.operacional?.mecanicaEscolhida ?? '?'}"${f.feedback_usuario ? ` — motivo: ${f.feedback_usuario}` : ''}`).join('\n')
    : 'Nenhum conceito reprovado ainda.';

  const systemPrompt = `Você é o Agente Autônomo de Criação de GIFs de CRM, propondo sozinho (sem humano no momento da criação) UM conceito de GIF com mecânica e racional NOVOS — nunca repita literalmente uma mecânica já vista no grounding ou já avaliada abaixo. REGRAS INVIOLÁVEIS: sem CAPS LOCK no assunto, sem %, OFF, GRÁTIS, R$, no máximo 2 emojis. Pré-header SEMPRE "Mas, vou precisar cancelar em breve". ${AGENTE_PLAYBOOK[marca] ?? ''}

⚠️ CONCEITO GENÉRICO, NÃO NICHADO (REGRA CRÍTICA): este conteúdo pode acabar sendo usado por QUALQUER marca do grupo (cosméticos, moda, casa, o que for), não só a marca informada acima. NUNCA mencione ou implique um produto/categoria específica (nada de cabelo, perfume, maquiagem, skincare etc.) — a mecânica, o objeto do GIF e o racional têm que funcionar igual bem pra qualquer produto físico genérico embrulhado/escondido/lacrado. Bons exemplos de mecânica genérica: "deslize a gaveta", "erga a tampa", "gire o rótulo", "desamarre o laço", "descole o adesivo", "abra a caixa". Evite objetos/termos ligados a um nicho (ex: pente, xampu, batom, perfume) — prefira objetos neutros (caixa, envelope, gaveta, embalagem, laço, adesivo, tampa).

REGRAS DE COPY (OBRIGATÓRIO PREENCHER TODOS — nunca deixe vazio):
- headlineBanner: headline do banner, baseada no verbo de ação da mecânica escolhida, em destaque (ex: "ABRA A CAIXA", "PUXE O ADESIVO").
- subHeadlineBanner: expõe a recompensa concreta + um prazo/urgência, em UMA frase corrida, SEM travessão (—) nem hífen duplo (--) separando as duas ideias — use vírgula ou reestruture a frase (ex: "seu brinde te espera, válido até 23h59" e NÃO "seu brinde te espera — válido até 23h59"). Travessão no meio da frase é um tique de texto gerado por IA e não pode aparecer aqui.
- ctaBotao: verbo único no imperativo correspondente à mecânica (ex: "ABRIR", "PUXAR").
- assunto: dentro do limite de caracteres, coerente com a mecânica, também sem travessão.
Um conceito sem headlineBanner, subHeadlineBanner ou ctaBotao preenchidos é considerado INVÁLIDO — sempre preencha os quatro campos de copy com texto real, nunca com string vazia.`;

  const userPrompt = `GIFs analisados que já funcionaram (grounding — de qualquer marca do grupo, use só como entendimento de padrão de mecânica/composição, NÃO copie o produto ou nicho deles):
${gifsBlock}

Conceitos já avaliados por humanos neste programa do agente — aprovados (reforce o padrão, sem repetir a mecânica):
${aprovadosBlock}

Reprovados (NÃO proponha de novo, evite o motivo apontado):
${reprovadosBlock}
${motivoRejeicaoAnterior ? `\nEsta é uma regeneração imediata: o conceito anterior desta mesma rodada foi reprovado com o motivo "${motivoRejeicaoAnterior}". Gere um conceito claramente diferente que evite esse problema.\n` : ''}
Gere 1 conceito de GIF GENÉRICO (sem nicho de produto) com EXATAMENTE 3 frames (inicial, intermediário, final), formato 1:1, com racional de por que essa mecânica nova deve funcionar. Em "previsao.casesReferencia" cite o(s) "nome_design" do grounding que mais inspiraram o conceito.
CONTINUIDADE VISUAL (ESCOPO DECRESCENTE — OBRIGATÓRIO): frames[0] é a ÚNICA descrição completa da cena (objeto herói + props secundários + cor + posição + fundo). frames[1] e frames[2] descrevem SOMENTE o delta do objeto principal, sem redescrever o que já foi estabelecido no frame 1.
Retorne APENAS um array JSON com 1 item, sem markdown, nesta estrutura exata:
[{
  "copy": { "assunto": "", "preHeader": "Mas, vou precisar cancelar em breve", "headlineBanner": "", "subHeadlineBanner": "", "ctaBotao": "" },
  "visual": { "formato": "GIF animado 3 frames", "paletaRecomendada": { "nome": "", "cores": [] }, "estiloIlustracao": "", "frames": ["", "", ""], "posicaoCta": "", "tipografia": "" },
  "operacional": { "mecanicaEscolhida": "", "justificativaMecanica": "", "recompensaEscolhida": "", "diaRecomendado": "", "horarioRecomendado": "", "segmentoRecomendado": "" },
  "previsao": { "aberturaEsperada": "", "ctorEsperado": "", "receitaEsperada": "", "casesReferencia": [], "confianca": "baixa", "confiancaMotivo": "" },
  "riscos": []
}]`;

  const text = await callGemini(userPrompt, systemPrompt, token);
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  return Array.isArray(parsed) ? parsed[0] : parsed;
}

// ─── Integração com a Insider (Passo 3 do Modo C) ──────────────────────────
// API real da Insider (Messaging APIs > Email APIs > Create email campaigns):
// POST https://mail.useinsider.com/content/v1/campaign/create
// Header X-INS-AUTH-KEY, body { name, tags, type: "single"|"experiment", variations: [...] }
// type "experiment" exige EXATAMENTE 2 variações (isso é o A/B nativo da Insider) — cada uma
// é um email completo (subject/pre_header/html), sempre criado como Draft (agendar é manual
// no painel). html precisa vir em base64. Rate limit: 1 req/s.
// Contas da Insider com acesso configurado. O conteúdo do agente não é amarrado a nenhuma
// marca (v1: mecânicas genéricas) — qualquer pauta pode ser enviada pra qualquer conta aqui.
const CONTAS_INSIDER = ['Apice', 'Barbours', 'Rituaria', 'Lescent', 'Kokeshi', 'Gocase'] as const;
type ContaInsider = typeof CONTAS_INSIDER[number];

function getInsiderApiKey(marca: string, env: Env): string | undefined {
  const chaves: Record<ContaInsider, string | undefined> = {
    Apice: env.INSIDER_API_KEY_APICE,
    Barbours: env.INSIDER_API_KEY_BARBOURS,
    Rituaria: env.INSIDER_API_KEY_RITUARIA,
    Lescent: env.INSIDER_API_KEY_LESCENT,
    Kokeshi: env.INSIDER_API_KEY_KOKESHI,
    Gocase: env.INSIDER_API_KEY_GOCASE,
  };
  return chaves[marca as ContaInsider];
}

// Template real da Apice na Insider (v2 — substitui o 20250710_template). O link aparece 2x
// com URLs DIFERENTES (imagem sem parâmetro de tracking, texto "clicando aqui" com ?aca=...) —
// por isso o campo "Link da campanha" precisa trocar as duas.
const INSIDER_TEMPLATE_APICE_ORIGINAL_GIF_URL = "https://email-static.useinsider.com/f940abcdc21d4566ac97b97fb4e8650f/lib/pluginId_f940abcdc21d4566ac97b97fb4e8650f_apsebr_images/caixaapice_crmrecuperadorecuperado_aiXJGFPObEpekiNL.gif";
const INSIDER_TEMPLATE_APICE_ORIGINAL_LINK_URL_1 = "https://www.apicecosmeticos.com.br/collections/crm-campanha-do-dia";
const INSIDER_TEMPLATE_APICE_ORIGINAL_LINK_URL_2 = "https://www.apicecosmeticos.com.br/collections/crm-campanha-do-dia?aca=6a4c71fb406a35b9dc60f2cd";

const INSIDER_TEMPLATE_APICE = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns="http://www.w3.org/1999/xhtml" lang="und"><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta charset="UTF-8"><meta content="width=device-width, initial-scale=1" name="viewport"><meta name="x-apple-disable-message-reformatting"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta content="telephone=no" name="format-detection"><title></title>
 <!--[if mso]>
<xml>
    <w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word">
        <w:DontUseAdvancedTypographyReadingMail/>
    </w:WordDocument>
</xml><![endif]--><style type="text/css">u + .body img ~ div div { display:none;}#outlook a { padding:0;}span.MsoHyperlink,span.MsoHyperlinkFollowed { color:inherit; mso-style-priority:99;}a.es-button { mso-style-priority:100!important; text-decoration:none!important;}a[x-apple-data-detectors],#MessageViewBody a { color:inherit!important; text-decoration:none!important; font-size:inherit!important; font-family:inherit!important; font-weight:inherit!important; line-height:inherit!important;}.es-desk-hidden { display:none; float:left; overflow:hidden; width:0; max-height:0; line-height:0; mso-hide:all;}@media only screen and (max-width:600px) {.es-p-default { } *[class="gmail-fix"] { display:none!important } p, a { line-height:150%!important } h1, h1 a { line-height:120%!important } h2, h2 a { line-height:120%!important } h3, h3 a { line-height:120%!important } h4, h4 a { line-height:120%!important } h5, h5 a { line-height:120%!important }
 h6, h6 a { line-height:120%!important } h1 { font-size:30px!important; text-align:center } h2 { font-size:26px!important; text-align:center } h3 { font-size:20px!important; text-align:center } h4 { font-size:24px!important; text-align:left } h5 { font-size:20px!important; text-align:left } h6 { font-size:16px!important; text-align:left } .es-header-body h1 a, .es-content-body h1 a, .es-footer-body h1 a { font-size:30px!important } .es-header-body h2 a, .es-content-body h2 a, .es-footer-body h2 a { font-size:26px!important } .es-header-body h3 a, .es-content-body h3 a, .es-footer-body h3 a { font-size:20px!important } .es-header-body h4 a, .es-content-body h4 a, .es-footer-body h4 a { font-size:24px!important } .es-header-body h5 a, .es-content-body h5 a, .es-footer-body h5 a { font-size:20px!important } .es-header-body h6 a, .es-content-body h6 a, .es-footer-body h6 a { font-size:16px!important }
 .es-header-body p, .es-header-body a { font-size:16px!important } .es-content-body p, .es-content-body a { font-size:16px!important } .es-footer-body p, .es-footer-body a { font-size:16px!important } .es-infoblock p, .es-infoblock a { font-size:12px!important } .es-m-txt-c, .es-m-txt-c h1, .es-m-txt-c h2, .es-m-txt-c h3, .es-m-txt-c h4, .es-m-txt-c h5, .es-m-txt-c h6 { text-align:center!important } .es-m-txt-r, .es-m-txt-r h1, .es-m-txt-r h2, .es-m-txt-r h3, .es-m-txt-r h4, .es-m-txt-r h5, .es-m-txt-r h6 { text-align:right!important } .es-m-txt-j, .es-m-txt-j h1, .es-m-txt-j h2, .es-m-txt-j h3, .es-m-txt-j h4, .es-m-txt-j h5, .es-m-txt-j h6 { text-align:justify!important } .es-m-txt-l, .es-m-txt-l h1, .es-m-txt-l h2, .es-m-txt-l h3, .es-m-txt-l h4, .es-m-txt-l h5, .es-m-txt-l h6 { text-align:left!important } .es-m-txt-r img, .es-m-txt-c img, .es-m-txt-l img { display:inline!important } .es-m-txt-r .es-menu td { float:right!important }
 .es-m-txt-l .es-menu td { float:left!important } .es-m-txt-c .es-menu td { display:inline-block } .es-spacer { display:inline-table } a.es-button, button.es-button { display:inline-block!important; font-size:16px!important; padding:10px 20px 10px 20px!important; line-height:120%!important } .es-button-border { display:inline-block!important } .es-m-fw, .es-m-fw.es-fw, .es-m-fw .es-button { display:block!important } .es-m-il, .es-m-il .es-button, .es-social, .es-social td, .es-menu.es-table-not-adapt { display:inline-block!important } .es-adaptive table, .es-left, .es-right { width:100%!important; border-collapse:separate!important } .es-content table, .es-header table, .es-footer table, .es-content, .es-footer, .es-header { width:100%!important; max-width:600px!important } .adapt-img { width:100%!important; height:auto!important } .es-adapt-td { display:block!important; width:100%!important }
 .es-mobile-hidden, .es-hidden { display:none!important } .es-container-hidden { display:none!important } .es-desk-hidden { width:auto!important; overflow:visible!important; float:none!important; max-height:inherit!important; line-height:inherit!important } tr.es-desk-hidden { display:table-row!important } table.es-desk-hidden { display:table!important } td.es-desk-hidden { display:table-cell!important } td.es-desk-menu-hidden { display:table-cell!important } .es-m-txt-c .es-menu td.es-desk-menu-hidden { display:inline-block!important } .es-menu td { width:1%!important } table.es-table-not-adapt, .esd-block-html table, .es-m-txt-r .es-menu td, .es-m-txt-l .es-menu td, .es-m-txt-c .es-menu td { width:auto!important } .h-auto { height:auto!important } a.es-button, button.es-button, label.es-button { padding-left:0px!important; padding-right:0px!important }
 .es-left.ins-vertical.ins-one, .es-right.ins-vertical.ins-one { width:100%!important } .es-left.ins-vertical.ins-two, .es-right.ins-vertical.ins-two { width:47%!important } .es-left.ins-vertical.ins-three, .es-right.ins-vertical.ins-three { width:30%!important } .es-left.ins-vertical.ins-three { margin-right:5%!important } .es-left.ins-vertical.ins-four, .es-right.ins-vertical.ins-four { width:23.5%!important } .es-left.ins-vertical.ins-four { margin-right:2%!important } .ext-product-name p, .ext-product-button, .ext-product-price p, .ext-product-original-price p { width:100%!important } .ext-product-button a { max-width:100%!important } .ext-product-name.ins-vertical p { overflow:hidden!important; word-break:break-all!important; height:130px!important; font-size:12px!important } .ext-product-name.ins-vertical { height:140px!important }
 .ext-product-price.ins-vertical p { overflow:hidden!important; word-break:break-all!important; height:50px!important; font-size:12px!important } .ext-product-price.ins-vertical { height:60px!important } .ext-product-original-price.ins-vertical p { overflow:hidden!important; word-break:break-all!important; height:50px!important; font-size:12px!important } .ext-product-original-price.ins-vertical { height:60px!important } .ext-ins-attr.ins-vertical p { overflow:hidden!important; word-break:break-all!important; height:50px!important; font-size:12px!important; width:100%!important } .ext-ins-attr p { width:300px!important } .ext-ins-attr.ins-vertical.ins-attr-two p { max-width:120px!important } .ext-ins-attr.ins-vertical.ins-attr-three p { max-width:75px!important } .ext-ins-attr.ins-vertical.ins-attr-four p { max-width:60px!important } .ext-ins-attr.ins-vertical { height:60px!important }
 .ext-product-button a.ins-vertical { word-break:break-all!important; font-size:12px!important } .ext-product-image.ins-vertical.ins-two { height:190px!important } .ext-product-image.ins-vertical.ins-three { height:125px!important } .ext-product-image.ins-vertical.ins-four { height:100px!important } .es-desk-menu-hidden { display:table-cell!important } }@media screen and (max-width:384px) {.mail-message-content { width:414px!important } }</style>
 <!--[if gte mso 9]>
<style>sup {
    font-size: 100% !important;
}</style><![endif]--><!--[if gte mso 9]>
<noscript>
    <xml>
        <o:OfficeDocumentSettings>
            <o:AllowPNG></o:AllowPNG>
            <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
    </xml>
</noscript><![endif]--><!--[if mso]>
<xml>
    <w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word">
        <w:DontUseAdvancedTypographyReadingMail></w:DontUseAdvancedTypographyReadingMail>
    </w:WordDocument>
</xml><![endif]-->
    <style type="text/css">
        ul, ol { padding: 0px 0px 0px 40px; }
        li p { mso-margin-bottom-alt: 15px; }
        .es-text-ltr ul, .es-text-ltr ol { padding: 0px 0px 0px 40px; }
        .es-text-rtl ol, .es-text-rtl ul { padding: 0px 40px 0px 0px; }
    </style></head>
 <body data-ins-track-seq="5" class="body" style="width:100%;height:100%;font-family:arial, 'helvetica neue', helvetica, sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;Margin:0"><div class="es-wrapper-color" lang="und" style="background-color:#F6F6F6"><!--[if gte mso 9]>
			<v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
				<v:fill type="tile" color="#f6f6f6"></v:fill>
			</v:background>
		<![endif]--><table width="100%" cellspacing="0" cellpadding="0" class="es-wrapper" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;padding:0;Margin:0;width:100%;height:100%;background-repeat:repeat;background-position:center top"><tbody><tr style="border-collapse:collapse"><td valign="top" style="padding:0;Margin:0"><table cellspacing="0" cellpadding="0" align="center" class="es-content" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;width:100%;table-layout:fixed !important"><tbody><tr style="border-collapse:collapse"><td align="center" style="padding:0;Margin:0"><table cellspacing="0" cellpadding="0" bgcolor="#fff" align="center" class="es-content-body" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:#FFF;width:600px"><tbody><tr style="border-collapse:collapse"><td align="left" bgcolor="#437C56" style="padding:20px;Margin:0;background-color:#437c56"><table width="100%" cellspacing="0" cellpadding="0" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tbody><tr style="border-collapse:collapse"><td valign="top" align="center" style="padding:0;Margin:0;width:560px"><table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tbody><tr style="border-collapse:collapse"><td align="center" style="padding:0 15px;Margin:0;font-size:0px"><img src="https://email-static.useinsider.com/f940abcdc21d4566ac97b97fb4e8650f/lib/pluginId_f940abcdc21d4566ac97b97fb4e8650f_apsebr_images/design_sem_nome_48_200x2x_1.png" alt="" width="124" style="display:block;font-size:14px;border:0;outline:none;text-decoration:none;margin:0"></td>
 </tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table>
 <table cellspacing="0" cellpadding="0" align="center" class="es-content" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;width:100%;table-layout:fixed !important"><tbody><tr style="border-collapse:collapse"><td align="center" style="padding:0;Margin:0"><table cellspacing="0" cellpadding="0" bgcolor="#fff" align="center" class="es-content-body" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:#FFF;width:600px"><tbody><tr style="border-collapse:collapse"><td align="left" style="padding:0;Margin:0"><table cellpadding="0" cellspacing="0" width="100%" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tbody><tr style="border-collapse:collapse"><td align="center" valign="top" style="padding:0;Margin:0;width:600px"><table cellpadding="0" cellspacing="0" width="100%" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tbody><tr style="border-collapse:collapse"><td align="center" style="padding:0;Margin:0;font-size:0px"><a data-ins-track-id="2" target="_blank" href="${INSIDER_TEMPLATE_APICE_ORIGINAL_LINK_URL_1}" style="mso-line-height-rule:exactly;text-decoration:underline;color:#333;font-size:14px;font-weight:inherit"><img src="${INSIDER_TEMPLATE_APICE_ORIGINAL_GIF_URL}" width="600" alt="" title="" class="adapt-img" style="display:block;font-size:14px;border:0;outline:none;text-decoration:none;margin:0"></a>
</td></tr><tr style="border-collapse:collapse"><td align="left" style="Margin:0;padding:15px 10px 20px"><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:150%;letter-spacing:0;font-weight:normal;color:#333;font-size:14px">Já preparei sua nova surpresa... E tenho certeza que você não estava esperando algo assim, porque hoje eu trouxe presentes juntos no seu carrinho!</p><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:150%;letter-spacing:0;font-weight:normal;color:#333;font-size:14px"><br></p>
<p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:150%;letter-spacing:0;font-weight:normal;color:#333;font-size:14px">Me diz se eu não sou a melhor em te presentear. Você tem até 00h para conseguir tudo,<a data-ins-track-id="3" href="${INSIDER_TEMPLATE_APICE_ORIGINAL_LINK_URL_2}" target="_blank" style="mso-line-height-rule:exactly;text-decoration:underline;color:#333;font-size:14px;font-weight:inherit"> clicando aqui</a>.</p><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:150%;letter-spacing:0;font-weight:normal;color:#333;font-size:14px"><br></p>
<p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:150%;letter-spacing:0;font-weight:normal;color:#333;font-size:14px">Lembrando que todos os dias, às 11h, vou deixar uma nova surpresa no seu e-mail, então fica atenta para não perder!</p><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:150%;letter-spacing:0;font-weight:normal;color:#333;font-size:14px"><br>Abraços,&nbsp;</p><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:150%;letter-spacing:0;font-weight:normal;color:#333;font-size:14px">Apice.</p></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table>
 <table cellspacing="0" cellpadding="0" align="center" class="es-content" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;width:100%;table-layout:fixed !important"><tbody><tr style="border-collapse:collapse"><td align="center" style="padding:0;Margin:0"><table cellspacing="0" cellpadding="0" align="center" bgcolor="#EEECEB" class="es-footer-body" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:#eeeceb;width:600px" role="none"><tbody><tr style="border-collapse:collapse"><td align="left" style="Margin:0;padding:20px 20px 15px"><table cellpadding="0" cellspacing="0" width="100%" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tbody><tr style="border-collapse:collapse"><td valign="top" align="center" style="padding:0;Margin:0;width:560px"><table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tbody><tr style="border-collapse:collapse"><td align="center" style="padding:0 0 20px;Margin:0;font-size:0px"><img src="https://email-static.useinsider.com/f940abcdc21d4566ac97b97fb4e8650f/lib/pluginId_f940abcdc21d4566ac97b97fb4e8650f_apsebr_images/logoredondo.png" alt="" height="40" style="display:block;font-size:14px;border:0;outline:none;text-decoration:none;margin:0"></td>
 </tr><tr style="border-collapse:collapse"><td align="center" style="padding:0 0 10px;Margin:0"><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:150%;letter-spacing:0;font-weight:normal;color:#333;font-size:14px">© 2025 Apice Cosméticos</p><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:200%;letter-spacing:0;font-weight:normal;color:#333;font-size:14px;display:none"><br></p><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:200%;letter-spacing:0;font-weight:normal;color:#333;font-size:14px;display:none"><br></p></td></tr>
 <tr style="border-collapse:collapse"><td align="center" style="padding:0 0 10px;Margin:0"><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:200%;letter-spacing:0;font-weight:normal;color:#333;font-size:14px">Avenida Fernando Ferrari, 2675, Vitória, Brazil, 29075630</p><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:200%;letter-spacing:0;font-weight:normal;color:#333;font-size:14px;display:none"><br></p></td></tr>
 <tr style="border-collapse:collapse"><td align="center" style="padding:0;Margin:0"><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:150%;letter-spacing:0;font-weight:normal;color:#FFF;font-size:10px"><strong style="font-weight:700 !important"><a data-ins-track-id="5" target="_blank" href="<%unsub%>" style="mso-line-height-rule:exactly;text-decoration:underline;color:#000;font-size:10px;font-weight:inherit">Cancelar assinatura</a></strong></p></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></div><div style="position:absolute;left:-9999px;top:-9999px;margin:0px"></div><div style="position:absolute;left:-9999px;top:-9999px;margin:0px;padding:0px;border:0px none;width:1px"></div></body></html>`;

// Template real da Barbours na Insider — mesma regra: só o GIF hero e o link que o envolvem
// são trocados. Aqui o logo (primeira imagem) fica intocado; o GIF é o segundo bloco de imagem.
const INSIDER_TEMPLATE_BARBOURS_ORIGINAL_GIF_URL = 'https://email-static.useinsider.com/f940abcdc21d4566ac97b97fb4e8650f/lib/pluginId_f940abcdc21d4566ac97b97fb4e8650f_thebarboursbeauty_images/369845_IX5MXKrrvtEawYb6.gif';
const INSIDER_TEMPLATE_BARBOURS_ORIGINAL_LINK_URL = 'https://www.thebarboursbeauty.com.br/collections/gel-clareador?aca=68c1ce71c22718c4b77da4cc';

const INSIDER_TEMPLATE_BARBOURS = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta charset="UTF-8">
    <meta content="width=device-width, initial-scale=1" name="viewport">
    <meta name="x-apple-disable-message-reformatting">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta content="telephone=no" name="format-detection">
    <title></title>
    <!--[if gte mso 9]>
<style>sup {
    font-size: 100% !important;
}</style><![endif]-->
    <!--[if gte mso 9]>
<noscript>
    <xml>
        <o:OfficeDocumentSettings>
            <o:AllowPNG></o:AllowPNG>
            <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
    </xml>
</noscript><![endif]-->
    <!--[if mso]>
<xml>
    <w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word">
        <w:DontUseAdvancedTypographyReadingMail/>
    </w:WordDocument>
</xml><![endif]-->
    <!--[if gte mso 9]><style>sup { font-size: 100% !important; }</style><![endif]-->
  </head>
  <body data-ins-track-seq="4" class="body">
    <div class="es-wrapper-color">
      <!--[if gte mso 9]>
			<v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
				<v:fill type="tile" color="#f6f6f6"></v:fill>
			</v:background>
		<![endif]-->
      <table width="100%" cellspacing="0" cellpadding="0" class="es-wrapper">
        <tbody>
          <tr>
            <td valign="top" class="esd-email-paddings">
              <table cellspacing="0" cellpadding="0" align="center" class="es-content esd-header-popover">
                <tbody>
                  <tr>
                    <td align="center" class="esd-stripe">
                      <table width="600" cellspacing="0" cellpadding="0" bgcolor="#ffffff" align="center" class="es-content-body">
                        <tbody>
                          <tr>
                            <td align="left" class="esd-structure es-p20">
                              <table width="100%" cellspacing="0" cellpadding="0">
                                <tbody>
                                  <tr>
                                    <td width="560" valign="top" align="center" class="esd-container-frame">
                                      <table width="100%" cellspacing="0" cellpadding="0">
                                        <tbody>
                                          <tr>
                                            <td align="center" class="esd-block-image" style="font-size: 0px">
                                              <a data-ins-track-id="1" target="_blank" href="">
                                                <img src="https://app.omnisend.com/image/newsletter/660c118ca89c0d10410a3810" alt="" width="240" style="display: block">
                                              </a>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td align="center" class="esd-block-image" style="font-size: 0px">
                                              <a data-ins-track-id="2" href="${INSIDER_TEMPLATE_BARBOURS_ORIGINAL_LINK_URL}" target="_blank">
                                                <img src="${INSIDER_TEMPLATE_BARBOURS_ORIGINAL_GIF_URL}" width="560" alt="" title="" class="adapt-img" style="display: block">
                                              </a>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
              <table cellspacing="0" cellpadding="0" align="center" class="es-content">
                <tbody>
                  <tr>
                    <td align="center" class="esd-stripe">
                      <table width="600" cellspacing="0" cellpadding="0" bgcolor="#ffffff" align="center" class="es-content-body">
                        <tbody>
                          <tr>
                            <td align="left" class="esd-structure es-p20r es-p20l">
                              <table cellpadding="0" cellspacing="0" width="100%">
                                <tbody>
                                  <tr>
                                    <td width="560" align="center" valign="top" class="esd-container-frame">
                                      <table cellpadding="0" cellspacing="0" width="100%">
                                        <tbody>
                                          <tr>
                                            <td align="center" class="esd-block-text es-p20t">
                                              <p style="font-size: 16px">
                                                Oii, sou a CEO da Barbour's Beauty<br><br>Seus brindes foram aprovados.. Será que acertei no que eu preparei? porque hoje eu trouxe os&nbsp;<b>Brindes que todo mundo tá pedindo junto&nbsp;no seu carrinho!</b><br><br><b>Lembrando que todos os dias</b> vou deixar uma nova surpresa no seu e-mail, então fica atenta para não perder!
                                              </p>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
              <table cellspacing="0" cellpadding="0" align="center" class="es-content esd-footer-popover">
                <tbody>
                  <tr>
                    <td align="center" class="esd-stripe">
                      <table width="600" cellspacing="0" cellpadding="0" align="center" bgcolor="#fff" class="es-footer-body" style="background-color: #ffffff">
                        <tbody>
                          <tr>
                            <td align="left" bgcolor="#FAFAFA" class="esd-structure es-p20t es-p20b es-p20r es-p20l" style="background-color: #fafafa">
                              <table width="100%" cellspacing="0" cellpadding="0">
                                <tbody>
                                  <tr>
                                    <td width="560" valign="top" align="center" class="esd-container-frame">
                                      <table width="100%" cellspacing="0" cellpadding="0">
                                        <tbody>
                                          <tr>
                                            <td align="center" esd-links-color="#b63837" class="esd-block-text es-p20">
                                              <p style="font-size: 12px; color: #0c0c0c">
                                                RUA AURELI JOSE NUNES 100<br>CNPJ: 54.137.817/0001-35
                                              </p>
                                              <p style="font-size: 12px; color: #0c0c0c">
                                                <br>
                                              </p>
                                              <p style="font-size: 12px; color: #0c0c0c">
                                                © 2024 Barbour's Beauty
                                              </p>
                                              <p style="font-size: 10px; color: #0c0c0c">
                                                <br>
                                              </p>
                                              <p style="font-size: 11px; color: #0c0c0c">
                                                Se você tiver alguma dúvida, entre em contato com nosso suporte pelo WhatsApp:
                                              </p>
                                              <p style="font-size: 11px; color: #0c0c0c">
                                                <a data-ins-track-id="3" href="https://jdx.soundestlink.com/ce/c/6630e2b6de2fc72d1bec9466/66a250e73a23897f70937be9/66a2510092477729ff482975?signature=ba9ccf0934a5b5bd2a0c4c6da3fae03fdfacda8ac038dc1d41163ab7f8215d8e" target="_blank" style="font-size: 11px; color: #b63837">http://wa.me/5517991162579</a><span style="color: #000000">. Estamos disponíveis em dias úteis das 09h às 17h.</span>
                                              </p>
                                              <p style="font-size: 8px; color: #000000">
                                                Dois juntos
                                              </p>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td width="560" valign="top" align="center" class="esd-container-frame">
                                      <table width="100%" cellspacing="0" cellpadding="0">
                                        <tbody>
                                          <tr>
                                            <td align="center" esd-links-underline="underline" class="esd-block-text">
                                              <p style="font-size: 10px">
                                                <strong><a data-ins-track-id="4" target="_blank" href="&lt;%unsub%&gt;" style="color: #000000; text-decoration: underline; font-size: 10px">Não quero mais receber emails</a></strong>
                                              </p>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div style="position: absolute; left: -9999px; top: -9999px; margin: 0px"></div>
    <div style="position: absolute; left: -9999px; top: -9999px; margin: 0px; padding: 0px; border: 0px none; width: 1px"></div>
  </body>
</html>`;

// Template real da Gocase na Insider — GIF é o segundo bloco de imagem (o logo, primeiro
// bloco, fica intocado). O link aparece 2x aqui também: envolvendo o GIF e no botão "eu quero"
// do rodapé — replaceAll troca as duas ocorrências.
const INSIDER_TEMPLATE_GOCASE_ORIGINAL_GIF_URL = 'https://email-static.useinsider.com/f940abcdc21d4566ac97b97fb4e8650f/lib/pluginId_f940abcdc21d4566ac97b97fb4e8650f_gocasebr_images/emailmktbolhasdesabao_NQANeE8Lmvg8RHhm.gif';
const INSIDER_TEMPLATE_GOCASE_ORIGINAL_LINK_URL = 'https://www.gocase.com.br/cupom-surpresa?coupon_code=SEGREDO';

const INSIDER_TEMPLATE_GOCASE = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta content="width=device-width, initial-scale=1" name="viewport">
    <meta name="x-apple-disable-message-reformatting">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta content="telephone=no" name="format-detection">
    <title></title>
    <!--[if (mso 16)]><style type="text/css">a{text-decoration:none;}</style><![endif]-->
    <!--[if gte mso 9]><style>sup{font-size:100% !important;}</style><![endif]-->
    <!--[if gte mso 9]><noscript><xml><o:OfficeDocumentSettings><o:AllowPNG></o:AllowPNG><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
    <!--[if mso]><xml><w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word"><w:DontUseAdvancedTypographyReadingMail/></w:WordDocument></xml><![endif]-->
    <!--[if gte mso 9]><style>sup { font-size: 100% !important; }</style><![endif]-->
  </head>
  <body data-ins-track-seq="4" class="body">
    <div class="es-wrapper-color">
      <!--[if gte mso 9]>
			<v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
				<v:fill type="tile" color="#f6f6f6"></v:fill>
			</v:background>
		<![endif]-->
      <table cellspacing="0" cellpadding="0" width="100%" class="es-wrapper">
        <tbody>
          <tr>
            <td valign="top" class="esd-email-paddings">
              <table cellspacing="0" cellpadding="0" align="center" class="es-content esd-header-popover">
                <tbody>
                  <tr>
                    <td align="center" class="esd-stripe">
                      <table cellpadding="0" bgcolor="#ffffff" align="center" width="600" cellspacing="0" class="es-content-body">
                        <tbody>
                          <tr>
                            <td align="left" class="esd-structure es-p20t es-p20r es-p20l">
                              <table cellpadding="0" cellspacing="0" width="100%">
                                <tbody>
                                  <tr>
                                    <td width="560" align="center" valign="top" class="esd-container-frame">
                                      <table cellspacing="0" width="100%" cellpadding="0">
                                        <tbody>
                                          <tr>
                                            <td align="center" class="esd-block-image" style="font-size: 0px">
                                              <a data-ins-track-id="1" target="_blank">
                                                <img alt="" width="100" src="https://email-static.useinsider.com/f940abcdc21d4566ac97b97fb4e8650f/lib/pluginId_f940abcdc21d4566ac97b97fb4e8650f_gocasebr_images/2019_07_25_logotipo05.png" style="display: block">
                                              </a>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td align="left" class="esd-block-text">
                                              <p>
                                                <br>
                                              </p>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td class="esd-block-html">
                                              <table align="center" border="0" cellpadding="0" cellspacing="0" style="padding-bottom: 10px; border-collapse: collapse!important; margin: auto">
                                                <tbody>
                                                  <tr>
                                                    <td valign="middle" style="font-family: Helvetica,Arial,&#39;sans-serif&#39;">
                                                      <div style="height: 3px; width: 29px; background: #f37053"></div>
                                                    </td>
                                                    <td valign="middle" class="case_text_25" style="font-family: Helvetica,Arial,&#39;sans-serif&#39;; font-size: 24px; letter-spacing: 0.025em; padding: 0 20px; text-transform: lowercase">
                                                      hey, {{name|Golover}}
                                                    </td>
                                                    <td valign="middle" style="font-family: Helvetica,Arial,&#39;sans-serif&#39;">
                                                      <div style="width: 29px; background: #f37053; height: 3px"></div>
                                                    </td>
                                                  </tr>
                                                </tbody>
                                              </table>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td align="center" class="esd-block-image" style="font-size: 0px">
                                              <a href="${INSIDER_TEMPLATE_GOCASE_ORIGINAL_LINK_URL}" data-ins-track-id="2" target="_blank">
                                                <img src="${INSIDER_TEMPLATE_GOCASE_ORIGINAL_GIF_URL}" alt="" width="560" title="" class="adapt-img" style="display: block">
                                              </a>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
              <table align="center" cellspacing="0" cellpadding="0" class="es-content esd-footer-popover">
                <tbody>
                  <tr>
                    <td align="center" class="esd-stripe">
                      <table bgcolor="#fff" width="600" cellspacing="0" cellpadding="0" align="center" class="es-footer-body" style="background-color: #ffffff">
                        <tbody>
                          <tr>
                            <td align="left" class="esd-structure es-p20t es-p15b es-p20r es-p20l">
                              <table cellpadding="0" cellspacing="0" width="100%">
                                <tbody>
                                  <tr>
                                    <td width="560" align="center" valign="top" class="esd-container-frame">
                                      <table cellspacing="0" width="100%" cellpadding="0">
                                        <tbody>
                                          <tr>
                                            <td class="esd-block-html">
                                              <table width="100%" align="center" class="center" style="border-spacing: 0; text-align: center; padding-top: 5px; padding-bottom: 15px; background: #fff">
                                                <tbody>
                                                  <tr>
                                                    <td align="center" style="padding-bottom: 10px; padding-top: 20px">
                                                      <a data-ins-track-id="3" href="${INSIDER_TEMPLATE_GOCASE_ORIGINAL_LINK_URL}" target="_blank" om:linkid="4:0" class="cta" style="width: 85%; font-size: 30px; color: #ffffff; border-bottom-width: 5px; letter-spacing: -0.01em; border-bottom-style: solid; display: inline-block; font-family: &#39;Helvetica Neue&#39;,Helvetica,Arial; padding: 25px 10px; border-radius: 6px; font-weight: bold; background: #f37053; text-decoration: none; line-height: 100%; border-bottom-color: #f14823; max-width: 60%">
                                                        eu quero
                                                      </a>
                                                    </td>
                                                  </tr>
                                                </tbody>
                                              </table>
                                              <table width="100%" align="center" class="center promotion" style="border-spacing: 0; text-align: center; background: #fff; border-radius: 0px 0px 8px 8px">
                                                <tbody>
                                                  <tr class="info">
                                                    <td style="padding: 0">
                                                      <p style="font-weight: 300; line-height: 18px; padding-top: 0px; font-size: 12px; text-align: center; margin: 0 auto; padding: 10px; display: block; font-family: Helvetica,Arial,sans-serif; max-width: 400px; color: #858585"></p>
                                                    </td>
                                                  </tr>
                                                </tbody>
                                              </table>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td class="esd-block-html">
                                              <table width="100%" align="center" class="center" style="padding-bottom: 0px; padding-top: 0px; background: #fff; border-spacing: 0; text-align: center">
                                                <tbody>
                                                  <tr align="center">
                                                    <td class="divider" style="font-family: Helvetica,Arial,sans-serif; font-size: 22px">
                                                      <p style="color: #444; display: block; width: 20%; padding: 2px 0px; background: #f0f0f1; text-decoration: none"></p>
                                                    </td>
                                                  </tr>
                                                </tbody>
                                              </table>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td align="center" class="esd-block-spacer es-p10" style="font-size: 0">
                                              <table width="50%" height="100%" cellpadding="0" cellspacing="0" border="0">
                                                <tbody>
                                                  <tr>
                                                    <td style="margin: 0px; border-bottom: 0px solid #cccccc; background: unset; height: 0px; width: 100%"></td>
                                                  </tr>
                                                </tbody>
                                              </table>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td class="esd-block-html">
                                              <table align="center" class="space" style="border-spacing: 0; padding-bottom: 20px; padding-top: 10px; background: #fff"></table>
                                              <table align="center" width="100%" class="center promotion" style="background: #fff; border-spacing: 0; text-align: center">
                                                <tbody>
                                                  <tr class="info">
                                                    <td style="padding: 0">
                                                      <img alt="Gocase" width="30" src="https://cdn-ometria-com.s3-eu-west-1.amazonaws.com/emails/b2c00fe2b6c12529/f6bd484dcbb1b5de28d5c61751e49124.png" style="display: inline-block; width: 30px; border: 0">
                                                      <p class="address" style="font-size: 10px; font-weight: 300; text-align: center; line-height: 18px; margin: 0 auto; width: 200px; font-family: Helvetica,Arial,sans-serif; max-width: 300px; padding: 10px; color: #858585; background: #fff; display: block">
                                                        Estrada Municipal Horácio Marinho, 350. Bairro do Jardim, Extrema/MG. CNPJ: 22.165.464/0003-52
                                                      </p>
                                                      <p style="margin: 0 auto; line-height: 18px; background: #fff; padding-top: 0px; display: block; padding: 10px; font-family: Helvetica,Arial,sans-serif; text-align: center; max-width: 300px; font-size: 10px; font-weight: 300; color: #858585">
                                                        Copyright © 2026 Gocase. Todos os direitos reservados.
                                                      </p>
                                                    </td>
                                                  </tr>
                                                </tbody>
                                              </table>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>
                          <tr>
                            <td align="left" class="esd-structure es-p20t es-p20b es-p20r es-p20l">
                              <table width="100%" cellspacing="0" cellpadding="0">
                                <tbody>
                                  <tr>
                                    <td valign="top" align="center" width="560" class="esd-container-frame">
                                      <table width="100%" cellspacing="0" cellpadding="0">
                                        <tbody>
                                          <tr>
                                            <td align="center" esd-links-underline="underline" esd-links-color="#666666" class="esd-block-text">
                                              <p style="font-size: 10px">
                                                <strong><a data-ins-track-id="4" target="_blank" href="&lt;%unsub%&gt;" style="color: #666666; text-decoration: underline; font-size: 10px">Não quero mais receber e-mails da Gocase.</a></strong>
                                              </p>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
</html>`;

// Template real da Kokeshi na Insider — imagem hero é o segundo bloco (logo, primeiro bloco,
// fica intocado). Link aparece só 1x aqui, envolvendo a imagem.
const INSIDER_TEMPLATE_KOKESHI_ORIGINAL_GIF_URL = 'https://email-static.useinsider.com/f940abcdc21d4566ac97b97fb4e8650f/lib/pluginId_f940abcdc21d4566ac97b97fb4e8650f_kokeshi_images/oleoenecessaireconteudosensivel.png';
const INSIDER_TEMPLATE_KOKESHI_ORIGINAL_LINK_URL = 'https://www.kokeshi.com.br/collections/ofertas-e-lancamentos?aca=6a047f59512299d487533ec5';

const INSIDER_TEMPLATE_KOKESHI = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta charset="UTF-8">
    <meta content="width=device-width, initial-scale=1" name="viewport">
    <meta name="x-apple-disable-message-reformatting">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta content="telephone=no" name="format-detection">
    <title></title>
    <!--[if gte mso 9]>
<style>sup {
    font-size: 100% !important;
}</style><![endif]-->
    <!--[if gte mso 9]>
<noscript>
    <xml>
        <o:OfficeDocumentSettings>
            <o:AllowPNG></o:AllowPNG>
            <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
    </xml>
</noscript><![endif]-->
    <!--[if mso]>
<xml>
    <w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word">
        <w:DontUseAdvancedTypographyReadingMail/>
    </w:WordDocument>
</xml><![endif]-->
    <!--[if gte mso 9]><style>sup { font-size: 100% !important; }</style><![endif]-->
  </head>
  <body data-ins-track-seq="4" class="body">
    <div class="es-wrapper-color">
      <!--[if gte mso 9]>
			<v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
				<v:fill type="tile" color="#f6f6f6"></v:fill>
			</v:background>
		<![endif]-->
      <table width="100%" cellspacing="0" cellpadding="0" class="es-wrapper">
        <tbody>
          <tr>
            <td valign="top" class="esd-email-paddings">
              <table cellspacing="0" cellpadding="0" align="center" class="es-content esd-header-popover">
                <tbody>
                  <tr>
                    <td align="center" class="esd-stripe">
                      <table width="600" cellspacing="0" cellpadding="0" bgcolor="#ffffff" align="center" class="es-content-body">
                        <tbody>
                          <tr>
                            <td align="left" bgcolor="#ffffff" class="esd-structure" style="background-color: #ffffff">
                              <table width="100%" cellspacing="0" cellpadding="0">
                                <tbody>
                                  <tr>
                                    <td width="600" valign="top" align="center" class="esd-container-frame">
                                      <table width="100%" cellspacing="0" cellpadding="0">
                                        <tbody>
                                          <tr>
                                            <td align="center" class="esd-block-image" style="font-size: 0px">
                                              <a data-ins-track-id="1" target="_blank">
                                                <img src="https://email-static.useinsider.com/f940abcdc21d4566ac97b97fb4e8650f/lib/pluginId_f940abcdc21d4566ac97b97fb4e8650f_kokeshi_images/kokeshi_logotipo_bordo_px8a8n14UFsMt8Oy.png" alt="" height="85" title="" class="adapt-img" style="display: block">
                                              </a>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
              <table cellspacing="0" cellpadding="0" align="center" class="es-content">
                <tbody>
                  <tr>
                    <td align="center" class="esd-stripe">
                      <table width="600" cellspacing="0" cellpadding="0" bgcolor="#ffffff" align="center" class="es-content-body">
                        <tbody>
                          <tr>
                            <td align="left" class="esd-structure es-p20t es-p20r es-p20l">
                              <table cellpadding="0" cellspacing="0" width="100%">
                                <tbody>
                                  <tr>
                                    <td width="560" align="center" valign="top" class="esd-container-frame">
                                      <table cellpadding="0" cellspacing="0" width="100%">
                                        <tbody>
                                          <tr>
                                            <td align="center" class="esd-block-image" style="font-size: 0px">
                                              <a data-ins-track-id="2" target="_blank" href="${INSIDER_TEMPLATE_KOKESHI_ORIGINAL_LINK_URL}">
                                                <img src="${INSIDER_TEMPLATE_KOKESHI_ORIGINAL_GIF_URL}" width="560" alt="" title="" class="adapt-img" style="display: block">
                                              </a>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td align="center" class="esd-block-text es-p15t es-p15b es-p10r es-p10l">
                                              <p style="font-size: 16px">
                                                <b>Lembrando que todos os dias</b> vou deixar uma nova surpresa no seu e-mail, então fique atento para não perder!
                                              </p>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
              <table cellspacing="0" cellpadding="0" align="center" class="es-content esd-footer-popover">
                <tbody>
                  <tr>
                    <td align="center" class="esd-stripe">
                      <table width="600" cellspacing="0" cellpadding="0" align="center" bgcolor="#fff" class="es-footer-body" style="background-color: #ffffff">
                        <tbody>
                          <tr>
                            <td align="left" bgcolor="#a1004f" class="esd-structure es-p20t es-p20b es-p20r es-p20l" style="background-color: #a1004f">
                              <table width="100%" cellspacing="0" cellpadding="0">
                                <tbody>
                                  <tr>
                                    <td width="560" valign="top" align="center" class="esd-container-frame">
                                      <table width="100%" cellspacing="0" cellpadding="0">
                                        <tbody>
                                          <tr>
                                            <td align="center" class="esd-block-text es-p20">
                                              <p style="color: #ffffff">
                                                Pressa. Coronel - Polícia Militar Nelson Tranchesi, 740 - Galpão 32 Sala 29. Bairro Itaqui, Itapevi/SP
                                              </p>
                                              <p style="color: #ffffff">
                                                <br>
                                              </p>
                                              <p style="color: #ffffff">
                                                CNPJ: 57.344.563/0001-14
                                              </p>
                                              <p style="color: #ffffff">
                                                <br>
                                              </p>
                                              <p style="color: #ffffff">
                                                © 2025 Kokeshi
                                              </p>
                                              <p style="color: #ffffff">
                                                <br>
                                              </p>
                                              <p style="color: #ffffff">
                                                Se você tiver alguma dúvida, entre em contato com nosso suporte pelo WhatsApp: <a data-ins-track-id="3" target="_blank" href="http://wa.me/5511920417046" style="color: #ffffff">http://wa.me/5511920417046</a> . Estamos disponíveis em dias úteis das 09h às 17h.
                                              </p>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td width="560" valign="top" align="center" class="esd-container-frame">
                                      <table width="100%" cellspacing="0" cellpadding="0">
                                        <tbody>
                                          <tr>
                                            <td align="center" esd-links-underline="underline" class="esd-block-text">
                                              <p style="font-size: 10px; color: #ffffff">
                                                <strong><a data-ins-track-id="4" target="_blank" href="&lt;%unsub%&gt;" style="color: #ffffff; text-decoration: underline; font-size: 10px">Não quero mais receber emails</a></strong>
                                              </p>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div style="position: absolute; left: -9999px; top: -9999px; margin: 0px"></div>
    <div style="position: absolute; left: -9999px; top: -9999px; margin: 0px; padding: 0px; border: 0px none; width: 1px"></div>
  </body>
</html>`;

// Template real da Lescent na Insider — imagem hero (um GIF de verdade aqui) é o segundo
// bloco; logo (primeiro bloco) fica intocado. Link aparece só 1x, envolvendo o GIF.
const INSIDER_TEMPLATE_LESCENT_ORIGINAL_GIF_URL = "https://email-static.useinsider.com/f940abcdc21d4566ac97b97fb4e8650f/lib/pluginId_f940abcdc21d4566ac97b97fb4e8650f_lescent_images/tesourita_9sZ5d6GRVYyTEB5G.gif";
const INSIDER_TEMPLATE_LESCENT_ORIGINAL_LINK_URL = "https://www.lescent.com.br/collections/porcentagem-off";

const INSIDER_TEMPLATE_LESCENT = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns="http://www.w3.org/1999/xhtml" lang="und"><head><meta charset="UTF-8"><meta content="width=device-width, initial-scale=1" name="viewport"><meta name="x-apple-disable-message-reformatting"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta content="telephone=no" name="format-detection"><title></title>
 <!--[if mso]><xml>
    <w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word">
      <w:DontUseAdvancedTypographyReadingMail/>
    </w:WordDocument>
    </xml>
<![endif]--><style type="text/css">u + .body img ~ div div { display:none;}#outlook a { padding:0;}span.MsoHyperlink,span.MsoHyperlinkFollowed { color:inherit; mso-style-priority:99;}a.es-button { mso-style-priority:100!important; text-decoration:none!important;}a[x-apple-data-detectors],#MessageViewBody a { color:inherit!important; text-decoration:none!important; font-size:inherit!important; font-family:inherit!important; font-weight:inherit!important; line-height:inherit!important;}.es-desk-hidden { display:none; float:left; overflow:hidden; width:0; max-height:0; line-height:0; mso-hide:all;}@media only screen and (max-width:600px) {.es-p-default { } *[class="gmail-fix"] { display:none!important } p, a { line-height:150%!important } h1, h1 a { line-height:120%!important } h2, h2 a { line-height:120%!important } h3, h3 a { line-height:120%!important } h4, h4 a { line-height:120%!important } h5, h5 a { line-height:120%!important }
 h6, h6 a { line-height:120%!important } h1 { font-size:30px!important; text-align:center } h2 { font-size:26px!important; text-align:center } h3 { font-size:20px!important; text-align:center } h4 { font-size:24px!important; text-align:left } h5 { font-size:20px!important; text-align:left } h6 { font-size:16px!important; text-align:left } .es-header-body h1 a, .es-content-body h1 a, .es-footer-body h1 a { font-size:30px!important } .es-header-body h2 a, .es-content-body h2 a, .es-footer-body h2 a { font-size:26px!important } .es-header-body h3 a, .es-content-body h3 a, .es-footer-body h3 a { font-size:20px!important } .es-header-body h4 a, .es-content-body h4 a, .es-footer-body h4 a { font-size:24px!important } .es-header-body h5 a, .es-content-body h5 a, .es-footer-body h5 a { font-size:20px!important } .es-header-body h6 a, .es-content-body h6 a, .es-footer-body h6 a { font-size:16px!important }
 .es-header-body p, .es-header-body a { font-size:16px!important } .es-content-body p, .es-content-body a { font-size:16px!important } .es-footer-body p, .es-footer-body a { font-size:16px!important } .es-infoblock p, .es-infoblock a { font-size:12px!important } .es-m-txt-c, .es-m-txt-c h1, .es-m-txt-c h2, .es-m-txt-c h3, .es-m-txt-c h4, .es-m-txt-c h5, .es-m-txt-c h6 { text-align:center!important } .es-m-txt-r, .es-m-txt-r h1, .es-m-txt-r h2, .es-m-txt-r h3, .es-m-txt-r h4, .es-m-txt-r h5, .es-m-txt-r h6 { text-align:right!important } .es-m-txt-j, .es-m-txt-j h1, .es-m-txt-j h2, .es-m-txt-j h3, .es-m-txt-j h4, .es-m-txt-j h5, .es-m-txt-j h6 { text-align:justify!important } .es-m-txt-l, .es-m-txt-l h1, .es-m-txt-l h2, .es-m-txt-l h3, .es-m-txt-l h4, .es-m-txt-l h5, .es-m-txt-l h6 { text-align:left!important } .es-m-txt-r img, .es-m-txt-c img, .es-m-txt-l img { display:inline!important } .es-m-txt-r .es-menu td { float:right!important }
 .es-m-txt-l .es-menu td { float:left!important } .es-m-txt-c .es-menu td { display:inline-block } .es-spacer { display:inline-table } a.es-button, button.es-button { display:inline-block!important; font-size:16px!important; padding:10px 0px 10px 0px!important; line-height:120%!important } .es-button-border { display:inline-block!important } .es-m-fw, .es-m-fw.es-fw, .es-m-fw .es-button { display:block!important } .es-m-il, .es-m-il .es-button, .es-social, .es-social td, .es-menu.es-table-not-adapt { display:inline-block!important } .es-adaptive table, .es-left, .es-right { width:100%!important; border-collapse:separate!important } .es-content table, .es-header table, .es-footer table, .es-content, .es-footer, .es-header { width:100%!important; max-width:600px!important } .adapt-img { width:100%!important; height:auto!important } .es-adapt-td { display:block!important; width:100%!important }
 .es-mobile-hidden, .es-hidden { display:none!important } .es-container-hidden { display:none!important } .es-desk-hidden { width:auto!important; overflow:visible!important; float:none!important; max-height:inherit!important; line-height:inherit!important } tr.es-desk-hidden { display:table-row!important } table.es-desk-hidden { display:table!important } td.es-desk-hidden { display:table-cell!important } td.es-desk-menu-hidden { display:table-cell!important } .es-m-txt-c .es-menu td.es-desk-menu-hidden { display:inline-block!important } .es-menu td { width:1%!important } table.es-table-not-adapt, .esd-block-html table, .es-m-txt-r .es-menu td, .es-m-txt-l .es-menu td, .es-m-txt-c .es-menu td { width:auto!important } .h-auto { height:auto!important } .ext-product-button, .ext-product-price p, .ext-product-original-price p, .ext-product-omnibus-price p, .ext-product-omnibus-discount p { width:100%!important }
 .ext-product-button a { max-width:100%!important } .ext-product-name.ins-vertical p { height:90px!important; overflow:hidden!important; word-break:break-all!important; font-size:12px!important; line-height:150%!important } .ext-product-name.ins-vertical { height:100px!important } .ext-product-omnibus-price.ins-vertical p { height:30px!important; overflow:hidden!important; word-break:break-all!important; font-size:10px!important; line-height:150%!important } .ext-product-omnibus-price.ins-vertical { height:50px!important } .ext-product-omnibus-discount.ins-vertical p { height:30px!important; overflow:hidden!important; word-break:break-all!important; font-size:10px!important; line-height:150%!important } .ext-product-omnibus-discount.ins-vertical { height:50px!important } .ext-product-name p { height:unset!important; width:100%!important; overflow:hidden!important; font-size:16px!important; line-height:150%!important }
 .ext-product-name { height:unset!important } .ext-product-price.ins-vertical p { overflow:hidden!important; word-break:break-all!important; height:36px!important; font-size:12px!important; line-height:150%!important } .ext-product-price.ins-vertical { height:56px!important } .ext-product-original-price.ins-vertical p { overflow:hidden!important; word-break:break-all!important; height:36px!important; font-size:12px!important; line-height:150%!important } .ext-product-original-price.ins-vertical { height:56px!important } .ext-ins-attr.ins-vertical p { overflow:hidden!important; word-break:break-all!important; height:54px!important; font-size:12px!important; line-height:150%!important; width:100%!important } .ext-ins-attr.ins-vertical { height:74px!important } .ext-product-button a.ins-vertical { word-break:break-all!important; font-size:12px!important } .ext-product-image.ins-vertical { height:unset!important }
 td.esdev-mso-td.ins-vertical { vertical-align:bottom!important } .es-desk-menu-hidden { display:table-cell!important } }@media screen and (max-width:384px) {.mail-message-content { width:414px!important } }</style>
 <!--[if gte mso 9]>
<style>sup {
    font-size: 100% !important;
}</style><![endif]--><!--[if gte mso 9]>
<noscript>
    <xml>
        <o:OfficeDocumentSettings>
            <o:AllowPNG></o:AllowPNG>
            <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
    </xml>
</noscript><![endif]--><!--[if mso]>
<xml>
    <w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word">
        <w:DontUseAdvancedTypographyReadingMail></w:DontUseAdvancedTypographyReadingMail>
    </w:WordDocument>
</xml><![endif]-->
    <style type="text/css">
        ul, ol { padding: 0px 0px 0px 40px; }
        li p { mso-margin-bottom-alt: 15px; }
        .es-text-ltr ul, .es-text-ltr ol { padding: 0px 0px 0px 40px; }
        .es-text-rtl ol, .es-text-rtl ul { padding: 0px 40px 0px 0px; }
    </style></head>
 <body data-ins-track-seq="4" class="body" style="width:100%;height:100%;font-family:arial, 'helvetica neue', helvetica, sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;Margin:0"><div class="es-wrapper-color" lang="und" style="background-color:#F6F6F6"><!--[if gte mso 9]>
			<v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
				<v:fill type="tile" color="#f6f6f6"></v:fill>
			</v:background>
		<![endif]--><table width="100%" cellspacing="0" cellpadding="0" class="es-wrapper" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;padding:0;Margin:0;width:100%;height:100%;background-repeat:repeat;background-position:center top"><tbody><tr style="border-collapse:collapse"><td valign="top" style="padding:0;Margin:0"><table cellspacing="0" cellpadding="0" align="center" class="es-content" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;width:100%;table-layout:fixed !important"><tbody><tr style="border-collapse:collapse"><td align="center" style="padding:0;Margin:0"><table cellspacing="0" cellpadding="0" bgcolor="#fff" align="center" class="es-content-body" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:#FFF;width:600px"><tbody><tr style="border-collapse:collapse"><td align="left" bgcolor="#fff" style="padding:20px;Margin:0;background-color:#fff"><table width="100%" cellspacing="0" cellpadding="0" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tbody><tr style="border-collapse:collapse"><td valign="top" align="center" style="padding:0;Margin:0;width:560px"><table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tbody><tr style="border-collapse:collapse"><td align="center" style="padding:0 15px;Margin:0;font-size:0px"><img src="https://email-static.useinsider.com/f940abcdc21d4566ac97b97fb4e8650f/lib/pluginId_f940abcdc21d4566ac97b97fb4e8650f_lescent_images/logolescent.png" alt="" height="40" style="display:block;font-size:14px;border:0;outline:none;text-decoration:none;margin:0"></td>
 </tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table>
 <table cellspacing="0" cellpadding="0" align="center" class="es-content" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;width:100%;table-layout:fixed !important"><tbody><tr style="border-collapse:collapse"><td align="center" style="padding:0;Margin:0"><table cellspacing="0" cellpadding="0" bgcolor="#fff" align="center" class="es-content-body" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:#FFF;width:600px"><tbody><tr style="border-collapse:collapse"><td align="left" bgcolor="#fff" style="Margin:0;padding:10px 20px 20px;background-color:#fff"><table cellpadding="0" cellspacing="0" width="100%" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tbody><tr style="border-collapse:collapse"><td align="center" valign="top" style="padding:0;Margin:0;width:560px"><table cellpadding="0" cellspacing="0" width="100%" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tbody><tr style="border-collapse:collapse"><td align="center" style="padding:0;Margin:0;font-size:0px"><a data-ins-track-id="2" target="_blank" href="${INSIDER_TEMPLATE_LESCENT_ORIGINAL_LINK_URL}" style="mso-line-height-rule:exactly;text-decoration:underline;color:#333;font-size:14px;font-weight:inherit"><img src="${INSIDER_TEMPLATE_LESCENT_ORIGINAL_GIF_URL}" width="560" alt="" title="" class="adapt-img" style="display:block;font-size:14px;border:0;outline:none;text-decoration:none;margin:0"></a>
</td></tr><tr style="border-collapse:collapse"><td align="center" style="padding:20px 0 0;Margin:0"><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:150%;letter-spacing:0;font-weight:normal;color:#333;font-size:16px">Hoje separei seus favoritos naquele precinho que tá impossível resistir! Mas, essa é a única vez e só até 00h. Revele os perfumes acima para liberar sua surpresa!<br><br><strong style="font-weight:bolder !important">Lembrando que todos os dias</strong> vou deixar uma nova surpresa no seu e-mail, então fica atenta para não perder!</p></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table>
 <table cellspacing="0" cellpadding="0" align="center" class="es-content" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;width:100%;table-layout:fixed !important"><tbody><tr style="border-collapse:collapse"><td align="center" style="padding:0;Margin:0"><table cellspacing="0" cellpadding="0" align="center" bgcolor="#fff" class="es-footer-body" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:#fff;width:600px" role="none"><tbody><tr style="border-collapse:collapse"><td align="left" bgcolor="#1C1C1C" style="Margin:0;padding:20px;background-color:#1c1c1c"><table width="100%" cellspacing="0" cellpadding="0" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tbody><tr style="border-collapse:collapse"><td valign="top" align="center" style="padding:0;Margin:0;width:560px"><table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tbody><tr style="border-collapse:collapse"><td align="center" style="padding:20px;Margin:0"><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:150%;letter-spacing:0;font-weight:normal;color:#FFF;font-size:12px">Rod. Cel. PM Nelson Tranchesi 740</p>
<p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:150%;letter-spacing:0;font-weight:normal;color:#FFF;font-size:12px">CNPJ: 57.344.563/0001-14</p><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:150%;letter-spacing:0;font-weight:normal;color:#FFF;font-size:12px"><br></p><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:150%;letter-spacing:0;font-weight:normal;color:#FFF;font-size:12px">© 2025 Lescent</p><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:150%;letter-spacing:0;font-weight:normal;color:#FFF;font-size:12px"><br></p>
<p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:150%;letter-spacing:0;font-weight:normal;color:#FFF;font-size:12px">Se você tiver alguma dúvida, entre em contato com nosso suporte pelo WhatsApp: <a data-ins-track-id="3" target="_blank" href="http://wa.me/5511968502534" style="mso-line-height-rule:exactly;text-decoration:underline;color:#FFF;font-size:12px;font-weight:inherit">http://wa.me/5511968502534</a>. Estamos disponíveis em dias úteis das 09h às 17h.</p></td></tr></tbody></table></td></tr>
 <tr style="border-collapse:collapse"><td valign="top" align="center" style="padding:0;Margin:0;width:560px"><table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tbody><tr style="border-collapse:collapse"><td align="center" style="padding:0;Margin:0"><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:150%;letter-spacing:0;font-weight:normal;color:#FFF;font-size:10px"><strong style="font-weight:bolder !important"><a data-ins-track-id="4" target="_blank" href="<%unsub%>" style="mso-line-height-rule:exactly;text-decoration:underline;color:#fff;font-size:10px;font-weight:inherit">Não quero mais receber emails</a></strong></p></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr>
 </tbody></table></div><div style="position:absolute;left:-9999px;top:-9999px;margin:0px"></div><div style="position:absolute;left:-9999px;top:-9999px;margin:0px;padding:0px;border:0px none;width:1px"></div></body></html>`;

// Template real da Rituária na Insider — GIF é o segundo bloco de imagem; logo (primeiro
// bloco) fica intocado. Link aparece só 1x, envolvendo o GIF.
const INSIDER_TEMPLATE_RITUARIA_ORIGINAL_GIF_URL = "https://email-static.useinsider.com/f940abcdc21d4566ac97b97fb4e8650f/lib/pluginId_f940abcdc21d4566ac97b97fb4e8650f_rituaria_images/7258_N5i9uBulPYZqngaA.gif";
const INSIDER_TEMPLATE_RITUARIA_ORIGINAL_LINK_URL = "https://www.rituaria.com.br/collections/2-brindes?aca=6945acb5623b33abf6fdf231";

const INSIDER_TEMPLATE_RITUARIA = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns="http://www.w3.org/1999/xhtml" lang="und"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta content="telephone=no" name="format-detection"><title></title>
 <!--[if mso]><xml><w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word"><w:DontUseAdvancedTypographyReadingMail/></w:WordDocument></xml><![endif]--><style type="text/css">u + .body img ~ div div { display:none;}#outlook a { padding:0;}span.MsoHyperlink,span.MsoHyperlinkFollowed { color:inherit; mso-style-priority:99;}a.es-button { mso-style-priority:100!important; text-decoration:none!important;}a[x-apple-data-detectors],#MessageViewBody a { color:inherit!important; text-decoration:none!important; font-size:inherit!important; font-family:inherit!important; font-weight:inherit!important; line-height:inherit!important;}.es-desk-hidden { display:none; float:left; overflow:hidden; width:0; max-height:0; line-height:0; mso-hide:all;}@media only screen and (max-width:600px) {.es-p-default { } *[class="gmail-fix"] { display:none!important } p, a { line-height:150%!important } h1, h1 a { line-height:120%!important } h2, h2 a { line-height:120%!important } h3, h3 a { line-height:120%!important } h4, h4 a { line-height:120%!important } h5, h5 a { line-height:120%!important }
 h6, h6 a { line-height:120%!important } h1 { font-size:30px!important; text-align:center } h2 { font-size:26px!important; text-align:center } h3 { font-size:20px!important; text-align:center } h4 { font-size:24px!important; text-align:left } h5 { font-size:20px!important; text-align:left } h6 { font-size:16px!important; text-align:left } .es-header-body h1 a, .es-content-body h1 a, .es-footer-body h1 a { font-size:30px!important } .es-header-body h2 a, .es-content-body h2 a, .es-footer-body h2 a { font-size:26px!important } .es-header-body h3 a, .es-content-body h3 a, .es-footer-body h3 a { font-size:20px!important } .es-header-body h4 a, .es-content-body h4 a, .es-footer-body h4 a { font-size:24px!important } .es-header-body h5 a, .es-content-body h5 a, .es-footer-body h5 a { font-size:20px!important } .es-header-body h6 a, .es-content-body h6 a, .es-footer-body h6 a { font-size:16px!important }
 .es-header-body p, .es-header-body a { font-size:16px!important } .es-content-body p, .es-content-body a { font-size:16px!important } .es-footer-body p, .es-footer-body a { font-size:16px!important } .es-infoblock p, .es-infoblock a { font-size:12px!important } .es-m-txt-c, .es-m-txt-c h1, .es-m-txt-c h2, .es-m-txt-c h3, .es-m-txt-c h4, .es-m-txt-c h5, .es-m-txt-c h6 { text-align:center!important } .es-m-txt-r, .es-m-txt-r h1, .es-m-txt-r h2, .es-m-txt-r h3, .es-m-txt-r h4, .es-m-txt-r h5, .es-m-txt-r h6 { text-align:right!important } .es-m-txt-j, .es-m-txt-j h1, .es-m-txt-j h2, .es-m-txt-j h3, .es-m-txt-j h4, .es-m-txt-j h5, .es-m-txt-j h6 { text-align:justify!important } .es-m-txt-l, .es-m-txt-l h1, .es-m-txt-l h2, .es-m-txt-l h3, .es-m-txt-l h4, .es-m-txt-l h5, .es-m-txt-l h6 { text-align:left!important } .es-m-txt-r img, .es-m-txt-c img, .es-m-txt-l img { display:inline!important } .es-m-txt-r .es-menu td { float:right!important }
 .es-m-txt-l .es-menu td { float:left!important } .es-m-txt-c .es-menu td { display:inline-block } .es-spacer { display:inline-table } a.es-button, button.es-button { display:inline-block!important; font-size:16px!important; padding:10px 20px 10px 20px!important; line-height:120%!important } .es-button-border { display:inline-block!important } .es-m-fw, .es-m-fw.es-fw, .es-m-fw .es-button { display:block!important } .es-m-il, .es-m-il .es-button, .es-social, .es-social td, .es-menu.es-table-not-adapt { display:inline-block!important } .es-adaptive table, .es-left, .es-right { width:100%!important; border-collapse:separate!important } .es-content table, .es-header table, .es-footer table, .es-content, .es-footer, .es-header { width:100%!important; max-width:600px!important } .adapt-img { width:100%!important; height:auto!important } .es-adapt-td { display:block!important; width:100%!important }
 .es-mobile-hidden, .es-hidden { display:none!important } .es-container-hidden { display:none!important } .es-desk-hidden { width:auto!important; overflow:visible!important; float:none!important; max-height:inherit!important; line-height:inherit!important } tr.es-desk-hidden { display:table-row!important } table.es-desk-hidden { display:table!important } td.es-desk-hidden { display:table-cell!important } td.es-desk-menu-hidden { display:table-cell!important } .es-m-txt-c .es-menu td.es-desk-menu-hidden { display:inline-block!important } .es-menu td { width:1%!important } table.es-table-not-adapt, .esd-block-html table, .es-m-txt-r .es-menu td, .es-m-txt-l .es-menu td, .es-m-txt-c .es-menu td { width:auto!important } .h-auto { height:auto!important } a.es-button, button.es-button, label.es-button { padding-left:0px!important; padding-right:0px!important }
 .ext-product-button, .ext-product-price p, .ext-product-original-price p, .ext-product-omnibus-price p, .ext-product-omnibus-discount p { width:100%!important } .ext-product-button a { max-width:100%!important } .ext-product-name.ins-vertical p { height:90px!important; overflow:hidden!important; word-break:break-all!important; font-size:12px!important; line-height:150%!important } .ext-product-name.ins-vertical { height:100px!important } .ext-product-omnibus-price.ins-vertical p { height:30px!important; overflow:hidden!important; word-break:break-all!important; font-size:10px!important; line-height:150%!important } .ext-product-omnibus-price.ins-vertical { height:50px!important } .ext-product-omnibus-discount.ins-vertical p { height:30px!important; overflow:hidden!important; word-break:break-all!important; font-size:10px!important; line-height:150%!important } .ext-product-omnibus-discount.ins-vertical { height:50px!important }
 .ext-product-name p { height:unset!important; width:100%!important; overflow:hidden!important; font-size:16px!important; line-height:150%!important } .ext-product-name { height:unset!important } .ext-product-price.ins-vertical p { overflow:hidden!important; word-break:break-all!important; height:36px!important; font-size:12px!important; line-height:150%!important } .ext-product-price.ins-vertical { height:56px!important } .ext-product-original-price.ins-vertical p { overflow:hidden!important; word-break:break-all!important; height:36px!important; font-size:12px!important; line-height:150%!important } .ext-product-original-price.ins-vertical { height:56px!important } .ext-ins-attr.ins-vertical p { overflow:hidden!important; word-break:break-all!important; height:54px!important; font-size:12px!important; line-height:150%!important; width:100%!important } .ext-ins-attr.ins-vertical { height:74px!important }
 .ext-product-button a.ins-vertical { word-break:break-all!important; font-size:12px!important } .ext-product-image.ins-vertical { height:unset!important } td.esdev-mso-td.ins-vertical { vertical-align:bottom!important } .es-desk-menu-hidden { display:table-cell!important } }@media screen and (max-width:384px) {.mail-message-content { width:414px!important } }</style>
 <!--[if gte mso 9]>
<style>sup {
    font-size: 100% !important;
}</style><![endif]--><!--[if gte mso 9]>
<noscript>
    <xml>
        <o:OfficeDocumentSettings>
            <o:AllowPNG></o:AllowPNG>
            <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
    </xml>
</noscript><![endif]--><!--[if mso]>
<xml>
    <w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word">
        <w:DontUseAdvancedTypographyReadingMail></w:DontUseAdvancedTypographyReadingMail>
    </w:WordDocument>
</xml><![endif]-->
    <style type="text/css">
        ul, ol { padding: 0px 0px 0px 40px; }
        li p { mso-margin-bottom-alt: 15px; }
        .es-text-ltr ul, .es-text-ltr ol { padding: 0px 0px 0px 40px; }
        .es-text-rtl ol, .es-text-rtl ul { padding: 0px 40px 0px 0px; }
    </style></head>
 <body data-ins-track-seq="4" class="body" style="width:100%;height:100%;font-family:arial, 'helvetica neue', helvetica, sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;Margin:0"><div class="es-wrapper-color" lang="und" style="background-color:#F6F6F6"><!--[if gte mso 9]>
			<v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
				<v:fill type="tile" color="#f6f6f6"></v:fill>
			</v:background>
		<![endif]--><table width="100%" cellspacing="0" cellpadding="0" class="es-wrapper" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;padding:0;Margin:0;width:100%;height:100%;background-repeat:repeat;background-position:center top"><tbody><tr style="border-collapse:collapse"><td valign="top" style="padding:0;Margin:0"><table cellspacing="0" cellpadding="0" align="center" class="es-content" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;width:100%;table-layout:fixed !important"><tbody><tr style="border-collapse:collapse"><td align="center" style="padding:0;Margin:0"><table bgcolor="#fff" align="center" cellspacing="0" cellpadding="0" class="es-content-body" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:#FFF;width:600px"><tbody><tr style="border-collapse:collapse"><td align="left" style="padding:0;Margin:0"><table cellspacing="0" cellpadding="0" width="100%" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tbody><tr style="border-collapse:collapse"><td align="center" valign="top" style="padding:0;Margin:0;width:600px"><table cellspacing="0" cellpadding="0" width="100%" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tbody><tr style="border-collapse:collapse"><td align="center" style="padding:0;Margin:0;font-size:0px"><img height="50" src="https://email-static.useinsider.com/f940abcdc21d4566ac97b97fb4e8650f/lib/pluginId_f940abcdc21d4566ac97b97fb4e8650f_rituaria_images/captura_de_tela_20250521_180405_ZEmzdmKnlbGl3dbv.png" alt="" style="display:block;font-size:14px;border:0;outline:none;text-decoration:none;margin:0"></td>
 </tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table>
 <table cellspacing="0" cellpadding="0" align="center" class="es-content" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;width:100%;table-layout:fixed !important"><tbody><tr style="border-collapse:collapse"><td align="center" style="padding:0;Margin:0"><table cellspacing="0" cellpadding="0" bgcolor="#fff" align="center" class="es-content-body" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:#FFF;width:600px"><tbody><tr style="border-collapse:collapse"><td align="left" style="padding:0;Margin:0"><table cellspacing="0" width="100%" cellpadding="0" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tbody><tr style="border-collapse:collapse"><td align="center" valign="top" style="padding:0;Margin:0;width:600px"><table cellspacing="0" width="100%" cellpadding="0" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tbody><tr style="border-collapse:collapse"><td align="center" style="padding:0;Margin:0;font-size:0px"><a target="_blank" href="${INSIDER_TEMPLATE_RITUARIA_ORIGINAL_LINK_URL}" data-ins-track-id="2" style="mso-line-height-rule:exactly;text-decoration:underline;color:#333;font-size:14px;font-weight:inherit"><img src="${INSIDER_TEMPLATE_RITUARIA_ORIGINAL_GIF_URL}" width="600" alt="" title="" class="adapt-img" style="display:block;font-size:14px;border:0;outline:none;text-decoration:none;margin:0"></a>
</td></tr></tbody></table></td></tr></tbody></table></td></tr>
 <tr style="border-collapse:collapse"><td align="left" style="padding:5px 20px 0;Margin:0"><table cellspacing="0" width="100%" cellpadding="0" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tbody><tr style="border-collapse:collapse"><td valign="top" align="center" style="padding:0;Margin:0;width:560px"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tbody><tr style="border-collapse:collapse"><td align="center" style="padding:0;Margin:0"><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:150%;letter-spacing:0;font-weight:normal;color:#333;font-size:14px">Atenção: você acabou de liberar acesso exclusivo a todos os produtos da Rituária! Mal posso esperar para ver sua reação com o que preparei hoje. Mas, só até 00h, então vem rápido! Resgate agora para desbloquear.<br>
<br><strong style="font-weight:700 !important">Lembrando que todos os dias</strong>&nbsp;vou deixar uma nova surpresa no seu e-mail, então fica atenta para não perder!</p></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table>
 <table align="center" cellspacing="0" cellpadding="0" class="es-content" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;width:100%;table-layout:fixed !important"><tbody><tr style="border-collapse:collapse"><td align="center" style="padding:0;Margin:0"><table cellspacing="0" cellpadding="0" align="center" bgcolor="#fff" class="es-footer-body" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:#fff;width:600px" role="none"><tbody><tr style="border-collapse:collapse"><td align="left" bgcolor="#000" style="padding:5px;Margin:0;background-color:#000"><table cellspacing="0" cellpadding="0" width="100%" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tbody><tr style="border-collapse:collapse"><td valign="top" align="center" style="padding:0;Margin:0;width:590px"><table cellpadding="0" width="100%" cellspacing="0" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tbody><tr style="border-collapse:collapse"><td align="center" style="padding:20px;Margin:0"><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:150%;letter-spacing:0;font-weight:normal;color:#FFF;font-size:12px">Avenida Portugal 1174 Itapevi<br>
CNPJ: 38.246.589/0001-85<br><br>© 2025 Rituária<br><br>Se você tiver alguma dúvida, entre em contato com nosso suporte pelo WhatsApp:&nbsp;<a data-ins-track-id="3" target="_blank" href="http://wa.me/553497115675" style="mso-line-height-rule:exactly;text-decoration:underline;color:#FFF;font-size:12px;font-weight:inherit">http://wa.me/553497115675</a>. Estamos disponíveis em dias úteis das 09h às 17h.</p></td></tr></tbody></table></td></tr>
 <tr style="border-collapse:collapse"><td align="center" valign="top" style="padding:0;Margin:0;width:560px"><table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tbody><tr style="border-collapse:collapse"><td align="center" style="padding:0;Margin:0"><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:150%;letter-spacing:0;font-weight:normal;color:#FFF;font-size:10px"><strong style="font-weight:700 !important"><a target="_blank" href="<%unsub%>" data-ins-track-id="4" style="mso-line-height-rule:exactly;text-decoration:underline;color:#fff;font-size:10px;font-weight:inherit">Não quero mais receber emails</a></strong></p></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr>
 </tbody></table></div></body></html>`;

interface InsiderTemplateConfig {
  html: string;
  originalGifUrl: string;
  // Array porque alguns templates repetem o link em mais de um lugar com URLs DIFERENTES
  // (ex: Apice v2 — imagem sem parâmetro de tracking, texto "clicando aqui" com ?aca=...).
  // Quando o usuário informa um "Link da campanha", todas as URLs da lista são trocadas por ele.
  originalLinkUrls?: string[];
}

// Cada marca tem seu próprio template real da Insider (HTML exportado do editor deles).
// Só a Apice tem template próprio configurado por enquanto — as demais usam o fallback
// genérico abaixo até o HTML de cada uma chegar (aí é só adicionar a entrada aqui, igual a
// Apice: template + a URL exata do GIF e do link originais dentro desse HTML).
const INSIDER_TEMPLATES: Partial<Record<ContaInsider, InsiderTemplateConfig>> = {
  Apice: {
    html: INSIDER_TEMPLATE_APICE,
    originalGifUrl: INSIDER_TEMPLATE_APICE_ORIGINAL_GIF_URL,
    originalLinkUrls: [INSIDER_TEMPLATE_APICE_ORIGINAL_LINK_URL_1, INSIDER_TEMPLATE_APICE_ORIGINAL_LINK_URL_2],
  },
  Barbours: {
    html: INSIDER_TEMPLATE_BARBOURS,
    originalGifUrl: INSIDER_TEMPLATE_BARBOURS_ORIGINAL_GIF_URL,
    originalLinkUrls: [INSIDER_TEMPLATE_BARBOURS_ORIGINAL_LINK_URL],
  },
  Gocase: {
    html: INSIDER_TEMPLATE_GOCASE,
    originalGifUrl: INSIDER_TEMPLATE_GOCASE_ORIGINAL_GIF_URL,
    originalLinkUrls: [INSIDER_TEMPLATE_GOCASE_ORIGINAL_LINK_URL],
  },
  Kokeshi: {
    html: INSIDER_TEMPLATE_KOKESHI,
    originalGifUrl: INSIDER_TEMPLATE_KOKESHI_ORIGINAL_GIF_URL,
    originalLinkUrls: [INSIDER_TEMPLATE_KOKESHI_ORIGINAL_LINK_URL],
  },
  Lescent: {
    html: INSIDER_TEMPLATE_LESCENT,
    originalGifUrl: INSIDER_TEMPLATE_LESCENT_ORIGINAL_GIF_URL,
    originalLinkUrls: [INSIDER_TEMPLATE_LESCENT_ORIGINAL_LINK_URL],
  },
  Rituaria: {
    html: INSIDER_TEMPLATE_RITUARIA,
    originalGifUrl: INSIDER_TEMPLATE_RITUARIA_ORIGINAL_GIF_URL,
    originalLinkUrls: [INSIDER_TEMPLATE_RITUARIA_ORIGINAL_LINK_URL],
  },
};

function buildGenericInsiderHtml(imageUrl: string, linkUrl?: string): string {
  const href = linkUrl?.trim();
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1E5;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;">
      <tr><td align="center" style="padding:0;">
        ${href ? `<a href="${href}" target="_blank">` : ''}<img src="${imageUrl}" alt="" width="600" style="width:100%;max-width:600px;display:block;border-radius:16px;" />${href ? '</a>' : ''}
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

function buildInsiderVariationHtml(params: { imageUrl: string; linkUrl?: string; marca: string }): string {
  const cfg = INSIDER_TEMPLATES[params.marca as ContaInsider];
  if (!cfg) {
    // Template próprio ainda não configurado pra essa marca — fallback genérico funcional.
    return buildGenericInsiderHtml(params.imageUrl, params.linkUrl);
  }
  let html = cfg.html.replaceAll(cfg.originalGifUrl, params.imageUrl);
  if (params.linkUrl?.trim() && cfg.originalLinkUrls?.length) {
    for (const originalUrl of cfg.originalLinkUrls) {
      html = html.replaceAll(originalUrl, params.linkUrl.trim());
    }
  }
  return html;
}

async function createInsiderExperimentCampaign(params: {
  apiKey: string; name: string; tags: string[]; variationA: { subject: string; preHeader: string; html: string };
  variationB: { subject: string; preHeader: string; html: string };
}): Promise<{ id: string; message: string }> {
  const { apiKey, name, tags, variationA, variationB } = params;
  const toB64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
  const res = await fetch('https://mail.useinsider.com/content/v1/campaign/create', {
    method: 'POST',
    headers: { 'X-INS-AUTH-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name, tags, type: 'experiment',
      variations: [
        { subject: variationA.subject, pre_header: variationA.preHeader, html: toB64(variationA.html) },
        { subject: variationB.subject, pre_header: variationB.preHeader, html: toB64(variationB.html) },
      ],
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `Insider retornou ${res.status}`);
  return { id: String(data.id ?? ''), message: data.message ?? '' };
}

async function generateAbTestProposal(params: {
  marca: string; pautaAprovada: any; candidatosHistoricos: any[]; token: string; excludeIds?: string[];
}): Promise<{ conteudoId: string | null; racional: string }> {
  const { pautaAprovada, candidatosHistoricos, token, excludeIds } = params;
  const excludeSet = new Set(excludeIds ?? []);
  const pool = candidatosHistoricos.filter((c: any) => !excludeSet.has(c.id));
  const candidatos = amostra(pool, 15);
  const candidatosBlock = candidatos.map((c: any, i: number) => `${i + 1}. id="${c.id}" [${c.marca}] "${c.nome_design}" — ${c.mecanica_texto}`).join('\n');
  const systemPrompt = 'Você é um estrategista de testes A/B de CRM. Escolha o melhor GIF histórico pra testar contra um novo conceito recém-aprovado e justifique objetivamente pra quem vai rodar o teste no Insider.';
  const userPrompt = `Novo conceito aprovado (${pautaAprovada.marca}): mecânica "${pautaAprovada.operacional?.mecanicaEscolhida}", racional "${pautaAprovada.operacional?.justificativaMecanica}".

Candidatos históricos disponíveis:
${candidatosBlock}

Escolha exatamente um "id" da lista e escreva o racional da comparação. Retorne APENAS JSON, sem markdown: {"conteudoId":"","racional":""}`;
  const text = await callGemini(userPrompt, systemPrompt, token);
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  const validId = candidatos.some((c: any) => c.id === parsed.conteudoId) ? parsed.conteudoId : null;
  return { conteudoId: validId, racional: parsed.racional ?? '' };
}

// Gera e salva os 3 frames em sequência (frame 1 = master, referência visual dos frames 2 e 3).
async function generateGifFramesForAgente(params: {
  marca: string; pautaId: string; brandDna: any; aspectRatio: string;
  estiloIlustracao?: string; paleta?: any; mecanica?: string; recompensa?: string;
  frameInicial: string; frameIntermediario: string; frameFinal: string;
  piappApiKey: string; supabaseServiceKey: string;
}): Promise<Record<string, string> | undefined> {
  const {
    marca, pautaId, brandDna, aspectRatio, estiloIlustracao, paleta, mecanica, recompensa,
    frameInicial, frameIntermediario, frameFinal, piappApiKey, supabaseServiceKey,
  } = params;
  const frames = [
    { frameName: 'inicial', frameDescription: frameInicial },
    { frameName: 'intermediario', frameDescription: frameIntermediario },
    { frameName: 'final', frameDescription: frameFinal },
  ];
  const frameResults: Array<{ frameName: string; imageBytes: string; mimeType: string }> = [];
  let masterFrameRefUrl: string | undefined;

  // Cada frame é tentado individualmente — se um falhar, os demais seguem tentando em vez de
  // abortar o lote inteiro. Antes, uma falha em qualquer frame descartava os frames já gerados
  // com sucesso e a pauta terminava sem nenhuma imagem; agora ela sai com os frames que deram
  // certo, em vez de "sem nada".
  for (const { frameName, frameDescription } of frames) {
    const prompt = buildFramePrompt({
      frameName, frameDescription, marca, brandDna, estiloIlustracao, paleta, mecanica, recompensa,
      aspectRatio, frameRefCount: masterFrameRefUrl ? 1 : 0, productRefCount: 0, totalFrames: frames.length,
    });
    // t2i não aceita imagem de referência — trocar pra edit a partir do frame que usa o
    // frame-mestre como referência (frames 2+).
    const imageModel = resolveImageModel('wavespeed-gpt-image-2-t2i', !!masterFrameRefUrl);
    try {
      const result = await generateImage(
        prompt, aspectRatio, imageModel, piappApiKey,
        masterFrameRefUrl ? [masterFrameRefUrl] : undefined,
      );
      frameResults.push({ frameName, ...result });
      if (!masterFrameRefUrl) {
        try {
          masterFrameRefUrl = await uploadReferenceToPiApp(`data:${result.mimeType};base64,${result.imageBytes}`, piappApiKey);
        } catch (err: any) {
          console.error('[agente-gif] Falha ao subir master frame como referência:', err.message);
        }
      }
    } catch (err: any) {
      console.error(`[agente-gif] Falha ao gerar o frame "${frameName}" (pulando, mantendo os demais):`, err.message);
    }
  }

  const safeMarca = marca.toLowerCase().replace(/[^a-z0-9]/g, '');
  const urls: Record<string, string> = {};
  for (let i = 0; i < frameResults.length; i++) {
    const { frameName, imageBytes, mimeType } = frameResults[i];
    try {
      const { bytes } = dataUrlToBytes(`data:${mimeType};base64,${imageBytes}`);
      const up = await supabaseUpload('campaign-images', `${safeMarca}/${pautaId}/${frameName}.png`, bytes, mimeType, supabaseServiceKey);
      // Chaves "frame_0"/"frame_1"/"frame_2" (não "inicial"/"final"...) pra casar com a
      // convenção que o GifViewer/reconstrução do front ordenam alfabeticamente = cronológica.
      if (up.ok) urls[`frame_${i}`] = `${SUPABASE_URL}/storage/v1/object/public/campaign-images/${safeMarca}/${pautaId}/${frameName}.png`;
    } catch (err: any) {
      console.error(`[agente-gif] Upload do frame ${frameName} falhou:`, err.message);
    }
  }
  return Object.keys(urls).length > 0 ? urls : undefined;
}

async function runAgenteGifPipeline(env: Env, motivoRejeicaoAnterior?: string): Promise<any | null> {
  try {
    const marca = Math.random() < 0.5 ? 'Apice' : 'Barbours';
    const [conteudosAprendizado, feedback] = await Promise.all([
      loadConteudosGifAprendizado(env.SUPABASE_KEY),
      getFeedbackAgenteGif(env.SUPABASE_KEY),
    ]);

    const concept = await generateGifAgentConcept({
      marca, conteudosAprendizado,
      feedbackAprovados: feedback.aprovados, feedbackRejeitados: feedback.reprovados,
      motivoRejeicaoAnterior, token: env.GOGROUP_TOKEN,
    });

    const copyCompleta = !!(
      concept?.copy?.assunto?.trim() &&
      concept?.copy?.headlineBanner?.trim() &&
      concept?.copy?.subHeadlineBanner?.trim() &&
      concept?.copy?.ctaBotao?.trim()
    );
    if (!concept?.copy || !concept?.operacional || !copyCompleta) {
      console.error('[agente-gif] Conceito retornado incompleto (falta assunto/headline/subheadline/CTA), descartando esta rodada.', JSON.stringify(concept?.copy ?? {}));
      return null;
    }

    // Rede de segurança contra travessão na copy (denuncia texto gerado por IA) — o prompt já
    // proíbe, mas o modelo às vezes ignora. Troca por vírgula pra manter a frase legível.
    const semTravessao = (s: string) => s.replace(/\s*[—–]\s*/g, ', ').replace(/\s*--\s*/g, ', ');
    concept.copy.assunto = semTravessao(concept.copy.assunto);
    concept.copy.headlineBanner = semTravessao(concept.copy.headlineBanner);
    concept.copy.subHeadlineBanner = semTravessao(concept.copy.subHeadlineBanner);

    const pauta = normalizePauta(concept, marca, 'C', 'imagem', 0, 3, '1:1');
    pauta.id = `pauta-agente-${Date.now()}`;

    const brandDna = BRAND_DNA[marca];
    const frames: string[] = pauta.visual?.frames ?? [];
    let frameUrls: Record<string, string> | undefined;
    if (env.PIAPP_API_KEY && frames.length >= 2 && brandDna) {
      try {
        frameUrls = await generateGifFramesForAgente({
          marca, pautaId: pauta.id, brandDna, aspectRatio: '1:1',
          estiloIlustracao: pauta.visual?.estiloIlustracao,
          paleta: pauta.visual?.paletaRecomendada,
          mecanica: pauta.operacional?.mecanicaEscolhida,
          recompensa: pauta.operacional?.recompensaEscolhida,
          frameInicial: frames[0], frameIntermediario: frames[1] ?? frames[0], frameFinal: frames[frames.length - 1] ?? frames[0],
          piappApiKey: env.PIAPP_API_KEY, supabaseServiceKey: env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY,
        });
      } catch (err: any) {
        console.error('[agente-gif] Falha ao gerar frames automaticamente (pauta fica sem imagem):', err.message);
      }
    }

    await supabaseUpsertPauta({
      id: pauta.id, marca, modo: 'C', tipo_geracao: 'imagem',
      copy: pauta.copy, visual: pauta.visual, operacional: pauta.operacional,
      previsao: pauta.previsao, riscos: pauta.riscos, status: 'rascunho',
      data_criacao: pauta.dataCriacao, aspect_ratio: '1:1', frame_urls: frameUrls ?? null,
    }, env.SUPABASE_KEY);

    console.log(`[agente-gif] Nova pauta gerada: ${pauta.id} (${marca}) — mecânica "${pauta.operacional?.mecanicaEscolhida}"`);
    return { ...pauta, frameUrls };
  } catch (err: any) {
    console.error('[agente-gif] Erro no pipeline:', err.message);
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const SUPABASE_KEY = env?.SUPABASE_KEY || '';
    const SUPABASE_SERVICE_KEY = env?.SUPABASE_SERVICE_KEY || SUPABASE_KEY;
    const PIAPP_API_KEY = env?.PIAPP_API_KEY || '';
    const GOGROUP_TOKEN = env?.GOGROUP_TOKEN || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === '/api/historico') {
      return json({ status: 'success', data: hardcodedDisparos });
    }

    if (url.pathname === '/api/mecanicas') {
      return json({ status: 'success', data: DEFAULT_MECANICAS });
    }

    if (url.pathname === '/api/generate-pauta' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const { modo, input, aspectRatio = '1:1', direcionamentoIA = '', tipoGeracao = 'texto_imagem' } = body;
        if (!input?.marca) return json({ error: 'marca obrigatória' }, 400);
        const { marca } = input;
        const contextDb = hardcodedDisparos.filter((d: any) => d.marca === marca);
        // Aceitar número ou string
        const qtdFramesRaw = input.quantidadeFrames;
        const qtdFrames = (qtdFramesRaw !== undefined && qtdFramesRaw !== null)
          ? Math.min(Math.max(parseInt(String(qtdFramesRaw)), 2), 20)
          : 3;
        console.log('[generate-pauta] quantidadeFrames recebido:', qtdFramesRaw, '→ qtdFrames:', qtdFrames);
        const isApice = marca === 'Apice';
        const systemPrompt = `Você é agente de CRM especialista para ${marca}. REGRAS: sem CAPS LOCK, sem %, OFF, GRÁTIS, R$. Pré-header SEMPRE: "Mas, vou precisar cancelar em breve". Assunto ${isApice ? '27-47' : '16-39'} chars.`;
        const userPrompt = modo === 'A'
          ? `Gere ${input.quantidadePautas || 1} pauta(s) para ${marca}.
Contexto: ${input.contextoCampanha || 'Geral'}. Segmento: ${input.segmentoAlvo || 'Principal'}.
${direcionamentoIA ? `Direcionamento: "${direcionamentoIA}"` : ''}
Histórico: ${JSON.stringify(contextDb)}
CRÍTICO: O array "frames" deve ter EXATAMENTE ${qtdFrames} itens — nem mais, nem menos.
CONTINUIDADE VISUAL (ESCOPO DECRESCENTE — OBRIGATÓRIO): frames[0] é a ÚNICA descrição completa da cena (objeto herói + todos os props secundários + cor + posição + fundo + atmosfera). Os itens seguintes (frames[1], frames[2]...) descrevem SOMENTE o delta — apenas o que muda no objeto/elemento da mecânica principal — e NÃO redescrevem em detalhe props secundários, fundo ou atmosfera já estabelecidos em frames[0] (cite-os no máximo de passagem como inalterados, ex: "a necessaire segue parada no canto inferior direito"). Redescrever um objeto estático em detalhe a cada frame é o que faz a IA de imagem reposicionar esse objeto por engano. O objeto principal só pode mudar de posição/estado de forma incremental (nunca um salto).
Retorne array JSON com ${input.quantidadePautas || 1} pauta(s) e esta estrutura exata:
[{
  "copy": { "assunto": "", "preHeader": "Mas, vou precisar cancelar em breve", "headlineBanner": "", "subHeadlineBanner": "", "ctaBotao": "" },
  "visual": { "formato": "", "paletaRecomendada": { "nome": "", "cores": [] }, "estiloIlustracao": "", "frames": [], "posicaoCta": "", "tipografia": "" },
  "operacional": { "mecanicaEscolhida": "", "justificativaMecanica": "", "recompensaEscolhida": "", "diaRecomendado": "", "horarioRecomendado": "", "segmentoRecomendado": "" },
  "previsao": { "aberturaEsperada": "", "ctorEsperado": "", "receitaEsperada": "", "casesReferencia": [], "confianca": "alta", "confiancaMotivo": "" },
  "riscos": []
}]`
          : `Modo B — complete os campos vazios respeitando os preenchidos.
Assunto: "${input.boxTituloEmail || ''}"
Headline: "${input.boxHeadlineBanner || ''}"
Sub: "${input.boxSubtituloEmail || ''}"
CTA: "${input.boxCta || ''}"
Mecânica: "${input.boxMecanicaOuEstatico || ''}"
Recompensa: "${input.boxRecompensa || ''}"
${direcionamentoIA ? `Direcionamento: "${direcionamentoIA}"` : ''}
CRÍTICO: O array "frames" deve ter EXATAMENTE ${qtdFrames} itens — nem mais, nem menos.
O direcionamento pode descrever os frames em detalhes — use essas descrições literalmente para preencher o array "frames", uma por item.
CONTINUIDADE VISUAL (ESCOPO DECRESCENTE — OBRIGATÓRIO): frames[0] é a ÚNICA descrição completa da cena (objeto herói + todos os props secundários + cor + posição + fundo + atmosfera). Os itens seguintes (frames[1], frames[2]...) descrevem SOMENTE o delta — apenas o que muda no objeto/elemento da mecânica principal — e NÃO redescrevem em detalhe props secundários, fundo ou atmosfera já estabelecidos em frames[0] (cite-os no máximo de passagem como inalterados, ex: "a necessaire segue parada no canto inferior direito"). Redescrever um objeto estático em detalhe a cada frame é o que faz a IA de imagem reposicionar esse objeto por engano. O objeto principal só pode mudar de posição/estado de forma incremental (nunca um salto).
Histórico: ${JSON.stringify(contextDb)}
Retorne array JSON com 1 pauta e esta estrutura exata:
[{
  "copy": { "assunto": "", "preHeader": "Mas, vou precisar cancelar em breve", "headlineBanner": "", "subHeadlineBanner": "", "ctaBotao": "" },
  "visual": { "formato": "", "paletaRecomendada": { "nome": "", "cores": [] }, "estiloIlustracao": "", "frames": [], "posicaoCta": "", "tipografia": "" },
  "operacional": { "mecanicaEscolhida": "", "justificativaMecanica": "", "recompensaEscolhida": "", "diaRecomendado": "", "horarioRecomendado": "", "segmentoRecomendado": "" },
  "previsao": { "aberturaEsperada": "", "ctorEsperado": "", "receitaEsperada": "", "casesReferencia": [], "confianca": "alta", "confiancaMotivo": "" },
  "riscos": []
}]`;

        const text = await callGemini(userPrompt, systemPrompt, GOGROUP_TOKEN);
        const pautas = JSON.parse(text.replace(/```json|```/g, '').trim());
        console.log('[generate-pauta] qtdFrames solicitado:', qtdFrames);
        console.log('[generate-pauta] frames retornados pelo GPT:', pautas[0]?.visual?.frames?.length);
        const result = pautas.map((p: any, i: number) => normalizePauta(p, marca, modo, tipoGeracao, i, qtdFrames, aspectRatio));
        console.log('[generate-pauta] frames no resultado final:', result[0]?.visual?.frames?.length);
        return json({ status: 'success', data: result });
      } catch (err: any) {
        return json({ error: 'Erro ao gerar pauta', details: err.message }, 500);
      }
    }

    if (url.pathname === '/api/generate-image' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const {
          frameName, frameDescription, aspectRatio = '1:1', marca, pautaId, totalFrames,
          imageModel: rawModel = 'wavespeed-gpt-image-2-t2i', estiloIlustracao, paleta, mecanica, recompensa,
          headline, subheadline, direcionamento, referenceFrameUrl, referenceFrameUrls: rawFrameRefs,
          referenciaImagem: rawRefImage, referenciasImagem: rawRefImages, ajusteRegeneracao,
        } = body;
        if (!frameDescription) return json({ error: 'frameDescription obrigatório' }, 400);
        const brandDna = BRAND_DNA[marca];
        if (!brandDna) return json({ error: 'marca inválida' }, 400);

        const productRefUrls = await uploadReferences(rawRefImage, rawRefImages, PIAPP_API_KEY);

        // Frame(s) anterior(es) — normalmente [frame 1 (master), frame imediatamente anterior] —
        // servem de referência visual pra manter objeto/posição/layout/zoom iguais entre frames do GIF.
        const frameRefInputs: string[] = Array.isArray(rawFrameRefs) && rawFrameRefs.length > 0
          ? rawFrameRefs
          : (typeof referenceFrameUrl === 'string' && referenceFrameUrl.startsWith('data:') ? [referenceFrameUrl] : []);

        const frameRefUrls: string[] = [];
        for (const frameRef of frameRefInputs) {
          if (typeof frameRef === 'string' && frameRef.startsWith('data:')) {
            try {
              frameRefUrls.push(await uploadReferenceToPiApp(frameRef, PIAPP_API_KEY));
            } catch (err: any) {
              console.error('[generate-image] Falha ao subir frame de referência (ignorando):', err.message);
            }
          }
        }

        const refUrls = [...productRefUrls, ...frameRefUrls];
        const imageModel = resolveImageModel(rawModel, refUrls.length > 0);

        const prompt = buildFramePrompt({ frameName, frameDescription, marca, brandDna, estiloIlustracao, paleta, mecanica, recompensa, headline, subheadline, direcionamento, aspectRatio, frameRefCount: frameRefUrls.length, productRefCount: productRefUrls.length, totalFrames, ajusteRegeneracao: typeof ajusteRegeneracao === 'string' && ajusteRegeneracao.trim() ? ajusteRegeneracao.trim() : undefined });

        const result = await generateImage(prompt, aspectRatio, imageModel, PIAPP_API_KEY, refUrls.length > 0 ? refUrls : undefined);
        let publicUrl: string | null = null;
        if (pautaId) {
          try {
            const safeMarca = marca.toLowerCase().replace(/[^a-z0-9]/g, '');
            const safeFrame = (frameName || 'frame').replace(/[^a-z0-9_]/g, '');
            const binaryStr = atob(result.imageBytes);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
            const up = await supabaseUpload('campaign-images', `${safeMarca}/${pautaId}/${safeFrame}.png`, bytes, result.mimeType, SUPABASE_SERVICE_KEY);
            if (up.ok) publicUrl = `${SUPABASE_URL}/storage/v1/object/public/campaign-images/${safeMarca}/${pautaId}/${safeFrame}.png`;
          } catch {}
        }
        return json({ imageBytes: result.imageBytes, mimeType: result.mimeType, publicUrl });
      } catch (err: any) {
        return json({ error: 'Erro ao gerar imagem', details: err.message }, 500);
      }
    }

    if (url.pathname === '/api/generate-gif' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const {
          aspectRatio = '1:1', marca, pautaId,
          imageModel: rawModel = 'wavespeed-gpt-image-2-t2i', estiloIlustracao, paleta, mecanica, recompensa,
          frameInicial, frameIntermediario, frameFinal,
          referenciaImagem: rawRefImage, referenciasImagem: rawRefImages,
        } = body;
        if (!frameInicial || !frameIntermediario || !frameFinal) {
          return json({ error: 'frameInicial, frameIntermediario e frameFinal são obrigatórios.' }, 400);
        }
        const brandDna = BRAND_DNA[marca];
        if (!brandDna) return json({ error: 'marca inválida' }, 400);

        const refUrls = await uploadReferences(rawRefImage, rawRefImages, PIAPP_API_KEY);

        const frames = [
          { frameName: 'inicial', frameDescription: frameInicial as string },
          { frameName: 'intermediario', frameDescription: frameIntermediario as string },
          { frameName: 'final', frameDescription: frameFinal as string },
        ];

        // Sequencial (não paralelo): frame 1 é a "master frame" e serve de referência visual
        // pros frames 2 e 3, pra manter objeto/posição/layout consistentes entre eles.
        const frameResults: Array<{ frameName: string; imageBytes: string; mimeType: string }> = [];
        let masterFrameRefUrl: string | undefined;

        for (const { frameName, frameDescription } of frames) {
          const prompt = buildFramePrompt({ frameName, frameDescription, marca, brandDna, estiloIlustracao, paleta, mecanica, recompensa, aspectRatio, frameRefCount: masterFrameRefUrl ? 1 : 0, productRefCount: refUrls.length, totalFrames: frames.length });
          const frameRefUrls = masterFrameRefUrl ? [...refUrls, masterFrameRefUrl] : refUrls;
          // O modelo t2i não aceita imagens de referência — precisa trocar pra "-edit" a partir
          // do momento que o frame-mestre entra como referência (frames 2+), não só quando o
          // usuário anexa uma foto de produto. Bug pré-existente: antes o modelo ficava fixo em
          // t2i mesmo com o frame-mestre anexado, e a PiApp rejeitava a chamada.
          const imageModel = resolveImageModel(rawModel, frameRefUrls.length > 0);
          const result = await generateImage(prompt, aspectRatio, imageModel, PIAPP_API_KEY, frameRefUrls.length > 0 ? frameRefUrls : undefined);
          frameResults.push({ frameName, ...result });

          if (!masterFrameRefUrl) {
            try {
              masterFrameRefUrl = await uploadReferenceToPiApp(`data:${result.mimeType};base64,${result.imageBytes}`, PIAPP_API_KEY);
            } catch (err: any) {
              console.error('[generate-gif] Falha ao subir master frame como referência (ignorando):', err.message);
            }
          }
        }

        const results = await Promise.all(frameResults.map(async ({ frameName, imageBytes, mimeType }) => {
          let publicUrl: string | null = null;
          if (pautaId) {
            try {
              const safeMarca = marca.toLowerCase().replace(/[^a-z0-9]/g, '');
              const { bytes } = dataUrlToBytes(`data:${mimeType};base64,${imageBytes}`);
              const up = await supabaseUpload('campaign-images', `${safeMarca}/${pautaId}/${frameName}.png`, bytes, mimeType, SUPABASE_SERVICE_KEY);
              if (up.ok) publicUrl = `${SUPABASE_URL}/storage/v1/object/public/campaign-images/${safeMarca}/${pautaId}/${frameName}.png`;
            } catch {}
          }
          return { frameName, imageBytes, mimeType, publicUrl };
        }));

        return json({ frames: results });
      } catch (err: any) {
        return json({ error: 'Erro ao gerar GIF', details: err.message }, 500);
      }
    }

    if (url.pathname === '/api/generate-variation' && request.method === 'POST') {
      try {
        const { pauta } = await request.json() as any;
        if (!pauta) return json({ error: 'pauta obrigatória' }, 400);
        const { marca, operacional, copy } = pauta;
        const prompt = `Variação de copy para ${marca}. Mecânica: ${operacional?.mecanicaEscolhida}. Assunto: "${copy?.assunto}". Headline: "${copy?.headlineBanner}". CTA: "${copy?.ctaBotao}". Regras: sem %, OFF, GRÁTIS, R$. Assunto ${marca === 'Apice' ? '27-47':'16-39'} chars. Retorne JSON: {"assunto":"","preHeader":"Mas, vou precisar cancelar em breve","headlineBanner":"","subHeadlineBanner":"","ctaBotao":""}`;
        const text = await callGemini(prompt, 'Retorne apenas JSON válido, sem markdown.', GOGROUP_TOKEN);
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
        parsed.preHeader = 'Mas, vou precisar cancelar em breve';
        return json({ status: 'success', data: parsed });
      } catch (err: any) {
        return json({ error: 'Erro ao gerar variação', details: err.message }, 500);
      }
    }

    if (url.pathname === '/api/parse-estilo-visual' && request.method === 'POST') {
      try {
        const { marca } = await request.json() as any;
        return json({ corTexto: '#FFFFFF', corSubheadline: 'rgba(255,255,255,0.90)', estiloBotao: 'pill', corBotao: marca === 'Apice' ? '#688D65' : '#BF0F26', corTextoBotao: '#FFFFFF', tamanhoHeadline: 'grande', pesoFonte: '900', familiaFonte: 'Georgia, serif' });
      } catch {
        return json({ corTexto: '#FFFFFF', estiloBotao: 'pill', corBotao: '#688D65', corTextoBotao: '#FFFFFF', tamanhoHeadline: 'grande', pesoFonte: '900', familiaFonte: 'Georgia, serif' });
      }
    }

    if (url.pathname === '/api/save-frame' && request.method === 'POST') {
      try {
        const { pautaId, frameName, imageDataUrl } = await request.json() as any;
        if (!pautaId || !frameName || !imageDataUrl) return json({ error: 'campos obrigatórios faltando' }, 400);
        const base64Data = imageDataUrl.split(',')[1];
        const mimeType = imageDataUrl.split(';')[0].split(':')[1] || 'image/png';
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        const res = await supabaseUpload('campaign-images', `frames/${pautaId}/${frameName}.png`, bytes, mimeType, SUPABASE_KEY);
        if (!res.ok) return json({ error: 'upload falhou' }, 500);
        return json({ publicUrl: `${SUPABASE_URL}/storage/v1/object/public/campaign-images/frames/${pautaId}/${frameName}.png` });
      } catch (err: any) {
        return json({ error: err.message }, 500);
      }
    }

    if (url.pathname === '/api/approve-pauta' && request.method === 'POST') {
      try {
        const { pauta } = await request.json() as any;
        if (!pauta?.id) return json({ error: 'pauta inválida' }, 400);
        // PostgREST só expõe public/graphql_public — crm_ai.ia_outputs só é alcançável via
        // RPC SECURITY DEFINER (crm_ai_insert_ia_output_v2). Bug pré-existente: a versão
        // anterior tentava POST direto em /rest/v1/ia_outputs (schema errado) e engolia o
        // erro (nunca checava res.ok), então nenhuma aprovação era de fato salva.
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/crm_ai_insert_ia_output_v2`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            p_marca_id: pauta.marca === 'Apice' ? 1 : 2,
            p_tipo_canal: 'email',
            p_analisado: `Pauta ${pauta.modo} aprovada`,
            p_modelo: 'gpt-5.5',
            p_parametros: { modo: pauta.modo, pautaId: pauta.id },
            p_recomendacao_texto: `ASSUNTO: ${pauta.copy?.assunto}\nHEADLINE: ${pauta.copy?.headlineBanner}`,
            p_recomendacao_estruturada: { copy: pauta.copy, visual: pauta.visual, operacional: pauta.operacional },
            p_aprovado: true,
          }),
        });
        if (!res.ok) return json({ error: 'Falha ao salvar aprovação', details: await res.text() }, 500);
        const outputId = await res.json();
        return json({ success: true, output_id: outputId });
      } catch (err: any) {
        return json({ error: err.message }, 500);
      }
    }

    // Feedback humano (aprovar/reprovar) de uma pauta modo 'C'. Vira sinal de aprendizado
    // (crm_ai.ia_outputs, tipo_canal='conceito') pras próximas rodadas do agente. Reprovação
    // dispara regeneração imediata (aguardada aqui, já que este runtime não expõe waitUntil);
    // aprovação dispara a proposta de teste A/B.
    if (url.pathname === '/api/feedback-agente-gif' && request.method === 'POST') {
      try {
        const { pauta, aprovado, motivo } = await request.json() as any;
        if (!pauta?.id || typeof aprovado !== 'boolean') {
          return json({ error: 'pauta e aprovado (boolean) são obrigatórios.' }, 400);
        }
        const marcaId = pauta.marca === 'Apice' ? 1 : 2;

        // Ver comentário em /api/approve-pauta — crm_ai.ia_outputs só é alcançável via RPC.
        const feedbackRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/crm_ai_insert_ia_output_v2`, {
          method: 'POST',
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            p_marca_id: marcaId,
            p_tipo_canal: 'conceito',
            p_analisado: `Conceito de GIF gerado pelo agente (${pauta.marca}) — mecânica "${pauta.operacional?.mecanicaEscolhida ?? ''}"`,
            p_fontes: pauta.previsao?.casesReferencia ? { conteudosInspiradores: pauta.previsao.casesReferencia } : null,
            p_modelo: 'gpt-5.5',
            p_parametros: { pautaId: pauta.id, marca: pauta.marca },
            p_recomendacao_estruturada: { copy: pauta.copy, visual: pauta.visual, operacional: pauta.operacional, previsao: pauta.previsao, riscos: pauta.riscos },
            p_aprovado: aprovado,
            p_feedback_usuario: typeof motivo === 'string' && motivo.trim() ? motivo.trim() : null,
          }),
        });
        if (!feedbackRes.ok) return json({ error: 'Falha ao salvar feedback', details: await feedbackRes.text() }, 500);

        let testeAb: any = null;
        if (aprovado) {
          try {
            const candidatos = await loadConteudosGifAprendizado(env.SUPABASE_KEY);
            if (candidatos.length > 0) {
              const proposta = await generateAbTestProposal({ marca: pauta.marca, pautaAprovada: pauta, candidatosHistoricos: candidatos, token: env.GOGROUP_TOKEN });
              const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/teste_ab_propostas`, {
                method: 'POST',
                headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
                body: JSON.stringify({ marca: pauta.marca, pauta_id: pauta.id, variante_b_conteudo_id: proposta.conteudoId, racional: proposta.racional }),
              });
              if (insertRes.ok) {
                const inserted = await insertRes.json();
                testeAb = Array.isArray(inserted) ? inserted[0] : null;
              } else {
                console.error('[feedback-agente-gif] Falha ao salvar proposta de A/B:', await insertRes.text());
              }
            }
          } catch (err: any) {
            console.error('[feedback-agente-gif] Falha ao gerar proposta de A/B:', err.message);
          }
        } else {
          try {
            await runAgenteGifPipeline(env, typeof motivo === 'string' ? motivo : undefined);
          } catch (err: any) {
            console.error('[feedback-agente-gif] Falha na regeneração imediata:', err.message);
          }
        }

        return json({ success: true, testeAb });
      } catch (err: any) {
        return json({ error: err.message }, 500);
      }
    }

    if (url.pathname === '/api/teste-ab' && request.method === 'GET') {
      try {
        const data = await supabaseRestGet(
          `teste_ab_propostas?select=*,conteudos_links(nome_design,storage_url,insider_original_url,marca),teste_ab_envios(marca,insider_campaign_id,variante_a_gif_url,enviado_em)&order=created_at.desc`,
          SUPABASE_KEY,
        );
        return json({ status: 'success', data });
      } catch (err: any) {
        console.error('[teste-ab] Falha ao buscar propostas:', err.message);
        return json({ status: 'success', data: [] });
      }
    }

    // Usuário reprovou o conteúdo histórico escolhido pro teste A/B — busca um novo candidato,
    // excluindo os já rejeitados, e atualiza a mesma proposta (mantém status 'pendente').
    if (url.pathname === '/api/teste-ab-regenerar' && request.method === 'POST') {
      try {
        const { propostaId } = await request.json() as any;
        if (!propostaId) return json({ error: 'propostaId é obrigatório.' }, 400);

        const rows = await supabaseRestGet(`teste_ab_propostas?id=eq.${propostaId}&select=*`, SUPABASE_KEY);
        const proposta = Array.isArray(rows) ? rows[0] : null;
        if (!proposta) return json({ error: 'Proposta não encontrada.' }, 404);

        const pautaRows = await supabaseRestGet(`pautas_geradas?id=eq.${proposta.pauta_id}&select=marca,operacional`, SUPABASE_KEY);
        const pautaAprovada = Array.isArray(pautaRows) ? pautaRows[0] : null;
        if (!pautaAprovada) return json({ error: 'Pauta associada não encontrada.' }, 404);

        const excludeIds = [...(proposta.conteudos_rejeitados ?? []), proposta.variante_b_conteudo_id].filter(Boolean);
        const candidatos = await loadConteudosGifAprendizado(env.SUPABASE_KEY);
        const novaProposta = await generateAbTestProposal({
          marca: proposta.marca, pautaAprovada, candidatosHistoricos: candidatos, token: env.GOGROUP_TOKEN, excludeIds,
        });

        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/teste_ab_propostas?id=eq.${propostaId}`, {
          method: 'PATCH',
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify({
            variante_b_conteudo_id: novaProposta.conteudoId,
            racional: novaProposta.racional,
            conteudos_rejeitados: excludeIds,
            status: 'pendente',
          }),
        });
        if (!updateRes.ok) return json({ error: 'Falha ao atualizar proposta', details: await updateRes.text() }, 500);
        const updated = await updateRes.json();
        return json({ status: 'success', data: Array.isArray(updated) ? updated[0] : updated });
      } catch (err: any) {
        return json({ error: err.message }, 500);
      }
    }

    // Passo 3 do Modo C — cria a campanha A/B de verdade na Insider (tipo "experiment",
    // sempre como Draft). O GIF da Variante A já vem pronto (codificado e hospedado pelo
    // front, que tem acesso a canvas/gifshot — este worker não tem DOM pra gerar gif).
    if (url.pathname === '/api/teste-ab-enviar-insider' && request.method === 'POST') {
      try {
        const {
          propostaId, gifUrlVarianteA, destinoMarca: rawDestino,
          linkCampanha, assunto: assuntoOverride, nomeCampanha: nomeCampanhaOverride,
        } = await request.json() as any;
        if (!propostaId || !gifUrlVarianteA) {
          return json({ error: 'propostaId e gifUrlVarianteA são obrigatórios.' }, 400);
        }

        const rows = await supabaseRestGet(
          `teste_ab_propostas?id=eq.${propostaId}&select=*,conteudos_links(nome_design,storage_url,insider_original_url)`,
          SUPABASE_KEY,
        );
        const proposta = Array.isArray(rows) ? rows[0] : null;
        if (!proposta) return json({ error: 'Proposta não encontrada.' }, 404);
        if (proposta.status !== 'aceito') {
          return json({ error: 'Aprove a comparação (Variante B) antes de enviar pra Insider.' }, 400);
        }

        const pautaRows = await supabaseRestGet(`pautas_geradas?id=eq.${proposta.pauta_id}&select=*`, SUPABASE_KEY);
        const pauta = Array.isArray(pautaRows) ? pautaRows[0] : null;
        if (!pauta) return json({ error: 'Pauta associada não encontrada.' }, 404);

        // O conteúdo do agente não é mais amarrado a uma marca (v1: mecânicas genéricas) — a
        // conta de destino na Insider é escolhida por quem envia, independente da marca com que
        // a pauta foi salva (isso é só um rótulo interno de round-robin do agente).
        const destinoMarca: ContaInsider = (CONTAS_INSIDER as readonly string[]).includes(rawDestino) ? rawDestino : proposta.marca;

        const apiKey = getInsiderApiKey(destinoMarca, env);
        if (!apiKey) {
          return json({ error: `Chave da Insider para ${destinoMarca} não configurada (INSIDER_API_KEY_${destinoMarca.toUpperCase()}).` }, 400);
        }

        const varianteBUrl = proposta.conteudos_links?.storage_url || proposta.conteudos_links?.insider_original_url;
        if (!varianteBUrl) return json({ error: 'GIF histórico da Variante B indisponível.' }, 400);

        const copy = pauta.copy ?? {};
        const htmlA = buildInsiderVariationHtml({ imageUrl: gifUrlVarianteA, linkUrl: linkCampanha, marca: destinoMarca });
        const htmlB = buildInsiderVariationHtml({ imageUrl: varianteBUrl, linkUrl: linkCampanha, marca: destinoMarca });

        // Nome da campanha: regra da Insider exige alfanumérico com -_{espaço}, 5-40 caracteres —
        // sanitiza tanto o valor digitado pelo usuário quanto o fallback automático da mesma forma.
        const sanitizarNomeCampanha = (raw: string) => raw
          .normalize('NFD').replace(/[̀-ͯ]/g, '')
          .replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 40);
        const nomeDigitado = typeof nomeCampanhaOverride === 'string' ? sanitizarNomeCampanha(nomeCampanhaOverride) : '';
        const nomeAuto = sanitizarNomeCampanha(`agente ${destinoMarca} ${pauta.operacional?.mecanicaEscolhida ?? 'teste'}`);
        const nomeCampanha = nomeDigitado.length >= 5 ? nomeDigitado : (nomeAuto.length >= 5 ? nomeAuto : `agente ${destinoMarca} teste ab`);

        const assuntoFinal = (typeof assuntoOverride === 'string' && assuntoOverride.trim())
          ? assuntoOverride.trim()
          : (copy.assunto ?? nomeCampanha);

        const criada = await createInsiderExperimentCampaign({
          apiKey,
          name: nomeCampanha,
          tags: ['agente-gif'],
          variationA: { subject: assuntoFinal, preHeader: copy.preHeader ?? '', html: htmlA },
          variationB: { subject: assuntoFinal, preHeader: copy.preHeader ?? '', html: htmlB },
        });

        // Um envio por (proposta, marca de destino) — permite a mesma comparação ser mandada
        // pra várias contas Insider em vez de travar na primeira marca que recebeu o envio.
        const envioRes = await fetch(`${SUPABASE_URL}/rest/v1/teste_ab_envios?on_conflict=proposta_id,marca`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify({
            proposta_id: propostaId,
            marca: destinoMarca,
            insider_campaign_id: criada.id,
            variante_a_gif_url: gifUrlVarianteA,
          }),
        });
        if (!envioRes.ok) console.error('[teste-ab-enviar-insider] Falha ao salvar envio:', await envioRes.text());

        return json({ status: 'success', insiderCampaignId: criada.id });
      } catch (err: any) {
        return json({ error: err.message }, 500);
      }
    }

    // Rota de cron — registrar via createCronJob (GoDeploy chama esta rota no schedule, o
    // worker não se agenda sozinho). Gera no máximo 1 pauta por chamada, respeitando a cota
    // diária de 5 modo 'C' (passo 1 do agente) — o agendamento garante completar a cota.
    if (url.pathname === '/tasks/agente-gif-tick' && request.method === 'POST') {
      try {
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);
        const hoje = await supabaseRestGet(
          `pautas_geradas?select=id&modo=eq.C&data_criacao=gte.${startOfDay.toISOString()}`,
          SUPABASE_KEY,
        );
        const countHoje = Array.isArray(hoje) ? hoje.length : 0;
        if (countHoje >= 5) {
          return json({ status: 'ok', skipped: true, count: countHoje });
        }
        const pauta = await runAgenteGifPipeline(env);
        return json({ status: 'ok', generated: !!pauta, countBefore: countHoje });
      } catch (err: any) {
        return json({ error: err.message }, 500);
      }
    }

    return json({ error: 'Not found' }, 404);
  }
};