import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const supabaseCrmAi = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { db: { schema: 'crm_ai' } })
  : null;

// ─── crm_ai context — carregado no startup ───────────────────────────────────
interface MarcaDnaContext {
  marcaId: number;
  tomDeVoz: string;
  paletaFormatada: string; // "hex (uso); hex (uso); ..."
  primaryHex: string;
  secondaryHex: string;
}
interface EmailHitContext {
  mecanicaNome: string;
  descricaoVisual: string;
  receita: string;
  taxaAbertura: string;
  ctor: string;
}

let crmAiMarcas: Record<string, MarcaDnaContext> = {};
let crmAiHits: Record<string, EmailHitContext[]> = {};  // keyed by brand name
let crmAiEstilos: string[] = [];
let crmAiMecanicasCanonical: string[] = [];

const app = express();
const PORT = 3000;

// Inicialização do cliente Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

app.use(express.json({ limit: '10mb' }));

// Banco de dados histórico de referência (fallback hardcoded)
const hardcodedDisparos = [
  // Apice (Foco em cabelo feminino, tom acolhedor, primeira pessoa)
  { id: "EMA-101", marca: "Apice", mecanica: "Abra o presente", disparos: 1, receitaMedia: 8767, performance: "excelente", contextosRecomendados: ["lancamento", "sazonal"] },
  { id: "EMA-102", marca: "Apice", mecanica: "Abra a caixa", disparos: 3, receitaMedia: 6312, performance: "hit", contextosRecomendados: ["recompra"] },
  { id: "EMA-103", marca: "Apice", mecanica: "Abra a carta", disparos: 3, receitaMedia: 4711, performance: "medio", contextosRecomendados: ["reativacao"] },
  { id: "EMA-104", marca: "Apice", mecanica: "Puxe o Adesivo", disparos: 6, receitaMedia: 6348, performance: "hit", contextosRecomendados: ["queima_estoque", "datas_comemorativas"] },
  { id: "EMA-105", marca: "Apice", mecanica: "Corte o fio", disparos: 5, receitaMedia: 6048, performance: "hit", contextosRecomendados: ["lancamento"] },
  { id: "EMA-106", marca: "Apice", mecanica: "Jogo da Velha", disparos: 3, receitaMedia: 6880, performance: "hit", contextosRecomendados: ["datas_comemorativas", "sazonal"] },
  { id: "EMA-107", marca: "Apice", mecanica: "Rasgue o papel", disparos: 3, receitaMedia: 5508, performance: "medio", contextosRecomendados: ["recompra"] },
  { id: "EMA-108", marca: "Apice", mecanica: "Puxe o post-it", disparos: 3, receitaMedia: 4658, performance: "medio", contextosRecomendados: ["reativacao"] },
  { id: "EMA-109", marca: "Apice", mecanica: "Estoure o balão", disparos: 2, receitaMedia: 3854, performance: "fraco", contextosRecomendados: ["queima_estoque"] },
  { id: "EMA-110", marca: "Apice", mecanica: "Puxe o cupom", disparos: 1, receitaMedia: 2415, performance: "aposentar", contextosRecomendados: ["sazonal"] },

  // Barbours (Luxo acessível, tom direto e sofisticado, push-notification)
  { id: "EMA-201", marca: "Barbours", mecanica: "Abra o presente", disparos: 8, receitaMedia: 13295, performance: "dominante", contextosRecomendados: ["lancamento", "datas_comemorativas"] },
  { id: "EMA-204", marca: "Barbours", mecanica: "Abra a caixa", disparos: 6, receitaMedia: 12691, performance: "dominante", contextosRecomendados: ["recompra", "sazonal"] },
  { id: "EMA-205", marca: "Barbours", mecanica: "Abra a carta", disparos: 1, receitaMedia: 9658, performance: "medio", contextosRecomendados: ["reativacao"] },
  { id: "EMA-206", marca: "Barbours", mecanica: "Corte o fio", disparos: 2, receitaMedia: 11346, performance: "hit", contextosRecomendados: ["lancamento", "reativacao"] },
  { id: "EMA-207", marca: "Barbours", mecanica: "Rasgue o papel", disparos: 1, receitaMedia: 6321, performance: "incompativel", contextosRecomendados: ["queima_estoque"] },
  { id: "EMA-208", marca: "Barbours", mecanica: "Estoure o balão", disparos: 1, receitaMedia: 19220, performance: "outlier", contextosRecomendados: ["datas_comemorativas"] },
  { id: "EMA-209", marca: "Barbours", mecanica: "Puxe o cupom", disparos: 2, receitaMedia: 12600, performance: "hit", contextosRecomendados: ["sazonal"] }
];

// Runtime mutable — substituído por dados do Supabase no startup
let databaseDisparos = hardcodedDisparos;

async function loadDisparosFromSupabase() {
  if (!supabase) return;
  const { data, error } = await supabase.from("disparos_historicos").select("*");
  if (error || !data || data.length === 0) {
    console.warn("[Supabase] Fallback para banco local:", error?.message ?? "sem dados");
    return;
  }
  databaseDisparos = data.map((row: any) => ({
    id: row.id,
    marca: row.marca,
    mecanica: row.mecanica,
    disparos: row.disparos,
    receitaMedia: row.receita_media ?? row.receitaMedia ?? 0,
    performance: row.performance,
    contextosRecomendados: row.contextos_recomendados ?? row.contextosRecomendados ?? [],
  }));
  console.log(`[Supabase] ${databaseDisparos.length} disparos históricos carregados.`);
}

// ─── Catálogo dinâmico de mecânicas ─────────────────────────────────────────
const DEFAULT_MECANICAS = [
  'Abra o presente', 'Abra a caixa', 'Abra a carta',
  'Puxe o Adesivo', 'Corte o fio', 'Jogo da Velha',
  'Rasgue o papel', 'Puxe o post-it', 'Estoure o balão', 'Puxe o cupom',
];
let mecanicasCatalog: string[] = [...DEFAULT_MECANICAS];

async function loadMecanicasFromSupabase() {
  if (!supabase) return;
  const { data, error } = await supabase.from('mecanicas_catalog').select('nome').order('id');
  if (error || !data || data.length === 0) {
    console.warn('[Supabase] Catálogo de mecânicas não carregado, usando padrão.');
    return;
  }
  mecanicasCatalog = data.map((r: any) => r.nome as string);
  console.log(`[Supabase] ${mecanicasCatalog.length} mecânicas no catálogo.`);
}

async function loadCrmAiContext() {
  if (!supabase) return;
  try {
    // Uses RPC proxy functions (SECURITY DEFINER in public schema) — bypasses PostgREST schema restriction

    // 1. marcas
    const { data: marcasRaw, error: marcasErr } = await supabase.rpc('crm_ai_get_marcas');
    if (marcasErr) throw new Error(`crm_ai_get_marcas: ${marcasErr.message}`);
    for (const m of (marcasRaw as any[]) ?? []) {
      const paleta = (m.paleta_cores ?? {}) as Record<string, any>;
      const formatted = Object.entries(paleta)
        .filter(([k]) => !['primaria', 'secundaria'].includes(k))
        .map(([, v]: any) => `${v.hex} — ${v.uso}`)
        .join('; ');
      crmAiMarcas[m.nome] = {
        marcaId: m.marca_id,
        tomDeVoz: m.tom_de_voz ?? '',
        paletaFormatada: formatted,
        primaryHex: paleta.primaria ?? '',
        secondaryHex: paleta.secundaria ?? '',
      };
    }
    console.log(`[crm_ai] ${Object.keys(crmAiMarcas).length} marcas carregadas.`);

    // 2. list_mecanica + list_estilo_visual
    const { data: listsRaw, error: listsErr } = await supabase.rpc('crm_ai_get_lists');
    if (listsErr) throw new Error(`crm_ai_get_lists: ${listsErr.message}`);
    const lists = (listsRaw ?? {}) as { mecanicas: any[]; estilos: any[] };
    const mecMap: Record<number, string> = {};
    for (const m of lists.mecanicas ?? []) {
      mecMap[m.id] = m.valor;
      crmAiMecanicasCanonical.push(m.valor as string);
    }
    crmAiEstilos = (lists.estilos ?? []).map((e: any) => e.valor as string);

    // 3. top emails por receita
    const { data: emailsRaw, error: emailsErr } = await supabase.rpc('crm_ai_get_top_emails', { limit_n: 40 });
    if (emailsErr) throw new Error(`crm_ai_get_top_emails: ${emailsErr.message}`);
    const hitsByMarcaId: Record<number, EmailHitContext[]> = {};
    for (const e of (emailsRaw as any[]) ?? []) {
      const mid = e.marca_id as number;
      if (!hitsByMarcaId[mid]) hitsByMarcaId[mid] = [];
      if (hitsByMarcaId[mid].length >= 8) continue;
      hitsByMarcaId[mid].push({
        mecanicaNome: mecMap[e.mecanica_id] ?? 'Outra',
        descricaoVisual: String(e.descricao_visual).slice(0, 500),
        receita: `R$${Number(e.receita).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`,
        taxaAbertura: e.taxa_abertura ? `${(Number(e.taxa_abertura) * 100).toFixed(1)}%` : '?',
        ctor: e.ctor ? `${(Number(e.ctor) * 100).toFixed(2)}%` : '?',
      });
    }
    for (const [nomeMarca, ctx] of Object.entries(crmAiMarcas)) {
      crmAiHits[nomeMarca] = hitsByMarcaId[ctx.marcaId] ?? [];
    }

    const totalHits = Object.values(crmAiHits).reduce((s, a) => s + a.length, 0);
    console.log(`[crm_ai] ${totalHits} email hits + ${crmAiEstilos.length} estilos + ${crmAiMecanicasCanonical.length} mecânicas carregados.`);
  } catch (err: any) {
    console.warn('[crm_ai] Falha ao carregar contexto (usando fallbacks):', err.message);
  }
}

// Formata o bloco de hits visuais para injetar no prompt da IA
function buildVisualHitsBlock(marca: string): string {
  const hits = crmAiHits[marca];
  if (!hits || hits.length === 0) return '';
  const lines = hits.map((h, i) =>
    `  ${i + 1}. Mecânica: "${h.mecanicaNome}" | Receita: ${h.receita} | Abertura: ${h.taxaAbertura} | CTOR: ${h.ctor}\n     Visual: ${h.descricaoVisual.replace(/\n+/g, ' ')}`
  );
  return `\n=== TOP EMAILS DE MAIOR RECEITA DA MARCA ${marca.toUpperCase()} (use como referência visual obrigatória) ===\n${lines.join('\n\n')}\n`;
}

async function autoRegisterMecanica(nome: string) {
  if (!nome || !supabase) return;
  const normalized = nome.trim();
  if (!normalized) return;
  if (mecanicasCatalog.some(m => m.toLowerCase() === normalized.toLowerCase())) return;
  const { error } = await supabase
    .from('mecanicas_catalog')
    .upsert({ nome: normalized, categoria: 'ia_gerada', criado_por: 'ia_auto' }, { onConflict: 'nome' });
  if (!error) {
    mecanicasCatalog.push(normalized);
    console.log(`[Mecânicas] Nova mecânica registrada automaticamente: "${normalized}"`);
  }
}

// Endpoint para puxar o banco histórico caso o front queira listar
app.get("/api/historico", (req, res) => {
  res.json({ status: "success", data: databaseDisparos });
});

// Endpoint para retornar o catálogo de mecânicas (inclui as geradas pela IA)
app.get("/api/mecanicas", (req, res) => {
  res.json({ status: "success", data: mecanicasCatalog });
});

// Endpoint principal para geração de pautas por inteligência artificial
app.post("/api/generate-pauta", async (req, res) => {
  try {
    const { modo, input, aspectRatio: rawAspectRatio, direcionamentoIA, tipoGeracao: rawTipoGeracao, referenciaImagem } = req.body;
    const direcStr = typeof direcionamentoIA === 'string' ? direcionamentoIA.trim().replace(/[\r\n]+/g, ' ') : '';

    // Extrair mime type e base64 puro da data URL (ex: "data:image/jpeg;base64,/9j/...")
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

    const VALID_RATIOS = ['1:1', '3:4', '16:9', '9:16', '4:3'];
    const aspectRatio = VALID_RATIOS.includes(rawAspectRatio) ? rawAspectRatio : '1:1';

    const { marca } = input;
    const isApice = marca === 'Apice';

    // Regras de validação de input que geram Alertas de Risco na saída de forma determinística
    const riscosIniciais: any[] = [];

    if (modo === 'B') {
      const { boxTituloEmail } = input;
      if (boxTituloEmail) {
        // Verificar regras de assunto do usuário no Modo B
        const hasPorcento = boxTituloEmail.includes('%');
        const hasOff = boxTituloEmail.toUpperCase().includes('OFF');
        const hasGratis = boxTituloEmail.toUpperCase().includes('GRÁTIS') || boxTituloEmail.toUpperCase().includes('GRATIS');
        const hasRs = boxTituloEmail.includes('R$');
        const hasCaps = boxTituloEmail === boxTituloEmail.toUpperCase() && boxTituloEmail.length > 5;
        const emojiCount = (boxTituloEmail.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu) || []).length;
        
        const len = boxTituloEmail.length;
        const minLen = isApice ? 27 : 16;
        const maxLen = isApice ? 47 : 39;

        if (hasPorcento || hasOff || hasGratis || hasRs || hasCaps) {
          riscosIniciais.push({
            campo: "assunto",
            nivel: "alto",
            mensagem: `O assunto fornecido "${boxTituloEmail}" infringe as diretivas do Playbook CRM, utilizando termos proibidos (ex: %, OFF, GRÁTIS, R$ ou Caps Lock inteiro). Isso reduz sensivelmente a entregabilidade do e-mail nas caixas de entrada e gera risco de aba Promoção.`,
            alternativaSugerida: isApice ? "Use segredos de status ou notificações, ex: 'Seu status foi atualizado 🎁'" : "Use gatilho de sistema pendente, ex: '⚠️ (1) atualização pendente'"
          });
        }
        if (len < minLen || len > maxLen) {
          riscosIniciais.push({
            campo: "assunto",
            nivel: "medio",
            mensagem: `O comprimento do assunto (${len} caracteres) fica fora da janela de alto impacto ideal da marca ${marca} (deve ser de ${minLen} a ${maxLen} caracteres).`,
            alternativaSugerida: `Ajuste para conter um tamanho calibrado entre ${minLen} e ${maxLen} caracteres para melhor visualização no mobile.`
          });
        }
        if (emojiCount > 2) {
          riscosIniciais.push({
            campo: "assunto",
            nivel: "medio",
            mensagem: `O assunto contém mais de 2 emojis (${emojiCount} emojis dectetados). Isso prejudica a entregabilidade profissional e polui visualmente o preview.`,
            alternativaSugerida: "Utilize no máximo 1 ou 2 emojis temáticos focados no gatilho."
          });
        }
      }
    }

    // Preparar o contexto de banco que enviaremos no prompt
    const contextDb = databaseDisparos.filter(d => d.marca === marca);
    const dbFormatted = JSON.stringify(contextDb, null, 2);

    // Prompt de Engenharia do Playbook de CRM (Apice e Barbours)
    const systemInstruction = `Você é o Agente de IA de CRM de alta performance especialista para as marcas Apice e Barbours. Seu objetivo é gerar pautas de email lucrativas e autênticas com base no histórico de Hits validados de cada marca, sem criar conceitos mirabolantes descontextualizados, mantendo máxima aderência ao tom e regramentos corporativos.

As diretivas de marca de sua base de conhecimento primária sâo:

=== MARCA: APICE ===
- Foco: Cuidado capilar feminino, próximo, transformador, acolhedor, empoderamento e autoestima das mulheres.
- Tom de Voz: Acolhedor, tipográfico, primeira pessoa, íntimo.
- Paleta Cromática: Verde Floresta (#688D65, protagonista principal). Cores quentes permitidas apenas para destaque promocional (Magenta #D553A5, Terracota #B46D55, Beringela #562D4A).
- Tipografia: Roca (serifada, em itálico e negrito) para headlines de destaque, Host Grotesk para o texto do corpo.
- Eixo de Mecânica: Eixo de MANIPULAÇÃO (puxar adesivo, cortar fio, jogo da velha, puxar post-it, etc.).
- Recompensa Dominante: Diversificada (cupom, cupom valor fixo, brinde físico, produto + mimo). Alta intenção favorece % desconto, volume favorece cupom valor fixo, reativação produto + mimo.
- Horário recomendado: Janela das 08h30 às 09h30 (abertura média de 38,9%). Melhor dia: Quarta-feira. Pior dia: Sexta-feira.
- Limite de caracteres do Assunto: Entre 27 e 47 caracteres.

=== MARCA: BARBOURS ===
- Foco: Luxo acessível, beleza que inspira confiança, sofisticação, sensualidade moderna e feminilidade contemporânea.
- Tom de Voz: Direto, sofisticado, elegante, formato que imita push-notifications elegantes de smartphones.
- Paleta Cromática: Ruby Red (#BF0F26, protagonista dominante com 2/3 ou mais da composição), Gold (#AA834B) para os detalhes de exclusividade, profundidade com Merlot (#4F080E), contemporaneidade com Pink Blush (#FFCCD5), e fundo Off white (#E7E3D8).
- Cores PROIBIDAS (NUNCA usar em Barbours): Verde, laranja vivo, amarelo, azul.
- Tipografia: Serifa de display de alto contraste restrita exclusivamente para o logotipo. No texto das Headlines e Corpo do banner, use Sans-serif de alto contraste.
- Eixo de Mecânica: Eixo de ABRIR (abrir presente, abrir caixa, abrir carta, abrir envelope).
- Recompensa Dominante: Brinde físico ou % desconto em segundo caso. Recompensas ligadas visualmente ao tema (presente na caixa, carta no envelope, etc.).
- Horário recomendado: Janela das 09h00 às 11h00 (CTR de 1,66% e receita alta). Melhor dia: Quarta-feira ou Domingo. Pior dia: Sábado.
- Limite de caracteres do Assunto: Entre 16 e 39 caracteres.

=== REGRAS INVIOLÁVEIS DE ASSUNTO (ENTREGABILIDADE) ===
1. NUNCA use Caps Lock no assunto inteiro.
2. NUNCA use mais de 2 emojis por assunto.
3. NUNCA use as palavras ou símbolos "%", "OFF", "GRÁTIS", "R$" ou números gritantes em CAPS LOCK no assunto do email (regras estritas para evitar caixa de spam, aba de promoção ou bloqueio dos ISPs).
4. O Pré-header deve ser SEMPRE E EXCLUSIVAMENTE o texto fixo "Mas, vou precisar cancelar em breve" independente dos inputs. Não invente!

=== REGRAS DO PROCESSO DE GERAÇÃO ===
- Ao propor uma pauta, associe-a sempre com pelo menos 1 (e até 3) ID de disparo de Hit do banco de referência da marca selecionada, para basear sua previsão realista de taxas de abertura (28-35%), CTOR (3-5%) e receita.
- Previsões de performance reais devem ser informadas como faixas numéricas de intervalo, nunca números fixos únicos.
- Se houver menos que 3 cases análogos próximos no banco, indique de forma clara como "baixa confiança".
- Se houver alguma violação nas diretivas de playbook pelo usuário, sinalize no bloco de riscos, mas garanta que o resultado visual e de copy gerados por você permaneça 100% calibrado dentro do Playbook.
- Estruture o banner no formato ${aspectRatio} (proporção escolhida pelo usuário), ilustrado, instigante, preferencialmente formato GIF (com 3 frames detalhados: Inicial com o objeto intocado/fechado, Intermediário opcional com a ação ocorrendo, e Final com a revelação da recompensa e botão CTA visível em contraste). Ao descrever cada frame, considere o recorte visual da proporção ${aspectRatio}: posicionamento de elementos, hierarquia e o que será cortado nas bordas.
- A headline do banner deve ser sempre baseada no verbo de ação da mecânica escolhida (ex: "ABRA O PRESENTE", "PUXE O ADESIVO") em destaque tipográfico. O sub-headline deve expor a recompensa concreta + o prazo de urgência (ex: "Seu brinde te espera — válido até 23h59"). O CTA do botão deve conter um verbo único direto correspondente à mecânica ("ABRIR", "PUXAR", etc.).
- Se o segmento alvo fornecido for desengajado (como Desengajados, Abertura 0x90), restrinja estritamente para mecânicas de baixíssimo atrito (ex: "abrir presente" antes de inventar mecânicas interativas longas como "jogo da velha" ou jogar).

Você extrairá as mecânicas, previsões de faturamento médio e performances do banco de referência real fornecido adiante.
${crmAiEstilos.length > 0 ? `\n=== ESTILOS VISUAIS DISPONÍVEIS (use exatamente esses nomes no campo estiloIlustracao) ===\n${crmAiEstilos.join(', ')}\n` : ''}`;

    // Injeta bloco de hits visuais reais da marca no system instruction
    const visualHitsBlock = buildVisualHitsBlock(marca);

    // Customizar instruções baseado no modo de operação
    const direcBlocoModoA = direcStr ? `\n=== INSTRUÇÃO PRINCIPAL DO USUÁRIO (prioridade máxima sobre o histórico) ===\n"${direcStr}"\n\nTrate essa instrução como o objetivo central desta geração. Se ela conflitar com padrões do histórico de Hits (ex: histórico sugere conteúdos curtos mas o usuário pediu algo mais longo), siga a instrução do usuário.\n` : '';
    const direcBlocoModoB = direcStr ? `\n\n=== DIREÇÃO MACRO DO BRIEFING (orientação geral do usuário) ===\n"${direcStr}"\n\nUse essa direção para orientar o preenchimento dos boxes vazios e o refinamento dos boxes preenchidos.\nREGRA DE CONFLITO: Se essa direção conflitar com o conteúdo de um box preenchido pelo usuário, respeite o conteúdo literal do box (ele foi digitado explicitamente) e aplique esta direção apenas nos boxes que você gerar do zero.` : '';

    const promptModo = modo === 'A'
      ? `=== GERAÇÃO MODO A: DESCOBERTA LIVRE ===${direcBlocoModoA}
O CRM Manager da marca ${marca} está solicitando a criação de até ${input.quantidadePautas || 3} ideias de pautas de CRM para preencher o cronograma.
Parâmetros recebidos:
- Quantidade requisitada: ${input.quantidadePautas || 3} pauta(s)
- Contexto da Campanha: ${input.contextoCampanha || 'Geral/Descobrimento'}
- Segmento Alvo: ${input.segmentoAlvo || 'Principal Padrão'}
- Data sugerida do Disparo: ${input.dataDisparo || 'Vazio (indicar recomendada)'}
- Tipo de Recompensa: ${input.tipoRecompensa || 'Selecionar com base em melhor performance'}
- Mecânicas a evitar recentemente: ${(input.evitarMecanicas || []).join(', ') || 'Nenhuma'}

Use o banco histórico da marca para priorizar os Hits históricos que performaram melhor para propor de forma calibrada.`
      : `=== GERAÇÃO MODO B: BRIEFING ASSISTIDO ===${direcBlocoModoB}
O CRM Manager já possui conceitos parciais de briefing e deseja complementar e calibrar a estrutura de email em conformidade total com as boas práticas.
Boxes preenchidos pelo usuário (qualquer um vazio deve ser preenchido por você):
- Assunto desejado (boxTituloEmail): "${input.boxTituloEmail || 'Vazio (Gerar)'}"
- Sub-headline desejado (boxSubtituloEmail): "${input.boxSubtituloEmail || 'Vazio (Gerar)'}"
- Verbo do botão CTA (boxCta): "${input.boxCta || 'Vazio (Gerar)'}"
- BOX 4 — Mecânica / Conceito do GIF (boxMecanicaOuEstatico): "${input.boxMecanicaOuEstatico || 'Vazio (Gerar — use criatividade total)'}"
- Recompensa pretendida (boxRecompensa): "${input.boxRecompensa || 'Vazio (Gerar)'}"
${refImageData ? '\n=== IMAGEM DE REFERÊNCIA VISUAL ANEXADA ===\nO usuário enviou uma imagem de referência (veja acima). Analise o estilo visual, paleta de cores, composição e mood dela. Use essas informações para enriquecer a descrição dos frames visuais (frameInicial, frameIntermediario, frameFinal) e o estilo de ilustração, adaptando-os ao DNA visual da marca conforme o Playbook.\n' : ''}
=== BOX 4 — MECÂNICA: LIBERDADE CRIATIVA TOTAL ===
O BOX 4 define o conceito visual/interativo do email (o GIF de 3 frames). Este campo é TOTALMENTE LIVRE:
- Se o usuário preencheu algo no BOX 4: use como base e expanda com detalhes visuais criativos
- Se o usuário deixou o BOX 4 vazio: INVENTE uma mecânica original e inédita que faça sentido para o contexto desta pauta
- Você NÃO está restrito às mecânicas históricas da marca — novas mecânicas são incentivadas e serão registradas automaticamente no sistema
- Pense em conceitos que funcionem como GIF de 3 frames: objeto/estado inicial → ação do usuário → revelação da recompensa
- Mecânicas já no catálogo (para referência, mas não limitante): ${mecanicasCatalog.join(', ')}
- Exemplos de mecânicas inéditas que você PODE criar: "Gire a Roleta", "Abra o Cofre", "Desbloqueie o Cadeado", "Monte o Puzzle", "Descubra o Mapa do Tesouro", "Vire a Carta do Tarô", "Abra o Armário Secreto", "Acenda a Vela", "Destampe o Frasco", "Desembrulhe a Caixa de Joias" — ou qualquer outra que encaixe no contexto

Se algum box preenchido violar as restrições estritas da marca (ex: palavra proibida, cor proibida, caps-lock ou tamanho incorreto de assunto), você DEVE preencher o copy gerado no padrão correto do Playbook, mantendo a ideia central do usuário mas corrigindo-a, e colocar obrigatoriamente um aviso de risco com a devida justificativa técnica no campo "riscos".`;

    const instructionsPrompt = `${promptModo}

Aqui está o histórico completo de disparos reais da marca ${marca} para você carregar como contexto primário e justificar as escolhas:
${dbFormatted}
${visualHitsBlock}
Gere um formato JSON contendo um array de ideias de pautas (com o tamanho exato solicitado: ${modo === 'A' ? input.quantidadePautas : 1}). Respeite à risca o esquema de tipos definido.`;

    // Chamar a API usando gemini-2.5-flash
    const contentsPayload = refImageData
      ? [{ role: 'user', parts: [{ text: instructionsPrompt }, { inlineData: { mimeType: refImageData.mimeType, data: refImageData.data } }] }]
      : instructionsPrompt;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contentsPayload,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "Lista de propostas de pauta geradas em total harmonia com o Playbook",
          items: {
            type: Type.OBJECT,
            properties: {
              copy: {
                type: Type.OBJECT,
                description: "Bloco de copy calibrado",
                properties: {
                  assunto: { type: Type.STRING, description: "Assunto do email, tamanho correto do playbook (SEM %, OFF, R$, GRÁTIS, CAPS LOCK)" },
                  preHeader: { type: Type.STRING, description: "Sempre fixo em 'Mas, vou precisar cancelar em breve'" },
                  headlineBanner: { type: Type.STRING, description: "Headline textual do banner usando verbo de mecânica (ex: 'ABRA RECEBA SEU MIMO')" },
                  subHeadlineBanner: { type: Type.STRING, description: "Subtopico ilustrando recompensa + prazo" },
                  ctaBotao: { type: Type.STRING, description: "Verbo simples no imperativo/infinitivo do botão (ex: 'ABRIR')" }
                },
                required: ["assunto", "preHeader", "headlineBanner", "subHeadlineBanner", "ctaBotao"]
              },
              visual: {
                type: Type.OBJECT,
                description: "Briefing de produção visual do banner do email (aspect ratio 1:1, formato GIF)",
                properties: {
                  formato: { type: Type.STRING },
                  paletaRecomendada: {
                    type: Type.OBJECT,
                    properties: {
                      nome: { type: Type.STRING },
                      cores: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "Códigos HEX de cores recomendadas na proporção certa"
                      }
                    },
                    required: ["nome", "cores"]
                  },
                  estiloIlustracao: { type: Type.STRING, description: "Descrição do estilo visual. Ex: Ilustrado 3D ou 2D orgânico com presença humana" },
                  frameInicial: { type: Type.STRING, description: "Aparência inicial instigante fechada do elemento" },
                  frameIntermediario: { type: Type.STRING, description: "Aparência intermediária (ação acontecendo)" },
                  frameFinal: { type: Type.STRING, description: "Revelação clara da recompensa" },
                  posicaoCta: { type: Type.STRING, description: "Descrição de onde o botão CTA se posiciona" },
                  tipografia: { type: Type.STRING, description: "Indicação estrita de fontes (Apice: Roca e Host Grotesk. Barbours: Sans-serif alto contraste)" }
                },
                required: ["formato", "paletaRecomendada", "estiloIlustracao", "frameInicial", "frameIntermediario", "frameFinal", "posicaoCta", "tipografia"]
              },
              operacional: {
                type: Type.OBJECT,
                description: "Briefing de operação e envio",
                properties: {
                  mecanicaEscolhida: { type: Type.STRING, description: "Mecânica da pauta" },
                  justificativaMecanica: { type: Type.STRING, description: "Uma justificativa embasada nas estatísticas ou KPIs reais do histórico" },
                  recompensaEscolhida: { type: Type.STRING, description: "Recompensa recomendada ligada de forma coerente" },
                  diaRecomendado: { type: Type.STRING, description: "Melhor dia sugerido (priorizar quartas ou domingos" },
                  horarioRecomendado: { type: Type.STRING, description: "Janela horária sugerida" },
                  segmentoRecomendado: { type: Type.STRING, description: "Segmento ideal" }
                },
                required: ["mecanicaEscolhida", "justificativaMecanica", "recompensaEscolhida", "diaRecomendado", "horarioRecomendado", "segmentoRecomendado"]
              },
              previsao: {
                type: Type.OBJECT,
                description: "Previsão calculada de performance com base nas referências de Hits análogas",
                properties: {
                  aberturaEsperada: { type: Type.STRING, description: "Exemplo: '28-35%'" },
                  ctorEsperado: { type: Type.STRING, description: "Exemplo: '3-5%'" },
                  receitaEsperada: { type: Type.STRING, description: "Exemplo: 'R$ 6.000 - R$ 9.000'" },
                  casesReferencia: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING },
                    description: "Lista de 1 a 3 IDs de disparos históricos reais do banco (ex: ['EMA-101', 'EMA-104'])" 
                  },
                  confianca: { type: Type.STRING, description: "Indicar se é 'alta' ou 'baixa' (baixa confiança quando o histórico análogo é menor que 3 cases)" },
                  confiancaMotivo: { type: Type.STRING, description: "Texto justificando o nível de confiança" }
                },
                required: ["aberturaEsperada", "ctorEsperado", "receitaEsperada", "casesReferencia", "confianca", "confiancaMotivo"]
              },
              riscos: {
                type: Type.ARRAY,
                description: "Quaisquer riscos técnicos identificados infringindo as regras invioláveis ou boas práticas",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    campo: { type: Type.STRING },
                    nivel: { type: Type.STRING, description: "alto, medio ou baixo" },
                    mensagem: { type: Type.STRING },
                    alternativaSugerida: { type: Type.STRING }
                  },
                  required: ["campo", "nivel", "mensagem", "alternativaSugerida"]
                }
              }
            },
            required: ["copy", "visual", "operacional", "previsao"]
          }
        }
      }
    });

    const outputText = response.text || "[]";
    let pautasProps = JSON.parse(outputText);

    // Ajustes extras determinísticos de segurança para que regras invioláveis NUNCA falhem
    pautasProps = pautasProps.map((p: any, index: number) => {
      // Forçar pré-header correto
      p.copy.preHeader = "Mas, vou precisar cancelar em breve";

      // Validar comprimento de assunto e limpar se houver lixo
      const originalAssunto = p.copy.assunto || "";
      let assuntoLimpo = originalAssunto;

      // Sanitizar caps lock inteiro no assunto (forçar para minúsculo com capitalização das primeiras letras)
      if (assuntoLimpo === assuntoLimpo.toUpperCase() && assuntoLimpo.length > 5) {
        assuntoLimpo = assuntoLimpo.charAt(0).toUpperCase() + assuntoLimpo.slice(1).toLowerCase();
      }

      // Proteger contra palavras banidas
      const forbiddenWords = ["%", "OFF", "GRÁTIS", "GRATIS", "R$"];
      let containForbidden = false;
      forbiddenWords.forEach(w => {
        if (assuntoLimpo.toUpperCase().includes(w)) {
          containForbidden = true;
          // Remover termos
          const regex = new RegExp(w.replace('$', '\\$'), 'gi');
          assuntoLimpo = assuntoLimpo.replace(regex, "");
        }
      });

      // Se a IA gerou de forma incorreta mas corrigida acima, ou se já estava no assunto, garantimos os avisos de risco
      const riscosFinais = [...(p.riscos || []), ...riscosIniciais];

      if (containForbidden) {
        // Garantir que não existam duplicatas de aviso no mesmo campo
        if (!riscosFinais.some((r: any) => r.mensagem.includes("termos proibidos"))) {
          riscosFinais.push({
            campo: "assunto",
            nivel: "alto",
            mensagem: "Filtro Automático de Proteção: Foram dectetados termos comerciais de conversão (% ou OFF ou R$ ou GRÁTIS) no assunto gerado. O assunto foi sanitizado para evitar a aba de Promoções ou marcação de Spam e restabelecer a entregabilidade nas principais caixas da caixa de entrada.",
            alternativaSugerida: "Utilize gatilhos baseados em curiosidade ou atualizações de status sem valores de faturamento numérico (ex: 'Presente liberado na sua conta')."
          });
        }
      }

      // Validar tamanho final do assunto
      const finalLen = assuntoLimpo.length;
      const minLen = isApice ? 27 : 16;
      const maxLen = isApice ? 47 : 39;
      if (finalLen < minLen || finalLen > maxLen) {
        if (!riscosFinais.some((r: any) => r.mensagem.includes("comprimento"))) {
          riscosFinais.push({
            campo: "assunto",
            nivel: "medio",
            mensagem: `O assunto proposto (${finalLen} caracteres) foge da faixa ideal recomendada para a marca ${marca} (deve possuir de ${minLen} a ${maxLen} caracteres).`,
            alternativaSugerida: `Ajustar assunto para atingir a zona de impacto visual em dispositivos móveis.`
          });
        }
      }

      // Atualizar assunto na pauta
      p.copy.assunto = assuntoLimpo;

      // Garantir ID e status no objeto final de pauta de volta ao cliente
      return {
        id: `pauta-${Date.now()}-${index}`,
        marca,
        modo: modo === 'B' ? 'B' : 'A',
        tipoGeracao,
        copy: p.copy,
        visual: p.visual,
        operacional: p.operacional,
        previsao: p.previsao,
        riscos: risksUnique(riscosFinais),
        status: 'rascunho',
        dataCriacao: new Date().toISOString()
      };
    });

    // Auto-registrar mecânicas novas geradas pela IA no catálogo do Supabase (fire-and-forget)
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

const VALID_IMAGE_RATIOS = ['1:1', '3:4', '16:9', '9:16', '4:3'];
const PIAPP_API_KEY = process.env.PIAPP_API_KEY;
const PIAPP_MCP_URL = 'https://piapp-v2.vercel.app/api/ai/mcp';

// Static fallbacks — overridden at runtime by crm_ai.marcas + crm_ai.emails data loaded at startup
const BRAND_DNA_FALLBACK: Record<string, {
  primaryColors: string;
  backgrounds: string;
  style: string;
  hitFormula: string;
  prohibitedColors: string;
}> = {
  Apice: {
    primaryColors: 'Forest Green #688D65 (dominant), Magenta #D553A5 (promo accent), Aqua #AAD4C7 (freshness), Leaf Green #A4CA7A (natural), Terracotta #B46D55 (warmth), Off-White #F4F1E5 (backgrounds)',
    backgrounds: 'Clean off-white #F4F1E5 or soft aqua tint — always calm, airy, warm.',
    style: 'Clean 2D organic or soft 3D digital illustration, warm feminine mood, natural soft lighting, premium editorial quality',
    hitFormula: 'ONE large central mechanic object (post-it, scissors, tic-tac-toe, gift box) filling 50–70% of frame on clean off-white bg. Optional feminine hand as interaction cue. One object = one emotion.',
    prohibitedColors: 'Avoid harsh neons and cold blues. Keep palette warm and organic.',
  },
  Barbours: {
    primaryColors: 'Ruby Red #BF0F26 (dominant — 60–70%), Gold #AA834B (luxury accents), Merlot #4F080E (depth), Pink Blush #FFCCD5 (high-converting background), Off-White #E7E3D8 (neutral)',
    backgrounds: 'Pastel pink #FFCCD5 (highest-converting), OR Off-White #E7E3D8, OR deep Merlot #4F080E for theatrical. Always ONE solid color.',
    style: 'Premium 3D illustrated luxury editorial style, dramatic studio lighting, sophisticated modern feminine, bold high-contrast',
    hitFormula: 'Dominant 3D central object in Ruby Red on pastel pink bg. Human hand creates interaction/anticipation. One large hero element.',
    prohibitedColors: 'NEVER use green, orange, yellow or cold blue — explicitly prohibited by brand guidelines.',
  },
};

// Returns brand context for PiApp prompt — uses live crm_ai data when loaded, falls back to hardcoded
function getBrandDna(marca: string) {
  const fallback = BRAND_DNA_FALLBACK[marca];
  if (!fallback) return null;

  const loaded = crmAiMarcas[marca];
  const hits = crmAiHits[marca] ?? [];

  // Build hit formula from real top-performing email data
  let hitFormula = fallback.hitFormula;
  if (hits.length > 0) {
    const hitLines = hits.slice(0, 5).map((h, i) =>
      `${i + 1}. "${h.mecanicaNome}" (${h.receita} receita, ${h.taxaAbertura} abertura): ${h.descricaoVisual.split('\n')[0]}`
    ).join('\n');
    hitFormula = `Proven revenue-driving visual patterns for ${marca} (real campaign data from Supabase):\n${hitLines}\nRule: ONE dominant central 3D illustrated object. Human interaction element. Clean solid background. No clutter.`;
  }

  // Use live palette if loaded, otherwise fallback
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

async function callPiAppMCP(method: string, params: any): Promise<any> {
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
  if (!dataLine) throw new Error(`PiApp MCP resposta inesperada: ${text.slice(0, 200)}`);
  return JSON.parse(dataLine.slice(6));
}

const VALID_IMAGE_MODELS = new Set([
  'wavespeed-gpt-image-2-t2i',
  'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview',
  'gemini-2.5-flash-image',
  'wavespeed-seedream-v5-lite',
]);
const DEFAULT_IMAGE_MODEL = 'wavespeed-gpt-image-2-t2i';

async function uploadReferenceToPiApp(base64DataUrl: string): Promise<string> {
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

async function generateImageViaPiApp(
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
      imageModel: rawModel,
      estiloIlustracao,
      paleta,
      mecanica,
      recompensa,
      referenciaImagem: rawRefImage,
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

    const frameStateGuide: Record<string, string> = {
      inicial:       'FRAME 1 — Initial closed/sealed state: the mechanic object is intact, pristine, and closed. Build maximum anticipation. Nothing is revealed yet.',
      intermediario: 'FRAME 2 — Mid-action state: the interaction is actively happening. The object is mid-motion, being opened, pulled, cut, or burst. Energy and movement.',
      final:         'FRAME 3 — Final revealed state: the reward is fully exposed, celebrated, and triumphant. Bright, joyful, satisfaction moment.',
    };
    const frameState = frameStateGuide[frameName as string] ?? frameStateGuide['inicial'];

    const paletaCores: string[] = Array.isArray(paleta?.cores) ? paleta.cores : [];
    const paletaOverride = paletaCores.length
      ? `Campaign-specific palette override — prioritize these HEX colors: ${paletaCores.join(', ')}.`
      : '';

    const illustrationStyleGuide = estiloIlustracao
      ? `Requested illustration style for this campaign: ${estiloIlustracao}.`
      : '';

    const mechanicGuide = mecanica
      ? `Central mechanic hero object: "${mecanica}" — this is THE subject of the illustration. Make it large, beautiful, and the absolute focal point.`
      : '';

    const rewardGuide = recompensa
      ? (frameName === 'final'
          ? `Reward revealed in this frame: "${recompensa}" — show it prominently, glowing, celebrated. This is the payoff.`
          : `Reward element: "${recompensa}" — keep it hidden or teased in this frame state.`)
      : '';

    const compositionVariants = [
      'Composition: centered hero object, slight 3/4 angle view, premium product placement.',
      'Composition: front-facing symmetrical layout, generous negative space top and bottom.',
      'Composition: dynamic diagonal tilt, object angled 15–20 degrees, energetic feel.',
      'Composition: top-down overhead view, clean flat-lay arrangement, editorial style.',
      'Composition: slight low-angle upward view, object feels grand and imposing.',
    ];
    const lightingVariants = [
      'Lighting: soft diffused studio light from above, gentle cast shadows below the object.',
      'Lighting: warm golden ambient glow, subtle rim light outlining the object edges.',
      'Lighting: clean cool white studio light, minimal shadows, crisp and modern.',
      'Lighting: dramatic single-source spotlight from upper-left, bold shadow play.',
      'Lighting: soft gradient ambient fill, delicate depth without harsh shadows.',
    ];
    const compVariant = compositionVariants[Math.floor(Math.random() * compositionVariants.length)];
    const lightVariant = lightingVariants[Math.floor(Math.random() * lightingVariants.length)];

    // Build the enriched prompt using real brand DNA and hit formulas
    const prompt = [
      `EMAIL MARKETING GIF BANNER FRAME — ${marca} beauty brand. This is frame "${frameName}" of a 3-frame animated GIF for a campaign email.`,
      '',
      `=== FRAME STATE ===`,
      frameState,
      `Scene description: ${frameDescription}`,
      mechanicGuide,
      rewardGuide,
      '',
      `=== BRAND VISUAL DNA — ${marca} ===`,
      `Visual style: ${brandDna.style}`,
      illustrationStyleGuide,
      `Color palette: ${brandDna.primaryColors}`,
      paletaOverride,
      `Background: ${brandDna.backgrounds}`,
      brandDna.prohibitedColors,
      '',
      `=== PROVEN HIT FORMULA (visual pattern that drives R$13k–R$19k revenue for ${marca}) ===`,
      brandDna.hitFormula,
      '',
      `=== COMPOSITION & LIGHTING ===`,
      compVariant,
      lightVariant,
      `The central hero subject occupies 50–70% of the total frame area. Leave the top ~25% mostly empty (headline text will be composited in production) and the bottom ~15% empty (CTA button area). Everything else is clean empty background — no competing elements, no secondary objects.`,
      `Aspect ratio output: ${aspectRatio}. Ensure the hero object is fully contained within the frame, not cropped by edges.`,
      '',
      `=== ABSOLUTE CONSTRAINTS ===`,
      `ZERO text — no letters, no numbers, no symbols, no price tags, no brand names, no promotional copy, no watermarks, no labels, no UI elements, no CTA buttons anywhere in the image. This is a pure illustration asset.`,
      `Quality level: ultra-detailed 4K premium illustration, photorealistic 3D rendering quality, suitable for luxury brand email marketing.`,
    ].filter(s => s !== undefined && s !== null && (s.trim() !== '' || s === '')).join('\n');

    // Upload reference image to PiApp if provided, then pass its URL to the generator
    let referenceImageUrls: string[] | undefined;
    if (typeof rawRefImage === 'string' && rawRefImage.startsWith('data:')) {
      try {
        const publicUrl = await uploadReferenceToPiApp(rawRefImage);
        referenceImageUrls = [publicUrl];
        console.log('[generate-image] Referência enviada ao PiApp:', publicUrl);
      } catch (uploadErr: any) {
        console.warn('[generate-image] Upload de referência falhou (ignorando):', uploadErr.message);
      }
    }

    const result = await generateImageViaPiApp(prompt, aspectRatio, imageModel, referenceImageUrls);

    // Save to crm_ai.ia_outputs via RPC proxy (fire-and-forget)
    if (supabase) {
      const marcaId = crmAiMarcas[marca]?.marcaId ?? (marca === 'Apice' ? 1 : 2);
      supabase.rpc('crm_ai_insert_ia_output', {
        p_marca_id:  marcaId,
        p_tipo_canal: 'email_gif',
        p_analisado:  frameDescription,
        p_prompt:     prompt,
        p_modelo:     imageModel,
        p_parametros: { aspectRatio, frameName: frameName ?? null, mecanica: mecanica ?? null, recompensa: recompensa ?? null },
        p_imagens:    [{
          frame:       frameName ?? 'desconhecido',
          model:       imageModel,
          aspect_ratio: aspectRatio,
          mime_type:   result.mimeType,
          gerado_em:   new Date().toISOString(),
          data_url:    `data:${result.mimeType};base64,${result.imageBytes}`,
        }],
      }).then(({ error }) => {
        if (error) console.warn('[ia_outputs] Falha ao salvar via RPC:', error.message);
        else console.log(`[ia_outputs] Imagem "${frameName}" (${marca}) salva no crm_ai.`);
      });
    }

    res.json(result);
  } catch (err: any) {
    console.error("[generate-image] Erro:", err);
    res.status(500).json({ error: "Falha ao gerar imagem com PiApp.", details: err.message });
  }
});

function risksUnique(arr: any[]) {
  const seen = new Set();
  return arr.filter(item => {
    const k = item.campo + item.mensagem;
    const duplicated = seen.has(k);
    seen.add(k);
    return !duplicated;
  });
}

// Endpoint secundário para gerar variação rápida de uma pauta existente
app.post("/api/generate-variation", async (req, res) => {
  try {
    const { pauta } = req.body;
    if (!pauta) {
      return res.status(400).json({ error: "Dados da pauta original são necessários." });
    }

    const { marca, operacional } = pauta;
    const isApice = marca === 'Apice';

    const systemInstruction = `Você é um refinador de e-mails para equipe de CRM. Sua tarefa única é fornecer uma variação alternativa do assunto, headline e CTA mantendo a mesma mecânica e recompensa em conformidade estrita com o playbook de ${marca}. Não altere o pré-header.`;

    const instructionsPrompt = `Refine e me dê uma nova alternativa de Copy (Assunto, Headline, CTA) para a seguinte pauta de CRM:
Marca: ${marca}
Mecânica original: ${operacional.mecanicaEscolhida}
Recompensa original: ${operacional.recompensaEscolhida}

Assunto antigo: "${pauta.copy.assunto}"
Headline do banner antigo: "${pauta.copy.headlineBanner}"
CTA antigo: "${pauta.copy.ctaBotao}"

Regras invioláveis de assunto para ${marca}:
- NUNCA use Caps Lock inteiro.
- NUNCA use as palavras ou símbolos "%", "OFF", "GRÁTIS", "R$".
- Máximo de 2 emojis.
- Tamanho: entre ${isApice ? '27 e 47' : '16 e 39'} caracteres.
- Pré-header de ser fixo em: "Mas, vou precisar cancelar em breve".

Retorne em formato JSON contendo o objeto de copy refinado.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: instructionsPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            assunto: { type: Type.STRING },
            preHeader: { type: Type.STRING },
            headlineBanner: { type: Type.STRING },
            subHeadlineBanner: { type: Type.STRING },
            ctaBotao: { type: Type.STRING }
          },
          required: ["assunto", "preHeader", "headlineBanner", "subHeadlineBanner", "ctaBotao"]
        }
      }
    });

    const parsedCopy = JSON.parse(response.text || "{}");
    parsedCopy.preHeader = "Mas, vou precisar cancelar em breve";

    res.json({ status: "success", data: parsedCopy });
  } catch (err: any) {
    console.error("Erro na geração de variação:", err);
    res.status(500).json({ error: "Erro ao gerar variação.", details: err.message });
  }
});

// Setup com o Vite em modo de desenvolvimento ou produção
const isProduction = process.env.NODE_ENV === "production";

async function startServer() {
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

startServer();
