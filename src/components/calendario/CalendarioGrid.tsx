import { CalendarioGerado, CalendarioSlot, DiaSemana } from "../../types";
import { chaveSlot } from "../../utils/editarCalendario";
import { DIA_CURTO, formatarDataCurta, formatarHora } from "./formato";

// A grade renderiza SLOTS, não células-dia. O modelo emite uma lista plana de slots
// (§1.2: SLOT = marca, data, hora, oferta) e o agrupamento em dia/semana é decisão de
// exibição — por isso vive aqui e não no contrato.
//
// O card mostra HORA e OFERTA, e só. A versão anterior empilhava família, agressividade,
// envios, R$/mil e selo de validação num card de sete colunas, e o resultado era um monte
// de "Expresso F…" — informação que existe no DOM e não chega em ninguém. Densidade não é
// o mesmo que informação: sete campos truncados informam menos que dois legíveis. O resto
// continua tudo lá, no painel que abre ao clicar, onde há largura para exibi-lo inteiro.

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
    // Ordem do dia é a do relógio. Depois de uma edição de horário é ela que faz o card
    // de 15h aparecer antes do de 16h, sem depender do número do slot.
    dia.slots.sort((a, b) => a.hora - b.hora);
    const chave = inicioDaSemana(dia.data);
    porSemana.set(chave, [...(porSemana.get(chave) ?? []), dia]);
  }

  return [...porSemana.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([semana, dias]) => ({ semana, dias }));
}

interface SlotProps {
  key?: string;
  slot: CalendarioSlot;
  selecionado: boolean;
  onSelecionar: (chave: string) => void;
}

function Slot({ slot, selecionado, onSelecionar }: SlotProps) {
  const chave = chaveSlot(slot);
  return (
    <button
      type="button"
      onClick={() => onSelecionar(chave)}
      aria-pressed={selecionado}
      title="Abrir para ver a previsão e editar"
      className={`w-full text-left flex items-baseline gap-2 rounded-lg px-2 py-1.5 border transition-colors cursor-pointer ${
        selecionado
          ? 'border-indigo-500/70 bg-indigo-500/15'
          : 'border-transparent hover:border-[var(--shell-border)] hover:bg-[var(--shell-panel-soft)]'
      }`}
    >
      <span className="text-[11px] font-mono font-bold text-[var(--shell-text-muted)] shrink-0">
        {formatarHora(slot.hora)}
      </span>
      {/* Sem truncate: o nome da oferta quebra em duas linhas em vez de virar reticências.
          O card cresce; o nome continua inteiro. */}
      <span className="text-[13px] font-semibold leading-snug text-[var(--shell-text)] flex-1">
        {slot.oferta}
      </span>
      {slot.editado && (
        <span
          className="shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-400 translate-y-[-1px]"
          title="Slot editado à mão — não é mais a proposta do modelo"
        />
      )}
    </button>
  );
}

interface DiaProps {
  key?: string;
  dia: DiaAgrupado;
  selecionado: string | null;
  onSelecionar: (chave: string) => void;
}

function Dia({ dia, selecionado, onSelecionar }: DiaProps) {
  return (
    <div className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-panel)] p-2.5 flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--shell-text-muted)]">
          {DIA_CURTO[dia.diaSemana]}
        </span>
        <span className="text-[10px] font-mono text-[var(--shell-text-muted)] opacity-60">
          {formatarDataCurta(dia.data)}
        </span>
      </div>

      {dia.slots.map((slot) => (
        <Slot
          key={chaveSlot(slot)}
          slot={slot}
          selecionado={selecionado === chaveSlot(slot)}
          onSelecionar={onSelecionar}
        />
      ))}
    </div>
  );
}

interface GridProps {
  calendario: CalendarioGerado;
  slotSelecionado: string | null;
  onSelecionar: (chave: string) => void;
}

export default function CalendarioGrid({ calendario, slotSelecionado, onSelecionar }: GridProps) {
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
                <Dia
                  key={dia.data}
                  dia={dia}
                  selecionado={slotSelecionado}
                  onSelecionar={onSelecionar}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
