import { CalendarDays, Sparkles } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

export type AppSection = 'conteudos' | 'calendarios';

interface SidebarProps {
  section: AppSection;
  setSection: (section: AppSection) => void;
}

const ITENS: { key: AppSection; label: string; icon: typeof Sparkles }[] = [
  { key: 'conteudos', label: 'Geração de conteúdos', icon: Sparkles },
  { key: 'calendarios', label: 'Geração de calendários', icon: CalendarDays },
];

export default function Sidebar({ section, setSection }: SidebarProps) {
  const { theme } = useTheme();
  const classeAtivo =
    theme === 'light'
      ? 'bg-indigo-600/10 text-indigo-700 border border-indigo-500/30 shadow-sm'
      : 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-lg';

  return (
    <aside className="fixed inset-y-0 left-0 z-30 w-16 lg:w-60 bg-[var(--shell-panel)] border-r border-[var(--shell-border)] flex flex-col gap-6 py-6 px-2 lg:px-4">
      <div className="flex items-center gap-3 px-1 lg:px-2">
        <div className="rounded-xl overflow-hidden w-9 h-9 shrink-0">
          <img src="/favicon.svg" alt="Spectrum" className="w-full h-full object-cover" />
        </div>
        <span className="hidden lg:block text-lg font-bold tracking-tight text-[var(--shell-text)]">
          Spectrum
        </span>
      </div>

      <nav className="flex flex-col gap-1.5">
        {ITENS.map(({ key, label, icon: Icon }) => {
          const ativo = section === key;
          return (
            <button
              key={key}
              id={`sidebar-${key}`}
              onClick={() => setSection(key)}
              title={label}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-semibold transition-all duration-300 cursor-pointer ${
                ativo
                  ? classeAtivo
                  : 'text-[var(--shell-text-muted)] border border-transparent hover:text-[var(--shell-text)] hover:bg-[var(--shell-panel-soft)]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden lg:block leading-tight">{label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
