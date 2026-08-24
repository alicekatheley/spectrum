import { AlertTriangle } from "lucide-react";
import { CalendarioGerado } from "../../types";
import { formatarData, formatarEnvios, formatarMoeda, formatarPct, formatarRpm } from "./formato";

// Tudo aqui é saída obrigatória do modelo (§9.1 + checklist de aceite §14). Nenhum destes
// blocos é decorativo: publicar um calendário sem os três cenários, sem a decomposição,
// sem a fronteira ou sem as restrições aplicadas é explicitamente proibido.

const CARD = 'bg-[var(--shell-panel)] border border-[var(--shell-border)] rounded-3xl p-6 shadow-xl';
const TITULO = 'text-sm font-bold uppercase tracking-widest text-[var(--shell-text)]';
const SUBTITULO = 'text-xs text-[var(--shell-text-muted)] leading-relaxed';

export default function PainelResultado({ calendario }: { calendario: CalendarioGerado }) {
  const { previsao, decomposicao, fronteira, restricoesAplicadas, restricoesRelaxadas, avisos } = calendario;

  const enviosTotal = calendario.slots.reduce((total, slot) => total + slot.enviosPlanejados, 0);
  const plano = fronteira.find((ponto) => ponto.deltaVolumePct === 0);

  return (
    <div className="flex flex-col gap-8">

      {/* ── Os três cenários (Fase 6) ─────────────────────────────────────── */}
      <div className={`${CARD} flex flex-col gap-5`}>
        <div className="flex flex-col gap-1">
          <h2 className={TITULO}>Previsão</h2>
          <p className={SUBTITULO}>
            O modelo emite três cenários, sempre os três. O compromisso é o validado — a distância
            até o in-sample é o tamanho do viés que existiria sem validação fora da amostra.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-panel-soft)] p-4 flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--shell-text-muted)]">
              Ritmo de hoje
            </span>
            <span className="text-xl font-bold text-[var(--shell-text)]">
              {formatarMoeda(previsao.ritmoDeHoje)}
            </span>
            <span className="text-[11px] text-[var(--shell-text-muted)]">Linha de base</span>
          </div>

          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">
              Validado — o compromisso
            </span>
            <span className="text-xl font-bold text-[var(--shell-text)]">
              {formatarMoeda(previsao.validado)}
            </span>
            <span className="text-[11px] text-emerald-400 font-semibold">
              {formatarPct(previsao.ganhoValidadoPct)} sobre o ritmo atual
            </span>
          </div>

          {/* Exibido com aviso porque a §14 exige que esteja presente E marcado. */}
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/5 p-4 flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-rose-400">
              In-sample — não use
            </span>
            <span className="text-xl font-bold text-[var(--shell-text-muted)] line-through decoration-rose-500/60">
              {formatarMoeda(previsao.inSampleNaoUsar)}
            </span>
            <span className="text-[11px] text-[var(--shell-text-muted)]">
              Crédito integral aos índices, inclusive aos que não transferem
            </span>
          </div>
        </div>

        <p className="text-[11px] text-[var(--shell-text-muted)] leading-relaxed border-t border-[var(--shell-border)] pt-4">
          É um cenário, não uma garantia. Mesmo as alavancas validadas têm intervalo de confiança
          largo. Use para ordenar decisões, não para prometer valores.
        </p>
      </div>

      {/* ── Decomposição alavanca a alavanca ──────────────────────────────── */}
      <div className={`${CARD} flex flex-col gap-4`}>
        <div className="flex flex-col gap-1">
          <h2 className={TITULO}>Decomposição</h2>
          <p className={SUBTITULO}>
            Uma alavanca por vez, em ordem de transferência decrescente. As marcadas como não
            validadas ficam no plano porque não custam nada, mas entram na previsão com expoente zero.
          </p>
        </div>

        <ul className="flex flex-col">
          {decomposicao.map((etapa, indice) => (
            <li
              key={etapa.etapa}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 border-b border-[var(--shell-border)] last:border-b-0"
            >
              <span className="flex items-baseline gap-2 flex-1 min-w-[12rem]">
                <span className="text-[11px] font-mono text-[var(--shell-text-muted)] opacity-50">
                  {indice === 0 ? '' : '+'}
                </span>
                <span
                  className={`text-sm ${
                    etapa.validado ? 'text-[var(--shell-text)]' : 'text-[var(--shell-text-muted)]'
                  }`}
                >
                  {etapa.etapa}
                </span>
                {!etapa.validado && (
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 border border-amber-500/40 rounded px-1.5 py-0.5">
                    não validado
                  </span>
                )}
              </span>

              <span className="flex items-baseline gap-4 shrink-0">
                <span className="text-sm font-mono text-[var(--shell-text)]">
                  {formatarMoeda(etapa.receita)}
                </span>
                <span
                  className={`text-xs font-mono w-16 text-right ${
                    etapa.ganhoPct > 0 ? 'text-emerald-400' : 'text-[var(--shell-text-muted)]'
                  }`}
                >
                  {indice === 0 ? '—' : formatarPct(etapa.ganhoPct)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Fronteira receita × RPM (§6.4) ────────────────────────────────── */}
      <div className={`${CARD} flex flex-col gap-4`}>
        <div className="flex flex-col gap-1">
          <h2 className={TITULO}>Fronteira receita × eficiência</h2>
          <p className={SUBTITULO}>
            Não existe ponto que otimize os dois: cortar volume sobe o R$/mil e derruba a receita,
            na taxa medida. O modelo emite a curva para que a escolha do modo seja uma decisão
            informada, não uma configuração escondida.
          </p>
        </div>

        {/* Tabela, não gráfico: Recharts quebra dentro de <td>. */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-[10px] font-mono uppercase tracking-widest text-[var(--shell-text-muted)]">
                <th className="text-left font-medium py-2 pr-4">Volume</th>
                <th className="text-right font-medium py-2 px-4">Envios</th>
                <th className="text-right font-medium py-2 px-4">Receita</th>
                <th className="text-right font-medium py-2 px-4">Δ receita</th>
                <th className="text-right font-medium py-2 pl-4">R$/mil</th>
              </tr>
            </thead>
            <tbody>
              {fronteira.map((ponto) => {
                const ehPlano = ponto.deltaVolumePct === 0;
                const deltaReceita = plano ? ((ponto.receita - plano.receita) / plano.receita) * 100 : 0;
                const deltaRpm = plano ? ((ponto.rpm - plano.rpm) / plano.rpm) * 100 : 0;

                return (
                  <tr
                    key={ponto.deltaVolumePct}
                    className={`border-t border-[var(--shell-border)] ${
                      ehPlano ? 'bg-[var(--shell-panel-soft)]' : ''
                    }`}
                  >
                    <td className={`py-2.5 pr-4 ${ehPlano ? 'font-bold text-[var(--shell-text)]' : 'text-[var(--shell-text-muted)]'}`}>
                      {ehPlano ? 'plano' : formatarPct(ponto.deltaVolumePct)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-[var(--shell-text-muted)]">
                      {formatarEnvios(Math.round(enviosTotal * (1 + ponto.deltaVolumePct / 100)))}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-[var(--shell-text)]">
                      {formatarMoeda(ponto.receita)}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono ${
                        deltaReceita > 0 ? 'text-emerald-400' : deltaReceita < 0 ? 'text-rose-400' : 'text-[var(--shell-text-muted)]'
                      }`}
                    >
                      {ehPlano ? '—' : formatarPct(deltaReceita)}
                    </td>
                    <td
                      className={`py-2.5 pl-4 text-right font-mono ${
                        deltaRpm > 0 ? 'text-emerald-400' : deltaRpm < 0 ? 'text-rose-400' : 'text-[var(--shell-text-muted)]'
                      }`}
                    >
                      {formatarRpm(ponto.rpm)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Restrições e avisos ───────────────────────────────────────────── */}
      <div className={`${CARD} flex flex-col gap-5`}>
        <div className="flex flex-col gap-1">
          <h2 className={TITULO}>Restrições e avisos</h2>
          <p className={SUBTITULO}>
            Toda restrição é declarada e auditável. Restrição não escrita é restrição inexistente —
            foi exatamente uma ausente que produziu a falha original do modelo.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--shell-text-muted)]">
              Aplicadas
            </span>
            <ul className="flex flex-col gap-1.5">
              {restricoesAplicadas.map((restricao) => (
                <li key={restricao} className="text-xs text-[var(--shell-text-muted)] leading-relaxed">
                  {restricao}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--shell-text-muted)]">
              Relaxadas
            </span>
            {restricoesRelaxadas.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {restricoesRelaxadas.map((restricao) => (
                  <li key={restricao} className="text-xs text-amber-400 leading-relaxed">
                    {restricao}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-xs text-[var(--shell-text-muted)] opacity-60">
                Nenhuma restrição precisou ser relaxada.
              </span>
            )}
          </div>
        </div>

        {avisos.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-[var(--shell-border)] pt-4">
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400">
              Avisos
            </span>
            <ul className="flex flex-col gap-2">
              {avisos.map((aviso) => (
                <li key={aviso} className="flex items-start gap-2 text-xs text-[var(--shell-text-muted)] leading-relaxed">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{aviso}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Proveniência — sem snapshot não há calendário (§10.2, §11.2). */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-[var(--shell-border)] pt-4 text-[11px] font-mono text-[var(--shell-text-muted)] opacity-70">
          <span>snapshot: {calendario.snapshotIndicesId}</span>
          <span>modo: {calendario.modo === 'receita_maxima' ? 'receita máxima' : 'eficiência'}</span>
          <span>
            período: {formatarData(calendario.periodo.inicio)} – {formatarData(calendario.periodo.fim)}
          </span>
          <span>gerado em: {new Date(calendario.geradoEm).toLocaleString('pt-BR')}</span>
        </div>
      </div>

    </div>
  );
}
