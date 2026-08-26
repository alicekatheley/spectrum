import { useState } from "react";
import { CalendarDays, Users } from "lucide-react";
import CalendarioWorkspace from "./CalendarioWorkspace";
import CalendarioSegmentacao from "./CalendarioSegmentacao";

type SubAba = 'ofertas' | 'segmentacao';

interface Props {
  userEmail?: string;
  onLogout?: () => void;
}

const TABS: { key: SubAba; label: string; resumo: string; icone: typeof CalendarDays }[] = [
  {
    key: 'ofertas',
    label: 'Ofertas',
    resumo: 'O quê enviar — geração do calendário editorial',
    icone: CalendarDays,
  },
  {
    key: 'segmentacao',
    label: 'Segmentação',
    resumo: 'Para quem e quando — dose semanal por tier',
    icone: Users,
  },
];

export default function CalendarioSecao({ userEmail, onLogout }: Props) {
  const [subAba, setSubAba] = useState<SubAba>('ofertas');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row gap-2 p-1.5 bg-[var(--shell-panel-soft)] border border-[var(--shell-border)] rounded-2xl">
        {TABS.map(({ key, label, resumo, icone: Icone }) => {
          const ativo = subAba === key;
          return (
            <button
              key={key}
              id={`calendario-subaba-${key}`}
              onClick={() => setSubAba(key)}
              className={`flex-1 flex items-start gap-3 text-left px-4 py-3 rounded-xl transition-all cursor-pointer border ${
                ativo
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-[var(--shell-text)] shadow-lg'
                  : 'bg-transparent border-transparent text-[var(--shell-text-muted)] hover:text-[var(--shell-text)] hover:bg-[var(--shell-panel)]/50'
              }`}
            >
              <Icone className={`w-4 h-4 mt-0.5 shrink-0 ${ativo ? 'text-indigo-300' : ''}`} />
              <div className="flex flex-col">
                <span className="text-sm font-bold uppercase tracking-wider">{label}</span>
                <span className="text-[11px] text-[var(--shell-text-muted)] leading-tight mt-0.5">
                  {resumo}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {subAba === 'ofertas' ? (
        <CalendarioWorkspace userEmail={userEmail} onLogout={onLogout} />
      ) : (
        <CalendarioSegmentacao marca="Barbours" />
      )}
    </div>
  );
}
