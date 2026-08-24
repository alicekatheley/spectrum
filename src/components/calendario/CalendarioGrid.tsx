import { CalendarioGerado, CalendarioSlot, DiaSemana } from "../../types";
import { DIA_CURTO, formatarDataCurta, formatarEnvios, formatarHora, formatarRpm } from "./formato";

// A grade renderiza SLOTS, não células-dia. O modelo emite uma lista plana de slots
// (§1.2: SLOT = marca, data, hora, oferta) e o agrupamento em dia/semana é decisão de
// exibição — por isso vive aqui e não no contrato.

interface DiaAgrupado {
  data: string;
  diaSemana: DiaSemana;
  slots: CalendarioSlot[];
}

/** Domingo da semana da data — chave estável de agrupamento mesmo quando a marca não opera aos domingos. */
function inicioDaSemana(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia);
  data.setDate(data.getDate() - data.getDay());
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function agrupar(slots: CalendarioSlot[]): { semana: string; dias: DiaAgrupado[] }[] {
  const porDia = new Map<string, DiaAgrupado>();
  for (const slot of slots) {
    const dia = porDia.get(slot.data);
    if (dia) dia.slots.push(slot);
    else porDia.set(slot.data, { data: slot.data, diaSemana: slot.diaSemana, slots: [slot] });
  }

  const porSemana = new Map<string, DiaAgrupado[]>();
  for (const dia of [...porDia.values()].sort((a, b) => a.data.localeCompare(b.data))) {
    dia.slots.sort((a, b) => a.slot - b.slot);
    const chave = inicioDaSemana(dia.data);
    porSemana.set(chave, [...(porSemana.get(chave) ?? []), dia]);
  }

  return [...porSemana.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([semana, dias]) => ({ semana, dias }));
}

function Slot({ slot }: { key?: string; slot: CalendarioSlot }) {
  return (
    <div className="flex flex-col gap-1 border-t border-[var(--shell-border)] pt-2 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[11px] font-mono font-bold text-[var(--shell-text-muted)] shrink-0">
          {formatarHora(slot.hora)}
        </span>
        <span
          className="text-sm font-bold text-[var(--shell-text)] flex-1 min-w-[4rem] truncate"
          title={slot.oferta}
        >
          {slot.oferta}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-[11px] text-[var(--shell-text-muted)]">
        {/* Família é a unidade de fadiga (§1.4) — é ela que o rodízio da Fase 4 decide,
            e é a alavanca #2 em transferência. Precisa estar visível no card. */}
        <span className="truncate" title={`Família ${slot.familia} · agressividade ${slot.agressividade}`}>
          {slot.familia} · agr {slot.agressividade}
        </span>
        <span className="shrink-0 font-mono">{formatarEnvios(slot.enviosPlanejados)}</span>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-xs font-semibold text-emerald-400 shrink-0">
          {formatarRpm(slot.rpmPrevisto)}
        </span>
        {!slot.confianca.validado && (
          <span
            className="text-[10px] font-mono uppercase tracking-wider text-amber-400 border border-amber-500/40 rounded px-1.5 py-0.5 shrink-0"
            title="Alavanca de transferência 0,00 no walk-forward — entra no plano como hipótese, não como compromisso (Regra 3)."
          >
            não validado
          </span>
        )}
      </div>
    </div>
  );
}

function Dia({ dia }: { key?: string; dia: DiaAgrupado }) {
  return (
    <div className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-panel)] p-3.5 flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--shell-text-muted)]">
          {DIA_CURTO[dia.diaSemana]}
        </span>
        <span className="text-[10px] font-mono text-[var(--shell-text-muted)] opacity-60">
          {formatarDataCurta(dia.data)}
        </span>
      </div>

      {dia.slots.map((slot) => (
        <Slot key={`${slot.data}-${slot.slot}`} slot={slot} />
      ))}
    </div>
  );
}

export default function CalendarioGrid({ calendario }: { calendario: CalendarioGerado }) {
  const semanas = agrupar(calendario.slots);

  return (
    <div className="flex flex-col gap-7">
      {semanas.map(({ semana, dias }, indice) => {
        const slotsDaSemana = dias.reduce((total, dia) => total + dia.slots.length, 0);
        const diasCom3 = dias.filter((dia) => dia.slots.length >= 3).length;

        return (
          <div key={semana} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--shell-text-muted)]">
                S{indice + 1}
              </span>
              <span className="text-[11px] text-[var(--shell-text-muted)] opacity-70">
                {slotsDaSemana} slots · {diasCom3} dia{diasCom3 === 1 ? '' : 's'} com 3 ofertas
              </span>
            </div>

            <div className="grid grid-cols-1 @sm:grid-cols-2 @xl:grid-cols-4 @3xl:grid-cols-7 gap-3">
              {dias.map((dia) => (
                <Dia key={dia.data} dia={dia} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
