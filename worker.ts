const SUPABASE_URL = 'https://krxuwejvkdkrjrppcwsw.supabase.co';
const SUPABASE_KEY = (globalThis as any).SUPABASE_KEY || '';
const PIAPP_API_KEY = (globalThis as any).PIAPP_API_KEY || '';
const PIAPP_MCP_URL = 'https://piapp-v2.vercel.app/api/ai/mcp';

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

async function callGemini(prompt: string, systemPrompt: string): Promise<string> {
  const GOGROUP_TOKEN = (globalThis as any).GOGROUP_TOKEN || '';
  const res = await fetch('https://ai-proxy.gogroupbr.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GOGROUP_TOKEN}`,
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

async function callPiApp(method: string, params: any): Promise<any> {
  const resp = await fetch(PIAPP_MCP_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PIAPP_API_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params })
  });
  const text = await resp.text();
  const dataLine = text.split('\n').find((l: string) => l.startsWith('data: '));
  if (!dataLine) throw new Error('PiApp unexpected response');
  return JSON.parse(dataLine.slice(6));
}

async function generateImage(prompt: string, aspectRatio: string, model: string, refUrls?: string[]) {
  const genArgs: any = { prompt, model, aspect_ratio: aspectRatio, quality: 'standard' };
  if (refUrls?.length) genArgs.reference_image_urls = refUrls;
  const genResp = await callPiApp('tools/call', { name: 'generate_image', arguments: genArgs });
  const jobId = JSON.parse(genResp.result?.content?.[0]?.text ?? '{}').job_id;
  if (!jobId) throw new Error('No job_id from PiApp');
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const check = await callPiApp('tools/call', { name: 'check_jobs', arguments: { job_ids: [jobId] } });
    const checkData = JSON.parse(check.result?.content?.[0]?.text ?? '{}');
    if (!checkData.all_done) continue;
    const job = checkData.jobs?.[0];
    if (!job || job.status === 'error') throw new Error(job?.error ?? 'Generation failed');
    const imgResp = await fetch(job.output_url);
    const buffer = await imgResp.arrayBuffer();
    const imageBytes = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return { imageBytes, mimeType: imgResp.headers.get('content-type') ?? 'image/png' };
  }
  throw new Error('Timeout after 90s');
}

async function supabaseUpload(bucket: string, path: string, data: Uint8Array, mimeType: string) {
  return fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': mimeType, 'x-upsert': 'true' },
    body: data.buffer as ArrayBuffer
  });
}

function sanitize(text: string): string {
  return ['%','OFF','GRÁTIS','GRATIS','R$'].reduce((t, w) => t.replace(new RegExp(w.replace('$','\\$'), 'gi'), ''), text).trim();
}

function normalizePauta(p: any, marca: string, modo: string, tipoGeracao: string, index: number): any {
  return {
    id: `pauta-${Date.now()}-${index}`,
    marca,
    modo: modo === 'B' ? 'B' : 'A',
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
      frames: Array.isArray(p.visual?.frames) ? p.visual.frames : [],
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
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
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
        const qtdFrames = typeof input.quantidadeFrames === 'number' ? Math.min(Math.max(input.quantidadeFrames, 2), 20) : 3;
        const isApice = marca === 'Apice';
        const systemPrompt = `Você é agente de CRM especialista para ${marca}. REGRAS: sem CAPS LOCK, sem %, OFF, GRÁTIS, R$. Pré-header SEMPRE: "Mas, vou precisar cancelar em breve". Assunto ${isApice ? '27-47' : '16-39'} chars.`;
        const userPrompt = modo === 'A'
          ? `Gere ${input.quantidadePautas || 1} pauta(s) para ${marca}.
Contexto: ${input.contextoCampanha || 'Geral'}. Segmento: ${input.segmentoAlvo || 'Principal'}.
${direcionamentoIA ? `Direcionamento: "${direcionamentoIA}"` : ''}
Histórico: ${JSON.stringify(contextDb)}
Retorne array JSON com esta estrutura exata:
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
Gere EXATAMENTE ${qtdFrames} frames. Histórico: ${JSON.stringify(contextDb)}
Retorne array JSON com 1 pauta e esta estrutura exata:
[{
  "copy": { "assunto": "", "preHeader": "Mas, vou precisar cancelar em breve", "headlineBanner": "", "subHeadlineBanner": "", "ctaBotao": "" },
  "visual": { "formato": "", "paletaRecomendada": { "nome": "", "cores": [] }, "estiloIlustracao": "", "frames": [], "posicaoCta": "", "tipografia": "" },
  "operacional": { "mecanicaEscolhida": "", "justificativaMecanica": "", "recompensaEscolhida": "", "diaRecomendado": "", "horarioRecomendado": "", "segmentoRecomendado": "" },
  "previsao": { "aberturaEsperada": "", "ctorEsperado": "", "receitaEsperada": "", "casesReferencia": [], "confianca": "alta", "confiancaMotivo": "" },
  "riscos": []
}]`;

        const text = await callGemini(userPrompt, systemPrompt);
        const pautas = JSON.parse(text.replace(/```json|```/g, '').trim());
        const result = pautas.map((p: any, i: number) => normalizePauta(p, marca, modo, tipoGeracao, i));
        return json({ status: 'success', data: result });
      } catch (err: any) {
        return json({ error: 'Erro ao gerar pauta', details: err.message }, 500);
      }
    }

    if (url.pathname === '/api/generate-image' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const { frameName, frameDescription, aspectRatio = '1:1', marca, pautaId, imageModel = 'wavespeed-gpt-image-2-t2i', estiloIlustracao, paleta, mecanica, headline, subheadline, direcionamento } = body;
        if (!frameDescription) return json({ error: 'frameDescription obrigatório' }, 400);
        const brandDna = BRAND_DNA[marca];
        if (!brandDna) return json({ error: 'marca inválida' }, 400);
        const paletaCores = Array.isArray(paleta?.cores) && paleta.cores.length ? paleta.cores.join(', ') : brandDna.primaryColors;
        const prompt = [
          direcionamento ? `=== USER DIRECTION ===\n"${direcionamento}"\nFollow for frame: ${frameName}` : '',
          `${estiloIlustracao || brandDna.style} illustration for ${marca} email banner.`,
          `Hero: ${mecanica || 'mechanic'}. Scene: ${frameDescription}.`,
          `Palette: ${paletaCores}. Background: ${brandDna.backgrounds}. ${brandDna.prohibitedColors}`,
          headline ? `COPY (DO NOT render): "${headline}" | "${subheadline}"` : '',
          `ZONES: TOP 30% empty. MIDDLE 50% hero. BOTTOM 20% empty. NO TEXT. 4K. Ratio: ${aspectRatio}.`
        ].filter(Boolean).join('\n\n');

        const result = await generateImage(prompt, aspectRatio, imageModel);
        let publicUrl: string | null = null;
        if (pautaId) {
          try {
            const safeMarca = marca.toLowerCase().replace(/[^a-z0-9]/g, '');
            const safeFrame = (frameName || 'frame').replace(/[^a-z0-9_]/g, '');
            const binaryStr = atob(result.imageBytes);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
            const up = await supabaseUpload('campaign-images', `${safeMarca}/${pautaId}/${safeFrame}.png`, bytes, result.mimeType);
            if (up.ok) publicUrl = `${SUPABASE_URL}/storage/v1/object/public/campaign-images/${safeMarca}/${pautaId}/${safeFrame}.png`;
          } catch {}
        }
        return json({ imageBytes: result.imageBytes, mimeType: result.mimeType, publicUrl });
      } catch (err: any) {
        return json({ error: 'Erro ao gerar imagem', details: err.message }, 500);
      }
    }

    if (url.pathname === '/api/generate-variation' && request.method === 'POST') {
      try {
        const { pauta } = await request.json() as any;
        if (!pauta) return json({ error: 'pauta obrigatória' }, 400);
        const { marca, operacional, copy } = pauta;
        const prompt = `Variação de copy para ${marca}. Mecânica: ${operacional?.mecanicaEscolhida}. Assunto: "${copy?.assunto}". Headline: "${copy?.headlineBanner}". CTA: "${copy?.ctaBotao}". Regras: sem %, OFF, GRÁTIS, R$. Assunto ${marca === 'Apice' ? '27-47':'16-39'} chars. Retorne JSON: {"assunto":"","preHeader":"Mas, vou precisar cancelar em breve","headlineBanner":"","subHeadlineBanner":"","ctaBotao":""}`;
        const text = await callGemini(prompt, 'Retorne apenas JSON válido, sem markdown.');
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
        const res = await supabaseUpload('campaign-images', `frames/${pautaId}/${frameName}.png`, bytes, mimeType);
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
        const res = await fetch(`${SUPABASE_URL}/rest/v1/ia_outputs`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
          body: JSON.stringify({ marca_id: pauta.marca === 'Apice' ? 1 : 2, tipo_canal: 'email', o_que_foi_analisado: `Pauta ${pauta.modo} aprovada`, modelo: 'gemini-2.5-flash', parametros: { modo: pauta.modo, pautaId: pauta.id }, recomendacao_texto: `ASSUNTO: ${pauta.copy?.assunto}\nHEADLINE: ${pauta.copy?.headlineBanner}`, recomendacao_estruturada: { copy: pauta.copy, visual: pauta.visual, operacional: pauta.operacional }, aprovado: true })
        });
        const data = await res.json();
        return json({ success: true, output_id: data?.[0]?.output_id });
      } catch (err: any) {
        return json({ error: err.message }, 500);
      }
    }

    return json({ error: 'Not found' }, 404);
  }
};
