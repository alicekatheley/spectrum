import dotenv from "dotenv";
dotenv.config();
import { BigQuery } from "@google-cloud/bigquery";

// ─────────────────────────────────────────────────────────────────────────────
// Fonte de verdade do modelo de calendário: dataset `crm_modelo` no BigQuery.
//
// Este módulo existe para corrigir um erro específico e caro: o gerador de
// calendário rodava sobre um catálogo de ofertas INVENTADO ("Família A",
// "R$ 50 OFF", "Lançamento Linha Ruby") porque se concluiu que não havia dados.
// Havia. O dataset abaixo já tinha catálogo real, índices estimados com
// intervalo de confiança, veredito de transferência e censo de viabilidade.
//
// Regra que este módulo impõe: NÃO EXISTE FALLBACK PARA NÚMERO INVENTADO.
// Se o BigQuery não responder, `getContextoModelo()` devolve null e quem chama
// tem de dizer isso na tela. Um plano bonito com números fabricados é pior que
// tela vazia, porque é indistinguível de um plano verdadeiro.
// ─────────────────────────────────────────────────────────────────────────────

const PROJETO = process.env.BIGQUERY_PROJECT_ID ?? "gogroup-crm";
const DATASET = `${PROJETO}.crm_modelo`;
// Dataset do modelo de segmentação (calendário por célula: cli/lea × tier).
// Só Barbours está implementado nele; ver HANDOFF_CALENDARIO_APP.md.
const DATASET_SEG = `${PROJETO}.crm_modelo_seg`;

export const bq: BigQuery | null = (() => {
  try {
    // Credencial vem de ADC: GOOGLE_APPLICATION_CREDENTIALS apontando para o JSON
    // da service account, ou `gcloud auth application-default login` na máquina.
    // O construtor não valida credencial — só a primeira query falha. Por isso o
    // teste de verdade é `carregarContextoModelo`, não este bloco.
    return new BigQuery({ projectId: PROJETO });
  } catch (err: any) {
    console.warn("[BigQuery] Cliente não inicializado:", err.message);
    return null;
  }
})();

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** Uma oferta do catálogo real, com a família a que pertence. */
export interface OfertaCatalogo {
  oferta: string;
  familia: string;
  agressividade: number; // 1 leve .. 4 muito pesada
}

/**
 * Um nível estimado de um índice. `nivel` significa coisa diferente por índice —
 * e essa diferença é a parte que mais confunde:
 *
 *   I1_dia     → 'Quarta', 'Sabado', ...      (dia da semana)
 *   I2_familia → '<12h', '24-48h', '7-30d'    (FAIXA DE INTERVALO, não família!)
 *   I3_hora    → '9', '19', '20'              (hora cheia)
 *   I4_oferta  → 'Necessaire Bege', ...       (oferta)
 *   I6_alpha   → null                         (escalar)
 *
 * I2 é o que mais engana pelo nome. Ele NÃO ranqueia famílias por qualidade: ele
 * mede quanto a receita responde ao TEMPO desde que aquela família foi usada por
 * último. Não existe "melhor família" nesse índice — existe melhor espaçamento.
 */
export interface NivelIndice {
  nivel: string | null;
  /** Índice CRU, como medido na janela de treino. Diagnóstico, não planejamento. */
  valor: number;
  /**
   * `valor ^ peso` — o número que se usa. O expoente vem do walk-forward e já
   * está encolhido pela própria incerteza, então índice que o teste não
   * distinguiu de ruído chega aqui como 1 (neutro) sem precisar de limiar.
   * Ver sql/bigquery/peso_transferencia_e_corte_rolante.sql.
   */
  valorEfetivo: number;
  /** Expoente aplicado. 0 = neutralizado, 1 = usado como medido. NULL em I6_alpha. */
  peso: number | null;
  ic80Lo: number | null;
  ic80Hi: number | null;
  nObservacoes: number | null;
  veredito: string | null;
}

export interface IndicesMarca {
  geradoEm: string;
  janelaIni: string | null;
  janelaFim: string | null;
  /** Fronteira treino/teste do walk-forward. Rolante (hoje − 1 mês), muda todo dia. */
  corteWalkforward: string | null;
  /** Quanto de cada índice se confirma fora da amostra. 1 = integral, 0 = ruído. */
  transferencia: Record<string, number | null>;
  i1Dia: NivelIndice[];
  i2Gap: NivelIndice[];
  i3Hora: NivelIndice[];
  i4Oferta: NivelIndice[];
  alpha: number | null;
}

export interface ViabilidadeDow {
  /** 0 = Domingo .. 6 = Sábado — JÁ CONVERTIDO para a convenção de Date.getDay(). */
  dow: number;
  diasObservados: number;
  dias1Oferta: number;
  dias2Ofertas: number;
  dias3Ofertas: number;
}

export interface ConfigMarcaBq {
  ativo: boolean;
  janelaDias: number;
  burnInDias: number;
  janelaAtribuicaoH: number;
  maxDiasCom3: number | null;
  /** 0 = Domingo .. 6 = Sábado. */
  diasAtivos: number[];
  volumeMaximoSemana: number | null;
  minEnviadosSlot: number | null;
  maxOfertaSemana: number | null;
  /** Índice = dow (0=Domingo). Vazio quando a marca não declarou grade. */
  gradeHorarios: number[][];
  dataMinEvento: string | null;
}

/** Âncora medida das últimas 4 semanas (§4.4). É daqui que sai o RPM base. */
export interface BaselineMarca {
  dias: number;
  enviados: number;
  receita: number;
  rpm: number;
  volumeSemana: number;
  dataFim: string;
}

/**
 * Diagnóstico de quanto o catálogo realmente descreve o que foi disparado.
 *
 * Existe porque "6 famílias, 22 ofertas" servido como verdade limpa repete, em
 * outra forma, o erro do catálogo inventado: dá ao leitor uma precisão que o dado
 * não tem. O catálogo é preenchido À MÃO (`marca_oferta_familia`) e a classificação
 * vem de um CASE de LIKEs (`marca_config.oferta_case`) — as duas coisas envelhecem
 * contra a operação e falham em silêncio, sempre para o mesmo lado: oferta que o
 * CASE não reconhece vira 'OUTROS' e some, sem erro nenhum.
 */
export interface CoberturaCatalogo {
  enviadosTotal: number;
  enviadosSemOferta: number;
  /** Fração do volume que o classificador não soube nomear. */
  shareSemOferta: number;
  /** Catalogadas mas nunca observadas na janela — ou morreram, ou o CASE não as pega. */
  ofertasNuncaDisparadas: string[];
}

/**
 * Nomes de campanha que o classificador não soube nomear, com volume.
 *
 * Sai numa rota separada e sob demanda porque varre a tabela de eventos brutos da
 * marca — caro demais para rodar a cada boot, e é diagnóstico, não insumo do plano.
 *
 * É este o cruzamento que importa: `cobertura.shareSemOferta` diz QUANTO se perdeu,
 * só isto diz O QUÊ. Sem ele, uma oferta que a operação roda de verdade some dentro
 * de 'OUTROS' e o catálogo continua parecendo completo.
 */
export interface CampanhaNaoClassificada {
  nome: string | null;
  envios: number;
}

export interface ContextoMarca {
  marca: string;
  config: ConfigMarcaBq;
  catalogo: OfertaCatalogo[];
  indices: IndicesMarca;
  viabilidade: ViabilidadeDow[];
  baseline: BaselineMarca;
  cobertura: CoberturaCatalogo;
}

// ─── Estado ──────────────────────────────────────────────────────────────────

let _contexto: Record<string, ContextoMarca> | null = null;
let _carregadoEm: string | null = null;
let _erro: string | null = null;

/** null = nunca carregou com sucesso. Quem chama PRECISA tratar esse null. */
export const getContextoModelo = () => _contexto;
export const getContextoMarca = (marca: string): ContextoMarca | null =>
  _contexto?.[marca.toLowerCase()] ?? null;
export const getStatusBigQuery = () => ({
  disponivel: _contexto !== null,
  carregadoEm: _carregadoEm,
  erro: _erro,
  marcas: _contexto ? Object.keys(_contexto) : [],
});

// ─── Conversões ──────────────────────────────────────────────────────────────

/**
 * BigQuery EXTRACT(DAYOFWEEK) é 1=Domingo..7=Sábado; Date.getDay() é 0..6.
 * Converter na FRONTEIRA e nunca depois: um off-by-one aqui não quebra nada,
 * só desloca o calendário inteiro em um dia e continua parecendo plausível.
 */
const dowBqParaJs = (dow: number) => dow - 1;

const NOME_DOW: Record<string, number> = {
  domingo: 0, segunda: 1, terca: 2, terça: 2, quarta: 3,
  quinta: 4, sexta: 5, sabado: 6, sábado: 6,
};

const nomeParaDow = (nome: string) => NOME_DOW[nome.trim().toLowerCase()] ?? -1;

/** BigQuery devolve DATE/TIMESTAMP como objeto {value}, não string. */
const comoTexto = (v: any): string | null =>
  v == null ? null : typeof v === "object" && "value" in v ? String(v.value) : String(v);

const comoNumero = (v: any): number | null =>
  v == null ? null : typeof v === "object" && "value" in v ? Number(v.value) : Number(v);

// ─── Carga ───────────────────────────────────────────────────────────────────

async function consultar<T = any>(sql: string): Promise<T[]> {
  if (!bq) throw new Error("cliente BigQuery não inicializado");
  // Sem `location` fixo: o dataset não está na multi-região US, e fixar região errada
  // devolve "Dataset not found", que se lê como "a tabela não existe" e manda quem
  // depura procurar o problema no lugar errado.
  const [linhas] = await bq.query({ query: sql });
  return linhas as T[];
}

/**
 * Campanhas que caíram em 'OUTROS'. Roda o MESMO CASE que o pipeline usa, lido de
 * `marca_config.oferta_case`, para não haver risco de o diagnóstico discordar do
 * pipeline por ter reimplementado a regra.
 *
 * O CASE é interpolado no SQL. Isso é injeção por construção, e é aceitável aqui por
 * dois motivos que precisam valer sempre: a coluna GUARDA uma expressão SQL (é o
 * contrato da tabela, escrita pelo time de CRM), e `marca` é validada contra as
 * chaves do contexto já carregado — nunca vai crua para o nome do dataset.
 */
export async function campanhasNaoClassificadas(
  marca: string,
  limite = 50,
): Promise<CampanhaNaoClassificada[]> {
  const slug = marca.toLowerCase();
  if (!_contexto || !_contexto[slug]) throw new Error(`marca "${marca}" não está no modelo`);

  const [cfg] = await consultar<{ oferta_case: string }>(
    `SELECT oferta_case FROM \`${DATASET}.marca_config\` WHERE marca = '${slug}'`,
  );
  if (!cfg?.oferta_case) throw new Error(`marca "${slug}" não tem oferta_case configurado`);

  const ini = _contexto[slug].config.dataMinEvento ?? "2026-04-09";
  return consultar<CampanhaNaoClassificada>(`
    WITH e AS (
      SELECT e_campaign_name AS nome, LOWER(e_campaign_name) AS c, COUNT(*) AS envios
      FROM \`${PROJETO}.crm_${slug}.crm_eventos_brutos\`
      WHERE event_name = 'email_sent' AND DATE(e_timestamp) >= '${ini}'
      GROUP BY 1, 2
    )
    SELECT nome, envios FROM e
    WHERE nome IS NULL OR (${cfg.oferta_case}) = 'OUTROS'
    ORDER BY envios DESC
    LIMIT ${Math.max(1, Math.min(500, Math.trunc(limite)))}`);
}

// ─── Modelo de segmentação (crm_modelo_seg) ──────────────────────────────────
// Views separadas do modelo de ofertas: respondem "para quem e quando", não
// "o quê". Barbours é a única marca implementada — o handoff é explícito.

export interface CelulaResumo {
  celula: string;
  slotsPasso1: number;
  slotsSugeridos: number;
  pessoasSemana: number;
  enviosSemanaHoje: number;
  doseMediaHoje: number | null;
  indiceValor: number;
  pctEnvios: number | null;
  pctReceita: number | null;
}

export interface SlotCelula {
  celula: string;
  dowNum: number;      // 1=dom .. 7=sáb (convenção do BigQuery, MANTIDA aqui — a UI recebe crua)
  dow: string;         // Sun..Sat
  turno: string;       // 1_manha_8_12 | 2_tarde_12_19 | 3_noite_19_00
  indice: number;
  rankSlot: number;    // 1 = melhor slot daquela célula
  envios: number;
}

export interface SegmentacaoCalendario {
  marca: string;
  resumo: CelulaResumo[];
  slots: SlotCelula[];
}

export async function segmentacaoCalendario(marca: string): Promise<SegmentacaoCalendario> {
  // As views hoje já filtram Barbours no SQL da view (marca única implementada).
  // Manter o argumento como interface para o dia em que outra marca entrar sem
  // reescrever o front — a normalização vai igual à do resto do módulo.
  const [resumo, slots] = await Promise.all([
    consultar(`
      SELECT celula, slots_passo1, slots_sugeridos, pessoas_semana,
             envios_semana_hoje, dose_media_hoje, indice_valor,
             pct_envios, pct_receita
      FROM \`${DATASET_SEG}.v_celula_resumo\`
      ORDER BY indice_valor DESC`),
    consultar(`
      SELECT celula, dow_num, dow, turno, indice, rank_slot, envios
      FROM \`${DATASET_SEG}.v_slot_celula\`
      ORDER BY celula, rank_slot`),
  ]);

  return {
    marca: marca.toLowerCase(),
    resumo: resumo.map((r: any) => ({
      celula: String(r.celula),
      slotsPasso1: Number(r.slots_passo1 ?? 0),
      slotsSugeridos: Number(r.slots_sugeridos ?? 0),
      pessoasSemana: Number(r.pessoas_semana ?? 0),
      enviosSemanaHoje: Number(r.envios_semana_hoje ?? 0),
      doseMediaHoje: comoNumero(r.dose_media_hoje),
      indiceValor: Number(r.indice_valor ?? 0),
      pctEnvios: comoNumero(r.pct_envios),
      pctReceita: comoNumero(r.pct_receita),
    })),
    slots: slots.map((s: any) => ({
      celula: String(s.celula),
      dowNum: Number(s.dow_num),
      dow: String(s.dow),
      turno: String(s.turno),
      indice: Number(s.indice ?? 0),
      rankSlot: Number(s.rank_slot),
      envios: Number(s.envios ?? 0),
    })),
  };
}

/**
 * Carrega o contexto do modelo para todas as marcas ativas. Chamada no boot e
 * relançável por rota. É tudo agregado — cinco queries pequenas, nenhuma varre
 * evento bruto, então cabe em boot sem custo relevante de slot.
 */
export async function carregarContextoModelo(): Promise<boolean> {
  if (!bq) {
    _erro = "cliente BigQuery não inicializado";
    return false;
  }
  try {
    const [configs, catalogo, indices, viabilidade, baseline, observadas] = await Promise.all([
      consultar(`
        SELECT marca, ativo, janela_dias, burn_in_dias, janela_atribuicao_h,
               max_dias_com_3, dias_ativos, volume_maximo_semana, min_enviados_slot,
               max_oferta_semana, TO_JSON_STRING(grade_horarios) AS grade_json,
               data_min_evento
        FROM \`${DATASET}.marca_config\`
        WHERE ativo`),
      consultar(`
        SELECT marca, familia, oferta, agressividade
        FROM \`${DATASET}.marca_oferta_familia\`
        ORDER BY marca, familia, oferta`),
      consultar(`
        SELECT marca, indice, nivel, valor, valor_efetivo, peso_transferencia,
               ic80_lo, ic80_hi, n_observacoes,
               coef_transferencia, veredito, janela_ini, janela_fim,
               corte_walkforward, gerado_em
        FROM \`${DATASET}.v_indices_atuais\``),
      consultar(`
        SELECT marca, dow, dias_observados, dias_1_oferta, dias_2_ofertas, dias_3_ofertas
        FROM \`${DATASET}.v_viabilidade\``),
      // Âncora de 4 semanas (§4.4): RPM e volume MEDIDOS, não estipulados. A janela
      // termina no último dia com fato, não em CURRENT_DATE — senão um atraso de
      // ingestão vira "a marca parou de vender".
      consultar(`
        WITH fim AS (SELECT marca, MAX(data) AS d FROM \`${DATASET}.fato_slot\` GROUP BY 1)
        SELECT f.marca,
               COUNT(DISTINCT f.data) AS dias,
               SUM(f.enviados) AS enviados,
               SUM(f.receita) AS receita,
               SAFE_DIVIDE(SUM(f.receita), SUM(f.enviados)) * 1000 AS rpm,
               MAX(fim.d) AS data_fim
        FROM \`${DATASET}.fato_slot\` f
        JOIN fim ON fim.marca = f.marca
        WHERE f.data > DATE_SUB(fim.d, INTERVAL 28 DAY)
        GROUP BY 1`),
      // Ofertas efetivamente observadas na janela inteira, para cruzar com o catálogo.
      consultar(`
        SELECT marca, oferta, familia, SUM(enviados) AS enviados
        FROM \`${DATASET}.fato_slot\`
        GROUP BY 1,2,3`),
    ]);

    const ctx: Record<string, ContextoMarca> = {};

    for (const c of configs) {
      const marca = String(c.marca).toLowerCase();

      const grade: number[][] = Array.from({ length: 7 }, () => [] as number[]);
      if (c.grade_json && c.grade_json !== "null") {
        const bruto = JSON.parse(c.grade_json) as Record<string, number[]>;
        for (const [nome, horas] of Object.entries(bruto)) {
          const d = nomeParaDow(nome);
          if (d >= 0) grade[d] = [...horas].sort((a, b) => a - b);
        }
      }

      ctx[marca] = {
        marca,
        config: {
          ativo: Boolean(c.ativo),
          janelaDias: Number(c.janela_dias),
          burnInDias: Number(c.burn_in_dias),
          janelaAtribuicaoH: Number(c.janela_atribuicao_h),
          maxDiasCom3: comoNumero(c.max_dias_com_3),
          diasAtivos: ((c.dias_ativos as string[]) ?? [])
            .map(nomeParaDow)
            .filter((d) => d >= 0)
            .sort((a, b) => a - b),
          volumeMaximoSemana: comoNumero(c.volume_maximo_semana),
          minEnviadosSlot: comoNumero(c.min_enviados_slot),
          maxOfertaSemana: comoNumero(c.max_oferta_semana),
          gradeHorarios: grade,
          dataMinEvento: comoTexto(c.data_min_evento),
        },
        catalogo: [],
        indices: {
          geradoEm: "",
          janelaIni: null,
          janelaFim: null,
          corteWalkforward: null,
          transferencia: {},
          i1Dia: [],
          i2Gap: [],
          i3Hora: [],
          i4Oferta: [],
          alpha: null,
        },
        viabilidade: [],
        baseline: { dias: 0, enviados: 0, receita: 0, rpm: 0, volumeSemana: 0, dataFim: "" },
        cobertura: {
          enviadosTotal: 0,
          enviadosSemOferta: 0,
          shareSemOferta: 0,
          ofertasNuncaDisparadas: [],
        },
      };
    }

    for (const o of catalogo) {
      const m = ctx[String(o.marca).toLowerCase()];
      if (!m) continue;
      m.catalogo.push({
        oferta: String(o.oferta),
        familia: String(o.familia),
        agressividade: Number(o.agressividade ?? 1),
      });
    }

    for (const i of indices) {
      const m = ctx[String(i.marca).toLowerCase()];
      if (!m) continue;
      const nivel: NivelIndice = {
        nivel: i.nivel == null ? null : String(i.nivel),
        valor: Number(i.valor),
        valorEfetivo: comoNumero(i.valor_efetivo) ?? Number(i.valor),
        peso: comoNumero(i.peso_transferencia),
        ic80Lo: comoNumero(i.ic80_lo),
        ic80Hi: comoNumero(i.ic80_hi),
        nObservacoes: comoNumero(i.n_observacoes),
        veredito: i.veredito == null ? null : String(i.veredito),
      };
      m.indices.geradoEm = comoTexto(i.gerado_em) ?? m.indices.geradoEm;
      m.indices.janelaIni = comoTexto(i.janela_ini) ?? m.indices.janelaIni;
      m.indices.janelaFim = comoTexto(i.janela_fim) ?? m.indices.janelaFim;
      m.indices.corteWalkforward = comoTexto(i.corte_walkforward) ?? m.indices.corteWalkforward;
      m.indices.transferencia[String(i.indice)] = comoNumero(i.coef_transferencia);

      switch (String(i.indice)) {
        case "I1_dia": m.indices.i1Dia.push(nivel); break;
        case "I2_familia": m.indices.i2Gap.push(nivel); break;
        case "I3_hora": m.indices.i3Hora.push(nivel); break;
        case "I4_oferta": m.indices.i4Oferta.push(nivel); break;
        case "I6_alpha": m.indices.alpha = nivel.valor; break;
      }
    }

    for (const v of viabilidade) {
      const m = ctx[String(v.marca).toLowerCase()];
      if (!m) continue;
      m.viabilidade.push({
        dow: dowBqParaJs(Number(v.dow)),
        diasObservados: Number(v.dias_observados),
        dias1Oferta: Number(v.dias_1_oferta),
        dias2Ofertas: Number(v.dias_2_ofertas),
        dias3Ofertas: Number(v.dias_3_ofertas),
      });
    }
    for (const m of Object.values(ctx)) m.viabilidade.sort((a, b) => a.dow - b.dow);

    for (const b of baseline) {
      const m = ctx[String(b.marca).toLowerCase()];
      if (!m) continue;
      const dias = Number(b.dias);
      const enviados = Number(b.enviados);
      m.baseline = {
        dias,
        enviados,
        receita: Number(b.receita),
        rpm: Number(b.rpm),
        volumeSemana: dias > 0 ? Math.round((enviados / dias) * 7) : 0,
        dataFim: comoTexto(b.data_fim) ?? "",
      };
    }

    // Cobertura: cruza o que foi disparado contra o que está catalogado.
    const vistas = new Map<string, Map<string, number>>();
    for (const o of observadas) {
      const marca = String(o.marca).toLowerCase();
      const m = ctx[marca];
      if (!m) continue;
      if (!vistas.has(marca)) vistas.set(marca, new Map());
      vistas.get(marca)!.set(String(o.oferta), Number(o.enviados ?? 0));
      m.cobertura.enviadosTotal += Number(o.enviados ?? 0);
      // 'Sem Oferta'/'OUTROS' é o balde do que o CASE não reconheceu. Não é uma
      // família de verdade — é a medida do próprio desconhecimento.
      if (String(o.familia) === "Sem Oferta" || String(o.oferta) === "OUTROS") {
        m.cobertura.enviadosSemOferta += Number(o.enviados ?? 0);
      }
    }
    for (const [marca, m] of Object.entries(ctx)) {
      const doMarca = vistas.get(marca) ?? new Map<string, number>();
      const catalogadas = new Set(m.catalogo.map((o) => o.oferta));
      m.cobertura.shareSemOferta =
        m.cobertura.enviadosTotal > 0
          ? m.cobertura.enviadosSemOferta / m.cobertura.enviadosTotal
          : 0;
      m.cobertura.ofertasNuncaDisparadas = [...catalogadas]
        .filter((o) => o !== "OUTROS" && !doMarca.has(o))
        .sort();
    }

    _contexto = ctx;
    _carregadoEm = new Date().toISOString();
    _erro = null;

    const resumo = Object.values(ctx)
      .map((m) => `${m.marca}(${new Set(m.catalogo.map((o) => o.familia)).size}fam)`)
      .join(" ");
    console.log(
      `[BigQuery] Contexto do modelo carregado: ${resumo} — janela ${
        Object.values(ctx)[0]?.indices.janelaIni ?? "?"
      }..${Object.values(ctx)[0]?.indices.janelaFim ?? "?"}`,
    );
    return true;
  } catch (err: any) {
    _erro = err.message;
    console.warn(
      `[BigQuery] FALHA ao carregar contexto do modelo: ${err.message}\n` +
        `           O gerador de calendário fica indisponível — sem fallback inventado, de propósito.`,
    );
    return false;
  }
}
