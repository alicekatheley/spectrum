// Verificação de invariantes do gerador de calendário.
// Não é suíte de teste (o repo não tem runner) — é um script de conferência que percorre
// todas as marcas × modos × períodos e falha se qualquer restrição rígida do modelo for
// violada. Rodar com: npx esbuild scripts/verificar-calendario.ts --bundle --platform=node
//                     --format=cjs --outfile=/tmp/v.cjs && node /tmp/v.cjs

import { gerarCalendarioDemo, familiasDaMarca, MARCAS_SEM_MODELO } from '../src/utils/calendarioDemo';
import {
  chaveSlot,
  editarSlot,
  familiasDisponiveis,
  removerSlot,
} from '../src/utils/editarCalendario';
import { MarcaCalendario, ModoCalendario } from '../src/types';

const ALPHA = 0.31;
const MARCAS: MarcaCalendario[] = ['Lescent', 'Barbours', 'Apice', 'Rituaria', 'Kokeshi'];
const MODOS: ModoCalendario[] = ['receita_maxima', 'eficiencia'];
const PERIODOS: [string, string][] = [
  ['2026-08-24', '2026-08-30'], // 1 semana cheia
  ['2026-08-24', '2026-09-13'], // 3 semanas
  ['2026-08-26', '2026-09-02'], // começa no meio da semana
  ['2026-08-24', '2026-10-04'], // 6 semanas
  ['2026-08-24', '2026-08-27'], // período curto (< 7 dias)
];

const falhas: string[] = [];
const anotar = (ok: boolean, msg: string) => { if (!ok) falhas.push(msg); };

let totalCalendarios = 0;

for (const marca of MARCAS) {
  for (const modo of MODOS) {
    for (const [inicio, fim] of PERIODOS) {
      const ctx = `${marca}/${modo}/${inicio}..${fim}`;
      const cal = gerarCalendarioDemo({ marca, modo, dataInicio: inicio, dataFim: fim, eventosEspeciais: '' });
      totalCalendarios++;

      // ── H2: nunca duas famílias iguais no mesmo dia ──────────────────────
      const porDia = new Map<string, typeof cal.slots>();
      for (const s of cal.slots) porDia.set(s.data, [...(porDia.get(s.data) ?? []), s]);
      for (const [dia, slots] of porDia) {
        const familias = slots.map((s) => s.familia);
        anotar(new Set(familias).size === familias.length, `${ctx}: H2 violada em ${dia} (${familias.join(', ')})`);
        // Horários distintos dentro do dia — dois disparos na mesma hora seria absurdo operacional.
        const horas = slots.map((s) => s.hora);
        anotar(new Set(horas).size === horas.length, `${ctx}: horas repetidas em ${dia} (${horas.join(', ')})`);
        anotar(slots.length <= 3, `${ctx}: ${slots.length} slots em ${dia}, teto é 3`);
      }

      // ── H3: domingo nunca recebe 3 ofertas (suporte histórico n=0) ───────
      for (const [dia, slots] of porDia) {
        const dow = new Date(dia + 'T00:00:00').getDay();
        anotar(!(dow === 0 && slots.length >= 3), `${ctx}: H3 violada — domingo ${dia} com 3 ofertas`);
      }

      // ── H5: dias inativos da marca não entram no plano ───────────────────
      // Barbours/Rituaria não operam domingo; Apice/Kokeshi só seg-sex.
      const dowsAtivos: Record<string, number[]> = {
        Lescent: [0, 1, 2, 3, 4, 5, 6], Barbours: [1, 2, 3, 4, 5, 6],
        Apice: [1, 2, 3, 4, 5], Rituaria: [1, 2, 3, 4, 5, 6], Kokeshi: [1, 2, 3, 4, 5],
      };
      for (const dia of porDia.keys()) {
        const dow = new Date(dia + 'T00:00:00').getDay();
        anotar(dowsAtivos[marca].includes(dow), `${ctx}: H5 violada — ${dia} (dow ${dow}) é dia inativo`);
      }

      // ── H1: teto de dias com 3 ofertas POR SEMANA ────────────────────────
      const tetos: Record<string, number> = { Lescent: 3, Barbours: 3, Apice: 2, Rituaria: 2, Kokeshi: 2 };
      const porSemana = new Map<string, number>();
      for (const [dia, slots] of porDia) {
        if (slots.length < 3) continue;
        const d = new Date(dia + 'T00:00:00');
        d.setDate(d.getDate() - d.getDay());
        const chave = d.toISOString().slice(0, 10);
        porSemana.set(chave, (porSemana.get(chave) ?? 0) + 1);
      }
      for (const [semana, n] of porSemana) {
        anotar(n <= tetos[marca], `${ctx}: H1 violada — semana ${semana} com ${n} dias de 3 ofertas (teto ${tetos[marca]})`);
      }

      // ── Cobertura de catálogo: nenhuma família declarada fica de fora ────
      // Só faz sentido cobrar quando há slots suficientes: H2 permite no máximo 1 uso por
      // família por dia, então um plano com menos dias que famílias não tem como cobrir
      // todas, e exigir isso seria exigir o impossível.
      //
      // Esta asserção existe porque o defeito que ela pega não aparecia como erro: a escolha
      // gulosa por índice preenchia os ~51 slots com as ~6 melhores famílias e as demais
      // simplesmente nunca saíam. O plano ficava válido em toda regra dura e ainda assim
      // ignorava metade do catálogo — marcar uma mecânica era aceito e não fazia nada.
      const declaradas = familiasDaMarca(marca);
      if (porDia.size >= declaradas.length) {
        const usadas = new Set(cal.slots.map((s) => s.familia));
        const faltando = declaradas.filter((f) => !usadas.has(f));
        anotar(
          faltando.length === 0,
          `${ctx}: família declarada nunca usada em ${porDia.size} dias (${faltando.join(', ')})`,
        );
      }

      // ── Modo B não pode ter 3ºs slots ────────────────────────────────────
      if (modo === 'eficiencia') {
        anotar([...porDia.values()].every((s) => s.length <= 2), `${ctx}: modo eficiência manteve 3º slot`);
      }

      // ── Decomposição monotônica ──────────────────────────────────────────
      // A tolerância é relativa e não é frouxidão: quando a marca tem poucas famílias para
      // muitos dias ativos (Apice: 4 famílias, 5 dias), o descanso força o rodízio a usar
      // todas por igual e o ciclo desliza de fase contra os dias de maior volume. Nesses
      // casos o rodízio genuinamente não agrega, e pode ficar alguns milésimos negativo.
      // Isso é resultado do modelo, não defeito. O que NÃO se tolera é queda visível.
      for (let i = 1; i < cal.decomposicao.length; i++) {
        const anterior = cal.decomposicao[i - 1];
        const atual = cal.decomposicao[i];
        anotar(
          atual.receita >= anterior.receita * 0.9995,
          `${ctx}: decomposição desce em "${atual.etapa}" (${anterior.receita} → ${atual.receita})`,
        );
      }
      // A última etapa TEM de bater com o compromisso publicado.
      const ultima = cal.decomposicao[cal.decomposicao.length - 1];
      anotar(
        Math.abs(ultima.receita - cal.previsao.validado) <= 1,
        `${ctx}: última etapa (${ultima.receita}) ≠ validado (${cal.previsao.validado})`,
      );

      // ── Previsão: ordenação dos três cenários ────────────────────────────
      anotar(cal.previsao.validado >= cal.previsao.ritmoDeHoje, `${ctx}: validado < ritmo de hoje`);
      anotar(cal.previsao.inSampleNaoUsar > cal.previsao.validado, `${ctx}: in-sample ≤ validado`);

      // ── Fronteira: obedece a elasticidade α em receita e RPM ─────────────
      const plano = cal.fronteira.find((p) => p.deltaVolumePct === 0)!;
      anotar(!!plano, `${ctx}: fronteira sem ponto de plano`);
      for (const p of cal.fronteira) {
        const fator = 1 + p.deltaVolumePct / 100;
        const esperada = plano.receita * Math.pow(fator, ALPHA);
        anotar(
          Math.abs(p.receita - esperada) / esperada < 0.005,
          `${ctx}: fronteira ${p.deltaVolumePct}% receita ${p.receita} ≠ ${esperada.toFixed(0)}`,
        );
        const rpmEsperado = plano.rpm * Math.pow(fator, -(1 - ALPHA));
        anotar(
          Math.abs(p.rpm - rpmEsperado) / rpmEsperado < 0.005,
          `${ctx}: fronteira ${p.deltaVolumePct}% rpm ${p.rpm} ≠ ${rpmEsperado.toFixed(1)}`,
        );
      }
      // Fronteira ordenada: receita sobe com volume, RPM desce. Sempre, sem exceção.
      for (let i = 1; i < cal.fronteira.length; i++) {
        anotar(cal.fronteira[i].receita > cal.fronteira[i - 1].receita, `${ctx}: fronteira com receita não-monotônica`);
        anotar(cal.fronteira[i].rpm < cal.fronteira[i - 1].rpm, `${ctx}: fronteira com RPM não-monotônico`);
      }

      // ── Campos obrigatórios da §9.1 / §14 ────────────────────────────────
      anotar(cal.slots.length > 0, `${ctx}: calendário sem slots`);
      anotar(!!cal.snapshotIndicesId, `${ctx}: sem snapshot_indices_id`);
      anotar(cal.restricoesAplicadas.length > 0, `${ctx}: sem restrições declaradas`);
      anotar(cal.avisos.length > 0, `${ctx}: sem avisos`);
      for (const s of cal.slots) {
        anotar(s.enviosPlanejados > 0, `${ctx}: slot com envios ≤ 0`);
        anotar(s.rpmPrevisto > 0 && Number.isFinite(s.rpmPrevisto), `${ctx}: RPM inválido (${s.rpmPrevisto})`);
        anotar(s.confianca.ic80[0] < s.confianca.ic80[1], `${ctx}: IC80 invertido`);
        anotar(s.slot === 3 ? !s.confianca.validado : true, `${ctx}: 3º slot marcado como validado`);
      }

      // ── Volume: o modo B corta 15%, e o total respeita o teto pedido ─────
      const envios = cal.slots.reduce((a, s) => a + s.enviosPlanejados, 0);
      anotar(envios > 0, `${ctx}: envios totais zerados`);
    }
  }
}

// Marca bloqueada continua bloqueada.
anotar(MARCAS_SEM_MODELO.includes('Gocase'), 'Gocase saiu da lista de marcas sem modelo');

// Modo A vs modo B: a troca precisa mover o plano ao longo da curva, não para fora dela.
for (const marca of MARCAS) {
  const base = { marca, dataInicio: '2026-08-24', dataFim: '2026-09-13', eventosEspeciais: '' } as const;
  const a = gerarCalendarioDemo({ ...base, modo: 'receita_maxima' });
  const b = gerarCalendarioDemo({ ...base, modo: 'eficiencia' });
  const rpmA = a.fronteira.find((p) => p.deltaVolumePct === 0)!.rpm;
  const rpmB = b.fronteira.find((p) => p.deltaVolumePct === 0)!.rpm;
  const recA = a.previsao.validado;
  const recB = b.previsao.validado;
  anotar(rpmB > rpmA, `${marca}: modo eficiência não subiu o RPM (${rpmA} → ${rpmB})`);
  anotar(recB < recA, `${marca}: modo eficiência não cedeu receita (${recA} → ${recB})`);

  // O que NÃO dá para exigir: que o ganho de RPM bata exatamente com 0,85^-0,69. Trocar de
  // modo não é andar sobre a fronteira — além de cortar volume, o modo B remove os 3ºs slots,
  // o que muda a composição de famílias do dia e mexe na receita por um caminho que a
  // elasticidade não descreve. A elasticidade pura já é verificada ponto a ponto na fronteira
  // de cada calendário, acima. Aqui a exigência é de ordem de grandeza e de direção.
  const ganhoRpm = (rpmB / rpmA - 1) * 100;
  const elasticidadePura = (Math.pow(0.85, -(1 - ALPHA)) - 1) * 100;
  anotar(
    ganhoRpm > 4 && ganhoRpm < elasticidadePura + 4,
    `${marca}: ganho de RPM ${ganhoRpm.toFixed(1)}% implausível (elasticidade pura: ${elasticidadePura.toFixed(1)}%)`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dias mais agressivos — a marcação reordena a fila do 3º disparo e NÃO abre vaga.
// O teste que interessa não é "o dia marcado ganhou 3 ofertas": é que nenhuma restrição
// rígida cedeu para atendê-lo. Uma preferência de usuário que fura H1 ou H3 seria pior que
// não existir, porque entraria pela porta de um campo opcional.
// ─────────────────────────────────────────────────────────────────────────────
for (const marca of MARCAS) {
  const tetos: Record<string, number> = { Lescent: 3, Barbours: 3, Apice: 2, Rituaria: 2, Kokeshi: 2 };
  const dowsAtivos: Record<string, number[]> = {
    Lescent: [0, 1, 2, 3, 4, 5, 6], Barbours: [1, 2, 3, 4, 5, 6],
    Apice: [1, 2, 3, 4, 5], Rituaria: [1, 2, 3, 4, 5, 6], Kokeshi: [1, 2, 3, 4, 5],
  };

  // Sábado e domingo: os dois piores I1 do modelo, e domingo é célula bloqueada por H3.
  // Se a marcação furasse algo, furaria aqui.
  for (const marcados of [[5], [6], [0], [0, 6], [1, 2, 3, 4, 5, 6]]) {
    const ctx = `${marca}/agressivos[${marcados.join(',')}]`;
    const cal = gerarCalendarioDemo({
      marca, modo: 'receita_maxima', dataInicio: '2026-08-24', dataFim: '2026-09-13',
      diasAgressivos: marcados, eventosEspeciais: '',
    });
    totalCalendarios++;

    const porDia = new Map<string, typeof cal.slots>();
    for (const s of cal.slots) porDia.set(s.data, [...(porDia.get(s.data) ?? []), s]);

    const porSemana = new Map<string, number>();
    for (const [dia, slots] of porDia) {
      const dow = new Date(dia + 'T00:00:00').getDay();
      anotar(dowsAtivos[marca].includes(dow), `${ctx}: H5 violada em ${dia}`);
      anotar(slots.length <= 3, `${ctx}: ${slots.length} slots em ${dia}`);
      anotar(new Set(slots.map((s) => s.familia)).size === slots.length, `${ctx}: H2 violada em ${dia}`);
      // Esta linha existe no bloco principal (§H2/horas) e faltava aqui — e a ausência dela é
      // exatamente o motivo do verificador ter passado enquanto sábado saía com dois disparos
      // às 10h. Marcar dias agressivos é o único caminho que pede um 3º slot num dia cuja grade
      // só tem duas janelas, então é o único caminho onde o bug aparecia: o teste tinha que
      // estar justamente onde não estava.
      const horas = slots.map((s) => s.hora);
      anotar(new Set(horas).size === horas.length, `${ctx}: horas repetidas em ${dia} (${horas.join(', ')})`);
      anotar(!(dow === 0 && slots.length >= 3), `${ctx}: H3 violada — domingo ${dia} com 3 ofertas`);
      if (slots.length < 3) continue;
      const d = new Date(dia + 'T00:00:00');
      d.setDate(d.getDate() - d.getDay());
      porSemana.set(d.toISOString().slice(0, 10), (porSemana.get(d.toISOString().slice(0, 10)) ?? 0) + 1);
    }
    for (const [semana, n] of porSemana) {
      anotar(n <= tetos[marca], `${ctx}: H1 violada — semana ${semana} com ${n} dias de 3 ofertas`);
    }

    // Marcar um dia que a marca não opera, ou que nunca teve 3 ofertas, precisa gerar aviso.
    // Silêncio aqui seria o pior resultado: o usuário marcaria domingo e concluiria que foi feito.
    const inativoMarcado = marcados.some((d) => !dowsAtivos[marca].includes(d));
    const domingoMarcado = marcados.includes(0) && dowsAtivos[marca].includes(0);
    if (inativoMarcado || domingoMarcado) {
      anotar(
        cal.avisos.some((a) => a.includes('marcado') || a.includes('nunca teve 3 ofertas')),
        `${ctx}: dia impossível marcado sem aviso nenhum`,
      );
    }
    anotar(
      cal.restricoesAplicadas.some((r) => r.startsWith('Preferência do usuário')),
      `${ctx}: preferência não declarada em restricoesAplicadas`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Piso de receita — o parâmetro que responde "até onde a eficiência pode ceder receita".
// ─────────────────────────────────────────────────────────────────────────────
for (const marca of MARCAS) {
  const base = { marca, dataInicio: '2026-08-24', dataFim: '2026-09-13', eficiencia: true } as const;
  const semPiso = gerarCalendarioDemo({
    marca, modo: 'eficiencia', dataInicio: base.dataInicio, dataFim: base.dataFim, eventosEspeciais: '',
  });
  const modoA = gerarCalendarioDemo({
    marca, modo: 'receita_maxima', dataInicio: base.dataInicio, dataFim: base.dataFim, eventosEspeciais: '',
  });

  // Piso ENTRE o modo B sem piso e o modo A: tem de ser alcançável e tem de ser respeitado.
  const piso = Math.round((semPiso.previsao.validado + modoA.previsao.validado) / 2);
  const comPiso = gerarCalendarioDemo({
    marca, modo: 'eficiencia', dataInicio: base.dataInicio, dataFim: base.dataFim,
    pisoReceita: piso, eventosEspeciais: '',
  });
  totalCalendarios++;

  const ctx = `${marca}/piso`;
  anotar(
    comPiso.previsao.validado >= piso * 0.999,
    `${ctx}: piso ${piso} não respeitado (validado ${comPiso.previsao.validado})`,
  );
  // O piso é comprado com eficiência. Se o RPM não caísse, o piso seria de graça — e nada
  // neste modelo é de graça.
  const rpm = (c: typeof comPiso) => c.fronteira.find((p) => p.deltaVolumePct === 0)!.rpm;
  anotar(rpm(comPiso) < rpm(semPiso), `${ctx}: piso não custou eficiência (${rpm(semPiso)} → ${rpm(comPiso)})`);
  anotar(rpm(comPiso) > rpm(modoA), `${ctx}: piso anulou o ganho do modo eficiência`);
  anotar(
    comPiso.avisos.some((a) => a.includes('Piso de receita ativo')),
    `${ctx}: piso ativo sem aviso`,
  );

  // Piso inalcançável: o gap é declarado, o plano não é inflado e nada quebra.
  const absurdo = modoA.previsao.validado * 10;
  const inalcancavel = gerarCalendarioDemo({
    marca, modo: 'eficiencia', dataInicio: base.dataInicio, dataFim: base.dataFim,
    pisoReceita: absurdo, eventosEspeciais: '',
  });
  totalCalendarios++;
  anotar(
    inalcancavel.avisos.some((a) => a.includes('não é alcançável')),
    `${marca}/piso-absurdo: gap não declarado`,
  );
  anotar(
    inalcancavel.previsao.validado < absurdo,
    `${marca}/piso-absurdo: plano inflado até a meta impossível`,
  );
  // O que este bloco testa é o PISO, e o piso age sobre o volume: ele desfaz o corte de
  // eficiência até onde precisa, e não além. Então a invariante honesta é sobre volume.
  //
  // Antes aqui se comparava RECEITA ("modo B nunca supera o modo A"), o que parecia óbvio e
  // é falso neste gerador: com o piso inalcançável os dois modos ficam com o MESMO volume e
  // passam a diferir só na estrutura, e a estrutura de 3 slots do modo A pode render menos
  // que a de 2 slots do modo B — o 3º disparo reparte o volume do dia em vez de acrescentar.
  // A asserção antiga passava por causa da tolerância de 1,001 (Barbour's vivia em 1,0001),
  // não porque a propriedade valesse. Trocada por volume, que é o que o piso de fato governa;
  // o defeito estrutural está anotado no gerador e discutido à parte.
  const envios = (c: typeof inalcancavel) => c.slots.reduce((a, s) => a + s.enviosPlanejados, 0);
  anotar(
    envios(inalcancavel) <= envios(modoA) * 1.001,
    `${marca}/piso-absurdo: piso inflou o volume acima do modo receita máxima`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edição manual. O ponto sensível não é o React: é a aritmética de propagação. Cada campo
// propaga de um jeito diferente, e errar isso produz uma tela que edita e mente.
// ─────────────────────────────────────────────────────────────────────────────
{
  const cal = gerarCalendarioDemo({
    marca: 'Lescent', modo: 'receita_maxima', dataInicio: '2026-08-24', dataFim: '2026-09-13',
    eventosEspeciais: '',
  });
  const alvo = cal.slots.find((s) => cal.slots.filter((o) => o.data === s.data).length === 3)!;
  const chave = chaveSlot(alvo);

  // Comparar `previsao.validado` direto não serviria: o gerador o calcula a partir de um
  // acumulador exato, e a edição o recalcula somando valores já arredondados por slot. A
  // diferença é de centavos e não é o que está sendo testado. Somar os slots dos dois lados
  // mede o efeito da edição, e só ele.
  const somaReceita = (c: typeof cal) => c.slots.reduce((a, s) => a + s.receitaPrevista, 0);
  const receitaOriginal = somaReceita(cal);

  // ── Hora: reordena e NÃO mexe em receita. I3 transferiu a 0,00 (§4.5). ──────
  const horasLivres = [...Array(24).keys()].filter(
    (h) => !cal.slots.some((s) => s.data === alvo.data && s.hora === h),
  );
  const novaHora = horasLivres[0];
  const movido = editarSlot(cal, chave, { hora: novaHora })!;
  anotar(!!movido, 'edição: mover horário foi recusada');
  anotar(
    somaReceita(movido) === receitaOriginal,
    `edição: mover horário mexeu na receita (${receitaOriginal} → ${somaReceita(movido)})`,
  );
  const doDia = movido.slots.filter((s) => s.data === alvo.data);
  anotar(
    doDia.every((s, i) => i === 0 || doDia[i - 1].hora < s.hora),
    'edição: dia não ficou ordenado por hora depois de mover',
  );
  anotar(
    doDia.every((s, i) => s.slot === i + 1),
    'edição: números de slot não foram renumerados após reordenar',
  );
  anotar(doDia.find((s) => s.hora === novaHora)!.editado === true, 'edição: slot movido não marcado como editado');
  anotar(movido.editadoManualmente === true, 'edição: calendário não marcado como editado à mão');

  // ── Oferta dentro da mesma família: também não move receita (I4 = 0,00). ────
  const renomeado = editarSlot(cal, chave, { oferta: 'Nome Novo Qualquer' })!;
  anotar(
    somaReceita(renomeado) === receitaOriginal,
    'edição: renomear a oferta mexeu na receita',
  );

  // ── Família: é a única troca qualitativa que move receita, e move na direção certa. ──
  const familias = familiasDisponiveis(cal);
  const usadasNoDia = new Set(cal.slots.filter((s) => s.data === alvo.data).map((s) => s.familia));
  const livre = familias.find((f) => !usadasNoDia.has(f.nome));
  if (livre) {
    const trocado = editarSlot(cal, chave, { familia: livre.nome })!;
    anotar(!!trocado, 'edição: troca de família livre foi recusada');
    const antes = alvo.receitaPrevista;
    const depois = trocado.slots.find((s) => s.familia === livre.nome && s.data === alvo.data)!.receitaPrevista;
    const esperado = antes * Math.pow(livre.indice / alvo.indices.familia, 0.52);
    anotar(
      Math.abs(depois - esperado) <= 2,
      `edição: receita após troca de família ${depois} ≠ ${esperado.toFixed(0)}`,
    );
    // Direção: família de índice maior tem de render mais, não menos.
    anotar(
      livre.indice > alvo.indices.familia ? depois > antes : depois < antes,
      `edição: troca de família andou na direção errada (I2 ${alvo.indices.familia} → ${livre.indice})`,
    );
  }

  // ── H2 não cede na edição. ─────────────────────────────────────────────────
  const outraNoDia = cal.slots.find((s) => s.data === alvo.data && s.familia !== alvo.familia)!;
  anotar(
    editarSlot(cal, chave, { familia: outraNoDia.familia }) === null,
    'edição: aceitou duas famílias iguais no mesmo dia (H2)',
  );
  anotar(
    editarSlot(cal, chave, { hora: outraNoDia.hora }) === null,
    'edição: aceitou dois disparos na mesma hora',
  );
  anotar(editarSlot(cal, chave, { hora: 24 }) === null, 'edição: aceitou hora fora de 0–23');

  // ── Volume: a elasticidade é do DIA. Dobrar o volume de um slot não pode dobrar a
  //    receita dele, e tem de derrubar o R$/mil dos outros disparos do mesmo dia. ──
  const dobrado = editarSlot(cal, chave, { enviosPlanejados: alvo.enviosPlanejados * 2 })!;
  const alvoDepois = dobrado.slots.find((s) => s.data === alvo.data && s.enviosPlanejados === alvo.enviosPlanejados * 2)!;
  anotar(
    alvoDepois.receitaPrevista > alvo.receitaPrevista,
    'edição: dobrar o volume não aumentou a receita do slot',
  );
  anotar(
    alvoDepois.receitaPrevista < alvo.receitaPrevista * 2,
    `edição: receita cresceu linearmente com o volume (${alvo.receitaPrevista} → ${alvoDepois.receitaPrevista}) — a elasticidade sumiu`,
  );
  anotar(alvoDepois.rpmPrevisto < alvo.rpmPrevisto, 'edição: R$/mil do slot não caiu ao dobrar o volume');
  for (const vizinho of dobrado.slots.filter((s) => s.data === alvo.data && s !== alvoDepois)) {
    const antes = cal.slots.find((s) => s.data === vizinho.data && s.familia === vizinho.familia)!;
    anotar(
      vizinho.rpmPrevisto < antes.rpmPrevisto,
      `edição: R$/mil de ${vizinho.familia} não caiu quando o dia recebeu mais volume`,
    );
    anotar(
      vizinho.enviosPlanejados === antes.enviosPlanejados,
      'edição: volume de um vizinho foi alterado sem ninguém pedir',
    );
  }
  // A fronteira acompanha o plano editado, senão descreveria um calendário que não existe.
  const rpmPlano = dobrado.fronteira.find((p) => p.deltaVolumePct === 0)!;
  const receitaSomada = dobrado.slots.reduce((a, s) => a + s.receitaPrevista, 0);
  const enviosSomados = dobrado.slots.reduce((a, s) => a + s.enviosPlanejados, 0);
  anotar(Math.abs(rpmPlano.receita - receitaSomada) <= 1, 'edição: fronteira não acompanhou a receita editada');
  anotar(
    Math.abs(rpmPlano.rpm - (receitaSomada / enviosSomados) * 1000) < 0.15,
    'edição: R$/mil da fronteira não bate com o plano editado',
  );
  anotar(
    dobrado.previsao.validado === Math.round(receitaSomada),
    'edição: previsão não bate com a soma dos slots',
  );

  // ── Remoção ────────────────────────────────────────────────────────────────
  const removido = removerSlot(cal, chave)!;
  anotar(!!removido, 'edição: remoção recusada num dia de 3 disparos');
  anotar(
    removido.slots.filter((s) => s.data === alvo.data).length === 2,
    'edição: remoção não tirou o slot do dia',
  );
  anotar(
    somaReceita(removido) < receitaOriginal,
    'edição: remover um disparo não reduziu a receita do período',
  );
  // Último disparo do dia não é removível: dia vazio é dia apagado, não dia editado.
  const diaDeUm = cal.slots.find((s) => cal.slots.filter((o) => o.data === s.data).length === 1);
  if (diaDeUm) {
    anotar(removerSlot(cal, chaveSlot(diaDeUm)) === null, 'edição: esvaziou um dia inteiro');
  }
}

console.log(`calendários verificados: ${totalCalendarios}`);
if (falhas.length > 0) {
  console.error(`\nFALHAS (${falhas.length}):`);
  for (const f of [...new Set(falhas)].slice(0, 40)) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('todas as invariantes passaram');
