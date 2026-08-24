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

// Marcas que o modelo não cobre. Gocase tem 247M de envios registrados mas a tabela de
// pedidos é Spree e não tem coluna de UTM nenhuma — a atribuição da §2.4 é impossível.
// Bloqueio de origem, não fila de trabalho (§2.9).
export const MARCAS_SEM_MODELO: MarcaCalendario[] = ['Gocase'];

type MarcaAtiva = Exclude<MarcaCalendario, 'Gocase'>;

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
// unidade de fadiga (H2 + I2, coeficiente 0,52). Quanto mais fino o corte, menos fadiga
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

  // Qualidade por família. Três procedências, e a diferença entre elas importa:
  //
  //  - cfg.indiceFamilia presente  → medido, usa como está.
  //  - procedência 'dados'         → NEUTRO (1.0 para todas). Ver abaixo.
  //  - resto (sintético/ditado)    → derivado da semente, como antes.
  //
  // O ramo neutro é o que muda de verdade. A linha anterior derivava a qualidade de
  // cada família de um HASH do nome da marca e do período — variância inventada, que
  // mexe em qual família ganha o melhor horário e em quanta receita a tela mostra.
  // Num catálogo sintético isso é inofensivo (os rótulos já são falsos). Sobre dados
  // reais seria pior que inútil: daria a famílias reais uma diferença de performance
  // que ninguém mediu, embrulhada em número.
  //
  // E não há o que colocar no lugar. O BigQuery não expõe índice por família: I2 é
  // por FAIXA DE GAP ('2-4d', '7-30d'), não por família, e I4 é por OFERTA e vem com
  // veredito 'NAO transfere' nas 22 — com transferência global negativa (-0,436),
  // que é reversão à média em amostra pequena, não sinal. Neutro é a leitura honesta:
  // o rodízio de famílias continua acontecendo por H2 e por fadiga, que são regras
  // observadas, e deixa de fingir que uma família rende mais que a outra.
  const indiceFamilia = new Map<string, number>();
  cfg.familias.forEach((f, i) => {
    const medido = cfg.indiceFamilia?.[f.nome];
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
  const qualidadeFamilia = (nome: string) =>
    Math.pow((indiceFamilia.get(nome) ?? mediaFamilia) / mediaFamilia, 0.52);

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
  const diasCom3 = new Set<string>();
  for (const semana of semanas) {
    const candidatos = semana
      // Duas condições, e a segunda é fácil de esquecer: além de ter suporte histórico (H3),
      // o dia precisa ter uma TERCEIRA janela na grade operacional (§7.3). Sábado e domingo
      // têm só duas. Sem esta linha o 3º disparo cai numa hora já ocupada — e o sintoma não é
      // um erro, é um sábado com dois envios às 10h, que só aparece quando alguém olha.
      .filter((d) => SUPORTE_3_OFERTAS[d.getDay()] > 0 && GRADE[d.getDay()].length >= 3)
      .sort((a, b) => {
        const marcadoA = agressivos.has(a.getDay()) ? 1 : 0;
        const marcadoB = agressivos.has(b.getDay()) ? 1 : 0;
        if (marcadoA !== marcadoB) return marcadoB - marcadoA;
        return INDICE_DIA[b.getDay()] - INDICE_DIA[a.getDay()];
      })
      .slice(0, cfg.maxDiasCom3);
    for (const d of candidatos) diasCom3.add(paraISO(d));
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
  // Receita da etapa intermediária da decomposição (só I1 ligado, família ainda neutra).
  let receitaSoDia = 0;
  let receitaPlanoExata = 0;

  dias.forEach((data, indiceDia) => {
    const iso = paraISO(data);
    const dow = data.getDay();
    const n = nSlotsPorDia(iso);
    const horas = GRADE[dow];
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
    }[] = [];

    for (let s = 0; s < n; s++) {
      // Fase 5b — horário. O critério NÃO é o índice de hora (transferência 0,00):
      // nos dias de 2 slots sai o primeiro e o último da grade, para maximizar o intervalo.
      const hora = n === 2 ? [horas[0], horas[horas.length - 1]][s] : horas[s % horas.length];

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
      const familia = pool.reduce((melhor, f) => {
        const score = (g: typeof f) => qualidadeFamilia(g.nome) / (1 + (usosFamilia.get(g.nome) ?? 0));
        return score(f) > score(melhor) ? f : melhor;
      });

      const usoAnterior = ultimoUso.get(familia.nome);
      const gapFamiliaH = usoAnterior
        ? (indiceDia - usoAnterior.dia) * 24 + (hora - usoAnterior.hora)
        : 999;
      familiasUsadasHoje.add(familia.nome);
      ultimoUso.set(familia.nome, { dia: indiceDia, hora });
      usosFamilia.set(familia.nome, (usosFamilia.get(familia.nome) ?? 0) + 1);

      // Fase 5a — oferta dentro da família, com teto de repetição na semana (S2).
      const ofertas = familia.ofertas;
      const escolhida = ofertas[(semente + indiceDia * 7 + s) % ofertas.length];
      const usos = (usoOfertaNaSemana.get(escolhida) ?? 0) + 1;
      usoOfertaNaSemana.set(escolhida, usos);
      if (usos > 2 && !restricoesRelaxadas.includes('S2: mesma oferta ≤2× na semana')) {
        restricoesRelaxadas.push('S2: mesma oferta ≤2× na semana');
      }

      const peso = PESOS_SLOT[n][s];
      const envios = Math.round(volumeDoDia * peso);

      const idxFamilia = indiceFamilia.get(familia.nome) ?? 1;
      const idxHora = 0.95 + ((semente >> (s + 5)) % 12) / 100;
      const idxOferta = 0.92 + ((semente >> (s + 7)) % 28) / 100;

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
    // Qualidade de família do dia = média ponderada pelos pesos de volume dos slots.
    const qFamiliaDia = rascunho.reduce((a, r) => a + r.peso * r.qFamilia, 0);

    const receitaDia = receitaAncoraDia * qDia * qFamiliaDia * fatorVolume;
    // Acumuladores EXATOS. A decomposição compara etapas entre si, então as duas pontas
    // precisam vir da mesma aritmética: somar os valores já arredondados por slot injetaria
    // ruído de centavos que apareceria na tela como uma alavanca ganhando ou perdendo 0,1%.
    receitaPlanoExata += receitaDia;
    // Etapa intermediária da decomposição: I1 ligado, família ainda neutra.
    receitaSoDia += receitaAncoraDia * qDia * fatorVolume;

    for (const r of rascunho) {
      // A repartição preserva a soma: Σ (peso·q_fam / q_fam_dia) = 1.
      const receita = (receitaDia * r.peso * r.qFamilia) / qFamiliaDia;
      const rpm = (receita / r.envios) * 1000;
      const score = qDia * r.qFamilia;

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
        janelaFamilia: r.gapFamiliaH < 72 ? '2-3d' : r.gapFamiliaH < 120 ? '4-7d' : '7d+',
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
    // O in-sample dá crédito integral aos 4 índices, inclusive aos dois que transferiram
    // a 0,00. A distância entre ele e o validado é o tamanho do viés.
    inSampleNaoUsar: Math.round(validado * 1.18),
    ganhoValidadoPct: Number((((validado - ritmoDeHoje) / ritmoDeHoje) * 100).toFixed(1)),
  };

  // Cada etapa liga UMA alavanca a mais no mesmo motor, sempre com o mesmo volume total.
  // A ordem é a de transferência decrescente (§6.2), e por construção a curva não desce:
  // a alocação da Fase 3 é o ótimo do passo 2, e o rodízio da Fase 4 escolhe famílias
  // acima da média. Se um dia descer, é bug do gerador, não resultado do modelo.
  const soDia = Math.round(receitaSoDia);
  const decomposicao: EtapaDecomposicao[] = [
    { etapa: 'Perfil de hoje (ritmo atual)', receita: ritmoDeHoje, ganhoPct: 0, validado: true },
    {
      etapa: 'Redistribuir volume entre dias (I1 + α)',
      receita: soDia,
      ganhoPct: Number((((soDia - ritmoDeHoje) / ritmoDeHoje) * 100).toFixed(1)),
      validado: true,
    },
    {
      etapa: 'Rodízio de família (I2)',
      receita: validado,
      ganhoPct: Number((((validado - soDia) / soDia) * 100).toFixed(1)),
      validado: true,
    },
    { etapa: 'Horas da grade', receita: validado, ganhoPct: 0, validado: false },
    { etapa: 'Oferta eleita por dia', receita: validado, ganhoPct: 0, validado: false },
  ];

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
