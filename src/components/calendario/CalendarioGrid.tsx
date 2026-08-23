import { ArrowDown, ArrowUp, Minus, RotateCcw, Sparkles } from "lucide-react";
import { CalendarioCelula, CalendarioGerado, RecomendacaoVolume } from "../../types";

const RECOMENDACAO_UI: Record<RecomendacaoVolume, { label: string; classe: string; icon: typeof ArrowUp }> = {
  aumentar: { label: 'aumentar', classe: 'text-emerald-400', icon: ArrowUp },
  manter: { label: 'manter', classe: 'text-[var(--shell-text-muted)]', icon: Minus },
  reduzir: { label: 'reduzir', classe: 'text-rose-400', icon: ArrowDown },
};

function formatarReceita(valor: number): string {
  const casas = Number.isInteger(valor) ? 0 : 1;
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}/mil`;
}

function Celula({ celula }: { key?: string; celula: CalendarioCelula }) {
  const rec = RECOMENDACAO_UI[celula.recomendacao];
  const RecIcon = rec.icon;
  const C2Icon = celula.c2?.tipo === 'reforco' ? RotateCcw : Sparkles;

  return (
    <div className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-panel)] p-3.5 flex flex-col gap-2">
      <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--shell-text-muted)]">
        {celula.diaSemana}
      </span>

      {/* flex-wrap + min-width no nome: em colunas estreitas o valor cai para a linha de baixo
          em vez de espremer o nome da oferta até sumir. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-sm font-bold text-[var(--shell-text)] flex-1 min-w-[4rem] truncate" title={celula.c1.nome}>
          {celula.c1.nome}
        </span>
        <span className="text-sm font-bold text-emerald-400 shrink-0">
          {formatarReceita(celula.c1.receitaPorMil)}
        </span>
      </div>

      {celula.c2 ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs text-[var(--shell-text-muted)]">
          <span className="flex items-center gap-1.5 flex-1 min-w-[4rem]" title={celula.c2.nome}>
            <C2Icon className="w-3 h-3 shrink-0" />
            <span className="truncate">{celula.c2.nome}</span>
          </span>
          <span className="shrink-0">{formatarReceita(celula.c2.receitaPorMil)}</span>
        </div>
      ) : (
        <div className="text-xs text-[var(--shell-text-muted)] opacity-40">sem C2</div>
      )}

      <div className="border-t border-[var(--shell-border)] pt-2 mt-0.5">
        <span className={`flex items-center gap-1.5 text-xs font-medium ${rec.classe}`}>
          <RecIcon className="w-3 h-3" />
          {rec.label}
        </span>
      </div>
    </div>
  );
}

export default function CalendarioGrid({ calendario }: { calendario: CalendarioGerado }) {
  return (
    <div className="flex flex-col gap-7">
      {calendario.semanas.map((semana) => (
        <div key={semana.label} className="flex flex-col gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--shell-text-muted)]">
            {semana.label}
          </span>
          <div className="grid grid-cols-1 @sm:grid-cols-2 @xl:grid-cols-4 @3xl:grid-cols-7 gap-3">
            {semana.celulas.map((celula) => (
              <Celula key={celula.data} celula={celula} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
