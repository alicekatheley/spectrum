import { useState } from "react";
import { CalendarDays, Moon, Sun } from "lucide-react";
import { CalendarioGerado, MarcaCalendario } from "../../types";
import { useTheme } from "../../contexts/ThemeContext";
import { gerarCalendarioDemo } from "../../utils/calendarioDemo";
import CalendarioGrid from "./CalendarioGrid";

interface CalendarioWorkspaceProps {
  userEmail?: string;
  onLogout?: () => void;
}

const MARCAS: { key: MarcaCalendario; label: string; cor: string }[] = [
  { key: 'Apice', label: 'Ápice', cor: '#688D65' },
  { key: 'Barbours', label: "Barbour's", cor: '#BF0F26' },
  { key: 'Rituaria', label: 'Rituária', cor: '#A2B28D' },
  { key: 'Gocase', label: 'Gocase', cor: '#005BAA' },
  { key: 'Kokeshi', label: 'Kokeshi', cor: '#7BCAD1' },
  { key: 'Lescent', label: 'Lescent', cor: '#242323' },
];

const AVISO_INTEGRACAO = 'Ação ainda não conectada à base de dados — integração pendente.';

const CAMPO =
  'w-full bg-[var(--shell-bg)] border border-[var(--shell-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--shell-text)] placeholder:text-[var(--shell-text-muted)]/60 focus:outline-none focus:border-indigo-500/60 transition-colors';
const CARD = 'bg-[var(--shell-panel)] border border-[var(--shell-border)] rounded-3xl p-6 shadow-xl';
const TITULO_CARD = 'text-sm font-bold uppercase tracking-widest text-[var(--shell-text)]';
const BOTAO_SECUNDARIO =
  'bg-[var(--shell-panel-soft)] hover:bg-[var(--shell-border)] text-[var(--shell-text)] border border-[var(--shell-border)] px-5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

export default function CalendarioWorkspace({ userEmail, onLogout }: CalendarioWorkspaceProps) {
  const { theme, toggleTheme } = useTheme();
  const LABEL = `text-[11px] font-mono uppercase tracking-widest ${
    theme === 'light' ? 'text-indigo-700' : 'text-indigo-300'
  }`;

  const [marca, setMarca] = useState<MarcaCalendario>('Apice');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [eventosEspeciais, setEventosEspeciais] = useState('');
  const [volumeMensagens, setVolumeMensagens] = useState('');
  const [diretrizes, setDiretrizes] = useState('');
  const [calendario, setCalendario] = useState<CalendarioGerado | null>(null);

  const [ajusteTexto, setAjusteTexto] = useState('');
  const [novaOferta, setNovaOferta] = useState('');
  const [agressividade, setAgressividade] = useState('moderado');
  const [aviso, setAviso] = useState<string | null>(null);

  const periodoValido = Boolean(dataInicio && dataFim && dataInicio <= dataFim);

  const handleGerar = () => {
    if (!periodoValido) return;
    setAviso(null);
    setCalendario(
      gerarCalendarioDemo({ marca, dataInicio, dataFim, eventosEspeciais, volumeMensagens, diretrizes }),
    );
  };

  return (
    <div className="flex flex-col gap-8 animate-fade-in text-left">

      {/* Cabeçalho da seção */}
      <header className={`${CARD} flex flex-col md:flex-row justify-between items-start md:items-center gap-6`}>
        <div className="flex flex-col gap-1 max-w-xl">
          <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#AA834B]">
            Planejamento de Disparos de CRM
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--shell-text)]">
            Geração de Calendários
          </h1>
          <p className="text-xs text-[var(--shell-text-muted)] leading-relaxed mt-1">
            Defina o período de análise e a inteligência monta a grade de disparos por semana, cruzando
            oferta, dia da semana e receita histórica.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            className="bg-[var(--shell-panel-soft)] hover:bg-[var(--shell-border)] text-[var(--shell-text-muted)] hover:text-[var(--shell-text)] p-2.5 rounded-xl border border-[var(--shell-border)] transition-all cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {userEmail && onLogout && (
            <button
              onClick={onLogout}
              title="Sair"
              className="text-xs text-[var(--shell-text-muted)] hover:text-[var(--shell-text)] transition-colors cursor-pointer flex items-center gap-1.5 bg-[var(--shell-panel-soft)] hover:bg-[var(--shell-border)] px-3 py-2 rounded-xl border border-[var(--shell-border)]"
            >
              <span className="max-w-[140px] truncate">{userEmail}</span>
              <span>→</span>
            </button>
          )}
        </div>
      </header>

      {/* Seletor de marcas */}
      <div className={`${CARD} flex flex-col gap-4`}>
        <div className="flex flex-col gap-1">
          <span className={LABEL}>Marca</span>
          <p className="text-xs text-[var(--shell-text-muted)]">
            O calendário é montado sobre o histórico de ofertas e receita da marca selecionada.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {MARCAS.map(({ key, label, cor }) => {
            const ativa = marca === key;
            return (
              <button
                key={key}
                id={`calendario-marca-${key.toLowerCase()}`}
                onClick={() => setMarca(key)}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-300 flex items-center gap-2 cursor-pointer border ${
                  ativa
                    ? 'text-white border-transparent shadow-lg'
                    : 'bg-[var(--shell-panel-soft)] text-[var(--shell-text-muted)] border-[var(--shell-border)] hover:text-[var(--shell-text)]'
                }`}
                style={ativa ? { backgroundColor: cor } : undefined}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ativa ? '#FFFFFF' : cor }} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Formulário de período + calendário gerado */}
      <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start">

        <div className={`${CARD} flex flex-col gap-5`}>
          <span className={LABEL}>Período manual de análise:</span>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="calendario-data-inicio" className={LABEL}>Data de início:</label>
              <input
                id="calendario-data-inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className={CAMPO}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="calendario-data-fim" className={LABEL}>Data do fim:</label>
              <input
                id="calendario-data-fim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className={CAMPO}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="calendario-eventos" className={LABEL}>Eventos especiais no período:</label>
            <textarea
              id="calendario-eventos"
              rows={3}
              value={eventosEspeciais}
              onChange={(e) => setEventosEspeciais(e.target.value)}
              placeholder="Ex: Dia 28 de maio teremos um lançamento de body creams."
              className={`${CAMPO} resize-y`}
            />
            <p className="text-[11px] text-[var(--shell-text-muted)] leading-relaxed">
              Os acontecimentos acima serão priorizados na respectiva programação.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="calendario-volume" className={LABEL}>Volume de mensagens (opcional):</label>
            <input
              id="calendario-volume"
              type="text"
              value={volumeMensagens}
              onChange={(e) => setVolumeMensagens(e.target.value)}
              placeholder="Ex: 3 por semana, ou 3 disparos na sexta-feira"
              className={CAMPO}
            />
            <p className="text-[11px] text-[var(--shell-text-muted)] leading-relaxed">
              Em branco, a IA decide quantos disparos fazer e como distribuí-los para maximizar receita.
              Preenchido, ela cumpre o número exato e escolhe só dia, horário, categoria e grupo.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="calendario-diretrizes" className={LABEL}>Diretrizes gerais de CRM (opcional):</label>
            <textarea
              id="calendario-diretrizes"
              rows={4}
              value={diretrizes}
              onChange={(e) => setDiretrizes(e.target.value)}
              placeholder="Ex: Preciso de mensagens focadas em venda 4x na semana, preciso diminuir o número de mensagens na semana pois as saídas estão muito altas."
              className={`${CAMPO} resize-y`}
            />
          </div>

          <button
            id="calendario-btn-gerar"
            onClick={handleGerar}
            disabled={!periodoValido}
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/30 disabled:cursor-not-allowed text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-lg cursor-pointer"
          >
            <CalendarDays className="w-4 h-4" />
            Gerar Calendário Inteligente (1 Cred)
          </button>
        </div>

        <div className={`${CARD} @container flex flex-col gap-5 min-h-[420px]`}>
          {calendario ? (
            <>
              <CalendarioGrid calendario={calendario} />
              <p className="text-xs text-[var(--shell-text-muted)] leading-relaxed border-t border-[var(--shell-border)] pt-4">
                v2: cruza oferta × período (S1–S4) × dia da semana, receita via GA4. C1/C2 (reforço/novo)
                e recomendação de volume por célula.
              </p>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-8 py-16 border border-dashed border-[var(--shell-border)] rounded-2xl">
              <CalendarDays className="w-8 h-8 text-[var(--shell-text-muted)]" />
              <h3 className="text-base font-bold text-[var(--shell-text)]">Nenhum calendário gerado</h3>
              <p className="text-sm text-[var(--shell-text-muted)] max-w-sm leading-relaxed">
                Escolha a marca, defina o período de análise ao lado e gere a grade de disparos semana a semana.
              </p>
            </div>
          )}
        </div>
      </div>

      {aviso && (
        <p className="text-xs text-amber-400 border border-amber-500/30 bg-amber-500/10 rounded-xl px-4 py-3">
          {aviso}
        </p>
      )}

      {/* Checagem de campanhas recentes */}
      <div className={`${CARD} flex flex-col gap-4`}>
        <h2 className={TITULO_CARD}>Checagem de campanhas recentes vs. benchmark</h2>
        <p className="text-sm text-[var(--shell-text-muted)] leading-relaxed max-w-4xl">
          Compara campanhas de 3–9 dias atrás (já maturadas no GA4) contra o R$/mil histórico da mesma célula
          oferta×período×dia. Só roda quando você clicar — não altera o calendário acima.
        </p>
        <button
          id="calendario-btn-verificar"
          onClick={() => setAviso(AVISO_INTEGRACAO)}
          className={`${BOTAO_SECUNDARIO} self-start`}
        >
          Verificar campanhas recentes
        </button>
      </div>

      {/* Ajuste de estratégia */}
      <div className={`${CARD} flex flex-col gap-4`}>
        <h2 className={TITULO_CARD}>Ajustar estratégia (IA)</h2>
        <p className="text-sm text-[var(--shell-text-muted)] leading-relaxed max-w-4xl">
          Descreva uma situação (ex: "ontem foi fraco, preciso de um dia forte hoje") e a IA sugere um ajuste
          com base no calendário atual.
        </p>
        <textarea
          id="calendario-ajuste"
          rows={3}
          value={ajusteTexto}
          onChange={(e) => setAjusteTexto(e.target.value)}
          placeholder="Ex: as vendas de ontem vieram fracas, preciso reforçar hoje..."
          className={`${CAMPO} resize-y`}
        />
        <button
          id="calendario-btn-ajuste"
          onClick={() => setAviso(AVISO_INTEGRACAO)}
          disabled={!ajusteTexto.trim()}
          className={`${BOTAO_SECUNDARIO} self-start`}
        >
          Sugerir ajuste
        </button>
      </div>

      {/* Sugestão de novo merchan */}
      <div className={`${CARD} flex flex-col gap-4`}>
        <h2 className={TITULO_CARD}>Sugestão de novo merchan (IA)</h2>
        <p className="text-sm text-[var(--shell-text-muted)] leading-relaxed max-w-4xl">
          Informe uma oferta nova e um nível de agressividade — a IA sugere onde alocar no calendário.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="calendario-nova-oferta"
            type="text"
            value={novaOferta}
            onChange={(e) => setNovaOferta(e.target.value)}
            placeholder="Nome da oferta (ex: kit_verao)"
            className={`${CAMPO} sm:flex-1`}
          />
          <select
            id="calendario-agressividade"
            value={agressividade}
            onChange={(e) => setAgressividade(e.target.value)}
            className={`${CAMPO} sm:w-48 cursor-pointer`}
          >
            <option value="conservador">Conservador</option>
            <option value="moderado">Moderado</option>
            <option value="agressivo">Agressivo</option>
          </select>
          <button
            id="calendario-btn-merchan"
            onClick={() => setAviso(AVISO_INTEGRACAO)}
            disabled={!novaOferta.trim()}
            className={`${BOTAO_SECUNDARIO} shrink-0`}
          >
            Sugerir alocação
          </button>
        </div>
      </div>

    </div>
  );
}
