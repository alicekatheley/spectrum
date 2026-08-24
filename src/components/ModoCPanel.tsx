import { useState } from "react";
import { ContaInsider, PautaGerada, TesteAbProposta } from "../types";
import HistoryGallery from "./HistoryGallery";
import TesteAbCard from "./TesteAbCard";
import GifViewer from "./GifViewer";
import { Bot, ChevronRight, ChevronLeft, Calendar, X, Send, CheckCircle2, ChevronDown } from "lucide-react";

type ModoCStep = 'passo1' | 'passo2' | 'passo3';
type TimeRange = '7d' | '15d' | '30d' | '60d' | 'custom';

// Contas da Insider com acesso já configurado (chave em INSIDER_API_KEY_<MARCA>). O conteúdo do
// agente não é amarrado a uma marca (v1: mecânicas genéricas) — qualquer pauta pode ser
// enviada pra qualquer conta aqui, independente de qual marca ela foi rotulada ao ser gerada.
const CONTAS_INSIDER: ContaInsider[] = ['Apice', 'Barbours', 'Rituaria', 'Lescent', 'Kokeshi', 'Gocase'];

interface ModoCPanelProps {
  agentePautas: PautaGerada[];
  allFrameImages: Record<string, Record<string, string>>;
  onOpenPautaDetail: (id: string) => void;
  testesAb: TesteAbProposta[];
  onAceitarAb: (proposta: TesteAbProposta) => void;
  onRejeitarAb: (proposta: TesteAbProposta) => void;
  regenerandoAbId: string | null;
  onEnviarInsider: (
    proposta: TesteAbProposta,
    opts: { destinoMarca: ContaInsider; linkCampanha?: string; assunto?: string; nomeCampanha?: string },
  ) => void;
  enviandoInsiderId: string | null;
  onDownloadGif?: (pauta: PautaGerada) => void;
  baixandoGifId?: string | null;
}

interface EnvioInsiderForm {
  linkCampanha: string;
  assunto: string;
  nomeCampanha: string;
}

// Chave do form/estado de expansão — um envio é por (proposta, marca de destino), já que a
// mesma comparação pode virar campanha em várias contas Insider.
const envioKey = (propostaId: string, marca: ContaInsider) => `${propostaId}__${marca}`;

const STEPS: { key: ModoCStep; label: string }[] = [
  { key: 'passo1', label: 'Passo 1 — Novos Conceitos' },
  { key: 'passo2', label: 'Passo 2 — Aprovados & Teste A/B' },
  { key: 'passo3', label: 'Passo 3 — Enviar pra Insider' },
];

function filterByRange(pautas: PautaGerada[], range: TimeRange, custom: { start: string; end: string }): PautaGerada[] {
  return pautas.filter((p) => {
    const created = new Date(p.dataCriacao);
    if (range === 'custom') {
      if (custom.start) {
        const start = new Date(custom.start);
        start.setHours(0, 0, 0, 0);
        if (created < start) return false;
      }
      if (custom.end) {
        const end = new Date(custom.end);
        end.setHours(23, 59, 59, 999);
        if (created > end) return false;
      }
      return true;
    }
    const days = { '7d': 7, '15d': 15, '30d': 30, '60d': 60 }[range];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);
    return created >= cutoff;
  });
}

function TimeRangeFilter({
  value, onChange, custom, onCustomChange,
}: {
  value: TimeRange;
  onChange: (v: TimeRange) => void;
  custom: { start: string; end: string };
  onCustomChange: (v: { start: string; end: string }) => void;
}) {
  return (
    <div className="bg-[var(--shell-panel-soft)] p-3.5 rounded-2xl border border-[var(--shell-border)] flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--shell-text-muted)] mr-1">
        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
        Período
      </div>
      {([
        ['7d', 'Últimos 7d'],
        ['15d', 'Últimos 15d'],
        ['30d', 'Últimos 30d'],
        ['60d', 'Últimos 60d'],
      ] as const).map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
            value === v
              ? 'bg-indigo-600 border-indigo-500 text-white shadow'
              : 'bg-[var(--shell-panel)] border-[var(--shell-border)] text-[var(--shell-text-muted)] hover:text-[var(--shell-text)]'
          }`}
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange('custom')}
        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
          value === 'custom'
            ? 'bg-indigo-600 border-indigo-500 text-white shadow'
            : 'bg-[var(--shell-panel)] border-[var(--shell-border)] text-[var(--shell-text-muted)] hover:text-[var(--shell-text)]'
        }`}
      >
        Personalizado
      </button>
      {value === 'custom' && (
        <div className="flex items-center gap-2 ml-1">
          <input
            type="date"
            value={custom.start}
            onChange={(e) => onCustomChange({ ...custom, start: e.target.value })}
            className="bg-[var(--shell-panel)] border border-[var(--shell-border)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--shell-text)] focus:outline-none focus:border-indigo-500"
          />
          <span className="text-[var(--shell-text-muted)] text-xs">até</span>
          <input
            type="date"
            value={custom.end}
            onChange={(e) => onCustomChange({ ...custom, end: e.target.value })}
            className="bg-[var(--shell-panel)] border border-[var(--shell-border)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--shell-text)] focus:outline-none focus:border-indigo-500"
          />
        </div>
      )}
    </div>
  );
}

export default function ModoCPanel({
  agentePautas, allFrameImages, onOpenPautaDetail, testesAb, onAceitarAb, onRejeitarAb, regenerandoAbId,
  onEnviarInsider, enviandoInsiderId, onDownloadGif, baixandoGifId,
}: ModoCPanelProps) {
  const [step, setStep] = useState<ModoCStep>('passo1');
  const [range1, setRange1] = useState<TimeRange>('7d');
  const [custom1, setCustom1] = useState({ start: '', end: '' });
  const [range2, setRange2] = useState<TimeRange>('7d');
  const [custom2, setCustom2] = useState({ start: '', end: '' });
  const [openAbPautaId, setOpenAbPautaId] = useState<string | null>(null);
  const [formPorEnvio, setFormPorEnvio] = useState<Record<string, EnvioInsiderForm>>({});
  const [envioAberto, setEnvioAberto] = useState<string | null>(null);
  const getForm = (proposta: TesteAbProposta, marca: ContaInsider, pautaA?: PautaGerada): EnvioInsiderForm =>
    formPorEnvio[envioKey(proposta.id, marca)] ?? {
      linkCampanha: '',
      assunto: pautaA?.copy?.assunto ?? '',
      nomeCampanha: '',
    };
  const setForm = (propostaId: string, marca: ContaInsider, patch: Partial<EnvioInsiderForm>, base: EnvioInsiderForm) =>
    setFormPorEnvio((prev) => ({ ...prev, [envioKey(propostaId, marca)]: { ...base, ...patch } }));

  const rascunho = agentePautas.filter((p) => p.status === 'rascunho');
  const aprovadas = agentePautas.filter((p) => p.status === 'aprovado');
  const rascunhoFiltradas = filterByRange(rascunho, range1, custom1);
  const aprovadasFiltradas = filterByRange(aprovadas, range2, custom2);

  const pautaAbAberta = openAbPautaId ? agentePautas.find((p) => p.id === openAbPautaId) : undefined;
  const abAberta = openAbPautaId ? testesAb.find((t) => t.pautaId === openAbPautaId) ?? null : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-[var(--shell-panel-soft)] border border-[var(--shell-border)] rounded-3xl p-6 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-[var(--shell-text)] uppercase tracking-wider">Modo C: Agente Inteligente</h2>
        </div>
        <p className="text-sm text-[var(--shell-text-muted)] leading-relaxed max-w-3xl">
          Todos os dias o agente sobe até 5 novos conceitos de GIF sozinho, com base no que já funcionou historicamente e no que já foi aprovado/reprovado aqui. Este histórico não se mistura com o Histórico de Pautas geral.
        </p>
      </div>

      {/* Navegação de etapas — clicar num nome pula direto pra etapa */}
      <div className="flex items-center gap-6 border-b border-[var(--shell-border)]">
        {STEPS.map((s) => (
          <button
            key={s.key}
            onClick={() => setStep(s.key)}
            className={`text-sm font-bold tracking-wide transition-colors cursor-pointer pb-3 border-b-2 -mb-px ${
              step === s.key
                ? 'text-[var(--shell-text)] border-indigo-500'
                : 'text-[var(--shell-text-muted)] border-transparent hover:text-[var(--shell-text)]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {step === 'passo1' ? (
        <div className="flex flex-col gap-4 animate-fade-in">
          <TimeRangeFilter value={range1} onChange={setRange1} custom={custom1} onCustomChange={setCustom1} />

          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--shell-text-muted)]">
            Novos conceitos aguardando revisão ({rascunhoFiltradas.length})
          </h3>
          {rascunhoFiltradas.length > 0 ? (
            <HistoryGallery
              pautas={rascunhoFiltradas}
              frameImagesByPauta={allFrameImages}
              onOpenPauta={(pauta) => onOpenPautaDetail(pauta.id)}
            />
          ) : (
            <div className="bg-[var(--shell-panel-soft)] text-center py-10 px-8 border border-[var(--shell-border)] border-dashed rounded-[2.5rem] text-[var(--shell-text-muted)]">
              <span className="text-3xl mb-2 block">🤖</span>
              <p className="text-sm">Nenhum conceito aguardando revisão nesse período. O agente sobe até 5 por dia automaticamente.</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => setStep('passo2')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all"
            >
              Próximo: Aprovados & Teste A/B
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : step === 'passo2' ? (
        <div className="flex flex-col gap-4 animate-fade-in">
          <button
            onClick={() => setStep('passo1')}
            className="self-start bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </button>

          <TimeRangeFilter value={range2} onChange={setRange2} custom={custom2} onCustomChange={setCustom2} />

          <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-600">
            Pautas aprovadas pelo Agente ({aprovadasFiltradas.length})
          </h3>
          {aprovadasFiltradas.length > 0 ? (
            <HistoryGallery
              pautas={aprovadasFiltradas}
              frameImagesByPauta={allFrameImages}
              onOpenPauta={(pauta) => setOpenAbPautaId(pauta.id)}
              onDownloadGif={onDownloadGif}
              downloadingId={baixandoGifId}
            />
          ) : (
            <div className="bg-[var(--shell-panel-soft)] text-center py-10 px-8 border border-[var(--shell-border)] border-dashed rounded-[2.5rem] text-[var(--shell-text-muted)]">
              <span className="text-3xl mb-2 block">✅</span>
              <p className="text-sm">Nenhuma pauta do agente aprovada nesse período.</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => setStep('passo3')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all"
            >
              Próximo: Enviar pra Insider
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : null}

      {step === 'passo3' && (
        <div className="flex flex-col gap-5 animate-fade-in">
          <button
            onClick={() => setStep('passo2')}
            className="self-start bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </button>

          <p className="text-sm text-[var(--shell-text-muted)] max-w-2xl">
            Comparações já aceitas (Variante B confirmada), organizadas por conta Insider. A mesma comparação pode virar campanha em quantas contas fizer sentido — os dois GIFs (novo conceito x histórico) vão como as duas variações do experimento, criado direto como rascunho lá.
          </p>

          {testesAb.filter((t) => t.status === 'aceito').length === 0 ? (
            <div className="bg-[var(--shell-panel-soft)] text-center py-10 px-8 border border-[var(--shell-border)] border-dashed rounded-[2.5rem] text-[var(--shell-text-muted)]">
              <span className="text-3xl mb-2 block">📤</span>
              <p className="text-sm">Nenhuma comparação aceita ainda — aprove uma no Passo 2 pra ela aparecer aqui.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {CONTAS_INSIDER.map((marca) => {
                const aceitas = testesAb.filter((t) => t.status === 'aceito');
                const enviadasNaMarca = aceitas.filter((t) => t.envios.some((e) => e.marca === marca)).length;
                return (
                  <details key={marca} className="group/marca bg-[var(--shell-panel-soft)] border border-[var(--shell-border)] rounded-3xl overflow-hidden" open={marca === CONTAS_INSIDER[0]}>
                    <summary className="flex items-center justify-between gap-2 px-5 py-4 cursor-pointer select-none list-none">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[var(--shell-text)]">{marca}</span>
                        <span className="text-[11px] font-bold text-[var(--shell-text-muted)] bg-[var(--shell-panel)] border border-[var(--shell-border)] px-2 py-0.5 rounded-full">
                          {enviadasNaMarca}/{aceitas.length} enviadas
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-[var(--shell-text-muted)] transition-transform group-open/marca:rotate-180" />
                    </summary>

                    <div className="flex flex-col gap-2 px-5 pb-5">
                      {aceitas.map((proposta) => {
                        const pautaA = agentePautas.find((p) => p.id === proposta.pautaId);
                        const envio = proposta.envios.find((e) => e.marca === marca);
                        const frameImagesA = allFrameImages[proposta.pautaId] ?? {};
                        const varianteBUrl = proposta.conteudoVarianteB?.storageUrl || proposta.conteudoVarianteB?.insiderOriginalUrl;
                        const form = getForm(proposta, marca, pautaA);
                        const key = envioKey(proposta.id, marca);
                        const aberto = envioAberto === key;
                        return (
                          <div key={proposta.id} className="bg-[var(--shell-panel)] border border-[var(--shell-border)] rounded-2xl p-3 flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setOpenAbPautaId(proposta.pautaId)}
                                title="Ver detalhes da comparação"
                                className="flex items-center gap-1.5 shrink-0 cursor-pointer"
                              >
                                <div className="w-12 h-12 rounded-lg overflow-hidden border border-[var(--shell-border)]">
                                  {Object.keys(frameImagesA).length > 0 ? (
                                    <GifViewer frameImages={frameImagesA} />
                                  ) : (
                                    <div className="w-full h-full bg-slate-100" />
                                  )}
                                </div>
                                <div className="w-12 h-12 rounded-lg overflow-hidden border border-[var(--shell-border)] bg-slate-100">
                                  {varianteBUrl && (
                                    <img src={varianteBUrl} alt="" className="w-full h-full object-cover" />
                                  )}
                                </div>
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-[var(--shell-text)] truncate">
                                  {pautaA?.operacional?.mecanicaEscolhida ?? 'Novo conceito'}
                                </p>
                                <p className="text-[11px] text-[var(--shell-text-muted)] truncate">
                                  vs {proposta.conteudoVarianteB?.nomeDesign ?? 'histórico'}
                                </p>
                              </div>
                              {envio ? (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-[11px] bg-emerald-50 px-3 py-2 border border-emerald-200 rounded-xl">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Enviada (#{envio.insiderCampaignId})
                                  </div>
                                  <button
                                    onClick={() => setEnvioAberto(aberto ? null : key)}
                                    title="Enviar de novo pra Insider da mesma marca (cria uma nova campanha lá)"
                                    className="bg-white hover:bg-slate-50 border border-[var(--shell-border)] text-[var(--shell-text-muted)] hover:text-[var(--shell-text)] px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    {aberto ? 'Fechar' : 'Reenviar'}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEnvioAberto(aberto ? null : key)}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  {aberto ? 'Fechar' : 'Configurar envio'}
                                </button>
                              )}
                            </div>

                            {aberto && (
                              <div className="flex flex-col gap-2.5 bg-[var(--shell-panel-soft)] border border-[var(--shell-border)] rounded-xl p-3.5">
                                <div className="flex flex-col gap-1">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--shell-text-muted)]">
                                    Nome da campanha
                                  </label>
                                  <input
                                    type="text"
                                    value={form.nomeCampanha}
                                    onChange={(e) => setForm(proposta.id, marca, { nomeCampanha: e.target.value }, form)}
                                    placeholder={`agente ${marca} ${pautaA?.operacional?.mecanicaEscolhida ?? 'teste'}`.slice(0, 40)}
                                    maxLength={40}
                                    className="bg-[var(--shell-panel)] border border-[var(--shell-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--shell-text)] focus:outline-none focus:border-indigo-400"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--shell-text-muted)]">
                                    Assunto do e-mail
                                  </label>
                                  <input
                                    type="text"
                                    value={form.assunto}
                                    onChange={(e) => setForm(proposta.id, marca, { assunto: e.target.value }, form)}
                                    maxLength={200}
                                    className="bg-[var(--shell-panel)] border border-[var(--shell-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--shell-text)] focus:outline-none focus:border-indigo-400"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--shell-text-muted)]">
                                    Link da campanha (imagem + "clicando aqui")
                                  </label>
                                  <input
                                    type="text"
                                    value={form.linkCampanha}
                                    onChange={(e) => setForm(proposta.id, marca, { linkCampanha: e.target.value }, form)}
                                    placeholder="https://..."
                                    className="bg-[var(--shell-panel)] border border-[var(--shell-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--shell-text)] focus:outline-none focus:border-indigo-400"
                                  />
                                </div>
                                <button
                                  onClick={() => onEnviarInsider(proposta, {
                                    destinoMarca: marca,
                                    linkCampanha: form.linkCampanha || undefined,
                                    assunto: form.assunto || undefined,
                                    nomeCampanha: form.nomeCampanha || undefined,
                                  })}
                                  disabled={enviandoInsiderId === proposta.id}
                                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all self-start"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  {enviandoInsiderId === proposta.id
                                    ? 'Enviando...'
                                    : envio
                                      ? `Reenviar pra Insider da ${marca} (nova campanha)`
                                      : `Enviar para Insider da ${marca}`}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>
      )}

      {openAbPautaId && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center p-4 overflow-y-auto backdrop-blur-md bg-slate-950/80 animate-fade-in"
          onClick={() => setOpenAbPautaId(null)}
        >
          <div className="relative w-full max-w-3xl my-8" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setOpenAbPautaId(null)}
              title="Fechar"
              className="absolute -top-3 -right-3 z-10 bg-slate-900 text-white rounded-full p-2 shadow-lg hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            {abAberta ? (
              <TesteAbCard
                proposta={abAberta}
                pautaA={pautaAbAberta}
                frameImagesA={allFrameImages[openAbPautaId] ?? {}}
                onAceitar={onAceitarAb}
                onRejeitar={onRejeitarAb}
                regenerando={regenerandoAbId === abAberta.id}
              />
            ) : (
              <div className="bg-white rounded-3xl p-8 text-center text-sm text-slate-500">
                Gerando a proposta de teste A/B pra essa pauta — tente de novo em alguns segundos.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
