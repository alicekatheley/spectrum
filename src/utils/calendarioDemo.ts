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

interface ConfigMarca {
  diasAtivos: number[]; // H5 — dias inativos permanecem inativos
  maxDiasCom3: number; // H1 — teto operacional por semana (§1.3)
  familias: { nome: string; ofertas: string[]; agressividade: number }[];
  volumeSemana: number; // volume_maximo_semana (§7.3)
  rpmBase: number; // âncora: RPM real das últimas 4 semanas (§4.4)
}

const TODOS_OS_DIAS = [0, 1, 2, 3, 4, 5, 6];

const CONFIG: Record<MarcaAtiva, ConfigMarca> = {
  Lescent: {
    diasAtivos: TODOS_OS_DIAS,
    maxDiasCom3: 3,
    volumeSemana: 1_200_000,
    rpmBase: 28.4,
    familias: [
      { nome: 'Necessaire', ofertas: ['Necessaire Bege', 'Necessaire Preta'], agressividade: 2 },
      { nome: 'Expresso', ofertas: ['Expresso 24h', 'Expresso Fim de Semana'], agressividade: 1 },
      { nome: 'Cupom', ofertas: ['Cupom 15%', 'Cupom 18%'], agressividade: 3 },
      { nome: 'Reais OFF', ofertas: ['R$ 30 OFF', 'R$ 50 OFF'], agressividade: 4 },
      { nome: 'Amostras', ofertas: ['Kit Amostras', 'Amostra Surpresa'], agressividade: 1 },
    ],
  },
  Barbours: {
    diasAtivos: [1, 2, 3, 4, 5, 6],
    maxDiasCom3: 3,
    volumeSemana: 860_000,
    rpmBase: 34.1,
    familias: [
      { nome: 'Caixa', ofertas: ['Caixa Presente', 'Caixa Assinatura'], agressividade: 2 },
      { nome: 'Cupom', ofertas: ['Cupom 15%', 'Cupom 20%'], agressividade: 3 },
      { nome: 'Lancamento', ofertas: ['Lançamento Linha Ruby'], agressividade: 1 },
      { nome: 'Reais OFF', ofertas: ['R$ 40 OFF', 'R$ 60 OFF'], agressividade: 4 },
      { nome: 'Brinde', ofertas: ['Brinde Exclusivo'], agressividade: 2 },
    ],
  },
  Apice: {
    diasAtivos: [1, 2, 3, 4, 5],
    maxDiasCom3: 2,
    volumeSemana: 540_000,
    rpmBase: 22.7,
    familias: [
      { nome: 'Tratamento', ofertas: ['Kit Tratamento', 'Reconstrução Capilar'], agressividade: 1 },
      { nome: 'Cupom', ofertas: ['Cupom 12%', 'Cupom 18%'], agressividade: 3 },
      { nome: 'Combo', ofertas: ['Combo Shampoo + Máscara'], agressividade: 2 },
      { nome: 'Amostras', ofertas: ['Kit Amostras'], agressividade: 1 },
    ],
  },
  Rituaria: {
    diasAtivos: [1, 2, 3, 4, 5, 6],
    maxDiasCom3: 2,
    volumeSemana: 310_000,
    rpmBase: 19.3,
    familias: [
      { nome: 'Ritual', ofertas: ['Ritual Noturno', 'Ritual Matinal'], agressividade: 1 },
      { nome: 'Cupom', ofertas: ['Cupom 15%'], agressividade: 3 },
      { nome: 'Combo', ofertas: ['Combo Essencial'], agressividade: 2 },
      { nome: 'Brinde', ofertas: ['Brinde Surpresa'], agressividade: 2 },
    ],
  },
  Kokeshi: {
    diasAtivos: [1, 2, 3, 4, 5],
    maxDiasCom3: 2,
    volumeSemana: 270_000,
    rpmBase: 17.8,
    familias: [
      { nome: 'Necessaire', ofertas: ['Necessaire Kokeshi'], agressividade: 2 },
      { nome: 'Cupom', ofertas: ['Cupom 10%', 'Cupom 20%'], agressividade: 3 },
      { nome: 'Lancamento', ofertas: ['Lançamento Coleção'], agressividade: 1 },
      { nome: 'Amostras', ofertas: ['Kit Amostras'], agressividade: 1 },
    ],
  },
};

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

export function gerarCalendarioDemo(input: InputCalendario): CalendarioGerado {
  const cfg = CONFIG[input.marca as MarcaAtiva] ?? CONFIG.Lescent;
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

  // ── FASE 2c — quais dias recebem o 3º slot, por semana ────────────────────
  // Candidatos: só dias com suporte histórico (H3). Ranqueados por I1 e limitados
  // ao teto operacional (H1), que é semanal por natureza e se aplica por semana
  // dentro do período, nunca ao período inteiro (§10.7).
  const diasCom3 = new Set<string>();
  for (const semana of semanas) {
    const candidatos = semana
      .filter((d) => SUPORTE_3_OFERTAS[d.getDay()] > 0)
      .sort((a, b) => INDICE_DIA[b.getDay()] - INDICE_DIA[a.getDay()])
      .slice(0, cfg.maxDiasCom3);
    for (const d of candidatos) diasCom3.add(paraISO(d));
  }

  // Modo B corta os 3ºs slots antes de qualquer outra coisa: a Fase 1 mede que só 40%
  // dos e-mails extras alcançam alguém novo — os outros 60% são repetição, o volume de
  // pior eficiência marginal do plano (§6.3).
  const nSlotsPorDia = (iso: string) => (!eficiencia && diasCom3.has(iso) ? 3 : 2);

  // ── FASE 3 — alocação de volume por dia ───────────────────────────────────
  // O índice de dia entra na receita como A_d = I1^0,90 (o coeficiente que transferiu no
  // walk-forward). A alocação que maximiza Σ A_d·V_d^α sob ΣV fixo é V_d ∝ A_d^(1/(1-α)),
  // ou seja I1^(0,90/(1-α)). Os dois expoentes PRECISAM casar: se a alocação usasse I1 cru,
  // ela deixaria de ser ótima e a etapa de redistribuição poderia perder receita — o que
  // seria um artefato aritmético, não um resultado do modelo. Normalizado sobre os dias
  // contidos no período (§10.7a).
  const pesoDia = dias.map((d) => Math.pow(INDICE_DIA[d.getDay()], 0.9 / (1 - ALPHA)));
  const somaPesos = pesoDia.reduce((a, b) => a + b, 0);

  const volumeBase = input.volumeMaximo ?? Math.round((cfg.volumeSemana * dias.length) / cfg.diasAtivos.length);
  // No modo B o corte de volume é o que compra RPM, na taxa -0,69 medida.
  const volumeTotal = eficiencia ? Math.round(volumeBase * 0.85) : volumeBase;

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

  const indiceFamilia = new Map<string, number>();
  cfg.familias.forEach((f, i) => {
    indiceFamilia.set(f.nome, Number((0.8 + ((semente >> (i + 2)) % 42) / 100).toFixed(3)));
  });
  const mediaFamilia = [...indiceFamilia.values()].reduce((a, b) => a + b, 0) / cfg.familias.length;
  const qualidadeFamilia = (nome: string) =>
    Math.pow((indiceFamilia.get(nome) ?? mediaFamilia) / mediaFamilia, 0.52);
  const mediaQualidadeFamilia =
    cfg.familias.reduce((a, f) => a + qualidadeFamilia(f.nome), 0) / cfg.familias.length;

  // ── FASES 4 e 5 — rodízio de família, depois oferta e horário ─────────────
  const slots: CalendarioSlot[] = [];
  const usoOfertaNaSemana = new Map<string, number>();
  // Último disparo de cada família, para o gap real da §1.4.
  const ultimoUso = new Map<string, { dia: number; hora: number }>();
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
      // (rígida, nunca relaxada); o descanso elimina quem disparou nas últimas 48h. Entre as
      // que sobram, vence o maior índice — é isto que faz do rodízio uma alavanca e não um
      // sorteio. Se o descanso não deixar ninguém, ele cede antes de H2.
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
      const familia = pool.reduce((melhor, f) =>
        (indiceFamilia.get(f.nome) ?? 0) > (indiceFamilia.get(melhor.nome) ?? 0) ? f : melhor,
      );

      const usoAnterior = ultimoUso.get(familia.nome);
      const gapFamiliaH = usoAnterior
        ? (indiceDia - usoAnterior.dia) * 24 + (hora - usoAnterior.hora)
        : 999;
      familiasUsadasHoje.add(familia.nome);
      ultimoUso.set(familia.nome, { dia: indiceDia, hora });

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
    snapshotIndicesId: `snap-${(semente >> 4).toString(16)}-fixture`,
    geradoEm: new Date().toISOString(),
    slots,
    previsao,
    decomposicao,
    fronteira,
    restricoesAplicadas,
    restricoesRelaxadas,
    avisos,
  };
}
