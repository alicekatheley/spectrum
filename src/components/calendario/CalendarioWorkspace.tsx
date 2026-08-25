import { useEffect, useRef, useState } from "react";
import { CalendarDays, Loader2, Lock, Moon, RefreshCw, Sun } from "lucide-react";
import { CalendarioGerado, MarcaCalendario, ModoCalendario } from "../../types";
import { useTheme } from "../../contexts/ThemeContext";
import { gerarCalendarioDemo, MARCAS_SEM_MODELO, procedenciaDoCatalogo } from "../../utils/calendarioDemo";
import { configDoContexto, type ContextoBigQuery, type ResultadoContexto } from "../../utils/calendarioContexto";
import { EdicaoSlot, chaveSlot, editarSlot, removerSlot } from "../../utils/editarCalendario";
import CalendarioGrid from "./CalendarioGrid";
import EditorSlot from "./EditorSlot";
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

const MODOS: { key: ModoCalendario; label: string; resumo: string; parametro: string }[] = [
  {
    key: 'receita_maxima',
    label: 'Receita máxima',
    resumo: 'Usa o teto de volume saudável da base e distribui entre os dias fortes. A eficiência é o que cede.',
    parametro: 'Onde ele para: no teto de saúde da base. Volume acima disso não é decisão de calendário.',
  },
  {
    key: 'eficiencia',
    label: 'Eficiência (R$/mil)',
    resumo: 'Corta os 3ºs disparos primeiro e reduz volume — comprando R$/mil com receita, na taxa medida.',
    parametro: 'Onde ele para: no corte de 15% do volume. Com piso de receita declarado, para antes.',
  },
];

const DIAS_SEMANA: { dow: number; label: string }[] = [
  { dow: 0, label: 'Dom' },
  { dow: 1, label: 'Seg' },
  { dow: 2, label: 'Ter' },
  { dow: 3, label: 'Qua' },
  { dow: 4, label: 'Qui' },
  { dow: 5, label: 'Sex' },
  { dow: 6, label: 'Sáb' },
];

const AVISO_INTEGRACAO = 'Ação ainda não conectada à base de dados — integração pendente.';

const CAMPO =
  'w-full bg-[var(--shell-bg)] border border-[var(--shell-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--shell-text)] placeholder:text-[var(--shell-text-muted)]/60 focus:outline-none focus:border-indigo-500/60 transition-colors';
const CARD = 'bg-[var(--shell-panel)] border border-[var(--shell-border)] rounded-3xl p-6 shadow-xl';
const TITULO_CARD = 'text-sm font-bold uppercase tracking-widest text-[var(--shell-text)]';
const BOTAO_SECUNDARIO =
  'bg-[var(--shell-panel-soft)] hover:bg-[var(--shell-border)] text-[var(--shell-text)] border border-[var(--shell-border)] px-5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const OPCIONAL =
  'text-[10px] font-mono uppercase tracking-wider text-[var(--shell-text-muted)] opacity-70 normal-case';

/** Campo numérico opcional: string vazia vira `undefined`, não 0. */
function paraNumero(texto: string): number | undefined {
  const limpo = texto.replace(/\./g, '').replace(',', '.').trim();
  if (!limpo) return undefined;
  const valor = Number(limpo);
  return Number.isFinite(valor) ? valor : undefined;
}

interface Mensagem {
  papel: 'usuario' | 'ia';
  texto: string;
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
  const [metaRpm, setMetaRpm] = useState('');
  const [pisoReceita, setPisoReceita] = useState('');
  const [diasAgressivos, setDiasAgressivos] = useState<number[]>([]);
  const [eventosEspeciais, setEventosEspeciais] = useState('');
  const [calendario, setCalendario] = useState<CalendarioGerado | null>(null);

  const [slotSelecionado, setSlotSelecionado] = useState<string | null>(null);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);

  const [conversa, setConversa] = useState<Mensagem[]>([]);
  const [pergunta, setPergunta] = useState('');
  const [carregandoIa, setCarregandoIa] = useState(false);
  const [erroIa, setErroIa] = useState<string | null>(null);

  const [novaOferta, setNovaOferta] = useState('');
  const [agressividade, setAgressividade] = useState('2');
  const [aviso, setAviso] = useState<string | null>(null);

  // Contexto real do BigQuery para a marca selecionada. Enquanto não chega, o gerador
  // cai no CONFIG estático — e a tela diz qual dos dois produziu o plano, via
  // `procedencia`. Um plano de catálogo inventado e um de catálogo medido não merecem
  // a mesma confiança, e a diferença tem de ser visível sem abrir o código.
  const [contexto, setContexto] = useState<ResultadoContexto | null>(null);
  const [erroContexto, setErroContexto] = useState<string | null>(null);
  const [carregandoContexto, setCarregandoContexto] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setContexto(null);
    setErroContexto(null);
    if (MARCAS_SEM_MODELO.includes(marca)) return;

    setCarregandoContexto(true);
    fetch(`/api/calendario/contexto?marca=${encodeURIComponent(marca)}`)
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok) throw new Error(corpo?.error ?? 'Falha ao carregar o contexto.');
        return corpo.data as ContextoBigQuery;
      })
      .then((ctx) => {
        if (!cancelado) setContexto(configDoContexto(ctx));
      })
      .catch((e: any) => {
        // Falhar aqui NÃO bloqueia a geração: o plano estático continua servindo para
        // ler a forma do modelo. O que não pode acontecer é cair para o estático em
        // silêncio, porque aí os números inventados passam por medidos.
        if (!cancelado) setErroContexto(e?.message ?? 'Contexto do BigQuery indisponível.');
      })
      .finally(() => {
        if (!cancelado) setCarregandoContexto(false);
      });

    return () => {
      cancelado = true;
    };
  }, [marca]);

  const marcaSemModelo = MARCAS_SEM_MODELO.includes(marca);
  const periodoValido = Boolean(dataInicio && dataFim && dataInicio <= dataFim);
  const podeGerar = periodoValido && !marcaSemModelo && !carregandoContexto;
  const slotAberto = calendario?.slots.find((s) => chaveSlot(s) === slotSelecionado) ?? null;

  // Deriva da marca DO CALENDÁRIO, não da marca selecionada no formulário: depois de gerar,
  // o usuário pode trocar o seletor sem gerar de novo, e o aviso tem de continuar descrevendo
  // o plano que está na tela.
  // Congelada no momento da geração: depois de gerar, trocar o seletor de marca
  // recarrega o contexto, e ler a procedência do contexto ATUAL faria o rótulo
  // descrever uma marca que não é a do plano na tela.
  const procedencia = calendario
    ? (calendario.procedencia ?? procedenciaDoCatalogo(calendario.marca))
    : 'sintetico';

  /**
   * Chama a leitura assistida. O calendário vai inteiro no corpo: a IA explica um plano que
   * já existe e não tem de onde tirar um número que não esteja ali (REGRA 1).
   */
  const consultarIa = async (cal: CalendarioGerado, texto?: string) => {
    setCarregandoIa(true);
    setErroIa(null);
    try {
      const resposta = await fetch('/api/calendario/explicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendario: cal, pergunta: texto, eventosEspeciais }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo?.error ?? 'Falha na leitura.');
      setConversa((atual) => [...atual, { papel: 'ia', texto: corpo.data.texto }]);
    } catch (e: any) {
      setErroIa(e?.message ?? 'Não foi possível falar com a leitura assistida.');
    } finally {
      setCarregandoIa(false);
    }
  };

  const handleGerar = () => {
    if (!podeGerar) return;
    setAviso(null);
    setSlotSelecionado(null);
    setErroEdicao(null);
    const gerado = gerarCalendarioDemo(
      {
        marca,
        modo,
        dataInicio,
        dataFim,
        metaReceita: paraNumero(metaReceita),
        metaRpm: paraNumero(metaRpm),
        pisoReceita: paraNumero(pisoReceita),
        diasAgressivos,
        eventosEspeciais,
      },
      contexto?.config,
    );
    setCalendario(gerado);
    setConversa([]);
    void consultarIa(gerado);
  };

  const handleEditar = (edicao: EdicaoSlot) => {
    if (!calendario || !slotAberto) return;
    const proximo = editarSlot(calendario, chaveSlot(slotAberto), edicao);
    if (!proximo) {
      setErroEdicao(
        'Alteração recusada: o horário ou a família já estão ocupados neste dia (H2 é rígida e não cede na edição).',
      );
      return;
    }
    setErroEdicao(null);
    setCalendario(proximo);
    // A chave do slot é (data, hora, oferta): editar hora ou oferta a invalida, então o
    // painel precisa ser reapontado para a nova identidade em vez de simplesmente fechar.
    const novaChave = [
      slotAberto.data,
      edicao.hora ?? slotAberto.hora,
      edicao.oferta?.trim() || slotAberto.oferta,
    ].join('|');
    setSlotSelecionado(proximo.slots.some((s) => chaveSlot(s) === novaChave) ? novaChave : null);
  };

  const handleRemover = () => {
    if (!calendario || !slotSelecionado) return;
    const proximo = removerSlot(calendario, slotSelecionado);
    if (!proximo) {
      setErroEdicao('Não dá para esvaziar o dia: um dia sem disparo nenhum sai do plano, não é um dia editado.');
      return;
    }
    setErroEdicao(null);
    setCalendario(proximo);
    setSlotSelecionado(null);
  };

  const handlePerguntar = () => {
    if (!calendario || !pergunta.trim() || carregandoIa) return;
    const texto = pergunta.trim();
    setConversa((atual) => [...atual, { papel: 'usuario', texto }]);
    setPergunta('');
    void consultarIa(calendario, texto);
  };

  const trocarMarca = (nova: MarcaCalendario) => {
    setMarca(nova);
    setCalendario(null);
    setSlotSelecionado(null);
    setConversa([]);
    setAviso(null);
  };

  const alternarDia = (dow: number) =>
    setDiasAgressivos((atual) =>
      atual.includes(dow) ? atual.filter((d) => d !== dow) : [...atual, dow].sort(),
    );

  // Rola para a resposta nova sem puxar a página inteira.
  const fimDaConversa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (conversa.length > 1) fimDaConversa.current?.scrollIntoView({ block: 'nearest' });
  }, [conversa.length]);

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
            família e volume — a partir dos índices medidos no histórico da marca. Depois de
            gerado, tudo é editável.
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

      {/* Cair para o CONFIG estático é aceitável; cair em silêncio não é. Sem este
          aviso, um plano de números inventados fica visualmente idêntico a um plano
          medido, e a única diferença some junto com a conexão. */}
      {erroContexto && !marcaSemModelo && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
            Contexto do BigQuery indisponível — usando catálogo estático
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--shell-text-muted)]">
            {erroContexto} O plano ainda pode ser gerado, mas o catálogo, o volume e o RPM
            voltam a ser os valores fixos do código — leia a forma do plano e ignore os
            reais até a conexão voltar.
          </p>
        </div>
      )}

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
                ~3,2% e sobe o R$/mil em ~7,6%. Os dois modos são posições na mesma curva, e cada um
                tem um ponto onde para — nenhum dos dois vai até o infinito. A fronteira completa
                vem junto com o calendário.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MODOS.map(({ key, label, resumo, parametro }) => {
                const ativo = modo === key;
                return (
                  <button
                    key={key}
                    id={`calendario-modo-${key.replace('_', '-')}`}
                    onClick={() => setModo(key)}
                    className={`text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
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
                    <p className="text-xs text-[var(--shell-text-muted)] leading-relaxed">{resumo}</p>
                    <p className="text-[11px] text-[var(--shell-text-muted)] opacity-75 leading-relaxed border-t border-[var(--shell-border)] pt-1.5 mt-0.5">
                      {parametro}
                    </p>
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

              {/* Metas: opcionais, e a tela precisa dizer isso antes de o usuário digitar.
                  Meta obrigatória vira número que se persegue; meta opcional continua sendo
                  o que ela é — uma régua contra a qual o plano é lido. */}
              <div className="flex flex-col gap-3 border-t border-[var(--shell-border)] pt-5">
                <div className="flex flex-col gap-1">
                  <span className={LABEL}>Metas — todas opcionais</span>
                  <p className="text-[11px] text-[var(--shell-text-muted)] leading-relaxed">
                    Deixe em branco e o plano sai igual: nenhuma meta muda uma decisão do modelo.
                    O que ela faz é dar a régua — se o plano não chegar lá, o gap é declarado com
                    as alavancas em ordem de custo, nunca fechado inflando volume em silêncio.
                  </p>
                </div>

                {modo === 'receita_maxima' ? (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="calendario-meta-receita" className={LABEL}>
                      Meta de receita (R$) <span className={OPCIONAL}>· opcional</span>
                    </label>
                    <input
                      id="calendario-meta-receita"
                      type="text"
                      inputMode="numeric"
                      value={metaReceita}
                      onChange={(e) => setMetaReceita(e.target.value)}
                      placeholder="Em branco: sem régua de receita"
                      className={CAMPO}
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="calendario-meta-rpm" className={LABEL}>
                        Meta de R$/mil envios <span className={OPCIONAL}>· opcional</span>
                      </label>
                      <input
                        id="calendario-meta-rpm"
                        type="text"
                        inputMode="decimal"
                        value={metaRpm}
                        onChange={(e) => setMetaRpm(e.target.value)}
                        placeholder="Em branco: sem régua de eficiência"
                        className={CAMPO}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="calendario-piso-receita" className={LABEL}>
                        Piso de receita (R$) <span className={OPCIONAL}>· opcional</span>
                      </label>
                      <input
                        id="calendario-piso-receita"
                        type="text"
                        inputMode="numeric"
                        value={pisoReceita}
                        onChange={(e) => setPisoReceita(e.target.value)}
                        placeholder="Em branco: o corte para nos 15% padrão"
                        className={CAMPO}
                      />
                      <p className="text-[11px] text-[var(--shell-text-muted)] leading-relaxed">
                        Este é o limite de quanto a eficiência pode cobrar em receita. Sem ele, o
                        modo corta 15% do volume — o corte medido, onde só 40% dos e-mails extras
                        alcançam alguém novo. Com ele, o corte para assim que a receita encosta no
                        piso.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Dias mais agressivos */}
              <div className="flex flex-col gap-2 border-t border-[var(--shell-border)] pt-5">
                <span className={LABEL}>
                  Dias mais agressivos <span className={OPCIONAL}>· opcional</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {DIAS_SEMANA.map(({ dow, label }) => {
                    const marcado = diasAgressivos.includes(dow);
                    return (
                      <button
                        key={dow}
                        id={`calendario-agressivo-${dow}`}
                        type="button"
                        onClick={() => alternarDia(dow)}
                        aria-pressed={marcado}
                        className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                          marcado
                            ? 'border-indigo-500/60 bg-indigo-500/15 text-[var(--shell-text)]'
                            : 'border-[var(--shell-border)] bg-[var(--shell-panel-soft)] text-[var(--shell-text-muted)] hover:text-[var(--shell-text)]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-[var(--shell-text-muted)] leading-relaxed">
                  Dias marcados entram na frente da fila do 3º disparo. A marcação reordena a fila;
                  ela não cria vaga: o teto semanal e as células sem suporte histórico continuam
                  valendo, e o modelo avisa quando um dia marcado não pôde ser atendido.
                </p>
              </div>

              <div className="flex flex-col gap-1.5 border-t border-[var(--shell-border)] pt-5">
                <label htmlFor="calendario-eventos" className={LABEL}>
                  Eventos especiais no período <span className={OPCIONAL}>· opcional</span>
                </label>
                <textarea
                  id="calendario-eventos"
                  rows={3}
                  value={eventosEspeciais}
                  onChange={(e) => setEventosEspeciais(e.target.value)}
                  placeholder={'Ex: dia 28 teremos lançamento X.\nDia 30 teremos cupom da madrugada às 22h.'}
                  className={`${CAMPO} resize-y`}
                />
                <p className="text-[11px] text-[var(--shell-text-muted)] leading-relaxed">
                  Campo aberto. Não entra em cálculo nenhum — volume, oferta e horário saem dos
                  índices, nunca de texto livre. Serve para a leitura assistida comentar o encaixe
                  do que você já sabe que vai acontecer.
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
              {/* Defeito de configuração aparece ANTES de gerar, e fica visível depois. Um
                  contexto quebrado não produz erro — produz um plano vazio com cara de plano,
                  e foi exatamente assim que a grade NULL passou despercebida. */}
              {contexto && contexto.avisos.length > 0 && (
                <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-300">
                    Contexto incompleto — o plano abaixo não é confiável
                  </p>
                  <ul className="mt-1.5 space-y-1.5">
                    {contexto.avisos.map((a) => (
                      <li key={a} className="text-xs leading-relaxed text-[var(--shell-text-muted)]">
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {calendario ? (
                <>
                  {/* Fica acima da grade, não no rodapé: quem lê o nome de uma oferta precisa
                      saber de onde ele veio ANTES de interpretar o plano, não depois. Os dois
                      estados têm avisos diferentes porque merecem confiança diferente. */}
                  {procedencia === 'sintetico' && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                        Catálogo sintético
                      </p>
                      <p className="mt-1.5 text-xs leading-relaxed text-[var(--shell-text-muted)]">
                        Os nomes de oferta e família (“Oferta A1”, “Família B”) são posições
                        vazias, não o catálogo da marca — e o volume e o RPM de base também são
                        arbitrários, o que torna arbitrárias as receitas em reais desta tela. O que
                        já é real aqui é a <strong className="text-[var(--shell-text)]">estrutura</strong>:
                        as restrições, os índices de dia, a elasticidade de volume e a decomposição.
                        Leia a forma do plano — quantos disparos, em que dias, em que ordem — e
                        ignore os valores absolutos até o catálogo real entrar.
                      </p>
                    </div>
                  )}

                  {procedencia === 'ditado' && (
                    <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                        Catálogo ditado, não extraído
                      </p>
                      <p className="mt-1.5 text-xs leading-relaxed text-[var(--shell-text-muted)]">
                        As ofertas e famílias desta marca foram informadas por quem opera o CRM,
                        não lidas do histórico. Os nomes são reais; a lista é de memória, então
                        é incompleta por construção e não se atualiza sozinha quando o catálogo
                        muda. O <strong className="text-[var(--shell-text)]">volume e o RPM de base
                        continuam arbitrários</strong> — as receitas em reais desta tela ainda não
                        significam nada. O corte em famílias é uma proposta: como família é a
                        unidade de fadiga, cortar fino demais faz o modelo subestimar repetição.
                      </p>
                    </div>
                  )}

                  {procedencia === 'dados' && (
                    <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                        Catálogo extraído do histórico
                      </p>
                      <p className="mt-1.5 text-xs leading-relaxed text-[var(--shell-text-muted)]">
                        Ofertas, famílias, grade de horários, índice por dia, censo de
                        viabilidade, volume e RPM de base vêm do BigQuery — as receitas em
                        reais desta tela finalmente significam alguma coisa.{' '}
                        <strong className="text-[var(--shell-text)]">
                          Duas ressalvas que continuam valendo.
                        </strong>{' '}
                        A primeira: não há índice medido por família, então o modelo trata
                        todas como equivalentes em performance — o rodízio acontece por
                        fadiga e por H2, não porque uma família renda mais. A segunda: os
                        fluxos automatizados ficaram de fora do plano (não são agendáveis),
                        e com eles saiu também a pressão que eles exercem sobre a base, que
                        o modelo de fadiga portanto subestima.
                      </p>
                      {contexto && contexto.excluidas.length > 0 && (
                        <ul className="mt-2 space-y-1 border-t border-emerald-500/20 pt-2">
                          {contexto.excluidas.map((e) => (
                            <li key={`${e.familia}-${e.motivo}`} className="text-xs text-[var(--shell-text-muted)]">
                              <strong className="text-[var(--shell-text)]">{e.familia}</strong>{' '}
                              ({e.ofertas.length} {e.ofertas.length === 1 ? 'oferta' : 'ofertas'}) — {e.motivo}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Zero slots nunca é uma recomendação. O gerador só devolve um plano vazio
                      quando não sobrou lugar onde encaixar disparo — grade sem hora, catálogo
                      sem oferta agendável ou período sem dia ativo. Antes disto a tela mostrava
                      uma grade em branco e deixava a conclusão por conta de quem olhava. */}
                  {calendario.slots.length === 0 && (
                    <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-rose-300">
                        Nenhum disparo gerado
                      </p>
                      <p className="mt-1.5 text-xs leading-relaxed text-[var(--shell-text-muted)]">
                        O modelo não encontrou nenhum lugar onde encaixar um disparo neste período.
                        Isso não significa que a recomendação seja não disparar — significa que
                        alguma entrada ficou vazia. Verifique, nesta ordem: a grade de horários da
                        marca ({contexto?.config.grade?.reduce((s, h) => s + (h?.length ?? 0), 0) ?? 0}{' '}
                        horas em toda a semana), o catálogo de ofertas agendáveis{' '}
                        ({contexto?.config.familias.length ?? 0}{' '}
                        {(contexto?.config.familias.length ?? 0) === 1 ? 'família' : 'famílias'}) e se
                        o período escolhido contém algum dia ativo.
                      </p>
                    </div>
                  )}

                  <CalendarioGrid
                    calendario={calendario}
                    slotSelecionado={slotSelecionado}
                    onSelecionar={(chave) => {
                      setErroEdicao(null);
                      setSlotSelecionado((atual) => (atual === chave ? null : chave));
                    }}
                  />

                  {slotAberto ? (
                    <EditorSlot
                      calendario={calendario}
                      slot={slotAberto}
                      erro={erroEdicao}
                      onAplicar={handleEditar}
                      onRemover={handleRemover}
                      onFechar={() => setSlotSelecionado(null)}
                    />
                  ) : (
                    <p className="text-xs text-[var(--shell-text-muted)] leading-relaxed border-t border-[var(--shell-border)] pt-4">
                      Cada card é um dia; cada linha, um disparo. Clique em qualquer um para ver a
                      receita e a eficiência esperadas, a família a que pertence — e para editar
                      horário, oferta, família ou volume.
                    </p>
                  )}
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

          {/* Leitura assistida — só existe depois que existe um plano para ler.
              Antes da geração este bloco não tinha função nenhuma além de ocupar a tela com
              a promessa de algo que ainda não podia acontecer. */}
          {calendario && (
            <div className={`${CARD} flex flex-col gap-5`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <h2 className={TITULO_CARD}>Leitura assistida (IA)</h2>
                  <p className="text-sm text-[var(--shell-text-muted)] leading-relaxed max-w-4xl">
                    A IA lê o calendário acima e explica as escolhas. Ela não estima R$/mil, não
                    pondera índices e não decide volume — todo número da tela sai do modelo
                    determinístico, e ela só tem acesso ao resultado dele. A separação é
                    estrutural, não uma questão de disciplina.
                  </p>
                </div>
                <button
                  id="calendario-btn-reler"
                  onClick={() => calendario && void consultarIa(calendario)}
                  disabled={carregandoIa}
                  title="Reler o calendário atual, já com as edições"
                  className="shrink-0 p-2.5 rounded-xl bg-[var(--shell-panel-soft)] hover:bg-[var(--shell-border)] border border-[var(--shell-border)] text-[var(--shell-text-muted)] hover:text-[var(--shell-text)] transition-all cursor-pointer disabled:opacity-40"
                >
                  <RefreshCw className={`w-4 h-4 ${carregandoIa ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="flex flex-col gap-3 max-h-[460px] overflow-y-auto pr-1">
                {conversa.map((m, i) => (
                  <div
                    key={i}
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.papel === 'usuario'
                        ? 'bg-indigo-500/10 border border-indigo-500/30 text-[var(--shell-text)] self-end max-w-[85%]'
                        : 'bg-[var(--shell-panel-soft)] border border-[var(--shell-border)] text-[var(--shell-text-muted)]'
                    }`}
                  >
                    {m.texto}
                  </div>
                ))}

                {carregandoIa && (
                  <div className="flex items-center gap-2 text-sm text-[var(--shell-text-muted)] px-4 py-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Lendo o calendário…
                  </div>
                )}

                {erroIa && (
                  <p className="text-[11px] text-amber-400 border border-amber-500/30 bg-amber-500/10 rounded-xl px-4 py-3">
                    {erroIa}
                  </p>
                )}

                <div ref={fimDaConversa} />
              </div>

              <div className="flex flex-col gap-2 border-t border-[var(--shell-border)] pt-5">
                <label htmlFor="calendario-pergunta" className={LABEL}>
                  Perguntar sobre este calendário:
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <textarea
                    id="calendario-pergunta"
                    rows={2}
                    value={pergunta}
                    onChange={(e) => setPergunta(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handlePerguntar();
                      }
                    }}
                    placeholder="Ex: por que a mensagem de quarta saiu às 20h e não de manhã?"
                    className={`${CAMPO} resize-y sm:flex-1`}
                  />
                  <button
                    id="calendario-btn-explicar"
                    onClick={handlePerguntar}
                    disabled={!pergunta.trim() || carregandoIa}
                    className={`${BOTAO_SECUNDARIO} shrink-0 self-start`}
                  >
                    Perguntar
                  </button>
                </div>
                <p className="text-[11px] text-[var(--shell-text-muted)] leading-relaxed">
                  Para mudar o plano, mude os parâmetros e gere de novo — direcionamento em texto
                  livre não move número nenhum aqui, e fingir que move seria o jeito mais rápido
                  de a tela deixar de ser confiável. Pergunte à IA qual parâmetro mexer.
                </p>
              </div>
            </div>
          )}

          {/* Encaixar uma oferta nova — seção própria. É outra pergunta: não é sobre o plano
              que existe, é sobre uma peça que ainda não está nele. */}
          <div className={`${CARD} flex flex-col gap-4`}>
            <div className="flex flex-col gap-1">
              <h2 className={TITULO_CARD}>Encaixar uma oferta nova</h2>
              <p className="text-sm text-[var(--shell-text-muted)] leading-relaxed max-w-4xl">
                A IA diz a qual família a oferta pertence e como ela se compara às existentes —
                classificação, que é trabalho de linguagem. A alocação em si (dia, horário e
                volume) vem de uma nova geração, porque é trabalho de modelo.
              </p>
            </div>
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
        </>
      )}

    </div>
  );
}
