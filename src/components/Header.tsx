import { Sparkles, BookOpen, Clock, Heart, Award, ShieldAlert, Sun, Moon } from "lucide-react";
import { Brand } from "../types";
import { useState } from "react";
import { useTheme } from "../contexts/ThemeContext";

interface HeaderProps {
  currentBrand: Brand;
  setCurrentBrand: (brand: Brand) => void;
  userEmail?: string;
  onLogout?: () => void;
}

export default function Header({ currentBrand, setCurrentBrand, userEmail, onLogout }: HeaderProps) {
  const [showPlaybook, setShowPlaybook] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="bg-[var(--shell-panel)] border-b border-[var(--shell-border)] text-[var(--shell-text)] rounded-2xl p-6 mb-8 shadow-xl relative overflow-hidden">
      {/* Background visual detail */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[var(--shell-border)] rounded-full blur-3xl opacity-20 -mr-20 -mt-20 pointer-events-none"></div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-xl ${currentBrand === 'Apice' ? 'bg-[#688D65]/20 text-[#688D65]' : 'bg-[#BF0F26]/20 text-[#BF0F26]'} transition-all duration-300`}>
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <h1 className="text-2xl font-sans font-bold tracking-tight text-[var(--shell-text)]">
              Gerador de Emails Hits
            </h1>
          </div>
          <p className="text-[var(--shell-text-muted)] text-sm max-w-xl leading-relaxed">
            Crie pautas de CRM inteligentes, calibradas sob medida para entrar na aba Principal dos seus leads usando ciência de CRM e dados históricos validados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Brand selector */}
          <div className="bg-[var(--shell-panel-soft)] p-1.5 rounded-xl border border-[var(--shell-border)] flex items-center gap-1">
            <button
              id="btn-brand-apice"
              onClick={() => setCurrentBrand('Apice')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all duration-300 flex items-center gap-2 ${
                currentBrand === 'Apice'
                  ? 'bg-[#688D65] text-white shadow-lg shadow-[#688D65]/30'
                  : 'text-[var(--shell-text-muted)] hover:text-[var(--shell-text)] hover:bg-[var(--shell-panel)]'
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-300"></div>
              Apice Playbook
            </button>
            <button
              id="btn-brand-barbours"
              onClick={() => setCurrentBrand('Barbours')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all duration-300 flex items-center gap-2 ${
                currentBrand === 'Barbours'
                  ? 'bg-[#BF0F26] text-white shadow-lg shadow-[#BF0F26]/30'
                  : 'text-[var(--shell-text-muted)] hover:text-[var(--shell-text)] hover:bg-[var(--shell-panel)]'
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
              Barbours Playbook
            </button>
          </div>

          <button
            id="btn-toggle-playbook"
            onClick={() => setShowPlaybook(!showPlaybook)}
            className="flex items-center gap-2 bg-[var(--shell-panel-soft)] hover:bg-[var(--shell-border)] text-[var(--shell-text-muted)] hover:text-[var(--shell-text)] px-4 py-2.5 rounded-xl text-xs font-semibold border border-[var(--shell-border)] transition-all duration-300"
          >
            <BookOpen className="w-4 h-4" />
            {showPlaybook ? 'Fechar Resumo Tático' : 'Ver Perfil tático'}
          </button>

          <button
            id="btn-toggle-theme"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            className="flex items-center gap-2 bg-[var(--shell-panel-soft)] hover:bg-[var(--shell-border)] text-[var(--shell-text-muted)] hover:text-[var(--shell-text)] p-2.5 rounded-xl border border-[var(--shell-border)] transition-all duration-300 cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {userEmail && onLogout && (
            <button
              onClick={onLogout}
              className="text-xs text-[var(--shell-text-muted)] hover:text-[var(--shell-text)] transition-colors cursor-pointer flex items-center gap-1.5 bg-[var(--shell-panel-soft)] hover:bg-[var(--shell-border)] px-3 py-2 rounded-xl border border-[var(--shell-border)]"
              title="Sair"
            >
              <span className="max-w-[140px] truncate">{userEmail}</span>
              <span>→</span>
            </button>
          )}
        </div>
      </div>

      {showPlaybook && (
        <div className="mt-6 pt-6 border-t border-[var(--shell-border)] animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
            <div className="bg-[var(--shell-panel-soft)] p-4 rounded-xl border border-[var(--shell-border)]">
              <div className="flex items-center gap-2 text-[var(--shell-text)] font-semibold text-xs uppercase tracking-wider mb-2.5">
                <Heart className="w-4 h-4 text-rose-400" />
                Universo da Marca
              </div>
              <p className="text-[var(--shell-text-muted)] text-xs leading-relaxed">
                {currentBrand === 'Apice'
                  ? 'Empoderamento, diversidade capilar e autoestima. Tom de voz acolhedor, tipográfico e em primeira pessoa.'
                  : 'Luxo acessível, sensualidade moderna e sofisticação. Tom sofisticado, direto, formato push-notification.'}
              </p>
            </div>

            <div className="bg-[var(--shell-panel-soft)] p-4 rounded-xl border border-[var(--shell-border)]">
              <div className="flex items-center gap-2 text-[var(--shell-text)] font-semibold text-xs uppercase tracking-wider mb-2.5">
                <Clock className="w-4 h-4 text-amber-400" />
                Diferencial de Envio
              </div>
              <p className="text-[var(--shell-text-muted)] text-xs leading-relaxed">
                {currentBrand === 'Apice'
                  ? 'Disparar Quartas entre 08h30-09h30 (Maior taxa de abertura de 38.9%). Evitar Sextas-feiras.'
                  : 'Disparar Quartas (R$ 16k médios) ou Domingos (R$ 15k médios). Janela das 10h-11h (CTR 1.66%). Evitar Sábados.'}
              </p>
            </div>

            <div className="bg-[var(--shell-panel-soft)] p-4 rounded-xl border border-[var(--shell-border)]">
              <div className="flex items-center gap-2 text-[var(--shell-text)] font-semibold text-xs uppercase tracking-wider mb-2.5">
                <Award className="w-4 h-4 text-emerald-400" />
                Eixo e Cores
              </div>
              <p className="text-[var(--shell-text-muted)] text-xs leading-relaxed">
                {currentBrand === 'Apice'
                  ? 'Eixo de MANIPULAR (puxar, cortar, jogo da velha). Paleta: Verde Floresta #688D65 e realces em Magenta/Terracota.'
                  : 'Eixo de ABRIR (presente, caixa, carta). Paleta: Ruby Red #BF0F26 e detalhes em Gold #AA834B. Proibido: verde, azul, amarelo.'}
              </p>
            </div>

            <div className="bg-[var(--shell-panel-soft)] p-4 rounded-xl border border-[var(--shell-border)] md:col-span-3 xl:col-span-1">
              <div className="flex items-center gap-2 text-[var(--shell-text)] font-semibold text-xs uppercase tracking-wider mb-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                Regras Invioláveis
              </div>
              <p className="text-[var(--shell-text-muted)] text-xs leading-relaxed">
                Assunto deve ter {currentBrand === 'Apice' ? '27-47' : '16-39'} caracteres. Máximo 2 emojis. <strong className="text-[var(--shell-text)]">PROIBIDO:</strong> Caps lock inteiro, %, OFF, GRÁTIS e R$ no assunto. Pré-header fixo.
              </p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
