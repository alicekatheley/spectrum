import { Hono } from 'hono';
import { cors } from 'hono/cors';

const GEMINI_API_KEY = 'AIzaSyASv98we9Dbm0lPii2IWv0ECooBA2g7_FI';
const SUPABASE_URL   = 'https://krxuwejvkdkrjrppcwsw.supabase.co';
const SUPABASE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeHV3ZWp2a2RrcmpycHBjd3N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MDExOTAsImV4cCI6MjA5NDk3NzE5MH0.9hMIizKLPHHv6JTTLCF7RoMPvN0ZcQ3Ledz5HDXTvoM';
const PIAPP_API_KEY  = 'piapp_3ac8b05a78a971c5dd8a3b54672bdb8c3a91d7ad3af27fcf74502f0e14a54053';
const PIAPP_MCP_URL  = 'https://piapp-v2.vercel.app/api/ai/mcp';

const VALID_IMAGE_RATIOS = ['1:1', '3:4', '16:9', '9:16', '4:3'];
const VALID_IMAGE_MODELS = new Set(['wavespeed-gpt-image-2-t2i','gemini-3-pro-image-preview','gemini-3.1-flash-image-preview','gemini-2.5-flash-image','wavespeed-seedream-v5-lite']);
const DEFAULT_IMAGE_MODEL = 'wavespeed-gpt-image-2-t2i';
const COMPOSITION_VARIANTS = ['Composition: centered hero object, slight 3/4 angle view, premium product placement.','Composition: front-facing symmetrical layout, generous negative space top and bottom.','Composition: dynamic diagonal tilt, object angled 15–20 degrees, energetic feel.','Composition: top-down overhead view, clean flat-lay arrangement, editorial style.','Composition: slight low-angle upward view, object feels grand and imposing.'];
const LIGHTING_VARIANTS = ['Lighting: soft diffused studio light from above, gentle cast shadows below the object.','Lighting: warm golden ambient glow, subtle rim light outlining the object edges.','Lighting: clean cool white studio light, minimal shadows, crisp and modern.','Lighting: dramatic single-source spotlight from upper-left, bold shadow play.','Lighting: soft gradient ambient fill, delicate depth without harsh shadows.'];

const hardcodedDisparos = [
  { id: 'EMA-101', marca: 'Apice', mecanica: 'Abra o presente', disparos: 1, receitaMedia: 8767, performance: 'excelente', contextosRecomendados: ['lancamento','sazonal'] },
  { id: 'EMA-102', marca: 'Apice', mecanica: 'Abra a caixa', disparos: 3, receitaMedia: 6312, performance: 'hit', contextosRecomendados: ['recompra'] },
  { id: 'EMA-103', marca: 'Apice', mecanica: 'Abra a carta', disparos: 3, receitaMedia: 4711, performance: 'medio', contextosRecomendados: ['reativacao'] },
  { id: 'EMA-104', marca: 'Apice', mecanica: 'Puxe o Adesivo', disparos: 6, receitaMedia: 6348, performance: 'hit', contextosRecomendados: ['queima_estoque','datas_comemorativas'] },
  { id: 'EMA-105', marca: 'Apice', mecanica: 'Corte o fio', disparos: 5, receitaMedia: 6048, performance: 'hit', contextosRecomendados: ['lancamento'] },
  { id: 'EMA-106', marca: 'Apice', mecanica: 'Jogo da Velha', disparos: 3, receitaMedia: 6880, performance: 'hit', contextosRecomendados: ['datas_comemorativas','sazonal'] },
  { id: 'EMA-107', marca: 'Apice', mecanica: 'Rasgue o papel', disparos: 3, receitaMedia: 5508, performance: 'medio', contextosRecomendados: ['recompra'] },
  { id: 'EMA-108', marca: 'Apice', mecanica: 'Puxe o post-it', disparos: 3, receitaMedia: 4658, performance: 'medio', contextosRecomendados: ['reativacao'] },
  { id: 'EMA-109', marca: 'Apice', mecanica: 'Estoure o balão', disparos: 2, receitaMedia: 3854, performance: 'fraco', contextosRecomendados: ['queima_estoque'] },
  { id: 'EMA-110', marca: 'Apice', mecanica: 'Puxe o cupom', disparos: 1, receitaMedia: 2415, performance: 'aposentar', contextosRecomendados: ['sazonal'] },
  { id: 'EMA-201', marca: 'Barbours', mecanica: 'Abra o presente', disparos: 8, receitaMedia: 13295, performance: 'dominante', contextosRecomendados: ['lancamento','datas_comemorativas'] },
  { id: 'EMA-204', marca: 'Barbours', mecanica: 'Abra a caixa', disparos: 6, receitaMedia: 12691, performance: 'dominante', contextosRecomendados: ['recompra','sazonal'] },
  { id: 'EMA-205', marca: 'Barbours', mecanica: 'Abra a carta', disparos: 1, receitaMedia: 9658, performance: 'medio', contextosRecomendados: ['reativacao'] },
  { id: 'EMA-206', marca: 'Barbours', mecanica: 'Corte o fio', disparos: 2, receitaMedia: 11346, performance: 'hit', contextosRecomendados: ['lancamento','reativacao'] },
  { id: 'EMA-207', marca: 'Barbours', mecanica: 'Rasgue o papel', disparos: 1, receitaMedia: 6321, performance: 'incompativel', contextosRecomendados: ['queima_estoque'] },
  { id: 'EMA-208', marca: 'Barbours', mecanica: 'Estoure o balão', disparos: 1, receitaMedia: 19220, performance: 'outlier', contextosRecomendados: ['datas_comemorativas'] },
  { id: 'EMA-209', marca: 'Barbours', mecanica: 'Puxe o cupom', disparos: 2, receitaMedia: 12600, performance: 'hit', contextosRecomendados: ['sazonal'] },
];

const DEFAULT_MECANICAS = ['Abra o presente','Abra a caixa','Abra a carta','Puxe o Adesivo','Corte o fio','Jogo da Velha','Rasgue o papel','Puxe o post-it','Estoure o balão','Puxe o cupom'];

const BRAND_DNA: Record<string, any> = {
  Apice: { primaryColors: 'Forest Green #688D65 (dominant), Magenta #D553A5 (promo accent), Aqua #AAD4C7, Leaf Green #A4CA7A, Terracotta #B46D55, Off-White #F4F1E5', backgrounds: 'Clean off-white #F4F1E5 or soft aqua tint — always calm, airy, warm.', style: 'Clean 2D organic or soft 3D digital illustration, warm feminine mood, natural soft lighting', hitFormula: 'ONE large central mechanic object filling 50–70% of frame on clean off-white bg.', prohibitedColors: 'Avoid harsh neons and cold blues. Keep palette warm and organic.' },
  Barbours: { primaryColors: 'Ruby Red #BF0F26 (dominant), Gold #AA834B, Merlot #4F080E, Pink Blush #FFCCD5, Off-White #E7E3D8', backgrounds: 'Pastel pink #FFCCD5 (highest-converting), OR Off-White #E7E3D8, OR deep Merlot #4F080E.', style: 'Premium 3D illustrated luxury editorial style, dramatic studio lighting, sophisticated modern feminine', hitFormula: 'Dominant 3D central object in Ruby Red on pastel pink bg. Human hand creates interaction.', prohibitedColors: 'NEVER use green, orange, yellow or cold blue.' },
};

async function supabaseQuery(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation', ...(options.headers || {}) } });
  return res;
}

async function supabaseStorageUpload(bucket: string, path: string, data: Uint8Array, mimeType: string) {
  return fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, { method: 'POST', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': mimeType, 'x-upsert': 'true' }, body: data });
}

function supabaseStorageUrl(bucket: string, path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

async function callPiAppMCP(method: string, params: any): Promise<any> {
  const resp = await fetch(PIAPP_MCP_URL, { method: 'POST', headers: { 'Authorization': `Bearer ${PIAPP_API_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }) });
  const text = await resp.text();
  const dataLine = text.split('\n').find((l: string) => l.startsWith('data: '));
  if (!dataLine) throw new Error(`PiApp resposta inesperada: ${text.slice(0, 200)}`);
  return JSON.parse(dataLine.slice(6));
}

async function generateImageViaPiApp(prompt: string, aspectRatio: string, model: string, referenceImageUrls?: string[]) {
  const genArgs: Record<string, any> = { prompt, model, aspect_ratio: aspectRatio, quality: 'standard' };
  if (referenceImageUrls && referenceImageUrls.length > 0) genArgs.reference_image_urls = referenceImageUrls;
  const genResp = await callPiAppMCP('tools/call', { name: 'generate_image', arguments: genArgs });
  const genData = JSON.parse(genResp.result?.content?.[0]?.text ?? '{}');
  const jobId = genData.job_id;
  if (!jobId) throw new Error('PiApp não retornou job_id');
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const checkResp = await callPiAppMCP('tools/call', { name: 'check_jobs', arguments: { job_ids: [jobId] } });
    const checkData = JSON.parse(checkResp.result?.content?.[0]?.text ?? '{}');
    if (!checkData.all_done) continue;
    const job = checkData.jobs?.[0];
    if (!job || job.status === 'error') throw new Error(job?.error ?? 'Geração falhou no PiApp');
    const imgResp = await fetch(job.output_url);
    if (!imgResp.ok) throw new Error(`Falha ao baixar imagem: ${imgResp.status}`);
    const buffer = await imgResp.arrayBuffer();
    const mimeType = imgResp.headers.get('content-type') ?? 'image/png';
    const imageBytes = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return { imageBytes, mimeType };
  }
  throw new Error('Timeout: geração excedeu 90s');
}

async function uploadReferenceToPiApp(base64DataUrl: string): Promise<string> {
  const refResp = await callPiAppMCP('tools/call', { name: 'upload_reference', arguments: {} });
  const refData = JSON.parse(refResp.result?.content?.[0]?.text ?? '{}');
  const { upload_url, upload_token, public_url } = refData;
  if (!upload_url || !upload_token || !public_url) throw new Error('PiApp upload_reference sem URLs');
  const [header, base64Data] = base64DataUrl.split(',');
  const mimeType = header.replace('data:', '').replace(';base64', '');
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  await fetch(upload_url, { method: 'PUT', headers: { 'Content-Type': mimeType, 'Authorization': `Bearer ${upload_token}` }, body: bytes });
  return public_url;
}

function resolveEstiloDesign(estilo: string): string {
  const map: Record<string, string> = { '3D Realista': 'photorealistic 3D render, soft studio lighting, high detail', '3D Cartoon': '3D cartoon render, smooth surfaces, vibrant colors, playful style', '2D Cartoon': '2D flat cartoon illustration, bold outlines, clean shapes', 'Fotográfico': 'professional product photography, natural lighting, editorial style', 'Ilustrado': 'hand-crafted editorial illustration, artistic brush strokes', 'Minimalista': 'minimalist design, clean white space, simple geometric shapes', 'Aquarela': 'soft watercolor painting style, translucent washes', 'Neon/Bold': 'bold neon colors, high contrast, electric glow effects' };
  return map[estilo] ?? estilo;
}

function buildImagePrompt(params: any): string {
  const { frameName, frameDescription, marca, estiloIlustracao, paleta, mecanica, recompensa, aspectRatio, compVariant, lightVariant, headline, subheadline, direcionamento, frameMetadata } = params;
  const brandDna = BRAND_DNA[marca];
  if (!brandDna) throw new Error('marca inválida');
  const paletaCores = Array.isArray(paleta?.cores) && paleta.cores.length > 0 ? paleta.cores.join(', ') : brandDna.primaryColors.split(',').slice(0,2).join(',').trim();
  const styleDesc = estiloIlustracao ?? brandDna.style;
  const rewardPhrase = recompensa ? (frameName === 'final' ? ` Reward "${recompensa}" fully revealed.` : ' Reward hidden inside.') : '';
  const compositionBlock = direcionamento ? '' : `${compVariant} ${lightVariant}`;
  const isFirstFrame = frameName === 'frame_0' || frameName === 'inicial';
  const consistencyBlock = isFirstFrame ? `FRAME 1 — ESTABLISH FIXED LAYOUT: Lock background color, text style, button style for all frames. Hero object in MIDDLE only.` : `FRAME ${parseInt(frameName.replace('frame_',''))+1} — COPY MASTER FRAME: Match background, text, button EXACTLY. Only change: hero object state.${frameMetadata ? `\nBackground: ${frameMetadata.backgroundColor}. Button: ${frameMetadata.buttonWidth}x${frameMetadata.buttonHeight}px, ${frameMetadata.buttonBorderRadius}, color ${frameMetadata.buttonBackgroundColor}.` : ''}`;
  return [direcionamento ? `=== USER VISUAL DIRECTION (HIGHEST PRIORITY) ===\n"${direcionamento}"\nFollow literally for frame: ${frameName}` : '', `${styleDesc} illustration for ${marca} email campaign banner.`, `Hero: ${mecanica ?? 'mechanic object'}. Scene: ${frameDescription}.${rewardPhrase}`, `Palette: ${paletaCores}. Background: ${brandDna.backgrounds}. ${brandDna.prohibitedColors}`, headline ? `CAMPAIGN COPY (color harmony only — DO NOT render text): Headline: "${headline}" | Sub: "${subheadline}"` : '', compositionBlock, consistencyBlock, `COMPOSITION ZONES: TOP 30% empty (for text overlay). MIDDLE 50% hero object. BOTTOM 20% empty (for button overlay).`, `NO TEXT in image. Pure illustration. Ultra-detailed 4K. Aspect ratio: ${aspectRatio}.`].filter(Boolean).join('\n\n');
}

function buildPlaybook(marca: string): string {
  if (marca === 'Apice') return `=== PLAYBOOK ÁPICE ===\n- Foco: Cuidado capilar feminino, acolhedor, empoderamento.\n- Tom: Primeira pessoa, íntimo.\n- Paleta: Verde Floresta #688D65. Magenta #D553A5 (promo).\n- Mecânicas: MANIPULAÇÃO (puxar, cortar, jogar).\n- Assunto: 27-47 chars. Sem %, OFF, GRÁTIS, R$.`;
  return `=== PLAYBOOK BARBOURS ===\n- Foco: Luxo acessível, sofisticação, sensualidade moderna.\n- Tom: Direto, elegante, push-notification.\n- Paleta: Ruby Red #BF0F26 (dominante 2/3+), Gold #AA834B.\n- PROIBIDO: Verde, laranja, amarelo, azul.\n- Mecânicas: ABRIR (presente, caixa, carta).\n- Assunto: 16-39 chars.`;
}

function sanitizeAssunto(assunto: string, marca: string, existingRiscos: any[]) {
  let assuntoLimpo = assunto;
  if (assuntoLimpo === assuntoLimpo.toUpperCase() && assuntoLimpo.length > 5) assuntoLimpo = assuntoLimpo.charAt(0).toUpperCase() + assuntoLimpo.slice(1).toLowerCase();
  const forbidden = ['%','OFF','GRÁTIS','GRATIS','R$'];
  let containForbidden = false;
  forbidden.forEach(w => { if (assuntoLimpo.toUpperCase().includes(w)) { containForbidden = true; assuntoLimpo = assuntoLimpo.replace(new RegExp(w.replace('$','\\$'), 'gi'), ''); } });
  const riscos = [...existingRiscos];
  if (containForbidden) riscos.push({ campo:'assunto', nivel:'alto', mensagem:'Termos proibidos removidos do assunto.', alternativaSugerida:'Use gatilhos de curiosidade.' });
  return { assunto: assuntoLimpo.trim(), riscos };
}

function sanitizeBannerText(text: string) {
  const forbidden = ['%','OFF','GRÁTIS','GRATIS','R$'];
  let result = text;
  forbidden.forEach(w => { result = result.replace(new RegExp(w.replace('$','\\$'), 'gi'), ''); });
  return result.trim();
}

function risksUnique(arr: any[]) {
  const seen = new Set();
  return arr.filter(item => { const k = item.campo + item.mensagem; const d = seen.has(k); seen.add(k); return !d; });
}

async function generatePautaContent(params: any): Promise<any[]> {
  const { modo, input, marca, aspectRatio, tipoGeracao, direcStr, refImageData, mecanicasCatalog, estiloIlustracao } = params;
  const contextDb = hardcodedDisparos.filter((d: any) => d.marca === marca);
  const playbook = buildPlaybook(marca);
  const qtdFrames = typeof input.quantidadeFrames === 'number' ? Math.min(Math.max(input.quantidadeFrames, 2), 20) : 3;
  const modoPrompt = modo === 'A'
    ? `Gere ${input.quantidadePautas || 1} pauta(s) para ${marca}. Contexto: ${input.contextoCampanha || 'Geral'}. Segmento: ${input.segmentoAlvo || 'Principal'}. ${direcStr ? `Direcionamento: "${direcStr}"` : ''}`
    : `Modo B — Complete os boxes vazios e respeite os preenchidos LITERALMENTE.\nBoxes:\n- Assunto: "${input.boxTituloEmail || 'VAZIO'}"\n- Headline: "${input.boxHeadlineBanner || 'VAZIO'}"\n- Sub-headline: "${input.boxSubtituloEmail || 'VAZIO'}"\n- CTA: "${input.boxCta || 'VAZIO'}"\n- Mecânica: "${input.boxMecanicaOuEstatico || 'VAZIO'}"\n- Recompensa: "${input.boxRecompensa || 'VAZIO'}"\n${direcStr ? `\nDirecionamento obrigatório: "${direcStr}"` : ''}\n${estiloIlustracao ? `\nEstilo de design: "${estiloIlustracao}"` : ''}\nGere EXATAMENTE ${qtdFrames} frames no array.\nMecânicas disponíveis: ${mecanicasCatalog.join(', ')}`;
  const systemPrompt = `Você é agente de CRM especialista em email marketing para ${marca}. Gere pautas lucrativas baseadas no histórico.\n${playbook}\nREGRAS INVIOLÁVEIS: 1) Sem CAPS LOCK no assunto. 2) Sem %, OFF, GRÁTIS, R$. 3) Pré-header SEMPRE: "Mas, vou precisar cancelar em breve". 4) ${marca === 'Apice' ? '27-47' : '16-39'} chars no assunto.`;
  const userPrompt = `${modoPrompt}\n\nHistórico de disparos da marca:\n${JSON.stringify(contextDb, null, 2)}\n\nRetorne um array JSON com ${modo === 'A' ? input.quantidadePautas || 1 : 1} pauta(s).`;
  const contents = refImageData ? [{ role: 'user', parts: [{ text: userPrompt }, { inlineData: { mimeType: refImageData.mimeType, data: refImageData.data } }] }] : [{ role: 'user', parts: [{ text: userPrompt }] }];
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents, generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }, systemInstruction: { parts: [{ text: systemPrompt }] } }) });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(JSON.stringify(err)); }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

const app = new Hono();
app.use('*', cors({ origin: '*' }));

let _mecanicasCatalog: string[] = [...DEFAULT_MECANICAS];
let _crmAiLoaded = false;

async function ensureCrmAiLoaded() {
  if (_crmAiLoaded) return;
  try {
    const res = await supabaseQuery('mecanicas_catalog?select=nome&order=id');
    if (res.ok) { const data = await res.json(); if (data?.length) _mecanicasCatalog = data.map((r: any) => r.nome); }
    _crmAiLoaded = true;
  } catch { }
}

app.get('/api/historico', (c) => c.json({ status: 'success', data: hardcodedDisparos }));
app.get('/api/mecanicas', (c) => c.json({ status: 'success', data: _mecanicasCatalog }));

app.post('/api/generate-pauta', async (c) => {
  try {
    await ensureCrmAiLoaded();
    const body = await c.req.json();
    const { modo, input, aspectRatio: rawAspectRatio, direcionamentoIA, tipoGeracao: rawTipoGeracao, referenciaImagem } = body;
    let direcStr = typeof direcionamentoIA === 'string' ? direcionamentoIA.trim().replace(/[\r\n]+/g, ' ') : '';
    const injectionPattern = /\b(ignore|esqueça|não\s+siga|desconsidere)\b.{0,80}\b(regra|playbook|instrução)/gi;
    if (injectionPattern.test(direcStr)) direcStr = '[instrução removida por segurança]';
    let refImageData: { mimeType: string; data: string } | null = null;
    if (modo === 'B' && typeof referenciaImagem === 'string' && referenciaImagem.startsWith('data:')) {
      const [header, data] = referenciaImagem.split(',');
      const mimeType = header.replace('data:', '').replace(';base64', '');
      if (data && mimeType) refImageData = { mimeType, data };
    }
    if (!input?.marca) return c.json({ error: 'A marca é obrigatória.' }, 400);
    const aspectRatio = VALID_IMAGE_RATIOS.includes(rawAspectRatio) ? rawAspectRatio : '1:1';
    const tipoGeracao = ['texto','imagem','texto_imagem'].includes(rawTipoGeracao) ? rawTipoGeracao : 'texto_imagem';
    const { marca } = input;
    const estiloDesignUsuario = input.estiloDesign ? resolveEstiloDesign(input.estiloDesign) : undefined;
    const inputSemEstilo = { ...input };
    delete inputSemEstilo.estiloVisualTexto;
    let pautasProps = await generatePautaContent({ modo, input: inputSemEstilo, marca, aspectRatio, tipoGeracao, direcStr, refImageData, mecanicasCatalog: _mecanicasCatalog, estiloIlustracao: estiloDesignUsuario });
    pautasProps = pautasProps.map((p: any, index: number) => {
      p.copy.preHeader = 'Mas, vou precisar cancelar em breve';
      const { assunto: assuntoSanitizado, riscos: riscosFinais } = sanitizeAssunto(p.copy.assunto || '', marca, p.riscos || []);
      p.copy.assunto = assuntoSanitizado;
      p.copy.headlineBanner = sanitizeBannerText(p.copy.headlineBanner || '');
      p.copy.subHeadlineBanner = sanitizeBannerText(p.copy.subHeadlineBanner || '');
      return { id: `pauta-${Date.now()}-${index}`, marca, modo: modo === 'B' ? 'B' : 'A', tipoGeracao, copy: p.copy, visual: p.visual, operacional: p.operacional, previsao: p.previsao, riscos: risksUnique(riscosFinais), status: 'rascunho', dataCriacao: new Date().toISOString() };
    });
    for (const p of pautasProps) {
      const mec = p.operacional?.mecanicaEscolhida;
      if (mec && !_mecanicasCatalog.some((m: string) => m.toLowerCase() === mec.toLowerCase())) {
        _mecanicasCatalog.push(mec);
        supabaseQuery('mecanicas_catalog', { method: 'POST', body: JSON.stringify({ nome: mec, categoria: 'ia_gerada', criado_por: 'ia_auto' }) }).catch(() => {});
      }
    }
    return c.json({ status: 'success', data: pautasProps });
  } catch (err: any) {
    console.error('[generate-pauta] Erro:', err.message);
    return c.json({ error: 'Erro interno ao processar a geração.', details: err.message }, 500);
  }
});

app.post('/api/generate-image', async (c) => {
  try {
    const body = await c.req.json();
    const { frameName, frameDescription, aspectRatio: rawRatio, marca, pautaId, imageModel: rawModel, estiloIlustracao, estiloDesignUsuario, paleta, mecanica, recompensa, referenciaImagem: rawRefImage, headline, subheadline, cta, referenceFrameUrl, direcionamento, totalFrames } = body;
    if (!frameDescription) return c.json({ error: 'frameDescription é obrigatório.' }, 400);
    if (!BRAND_DNA[marca]) return c.json({ error: 'marca inválida.' }, 400);
    let aspectRatio = '1:1';
    if (typeof rawRatio === 'string' && rawRatio.startsWith('custom_')) {
      const [w, h] = rawRatio.replace('custom_', '').split('x').map(Number);
      if (w >= 100 && h >= 100) { const ratio = w / h; const opts = [{r:1,v:'1:1'},{r:0.75,v:'3:4'},{r:1.333,v:'4:3'},{r:1.778,v:'16:9'},{r:0.563,v:'9:16'}]; aspectRatio = opts.reduce((p, c) => Math.abs(c.r-ratio) < Math.abs(p.r-ratio) ? c : p).v; }
    } else if (VALID_IMAGE_RATIOS.includes(rawRatio)) aspectRatio = rawRatio;
    const imageModel = VALID_IMAGE_MODELS.has(rawModel) ? rawModel : DEFAULT_IMAGE_MODEL;
    const mechanicSeed = (mecanica || frameDescription || '').split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
    const compVariant = COMPOSITION_VARIANTS[mechanicSeed % COMPOSITION_VARIANTS.length];
    const lightVariant = LIGHTING_VARIANTS[mechanicSeed % LIGHTING_VARIANTS.length];
    const prompt = buildImagePrompt({ frameName, frameDescription, marca, estiloIlustracao: estiloDesignUsuario ? resolveEstiloDesign(estiloDesignUsuario) : estiloIlustracao, paleta, mecanica, recompensa, aspectRatio, compVariant, lightVariant, headline, subheadline, cta, direcionamento, totalFrames });
    const referenceImageUrls: string[] = [];
    if (typeof rawRefImage === 'string' && rawRefImage.startsWith('data:')) { try { referenceImageUrls.push(await uploadReferenceToPiApp(rawRefImage)); } catch {} }
    if (typeof referenceFrameUrl === 'string' && referenceFrameUrl.startsWith('data:')) { try { referenceImageUrls.push(await uploadReferenceToPiApp(referenceFrameUrl)); } catch {} }
    const result = await generateImageViaPiApp(prompt, aspectRatio, imageModel, referenceImageUrls.length > 0 ? referenceImageUrls : undefined);
    let publicUrl: string | null = null;
    if (typeof pautaId === 'string' && pautaId) {
      try {
        const safeMarca = marca.toLowerCase().replace(/[^a-z0-9]/g, '');
        const safeFrame = ((frameName as string) || 'frame').replace(/[^a-z0-9_]/g, '');
        const storagePath = `${safeMarca}/${pautaId}/${safeFrame}.png`;
        const binaryStr = atob(result.imageBytes);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        const uploadRes = await supabaseStorageUpload('campaign-images', storagePath, bytes, result.mimeType);
        if (uploadRes.ok) { publicUrl = supabaseStorageUrl('campaign-images', storagePath); }
      } catch (e: any) { console.warn('[generate-image] Storage:', e.message); }
    }
    return c.json({ imageBytes: result.imageBytes, mimeType: result.mimeType, publicUrl });
  } catch (err: any) {
    console.error('[generate-image] Erro:', err.message);
    return c.json({ error: 'Falha ao gerar imagem.', details: err.message }, 500);
  }
});

app.post('/api/parse-estilo-visual', async (c) => {
  try {
    const { estiloVisualTexto, marca } = await c.req.json();
    const defaults = { corTexto: '#FFFFFF', corSubheadline: 'rgba(255,255,255,0.90)', estiloBotao: 'pill', corBotao: marca === 'Apice' ? '#688D65' : '#BF0F26', corTextoBotao: '#FFFFFF', tamanhoHeadline: 'grande', pesoFonte: '900', familiaFonte: 'Georgia, serif' };
    if (!estiloVisualTexto) return c.json(defaults);
    return c.json(defaults);
  } catch { return c.json({ corTexto:'#FFFFFF', estiloBotao:'pill', corBotao:'#688D65', corTextoBotao:'#FFFFFF', tamanhoHeadline:'grande', pesoFonte:'900', familiaFonte:'Georgia, serif' }); }
});

app.post('/api/generate-variation', async (c) => {
  try {
    const { pauta } = await c.req.json();
    if (!pauta) return c.json({ error: 'Pauta obrigatória.' }, 400);
    const { marca, operacional, copy } = pauta;
    const isApice = marca === 'Apice';
    const prompt = `Gere uma variação de copy para:\nMarca: ${marca}\nMecânica: ${operacional.mecanicaEscolhida}\nAssunto atual: "${copy.assunto}"\nHeadline atual: "${copy.headlineBanner}"\nCTA atual: "${copy.ctaBotao}"\nRegras: sem CAPS LOCK, sem %, OFF, GRÁTIS, R$. Assunto ${isApice ? '27-47':'16-39'} chars.\nRetorne JSON: {"assunto":"","preHeader":"Mas, vou precisar cancelar em breve","headlineBanner":"","subHeadlineBanner":"","ctaBotao":""}`;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role:'user', parts:[{text:prompt}] }], generationConfig: { responseMimeType:'application/json' } }) });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    const parsedCopy = JSON.parse(text.replace(/```json|```/g,'').trim());
    parsedCopy.preHeader = 'Mas, vou precisar cancelar em breve';
    return c.json({ status:'success', data: parsedCopy });
  } catch (err: any) { return c.json({ error:'Erro ao gerar variação.', details: err.message }, 500); }
});

app.post('/api/save-frame', async (c) => {
  try {
    const { pautaId, frameName, imageDataUrl } = await c.req.json();
    if (!pautaId || !frameName || !imageDataUrl) return c.json({ error:'Campos obrigatórios faltando.' }, 400);
    const base64Data = imageDataUrl.split(',')[1];
    const mimeType = imageDataUrl.split(';')[0].split(':')[1] || 'image/png';
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    const fileName = `frames/${pautaId}/${frameName}.png`;
    const res = await supabaseStorageUpload('campaign-images', fileName, bytes, mimeType);
    if (!res.ok) return c.json({ error:'Upload falhou.' }, 500);
    return c.json({ publicUrl: supabaseStorageUrl('campaign-images', fileName) });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.post('/api/approve-pauta', async (c) => {
  try {
    const { pauta } = await c.req.json();
    if (!pauta?.id) return c.json({ error:'pauta inválida.' }, 400);
    const marcaId = pauta.marca === 'Apice' ? 1 : 2;
    const recomendacaoTexto = `ASSUNTO: ${pauta.copy?.assunto ?? ''}\nHEADLINE: ${pauta.copy?.headlineBanner ?? ''}\nCTA: ${pauta.copy?.ctaBotao ?? ''}\nMECÂNICA: ${pauta.operacional?.mecanicaEscolhida ?? ''}`;
    const res = await supabaseQuery('ia_outputs', { method: 'POST', headers: { 'Prefer':'return=representation', 'Content-Type':'application/json' }, body: JSON.stringify({ marca_id: marcaId, tipo_canal:'email', o_que_foi_analisado: `Pauta ${pauta.modo} aprovada`, modelo: 'gemini-2.5-flash', parametros: { modo: pauta.modo, tipoGeracao: pauta.tipoGeracao, pautaId: pauta.id }, recomendacao_texto: recomendacaoTexto, recomendacao_estruturada: { copy: pauta.copy, visual: pauta.visual, operacional: pauta.operacional }, aprovado: true }) });
    const data = await res.json();
    return c.json({ success:true, output_id: data?.[0]?.output_id });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

export default app;
