const SUPABASE_URL = 'https://krxuwejvkdkrjrppcwsw.supabase.co';
const PIAPP_MCP_URL = 'https://piapp-v2.vercel.app/api/ai/mcp';

interface Env {
  SUPABASE_KEY: string;
  SUPABASE_SERVICE_KEY: string;
  PIAPP_API_KEY: string;
  GOGROUP_TOKEN: string;
  // ─── BigQuery (contexto do modelo de calendário) ───────────────────────────
  // Cole o JSON inteiro da service account em GCP_SERVICE_ACCOUNT_JSON, ou use o
  // par email/chave. Sem isso a aba de calendário fica indisponível — de propósito,
  // ver a nota em `carregarContextoBq`.
  BIGQUERY_PROJECT_ID?: string;
  GCP_SERVICE_ACCOUNT_JSON?: string;
  GCP_SA_EMAIL?: string;
  GCP_SA_PRIVATE_KEY?: string;
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
    // Lista ampliada de propósito (era só "off-white ou aqua") — usada como FALLBACK quando o
    // conceito não propõe um fundo próprio (ver paleta.fundo em buildFramePrompt). Antes, esse
    // fallback era o único destino possível e enviesava todo o Modo C pro bege.
    backgrounds: 'Vary the background across concepts — do not default to off-white/beige. Rotate among: soft aqua tint #AAD4C7, deep forest green #3E5A3B, warm magenta blush #D553A5 tint, muted terracotta, or (occasionally) clean off-white #F4F1E5.',
    style: 'Clean 2D organic or soft 3D digital illustration, warm feminine mood',
    prohibitedColors: 'Avoid harsh neons and cold blues.',
  },
  Barbours: {
    primaryColors: 'Ruby Red #BF0F26, Gold #AA834B, Merlot #4F080E, Pink Blush #FFCCD5',
    backgrounds: 'Vary the background across concepts — do not default to off-white/beige. Rotate among: pastel pink #FFCCD5, deep Merlot #4F080E, ruby red #BF0F26 tint, warm gold #AA834B tint, or (occasionally) off-white #E7E3D8.',
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

async function callGemini(prompt: string, systemPrompt: string, token: string, temperature = 0.7): Promise<string> {
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
      temperature,
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

// ═════════════════════════════════════════════════════════════════════════════
// BigQuery via REST — o mesmo contexto que `server/bigquery.ts` carrega no boot
// do Express, mas sem nenhuma lib Node.
//
// POR QUE REESCREVER em vez de importar `server/bigquery.ts`: aquele módulo usa
// `@google-cloud/bigquery`, que depende de `fs`, `http2` e `gcp-metadata` para
// descobrir a credencial. Nada disso existe no runtime de Workers. Foi exatamente
// esse detalhe que deixou a aba de calendário funcionando em `npm run dev` e
// caindo no catálogo sintético em produção — o Express e o Worker são dois
// servidores diferentes, e só um deles tinha as rotas.
//
// O que substitui a lib: um JWT RS256 assinado com WebCrypto, trocado por um
// access token no oauth2.googleapis.com, usado contra a REST API do BigQuery.
//
// ARMADILHA DA REST API (verificada contra o dataset real, não suposta): ela
// devolve TODO valor como string, inclusive BOOLEAN e INTEGER. `ativo` vem como
// "true"/"false" — e `Boolean("false")` é `true`. TIMESTAMP vem como epoch em
// notação científica ("1.787586455298868E9"). O SDK Node tipa isso sozinho; aqui
// a coerção é manual e obrigatória. É o que fazem `bqBool`/`bqNum`/`bqTimestamp`.
// ═════════════════════════════════════════════════════════════════════════════

const BQ_SCOPE = 'https://www.googleapis.com/auth/bigquery.readonly';

function bqCredencial(env: Env): { email: string; chave: string; projeto: string } | null {
  if (env.GCP_SERVICE_ACCOUNT_JSON) {
    try {
      const sa = JSON.parse(env.GCP_SERVICE_ACCOUNT_JSON);
      if (sa.client_email && sa.private_key) {
        return {
          email: sa.client_email,
          chave: sa.private_key,
          projeto: env.BIGQUERY_PROJECT_ID || sa.project_id || 'gogroup-crm',
        };
      }
    } catch {
      console.error('[BigQuery] GCP_SERVICE_ACCOUNT_JSON não é JSON válido.');
      return null;
    }
  }
  if (env.GCP_SA_EMAIL && env.GCP_SA_PRIVATE_KEY) {
    return {
      email: env.GCP_SA_EMAIL,
      chave: env.GCP_SA_PRIVATE_KEY,
      projeto: env.BIGQUERY_PROJECT_ID || 'gogroup-crm',
    };
  }
  return null;
}

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemParaDer(pem: string): Uint8Array {
  // Secret de ambiente costuma chegar com "\n" literal em vez de quebra de linha.
  // Sem esta troca o atob abaixo falha com "invalid character" e o erro não diz
  // nada sobre a causa real, que é formatação do secret.
  const corpo = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(corpo);
  const der = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i);
  return der;
}

let _bqToken: { valor: string; expiraEm: number } | null = null;

async function bqAccessToken(env: Env): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  if (_bqToken && _bqToken.expiraEm > agora + 60) return _bqToken.valor;

  const cred = bqCredencial(env);
  if (!cred) throw new Error('credencial do BigQuery não configurada (GCP_SERVICE_ACCOUNT_JSON)');

  const texto = (o: any) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const cabecalho = texto({ alg: 'RS256', typ: 'JWT' });
  const claim = texto({
    iss: cred.email,
    scope: BQ_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    exp: agora + 3600,
    iat: agora,
  });

  const chave = await crypto.subtle.importKey(
    'pkcs8',
    pemParaDer(cred.chave) as unknown as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const assinatura = new Uint8Array(
    await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      chave,
      new TextEncoder().encode(`${cabecalho}.${claim}`),
    ),
  );

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${cabecalho}.${claim}.${b64url(assinatura)}`,
    }),
  });
  const j: any = await res.json();
  if (!res.ok) throw new Error(`OAuth ${res.status}: ${j.error_description ?? JSON.stringify(j)}`);
  _bqToken = { valor: j.access_token, expiraEm: agora + Number(j.expires_in ?? 3600) };
  return _bqToken.valor;
}

function bqLeValor(campo: any, v: any): any {
  if (v === null || v === undefined) return null;
  if (campo.mode === 'REPEATED') {
    return (v as any[]).map((x) => bqLeValor({ ...campo, mode: 'NULLABLE' }, x.v));
  }
  if (campo.type === 'RECORD' || campo.type === 'STRUCT') {
    const o: any = {};
    (campo.fields ?? []).forEach((f: any, i: number) => { o[f.name] = bqLeValor(f, v.f?.[i]?.v); });
    return o;
  }
  return v;
}

function bqMapear(schema: any, rows: any[]): any[] {
  const campos = schema?.fields ?? [];
  return (rows ?? []).map((r: any) => {
    const o: any = {};
    campos.forEach((f: any, i: number) => { o[f.name] = bqLeValor(f, r.f?.[i]?.v); });
    return o;
  });
}

async function bqConsultar(env: Env, sql: string): Promise<any[]> {
  const cred = bqCredencial(env)!;
  const token = await bqAccessToken(env);
  const base = `https://bigquery.googleapis.com/bigquery/v2/projects/${cred.projeto}`;

  const res = await fetch(`${base}/queries`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql, useLegacySql: false, timeoutMs: 60000, maxResults: 2000 }),
  });
  const j: any = await res.json();
  if (!res.ok) throw new Error(`BigQuery ${res.status}: ${j.error?.message ?? JSON.stringify(j)}`);
  if (!j.jobComplete) throw new Error('BigQuery: job não completou dentro do timeout');

  let linhas = bqMapear(j.schema, j.rows);

  // Paginação. Sem isto, um resultado maior que maxResults volta TRUNCADO e sem
  // erro nenhum — o catálogo simplesmente perderia ofertas e o plano continuaria
  // parecendo completo. É a classe exata de falha silenciosa que este módulo
  // existe para não repetir.
  let pageToken = j.pageToken;
  const jobId = j.jobReference?.jobId;
  const location = j.jobReference?.location;
  while (pageToken && jobId) {
    const q = new URLSearchParams({ pageToken, maxResults: '2000' });
    if (location) q.set('location', location);
    const r2 = await fetch(`${base}/queries/${jobId}?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j2: any = await r2.json();
    if (!r2.ok) throw new Error(`BigQuery página ${r2.status}: ${j2.error?.message ?? ''}`);
    linhas = linhas.concat(bqMapear(j2.schema ?? j.schema, j2.rows));
    pageToken = j2.pageToken;
  }
  return linhas;
}

// ─── Coerções (a REST API devolve tudo como string) ──────────────────────────
const bqNum = (v: any): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
const bqBool = (v: any): boolean => v === true || v === 'true';
const bqTimestamp = (v: any): string | null =>
  v === null || v === undefined ? null : new Date(Number(v) * 1000).toISOString();

const BQ_NOME_DOW: Record<string, number> = {
  domingo: 0, segunda: 1, terca: 2, terça: 2, quarta: 3,
  quinta: 4, sexta: 5, sabado: 6, sábado: 6,
};
const bqNomeParaDow = (nome: string) => BQ_NOME_DOW[String(nome).trim().toLowerCase()] ?? -1;

// ─── Contexto do modelo ──────────────────────────────────────────────────────
// Cache de isolate. O Express carrega no boot e guarda para sempre; um Worker não
// tem boot, então o custo se paga com TTL. As cinco queries são todas agregadas —
// nenhuma varre evento bruto — e o cache de resultado do próprio BigQuery torna a
// repetição barata.
const BQ_TTL_MS = 10 * 60 * 1000;
let _bqCtx: Record<string, any> | null = null;
let _bqCtxEm = 0;
let _bqCtxErro: string | null = null;

/**
 * Regra que este bloco impõe, igual à do Express: NÃO EXISTE FALLBACK PARA NÚMERO
 * INVENTADO. Se o BigQuery não responder, devolve null e quem chama diz isso na
 * tela. Um plano bonito com números fabricados é pior que tela vazia, porque é
 * indistinguível de um plano verdadeiro.
 */
async function carregarContextoBq(env: Env, forcar = false): Promise<Record<string, any> | null> {
  if (!forcar && _bqCtx && Date.now() - _bqCtxEm < BQ_TTL_MS) return _bqCtx;
  if (!bqCredencial(env)) {
    _bqCtxErro = 'credencial do BigQuery não configurada no ambiente do Worker';
    return null;
  }

  const projeto = bqCredencial(env)!.projeto;
  const DS = `${projeto}.crm_modelo`;

  try {
    const [configs, catalogo, indices, viabilidade, baseline, observadas] = await Promise.all([
      bqConsultar(env, `
        SELECT marca, ativo, janela_dias, burn_in_dias, janela_atribuicao_h,
               max_dias_com_3, dias_ativos, volume_maximo_semana, min_enviados_slot,
               max_oferta_semana, TO_JSON_STRING(grade_horarios) AS grade_json,
               data_min_evento
        FROM \`${DS}.marca_config\` WHERE ativo`),
      bqConsultar(env, `
        SELECT marca, familia, oferta, agressividade
        FROM \`${DS}.marca_oferta_familia\` ORDER BY marca, familia, oferta`),
      bqConsultar(env, `
        SELECT marca, indice, nivel, valor, valor_efetivo, peso_transferencia,
               ic80_lo, ic80_hi, n_observacoes,
               coef_transferencia, veredito, janela_ini, janela_fim,
               corte_walkforward, gerado_em
        FROM \`${DS}.v_indices_atuais\``),
      bqConsultar(env, `
        SELECT marca, dow, dias_observados, dias_1_oferta, dias_2_ofertas, dias_3_ofertas
        FROM \`${DS}.v_viabilidade\``),
      // Âncora de 4 semanas: RPM e volume MEDIDOS. A janela termina no último dia
      // com fato, não em CURRENT_DATE — senão um atraso de ingestão vira "a marca
      // parou de vender".
      bqConsultar(env, `
        WITH fim AS (SELECT marca, MAX(data) AS d FROM \`${DS}.fato_slot\` GROUP BY 1)
        SELECT f.marca, COUNT(DISTINCT f.data) AS dias, SUM(f.enviados) AS enviados,
               SUM(f.receita) AS receita,
               SAFE_DIVIDE(SUM(f.receita), SUM(f.enviados)) * 1000 AS rpm,
               MAX(fim.d) AS data_fim
        FROM \`${DS}.fato_slot\` f JOIN fim ON fim.marca = f.marca
        WHERE f.data > DATE_SUB(fim.d, INTERVAL 28 DAY) GROUP BY 1`),
      bqConsultar(env, `
        SELECT marca, oferta, familia, SUM(enviados) AS enviados
        FROM \`${DS}.fato_slot\` GROUP BY 1,2,3`),
    ]);

    const ctx: Record<string, any> = {};

    for (const c of configs) {
      const marca = String(c.marca).toLowerCase();
      const grade: number[][] = Array.from({ length: 7 }, () => [] as number[]);
      if (c.grade_json && c.grade_json !== 'null') {
        const bruto = JSON.parse(c.grade_json) as Record<string, number[]>;
        for (const [nome, horas] of Object.entries(bruto)) {
          const d = bqNomeParaDow(nome);
          if (d >= 0) grade[d] = [...horas].map(Number).sort((a, b) => a - b);
        }
      }
      ctx[marca] = {
        marca,
        config: {
          ativo: bqBool(c.ativo),
          janelaDias: bqNum(c.janela_dias) ?? 0,
          burnInDias: bqNum(c.burn_in_dias) ?? 0,
          janelaAtribuicaoH: bqNum(c.janela_atribuicao_h) ?? 0,
          maxDiasCom3: bqNum(c.max_dias_com_3),
          diasAtivos: ((c.dias_ativos as string[]) ?? [])
            .map(bqNomeParaDow).filter((d) => d >= 0).sort((a, b) => a - b),
          volumeMaximoSemana: bqNum(c.volume_maximo_semana),
          minEnviadosSlot: bqNum(c.min_enviados_slot),
          maxOfertaSemana: bqNum(c.max_oferta_semana),
          gradeHorarios: grade,
          dataMinEvento: c.data_min_evento ?? null,
        },
        catalogo: [] as any[],
        indices: {
          geradoEm: '', janelaIni: null, janelaFim: null, corteWalkforward: null,
          transferencia: {} as any,
          i1Dia: [] as any[], i2Gap: [] as any[], i3Hora: [] as any[], i4Oferta: [] as any[],
          alpha: null as number | null,
        },
        viabilidade: [] as any[],
        baseline: { dias: 0, enviados: 0, receita: 0, rpm: 0, volumeSemana: 0, dataFim: '' },
        cobertura: { enviadosTotal: 0, enviadosSemOferta: 0, shareSemOferta: 0, ofertasNuncaDisparadas: [] as string[] },
      };
    }

    for (const o of catalogo) {
      const m = ctx[String(o.marca).toLowerCase()];
      if (!m) continue;
      m.catalogo.push({
        oferta: String(o.oferta),
        familia: String(o.familia),
        agressividade: bqNum(o.agressividade) ?? 1,
      });
    }

    for (const i of indices) {
      const m = ctx[String(i.marca).toLowerCase()];
      if (!m) continue;
      const nivel = {
        nivel: i.nivel == null ? null : String(i.nivel),
        // `valor` é o índice CRU, mantido para diagnóstico. Quem planeja usa
        // `valorEfetivo` = valor^peso, já encolhido pela incerteza do walk-forward.
        // Ver sql/bigquery/peso_transferencia_e_corte_rolante.sql.
        valor: bqNum(i.valor) ?? 0,
        valorEfetivo: bqNum(i.valor_efetivo) ?? bqNum(i.valor) ?? 0,
        peso: bqNum(i.peso_transferencia),
        ic80Lo: bqNum(i.ic80_lo),
        ic80Hi: bqNum(i.ic80_hi),
        nObservacoes: bqNum(i.n_observacoes),
        veredito: i.veredito == null ? null : String(i.veredito),
      };
      m.indices.geradoEm = bqTimestamp(i.gerado_em) ?? m.indices.geradoEm;
      m.indices.janelaIni = i.janela_ini ?? m.indices.janelaIni;
      m.indices.janelaFim = i.janela_fim ?? m.indices.janelaFim;
      // O corte que ESTE snapshot usou. Rolante, então muda todo dia — a tela
      // precisa dele para saber se o período pedido cai perto da janela validada.
      m.indices.corteWalkforward = i.corte_walkforward ?? m.indices.corteWalkforward;
      m.indices.transferencia[String(i.indice)] = bqNum(i.coef_transferencia);
      switch (String(i.indice)) {
        case 'I1_dia': m.indices.i1Dia.push(nivel); break;
        case 'I2_familia': m.indices.i2Gap.push(nivel); break;
        case 'I3_hora': m.indices.i3Hora.push(nivel); break;
        case 'I4_oferta': m.indices.i4Oferta.push(nivel); break;
        case 'I6_alpha': m.indices.alpha = nivel.valor; break;
      }
    }

    for (const v of viabilidade) {
      const m = ctx[String(v.marca).toLowerCase()];
      if (!m) continue;
      // BigQuery EXTRACT(DAYOFWEEK) é 1=Domingo..7=Sábado; Date.getDay() é 0..6.
      // Converter na FRONTEIRA e nunca depois: um off-by-one aqui não quebra nada,
      // só desloca o calendário inteiro em um dia e continua parecendo plausível.
      m.viabilidade.push({
        dow: (bqNum(v.dow) ?? 1) - 1,
        diasObservados: bqNum(v.dias_observados) ?? 0,
        dias1Oferta: bqNum(v.dias_1_oferta) ?? 0,
        dias2Ofertas: bqNum(v.dias_2_ofertas) ?? 0,
        dias3Ofertas: bqNum(v.dias_3_ofertas) ?? 0,
      });
    }
    for (const m of Object.values(ctx)) m.viabilidade.sort((a: any, b: any) => a.dow - b.dow);

    for (const b of baseline) {
      const m = ctx[String(b.marca).toLowerCase()];
      if (!m) continue;
      const dias = bqNum(b.dias) ?? 0;
      const enviados = bqNum(b.enviados) ?? 0;
      m.baseline = {
        dias, enviados,
        receita: bqNum(b.receita) ?? 0,
        rpm: bqNum(b.rpm) ?? 0,
        volumeSemana: dias > 0 ? Math.round((enviados / dias) * 7) : 0,
        dataFim: b.data_fim ?? '',
      };
    }

    const vistas = new Map<string, Set<string>>();
    for (const o of observadas) {
      const marca = String(o.marca).toLowerCase();
      const m = ctx[marca];
      if (!m) continue;
      if (!vistas.has(marca)) vistas.set(marca, new Set());
      vistas.get(marca)!.add(String(o.oferta));
      const env_ = bqNum(o.enviados) ?? 0;
      m.cobertura.enviadosTotal += env_;
      // 'Sem Oferta'/'OUTROS' é o balde do que o CASE não reconheceu. Não é uma
      // família de verdade — é a medida do próprio desconhecimento.
      if (String(o.familia) === 'Sem Oferta' || String(o.oferta) === 'OUTROS') {
        m.cobertura.enviadosSemOferta += env_;
      }
    }
    for (const [marca, m] of Object.entries(ctx)) {
      const doMarca = vistas.get(marca) ?? new Set<string>();
      m.cobertura.shareSemOferta = m.cobertura.enviadosTotal > 0
        ? m.cobertura.enviadosSemOferta / m.cobertura.enviadosTotal
        : 0;
      m.cobertura.ofertasNuncaDisparadas = m.catalogo
        .map((o: any) => o.oferta)
        .filter((o: string) => o !== 'OUTROS' && !doMarca.has(o))
        .sort();
    }

    _bqCtx = ctx;
    _bqCtxEm = Date.now();
    _bqCtxErro = null;
    console.log(`[BigQuery] Contexto carregado: ${Object.keys(ctx).join(', ')}`);
    return ctx;
  } catch (err: any) {
    _bqCtxErro = err.message;
    console.error(`[BigQuery] FALHA ao carregar contexto: ${err.message}`);
    return null;
  }
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

// Prompt brand-agnostic pro edit de um frame externo (Modo D) — texto, cor OU troca de
// item/produto, tudo pela mesma instrução livre (o GIF de origem já vem com o texto "queimado"
// no pixel, então não existe overlay de texto separado como no Modo A/B/C: a mudança precisa
// acontecer na própria imagem). Quando há fotos de referência de produto, elas vêm ANTES da
// imagem a editar na lista de reference_image_urls — o texto precisa numerar nessa mesma ordem.
function buildEditPromptExterno(instrucao: string, productRefCount: number, hasFrameReference: boolean): string {
  const refNote = productRefCount > 0
    ? ` ${productRefCount} real product reference photo(s) are attached BEFORE the main image — when the instruction asks to replace/swap a product or item, extract ONLY the product itself from the reference photo(s) (same color, shape, texture, proportions, branding/logo). Completely ignore the reference photo's own background, lighting and setting — never let them bleed into the result. If the instruction ALSO asks for other changes (background color, text, etc.) besides the product swap, apply those too, following the instruction — the "ignore the reference photo's background" rule only stops the reference photo's OWN incidental background from leaking in, it does not block a background change the instruction explicitly asks for. The replacement product must occupy the EXACT SAME position, scale, rotation and crop framing as the original item it replaces — do not recenter, resize, rotate or reposition it, even if the reference photo shows it at a different angle or size.`
    : '';
  // Cada frame do GIF é editado numa chamada de IA independente — sem isso, o layout (zoom,
  // posição do texto, posição do produto) tende a "andar" de frame pra frame, quebrando a
  // continuidade da animação. Quando o front já editou um frame antes deste no mesmo lote, ele
  // manda o resultado como referência extra só pra travar layout/posição — não pro conteúdo.
  const frameRefNote = hasFrameReference
    ? ` Another reference image is attached right before the main image (after any product reference photos) — this is the ALREADY-EDITED version of a DIFFERENT frame from the SAME animated GIF, already showing the requested changes applied. Use it ONLY to match this frame's camera framing, zoom, crop, and — if you are changing text — the exact text position, size, font and style: copy those exactly from this reference. Do NOT copy its specific content if it differs from what belongs in this frame (e.g. a different pose/state of an animated element) — only its layout, framing and text style must match, not its content.`
    : '';
  const refNoteFull = `${refNote}${frameRefNote}`;
  const targetLabel = hasFrameReference
    ? ' The LAST attached image is the one being edited; every other attached image is a reference only, not the target of the edit.'
    : (productRefCount > 0 ? ' The LAST attached image is the one being edited; the ones before it are product references only, not the target of the edit.' : '');
  return `Edit the attached reference image exactly as instructed below. This includes changing text, colors, or swapping a specific item/product when requested — apply the change directly to the image pixels.${refNoteFull}${targetLabel}

CRITICAL — PIXEL-LEVEL CONSISTENCY: this image is one frame of an animated GIF made of several independently-edited frames — even a small shift in position, scale or crop becomes a visible jump/flicker when played back against the other frames. So:
- Camera framing, zoom, crop and composition must stay EXACTLY as in the original image — never re-crop, re-zoom, re-center or change perspective, even slightly.
- Any text you are asked to change must keep the EXACT SAME position, size, font, weight, color, alignment and line-wrapping box as the original text — change ONLY the wording, nothing about its placement or style.
- Every object you are NOT asked to change must stay at the EXACT SAME position, scale and orientation as in the original image — this includes the item being swapped, which occupies the same spot as what it replaces (see above).
- Preserve everything else — background, lighting, all other objects — pixel-for-pixel except for the specific change requested.

Instruction: "${instrucao.trim()}". Ultra-detailed quality, no added watermarks.`;
}

async function generateImage(prompt: string, aspectRatio: string, model: string, apiKey: string, refUrls?: string[]) {
  const genArgs: any = { prompt, model, aspect_ratio: aspectRatio, quality: 'standard' };
  if (refUrls?.length) genArgs.reference_image_urls = refUrls;
  const genResp = await callPiApp('tools/call', { name: 'generate_image', arguments: genArgs }, apiKey);
  const jobId = JSON.parse(genResp.result?.content?.[0]?.text ?? '{}').job_id;
  if (!jobId) throw new Error('No job_id from PiApp');
  // 90s (30x3s) era curto demais pra frames "edit" (2+, com imagem de referência) sob carga —
  // o job no PiApp segue rodando e termina minutos depois (visível no painel do PiApp como
  // concluído), mas a gente já tinha desistido e descartado o frame como falho. No Modo C isso
  // reproduzia como pauta 100% sem imagem (nenhum frame_urls) mesmo com 2 dos 3 frames prontos
  // no PiApp. 150s dá mais folga sem arriscar estourar o tempo de execução do worker (a maioria
  // das rodadas já levava minutos com os 3 frames em série).
  for (let i = 0; i < 50; i++) {
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
  throw new Error('Timeout after 150s');
}

// Versão "dispare e consulte depois" de generateImage — existe pro Modo D (editar frame externo)
// porque bloquear uma única requisição HTTP por até 150s pra um edit demorado do PiApp estourava
// o timeout do gateway do GoDeploy, que devolve uma página de erro HTML (não JSON) — o front
// então quebrava tentando fazer JSON.parse nela. Com isso, cada requisição do navegador fica
// rápida (só dispara ou só consulta status uma vez); quem espera é o cliente, com polling.
async function iniciarGeracaoImagem(prompt: string, aspectRatio: string, model: string, apiKey: string, refUrls?: string[]): Promise<string> {
  const genArgs: any = { prompt, model, aspect_ratio: aspectRatio, quality: 'standard' };
  if (refUrls?.length) genArgs.reference_image_urls = refUrls;
  const genResp = await callPiApp('tools/call', { name: 'generate_image', arguments: genArgs }, apiKey);
  const jobId = JSON.parse(genResp.result?.content?.[0]?.text ?? '{}').job_id;
  if (!jobId) throw new Error('No job_id from PiApp');
  return jobId;
}

type JobImagemStatus = { done: false } | { done: true; imageBytes: string; mimeType: string };

async function verificarJobImagem(jobId: string, apiKey: string): Promise<JobImagemStatus> {
  const check = await callPiApp('tools/call', { name: 'check_jobs', arguments: { job_ids: [jobId] } }, apiKey);
  const checkData = JSON.parse(check.result?.content?.[0]?.text ?? '{}');
  if (!checkData.all_done) return { done: false };
  const job = checkData.jobs?.[0];
  if (!job || job.status === 'error') throw new Error(job?.error ?? 'Generation failed');
  const imgResp = await fetch(job.output_url);
  const buffer = await imgResp.arrayBuffer();
  const uint8Array = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8Array.subarray(i, i + chunkSize));
  }
  const imageBytes = btoa(binary);
  return { done: true, imageBytes, mimeType: imgResp.headers.get('content-type') ?? 'image/png' };
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
  frameName, frameDescription, marca, brandDna, estiloIlustracao, paleta, composicao, mecanica, recompensa,
  headline, subheadline, direcionamento, aspectRatio, frameRefCount = 0, productRefCount = 0, totalFrames,
  ajusteRegeneracao,
}: {
  frameName?: string; frameDescription: string; marca: string; brandDna: any;
  estiloIlustracao?: string; paleta?: { cores?: string[]; fundo?: string }; composicao?: string; mecanica?: string; recompensa?: string;
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
  // Sem "photographic, not stylized" no fim: isso puxava todo estilo (flat, papercraft,
  // line-art) pro mesmo render 3D fotográfico. O estilo agora vem inteiro do conceito.
  const lightingRule = `Lighting: soft and even across the whole frame — a solid, flat background color with NO brightness falloff toward any edge (top, bottom, or sides must be exactly as exposed as the center, no darker and no brighter). No visible light rays, sunburst, lens flare, glow bursts, halo, bloom, backlight glare, or radiating beams of light anywhere in the image; no washed-out or overexposed patches. Render faithfully in the illustration style stated above.`;
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
      ? `Hero: ${mecanica || 'mechanic'}${frameState ? `, ${frameState}` : ''}. Scene (full establishing description — defines the fixed layout every later frame must match): ${frameDescription}.${composicao ? ` Composition: ${composicao}.` : ''}${rewardPhrase}`
      : `Hero: ${mecanica || 'mechanic'}${frameState ? `, ${frameState}` : ''}. ONLY THIS CHANGES vs the reference frame: ${frameDescription}. The change must be clearly visible even at thumbnail size — a real step in the action, not a subtle nudge.${rewardPhrase} Everything not mentioned here (background, secondary props, reward items not yet revealed) must remain pixel-identical to the reference image — do not re-imagine or reposition it.`,
    // O conceito pode propor seu próprio fundo (paleta.fundo, ex: o Agente do Modo C) — nesse
    // caso ele tem prioridade sobre o fallback genérico da marca, senão todo conceito cai no
    // mesmo "Background: ..." fixo e o resultado converge pro mesmo tom (bege/off-white).
    `Palette: ${paletaCores}.${direcionamento ? '' : ` Background: ${paleta?.fundo?.trim() || brandDna.backgrounds}.`} ${brandDna.prohibitedColors}`,
    consistencyBlock,
    // A headline/sub e o botão são desenhados por cima (composeFrame: texto até 32% da altura,
    // botão a partir de ~87%). No teste, a composição "close" pôs o herói em 20–37% da altura e
    // o texto ia cobrir justamente a revelação — por isso a zona é repetida como proibição.
    `LAYOUT (MANDATORY, every frame): the TOP 32% of the image is plain background only — no object, prop, hand, shadow or part of the hero may enter it, because the headline is placed there. The BOTTOM 16% is plain background only (a button goes there). The whole scene sits between 32% and 84% of the image height. ABSOLUTELY NO TEXT of any kind anywhere in the image — no letters, words, numbers, or symbols, even if they relate to this campaign. This is a pure background/product illustration; all copy is added separately afterward. 4K. Ratio: ${aspectRatio}.`
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
        fundo: String(p.visual?.paletaRecomendada?.fundo ?? ''),
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

// ─── Repertório criativo do agente (anti-repetição) ─────────────────────────
// POR QUE EXISTE: deixado solto, o modelo convergia pra um único conceito — caixa 3D com
// faixa/lingueta, fundo azul-marinho, "UM BRINDE SURPRESA ... ATÉ 23H59" — e o backlog de
// revisão virou 40 variações da mesma peça. Pedir "seja criativo" no prompt não resolve:
// LLM repete o que está nos exemplos do próprio prompt. O que resolve é tirar a decisão
// criativa do modelo: o código SORTEIA um brief (universo + estilo de render + fundo +
// composição + recompensa + formato de headline + urgência), excluindo o que saiu nas
// últimas pautas, e o modelo só executa esse brief. O brief sorteado fica salvo em
// visual.briefCriativo, que é o que a exclusão lê na rodada seguinte.
//
// Os eixos foram destilados das peças antigas que funcionaram (Espelho Mágico, Puxe o
// Cupom, Quebre o Gelo, Puxe o Adesivo, Finalize o Jogo, Alerta Presente, Balão Premiado):
// cada uma tem um UNIVERSO próprio (não "uma caixa com outra coisa pra puxar"), um estilo
// de render diferente e um fundo chapado de cor única.
type OpcaoBrief = { id: string; descricao: string };
type UniversoBrief = OpcaoBrief & { mecanica: string; revelacao: string };

const REPERTORIO_REFERENCIAS = `- "Espelho Mágico": espelho vintage ornamentado sobre pedestal, o prêmio aparece DESFOCADO no reflexo e a mecânica é desembaçar. Colagem (objeto fotográfico recortado) sobre verde chapado com grão. Headline em arco, serifada.
- "Puxe o Cupom": mão puxando um cupom de uma fenda de máquina. Ilustração flat vetorial sobre malva chapado com grão. Headline serifada dourada, CTA preto logo abaixo.
- "Quebre o Gelo": produto congelado dentro de um bloco de gelo, martelo entrando pela lateral. Foto realista sobre ciano chapado. Headline é expressão idiomática de duplo sentido.
- "Puxe o Adesivo": um único selo circular dourado com texto em círculo, sobre off-white. Design gráfico minimalista, muito respiro. Recompensa em combo (3 cupons + cashback).
- "Finalize o Jogo": tabuleiro isométrico com casas de desconto crescente, dados e peão. Monocromático rosa-pink. Mecânica de progressão/jogo.
- "Alerta Presente": caixa de presente clássica fotografada sobre branco puro. Headline de alerta em arco.
- "Balão Premiado": máquina de causa e efeito em 3D (polias, tesoura, balão, prego em mola) sobre cinza claro. Mecânica: cortar o fio dispara a reação em cadeia.`;

const UNIVERSOS_BRIEF: UniversoBrief[] = [
  { id: 'espelho-embacado', descricao: 'espelho mágico embaçado', mecanica: 'Desembace o espelho', revelacao: 'a névoa se dissipa e o prêmio aparece refletido' },
  { id: 'fenda-cupom', descricao: 'máquina com fenda de onde sai um ticket', mecanica: 'Puxe o ticket', revelacao: 'o ticket sai inteiro da fenda, brilhando' },
  { id: 'bloco-gelo', descricao: 'prêmio congelado dentro de um bloco de gelo', mecanica: 'Quebre o gelo', revelacao: 'o gelo racha e o prêmio fica livre' },
  { id: 'selo-circular', descricao: 'selo/adesivo circular grande colado numa superfície', mecanica: 'Descole o selo', revelacao: 'o selo levanta revelando o prêmio por baixo' },
  { id: 'tabuleiro', descricao: 'jogo de tabuleiro com peão e dados', mecanica: 'Avance as casas', revelacao: 'o peão chega à última casa, a do prêmio' },
  { id: 'causa-efeito', descricao: 'máquina de causa e efeito (polias, rampas, bolinhas)', mecanica: 'Corte o fio', revelacao: 'a reação em cadeia termina liberando o prêmio' },
  { id: 'cofre', descricao: 'cofre antigo com dial de segredo', mecanica: 'Gire o segredo', revelacao: 'a porta do cofre abre e o prêmio aparece dentro' },
  { id: 'garra', descricao: 'máquina de garra de fliperama', mecanica: 'Acione a garra', revelacao: 'a garra sobe segurando o prêmio' },
  { id: 'gumball', descricao: 'máquina de bolinhas de vidro com manivela', mecanica: 'Gire a manivela', revelacao: 'uma cápsula cai na saída e se abre com o prêmio' },
  { id: 'pinhata', descricao: 'piñata colorida pendurada', mecanica: 'Estoure a piñata', revelacao: 'a piñata se abre e o prêmio cai no centro' },
  { id: 'raspadinha', descricao: 'cartela de raspadinha com moeda', mecanica: 'Raspe a cartela', revelacao: 'a camada prateada sai e revela um símbolo dourado' },
  { id: 'cortina', descricao: 'mini palco de teatro com cortina de veludo fechada', mecanica: 'Abra a cortina', revelacao: 'a cortina abre e o prêmio está no holofote do palco' },
  { id: 'lupa', descricao: 'lupa sobre uma superfície com um detalhe escondido', mecanica: 'Passe a lupa', revelacao: 'sob a lente, o prêmio escondido fica nítido e grande' },
  { id: 'ampulheta', descricao: 'ampulheta grande com areia colorida', mecanica: 'Vire a ampulheta', revelacao: 'a areia escorre e descobre o prêmio no fundo' },
  { id: 'fechadura', descricao: 'porta pequena com fechadura e chave antiga', mecanica: 'Gire a chave', revelacao: 'a portinha abre mostrando o prêmio lá dentro' },
  { id: 'lacre-cera', descricao: 'carta com lacre de cera', mecanica: 'Rompa o lacre', revelacao: 'o lacre parte e a carta se desdobra com o prêmio' },
  { id: 'bolha', descricao: 'bolha de sabão gigante com o prêmio flutuando dentro', mecanica: 'Estoure a bolha', revelacao: 'a bolha estoura em gotas e o prêmio cai em primeiro plano' },
  { id: 'quebra-cabeca', descricao: 'quebra-cabeça quase completo com uma peça faltando', mecanica: 'Encaixe a última peça', revelacao: 'a peça encaixa e a imagem completa mostra o prêmio' },
  { id: 'interruptor', descricao: 'cena escura com um interruptor de luz', mecanica: 'Acenda a luz', revelacao: 'a luz acende e o prêmio estava ali o tempo todo' },
  { id: 'vending', descricao: 'máquina de venda automática retrô', mecanica: 'Aperte o botão', revelacao: 'o prêmio cai na bandeja de saída' },
  { id: 'cartas', descricao: 'três cartas viradas para baixo sobre uma mesa', mecanica: 'Vire a carta', revelacao: 'a carta do meio vira e é a premiada' },
  { id: 'elevador', descricao: 'porta de elevador fechada com botão iluminado', mecanica: 'Chame o elevador', revelacao: 'as portas abrem e o prêmio está dentro' },
  { id: 'broto', descricao: 'vaso de terra com um broto e um regador', mecanica: 'Regue a planta', revelacao: 'a planta cresce e desabrocha com o prêmio no centro' },
  { id: 'domino', descricao: 'fileira sinuosa de peças de dominó', mecanica: 'Empurre o primeiro dominó', revelacao: 'a última peça cai e revela o prêmio' },
  { id: 'globo-neve', descricao: 'globo de neve com uma forma escondida pela neve', mecanica: 'Sacuda o globo', revelacao: 'a neve assenta e o prêmio aparece dentro do globo' },
  { id: 'carimbo', descricao: 'passe/cartão de fidelidade com espaços vazios e um carimbo', mecanica: 'Carimbe o passe', revelacao: 'o último carimbo completa o cartão e libera o prêmio' },
  { id: 'pescaria', descricao: 'pescaria de festa com peixinhos e vara com anzol', mecanica: 'Fisgue o prêmio', revelacao: 'a vara sobe com o prêmio preso no anzol' },
  { id: 'foguete', descricao: 'foguete de brinquedo numa plataforma com pavio', mecanica: 'Acenda o pavio', revelacao: 'o foguete decola e o prêmio fica na plataforma, iluminado' },
];

// Objetos que saturaram o backlog de revisão — ficam proibidos até o backlog renovar.
const TERMOS_SATURADOS = ['lingueta', 'faixa', 'cinta', 'rotulo', 'tampa', 'luva', 'capa', 'bilhete'];

const ESTILOS_BRIEF: OpcaoBrief[] = [
  { id: 'flat-grao', descricao: 'Flat 2D vector illustration with a subtle risograph grain texture, bold simple shapes, limited palette, no gradients, no 3D' },
  { id: 'foto-still', descricao: 'Photorealistic still-life product photography, crisp studio shot, real materials and textures' },
  { id: 'colagem', descricao: 'Mixed-media collage: a photographic cut-out object placed on a flat solid-color set with paper grain, subtle cut-paper edges' },
  { id: 'clay-3d', descricao: 'Soft 3D render with matte clay / plastic-toy materials, rounded chunky shapes, playful and tactile' },
  { id: 'isometrico', descricao: 'Isometric 3D illustration, clean geometry, tonal monochrome palette built from the background color' },
  { id: 'grafico-minimal', descricao: 'Minimal graphic design: one bold flat object on a plain background, a lot of negative space, poster-like' },
  { id: 'papercraft', descricao: 'Layered papercraft diorama, paper cut-outs with soft real shadows between the layers' },
  { id: 'line-art', descricao: 'Editorial hand-drawn ink line art with flat color fills, slightly imperfect lines' },
  { id: 'retro-print', descricao: 'Retro 1960s-70s print illustration, halftone dots, warm offset-print colors, slight misregistration' },
];

const COMPOSICOES_BRIEF: OpcaoBrief[] = [
  { id: 'lateral', descricao: 'o herói entra pela lateral direita e é cortado pela borda do quadro' },
  { id: 'diagonal', descricao: 'o herói ocupa uma diagonal, do canto inferior esquerdo até o centro-direita' },
  { id: 'flat-lay', descricao: 'vista de cima (flat lay), elementos espalhados em grade solta' },
  { id: 'pedestal', descricao: 'herói pequeno sobre um pedestal/plataforma, com muito respiro ao redor' },
  { id: 'close', descricao: 'close no detalhe da interação (mão, dedo ou ferramenta agindo sobre o objeto), com a cena inteira contida da metade do quadro pra baixo' },
  { id: 'dialogo', descricao: 'dois elementos em diálogo: a ferramenta de um lado, o alvo do outro' },
  { id: 'central', descricao: 'herói grande, simétrico, levemente abaixo do centro' },
];

const FUNDOS_BRIEF: Record<string, OpcaoBrief[]> = {
  Apice: [
    { id: 'verde-floresta', descricao: 'verde-floresta #688D65 chapado com grão sutil' },
    { id: 'aqua', descricao: 'aqua #AAD4C7 chapado com grão sutil' },
    { id: 'magenta', descricao: 'magenta #D553A5 chapado' },
    { id: 'malva', descricao: 'malva #B57BA6 chapado com grão sutil' },
    { id: 'terracota', descricao: 'terracota #C8745A chapado' },
    { id: 'salvia', descricao: 'verde-sálvia claro #C9D8C0 chapado' },
    { id: 'manteiga', descricao: 'amarelo-manteiga #F2E3A6 chapado' },
    { id: 'verde-profundo', descricao: 'verde profundo #3E5A3B chapado' },
    { id: 'off-white', descricao: 'off-white #F4F1E5 chapado' },
  ],
  Barbours: [
    { id: 'blush', descricao: 'rosa blush #FFCCD5 chapado com grão sutil' },
    { id: 'merlot', descricao: 'merlot #4F080E chapado' },
    { id: 'rubi', descricao: 'vermelho rubi #BF0F26 chapado' },
    { id: 'dourado', descricao: 'dourado fosco #AA834B chapado' },
    { id: 'pink', descricao: 'pink vibrante #FF4FA3 chapado' },
    { id: 'nude', descricao: 'nude #E8C4B0 chapado com grão sutil' },
    { id: 'cinza-claro', descricao: 'cinza claro #EDEDED chapado' },
    { id: 'branco', descricao: 'branco puro, sem textura' },
    { id: 'off-white', descricao: 'off-white #E7E3D8 chapado' },
  ],
};

const RECOMPENSAS_BRIEF: OpcaoBrief[] = [
  { id: 'brinde-unico', descricao: '1 brinde surpresa no carrinho' },
  { id: 'tres-brindes-cupom', descricao: '(3) brindes + cupom extra em todo o site' },
  { id: 'maior-cupom', descricao: 'o maior cupom do ano, revelado só na interação' },
  { id: 'combo-cashback', descricao: 'combo inédito: cupons acumulados + cashback' },
  { id: 'progressivo', descricao: 'desconto progressivo: quanto mais avança, maior o cupom' },
  { id: 'frete-brinde', descricao: 'frete liberado + brinde' },
  { id: 'kit-misterioso', descricao: 'kit misterioso de brindes' },
  { id: 'cupom-dobro', descricao: 'cupom em dobro por tempo limitado' },
];

const HEADLINES_BRIEF: OpcaoBrief[] = [
  { id: 'verbo-objeto', descricao: 'verbo de ação + objeto do universo (ex. de forma, não de conteúdo: "VERBO O OBJETO")' },
  { id: 'titulo-narrativo', descricao: 'título de conceito, como o nome de uma atração, usando o nome da marca (ex. de forma: "O ___ da {marca}"). O único nome próprio permitido é "{marca}"' },
  { id: 'duplo-sentido', descricao: 'expressão idiomática de duplo sentido que conversa com o universo' },
  { id: 'alerta', descricao: 'chamada de alerta/anúncio curta, tom de notificação' },
  { id: 'desafio', descricao: 'desafio ou instrução de jogo (ex. de forma: "Termine o ___")' },
  { id: 'rotulo-premio', descricao: 'o universo + adjetivo de prêmio (ex. de forma: "___ premiado")' },
];

// Só urgências de TEMPO RELATIVO: "enquanto durar o estoque de brindes" saía combinada com
// recompensa de cupom ("cupom em dobro enquanto durar o estoque de brindes"), e "até domingo"
// virava "alerta de domingo" num disparo que o playbook agenda pra quarta.
const URGENCIAS_BRIEF = ['até 23h59', 'somente até 00h', 'só hoje', 'nas próximas horas', 'até amanhã de manhã', 'nas próximas 24 horas'];

type BriefCriativo = {
  universo: UniversoBrief; estilo: OpcaoBrief; fundo: OpcaoBrief; composicao: OpcaoBrief;
  recompensa: OpcaoBrief; headline: OpcaoBrief; urgencia: string;
};

// Sorteia evitando os ids usados nas últimas `janela` pautas. Se a exclusão esvaziar o eixo
// (histórico maior que o repertório), cai no eixo inteiro — repetir é melhor que travar.
function sortearEvitando<T>(opcoes: T[], idDe: (o: T) => string, usados: string[], janela: number): T {
  const recentes = new Set(usados.slice(0, janela));
  const livres = opcoes.filter((o) => !recentes.has(idDe(o)));
  const pool = livres.length > 0 ? livres : opcoes;
  return pool[Math.floor(Math.random() * pool.length)];
}

function sortearBriefCriativo(marca: string, recentes: any[]): BriefCriativo {
  const briefs = recentes.map((r) => r?.visual?.briefCriativo).filter(Boolean);
  const usados = (eixo: string) => briefs.map((b: any) => String(b?.[eixo] ?? ''));
  const fundos = FUNDOS_BRIEF[marca] ?? FUNDOS_BRIEF.Apice;
  return {
    universo: sortearEvitando(UNIVERSOS_BRIEF, (o) => o.id, usados('universo'), 20),
    estilo: sortearEvitando(ESTILOS_BRIEF, (o) => o.id, usados('estilo'), 4),
    fundo: sortearEvitando(fundos, (o) => o.id, usados('fundo'), 5),
    composicao: sortearEvitando(COMPOSICOES_BRIEF, (o) => o.id, usados('composicao'), 3),
    recompensa: sortearEvitando(RECOMPENSAS_BRIEF, (o) => o.id, usados('recompensa'), 3),
    headline: sortearEvitando(HEADLINES_BRIEF, (o) => o.id, usados('headline'), 2),
    urgencia: sortearEvitando(URGENCIAS_BRIEF, (o) => o, usados('urgencia'), 2),
  };
}

// Só os ids vão pro banco: é o que a exclusão da próxima rodada compara.
function briefParaRegistro(b: BriefCriativo) {
  return {
    universo: b.universo.id, estilo: b.estilo.id, fundo: b.fundo.id, composicao: b.composicao.id,
    recompensa: b.recompensa.id, headline: b.headline.id, urgencia: b.urgencia,
  };
}

// Cores que a marca proíbe (BRAND_DNA.prohibitedColors), em termos que o modelo usa na paleta e
// na descrição dos frames. No teste, a Ápice saiu com "azul-petróleo" — o prompt da imagem
// levava a proibição, mas a descrição da cena pedia o azul explicitamente e ganhava.
const CORES_PROIBIDAS: Record<string, string[]> = {
  Apice: ['azul', 'blue', 'neon', 'petroleo', 'turquesa', 'ciano', 'cyan', 'marinho', 'navy', 'cobalto'],
  Barbours: ['azul', 'blue', 'verde', 'green', 'laranja', 'orange', 'amarelo', 'yellow', 'petroleo', 'turquesa', 'ciano', 'cyan', 'marinho', 'navy', 'cobalto'],
};

// Hex azul frio (matiz 180°–260°, saturado) — pega "#1E3A8A" quando o nome da cor não vem junto.
function hexEhAzulFrio(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.15 || max !== b) return false;
  const h = (60 * ((r - g) / d + 4) + 360) % 360;
  return h >= 180 && h <= 260;
}

function coresProibidasUsadas(concept: any, marca: string): string[] {
  const termos = CORES_PROIBIDAS[marca] ?? [];
  const cores: string[] = Array.isArray(concept?.visual?.paletaRecomendada?.cores) ? concept.visual.paletaRecomendada.cores.map(String) : [];
  const frames: string[] = Array.isArray(concept?.visual?.frames) ? concept.visual.frames.map(String) : [];
  const texto = ` ${normalizarTexto([...cores, ...frames].join(' '))} `;
  const achados = termos.filter((t) => texto.includes(` ${t}`));
  for (const c of cores) for (const hex of c.match(/#[0-9a-f]{6}/gi) ?? []) if (hexEhAzulFrio(hex)) achados.push(hex);
  return [...new Set(achados)];
}

// Dia/horário do playbook (CLAUDE.md → "Two Brands, Two Playbooks"). O modelo inventava
// ("quinta 19h30") porque o prompt do agente nunca passou essa regra.
const AGENDA_PLAYBOOK: Record<string, { dia: string; horario: string }> = {
  Apice: { dia: 'Quarta-feira', horario: '8h30 às 9h30' },
  Barbours: { dia: 'Quarta-feira ou domingo', horario: '9h às 11h' },
};

const normalizarTexto = (s: unknown) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// Rede de segurança depois da geração: o brief já força variedade, mas o modelo às vezes
// "volta pra casa" (reescreve a mecânica como lingueta, copia uma headline recente).
function motivoRepeticao(concept: any, recentes: any[], marca?: string): string | null {
  if (marca) {
    const proibidas = coresProibidasUsadas(concept, marca);
    if (proibidas.length) return `usou cor proibida para a marca (${proibidas.join(', ')})`;
  }
  const headline = normalizarTexto(concept?.copy?.headlineBanner);
  const mecanica = normalizarTexto(concept?.operacional?.mecanicaEscolhida);
  const sub = normalizarTexto(concept?.copy?.subHeadlineBanner);
  const saturado = TERMOS_SATURADOS.find((t) => ` ${headline} ${mecanica} `.includes(` ${t} `));
  if (saturado) return `usou o objeto saturado "${saturado}"`;
  for (const r of recentes) {
    if (headline && headline === normalizarTexto(r?.copy?.headlineBanner)) return `repetiu a headline "${concept.copy.headlineBanner}" de uma pauta recente`;
    if (mecanica && mecanica === normalizarTexto(r?.operacional?.mecanicaEscolhida)) return `repetiu a mecânica "${concept.operacional.mecanicaEscolhida}" de uma pauta recente`;
    if (sub && sub === normalizarTexto(r?.copy?.subHeadlineBanner)) return 'repetiu literalmente o sub-headline de uma pauta recente';
  }
  return null;
}

async function loadConceitosRecentes(key: string): Promise<any[]> {
  try {
    // Todas as pautas do agente, não só as avaliadas: o backlog "aguardando revisão" é
    // justamente onde a repetição aparece, e ele nunca entrava no feedback.
    return await supabaseRestGet(
      `pautas_geradas?select=copy,visual,operacional&modo=eq.C&order=data_criacao.desc&limit=30`,
      key,
    );
  } catch (err: any) {
    console.error('[agente-gif] Falha ao carregar conceitos recentes:', err.message);
    return [];
  }
}

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
  brief: BriefCriativo; conceitosRecentes: any[]; motivoRejeicaoAnterior?: string; token: string;
}): Promise<any> {
  const { marca, conteudosAprendizado, feedbackAprovados, feedbackRejeitados, brief, conceitosRecentes, motivoRejeicaoAnterior, token } = params;
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
  // O backlog recente inteiro (avaliado ou não) — é a lista do que NÃO pode sair de novo.
  const recentesBlock = conceitosRecentes.length > 0
    ? conceitosRecentes.slice(0, 20).map((r: any, i: number) =>
        `${i + 1}. "${r?.copy?.headlineBanner ?? ''}" / "${r?.copy?.subHeadlineBanner ?? ''}" | mecânica: ${r?.operacional?.mecanicaEscolhida ?? '?'} | fundo: ${r?.visual?.paletaRecomendada?.fundo ?? '?'}`).join('\n')
    : 'Nenhuma pauta recente.';

  const systemPrompt = `Você é o Agente Autônomo de Criação de GIFs de CRM. Você recebe um BRIEF CRIATIVO já decidido (universo, estilo, fundo, composição, recompensa, formato de headline) e executa esse brief em UM conceito de GIF completo. Você não escolhe outro universo nem outro estilo: o brief existe exatamente porque, deixado livre, o agente sempre voltava pra mesma peça (caixa 3D com faixa/lingueta, fundo azul-marinho, "brinde surpresa até 23h59").

REGRAS INVIOLÁVEIS: sem CAPS LOCK no assunto, sem %, OFF, GRÁTIS, R$ em nenhum campo de copy, no máximo 2 emojis. Pré-header SEMPRE "Mas, vou precisar cancelar em breve". ${AGENTE_PLAYBOOK[marca] ?? ''}

⚠️ CONCEITO GENÉRICO, NÃO NICHADO: o conteúdo pode ser usado por qualquer marca do grupo. O UNIVERSO pode ser qualquer coisa (espelho, gelo, cofre, tabuleiro...), mas o PRÊMIO revelado é sempre genérico (embrulho, cupom, cápsula, brilho, pacote) — nunca um produto de nicho (cabelo, perfume, maquiagem, skincare).

PROIBIDO (saturado no backlog): ${TERMOS_SATURADOS.join(', ')}, caixa com faixa, e qualquer headline no molde "PUXE A ___ / UM BRINDE SURPRESA ... ATÉ 23H59".

REGRAS DE COPY (preencha todos com texto real, nunca string vazia):
- headlineBanner: siga o FORMATO DE HEADLINE do brief. Curta (até 5 palavras).
- subHeadlineBanner: expõe a recompensa do brief + a urgência do brief, em UMA frase corrida, sem travessão (—) nem hífen duplo. Não comece com "Um brinde surpresa" nem "Seu brinde".
- ctaBotao: 1 ou 2 palavras no imperativo, ligadas à mecânica do universo.
- assunto: dentro do limite de caracteres, desperta curiosidade sobre o universo, sem travessão.
- Nenhum campo de copy cita dia da semana (o dia do disparo é definido depois, pelo playbook).

NOMES PRÓPRIOS: o único nome próprio permitido em qualquer campo é "${marca}". Nunca invente nomes de personagem, lugar ou pessoa.

CORES: a paleta (visual.paletaRecomendada.cores, em HEX) e a descrição dos frames só usam tons que harmonizem com o FUNDO do brief. ${BRAND_DNA[marca]?.prohibitedColors ?? ''} Nunca cite essas cores proibidas, nem como detalhe.

Retorne visual.paletaRecomendada.fundo exatamente com o FUNDO do brief, visual.estiloIlustracao exatamente com o ESTILO do brief e operacional.mecanicaEscolhida exatamente com a MECÂNICA do brief (só o verbo + objeto, ex. "${brief.universo.mecanica}").`;

  const userPrompt = `=== BRIEF CRIATIVO DESTA RODADA (obrigatório) ===
UNIVERSO: ${brief.universo.descricao}
MECÂNICA: ${brief.universo.mecanica} — ${brief.universo.revelacao}
ESTILO DE RENDER: ${brief.estilo.descricao}
FUNDO: ${brief.fundo.descricao}
COMPOSIÇÃO: ${brief.composicao.descricao}
RECOMPENSA: ${brief.recompensa.descricao}
FORMATO DE HEADLINE: ${brief.headline.descricao.replace(/\{marca\}/g, marca)}
URGÊNCIA: ${brief.urgencia}

=== RÉGUA DE VARIEDADE: peças antigas que funcionaram ===
Cada uma é um universo diferente, com estilo e fundo próprios. É esse nível de diferença entre peças que se espera — não copie nenhuma.
${REPERTORIO_REFERENCIAS}

=== PAUTAS RECENTES DO AGENTE (não repita headline, sub-headline, mecânica nem fundo) ===
${recentesBlock}

GIFs analisados que já funcionaram (grounding de padrão de mecânica/composição, NÃO copie produto ou nicho):
${gifsBlock}

Conceitos já avaliados por humanos — aprovados (entenda o porquê, sem repetir a mecânica):
${aprovadosBlock}

Reprovados (NÃO proponha de novo, evite o motivo apontado):
${reprovadosBlock}
${motivoRejeicaoAnterior ? `\nEsta é uma regeneração imediata: o conceito anterior foi reprovado com o motivo "${motivoRejeicaoAnterior}". Gere um conceito claramente diferente que evite esse problema.\n` : ''}
Gere 1 conceito de GIF executando o brief, com EXATAMENTE 3 frames (inicial, intermediário, final), formato 1:1, e um racional (justificativaMecanica) que explique por que ESTE universo gera clique — o gatilho psicológico específico dele (curiosidade, conclusão, sorte, recompensa por esforço...), não um texto genérico sobre "interatividade". Em "previsao.casesReferencia" cite o(s) "nome_design" do grounding que mais se aproximam.
CONTINUIDADE VISUAL (OBRIGATÓRIO): frames[0] é a ÚNICA descrição completa da cena (objeto herói + props + cor + posição + fundo + composição do brief). frames[1] e frames[2] descrevem SOMENTE o delta do herói, sem redescrever o resto. Os frames são imagem pura: nenhum texto, número ou símbolo desenhado na cena.
ESPAÇO DO TEXTO (OBRIGATÓRIO): headline, sub-headline e botão são aplicados por cima da imagem, no terço de cima e no rodapé. Em frames[0], diga explicitamente que toda a cena (herói, props, sombras) fica entre um terço e quatro quintos da altura, com o topo e o rodapé só de fundo liso.
MOVIMENTO (OBRIGATÓRIO): frames[1] mostra uma mudança claramente visível em relação a frames[0] — o objeto já está pelo menos na metade da ação (meio aberto, meio caído, meio girado). Nunca um ajuste sutil que deixe os dois frames quase iguais.
SUSPENSE (OBRIGATÓRIO): o prêmio NÃO aparece nos frames[0] e [1], nem parcialmente: ele surge só em frames[2]. A revelação é mostrada pelo próprio objeto (abre, cai, acende, sai), nunca com raios de luz, explosão de brilho, halo ou raios gráficos ao redor.
Retorne APENAS um array JSON com 1 item, sem markdown, nesta estrutura exata:
[{
  "copy": { "assunto": "", "preHeader": "Mas, vou precisar cancelar em breve", "headlineBanner": "", "subHeadlineBanner": "", "ctaBotao": "" },
  "visual": { "formato": "GIF animado 3 frames", "paletaRecomendada": { "nome": "", "cores": [], "fundo": "" }, "estiloIlustracao": "", "frames": ["", "", ""], "posicaoCta": "", "tipografia": "" },
  "operacional": { "mecanicaEscolhida": "", "justificativaMecanica": "", "recompensaEscolhida": "", "diaRecomendado": "", "horarioRecomendado": "", "segmentoRecomendado": "" },
  "previsao": { "aberturaEsperada": "", "ctorEsperado": "", "receitaEsperada": "", "casesReferencia": [], "confianca": "baixa", "confiancaMotivo": "" },
  "riscos": []
}]`;

  const text = await callGemini(userPrompt, systemPrompt, token, 1);
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
// UTM vai dentro de cada variação como { utm: { source, medium, campaign } } — regra do time:
// source e medium são sempre "insider"/"newsletter", campaign é o nome da campanha (ver
// insiderUtm()).
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

// UTM da campanha: regra fixa do time — origem e mídia nunca mudam, só a campanha varia por
// envio. Vai dentro de cada variação (não no nível da campanha), como o endpoint espera.
function insiderUtm(campaign: string): { source: string; medium: string; campaign: string } {
  return { source: 'insider', medium: 'newsletter', campaign };
}

async function createInsiderExperimentCampaign(params: {
  apiKey: string; name: string; tags: string[]; variationA: { subject: string; preHeader: string; html: string };
  variationB: { subject: string; preHeader: string; html: string }; utmCampaign: string;
}): Promise<{ id: string; message: string }> {
  const { apiKey, name, tags, variationA, variationB, utmCampaign } = params;
  const toB64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
  const utm = insiderUtm(utmCampaign);
  const res = await fetch('https://mail.useinsider.com/content/v1/campaign/create', {
    method: 'POST',
    headers: { 'X-INS-AUTH-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name, tags, type: 'experiment',
      variations: [
        { subject: variationA.subject, pre_header: variationA.preHeader, html: toB64(variationA.html), utm },
        { subject: variationB.subject, pre_header: variationB.preHeader, html: toB64(variationB.html), utm },
      ],
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `Insider retornou ${res.status}`);
  return { id: String(data.id ?? ''), message: data.message ?? '' };
}

async function createInsiderSingleCampaign(params: {
  apiKey: string; name: string; tags: string[]; variation: { subject: string; preHeader: string; html: string };
  utmCampaign: string;
}): Promise<{ id: string; message: string }> {
  const { apiKey, name, tags, variation, utmCampaign } = params;
  const toB64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
  const utm = insiderUtm(utmCampaign);
  const res = await fetch('https://mail.useinsider.com/content/v1/campaign/create', {
    method: 'POST',
    headers: { 'X-INS-AUTH-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name, tags, type: 'single',
      variations: [
        { subject: variation.subject, pre_header: variation.preHeader, html: toB64(variation.html), utm },
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
  estiloIlustracao?: string; paleta?: any; composicao?: string; mecanica?: string; recompensa?: string;
  frameInicial: string; frameIntermediario: string; frameFinal: string;
  piappApiKey: string; supabaseServiceKey: string;
}): Promise<Record<string, string> | undefined> {
  const {
    marca, pautaId, brandDna, aspectRatio, estiloIlustracao, paleta, composicao, mecanica, recompensa,
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
      frameName, frameDescription, marca, brandDna, estiloIlustracao, paleta, composicao, mecanica, recompensa,
      aspectRatio, frameRefCount: masterFrameRefUrl ? 1 : 0, productRefCount: 0, totalFrames: frames.length,
    });
    // t2i não aceita imagem de referência — trocar pra edit a partir do frame que usa o
    // frame-mestre como referência (frames 2+).
    const imageModel = resolveImageModel('wavespeed-gpt-image-2-t2i', !!masterFrameRefUrl);
    try {
      // 1 nova tentativa por frame: no teste, o frame FINAL falhou no PiApp e a pauta foi salva
      // sem a revelação — um GIF sem desfecho, que é pior que um frame a mais de espera.
      let result: { imageBytes: string; mimeType: string } | undefined;
      for (let tentativa = 1; tentativa <= 2 && !result; tentativa++) {
        try {
          result = await generateImage(
            prompt, aspectRatio, imageModel, piappApiKey,
            masterFrameRefUrl ? [masterFrameRefUrl] : undefined,
          );
        } catch (err: any) {
          if (tentativa === 2) throw err;
          console.warn(`[agente-gif] Frame "${frameName}" falhou (${err.message}), tentando de novo.`);
        }
      }
      if (!result) throw new Error('sem resultado');
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
  // Chaves "frame_0"/"frame_1"/"frame_2" (não "inicial"/"final"...) pra casar com a convenção
  // que o GifViewer/reconstrução do front ordenam alfabeticamente = cronológica. O índice usado
  // na chave vem de um contador à parte, incrementado só em upload bem-sucedido — se usássemos
  // o índice do loop, uma falha de upload no primeiro frame gerado deixava "frame_0" sem valor
  // mesmo com frames 2 e 3 disponíveis, e o front (que só olha "frame_0") mostrava o card em branco.
  let nextIndex = 0;
  for (const { frameName, imageBytes, mimeType } of frameResults) {
    try {
      const { bytes } = dataUrlToBytes(`data:${mimeType};base64,${imageBytes}`);
      const up = await supabaseUpload('campaign-images', `${safeMarca}/${pautaId}/${frameName}.png`, bytes, mimeType, supabaseServiceKey);
      if (up.ok) {
        urls[`frame_${nextIndex}`] = `${SUPABASE_URL}/storage/v1/object/public/campaign-images/${safeMarca}/${pautaId}/${frameName}.png`;
        nextIndex++;
      }
    } catch (err: any) {
      console.error(`[agente-gif] Upload do frame ${frameName} falhou:`, err.message);
    }
  }
  return Object.keys(urls).length > 0 ? urls : undefined;
}

async function runAgenteGifPipeline(env: Env, motivoRejeicaoAnterior?: string): Promise<any | null> {
  try {
    const marca = Math.random() < 0.5 ? 'Apice' : 'Barbours';
    const [conteudosAprendizado, feedback, conceitosRecentes] = await Promise.all([
      loadConteudosGifAprendizado(env.SUPABASE_KEY),
      getFeedbackAgenteGif(env.SUPABASE_KEY),
      loadConceitosRecentes(env.SUPABASE_KEY),
    ]);

    // Até 2 tentativas: se a primeira sair repetida (objeto saturado, headline ou mecânica
    // idêntica a uma pauta recente), sorteia outro brief e gera de novo com o motivo explícito.
    let brief = sortearBriefCriativo(marca, conceitosRecentes);
    let concept: any = null;
    let motivo = motivoRejeicaoAnterior;
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      concept = await generateGifAgentConcept({
        marca, conteudosAprendizado,
        feedbackAprovados: feedback.aprovados, feedbackRejeitados: feedback.reprovados,
        brief, conceitosRecentes, motivoRejeicaoAnterior: motivo, token: env.GOGROUP_TOKEN,
      });
      const repeticao = motivoRepeticao(concept, conceitosRecentes, marca);
      if (!repeticao) break;
      console.warn(`[agente-gif] Conceito repetido (${repeticao}), tentativa ${tentativa + 1}.`);
      if (tentativa === 0) {
        brief = sortearBriefCriativo(marca, [{ visual: { briefCriativo: briefParaRegistro(brief) } }, ...conceitosRecentes]);
        motivo = `o conceito anterior ${repeticao}`;
      }
    }

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
    // Fundo e estilo vêm do brief, não do texto do modelo: é o modelo "reinterpretando" o
    // fundo que fazia tudo convergir pro mesmo azul-marinho.
    pauta.visual.paletaRecomendada.fundo = brief.fundo.descricao;
    pauta.visual.estiloIlustracao = brief.estilo.descricao;
    pauta.visual.briefCriativo = briefParaRegistro(brief);
    // Mecânica curta vinda do brief: o modelo devolvia uma frase inteira ("Acender o pavio para
    // disparar a decolagem..."), que poluía o card e nunca batia na checagem de repetição.
    pauta.operacional.mecanicaEscolhida = brief.universo.mecanica;
    const agenda = AGENDA_PLAYBOOK[marca];
    if (agenda) {
      pauta.operacional.diaRecomendado = agenda.dia;
      pauta.operacional.horarioRecomendado = agenda.horario;
    }

    const brandDna = BRAND_DNA[marca];
    const frames: string[] = pauta.visual?.frames ?? [];
    let frameUrls: Record<string, string> | undefined;
    if (env.PIAPP_API_KEY && frames.length >= 2 && brandDna) {
      try {
        frameUrls = await generateGifFramesForAgente({
          marca, pautaId: pauta.id, brandDna, aspectRatio: '1:1',
          estiloIlustracao: pauta.visual?.estiloIlustracao,
          paleta: pauta.visual?.paletaRecomendada,
          composicao: brief.composicao.descricao,
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

// ═════════════════════════════════════════════════════════════════════════════
// Leitura assistida do calendário. A IA recebe um plano PRONTO e o explica — ela
// não gera, não realoca e não estima. Se um dia esta rota devolver números novos,
// o erro estará aqui e não no prompt: o payload de entrada já contém todos os
// números que a resposta pode citar.
// ═════════════════════════════════════════════════════════════════════════════

function instrucaoCalendario(catalogoReal: boolean): string {
  return `Você é analista de CRM do Grupo GoBeaute e está lendo um calendário de disparos que JÁ FOI GERADO por um modelo estatístico determinístico.

REGRA ABSOLUTA E INEGOCIÁVEL: você NUNCA calcula, estima, projeta ou inventa um número. Todo número que você escrever tem de estar literalmente presente no JSON do calendário que recebeu. Se alguém perguntar algo que exija um número que não está lá, responda que o modelo não emite esse número e diga qual decisão do modelo chega mais perto. Nunca some, multiplique ou faça média de valores do payload para produzir um número novo.

O que você faz: explica POR QUE o plano é como é, usando o que o payload declara — os índices de cada slot, as restrições aplicadas e relaxadas, os avisos, a decomposição por alavanca e a fronteira receita × eficiência.

Contexto do modelo que você precisa dominar para explicar bem:
- SLOT = (marca, data, hora, oferta). Um dia tem 2 ou 3 slots.
- FAMÍLIA é a unidade de fadiga. O rodízio entre famílias é a alavanca #2 (coeficiente 0,52).
- I1 (dia da semana) é a alavanca #1, coeficiente 0,90. Quarta é historicamente o dia mais forte.
- Hora (I3) e oferta (I4) transferiram a 0,00 na validação fora da amostra: o modelo NÃO tem evidência de que um horário ou uma oferta específica renda mais que outro. Quando perguntarem "por que esse horário?", a resposta honesta é que o horário vem da grade operacional e do espaçamento entre disparos, NÃO de um ganho medido. Nunca invente uma justificativa de performance para horário ou oferta.
- Elasticidade de volume α = 0,31: receita ∝ V^0,31 e R$/mil ∝ V^-0,69. Mais volume sempre traz mais receita e sempre custa eficiência.
- O 3º disparo do dia não sobreviveu à validação — é hipótese, não compromisso.
- H1 (teto semanal de dias com 3 ofertas), H2 (nunca duas famílias iguais no mesmo dia), H3 (célula sem suporte histórico é bloqueada), H5 (dias inativos da marca) são restrições rígidas.

${catalogoReal
    ? `CATÁLOGO REAL: as ofertas e famílias deste plano vêm do histórico da marca (dataset crm_modelo), não são posições vazias. Pode citá-las pelo nome. O que continua fora do que o modelo mede: se a oferta "combina" com a data, com a estação ou com o público — nada disso foi estimado. O plano decide POSIÇÕES (qual dia, qual hora, qual família) a partir de fadiga e de índice por dia; a adequação comercial da oferta continua sendo julgamento de quem executa. Fluxos automatizados (carrinho abandonado, recompra, expresso) foram excluídos do catálogo porque não são agendáveis — se perguntarem por eles, diga isso e diga também o custo: a pressão que eles exercem na caixa de entrada não entra no modelo de fadiga.`
    : `CATÁLOGO SINTÉTICO: enquanto as ofertas vierem nomeadas como "Oferta A1", "Oferta B2" e as famílias como "Família A", "Família B", elas são posições vazias — não são o catálogo real da marca. Nunca atribua significado comercial a esses nomes, nunca deduza o que a oferta seria, nunca comente se ela combina com a data ou com o público. Fale delas como o que são: a 1ª família, a 2ª família, o rodízio entre elas. Se o usuário perguntar sobre o conteúdo de uma oferta, diga que o catálogo real ainda não foi conectado e que o plano decide POSIÇÕES (qual dia, qual hora, qual família), não qual produto entra em cada posição — essa escolha continua sendo de quem executa.`}

Tom: direto, técnico, em português do Brasil, sem emoji, sem bullet decorativo, sem elogiar o plano. Escreva como quem apresenta um plano para quem vai executá-lo e cobrar resultado. Prefira frases curtas. Quando o payload declarar uma restrição relaxada ou um aviso, mencione — é o tipo de coisa que quem executa precisa saber e ninguém lê no rodapé.`;
}

/** Resumo compacto do calendário. Slot a slot cabe em ~90 linhas; acima disso, agrega por dia. */
function resumirCalendario(cal: any): string {
  const slots: any[] = cal.slots ?? [];
  const porDia = new Map<string, any[]>();
  for (const s of slots) porDia.set(s.data, [...(porDia.get(s.data) ?? []), s]);

  const detalhado = porDia.size <= 31;
  const grade = detalhado
    ? [...porDia.entries()]
        .map(([data, doDia]) =>
          `${data} (${doDia[0].diaSemana}, I1=${doDia[0].indices.dia}): ` +
          doDia.sort((a, b) => a.hora - b.hora)
            .map((s) =>
              `${String(s.hora).padStart(2, '0')}h "${s.oferta}" [família ${s.familia}, I2=${s.indices.familia}, agr ${s.agressividade}, gap ${s.gapFamiliaH}h, ${s.enviosPlanejados} envios, R$ ${s.receitaPrevista}, ${s.rpmPrevisto} R$/mil${s.confianca?.validado ? '' : ', NÃO VALIDADO'}${s.editado ? ', EDITADO À MÃO' : ''}]`)
            .join(' | '))
        .join('\n')
    : [...porDia.entries()]
        .map(([data, doDia]) =>
          `${data} (${doDia[0].diaSemana}): ${doDia.length} disparos, famílias ${doDia.map((s) => s.familia).join('/')}, ${doDia.reduce((a, s) => a + s.enviosPlanejados, 0)} envios, R$ ${doDia.reduce((a, s) => a + s.receitaPrevista, 0)}`)
        .join('\n');

  return `MARCA: ${cal.marca}
PERÍODO: ${cal.periodo?.inicio} a ${cal.periodo?.fim} (${porDia.size} dias ativos, ${slots.length} disparos)
MODO: ${cal.modo === 'eficiencia' ? 'eficiência (R$/mil)' : 'receita máxima'}
META DECLARADA: ${cal.meta ? `${cal.meta.tipo} = ${cal.meta.valor}` : 'nenhuma (metas são opcionais neste modelo)'}
PROCEDÊNCIA DOS DADOS: ${cal.procedencia === 'dados' ? 'catálogo e índices medidos no histórico (BigQuery)' : cal.procedencia === 'ditado' ? 'parâmetros ditados à mão' : 'catálogo sintético (posições vazias)'}
${cal.editadoManualmente ? 'ATENÇÃO: este calendário foi editado à mão depois de gerado. Slots marcados EDITADO À MÃO não são proposta do modelo.\n' : ''}
PREVISÃO:
- ritmo de hoje (sem modelo): R$ ${cal.previsao?.ritmoDeHoje}
- plano validado: R$ ${cal.previsao?.validado} (${cal.previsao?.ganhoValidadoPct}% sobre o ritmo de hoje)
- in-sample (NÃO USAR, existe só para expor o viés): R$ ${cal.previsao?.inSampleNaoUsar}

DECOMPOSIÇÃO POR ALAVANCA:
${(cal.decomposicao ?? []).map((e: any) => `- ${e.etapa}: R$ ${e.receita} (${e.ganhoPct >= 0 ? '+' : ''}${e.ganhoPct}%)${e.validado ? '' : ' — não validado, ganho creditado 0,00'}`).join('\n')}

FRONTEIRA RECEITA × EFICIÊNCIA:
${(cal.fronteira ?? []).map((p: any) => `- volume ${p.deltaVolumePct >= 0 ? '+' : ''}${p.deltaVolumePct}%: R$ ${p.receita}, ${p.rpm} R$/mil`).join('\n')}

RESTRIÇÕES APLICADAS:
${(cal.restricoesAplicadas ?? []).map((r: string) => `- ${r}`).join('\n') || '- nenhuma'}

RESTRIÇÕES RELAXADAS (cederam durante a geração):
${(cal.restricoesRelaxadas ?? []).map((r: string) => `- ${r}`).join('\n') || '- nenhuma'}

AVISOS DO MODELO:
${(cal.avisos ?? []).map((a: string) => `- ${a}`).join('\n') || '- nenhum'}

GRADE${detalhado ? '' : ' (agregada por dia — o período é longo demais para slot a slot)'}:
${grade}`;
}

async function explicarCalendario(
  params: { calendario: any; pergunta?: string; eventosEspeciais?: string },
  token: string,
): Promise<string> {
  const { calendario, pergunta, eventosEspeciais } = params;
  const dias = new Set((calendario.slots ?? []).map((s: any) => s.data)).size;

  // Períodos longos pedem síntese, não narração dia a dia. Trinta parágrafos
  // descrevendo trinta quartas-feiras não é leitura assistida, é o calendário
  // outra vez em prosa.
  const formato = pergunta
    ? `PERGUNTA DO USUÁRIO: ${pergunta}

Responda a pergunta e só ela, em no máximo dois parágrafos curtos. Se a resposta honesta for "o modelo não mede isso", diga exatamente isso e explique de onde a decisão veio de fato.`
    : dias > 14
      ? `Escreva uma leitura GERAL do período, em 3 a 4 parágrafos curtos. O período é longo (${dias} dias): não narre dia a dia. Cubra, nesta ordem: (1) a lógica de distribuição — quais dias concentram volume e por quê; (2) como o rodízio de famílias foi montado e onde a fadiga apertou; (3) o trade-off receita × eficiência neste modo, ancorado na fronteira; (4) o que exige atenção de quem vai executar — restrições relaxadas, avisos e slots não validados.`
      : `Escreva uma leitura do calendário em 3 parágrafos curtos. Cubra: (1) a lógica de distribuição entre os dias e o motivo; (2) o rodízio de famílias e os pontos onde a fadiga apertou; (3) o trade-off do modo escolhido e o que exige atenção na execução — restrições relaxadas, avisos e slots não validados.`;

  const conteudo = `${resumirCalendario(calendario)}

${eventosEspeciais?.trim() ? `CONTEXTO INFORMADO PELO USUÁRIO (prosa, não entrou em cálculo nenhum — use só para comentar encaixe, nunca para justificar número):\n${eventosEspeciais.trim()}\n` : ''}
${formato}`;

  return callGemini(conteudo, instrucaoCalendario(calendario.procedencia === 'dados'), token);
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

    // ─── Calendário: contexto do modelo (BigQuery) ────────────────────────────
    // Estado da conexão. A tela usa isto para decidir se pode gerar — e para dizer
    // POR QUE não pode, quando não pode.
    if (url.pathname === '/api/calendario/status') {
      const ctx = await carregarContextoBq(env);
      return json({
        status: 'success',
        data: {
          disponivel: ctx !== null,
          carregadoEm: _bqCtxEm ? new Date(_bqCtxEm).toISOString() : null,
          erro: _bqCtxErro,
          marcas: ctx ? Object.keys(ctx) : [],
        },
      });
    }

    // Catálogo real, índices e viabilidade. É a rota que substitui o catálogo
    // inventado. O 503 aqui não é preguiça de tratamento: sem estes dados o gerador
    // NÃO TEM o que usar, e a única alternativa a falhar é inventar — que é
    // exatamente o defeito que este endpoint existe para consertar.
    if (url.pathname === '/api/calendario/contexto') {
      const ctx = await carregarContextoBq(env, url.searchParams.get('recarregar') === '1');
      if (!ctx) {
        return json({
          error: 'Contexto do modelo indisponível: sem conexão com o BigQuery.',
          detalhe: _bqCtxErro,
        }, 503);
      }
      const marca = url.searchParams.get('marca');
      if (!marca) return json({ status: 'success', data: ctx });

      const doMarca = ctx[marca.toLowerCase()];
      if (!doMarca) {
        // Gocase cai aqui, e é o caso mais importante de distinguir: ela não está em
        // marca_config porque a tabela de pedidos é Spree e não tem UTM — atribuição
        // impossível. Não é fila de trabalho, é bloqueio de origem.
        return json({
          error: `Marca "${marca}" não está no modelo.`,
          marcasDisponiveis: Object.keys(ctx),
        }, 404);
      }
      return json({ status: 'success', data: doMarca });
    }

    // O que o classificador de ofertas está perdendo. Diagnóstico de manutenção do
    // catálogo, não insumo do plano — por isso rota própria, sob demanda: varre a
    // tabela de eventos brutos da marca, caro demais para entrar na carga do contexto.
    if (url.pathname === '/api/calendario/nao-classificadas') {
      const marca = (url.searchParams.get('marca') ?? '').toLowerCase();
      if (!marca) return json({ error: 'Informe ?marca=' }, 400);
      const ctx = await carregarContextoBq(env);
      if (!ctx || !ctx[marca]) {
        return json({ error: `marca "${marca}" não está no modelo`, detalhe: _bqCtxErro }, 503);
      }
      try {
        const projeto = bqCredencial(env)!.projeto;
        // O CASE é interpolado no SQL. É injeção por construção, e é aceitável aqui
        // por dois motivos que precisam valer sempre: a coluna GUARDA uma expressão
        // SQL (é o contrato da tabela, escrita pelo time de CRM), e `marca` foi
        // validada contra as chaves do contexto — nunca vai crua para o dataset.
        const [cfg] = await bqConsultar(env,
          `SELECT oferta_case FROM \`${projeto}.crm_modelo.marca_config\` WHERE marca = '${marca}'`);
        if (!cfg?.oferta_case) return json({ error: `marca "${marca}" não tem oferta_case` }, 503);
        const ini = ctx[marca].config.dataMinEvento ?? '2026-04-09';
        const dados = await bqConsultar(env, `
          WITH e AS (
            SELECT e_campaign_name AS nome, LOWER(e_campaign_name) AS c, COUNT(*) AS envios
            FROM \`${projeto}.crm_${marca}.crm_eventos_brutos\`
            WHERE event_name = 'email_sent' AND DATE(e_timestamp) >= '${ini}'
            GROUP BY 1, 2
          )
          SELECT nome, envios FROM e
          WHERE nome IS NULL OR (${cfg.oferta_case}) = 'OUTROS'
          ORDER BY envios DESC LIMIT 50`);
        return json({
          status: 'success',
          data: dados,
          total: dados.reduce((a: number, d: any) => a + Number(d.envios), 0),
        });
      } catch (err: any) {
        return json({ error: err.message }, 503);
      }
    }

    if (url.pathname === '/api/calendario/explicar' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const { calendario, pergunta, eventosEspeciais } = body;
        if (!calendario?.slots?.length) {
          return json({ error: 'Nenhum calendário gerado para explicar.' }, 400);
        }
        if (!GOGROUP_TOKEN) {
          return json({
            error: 'Nenhuma chave do AI proxy configurada — a leitura assistida está indisponível. O calendário acima continua válido: ele é gerado pelo modelo determinístico, sem IA.',
          }, 503);
        }
        const texto = await explicarCalendario(
          { calendario, pergunta, eventosEspeciais },
          GOGROUP_TOKEN,
        );
        return json({ status: 'success', data: { texto } });
      } catch (err: any) {
        console.error('Erro na leitura do calendário:', err);
        return json({ error: 'Erro ao ler o calendário.', details: err.message }, 500);
      }
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
        // O front manda WebP (composeFrame); frames antigos continuam em .png no bucket.
        const ext = mimeType === 'image/webp' ? 'webp' : 'png';
        const res = await supabaseUpload('campaign-images', `frames/${pautaId}/${frameName}.${ext}`, bytes, mimeType, SUPABASE_KEY);
        if (!res.ok) return json({ error: 'upload falhou' }, 500);
        return json({ publicUrl: `${SUPABASE_URL}/storage/v1/object/public/campaign-images/frames/${pautaId}/${frameName}.${ext}` });
      } catch (err: any) {
        return json({ error: err.message }, 500);
      }
    }

    // Modo D (Editor de GIF Externo) — busca um GIF hospedado fora do nosso Storage (histórico da
    // Insider, quase sempre sem CORS liberado) pra decodificar os frames no navegador. Sem esse
    // proxy, o fetch() client-side falha silenciosamente pra ~269 dos ~270 GIFs do histórico, que
    // só têm insider_original_url (CDN externo), não storage_url.
    if (url.pathname === '/api/gif-proxy' && request.method === 'GET') {
      try {
        const targetUrl = url.searchParams.get('url');
        if (!targetUrl || !targetUrl.startsWith('https://')) {
          return json({ error: "Parâmetro 'url' precisa ser uma URL https." }, 400);
        }
        const upstream = await fetch(targetUrl);
        if (!upstream.ok) return json({ error: `Falha ao buscar a URL de origem: ${upstream.status}` }, 502);
        const contentLength = upstream.headers.get('content-length');
        if (contentLength && Number(contentLength) > 20 * 1024 * 1024) {
          return json({ error: 'Arquivo maior que 20MB.' }, 413);
        }
        const buffer = await upstream.arrayBuffer();
        if (buffer.byteLength > 20 * 1024 * 1024) return json({ error: 'Arquivo maior que 20MB.' }, 413);
        return new Response(buffer, {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': upstream.headers.get('content-type') ?? 'image/gif' },
        });
      } catch (err: any) {
        return json({ error: err.message }, 500);
      }
    }

    // Modo D — edita um frame externo (upload ou histórico) com uma instrução livre em texto,
    // via PiApp (mesmo mecanismo de "edit" já usado em /api/generate-image, mas sem a
    // dependência de marca/BRAND_DNA — o GIF de origem não é necessariamente de Apice/Barbours).
    // Duas rotas ("iniciar" + "status") em vez de uma só bloqueante — ver nota em
    // iniciarGeracaoImagem acima.
    if (url.pathname === '/api/editar-frame-externo/iniciar' && request.method === 'POST') {
      try {
        if (!PIAPP_API_KEY) return json({ error: 'PIAPP_API_KEY não configurada no servidor.' }, 500);
        const {
          imageDataUrl, instrucao, aspectRatio: rawRatio = '1:1',
          imageModel: rawModel = 'wavespeed-gpt-image-2-t2i',
          referenciasImagem: rawRefImages, frameReferencia,
        } = await request.json() as any;
        if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:')) {
          return json({ error: 'imageDataUrl é obrigatório (data URL).' }, 400);
        }
        if (typeof instrucao !== 'string' || !instrucao.trim()) {
          return json({ error: 'instrucao é obrigatória.' }, 400);
        }

        const productRefInputs: string[] = Array.isArray(rawRefImages) ? rawRefImages.slice(0, 4) : [];
        const productRefUrls: string[] = [];
        for (const img of productRefInputs) {
          if (typeof img === 'string' && img.startsWith('data:')) {
            productRefUrls.push(await uploadReferenceToPiApp(img, PIAPP_API_KEY));
          }
        }
        const frameRefUrls: string[] = [];
        if (typeof frameReferencia === 'string' && frameReferencia.startsWith('data:')) {
          frameRefUrls.push(await uploadReferenceToPiApp(frameReferencia, PIAPP_API_KEY));
        }
        const refUrl = await uploadReferenceToPiApp(imageDataUrl, PIAPP_API_KEY);
        const imageModel = resolveImageModel(rawModel, true);
        const prompt = buildEditPromptExterno(instrucao, productRefUrls.length, frameRefUrls.length > 0);

        const jobId = await iniciarGeracaoImagem(prompt, rawRatio, imageModel, PIAPP_API_KEY, [...productRefUrls, ...frameRefUrls, refUrl]);
        return json({ jobId });
      } catch (err: any) {
        return json({ error: err.message }, 500);
      }
    }

    if (url.pathname === '/api/editar-frame-externo/status' && request.method === 'GET') {
      try {
        if (!PIAPP_API_KEY) return json({ error: 'PIAPP_API_KEY não configurada no servidor.' }, 500);
        const jobId = url.searchParams.get('jobId');
        if (!jobId) return json({ error: 'jobId é obrigatório.' }, 400);
        const result = await verificarJobImagem(jobId, PIAPP_API_KEY);
        return json(result);
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
          linkCampanha, assunto: assuntoOverride, nomeCampanha: nomeCampanhaOverride, utmCampaign: utmCampaignOverride,
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

        // UTM Campaign: campo próprio, mas por padrão segue o nome da campanha (mesma
        // sanitização) se quem enviar deixar em branco.
        const utmDigitado = typeof utmCampaignOverride === 'string' ? sanitizarNomeCampanha(utmCampaignOverride) : '';
        const utmCampaign = utmDigitado.length > 0 ? utmDigitado : nomeCampanha;

        const assuntoFinal = (typeof assuntoOverride === 'string' && assuntoOverride.trim())
          ? assuntoOverride.trim()
          : (copy.assunto ?? nomeCampanha);

        const criada = await createInsiderExperimentCampaign({
          apiKey,
          name: nomeCampanha,
          tags: ['agente-gif'],
          variationA: { subject: assuntoFinal, preHeader: copy.preHeader ?? '', html: htmlA },
          variationB: { subject: assuntoFinal, preHeader: copy.preHeader ?? '', html: htmlB },
          utmCampaign,
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

    // Envia uma pauta (card do GIF no histórico) direto pra Insider como campanha única —
    // sem comparação A/B, é só o conteúdo dessa pauta mesmo. O GIF já vem pronto (mesma técnica
    // de composição via gifshot/Storage usada no download do GIF e no Passo 3 do Modo C).
    if (url.pathname === '/api/pauta-enviar-insider' && request.method === 'POST') {
      try {
        const {
          pautaId, gifUrl, destinoMarca: rawDestino,
          linkCampanha, assunto: assuntoOverride, nomeCampanha: nomeCampanhaOverride, utmCampaign: utmCampaignOverride,
        } = await request.json() as any;
        if (!pautaId || !gifUrl) {
          return json({ error: 'pautaId e gifUrl são obrigatórios.' }, 400);
        }
        if (!(CONTAS_INSIDER as readonly string[]).includes(rawDestino)) {
          return json({ error: 'destinoMarca inválida.' }, 400);
        }
        const destinoMarca: ContaInsider = rawDestino;

        const apiKey = getInsiderApiKey(destinoMarca, env);
        if (!apiKey) {
          return json({ error: `Chave da Insider para ${destinoMarca} não configurada (INSIDER_API_KEY_${destinoMarca.toUpperCase()}).` }, 400);
        }

        const pautaRows = await supabaseRestGet(`pautas_geradas?id=eq.${pautaId}&select=*`, SUPABASE_KEY);
        const pauta = Array.isArray(pautaRows) ? pautaRows[0] : null;
        if (!pauta) return json({ error: 'Pauta não encontrada.' }, 404);

        const copy = pauta.copy ?? {};
        const html = buildInsiderVariationHtml({ imageUrl: gifUrl, linkUrl: linkCampanha, marca: destinoMarca });

        // Nome da campanha: regra da Insider exige alfanumérico com -_{espaço}, 5-40 caracteres —
        // sanitiza tanto o valor digitado pelo usuário quanto o fallback automático da mesma forma.
        const sanitizarNomeCampanha = (raw: string) => raw
          .normalize('NFD').replace(/[̀-ͯ]/g, '')
          .replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 40);
        const nomeDigitado = typeof nomeCampanhaOverride === 'string' ? sanitizarNomeCampanha(nomeCampanhaOverride) : '';
        const nomeAuto = sanitizarNomeCampanha(`pauta ${destinoMarca} ${pauta.operacional?.mecanicaEscolhida ?? 'gif'}`);
        const nomeCampanha = nomeDigitado.length >= 5 ? nomeDigitado : (nomeAuto.length >= 5 ? nomeAuto : `pauta ${destinoMarca} gif`);

        // UTM Campaign: campo próprio, mas por padrão segue o nome da campanha (mesma
        // sanitização) se quem enviar deixar em branco.
        const utmDigitado = typeof utmCampaignOverride === 'string' ? sanitizarNomeCampanha(utmCampaignOverride) : '';
        const utmCampaign = utmDigitado.length > 0 ? utmDigitado : nomeCampanha;

        const assuntoFinal = (typeof assuntoOverride === 'string' && assuntoOverride.trim())
          ? assuntoOverride.trim()
          : (copy.assunto ?? nomeCampanha);

        const criada = await createInsiderSingleCampaign({
          apiKey,
          name: nomeCampanha,
          tags: ['agente-gif', 'campanha-unica'],
          variation: { subject: assuntoFinal, preHeader: copy.preHeader ?? '', html },
          utmCampaign,
        });

        // Um envio por (pauta, marca de destino) — permite a mesma pauta virar campanha em
        // várias contas Insider em vez de travar na primeira marca que recebeu o envio.
        const envioRes = await fetch(`${SUPABASE_URL}/rest/v1/pauta_envios_insider?on_conflict=pauta_id,marca`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify({
            pauta_id: pautaId,
            marca: destinoMarca,
            insider_campaign_id: criada.id,
            gif_url: gifUrl,
          }),
        });
        if (!envioRes.ok) console.error('[pauta-enviar-insider] Falha ao salvar envio:', await envioRes.text());

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