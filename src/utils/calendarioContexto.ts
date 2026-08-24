import type { ConfigMarca } from './calendarioDemo';

/**
 * Traduz o contexto do BigQuery (`GET /api/calendario/contexto`) para a config que
 * o gerador consome.
 *
 * Este arquivo é a fronteira entre "o que o histórico registrou" e "o que dá para
 * agendar num calendário". As duas coisas não são a mesma, e a diferença é o
 * assunto do bloco EXCLUSÕES abaixo.
 */

export interface ContextoBigQuery {
  marca: string;
  config: {
    ativo: boolean;
    maxDiasCom3: number;
    diasAtivos: number[];
    gradeHorarios: number[][];
    volumeMaximoSemana: number | null;
  };
  catalogo: { oferta: string; familia: string; agressividade: number }[];
  indices: {
    i1Dia: { nivel: string; valor: number; nObservacoes: number; veredito: string }[];
    i4Oferta: { nivel: string; valor: number; nObservacoes: number; veredito: string }[];
    alpha: number;
  };
  viabilidade: { dow: number; diasObservados: number; dias3Ofertas: number }[];
  baseline: { rpm: number; volumeSemana: number; dias: number; enviados: number };
}

const DOW_POR_NOME: Record<string, number> = {
  Domingo: 0, Segunda: 1, Terca: 2, Terça: 2, Quarta: 3,
  Quinta: 4, Sexta: 5, Sabado: 6, Sábado: 6,
};

// ─────────────────────────────────────────────────────────────────────────────
// EXCLUSÕES — o que está no histórico mas não pode virar slot
//
// O catálogo vem de `marca_config.oferta_case`, que classifica TODA campanha
// registrada. Nem toda campanha registrada é agendável, e duas classes precisam
// sair antes de o gerador ver o catálogo:
//
// 1. AUTOMAÇÃO (família "Expresso" na Lescent — 5 das 22 "ofertas").
//    "Expresso" não é uma oferta, é a pilha de automação: expresso_yampi,
//    expresso_omnisend, cart2x3d, repurchase, purchase-prioritário. Um slot é
//    (marca, data, hora, oferta) — algo que uma pessoa agenda. Fluxo disparado
//    por comportamento do usuário não tem data para ser agendada: não se marca
//    carrinho abandonado para quarta às 9h. Ele já roda, o tempo todo, e não é
//    decisão do calendário.
//
//    A distorção de número é consequência, não a causa da exclusão: automação
//    roda a RPM ~965 contra ~139 de campanha (7×), porque dispara para quem
//    acabou de demonstrar intenção. Misturar as duas infla a expectativa de
//    qualquer família que contenha automação. Mas mesmo que os números fossem
//    idênticos, ela continuaria fora — pela definição de slot.
//
// 2. RESÍDUO DE CLASSIFICAÇÃO ("Sem Oferta" / "OUTROS").
//    É a cesta do que o CASE não soube nomear. Não se agenda "OUTROS".
//
// O QUE ESTA EXCLUSÃO CUSTA, dito na tela e não escondido aqui: automação também
// chega na caixa de entrada e também consome atenção. Tirá-la do baseline faz o
// modelo de fadiga enxergar só campanha, e portanto subestimar a pressão real
// sobre a base. A correção certa é um eixo `tipo_envio` que separe as duas sem
// jogar uma fora — maior, e não entra junto com a ligação do catálogo.
// ─────────────────────────────────────────────────────────────────────────────

const FAMILIAS_AUTOMACAO = ['expresso'];
const FAMILIAS_RESIDUO = ['sem oferta'];
const OFERTAS_RESIDUO = ['outros'];

export interface ResultadoContexto {
  config: ConfigMarca;
  excluidas: { familia: string; ofertas: string[]; motivo: string }[];
}

function ehAutomacao(familia: string): boolean {
  return FAMILIAS_AUTOMACAO.includes(familia.trim().toLowerCase());
}
function ehResiduo(familia: string, oferta: string): boolean {
  return (
    FAMILIAS_RESIDUO.includes(familia.trim().toLowerCase()) ||
    OFERTAS_RESIDUO.includes(oferta.trim().toLowerCase())
  );
}

export function configDoContexto(ctx: ContextoBigQuery): ResultadoContexto {
  const excluidas: ResultadoContexto['excluidas'] = [];
  const porFamilia = new Map<string, { nome: string; ofertas: string[]; agressividade: number }>();

  const agrupaExcluida = (familia: string, oferta: string, motivo: string) => {
    const achou = excluidas.find((e) => e.familia === familia && e.motivo === motivo);
    if (achou) achou.ofertas.push(oferta);
    else excluidas.push({ familia, ofertas: [oferta], motivo });
  };

  for (const item of ctx.catalogo) {
    if (ehAutomacao(item.familia)) {
      agrupaExcluida(item.familia, item.oferta, 'fluxo automatizado — não é agendável como slot');
      continue;
    }
    if (ehResiduo(item.familia, item.oferta)) {
      agrupaExcluida(item.familia, item.oferta, 'resíduo de classificação — sem oferta nomeada');
      continue;
    }
    const atual = porFamilia.get(item.familia);
    if (atual) {
      atual.ofertas.push(item.oferta);
      // Agressividade da família = a da oferta mais agressiva que ela contém.
      atual.agressividade = Math.max(atual.agressividade, item.agressividade);
    } else {
      porFamilia.set(item.familia, {
        nome: item.familia,
        ofertas: [item.oferta],
        agressividade: item.agressividade,
      });
    }
  }

  // I1 chega como lista rotulada por nome de dia; o gerador indexa por dow.
  // Nível ausente vira 1 (neutro) em vez de 0 — 0 zeraria o peso do dia e o
  // tiraria do plano por falta de linha na tabela, que é bug silencioso.
  const indiceDia = [1, 1, 1, 1, 1, 1, 1];
  for (const linha of ctx.indices.i1Dia) {
    const dow = DOW_POR_NOME[linha.nivel];
    if (dow !== undefined) indiceDia[dow] = linha.valor;
  }

  const suporte3 = [0, 0, 0, 0, 0, 0, 0];
  for (const v of ctx.viabilidade) suporte3[v.dow] = v.dias3Ofertas;

  return {
    config: {
      diasAtivos: ctx.config.diasAtivos,
      maxDiasCom3: ctx.config.maxDiasCom3,
      familias: [...porFamilia.values()],
      volumeSemana: ctx.config.volumeMaximoSemana ?? ctx.baseline.volumeSemana,
      rpmBase: ctx.baseline.rpm,
      procedencia: 'dados',
      grade: ctx.config.gradeHorarios,
      indiceDia,
      suporte3,
      alpha: ctx.indices.alpha,
      // Sem índice por família no BigQuery — ver a nota longa em calendarioDemo.ts.
      // Deixar indefinido faz o gerador usar neutro, que é a leitura honesta.
      indiceFamilia: undefined,
    },
    excluidas,
  };
}
