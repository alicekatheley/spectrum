import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Users } from "lucide-react";

interface CelulaResumo {
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

interface SlotCelula {
  celula: string;
  dowNum: number; // 1=Dom..7=Sáb (convenção do BigQuery)
  dow: string;
  turno: string; // 1_manha_8_12 | 2_tarde_12_19 | 3_noite_19_00
  indice: number;
  rankSlot: number;
  envios: number;
}

interface SegmentacaoPayload {
  marca: string;
  resumo: CelulaResumo[];
  slots: SlotCelula[];
}

const CARD = 'bg-[var(--shell-panel)] border border-[var(--shell-border)] rounded-3xl p-6 shadow-xl';
const TITULO_CARD = 'text-sm font-bold uppercase tracking-widest text-[var(--shell-text)]';

// dow_num BigQuery: 1=Dom .. 7=Sáb. Convertemos para 0..6 apenas na UI.
const DIAS: { idx: number; label: string; longo: string }[] = [
  { idx: 1, label: 'Dom', longo: 'Domingo' },
  { idx: 2, label: 'Seg', longo: 'Segunda' },
  { idx: 3, label: 'Ter', longo: 'Terça' },
  { idx: 4, label: 'Qua', longo: 'Quarta' },
  { idx: 5, label: 'Qui', longo: 'Quinta' },
  { idx: 6, label: 'Sex', longo: 'Sexta' },
  { idx: 7, label: 'Sáb', longo: 'Sábado' },
];

const TURNOS: { key: string; label: string; faixa: string }[] = [
  { key: '1_manha_8_12', label: 'Manhã', faixa: '8h–12h' },
  { key: '2_tarde_12_19', label: 'Tarde', faixa: '12h–19h' },
  { key: '3_noite_19_00', label: 'Noite', faixa: '19h–00h' },
];

// Ordem canônica dos tiers (cli antes de lea; altíssimo -> frio dentro de cada lado).
const ORDEM_TIER = ['altissimo', 'alto', 'medio', 'baixo', 'frio'];
function ordenarCelula(a: string, b: string): number {
  const [ladoA, tierA] = a.split('_');
  const [ladoB, tierB] = b.split('_');
  if (ladoA !== ladoB) return ladoA === 'cli' ? -1 : 1;
  return ORDEM_TIER.indexOf(tierA) - ORDEM_TIER.indexOf(tierB);
}

const CORES_CELULA: Record<string, string> = {
  cli_altissimo: '#7C3AED', // roxo forte
  cli_alto: '#A855F7',
  cli_medio: '#C084FC',
  cli_baixo: '#DDD6FE',
  lea_altissimo: '#0EA5E9', // ciano forte
  lea_alto: '#38BDF8',
  lea_medio: '#7DD3FC',
  lea_baixo: '#BAE6FD',
  lea_frio: '#E0F2FE',
};

function corTextoCelula(celula: string): string {
  // Cores escuras precisam de texto claro; as pastel (baixo/frio) precisam de texto escuro.
  const claras = ['cli_baixo', 'lea_baixo', 'lea_frio', 'cli_medio', 'lea_medio'];
  return claras.includes(celula) ? '#111827' : '#FFFFFF';
}

function nomeCelula(c: string): string {
  const mapa: Record<string, string> = {
    cli_altissimo: 'Cliente altíssimo',
    cli_alto: 'Cliente alto',
    cli_medio: 'Cliente médio',
    cli_baixo: 'Cliente baixo',
    lea_altissimo: 'Lead altíssimo',
    lea_alto: 'Lead alto',
    lea_medio: 'Lead médio',
    lea_baixo: 'Lead baixo',
    lea_frio: 'Lead frio',
  };
  return mapa[c] ?? c;
}

function fmtInt(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function fmtPct(n: number | null | undefined, casas = 1): string {
  if (n === null || n === undefined) return '—';
  // As views entregam pct_envios e pct_receita como 0..1 OU 0..100 dependendo da
  // marca de origem. Detectamos pelo teto: se veio > 1.5, já está em pontos percentuais.
  const valor = Math.abs(n) > 1.5 ? n : n * 100;
  return `${valor.toFixed(casas).replace('.', ',')}%`;
}

function fmtDose(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toFixed(1).replace('.', ',');
}

interface Props {
  marca?: string;
}

export default function CalendarioSegmentacao({ marca = 'Barbours' }: Props) {
  const [dados, setDados] = useState<SegmentacaoPayload | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    setErro(null);
    fetch(`/api/calendario/segmentacao?marca=${encodeURIComponent(marca)}`)
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok) throw new Error(corpo?.error ?? 'Falha ao carregar a segmentação.');
        return corpo.data as SegmentacaoPayload;
      })
      .then((d) => {
        if (!cancelado) setDados(d);
      })
      .catch((e: any) => {
        if (!cancelado) setErro(e?.message ?? 'Falha inesperada.');
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [marca, reload]);

  // Para cada célula, os N primeiros slots por rank_slot (N = slots_passo1) são o calendário.
  const calendarioPorSlot = useMemo(() => {
    if (!dados) return new Map<string, SlotCelula[]>();
    const passoPorCelula = new Map<string, number>(
      dados.resumo.map((r) => [r.celula, r.slotsPasso1]),
    );

    // Menor rank primeiro; agrupado por célula.
    const porCelula = new Map<string, SlotCelula[]>();
    for (const s of dados.slots) {
      if (!porCelula.has(s.celula)) porCelula.set(s.celula, []);
      porCelula.get(s.celula)!.push(s);
    }
    for (const arr of porCelula.values()) arr.sort((a, b) => a.rankSlot - b.rankSlot);

    // Reduz a Map<`${dow}|${turno}`, SlotCelula[]>
    const grade = new Map<string, SlotCelula[]>();
    for (const [celula, arr] of porCelula.entries()) {
      const n = passoPorCelula.get(celula) ?? 0;
      for (const s of arr.slice(0, n)) {
        const k = `${s.dowNum}|${s.turno}`;
        if (!grade.has(k)) grade.set(k, []);
        grade.get(k)!.push(s);
      }
    }
    return grade;
  }, [dados]);

  const checagemVolume = useMemo(() => {
    if (!dados) return null;
    const projetado = dados.resumo.reduce((s, r) => s + r.pessoasSemana * r.slotsPasso1, 0);
    const hoje = dados.resumo.reduce((s, r) => s + r.enviosSemanaHoje, 0);
    if (hoje === 0) return null;
    const delta = (projetado - hoje) / hoje;
    return { projetado, hoje, delta };
  }, [dados]);

  const totalSlotsPlano = useMemo(
    () => (dados?.resumo ?? []).reduce((s, r) => s + r.slotsPasso1, 0),
    [dados],
  );

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <header className={`${CARD} flex flex-col md:flex-row justify-between items-start md:items-center gap-6`}>
        <div className="flex flex-col gap-1 max-w-3xl">
          <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#AA834B]">
            Planejamento de Disparos de CRM
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--shell-text)]">
            Calendário por segmentação — {marca}
          </h1>
          <p className="text-xs text-[var(--shell-text-muted)] leading-relaxed mt-1">
            Quais tiers recebem e-mail, em quais dias e turnos, e quantas vezes por semana.
            A unidade é o <strong>slot</strong> — 7 dias × 3 turnos = 21 por semana. Cada
            célula recebe <strong>exatamente N e-mails na semana</strong>, onde N é a coluna{' '}
            <code className="text-[var(--shell-text)]">slots_passo1</code> (movimento limitado
            a ±1 por rodada). Este modelo <em>não</em> decide o conteúdo — a aba
            "Ofertas" ao lado é quem responde "o quê".
          </p>
        </div>

        <button
          onClick={() => setReload((n) => n + 1)}
          disabled={carregando}
          title="Recarregar do BigQuery"
          className="shrink-0 p-2.5 rounded-xl bg-[var(--shell-panel-soft)] hover:bg-[var(--shell-border)] border border-[var(--shell-border)] text-[var(--shell-text-muted)] hover:text-[var(--shell-text)] transition-all cursor-pointer disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {carregando && (
        <div className={`${CARD} flex items-center justify-center gap-2 text-sm text-[var(--shell-text-muted)] py-12`}>
          <Loader2 className="w-4 h-4 animate-spin" />
          Consultando <code>crm_modelo_seg</code> no BigQuery…
        </div>
      )}

      {erro && !carregando && (
        <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-300">
            Segmentação indisponível
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--shell-text-muted)]">
            {erro}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--shell-text-muted)] opacity-80">
            Este modelo é Barbours-only por enquanto. Se a marca é Barbours e o erro persiste,
            confira se as views <code>v_celula_resumo</code> e <code>v_slot_celula</code> existem
            no dataset <code>gogroup-crm.crm_modelo_seg</code>.
          </p>
        </div>
      )}

      {dados && !carregando && (
        <>
          {/* Checagem de volume — a §3.1 do handoff é explícita: ±10% por rodada. */}
          {checagemVolume && (
            <div
              className={`${CARD} flex flex-col sm:flex-row justify-between gap-4 border-l-4 ${
                Math.abs(checagemVolume.delta) > 0.1
                  ? 'border-l-amber-500'
                  : 'border-l-emerald-500'
              }`}
            >
              <div className="flex flex-col gap-1">
                <span className={TITULO_CARD}>Checagem de volume</span>
                <p className="text-xs text-[var(--shell-text-muted)] leading-relaxed max-w-2xl">
                  Regra do modelo: variação aceitável por rodada é ±10%. Acima disso, reduza o
                  movimento de quem mais contribuiu para o desvio antes de publicar.
                </p>
              </div>
              <div className="flex flex-wrap gap-6 shrink-0">
                <div className="flex flex-col text-right">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--shell-text-muted)]">
                    Envios/semana hoje
                  </span>
                  <span className="text-lg font-bold text-[var(--shell-text)]">
                    {fmtInt(checagemVolume.hoje)}
                  </span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--shell-text-muted)]">
                    Projetado (passo 1)
                  </span>
                  <span className="text-lg font-bold text-[var(--shell-text)]">
                    {fmtInt(checagemVolume.projetado)}
                  </span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--shell-text-muted)]">
                    Δ vs hoje
                  </span>
                  <span
                    className={`text-lg font-bold ${
                      Math.abs(checagemVolume.delta) > 0.1
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {(checagemVolume.delta * 100).toFixed(1).replace('.', ',')}%
                  </span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--shell-text-muted)]">
                    Slots ligados
                  </span>
                  <span className="text-lg font-bold text-[var(--shell-text)]">
                    {fmtInt(totalSlotsPlano)}/21×N
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tabela de células — a §2 do handoff: responde "QUANTOS slots" por célula. */}
          <div className={`${CARD} flex flex-col gap-4`}>
            <div className="flex flex-col gap-1">
              <span className={TITULO_CARD}>Células — quantos slots por semana</span>
              <p className="text-xs text-[var(--shell-text-muted)] leading-relaxed max-w-3xl">
                Índice de valor: 100 = média da marca. Passo 1 é o movimento sugerido pra
                próxima rodada (limitado a ±1 slot). A dose média de hoje é diagnóstico —
                não é instrução: quem está na célula recebe <strong>exatamente</strong> N
                e-mails, onde N = <code>slots_passo1</code>.
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[var(--shell-border)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--shell-panel-soft)]">
                  <tr className="text-[10px] uppercase font-mono tracking-widest text-[var(--shell-text-muted)]">
                    <th className="text-left px-3 py-3">Célula</th>
                    <th className="text-right px-3 py-3">Índice</th>
                    <th className="text-right px-3 py-3">Dose hoje</th>
                    <th className="text-right px-3 py-3">Sugerido</th>
                    <th className="text-right px-3 py-3 font-black text-indigo-400">Passo 1</th>
                    <th className="text-right px-3 py-3">Pessoas/sem</th>
                    <th className="text-right px-3 py-3">Envios/sem</th>
                    <th className="text-right px-3 py-3">% envios</th>
                    <th className="text-right px-3 py-3">% receita</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.resumo.map((r) => {
                    const salto = r.slotsPasso1 - Math.round(r.doseMediaHoje ?? r.slotsPasso1);
                    return (
                      <tr
                        key={r.celula}
                        className="border-t border-[var(--shell-border)] hover:bg-[var(--shell-panel-soft)]/50"
                      >
                        <td className="px-3 py-3 flex items-center gap-2">
                          <span
                            className="inline-block w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: CORES_CELULA[r.celula] ?? '#94A3B8' }}
                          />
                          <div className="flex flex-col">
                            <span className="text-[var(--shell-text)] font-semibold">
                              {nomeCelula(r.celula)}
                            </span>
                            <span className="text-[10px] font-mono text-[var(--shell-text-muted)]">
                              {r.celula}
                            </span>
                          </div>
                        </td>
                        <td className="text-right px-3 py-3 text-[var(--shell-text)] font-semibold tabular-nums">
                          {fmtInt(r.indiceValor)}
                        </td>
                        <td className="text-right px-3 py-3 text-[var(--shell-text-muted)] tabular-nums">
                          {fmtDose(r.doseMediaHoje)}
                        </td>
                        <td className="text-right px-3 py-3 text-[var(--shell-text-muted)] tabular-nums">
                          {r.slotsSugeridos}
                        </td>
                        <td className="text-right px-3 py-3 tabular-nums">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 font-black">
                            {r.slotsPasso1}
                            {salto > 0 && (
                              <span className="text-[10px] text-emerald-400 font-mono">▲{salto}</span>
                            )}
                            {salto < 0 && (
                              <span className="text-[10px] text-amber-400 font-mono">▼{Math.abs(salto)}</span>
                            )}
                          </span>
                        </td>
                        <td className="text-right px-3 py-3 text-[var(--shell-text-muted)] tabular-nums">
                          {fmtInt(r.pessoasSemana)}
                        </td>
                        <td className="text-right px-3 py-3 text-[var(--shell-text-muted)] tabular-nums">
                          {fmtInt(r.enviosSemanaHoje)}
                        </td>
                        <td className="text-right px-3 py-3 text-[var(--shell-text-muted)] tabular-nums">
                          {fmtPct(r.pctEnvios)}
                        </td>
                        <td className="text-right px-3 py-3 text-[var(--shell-text-muted)] tabular-nums">
                          {fmtPct(r.pctReceita)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grade 7×3 — a §2 do handoff: responde "QUAIS slots". */}
          <div className={`${CARD} flex flex-col gap-4`}>
            <div className="flex flex-col gap-1">
              <span className={TITULO_CARD}>Grade da semana</span>
              <p className="text-xs text-[var(--shell-text-muted)] leading-relaxed max-w-3xl">
                Cada célula é alocada nos <code>slots_passo1</code> primeiros slots do próprio
                ranking (<code>rank_slot</code> ascendente). O rótulo entre parênteses é o
                índice do slot (100 = média da marca). Máximo <strong>3 slots por
                célula por dia</strong>: um por turno.
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[var(--shell-border)]">
              <table className="w-full text-xs">
                <thead className="bg-[var(--shell-panel-soft)]">
                  <tr className="text-[10px] uppercase font-mono tracking-widest text-[var(--shell-text-muted)]">
                    <th className="text-left px-3 py-3 w-24">Turno</th>
                    {DIAS.map((d) => (
                      <th key={d.idx} className="text-center px-2 py-3">
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TURNOS.map((t) => (
                    <tr key={t.key} className="border-t border-[var(--shell-border)]">
                      <td className="align-top px-3 py-3">
                        <div className="flex flex-col">
                          <span className="text-[var(--shell-text)] font-bold">{t.label}</span>
                          <span className="text-[10px] font-mono text-[var(--shell-text-muted)]">
                            {t.faixa}
                          </span>
                        </div>
                      </td>
                      {DIAS.map((d) => {
                        const chave = `${d.idx}|${t.key}`;
                        const celulas = (calendarioPorSlot.get(chave) ?? []).sort((a, b) =>
                          ordenarCelula(a.celula, b.celula),
                        );
                        return (
                          <td
                            key={`${d.idx}-${t.key}`}
                            className="align-top px-1.5 py-2 border-l border-[var(--shell-border)] min-w-[110px]"
                          >
                            {celulas.length === 0 ? (
                              <span className="block text-center text-[10px] text-[var(--shell-text-muted)]/50">
                                —
                              </span>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {celulas.map((c) => (
                                  <div
                                    key={c.celula}
                                    title={`${nomeCelula(c.celula)} · rank ${c.rankSlot} · índice ${Math.round(c.indice)} · ${fmtInt(c.envios)} envios observados`}
                                    className="rounded-md px-1.5 py-1 text-[10px] font-semibold leading-tight"
                                    style={{
                                      backgroundColor: CORES_CELULA[c.celula] ?? '#94A3B8',
                                      color: corTextoCelula(c.celula),
                                    }}
                                  >
                                    <div className="truncate">{c.celula.replace('_', ' ')}</div>
                                    <div className="opacity-80 font-mono text-[9px]">
                                      ({Math.round(c.indice)})
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legenda + notas do handoff (§5). */}
          <div className={`${CARD} flex flex-col gap-4`}>
            <div className="flex flex-col gap-1">
              <span className={TITULO_CARD}>Notas do modelo</span>
            </div>
            <div className="flex flex-col gap-3 text-xs leading-relaxed text-[var(--shell-text-muted)]">
              <p>
                <strong className="text-[var(--shell-text)]">O passo 1 é intencionalmente
                pequeno.</strong> Células que hoje recebem bem acima do que valem
                (como <code>lea_baixo</code>, <code>lea_medio</code>) descem 1 slot por rodada;
                em ~4 semanas chegam ao alvo sem tirar centenas de milhares de envios de uma vez.
              </p>
              <p>
                <strong className="text-[var(--shell-text)]">Índice é observacional, não
                causal.</strong> Quem recebe 8 e-mails hoje foi escolhido pela operação por já
                ser mais engajado. Subir célula boa até 8 é aposta razoável;{' '}
                <strong>acima de 9 não há apoio nos dados</strong>.
              </p>
              <p>
                <strong className="text-[var(--shell-text)]">Este modelo NÃO diz qual oferta
                enviar.</strong> Conteúdo/oferta é o modelo de merchan — aba "Ofertas" ao lado.
                Os dois eixos rodam em paralelo e são independentes.
              </p>
              <p className="pt-2 border-t border-[var(--shell-border)] flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest opacity-70">
                <Users className="w-3 h-3" />
                Fonte: <code>gogroup-crm.crm_modelo_seg</code> — job diário 09:30 BRT
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
