import {
  CalendarioGerado,
  CalendarioSlot,
  DiaSemana,
  EtapaDecomposicao,
  InputCalendario,
  MarcaCalendario,
  PontoFronteira,
  PrevisaoCalendario,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Placeholder determinístico do gerador de calendário.
//
// A Fase 3 do roadmap (o gerador propriamente dito) não existe — nada aqui vem do
// BigQuery, do snapshot de índices ou do histórico. Esta fixture existe por um motivo
// só: exercitar a tela com um payload no formato EXATO da §9.1, incluindo os campos
// que a §14 torna obrigatórios. Quando a rota existir, trocar a chamada em
// CalendarioWorkspace por um fetch — nenhum componente precisa mudar.
//
// As restrições das Fases 1–5 estão implementadas de verdade (gate de viabilidade,
// teto de dias com 3 ofertas, nunca duas famílias iguais no dia, pesos de volume)
// porque uma fixture que as violasse produziria uma tela que mente sobre o modelo.
// ─────────────────────────────────────────────────────────────────────────────

// Marcas que o modelo não cobre. Vazio desde 25/08/2026: a Gocase entrou depois que
// o Spree passou a gravar UTM (v2 da tabela, retroativa a 27/04). O buraco de dados
// 08/07-25/07 é filtrado direto no sp_carrega_fato_slot, então o front não precisa
// saber dele.
export const MARCAS_SEM_MODELO: MarcaCalendario[] = [];

// `MarcaAtiva` era Exclude<..., 'Gocase'> enquanto ela não gerava. Hoje as 6 marcas
// entram no CONFIG placeholder, então é apenas o próprio `MarcaCalendario`.
type MarcaAtiva = MarcaCalendario;

// Elasticidade de volume dentro do dia (§6.1). receita ∝ V^0.31, portanto RPM ∝ V^-0.69.
const ALPHA = 0.31;

const DIAS: DiaSemana[] = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];

// DIAS é o enum do schema (§9.1) e é sem acento de propósito — é chave de dado, não texto.
// Avisos e restrições, porém, são frases lidas por gente: "Sabado" e "Terca" num aviso são
// erro de português, não detalhe técnico. São dois usos diferentes, por isso duas listas —
// nunca DIAS em prosa, nunca DIAS_EXTENSO no campo diaSemana.
const DIAS_EXTENSO: string[] = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Pesos de volume dentro do dia, entre slots (Fase 3).
const PESOS_SLOT: Record<number, number[]> = {
  1: [1.0],
  2: [0.58, 0.42],
  3: [0.42, 0.32, 0.26],
};

// Grade de horários por dia da semana (§7.3). Índice = dow, 0 = Domingo.
const GRADE: number[][] = [
  [10, 19],
  [9, 15, 19],
  [8, 15, 19],
  [9, 15, 20],
  [9, 16, 20],
  [9, 15, 19],
  [10, 16],
];

// I1 — índice de qualidade por dia da semana. Alavanca #1, coeficiente 0,90.
const INDICE_DIA: number[] = [0.82, 1.05, 1.18, 1.29, 1.12, 0.95, 0.78];

// Fase 1 — censo de viabilidade: dias observados com 3 ofertas, por dow.
// Domingo = 0 em 137 dias, logo Domingo é célula bloqueada (H3).
const SUPORTE_3_OFERTAS: number[] = [0, 1, 8, 5, 8, 2, 2];

/**
 * Procedência do catálogo. São três estados diferentes e a tela precisa distingui-los,
 * porque a confiança que cada um merece é diferente:
 *
 *  'sintetico' — inventado por mim. Não descreve a marca. Ler só a forma do plano.
 *  'ditado'    — ditado por quem opera a marca. Os nomes são reais; a LISTA é de memória,
 *                então é incompleta por construção e envelhece sozinha.
 *  'dados'     — derivado do histórico no BigQuery. Ainda não existe (Fase 3).
 */
type Procedencia = 'sintetico' | 'ditado' | 'dados';

export interface ConfigMarca {
  diasAtivos: number[]; // H5 — dias inativos permanecem inativos
  maxDiasCom3: number; // H1 — teto operacional por semana (§1.3)
  familias: { nome: string; ofertas: string[]; agressividade: number }[];
  volumeSemana: number; // volume_maximo_semana (§7.3)
  rpmBase: number; // âncora: RPM real das últimas 4 semanas (§4.4)
  procedencia: Procedencia;

  // ── Abaixo: o que antes eram constantes de módulo ────────────────────────
  // Eram quatro `const` no topo do arquivo, iguais para todas as marcas, medidas
  // uma vez para Lescent e aplicadas a Barbour's, Ápice, Kokeshi e Rituária sem
  // ninguém dizer isso na tela. Viraram campos de config porque cada marca tem a
  // sua grade, o seu perfil de dia e o seu censo de viabilidade no BigQuery —
  // e porque a alternativa (ler a constante global) é indistinguível, no código,
  // de ter medido a marca certa.
  grade: number[][]; // §7.3 — janelas por dia da semana, índice = dow
  indiceDia: number[]; // I1 — qualidade por dia da semana, índice = dow
  suporte3: number[]; // Fase 1 — dias observados com 3 ofertas, por dow (H3)
  alpha: number; // §6.1 — elasticidade de volume: receita ∝ V^alpha
  /** I2 real por família, quando vem do BigQuery. Ausente ⇒ derivado da semente. */
  indiceFamilia?: Record<string, number>;

  // Os três abaixo chegam já encolhidos por nível (ver `indiceEncolhido` em
  // calendarioContexto.ts). Ausentes ⇒ neutros: é o que acontece com o catálogo
  // sintético, que não tem medição nenhuma para oferecer.
  /** I3 — chave é a hora cheia em texto ('9', '19'). */
  indiceHora?: Record<string, number>;
  /** I4 — chave é o nome da oferta. */
  indiceOferta?: Record<string, number>;
  /** I2 — chave é a faixa de intervalo desde o disparo anterior da família ('<12h', '2-4d'). */
  indiceGap?: Record<string, number>;
}

const TODOS_OS_DIAS = [0, 1, 2, 3, 4, 5, 6];

// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO SINTÉTICO — nenhuma linha daqui descreve as marcas de verdade.
//
// A versão anterior tinha rótulos como "Lançamento Linha Ruby" e "R$ 50 OFF": nomes
// plausíveis, e por isso mesmo o pior tipo de placeholder. A tela ficava indistinguível
// de uma tela que sabe o que a marca vende, e o erro só aparecia para quem conhecia o
// catálogo real — Barbour's não lança à noite, Lescent nunca fez R$ 50 OFF, Kokeshi não
// lança todo dia. Um rótulo obviamente falso é lido como pendência; um rótulo plausível
// e errado é lido como fato. A troca abaixo é deliberada: prefere-se parecer inacabado
// a parecer informado.
//
// O que é sintético aqui: nomes de família, nomes de oferta, volumeSemana e rpmBase.
// O que é do modelo e continua valendo: a ESTRUTURA — H2 (uma família por dia), o
// escalonamento de agressividade que alimenta I2, o teto semanal H1 e os dias ativos H5.
// Trocar os rótulos por dados reais não muda o comportamento do gerador, só o texto.
//
// Ao ligar a Fase 3, esta constante inteira sai e o catálogo passa a vir do BigQuery.
// ─────────────────────────────────────────────────────────────────────────────

/** Rótulos posicionais: A1, A2… Não são ofertas, são casas vazias com endereço. */
const familiasSinteticas = (n: number): ConfigMarca['familias'] =>
  ['A', 'B', 'C', 'D', 'E'].slice(0, n).map((letra, i) => ({
    nome: `Família ${letra}`,
    ofertas: [`Oferta ${letra}1`, `Oferta ${letra}2`],
    // Agressividade escalonada 1..4: o que importa para I2 é a ORDEM entre as famílias,
    // não o rótulo. Essa parte sobrevive à troca pelo catálogo real.
    agressividade: (i % 4) + 1,
  }));

// ─────────────────────────────────────────────────────────────────────────────
// LESCENT — catálogo DITADO pelo operador da marca, não derivado de dados.
//
// O corte em famílias segue duas regras que vieram do próprio operador:
//  (a) formato separa família: cair em % e cair em reais são coisas diferentes;
//  (b) escopo separa família: 100ml, 25ml, site inteiro e produto específico são
//      percebidos como ofertas distintas mesmo com o mesmo desconto nominal.
//
// Isso puxa o catálogo para MAIS famílias, e granularidade não é neutra: família é a
// unidade de fadiga (H2 e o descanso de 48h operam sobre ela). Quanto mais fino o corte, menos fadiga
// o modelo enxerga — "Cupom 15%" e "Cupom 18%" em dias seguidos contam como famílias
// diferentes e o cliente vê a mesma coisa. O corte abaixo é uma PROPOSTA de granularidade,
// não uma conclusão; é o item que mais precisa de revisão antes de valer alguma coisa.
// ─────────────────────────────────────────────────────────────────────────────
const FAMILIAS_LESCENT: ConfigMarca['familias'] = [
  // Agressividade 1 — sem concessão de preço.
  { nome: 'Amostra', ofertas: ['Escolha sua amostra'], agressividade: 1 },

  // Agressividade 2 — brinde agregado, preço intacto.
  {
    nome: 'Necessaire',
    ofertas: [
      'Necessaire + brinde surpresa',
      'Necessaire + porta perfume',
      'Necessaire + amostras',
      'Escolha sua necessaire',
    ],
    agressividade: 2,
  },

  // Expresso é MECÂNICA (urgência intradiária: três janelas no mesmo dia, preço subindo
  // a cada uma), não um nível de desconto. Está separado de "Cupom" de propósito: o
  // cliente percebe urgência, não só desconto. Dividido em valor vs. percentual porque
  // o operador apontou que o formato difere — um derruba o preço, o outro a porcentagem.
  { nome: 'Expresso valor', ofertas: ['Expresso 100ml', 'Expresso 25ml'], agressividade: 3 },
  {
    nome: 'Expresso percentual',
    ofertas: ['Expresso 18%', 'Expresso 15%', 'Expresso 12%'],
    agressividade: 3,
  },

  // Agressividade 3 — desconto percentual sem urgência.
  {
    nome: 'Cupom percentual',
    ofertas: ['Cupom 12%', 'Cupom 15%', 'Cupom 18%', 'Cupom 20%'],
    agressividade: 3,
  },
  {
    nome: 'Cupom percentual por linha',
    ofertas: ['12% em 25ml / 15% em 100ml'],
    agressividade: 3,
  },

  // Agressividade 4 — desconto em reais. Os valores são 10/15/18/20/25; os R$ 30 e R$ 50
  // da versão anterior eram invenção minha e nunca existiram.
  {
    nome: 'Reais OFF',
    ofertas: ['R$ 10 OFF', 'R$ 15 OFF', 'R$ 18 OFF', 'R$ 20 OFF', 'R$ 25 OFF'],
    agressividade: 4,
  },
  // Cupom de dois níveis com gatilho de valor mínimo. Fica em família própria porque a
  // mecânica é outra: exige carrinho mínimo, então não é comparável a um reais OFF direto.
  {
    nome: 'Reais OFF escalonado',
    ofertas: ['R$ 10 em 59 / R$ 15 em 79'],
    agressividade: 4,
  },
];

/**
 * Os quatro valores medidos, aplicados a todas as marcas do CONFIG estático.
 *
 * Isto NÃO é "o padrão do modelo": é a Lescent, medida uma vez, sendo usada como
 * se descrevesse as outras quatro marcas. Era exatamente o comportamento anterior
 * (constantes de módulo lidas direto), e continua aqui só para o CONFIG estático
 * não mudar de número ao virar campo. Marca que carrega contexto do BigQuery
 * sobrescreve os quatro — ver `configDoContexto`.
 */
const PADRAO_MEDIDO = {
  grade: GRADE,
  indiceDia: INDICE_DIA,
  suporte3: SUPORTE_3_OFERTAS,
  alpha: ALPHA,
};

const CONFIG: Record<MarcaAtiva, ConfigMarca> = {
  Lescent: {
    diasAtivos: TODOS_OS_DIAS,
    maxDiasCom3: 3,
    // ATENÇÃO: estes dois continuam inventados mesmo com o catálogo ditado. São eles que
    // produzem os reais na tela, então a receita da Lescent segue arbitrária.
    volumeSemana: 1_200_000,
    rpmBase: 28.4,
    familias: FAMILIAS_LESCENT,
    procedencia: 'ditado',
    ...PADRAO_MEDIDO,
  },
  Barbours: {
    diasAtivos: [1, 2, 3, 4, 5, 6],
    maxDiasCom3: 3,
    volumeSemana: 860_000,
    rpmBase: 34.1,
    familias: familiasSinteticas(5),
    procedencia: 'sintetico',
    ...PADRAO_MEDIDO,
  },
  Apice: {
    diasAtivos: [1, 2, 3, 4, 5],
    maxDiasCom3: 2,
    volumeSemana: 540_000,
    rpmBase: 22.7,
    familias: familiasSinteticas(4),
    procedencia: 'sintetico',
    ...PADRAO_MEDIDO,
  },
  Rituaria: {
    diasAtivos: [1, 2, 3, 4, 5, 6],
    maxDiasCom3: 2,
    volumeSemana: 310_000,
    rpmBase: 19.3,
    familias: familiasSinteticas(4),
    procedencia: 'sintetico',
    ...PADRAO_MEDIDO,
  },
  Kokeshi: {
    diasAtivos: [1, 2, 3, 4, 5],
    maxDiasCom3: 2,
    volumeSemana: 270_000,
    rpmBase: 17.8,
    familias: familiasSinteticas(4),
    procedencia: 'sintetico',
    ...PADRAO_MEDIDO,
  },
  // Gocase é 15x maior que as outras em volume (fato_slot medido 25/08: 178M envios em
  // 102 dias, ~12,25M/semana). O RPM sai baixo (~R$ 7/mil vs 17-34 das outras) porque
  // a base é enorme e a conversão por email é dilúida — coerente com marca de acessório.
  // Fim de semana com apenas 2 horários (Dom/Sáb: 10 e 19), único na frota.
  Gocase: {
    diasAtivos: [0, 1, 2, 3, 4, 5, 6],
    maxDiasCom3: 5,
    volumeSemana: 12_250_000,
    rpmBase: 7.1,
    familias: familiasSinteticas(6),
    procedencia: 'sintetico',
    ...PADRAO_MEDIDO,
  },
};

/** Ligado enquanto o catálogo acima for sintético. A tela precisa dizer isso. */
export function procedenciaDoCatalogo(marca: MarcaCalendario): Procedencia {
  return CONFIG[marca as MarcaAtiva]?.procedencia ?? 'sintetico';
}

/**
 * Nomes das famílias declaradas para a marca. Existe para o verificador poder afirmar
 * cobertura: sem saber o que foi DECLARADO, ele só consegue conferir o que foi usado, e
 * "família nenhuma ficou de fora" é justamente uma afirmação sobre a diferença entre os dois.
 */
export function familiasDaMarca(marca: MarcaCalendario): string[] {
  return (CONFIG[marca as MarcaAtiva]?.familias ?? []).map((f) => f.nome);
}

function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function paraISO(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function deISO(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

/**
 * Extrai datas ISO do texto livre de "eventos especiais", limitadas ao período do plano.
 *
 * O campo é prosa e continuará sendo — não vale a pena forçar um date-picker separado só
 * para isso e o formato "dia 28 teremos lançamento X" é como o time já escreve. O que muda
 * é que agora essas datas VIRAM entrada do algoritmo (Fase 2c): elas vão pra frente da fila
 * do 3º disparo, à frente até dos dias marcados por dow, porque um lançamento agendado é um
 * evento específico e não um viés de dia-da-semana.
 *
 * Formatos que sobrevivem ao parse: `28/11`, `28-11`, `28/11/2026`, `28.11`. Sem ano, ano do
 * dataInicio (ou dataFim, se o mês vier depois da virada do ano). Datas fora do período são
 * descartadas em silêncio: não é erro digitar `Black Friday em 28/11` num plano de janeiro.
 */
function parseEventosEspeciais(texto: string, inicioIso: string, fimIso: string): Set<string> {
  const datas = new Set<string>();
  if (!texto || !texto.trim()) return datas;
  const inicio = deISO(inicioIso);
  const fim = deISO(fimIso);
  // Regex tolerante: dia (1-2 díg), separador (/,-,.), mês (1-2 díg), opcional separador + ano (2 ou 4 díg).
  const regex = /\b(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?\b/g;
  for (const m of texto.matchAll(regex)) {
    const dia = Number(m[1]);
    const mes = Number(m[2]);
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) continue;
    // Sem ano explícito, escolhe o ano que faz a data cair no período. Testa primeiro o do
    // inicio; se não, o do fim. É comum plano cruzar a virada de ano e o time digitar "28/12"
    // num plano dez/26–jan/27 sem dizer o ano.
    const anosPossiveis: number[] = [];
    if (m[3]) {
      let ano = Number(m[3]);
      if (ano < 100) ano += 2000;
      anosPossiveis.push(ano);
    } else {
      anosPossiveis.push(inicio.getFullYear());
      if (fim.getFullYear() !== inicio.getFullYear()) anosPossiveis.push(fim.getFullYear());
    }
    for (const ano of anosPossiveis) {
      const candidata = new Date(ano, mes - 1, dia);
      // Descarta data inválida (ex.: 31/02 vira 03/03) e fora do período.
      if (candidata.getMonth() !== mes - 1 || candidata.getDate() !== dia) continue;
      if (candidata >= inicio && candidata <= fim) {
        datas.add(paraISO(candidata));
        break;
      }
    }
  }
  return datas;
}

/** Dias do período, cortados em semanas no domingo (mesma convenção da grade). */
function semanasDoPeriodo(inicio: string, fim: string, diasAtivos: number[]): Date[][] {
  const ultimo = deISO(fim);
  const semanas: Date[][] = [];
  let atual: Date[] = [];

  for (const cursor = deISO(inicio); cursor <= ultimo; cursor.setDate(cursor.getDate() + 1)) {
    if (cursor.getDay() === 0 && atual.length > 0) {
      semanas.push(atual);
      atual = [];
    }
    // H5 — dias que a marca não opera não entram no plano.
    if (diasAtivos.includes(cursor.getDay())) atual.push(new Date(cursor));
  }
  if (atual.length > 0) semanas.push(atual);
  return semanas;
}

export function gerarCalendarioDemo(
  input: InputCalendario,
  /**
   * Config vinda do BigQuery. Quando presente, substitui o CONFIG estático inteiro —
   * catálogo, volume, RPM, grade, I1, censo de viabilidade e alpha.
   *
   * É parâmetro opcional, e não uma troca do CONFIG, porque as duas procedências
   * precisam coexistir enquanto nem toda marca tem contexto carregável: sem
   * BigQuery no ar a tela cai para o estático e DIZ isso (procedencia), em vez de
   * ficar em branco ou fingir dado.
   */
  configExterna?: ConfigMarca,
  /**
   * Uso interno. Desliga a mira em faixa de gap para gerar o plano de REFERÊNCIA
   * contra o qual o I2 é calibrado — ver `mediaGapReferencia`. Também é o que
   * impede a recursão de passar de um nível.
   */
  semMiraGap = false,
): CalendarioGerado {
  const cfg = configExterna ?? CONFIG[input.marca as MarcaAtiva] ?? CONFIG.Lescent;

  // Sombreiam as constantes de módulo de mesmo nome, de propósito. O corpo desta
  // função lê GRADE/INDICE_DIA/SUPORTE_3_OFERTAS/ALPHA em ~30 lugares; ligá-los à
  // config aqui, em vez de reescrever os 30, mantém o diff no que de fato mudou
  // (a ORIGEM dos números) e não na aritmética, que não mudou.
  const GRADE = cfg.grade;
  const INDICE_DIA = cfg.indiceDia;
  const SUPORTE_3_OFERTAS = cfg.suporte3;
  const ALPHA = cfg.alpha;
  const semente = hash(`${input.marca}|${input.dataInicio}|${input.dataFim}|${input.modo}`);
  const eficiencia = input.modo === 'eficiencia';

  const semanas = semanasDoPeriodo(input.dataInicio, input.dataFim, cfg.diasAtivos);
  const dias = semanas.flat();

  const restricoesAplicadas: string[] = [
    `H1: no máximo ${cfg.maxDiasCom3} dias por semana com 3 ofertas`,
    'H2: nunca dois slots da mesma família no mesmo dia',
    'H3: célula com suporte histórico n=0 bloqueada (Domingo nunca teve 3 ofertas)',
    'H5: dias inativos da marca permanecem inativos',
  ];
  const restricoesRelaxadas: string[] = [];
  const avisos: string[] = [];

  // ── I2, I3, I4 — medidos, e até agora descartados ────────────────────────
  // As três entram por uma função só porque a regra é a mesma e é ela que impede
  // crédito de graça: o índice é dividido pela média do próprio domínio, então usar
  // a mistura média rende 1× e só desviar dela paga. Sem isso o nível médio do
  // índice — que já está dentro do RPM âncora — seria contado duas vezes, e todo
  // plano nasceria com ganho positivo por construção.
  //
  // Qual é "o próprio domínio" não é detalhe: é o contrafactual da etapa. Cada uma
  // das três é escolhida DENTRO de um conjunto que os passos anteriores já fecharam,
  // e normalizar sobre um conjunto maior que esse compara o plano com uma mistura
  // que ele não tem como produzir — o que aparece na tela como etapa negativa.
  //
  // Devolver `null` quando o mapa é neutro não é atalho: é o que distingue "a
  // marca tem peso 0 neste índice" de "a marca tem índice plano". No primeiro
  // caso a alavanca não deve aparecer creditada na decomposição, e é assim que
  // a tela fica sabendo.
  const bandaGap = (h: number): string =>
    h < 12 ? '<12h'
      : h < 24 ? '12-24h'
        : h < 48 ? '24-48h'
          : h < 96 ? '2-4d'
            : h < 168 ? '4-7d'
              : h < 720 ? '7-30d'
                : '30d+';

  const normalizador = (
    mapa: Record<string, number> | undefined,
    dominio: string[],
  ): ((chave: string) => number) | null => {
    if (!mapa || dominio.length === 0) return null;
    const valores = dominio.map((k) => mapa[k] ?? 1);
    if (valores.every((v) => Math.abs(v - 1) < 1e-9)) return null;
    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    if (!(media > 0)) return null;
    return (chave: string) => (mapa[chave] ?? media) / media;
  };

  // I2 — o divisor não é uma lista de faixas escrita à mão, é o próprio plano SEM
  // mirar em gap.
  //
  // A faixa de gap não é escolhida livremente: com F famílias e S disparos por dia, o
  // rodízio precisa repetir uma família a cada ~F/S dias, e H2 e o descanso de 48h só
  // empurram dentro dessa margem. Quais bandas são alcançáveis é, portanto, propriedade
  // do catálogo e da cadência — uma marca com 5 famílias e 2,6 disparos/dia vive em
  // '24-48h' e '2-4d', e nenhuma lista fixa acerta isso para todas. Normalizar contra as
  // bandas erradas cobra do I2 (ou credita a ele) um nível que o plano nunca teve como
  // escolher, e foi o que fez a etapa aparecer negativa.
  //
  // O plano de referência é o mesmo rodízio com o fator de gap desligado: é o
  // espaçamento que a operação produz sem olhar para o índice. Contra ele, o I2 mede
  // só o que MIRAR acrescenta — e uma marca sem margem de manobra sai em 0, que é a
  // leitura certa, em vez de em negativo.
  const BANDAS_GAP = ['<12h', '12-24h', '24-48h', '2-4d', '4-7d', '7-30d', '30d+'];
  const gapTemSinal = normalizador(cfg.indiceGap, BANDAS_GAP) !== null;
  let mediaGapReferencia = 0;
  if (gapTemSinal && !semMiraGap) {
    let soma = 0;
    let envios = 0;
    for (const s of gerarCalendarioDemo(input, cfg, true).slots) {
      // Primeira saída da família no plano entra neutra dos dois lados; incluí-la
      // aqui deslocaria o divisor por uma faixa que nenhum dos planos usa.
      if (s.janelaFamilia === '—') continue;
      soma += s.enviosPlanejados * (cfg.indiceGap![s.janelaFamilia] ?? 1);
      envios += s.enviosPlanejados;
    }
    mediaGapReferencia = envios > 0 ? soma / envios : 0;
  }
  const qualidadeGap =
    mediaGapReferencia > 0
      ? (banda: string) => (cfg.indiceGap![banda] ?? mediaGapReferencia) / mediaGapReferencia
      : null;

  // I3 — normalizado DENTRO da linha da grade do dia, não sobre a união das grades.
  // A diferença de um dia para o outro já é I1; se o I3 a carregasse de novo ela
  // seria contada duas vezes, e num dia cuja grade é toda fraca até a melhor hora
  // praticável ficaria abaixo da média global. O que o I3 mede é a escolha dentro
  // do dia, que é a única que ele controla.
  const qualidadeHoraPorDow = new Map<number, ((h: string) => number) | null>();
  for (let dow = 0; dow < 7; dow++) {
    qualidadeHoraPorDow.set(dow, normalizador(cfg.indiceHora, (cfg.grade[dow] ?? []).map(String)));
  }
  const horasDaGrade = [...new Set(cfg.grade.flat())].map(String);
  const temIndiceHora = normalizador(cfg.indiceHora, horasDaGrade) !== null;

  // I4 — normalizado DENTRO da família, porque é lá que a oferta é eleita: a família
  // já foi decidida no passo anterior e o contrafactual honesto é "a oferta média
  // DESTA família", não a média do catálogo. Sobre o catálogo inteiro, a melhor
  // oferta de uma família fraca pontuava abaixo de 1 e a etapa descia.
  const ofertasDoCatalogo = cfg.familias.flatMap((f) => f.ofertas);
  const qualidadeOfertaPorFamilia = new Map<string, ((o: string) => number) | null>();
  for (const f of cfg.familias) {
    qualidadeOfertaPorFamilia.set(f.nome, normalizador(cfg.indiceOferta, f.ofertas));
  }
  const temIndiceOferta = normalizador(cfg.indiceOferta, ofertasDoCatalogo) !== null;

  // Qualidade por família. Três procedências, e a diferença entre elas importa:
  //
  //  - cfg.indiceFamilia presente  → medido, usa como está.
  //  - I4 disponível               → média dos índices das ofertas da família.
  //  - resto (sintético/ditado)    → derivado da semente, como antes.
  //
  // O ramo do meio é o que sobrou de pé depois que o I4 passou a ser normalizado
  // dentro da família: normalizar lá dentro joga fora a diferença ENTRE famílias, e
  // esta média a recupera um passo acima, em vez de perdê-la. O BigQuery não indexa
  // família — indexa oferta e faixa de gap — mas família aqui é agrupamento de
  // ofertas, então a média dos I4 delas é a estimativa que existe, e é medida.
  //
  // O que não volta é o hash: derivar a qualidade de uma família real de
  // `semente >> i` dava a ela uma diferença de performance que ninguém mediu,
  // embrulhada em número. Num catálogo sintético isso é inofensivo (os rótulos já
  // são falsos); sobre dados reais era pior que inútil.
  const mediaI4Familia = (f: { ofertas: string[] }): number | undefined => {
    if (!cfg.indiceOferta || f.ofertas.length === 0) return undefined;
    const valores = f.ofertas.map((o) => cfg.indiceOferta![o] ?? 1);
    return valores.reduce((a, b) => a + b, 0) / valores.length;
  };
  const familiaMedida = cfg.indiceFamilia !== undefined || temIndiceOferta;
  const indiceFamilia = new Map<string, number>();
  cfg.familias.forEach((f, i) => {
    const medido = cfg.indiceFamilia?.[f.nome] ?? (temIndiceOferta ? mediaI4Familia(f) : undefined);
    indiceFamilia.set(
      f.nome,
      medido !== undefined
        ? medido
        : cfg.procedencia === 'dados'
          ? 1
          : Number((0.8 + ((semente >> (i + 2)) % 42) / 100).toFixed(3)),
    );
  });
  const mediaFamilia = [...indiceFamilia.values()].reduce((a, b) => a + b, 0) / cfg.familias.length;
  // Expoente 1 no caminho medido: o 0,52 vinha da leitura antiga de que I2 era o
  // índice de família, e I2 é faixa de gap. O valor que entra aqui já foi encolhido
  // pela credibilidade da própria amostra em `configDoContexto`; encolher de novo
  // seria descontar duas vezes a mesma incerteza.
  const expoenteFamilia = familiaMedida ? 1 : 0.52;
  const qualidadeFamilia = (nome: string) =>
    Math.pow((indiceFamilia.get(nome) ?? mediaFamilia) / mediaFamilia, expoenteFamilia);

  // DEFEITO CONHECIDO (não corrigido aqui, ver conversa): volume_maximo_semana fixa o total
  // de envios INDEPENDENTEMENTE do número de slots, e PESOS_SLOT só reparte esse total. Ou
  // seja, o 3º disparo não traz envio novo — ele parte o mesmo volume em três (42/32/26 em
  // vez de 58/42), tirando peso da melhor família para dar à terceira melhor. Consequência:
  // um dia com 3 ofertas pode render MENOS que o mesmo dia com 2, e o modo "receita máxima"
  // não é garantidamente máximo.
  //
  // Na realidade 3 e-mails para a mesma base são MAIS envios que 2, não os mesmos repartidos.
  // A correção certa é o volume depender da contagem de slots (limitado pelo teto), e não o
  // contrário. Isso mexe em todos os números da tela, então não entra junto com o catálogo.

  // ── FASE 2c — quais dias recebem o 3º slot, por semana ────────────────────
  // Candidatos: só dias com suporte histórico (H3). Ranqueados por I1 e limitados
  // ao teto operacional (H1), que é semanal por natureza e se aplica por semana
  // dentro do período, nunca ao período inteiro (§10.7).
  //
  // "Dias mais agressivos" entra AQUI e só aqui. Neste modelo, agressividade no nível do dia
  // é o número de ofertas — é a única alavanca de intensidade diária que a Fase 1 mediu. O
  // pedido do usuário reordena a fila de candidatos; ele não cria vaga nova. O teto semanal
  // (H1) e a célula sem suporte histórico (H3) continuam valendo, senão a marcação viraria
  // uma porta para furar as duas restrições que mais seguram o plano.
  const agressivos = new Set(input.diasAgressivos ?? []);
  // Eventos declarados no texto livre: datas específicas (ISO) que a Fase 2c prioriza
  // ACIMA dos dias marcados por dow. Prioridade maior porque um lançamento é evento
  // específico; agressividade por dow é preferência geral. Se um evento cai num dia sem
  // suporte histórico ou sem 3ª janela, o filtro de candidatos ainda o descarta (H3/§7.3
  // não cedem), e o aviso mais adiante explica por quê.
  const datasEventos = parseEventosEspeciais(input.eventosEspeciais ?? '', input.dataInicio, input.dataFim);
  const diasCom3 = new Set<string>();
  for (const semana of semanas) {
    const candidatos = semana
      // Duas condições, e a segunda é fácil de esquecer: além de ter suporte histórico (H3),
      // o dia precisa ter uma TERCEIRA janela na grade operacional (§7.3). Sábado e domingo
      // têm só duas. Sem esta linha o 3º disparo cai numa hora já ocupada — e o sintoma não é
      // um erro, é um sábado com dois envios às 10h, que só aparece quando alguém olha.
      .filter((d) => SUPORTE_3_OFERTAS[d.getDay()] > 0 && GRADE[d.getDay()].length >= 3)
      .sort((a, b) => {
        const eventoA = datasEventos.has(paraISO(a)) ? 2 : 0;
        const eventoB = datasEventos.has(paraISO(b)) ? 2 : 0;
        const marcadoA = agressivos.has(a.getDay()) ? 1 : 0;
        const marcadoB = agressivos.has(b.getDay()) ? 1 : 0;
        const prioA = eventoA + marcadoA;
        const prioB = eventoB + marcadoB;
        if (prioA !== prioB) return prioB - prioA;
        return INDICE_DIA[b.getDay()] - INDICE_DIA[a.getDay()];
      })
      .slice(0, cfg.maxDiasCom3);
    for (const d of candidatos) diasCom3.add(paraISO(d));
  }

  // Eventos declarados que não conseguiram entrar como 3º slot precisam ser ditos. Motivos
  // possíveis, na ordem que a Fase 2c os elimina: dia inativo da marca (H5), célula sem
  // suporte histórico (H3), grade sem 3ª janela (§7.3), ou teto semanal H1 já preenchido
  // por outros eventos/dias mais agressivos. O aviso não distingue os quatro — basta saber
  // que o evento foi visto e não deu.
  if (datasEventos.size > 0) {
    const perdidos: string[] = [];
    for (const iso of datasEventos) {
      const d = deISO(iso);
      if (!cfg.diasAtivos.includes(d.getDay())) { perdidos.push(iso); continue; }
      if (!diasCom3.has(iso)) perdidos.push(iso);
    }
    if (perdidos.length > 0) {
      avisos.push(
        `Eventos declarados que não viraram 3º disparo: ${perdidos.map((iso) => iso.split('-').reverse().slice(0, 2).join('/')).join(', ')}. Verifica se cai em dia ativo, com suporte histórico e com 3ª janela na grade; se cabe no teto semanal H1.`,
      );
    }
    restricoesAplicadas.push(
      `Eventos declarados: ${[...datasEventos].map((iso) => iso.split('-').reverse().slice(0, 2).join('/')).join(', ')} na frente da fila (prioridade acima de dias agressivos por dow)`,
    );
  }

  // Dias marcados que o modelo não pode atender precisam ser ditos, não ignorados em silêncio.
  if (agressivos.size > 0) {
    restricoesAplicadas.push(
      `Preferência do usuário: ${[...agressivos].map((d) => DIAS_EXTENSO[d]).join(', ')} na frente da fila do 3º disparo`,
    );
    const inativos = [...agressivos].filter((d) => !cfg.diasAtivos.includes(d));
    if (inativos.length > 0) {
      avisos.push(
        `${inativos.map((d) => DIAS_EXTENSO[d]).join(', ')} marcado(s) como agressivo(s), mas a marca não opera nesse(s) dia(s) — H5 não é negociável e a marcação foi ignorada.`,
      );
    }
    const semSuporte = [...agressivos].filter(
      (d) => cfg.diasAtivos.includes(d) && SUPORTE_3_OFERTAS[d] === 0,
    );
    if (semSuporte.length > 0) {
      avisos.push(
        `${semSuporte.map((d) => DIAS_EXTENSO[d]).join(', ')} nunca teve 3 ofertas no histórico (n=0): não há o que estimar, e a marcação não abre a célula (H3).`,
      );
    }
    // Sábado e domingo caem aqui: o histórico até suporta 3 ofertas, mas a grade operacional
    // só tem duas janelas. É uma recusa por operação, não por dados — e as duas razões levam
    // a decisões diferentes do lado do usuário (abrir uma janela nova vs. não ter o que medir),
    // então elas não podem sair com a mesma frase.
    const semJanela = [...agressivos].filter(
      (d) =>
        cfg.diasAtivos.includes(d) && SUPORTE_3_OFERTAS[d] > 0 && GRADE[d].length < 3,
    );
    if (semJanela.length > 0) {
      avisos.push(
        `${semJanela.map((d) => DIAS_EXTENSO[d]).join(', ')}: a grade operacional tem só ${semJanela
          .map((d) => GRADE[d].length)
          .join('/')} janela(s) nesse(s) dia(s), então não cabe um 3º disparo sem repetir horário. A marcação foi mantida na fila, mas não gerou slot.`,
      );
    }
    if (eficiencia) {
      avisos.push(
        'Modo eficiência não tem 3º disparo em dia nenhum — a marcação de dias agressivos não muda este plano. Ela volta a valer no modo receita máxima.',
      );
    }
  }

  // Modo B corta os 3ºs slots antes de qualquer outra coisa: a Fase 1 mede que só 40%
  // dos e-mails extras alcançam alguém novo — os outros 60% são repetição, o volume de
  // pior eficiência marginal do plano (§6.3).
  // O Math.min não é redundante com o filtro de candidatos acima: ele é a garantia de que
  // nenhum caminho futuro até este ponto consiga pedir mais disparos do que existem janelas
  // na grade. Sem ele, o excedente não estoura — ele silenciosamente reusa a primeira hora
  // (horas[s % horas.length]) e produz dois envios no mesmo horário, que é um plano inválido
  // com aparência de plano válido.
  const nSlotsPorDia = (iso: string) =>
    Math.min(!eficiencia && diasCom3.has(iso) ? 3 : 2, GRADE[deISO(iso).getDay()].length);

  // ── FASE 3 — alocação de volume por dia ───────────────────────────────────
  // O índice de dia entra na receita como A_d = I1^0,90 (o coeficiente que transferiu no
  // walk-forward). A alocação que maximiza Σ A_d·V_d^α sob ΣV fixo é V_d ∝ A_d^(1/(1-α)),
  // ou seja I1^(0,90/(1-α)). Os dois expoentes PRECISAM casar: se a alocação usasse I1 cru,
  // ela deixaria de ser ótima e a etapa de redistribuição poderia perder receita — o que
  // seria um artefato aritmético, não um resultado do modelo. Normalizado sobre os dias
  // contidos no período (§10.7a).
  const pesoDia = dias.map((d) => Math.pow(INDICE_DIA[d.getDay()], 0.9 / (1 - ALPHA)));
  const somaPesos = pesoDia.reduce((a, b) => a + b, 0);

  const volumeBase = Math.round((cfg.volumeSemana * dias.length) / cfg.diasAtivos.length);
  // No modo B o corte de volume é o que compra RPM, na taxa -0,69 medida. 15% é onde o corte
  // para por padrão; o piso de receita, se declarado, pode fazê-lo parar antes (ver adiante).
  const CORTE_EFICIENCIA = 0.15;
  let volumeTotal = eficiencia ? Math.round(volumeBase * (1 - CORTE_EFICIENCIA)) : volumeBase;

  // Âncora (§4.4): o RPM real das últimas 4 semanas, no volume DIÁRIO de referência da
  // marca. Duas decisões aqui não são cosméticas:
  //
  // 1. A âncora é do DIA, não do slot. A elasticidade da §6.1 mede o retorno decrescente do
  //    volume dentro do dia; um slot a mais no mesmo dia divide o mesmo volume, não compra
  //    audiência nova. Ancorar por slot faria remover o 3º slot parecer que concentra
  //    volume e derruba o RPM — o oposto do que o modo eficiência existe para fazer.
  // 2. A âncora usa volumeBase, não volumeTotal. Ela é uma propriedade medida da marca e
  //    precisa ficar PARADA quando o modo B corta volume; se ela acompanhasse o corte, a
  //    receita voltaria a ser linear no volume e a curva V^α desapareceria entre cenários.
  const enviosAncoraDia = volumeBase / dias.length;
  const receitaAncoraDia = (cfg.rpmBase * enviosAncoraDia) / 1000;

  // Índices RELATIVOS à média. Índice absoluto não é ganho: o nível médio dos índices já
  // está embutido no RPM âncora, e creditá-lo de novo contaria a mesma receita duas vezes.
  //
  // A normalização é feita sobre a QUALIDADE (idx/média)^coef, não sobre o índice. Parece
  // preciosismo e não é: o expoente é côncavo, então por Jensen a média das qualidades fica
  // ABAIXO de 1 mesmo com os índices centrados. Sem esta segunda divisão, uma marca que usa
  // todos os dias e todas as famílias por igual — que é exatamente o baseline "sem modelo" —
  // apareceria com ganho negativo, e a decomposição desceria numa alavanca que só pode somar.
  // Com ela, o zero fica onde deve: usar a mistura média dá ganho 0, e só desviar dela paga.
  const mediaDia = cfg.diasAtivos.reduce((a, d) => a + INDICE_DIA[d], 0) / cfg.diasAtivos.length;
  const qualidadeDia = (dow: number) => Math.pow(INDICE_DIA[dow] / mediaDia, 0.9);
  const mediaQualidadeDia =
    cfg.diasAtivos.reduce((a, d) => a + qualidadeDia(d), 0) / cfg.diasAtivos.length;

  const mediaQualidadeFamilia =
    cfg.familias.reduce((a, f) => a + qualidadeFamilia(f.nome), 0) / cfg.familias.length;

  // ── FASES 4 e 5 — rodízio de família, depois oferta e horário ─────────────
  const slots: CalendarioSlot[] = [];
  const usoOfertaNaSemana = new Map<string, number>();
  // Último disparo de cada família, para o gap real da §1.4.
  const ultimoUso = new Map<string, { dia: number; hora: number }>();
  // Quantas vezes cada família já saiu NESTE plano. Não é métrica, é insumo da escolha:
  // sem ela o rodízio não tem como saber que está repetindo as mesmas famílias.
  const usosFamilia = new Map<string, number>();
  // Uso por (família, dow) e (oferta, dow) — anti-repetição SEMANA A SEMANA. Sem isto o
  // rodízio geral do plano (usosFamilia) segurava a mesma família saindo em 4 quartas
  // seguidas se a qualidade dela dominasse; e ofertas[(semente + indiceDia*7 + s) % L]
  // reduzia-se a (semente + s) % L nas segundas quando L divide 7, então TODA segunda do
  // plano pegava a mesma oferta. As duas linhas abaixo forçam que o mesmo dow, semana
  // após semana, escolha família e oferta diferentes até esgotar catálogo.
  const usosFamiliaPorDow = new Map<string, Map<number, number>>();
  const usosOfertaPorDow = new Map<string, Map<number, number>>();
  const PENALIDADE_DOW_FAMILIA = 3;
  // Etapas cumulativas da decomposição: cada uma liga UMA alavanca a mais sobre o
  // mesmo volume. Precisam ser acumuladas aqui, dentro do laço, porque a mistura
  // que define cada etapa é do dia, não do plano.
  let receitaSoDia = 0; // I1 + α
  let receitaAteFamilia = 0; // + família (I4 agregado)
  let receitaAteGap = 0; // + I2
  let receitaAteHora = 0; // + I3
  let receitaPlanoExata = 0; // + I4 (plano completo)

  // Espaçamento mínimo entre disparos do mesmo dia. Vira restrição SOFT porque em
  // grade apertada ele impediria de preencher o dia, e um slot a menos custa mais
  // que dois disparos próximos.
  const MIN_GAP_HORAS = 3;
  let relaxouEspacamento = false;

  /**
   * Escolha de horário. Antes era espaçamento puro — primeiro e último da grade —
   * e o índice medido não era consultado. Agora o critério é o índice, com o
   * espaçamento como restrição, não como critério: pega a melhor hora, depois a
   * melhor entre as que ficam a 3h ou mais dela, e assim por diante.
   *
   * A grade operacional continua sendo o universo. O índice reordena o que já é
   * praticável; ele não inventa horário que a marca nunca usou.
   */
  const escolherHoras = (horas: number[], n: number, dow: number): number[] => {
    if (horas.length === 0) return [];
    const qHoraDoDia = qualidadeHoraPorDow.get(dow);
    if (!qHoraDoDia) {
      return n === 2 && horas.length >= 2
        ? [horas[0], horas[horas.length - 1]]
        : horas.slice(0, n);
    }
    const porQualidade = [...horas].sort(
      (a, b) => qHoraDoDia(String(b)) - qHoraDoDia(String(a)),
    );
    const escolhidas: number[] = [];
    for (const h of porQualidade) {
      if (escolhidas.length >= n) break;
      if (escolhidas.every((j) => Math.abs(j - h) >= MIN_GAP_HORAS)) escolhidas.push(h);
    }
    for (const h of porQualidade) {
      if (escolhidas.length >= n) break;
      if (!escolhidas.includes(h)) {
        escolhidas.push(h);
        relaxouEspacamento = true;
      }
    }
    return escolhidas.sort((a, b) => a - b);
  };

  dias.forEach((data, indiceDia) => {
    const iso = paraISO(data);
    const dow = data.getDay();
    const horas = GRADE[dow];
    // A grade manda no número de slots: pedir 3 disparos onde só há 2 horários
    // praticáveis produziria dois envios na mesma hora — sem erro e sem sintoma,
    // até alguém olhar o dia.
    const horasDoDia = escolherHoras(horas, nSlotsPorDia(iso), dow);
    const n = horasDoDia.length;
    if (n === 0) return;
    const volumeDoDia = (volumeTotal * pesoDia[indiceDia]) / somaPesos;
    const familiasUsadasHoje = new Set<string>();
    // Os slots do dia são escolhidos primeiro; a receita só pode ser calculada depois,
    // porque ela nasce no nível do dia e é a composição das famílias que a define.
    const rascunho: {
      s: number;
      hora: number;
      oferta: string;
      familia: { nome: string; ofertas: string[]; agressividade: number };
      envios: number;
      peso: number;
      gapFamiliaH: number;
      idxFamilia: number;
      idxHora: number;
      idxOferta: number;
      qFamilia: number;
      qHora: number;
      qOferta: number;
      qGap: number;
    }[] = [];

    for (let s = 0; s < n; s++) {
      // Fase 5b — horário, já eleito para o dia inteiro por `escolherHoras`.
      const hora = horasDoDia[s];

      // Fase 4 — rodízio de família. Duas regras, nesta ordem: H2 elimina quem já saiu hoje
      // (rígida, nunca relaxada); o descanso elimina quem disparou nas últimas 48h. Se o
      // descanso não deixar ninguém, ele cede antes de H2.
      const elegiveis = cfg.familias.filter((f) => !familiasUsadasHoje.has(f.nome));
      const descansadas = elegiveis.filter((f) => {
        const uso = ultimoUso.get(f.nome);
        return !uso || (indiceDia - uso.dia) * 24 + (hora - uso.hora) >= 48;
      });
      // Descanso é restrição SOFT: quando a marca tem famílias demais para poucos slots, ela
      // cede — mas cede declarando, nunca em silêncio.
      if (descansadas.length === 0 && !restricoesRelaxadas.includes('S1: descanso de 48h entre disparos da mesma família')) {
        restricoesRelaxadas.push('S1: descanso de 48h entre disparos da mesma família');
      }
      const pool = descansadas.length > 0 ? descansadas : elegiveis;

      // Entre as elegíveis, a escolha é por qualidade DIVIDIDA pelo uso acumulado — não pelo
      // maior índice puro. A diferença não é de calibração, é de aritmética, e o argmax puro
      // era um defeito e não uma preferência:
      //
      // com descanso de 48h cada família cabe no máximo ~11 vezes num plano de 21 dias, e um
      // plano de 21 dias tem ~51 slots. Bastam ~5 famílias para preencher tudo. O argmax
      // preenche SEMPRE pelas melhores, então a 6ª família em diante nunca saía — não por
      // ser ruim, mas por existir depois do ponto em que a fila já fechou. O catálogo podia
      // ter 8, 15 ou 40 mecânicas; rodavam as mesmas 6. Isso torna a marcação de uma oferta
      // no catálogo silenciosamente inócua, que é o pior tipo de bug: o input é aceito e
      // ignorado.
      //
      // qualidade/(1+usos) resolve isso sem virar rodízio cego. É proporcionalidade justa:
      // no equilíbrio, os usos ficam ~proporcionais à qualidade, então uma família com I2
      // alto continua saindo mais que uma fraca — só não sai a ponto de zerar as outras.
      // O +1 é o que dá a toda família nunca usada o maior score possível do seu nível, que
      // é o que garante cobertura sem precisar de uma regra separada de cobertura.
      //
      // A penalidade extra `PENALIDADE_DOW_FAMILIA * usosNoDow` fecha o buraco desta
      // fórmula quando o plano tem 3+ semanas: a família dominante ganhava TODAS as
      // segundas do plano, porque a diferença de qualidade compensava usos globais mas
      // um dow não fica "poupado" só porque a família aparece em outros dias. Com K=3,
      // uma segunda semana com uma família de qualidade 1,5× já perde para uma família
      // vizinha que ainda não saiu naquele dow — que é o comportamento pedido.
      //
      // O I2 entra AQUI, e não só na receita: o rodízio já espaçava as famílias, mas
      // sem olhar para quanto cada faixa de descanso vale. Sem este fator o
      // espaçamento saía como subproduto de H2 e do descanso de 48h, e a etapa I2 da
      // decomposição media uma faixa que ninguém tinha escolhido. Com ele, entre duas
      // famílias igualmente elegíveis o rodízio prefere a que cai numa faixa medida
      // como melhor.
      const gapSeSairAgora = (nome: string) => {
        const uso = ultimoUso.get(nome);
        return uso ? (indiceDia - uso.dia) * 24 + (hora - uso.hora) : null;
      };
      const familia = pool.reduce((melhor, f) => {
        const score = (g: typeof f) => {
          const usosGeral = usosFamilia.get(g.nome) ?? 0;
          const usosNoDow = usosFamiliaPorDow.get(g.nome)?.get(dow) ?? 0;
          const gap = gapSeSairAgora(g.nome);
          const qGap = gap === null ? 1 : (qualidadeGap?.(bandaGap(gap)) ?? 1);
          return (
            (qualidadeFamilia(g.nome) * qGap) /
            (1 + usosGeral + PENALIDADE_DOW_FAMILIA * usosNoDow)
          );
        };
        return score(f) > score(melhor) ? f : melhor;
      });

      const usoAnterior = ultimoUso.get(familia.nome);
      const gapFamiliaH = usoAnterior
        ? (indiceDia - usoAnterior.dia) * 24 + (hora - usoAnterior.hora)
        : 999;
      familiasUsadasHoje.add(familia.nome);
      ultimoUso.set(familia.nome, { dia: indiceDia, hora });
      usosFamilia.set(familia.nome, (usosFamilia.get(familia.nome) ?? 0) + 1);
      if (!usosFamiliaPorDow.has(familia.nome)) usosFamiliaPorDow.set(familia.nome, new Map());
      const mapaDow = usosFamiliaPorDow.get(familia.nome)!;
      mapaDow.set(dow, (mapaDow.get(dow) ?? 0) + 1);

      // Fase 5a — oferta dentro da família, com teto de repetição na semana (S2).
      // O critério antigo `ofertas[(semente + indiceDia*7 + s) % L]` era determinístico
      // mas coincidia toda vez que L | 7 (ex.: L=7 ⇒ mesma oferta em toda segunda do plano).
      // Agora escolhemos a oferta MENOS usada no dow atual, com semente só como desempate.
      // O índice de oferta (I4) entra AQUI, e é a diferença entre eleger a oferta e
      // apenas rodar o catálogo. A forma é a mesma da escolha de família — qualidade
      // dividida por uso — e pela mesma razão: argmax puro fixaria a melhor oferta
      // da família em todos os slots, e rodízio puro trataria uma oferta medida como
      // boa igual a uma medida como ruim. Com qualidade/(1+usos), a melhor sai mais
      // vezes sem que as outras parem de sair.
      //
      // Quando a marca tem peso 0 em I4 — Ápice e Kokeshi hoje — `qualidadeOferta` é
      // null, o numerador vira 1 e isto degrada exatamente para o rodízio anterior.
      const ofertas = familia.ofertas;
      const qOfertaDaFamilia = qualidadeOfertaPorFamilia.get(familia.nome);
      const scoreOferta = (o: string) => {
        const usosNoDow = usosOfertaPorDow.get(o)?.get(dow) ?? 0;
        const usosSemana = usoOfertaNaSemana.get(o) ?? 0;
        return (qOfertaDaFamilia?.(o) ?? 1) / (1 + usosNoDow + usosSemana);
      };
      const escolhida = ofertas.reduce((melhor, o, i) => {
        const sO = scoreOferta(o);
        const sMelhor = scoreOferta(melhor);
        if (sO > sMelhor + 1e-9) return o;
        if (sO < sMelhor - 1e-9) return melhor;
        // Desempate: hash da semente + índice na lista, pra manter reprodutibilidade
        // dentro do mesmo (marca, período) sem fixar a mesma oferta em toda semana.
        const desempateAtual = (semente + i * 13 + dow * 7 + s) % ofertas.length;
        const desempateMenor = (semente + ofertas.indexOf(melhor) * 13 + dow * 7 + s) % ofertas.length;
        return desempateAtual < desempateMenor ? o : melhor;
      });
      if (!usosOfertaPorDow.has(escolhida)) usosOfertaPorDow.set(escolhida, new Map());
      const mapaOfertaDow = usosOfertaPorDow.get(escolhida)!;
      mapaOfertaDow.set(dow, (mapaOfertaDow.get(dow) ?? 0) + 1);
      const usos = (usoOfertaNaSemana.get(escolhida) ?? 0) + 1;
      usoOfertaNaSemana.set(escolhida, usos);
      if (usos > 2 && !restricoesRelaxadas.includes('S2: mesma oferta ≤2× na semana')) {
        restricoesRelaxadas.push('S2: mesma oferta ≤2× na semana');
      }

      const peso = PESOS_SLOT[n][s];
      const envios = Math.round(volumeDoDia * peso);

      // Estes três eram fabricados: `0.95 + ((semente >> (s+5)) % 12)/100` para a
      // hora e `0.92 + ((semente >> (s+7)) % 28)/100` para a oferta — um hash do
      // nome da marca com as datas do período, gravado no plano no campo que a tela
      // e o assistente leem como índice medido. Agora são os índices do BigQuery,
      // já encolhidos pela própria amostra de cada nível.
      const idxFamilia = indiceFamilia.get(familia.nome) ?? 1;
      const idxHora = cfg.indiceHora?.[String(hora)] ?? 1;
      const idxOferta = cfg.indiceOferta?.[escolhida] ?? 1;

      rascunho.push({
        s,
        hora,
        oferta: escolhida,
        familia,
        envios,
        peso,
        gapFamiliaH,
        idxFamilia,
        idxHora,
        idxOferta,
        qHora: qualidadeHoraPorDow.get(dow)?.(String(hora)) ?? 1,
        qOferta: qOfertaDaFamilia?.(escolhida) ?? 1,
        // I2 é a fadiga MEDIDA. `idxGap` fica de fora do slot só porque o schema
        // (§9.1) expõe quatro índices e não cinco; o efeito entra na receita igual.
        //
        // Primeira saída da família NO PLANO é neutra, não '30d+'. O 999 é sentinela
        // de "não sei", não medição: o plano começa em cima de um histórico real onde
        // a família provavelmente saiu há pouco, e tratar o desconhecido como um mês
        // de silêncio é inventar a faixa — a mesma classe de erro dos índices que
        // vinham de hash.
        qGap: usoAnterior ? (qualidadeGap?.(bandaGap(gapFamiliaH)) ?? 1) : 1,
        // Sem penalidade de fadiga aqui, e isso é deliberado. Quando o descanso cede, a receita
        // real cai — mas o "ritmo de hoje" contra o qual comparamos também é uma operação com
        // fadiga, e não existe medição do descanso típico da marca para calibrar a diferença.
        // Descontar só de um lado inventaria um efeito e enviesaria a decomposição inteira.
        // O caminho da §7 para uma restrição que cedeu não é precificá-la no chute: é DECLARÁ-LA,
        // e é o que é feito abaixo, em restricoesRelaxadas.
        qFamilia: qualidadeFamilia(familia.nome) / mediaQualidadeFamilia,
      });
    }

    // ── Receita do DIA, depois repartida entre os slots ──────────────────────
    // receita_dia = âncora · I1^0,90 · q_família · (V_dia / V_âncora)^α  (§6.1)
    const idxDia = INDICE_DIA[dow];
    const qDia = qualidadeDia(dow) / mediaQualidadeDia;
    const fatorVolume = Math.pow(volumeDoDia / enviosAncoraDia, ALPHA);
    // Mistura do dia = média ponderada pelos pesos de volume dos slots. Cada fator
    // já vem normalizado pela média do próprio domínio, então um dia que usa a
    // mistura média dá 1 e não ganha nada — o ganho só aparece ao desviar dela.
    const mixDia = rascunho.reduce(
      (a, r) => a + r.peso * r.qFamilia * r.qGap * r.qHora * r.qOferta,
      0,
    );

    const receitaDia = receitaAncoraDia * qDia * mixDia * fatorVolume;
    // Acumuladores EXATOS. A decomposição compara etapas entre si, então as duas pontas
    // precisam vir da mesma aritmética: somar os valores já arredondados por slot injetaria
    // ruído de centavos que apareceria na tela como uma alavanca ganhando ou perdendo 0,1%.
    receitaPlanoExata += receitaDia;
    // Etapas intermediárias: cada uma liga uma alavanca a mais, na ordem em que a
    // decomposição as apresenta. Como Σ peso = 1, com todos os fatores neutros as
    // quatro colapsam no mesmo número — que é o comportamento certo para uma marca
    // cujos índices não transferiram.
    const baseDia = receitaAncoraDia * qDia * fatorVolume;
    receitaSoDia += baseDia;
    receitaAteFamilia += baseDia * rascunho.reduce((a, r) => a + r.peso * r.qFamilia, 0);
    receitaAteGap += baseDia * rascunho.reduce((a, r) => a + r.peso * r.qFamilia * r.qGap, 0);
    receitaAteHora +=
      baseDia * rascunho.reduce((a, r) => a + r.peso * r.qFamilia * r.qGap * r.qHora, 0);

    for (const r of rascunho) {
      // A repartição preserva a soma: Σ (peso·q_slot / mix_dia) = 1.
      const receita =
        (receitaDia * r.peso * r.qFamilia * r.qGap * r.qHora * r.qOferta) / mixDia;
      const rpm = (receita / r.envios) * 1000;
      const score = qDia * r.qFamilia * r.qGap * r.qHora * r.qOferta;

      slots.push({
        data: iso,
        diaSemana: DIAS[dow],
        slot: r.s + 1,
        hora: r.hora,
        oferta: r.oferta,
        familia: r.familia.nome,
        agressividade: r.familia.agressividade,
        enviosPlanejados: r.envios,
        indices: {
          dia: Number(idxDia.toFixed(3)),
          hora: Number(r.idxHora.toFixed(3)),
          oferta: Number(r.idxOferta.toFixed(3)),
          familia: Number(r.idxFamilia.toFixed(3)),
        },
        gapFamiliaH: r.gapFamiliaH,
        // Mesmas faixas do I2 no BigQuery. Antes eram três buckets próprios
        // ('2-3d'/'4-7d'/'7d+') que não casavam com nível nenhum do índice, então
        // o rótulo na tela e a faixa que entra na receita podiam discordar.
        janelaFamilia: r.gapFamiliaH >= 999 ? '—' : bandaGap(r.gapFamiliaH),
        score: Number(score.toFixed(3)),
        rpmPrevisto: Number(rpm.toFixed(1)),
        receitaPrevista: Math.round(receita),
        // O 3º slot é o único cujo efeito não sobreviveu à validação: I7 = 96, IC contendo 100.
        confianca: {
          validado: r.s < 2,
          ic80: [Math.round(receita * 0.72), Math.round(receita * 1.31)],
        },
      });
    }
  });

  // ── PISO DE RECEITA — onde a eficiência para de cobrar ────────────────────
  // Esta é a resposta a "até onde o modo B vai": sem piso declarado, ele para no corte de 15%
  // medido na Fase 1. Com piso, ele para antes — a eficiência é comprada com receita e o piso
  // é o preço máximo que se aceita pagar.
  //
  // Reescalar aqui é exato, não uma aproximação: a estrutura do plano (quais dias, quais
  // famílias, que pesos) não depende do volume — só escala com ele. Logo receita ∝ V^α em
  // fechado, e este bloco é idêntico a rodar o gerador de novo com outro volume.
  if (eficiencia && input.pisoReceita && input.pisoReceita > 0) {
    const receitaSemCorte = receitaPlanoExata / Math.pow(1 - CORTE_EFICIENCIA, ALPHA);
    if (input.pisoReceita > receitaSemCorte) {
      // O piso não cabe nem devolvendo todo o volume. §6.3: declarar o gap, nunca fingir
      // que a meta foi atingida — e nunca inflar volume acima do teto de saúde para chegar lá.
      avisos.push(
        `Piso de receita de ${Math.round(input.pisoReceita).toLocaleString('pt-BR')} não é alcançável no modo eficiência: mesmo sem cortar volume nenhum o plano chega a ${Math.round(receitaSemCorte).toLocaleString('pt-BR')}. O corte foi zerado e o gap permanece — fechá-lo é decisão de volume ou de oferta, não deste modo.`,
      );
    }
    const alvo = Math.min(input.pisoReceita, receitaSemCorte);
    if (alvo > receitaPlanoExata) {
      const fator = Math.pow(alvo / receitaPlanoExata, 1 / ALPHA);
      const fatorReceita = Math.pow(fator, ALPHA);
      for (const s of slots) {
        s.enviosPlanejados = Math.round(s.enviosPlanejados * fator);
        s.receitaPrevista = Math.round(s.receitaPrevista * fatorReceita);
        s.rpmPrevisto = Number(((s.receitaPrevista / s.enviosPlanejados) * 1000).toFixed(1));
        s.confianca.ic80 = [
          Math.round(s.confianca.ic80[0] * fatorReceita),
          Math.round(s.confianca.ic80[1] * fatorReceita),
        ];
      }
      receitaPlanoExata *= fatorReceita;
      receitaSoDia *= fatorReceita;
      receitaAteFamilia *= fatorReceita;
      receitaAteGap *= fatorReceita;
      receitaAteHora *= fatorReceita;
      volumeTotal = Math.round(volumeTotal * fator);
      const corteFinal = (1 - volumeTotal / volumeBase) * 100;
      avisos.push(
        `Piso de receita ativo: o corte de volume parou em ${corteFinal.toFixed(1)}% em vez dos 15% padrão do modo eficiência. Menos corte significa menos ganho de R$/mil — o piso comprou receita pagando em eficiência.`,
      );
      restricoesAplicadas.push(`Piso de receita de R$ ${Math.round(alvo).toLocaleString('pt-BR')}`);
    }
  }

  // ── FASE 6 — previsão, decomposição, fronteira ────────────────────────────
  const enviosTotal = slots.reduce((a, s) => a + s.enviosPlanejados, 0);
  const receitaPlano = receitaPlanoExata;

  // Ritmo de hoje: MESMO volume total do plano, mesmo motor, mas espalhado uniformemente
  // entre os dias e sem crédito de índice nenhum — o que a marca faria sem o modelo. No modo
  // A ele colapsa em rpmBase · volume / 1000; no modo B ele já incorpora o corte de volume,
  // e é por isso que a comparação continua honesta: o ganho mostrado é o da INTELIGÊNCIA do
  // plano, nunca o do volume que se decidiu cortar ou manter.
  const volumeUniformeDia = volumeTotal / dias.length;
  const ritmoDeHoje = Math.round(
    dias.length * receitaAncoraDia * Math.pow(volumeUniformeDia / enviosAncoraDia, ALPHA),
  );
  const validado = Math.round(receitaPlano);
  const previsao: PrevisaoCalendario = {
    ritmoDeHoje,
    validado,
    // Marcador FIXO de 18%, não um in-sample recalculado: existe só para dar escala
    // ao viés de ler índice na própria amostra em que ele foi estimado. Não use.
    inSampleNaoUsar: Math.round(validado * 1.18),
    ganhoValidadoPct: Number((((validado - ritmoDeHoje) / ritmoDeHoje) * 100).toFixed(1)),
  };

  // Cada etapa liga UMA alavanca a mais no mesmo motor, sempre com o mesmo volume total,
  // e na ordem em que o gerador de fato decide: dia, família, espaçamento, horário,
  // oferta.
  //
  // A curva não desce porque cada alavanca é normalizada pelo conjunto DE ONDE ela foi
  // escolhida, e não por um conjunto maior: a alocação da Fase 3 é o ótimo do passo
  // anterior; horário é o melhor de dentro da grade daquele dia; oferta, a melhor de
  // dentro da família já eleita; e o espaçamento é medido contra o próprio rodízio sem
  // mira. Comparar contra qualquer conjunto mais amplo cobra da etapa um nível que o
  // plano não tinha como escolher, e é assim que uma etapa negativa aparece.
  //
  // Sobra um resíduo da ordem de 0,01%, que arredonda para zero: o rodízio não é argmax
  // puro — divide a qualidade pelo uso acumulado para não zerar o catálogo — então a
  // mistura que ele produz fica perto do ótimo, não exatamente nele. Uma queda VISÍVEL
  // (0,1% ou mais) não é isso, e o primeiro suspeito é um domínio de normalização ter
  // deixado de bater com o conjunto de onde a escolha sai.
  const soDia = Math.round(receitaSoDia);
  const ateFamilia = Math.round(receitaAteFamilia);
  const ateGap = Math.round(receitaAteGap);
  const ateHora = Math.round(receitaAteHora);
  const ganho = (de: number, para: number) =>
    de > 0 ? Number((((para - de) / de) * 100).toFixed(1)) : 0;
  // `validado` é por MARCA, não por modelo: a alavanca aparece creditada quando o
  // walk-forward daquela marca deu peso a ela. Numa marca de peso 0 o normalizador
  // devolve null, o ganho sai 0 e a etapa entra como não validada — que é a leitura
  // honesta e é o que faz a tela distinguir "não medimos" de "medimos e deu zero".
  const decomposicao: EtapaDecomposicao[] = [
    { etapa: 'Perfil de hoje (ritmo atual)', receita: ritmoDeHoje, ganhoPct: 0, validado: true },
    {
      etapa: 'Redistribuir volume entre dias (I1 + α)',
      receita: soDia,
      ganhoPct: ganho(ritmoDeHoje, soDia),
      validado: true,
    },
    {
      etapa: 'Família eleita no rodízio (I4 agregado)',
      receita: ateFamilia,
      ganhoPct: ganho(soDia, ateFamilia),
      validado: familiaMedida,
    },
    {
      etapa: 'Espaçamento entre disparos da mesma família (I2)',
      receita: ateGap,
      ganhoPct: ganho(ateFamilia, ateGap),
      validado: gapTemSinal,
    },
    {
      etapa: 'Horário eleito dentro da grade (I3)',
      receita: ateHora,
      ganhoPct: ganho(ateGap, ateHora),
      validado: temIndiceHora,
    },
    {
      etapa: 'Oferta eleita dentro da família (I4)',
      receita: validado,
      ganhoPct: ganho(ateHora, validado),
      validado: temIndiceOferta,
    },
  ];

  if (relaxouEspacamento) {
    restricoesRelaxadas.push('S3: mínimo de 3h entre disparos do mesmo dia');
  } else if (temIndiceHora) {
    restricoesAplicadas.push('S3: mínimo de 3h entre disparos do mesmo dia');
  }

  // Qual alavanca esta MARCA de fato tem. Sem isto, uma marca cujo índice de hora
  // não transferiu produz um plano visualmente idêntico ao de uma marca em que ele
  // transferiu a 1,5 — e quem lê não tem como saber que ali o horário saiu da grade
  // e não de medição. É a mesma regra da procedência do catálogo, aplicada a índice.
  const inativas = [
    gapTemSinal ? null : 'espaçamento entre disparos da mesma família (I2)',
    temIndiceHora ? null : 'horário (I3)',
    temIndiceOferta ? null : 'oferta (I4)',
  ].filter((x): x is string => x !== null);
  if (inativas.length > 0 && cfg.procedencia === 'dados') {
    avisos.push(
      `Nesta marca ${inativas.length === 1 ? 'a alavanca' : 'as alavancas'} ${inativas.join(', ')} ${inativas.length === 1 ? 'não sobreviveu' : 'não sobreviveram'} à validação fora da amostra: o padrão aprendido no treino não se repetiu no período de teste. ${inativas.length === 1 ? 'Ela entra' : 'Elas entram'} neutra${inativas.length === 1 ? '' : 's'} no plano, e a decisão correspondente vem da grade operacional e do rodízio, não de ganho medido. Isso é resultado do modelo, não pendência de dado.`,
    );
  }

  const fronteira: PontoFronteira[] = [-20, -10, 0, 10, 20].map((delta) => {
    const fator = 1 + delta / 100;
    const receita = receitaPlano * Math.pow(fator, ALPHA);
    const envios = enviosTotal * fator;
    return {
      deltaVolumePct: delta,
      receita: Math.round(receita),
      rpm: Number(((receita / envios) * 1000).toFixed(1)),
    };
  });

  // ── Metas: leitura, nunca comando ─────────────────────────────────────────
  // As duas metas são opcionais e nenhuma delas altera uma única decisão acima — o plano é o
  // mesmo com ou sem meta. O que a meta faz é dar uma régua: se o plano não chega lá, o modelo
  // diz o tamanho do buraco e por onde se fecha. Inflar volume em silêncio para bater a meta
  // seria trocar receita real por um número na tela.
  const rpmPlano = fronteira.find((p) => p.deltaVolumePct === 0)?.rpm ?? 0;
  if (!eficiencia && input.metaReceita && input.metaReceita > validado) {
    const gap = ((input.metaReceita - validado) / validado) * 100;
    const volumeNecessario = (Math.pow(input.metaReceita / validado, 1 / ALPHA) - 1) * 100;
    avisos.push(
      `Meta de receita ${gap.toFixed(1)}% acima do plano validado. Pela elasticidade medida, fechar só com volume exigiria +${volumeNecessario.toFixed(0)}% de envios — acima do teto de saúde da base. As alavancas em ordem de custo são: oferta de maior índice nos dias fortes, depois 3º disparo onde houver suporte, depois volume.`,
    );
  }
  if (eficiencia && input.metaRpm && input.metaRpm > rpmPlano) {
    const cortePara = (1 - Math.pow(rpmPlano / input.metaRpm, 1 / (1 - ALPHA))) * 100;
    avisos.push(
      `Meta de ${input.metaRpm.toLocaleString('pt-BR')} R$/mil acima do plano (${rpmPlano.toLocaleString('pt-BR')}). Pela elasticidade, chegar lá custa cortar ${cortePara.toFixed(0)}% do volume — e a receita cai junto, na taxa α. Se esse corte furar o piso, a meta e o piso são incompatíveis e um dos dois precisa ceder.`,
    );
  }

  // ── Avisos — cada suposição declarada como suposição (§10.7) ──────────────
  if (dias.length < 7) {
    avisos.push(
      'Período menor que 7 dias: o descanso entre famílias não pôde ser otimizado no horizonte pedido.',
    );
  }
  if (deISO(input.dataInicio) > new Date()) {
    avisos.push(
      'Período começa no futuro e não há calendário publicado cobrindo o intervalo — o estado inicial de descanso de família é o de hoje, assumido e não observado.',
    );
  }
  if (dias.length > 28) {
    avisos.push(
      'Período acima de 4 semanas: a âncora (RPM das últimas 4 semanas) passa a ser a fonte dominante de incerteza, não os índices.',
    );
  }
  if (SUPORTE_3_OFERTAS[1] <= 1 && [...diasCom3].some((iso) => deISO(iso).getDay() === 1)) {
    avisos.push('Segunda tem apenas 1 dia de suporte histórico com 3 ofertas.');
  }
  avisos.push(
    `3 ofertas em até ${cfg.maxDiasCom3} dias por semana porque a operação suporta ${cfg.maxDiasCom3}, não porque o modelo mediu que ${cfg.maxDiasCom3} é ótimo.`,
  );
  if (eficiencia) {
    avisos.push(
      'Modo eficiência: os 3ºs slots foram removidos primeiro — a Fase 1 mede que só 40% dos e-mails extras alcançam alguém novo.',
    );
  }

  return {
    id: `cal-${semente.toString(16)}`,
    marca: input.marca,
    periodo: { inicio: input.dataInicio, fim: input.dataFim },
    modo: input.modo,
    meta: eficiencia
      ? input.metaRpm
        ? { tipo: 'rpm', valor: input.metaRpm }
        : null
      : input.metaReceita
        ? { tipo: 'receita', valor: input.metaReceita }
        : null,
    // O sufixo distingue plano medido de fixture. Um id de snapshot terminado em
    // "-fixture" num plano que foi para a operação é o rastro de que os números
    // não vieram do BigQuery.
    snapshotIndicesId: `snap-${(semente >> 4).toString(16)}-${cfg.procedencia === 'dados' ? 'bq' : 'fixture'}`,
    geradoEm: new Date().toISOString(),
    slots,
    previsao,
    decomposicao,
    fronteira,
    restricoesAplicadas,
    restricoesRelaxadas,
    avisos,
    procedencia: cfg.procedencia,
  };
}
