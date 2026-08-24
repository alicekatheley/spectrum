import { useState } from "react";
import { CalendarDays, Lock, Moon, Sun } from "lucide-react";
import { CalendarioGerado, MarcaCalendario, ModoCalendario } from "../../types";
import { useTheme } from "../../contexts/ThemeContext";
import { gerarCalendarioDemo, MARCAS_SEM_MODELO } from "../../utils/calendarioDemo";
import CalendarioGrid from "./CalendarioGrid";
import PainelResultado from "./PainelResultado";

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

const MODOS: { key: ModoCalendario; label: string; resumo: string }[] = [
  {
    key: 'receita_maxima',
    label: 'Receita máxima',
    resumo: 'Maximiza receita no período respeitando o teto de volume. A eficiência é o que cede.',
  },
  {
    key: 'eficiencia',
    label: 'Eficiência (R$/mil)',
    resumo: 'Maximiza receita por mil envios sem furar o piso de receita. Corta os 3ºs slots primeiro.',
  },
];

const AVISO_INTEGRACAO = 'Ação ainda não conectada à base de dados — integração pendente.';

const CAMPO =
  'w-full bg-[var(--shell-bg)] border border-[var(--shell-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--shell-text)] placeholder:text-[var(--shell-text-muted)]/60 focus:outline-none focus:border-indigo-500/60 transition-colors';
const CARD = 'bg-[var(--shell-panel)] border border-[var(--shell-border)] rounded-3xl p-6 shadow-xl';
const TITULO_CARD = 'text-sm font-bold uppercase tracking-widest text-[var(--shell-text)]';
const BOTAO_SECUNDARIO =
  'bg-[var(--shell-panel-soft)] hover:bg-[var(--shell-border)] text-[var(--shell-text)] border border-[var(--shell-border)] px-5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

/** Campo numérico opcional: string vazia vira `undefined`, não 0. */
function paraNumero(texto: string): number | undefined {
  const limpo = texto.replace(/\./g, '').replace(',', '.').trim();
  if (!limpo) return undefined;
  const valor = Number(limpo);
  return Number.isFinite(valor) ? valor : undefined;
}

export default function CalendarioWorkspace({ userEmail, onLogout }: CalendarioWorkspaceProps) {
  const { theme, toggleTheme } = useTheme();
  const LABEL = `text-[11px] font-mono uppercase tracking-widest ${
    theme === 'light' ? 'text-indigo-700' : 'text-indigo-300'
  }`;

  const [marca, setMarca] = useState<MarcaCalendario>('Lescent');
  const [modo, setModo] = useState<ModoCalendario>('receita_maxima');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [metaReceita, setMetaReceita] = useState('');
  const [volumeMaximo, setVolumeMaximo] = useState('');
  const [metaRpm, setMetaRpm] = useState('');
  const [pisoReceita, setPisoReceita] = useState('');
  const [eventosEspeciais, setEventosEspeciais] = useState('');
  const [calendario, setCalendario] = useState<CalendarioGerado | null>(null);

  const [perguntaIa, setPerguntaIa] = useState('');
  const [novaOferta, setNovaOferta] = useState('');
  const [agressividade, setAgressividade] = useState('2');
  const [aviso, setAviso] = useState<string | null>(null);

  const marcaSemModelo = MARCAS_SEM_MODELO.includes(marca);
  const periodoValido = Boolean(dataInicio && dataFim && dataInicio <= dataFim);
  const podeGerar = periodoValido && !marcaSemModelo;

  const handleGerar = () => {
    if (!podeGerar) return;
    setAviso(null);
    setCalendario(
      gerarCalendarioDemo({
        marca,
        modo,
        dataInicio,
        dataFim,
        metaReceita: paraNumero(metaReceita),
        volumeMaximo: paraNumero(volumeMaximo),
        metaRpm: paraNumero(metaRpm),
        pisoReceita: paraNumero(pisoReceita),
        eventosEspeciais,
      }),
    );
  };

  const trocarMarca = (nova: MarcaCalendario) => {
    setMarca(nova);
    setCalendario(null);
    setAviso(null);
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
            Define o período e o objetivo; o modelo monta a grade de slots — dia, horário, oferta,
            família e volume — a partir dos índices medidos no histórico da marca.
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
            Os índices são estimados por marca e nunca copiados de outra. Cinco marcas de seis estão
            no modelo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {MARCAS.map(({ key, label, cor }) => {
            const ativa = marca === key;
            const semModelo = MARCAS_SEM_MODELO.includes(key);
            return (
              <button
                key={key}
                id={`calendario-marca-${key.toLowerCase()}`}
                onClick={() => trocarMarca(key)}
                title={semModelo ? 'Marca sem cobertura do modelo — atribuição indisponível na origem' : undefined}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-300 flex items-center gap-2 cursor-pointer border ${
                  ativa
                    ? 'text-white border-transparent shadow-lg'
                    : `bg-[var(--shell-panel-soft)] border-[var(--shell-border)] hover:text-[var(--shell-text)] ${
                        semModelo ? 'text-[var(--shell-text-muted)] opacity-50' : 'text-[var(--shell-text-muted)]'
                      }`
                }`}
                style={ativa ? { backgroundColor: cor } : undefined}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ativa ? '#FFFFFF' : cor }} />
                {label}
                {semModelo && <Lock className="w-3 h-3" />}
              </button>
            );
          })}
        </div>
      </div>

      {marcaSemModelo ? (
        /* Gocase segue no seletor porque a pendência será resolvida — mas selecioná-la não
           leva a nada, e a tela precisa dizer por quê em vez de fingir que gera. */
        <div className={`${CARD} flex flex-col gap-3`}>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            <h2 className={TITULO_CARD}>Gocase ainda não entra no modelo</h2>
          </div>
          <p className="text-sm text-[var(--shell-text-muted)] leading-relaxed max-w-3xl">
            A marca tem 247 milhões de envios registrados, mas a tabela de pedidos é Spree e não
            tem coluna de UTM nenhuma — sem isso não há como casar receita com disparo, e o padrão
            de atribuição que sustenta todos os índices fica impossível de aplicar.
          </p>
          <p className="text-sm text-[var(--shell-text-muted)] leading-relaxed max-w-3xl">
            Não é fila de trabalho: é bloqueio de origem. Desbloquear é tarefa de engenharia de
            dados na carga do Spree, fora deste modelo. Enquanto isso, qualquer número aqui seria
            inventado — por isso a tela não gera.
          </p>
        </div>
      ) : (
        <>
          {/* Modo — a tensão é matemática, não uma preferência de configuração */}
          <div className={`${CARD} flex flex-col gap-4`}>
            <div className="flex flex-col gap-1">
              <span className={LABEL}>Objetivo</span>
              <p className="text-xs text-[var(--shell-text-muted)] leading-relaxed max-w-3xl">
                Receita e eficiência não têm ótimo comum: cortar 10% do volume derruba a receita em
                ~3,2% e sobe o R$/mil em ~7,6%. Os dois modos são posições na mesma curva — a
                fronteira completa vem junto com o calendário.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MODOS.map(({ key, label, resumo }) => {
                const ativo = modo === key;
                return (
                  <button
                    key={key}
                    id={`calendario-modo-${key.replace('_', '-')}`}
                    onClick={() => setModo(key)}
                    className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                      ativo
                        ? 'border-indigo-500/60 bg-indigo-500/10'
                        : 'border-[var(--shell-border)] bg-[var(--shell-panel-soft)] hover:border-[var(--shell-text-muted)]/40'
                    }`}
                  >
                    <span
                      className={`text-sm font-bold ${
                        ativo ? 'text-[var(--shell-text)]' : 'text-[var(--shell-text-muted)]'
                      }`}
                    >
                      {label}
                    </span>
                    <p className="text-xs text-[var(--shell-text-muted)] leading-relaxed mt-1">{resumo}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Formulário + grade */}
          <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start">

            <div className={`${CARD} flex flex-col gap-5`}>
              <span className={LABEL}>Período do calendário:</span>

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

              {/* Entradas do modo — A pede meta de receita + teto; B pede meta de RPM + piso. */}
              {modo === 'receita_maxima' ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="calendario-meta-receita" className={LABEL}>Meta de receita (R$):</label>
                    <input
                      id="calendario-meta-receita"
                      type="text"
                      inputMode="numeric"
                      value={metaReceita}
                      onChange={(e) => setMetaReceita(e.target.value)}
                      placeholder="Ex: 250000"
                      className={CAMPO}
                    />
                    <p className="text-[11px] text-[var(--shell-text-muted)] leading-relaxed">
                      Meta não é comando. Se o plano não alcançar, o modelo declara o gap e lista as
                      alavancas em ordem de custo — nunca infla volume em silêncio.
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="calendario-volume-maximo" className={LABEL}>Volume máximo (envios):</label>
                    <input
                      id="calendario-volume-maximo"
                      type="text"
                      inputMode="numeric"
                      value={volumeMaximo}
                      onChange={(e) => setVolumeMaximo(e.target.value)}
                      placeholder="Em branco, usa o teto de saúde da base"
                      className={CAMPO}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="calendario-meta-rpm" className={LABEL}>Meta de R$/mil envios:</label>
                    <input
                      id="calendario-meta-rpm"
                      type="text"
                      inputMode="decimal"
                      value={metaRpm}
                      onChange={(e) => setMetaRpm(e.target.value)}
                      placeholder="Ex: 34,5"
                      className={CAMPO}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="calendario-piso-receita" className={LABEL}>Piso de receita (R$):</label>
                    <input
                      id="calendario-piso-receita"
                      type="text"
                      inputMode="numeric"
                      value={pisoReceita}
                      onChange={(e) => setPisoReceita(e.target.value)}
                      placeholder="Tipicamente a receita do período anterior"
                      className={CAMPO}
                    />
                    <p className="text-[11px] text-[var(--shell-text-muted)] leading-relaxed">
                      O corte começa pelos 3ºs slots: só 40% dos e-mails extras alcançam alguém novo,
                      os outros 60% são repetição.
                    </p>
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="calendario-eventos" className={LABEL}>Eventos especiais no período:</label>
                <textarea
                  id="calendario-eventos"
                  rows={3}
                  value={eventosEspeciais}
                  onChange={(e) => setEventosEspeciais(e.target.value)}
                  placeholder="Ex: dia 28 teremos lançamento de body creams."
                  className={`${CAMPO} resize-y`}
                />
                <p className="text-[11px] text-[var(--shell-text-muted)] leading-relaxed">
                  Contexto para a leitura do plano. Não entra em cálculo nenhum — volume, oferta e
                  horário saem dos índices, nunca de texto livre.
                </p>
              </div>

              <button
                id="calendario-btn-gerar"
                onClick={handleGerar}
                disabled={!podeGerar}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/30 disabled:cursor-not-allowed text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-lg cursor-pointer"
              >
                <CalendarDays className="w-4 h-4" />
                Gerar Calendário (1 Cred)
              </button>
            </div>

            <div className={`${CARD} @container flex flex-col gap-5 min-h-[420px]`}>
              {calendario ? (
                <>
                  <CalendarioGrid calendario={calendario} />
                  <p className="text-xs text-[var(--shell-text-muted)] leading-relaxed border-t border-[var(--shell-border)] pt-4">
                    Cada card é um dia; cada linha, um slot — horário, oferta, família e volume
                    planejado. Slots marcados como não validados usam alavancas que não sobreviveram
                    ao teste fora da amostra.
                  </p>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-8 py-16 border border-dashed border-[var(--shell-border)] rounded-2xl">
                  <CalendarDays className="w-8 h-8 text-[var(--shell-text-muted)]" />
                  <h3 className="text-base font-bold text-[var(--shell-text)]">Nenhum calendário gerado</h3>
                  <p className="text-sm text-[var(--shell-text-muted)] max-w-sm leading-relaxed">
                    Escolha a marca, o objetivo e o período ao lado para montar a grade de slots.
                  </p>
                </div>
              )}
            </div>
          </div>

          {calendario && <PainelResultado calendario={calendario} />}

          {aviso && (
            <p className="text-xs text-amber-400 border border-amber-500/30 bg-amber-500/10 rounded-xl px-4 py-3">
              {aviso}
            </p>
          )}

          {/* Checagem de campanhas recentes */}
          <div className={`${CARD} flex flex-col gap-4`}>
            <h2 className={TITULO_CARD}>Checagem de campanhas recentes vs. benchmark</h2>
            <p className="text-sm text-[var(--shell-text-muted)] leading-relaxed max-w-4xl">
              Compara campanhas de 3–9 dias atrás — já maturadas na janela de atribuição de 36h —
              contra o R$/mil histórico do mesmo slot. A última semana é sempre descartada: ainda
              está dentro da janela e aparece com erro alto por artefato.
            </p>
            <button
              id="calendario-btn-verificar"
              onClick={() => setAviso(AVISO_INTEGRACAO)}
              className={`${BOTAO_SECUNDARIO} self-start`}
            >
              Verificar campanhas recentes
            </button>
          </div>

          {/* Painéis de IA — prosa apenas */}
          <div className={`${CARD} flex flex-col gap-5`}>
            <div className="flex flex-col gap-1">
              <h2 className={TITULO_CARD}>Leitura assistida (IA)</h2>
              <p className="text-sm text-[var(--shell-text-muted)] leading-relaxed max-w-4xl">
                A IA explica o calendário, nomeia ofertas e descreve trade-offs. Ela não estima
                R$/mil, não pondera índices e não decide volume — todo número da tela sai do modelo
                determinístico. A separação é estrutural, não uma questão de disciplina.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="calendario-pergunta" className={LABEL}>
                Perguntar sobre o calendário gerado:
              </label>
              <textarea
                id="calendario-pergunta"
                rows={3}
                value={perguntaIa}
                onChange={(e) => setPerguntaIa(e.target.value)}
                placeholder="Ex: por que quarta recebeu mais volume que sexta?"
                className={`${CAMPO} resize-y`}
              />
              <button
                id="calendario-btn-explicar"
                onClick={() => setAviso(AVISO_INTEGRACAO)}
                disabled={!perguntaIa.trim() || !calendario}
                className={`${BOTAO_SECUNDARIO} self-start`}
              >
                Explicar
              </button>
              {!calendario && (
                <p className="text-[11px] text-[var(--shell-text-muted)] opacity-70">
                  Disponível depois de gerar um calendário — a IA lê o plano, não o inventa.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-[var(--shell-border)] pt-5">
              <label htmlFor="calendario-nova-oferta" className={LABEL}>
                Encaixar uma oferta nova:
              </label>
              <p className="text-[11px] text-[var(--shell-text-muted)] leading-relaxed">
                A IA diz a qual família a oferta pertence e como ela se compara às existentes. A
                alocação em si — dia, horário e volume — vem de uma nova geração, não da IA.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  id="calendario-nova-oferta"
                  type="text"
                  value={novaOferta}
                  onChange={(e) => setNovaOferta(e.target.value)}
                  placeholder="Nome da oferta (ex: Kit Verão)"
                  className={`${CAMPO} sm:flex-1`}
                />
                <select
                  id="calendario-agressividade"
                  value={agressividade}
                  onChange={(e) => setAgressividade(e.target.value)}
                  className={`${CAMPO} sm:w-56 cursor-pointer`}
                  title="Escada 1–4 de quanto a concessão custa em CMV"
                >
                  <option value="1">Agressividade 1 — sem concessão</option>
                  <option value="2">Agressividade 2 — brinde/mimo</option>
                  <option value="3">Agressividade 3 — desconto percentual</option>
                  <option value="4">Agressividade 4 — reais OFF</option>
                </select>
                <button
                  id="calendario-btn-merchan"
                  onClick={() => setAviso(AVISO_INTEGRACAO)}
                  disabled={!novaOferta.trim()}
                  className={`${BOTAO_SECUNDARIO} shrink-0`}
                >
                  Classificar oferta
                </button>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
