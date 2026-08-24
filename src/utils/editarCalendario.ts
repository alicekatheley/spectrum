import { CalendarioGerado, CalendarioSlot, PontoFronteira } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Edição manual do calendário gerado.
//
// O plano sai do modelo, mas quem responde por ele é o time de CRM — e há sempre um motivo
// que o modelo não vê (uma troca de peça, um estoque que não chegou, uma decisão de marca).
// Então o calendário é editável. O que NÃO pode acontecer é a edição mexer no plano e a tela
// continuar mostrando os números do plano anterior: seria a pior das duas opções, um número
// com autoridade de modelo descrevendo uma grade que o modelo não propôs.
//
// Por isso cada edição propaga pela MESMA aritmética da geração, e cada campo propaga do seu
// jeito — que é diferente por campo, e essa diferença é o conteúdo do arquivo:
//
//   hora    → não mexe em receita nenhuma. I3 transferiu a 0,00 no walk-forward (§4.5): o
//             modelo não sabe dizer que 15h rende mais que 20h. Mover o horário reordena o
//             dia e nada mais. Fingir um ganho aqui seria inventar o efeito que a validação
//             justamente não encontrou.
//   oferta  → idem, DENTRO da mesma família. I4 também transferiu a 0,00. A família é que é
//             a unidade de fadiga e a alavanca medida (§1.4).
//   família → mexe, e é a única troca qualitativa que mexe. I2 tem coeficiente 0,52.
//   envios  → mexe no slot E em todos os outros do mesmo dia, porque a elasticidade da §6.1
//             é uma propriedade do DIA: o retorno decrescente vem de esgotar a mesma base.
// ─────────────────────────────────────────────────────────────────────────────

const ALPHA = 0.31;
const COEF_FAMILIA = 0.52;

export interface EdicaoSlot {
  hora?: number;
  oferta?: string;
  familia?: string;
  enviosPlanejados?: number;
}

/** Identidade estável de um slot dentro do calendário — `slot` renumera ao reordenar. */
export const chaveSlot = (s: CalendarioSlot) => `${s.data}|${s.hora}|${s.oferta}`;

/**
 * Índice I2 de cada família, lido do próprio plano.
 *
 * O índice não é recalculável fora do gerador (depende do snapshot), mas todo slot carrega o
 * seu em `indices.familia`. Famílias que o plano usou têm índice conhecido; trocar para uma
 * que ele não usou não tem número, e a chamada é recusada em vez de estimada.
 */
export function indicesFamilia(cal: CalendarioGerado): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const s of cal.slots) if (!mapa.has(s.familia)) mapa.set(s.familia, s.indices.familia);
  return mapa;
}

/** Famílias presentes no plano, ordenadas por índice — a lista que a edição pode oferecer. */
export function familiasDisponiveis(cal: CalendarioGerado): { nome: string; indice: number }[] {
  return [...indicesFamilia(cal).entries()]
    .map(([nome, indice]) => ({ nome, indice }))
    .sort((a, b) => b.indice - a.indice);
}

/** Horas livres no dia — H2 não é sobre hora, mas dois disparos na mesma hora é absurdo operacional. */
export function horasOcupadas(cal: CalendarioGerado, data: string, exceto: string): Set<number> {
  return new Set(
    cal.slots.filter((s) => s.data === data && chaveSlot(s) !== exceto).map((s) => s.hora),
  );
}

/** Famílias já usadas no dia — H2 é rígida e a edição não pode furá-la. */
export function familiasOcupadas(cal: CalendarioGerado, data: string, exceto: string): Set<string> {
  return new Set(
    cal.slots.filter((s) => s.data === data && chaveSlot(s) !== exceto).map((s) => s.familia),
  );
}

function recalcularAgregados(cal: CalendarioGerado): CalendarioGerado {
  const receita = cal.slots.reduce((a, s) => a + s.receitaPrevista, 0);
  const envios = cal.slots.reduce((a, s) => a + s.enviosPlanejados, 0);
  const ritmo = cal.previsao.ritmoDeHoje;

  // A fronteira é a curva do plano ATUAL — ela precisa acompanhar a edição, senão passaria a
  // descrever um plano que não existe mais. Mesmo α, mesma construção da §6.4.
  const fronteira: PontoFronteira[] = cal.fronteira.map(({ deltaVolumePct }) => {
    const fator = 1 + deltaVolumePct / 100;
    const r = receita * Math.pow(fator, ALPHA);
    return {
      deltaVolumePct,
      receita: Math.round(r),
      rpm: Number(((r / (envios * fator)) * 1000).toFixed(1)),
    };
  });

  return {
    ...cal,
    editadoManualmente: true,
    previsao: {
      ritmoDeHoje: ritmo,
      validado: Math.round(receita),
      inSampleNaoUsar: Math.round(receita * 1.18),
      ganhoValidadoPct: Number((((receita - ritmo) / ritmo) * 100).toFixed(1)),
    },
    fronteira,
  };
}

/**
 * Aplica uma edição e devolve um calendário novo. Retorna `null` quando a edição fura uma
 * restrição rígida — a recusa é do modelo, não da tela, e por isso mora aqui.
 */
export function editarSlot(
  cal: CalendarioGerado,
  chave: string,
  edicao: EdicaoSlot,
): CalendarioGerado | null {
  const alvo = cal.slots.find((s) => chaveSlot(s) === chave);
  if (!alvo) return null;

  const novaHora = edicao.hora ?? alvo.hora;
  const novaFamilia = edicao.familia ?? alvo.familia;
  const novosEnvios = Math.max(1, Math.round(edicao.enviosPlanejados ?? alvo.enviosPlanejados));
  const novaOferta = (edicao.oferta ?? alvo.oferta).trim() || alvo.oferta;

  if (novaHora < 0 || novaHora > 23) return null;
  if (horasOcupadas(cal, alvo.data, chave).has(novaHora)) return null;
  if (familiasOcupadas(cal, alvo.data, chave).has(novaFamilia)) return null;

  const indices = indicesFamilia(cal);
  const indiceNovo = indices.get(novaFamilia);
  if (indiceNovo === undefined) return null;

  // ── Volume: a elasticidade é do dia, não do slot ────────────────────────────
  // receita_j = K_j · envios_j · V_dia^(α−1), com K_j fixo por slot. Sai direto da §6.1 e é
  // exata, não aproximação: mexer no volume de UM slot muda o total do dia e reprecifica os
  // outros. Se cada slot fosse reprecificado sozinho, dobrar o volume de um dobraria a receita
  // dele — que é justamente o que a elasticidade diz não acontecer.
  const doDia = cal.slots.filter((s) => s.data === alvo.data);
  const volumeDiaAntes = doDia.reduce((a, s) => a + s.enviosPlanejados, 0);
  const volumeDiaDepois = volumeDiaAntes - alvo.enviosPlanejados + novosEnvios;
  const fatorDia = Math.pow(volumeDiaDepois / volumeDiaAntes, ALPHA - 1);

  const fatorFamilia = Math.pow(indiceNovo / alvo.indices.familia, COEF_FAMILIA);

  const slots = cal.slots.map((s) => {
    if (s.data !== alvo.data) return s;

    const ehAlvo = chaveSlot(s) === chave;
    const envios = ehAlvo ? novosEnvios : s.enviosPlanejados;
    const escala = fatorDia * (ehAlvo ? (novosEnvios / s.enviosPlanejados) * fatorFamilia : 1);
    const receita = Math.round(s.receitaPrevista * escala);

    return {
      ...s,
      ...(ehAlvo
        ? {
            hora: novaHora,
            oferta: novaOferta,
            familia: novaFamilia,
            indices: { ...s.indices, familia: indiceNovo },
            editado: true,
          }
        : {}),
      enviosPlanejados: envios,
      receitaPrevista: receita,
      rpmPrevisto: Number(((receita / envios) * 1000).toFixed(1)),
      confianca: {
        ...s.confianca,
        ic80: [
          Math.round(s.confianca.ic80[0] * escala),
          Math.round(s.confianca.ic80[1] * escala),
        ] as [number, number],
      },
    };
  });

  // Reordena o dia por hora e renumera. `slot` é a posição no dia, não um identificador —
  // um card movido de 20h para 15h precisa passar à frente do de 16h, na grade e no número.
  const porData = new Map<string, CalendarioSlot[]>();
  for (const s of slots) porData.set(s.data, [...(porData.get(s.data) ?? []), s]);
  const renumerados = [...porData.values()].flatMap((doMesmoDia) =>
    doMesmoDia.sort((a, b) => a.hora - b.hora).map((s, i) => ({ ...s, slot: i + 1 })),
  );
  renumerados.sort((a, b) => a.data.localeCompare(b.data) || a.hora - b.hora);

  return recalcularAgregados({ ...cal, slots: renumerados });
}

/** Remove um slot. O volume dele não é redistribuído: sai do plano, não muda de lugar. */
export function removerSlot(cal: CalendarioGerado, chave: string): CalendarioGerado | null {
  const alvo = cal.slots.find((s) => chaveSlot(s) === chave);
  if (!alvo) return null;

  const doDia = cal.slots.filter((s) => s.data === alvo.data);
  if (doDia.length === 1) return null; // dia vazio não é um dia editado, é um dia apagado

  const volumeAntes = doDia.reduce((a, s) => a + s.enviosPlanejados, 0);
  const fatorDia = Math.pow(
    (volumeAntes - alvo.enviosPlanejados) / volumeAntes,
    ALPHA - 1,
  );

  const slots = cal.slots
    .filter((s) => chaveSlot(s) !== chave)
    .map((s) => {
      if (s.data !== alvo.data) return s;
      const receita = Math.round(s.receitaPrevista * fatorDia);
      return {
        ...s,
        receitaPrevista: receita,
        rpmPrevisto: Number(((receita / s.enviosPlanejados) * 1000).toFixed(1)),
      };
    });

  const porData = new Map<string, CalendarioSlot[]>();
  for (const s of slots) porData.set(s.data, [...(porData.get(s.data) ?? []), s]);
  const renumerados = [...porData.values()].flatMap((doMesmoDia) =>
    doMesmoDia.sort((a, b) => a.hora - b.hora).map((s, i) => ({ ...s, slot: i + 1 })),
  );
  renumerados.sort((a, b) => a.data.localeCompare(b.data) || a.hora - b.hora);

  return recalcularAgregados({ ...cal, slots: renumerados });
}
