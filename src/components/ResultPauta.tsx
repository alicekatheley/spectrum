import { useState } from "react";
import { PautaGerada } from "../types";
import BannerSimulador from "./BannerSimulador";
import {
  Copy, Check, Eye, EyeOff, Calendar, Clock, BarChart3,
  HelpCircle, AlertTriangle, Sparkles, Wand2, ThumbsUp, XOctagon, RefreshCw, RotateCcw, Download, Image
} from "lucide-react";
import { downloadFile, generatePautaBriefingText } from "../utils";

interface ResultPautaProps {
  pauta: PautaGerada;
  onApprove: (id: string) => void;
  onDiscard: (id: string) => void;
  onGenerateVariation: (pauta: PautaGerada) => Promise<void>;
  onEdit: (pauta: PautaGerada) => void;
  onOpenPreview: (pauta: PautaGerada) => void;
  key?: string | number;
  aspectRatio: string;
  imageModel: string;
  referenciaImagem?: string | null;
}

export default function ResultPauta({
  pauta,
  onApprove,
  onDiscard,
  onGenerateVariation,
  onEdit,
  onOpenPreview,
  aspectRatio,
  imageModel,
  referenciaImagem,
}: ResultPautaProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showVisualAccordion, setShowVisualAccordion] = useState(true);
  const [showOperacionalAccordion, setShowOperacionalAccordion] = useState(true);
  const [loadingVariation, setLoadingVariation] = useState(false);
  const [frameImages, setFrameImages] = useState<{ inicial?: string; intermediario?: string; final?: string }>({});
  const [frameErrors, setFrameErrors] = useState<{ inicial?: string; intermediario?: string; final?: string }>({});
  const [generatingFrame, setGeneratingFrame] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleVariationClick = async () => {
    setLoadingVariation(true);
    try {
      await onGenerateVariation(pauta);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingVariation(false);
    }
  };

  const generateFrameImage = async (frameName: 'inicial' | 'intermediario' | 'final') => {
    const descriptions: Record<string, string> = {
      inicial: pauta.visual.frameInicial,
      intermediario: pauta.visual.frameIntermediario,
      final: pauta.visual.frameFinal,
    };
    setGeneratingFrame(frameName);
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameName,
          frameDescription: descriptions[frameName],
          aspectRatio,
          marca: pauta.marca,
          imageModel,
          estiloIlustracao: pauta.visual.estiloIlustracao,
          paleta: pauta.visual.paletaRecomendada,
          mecanica: pauta.operacional.mecanicaEscolhida,
          recompensa: pauta.operacional.recompensaEscolhida ?? pauta.copy.subHeadlineBanner,
          referenciaImagem: referenciaImagem ?? undefined,
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        setFrameErrors(prev => ({ ...prev, [frameName]: (errData as any).error ?? `Erro ${response.status}` }));
        return;
      }
      const data = await response.json();
      if (data.imageBytes) {
        setFrameImages(prev => ({
          ...prev,
          [frameName]: `data:${data.mimeType};base64,${data.imageBytes}`,
        }));
      } else {
        setFrameErrors(prev => ({ ...prev, [frameName]: data.error ?? 'Resposta inválida da API.' }));
      }
    } catch {
      setFrameErrors(prev => ({ ...prev, [frameName]: 'Erro de rede ao gerar imagem.' }));
    } finally {
      setGeneratingFrame(null);
    }
  };

  const isApice = pauta.marca === 'Apice';
  const tipoEfetivo = pauta.tipoGeracao ?? 'texto_imagem';
  const TIPO_LABELS: Record<string, string> = {
    texto_imagem: 'Texto + Imagem',
    texto: 'Só Texto',
    imagem: 'Só Imagem',
  };
  const displayStatus = pauta.status === 'aprovado'
    ? { text: 'Aprovada', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
    : pauta.status === 'descartado'
      ? { text: 'Descartada', bg: 'bg-slate-100 text-slate-500 border-slate-200' }
      : { text: 'Rascunho', bg: 'bg-amber-100 text-amber-800 border-amber-300' };

  return (
    <div className={`bg-white rounded-3xl p-6 shadow-xl border-2 transition-all duration-300 relative overflow-hidden ${
      pauta.status === 'aprovado' 
        ? 'border-emerald-300 ring-4 ring-emerald-500/10' 
        : pauta.status === 'descartado'
          ? 'border-slate-150 opacity-70'
          : isApice ? 'border-indigo-100' : 'border-[#BF0F26]/10'
    }`}>
      {/* Detalhe superior estético de branding da pauta */}
      <div 
        className="absolute top-0 inset-x-0 h-1.5"
        style={{ backgroundColor: isApice ? '#688D65' : '#BF0F26' }}
      ></div>

      {/* Header Info */}
      <div className="flex justify-between items-start border-b border-slate-150 pb-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs uppercase font-extrabold tracking-wider px-2.5 py-1 rounded-full ${displayStatus.bg} border`}>
              {displayStatus.text}
            </span>
            <span
              className="text-xs uppercase font-extrabold tracking-wider px-2.5 py-1 rounded-full border text-white"
              style={{ backgroundColor: isApice ? '#688D65' : '#BF0F26', borderColor: isApice ? '#52704f' : '#990c1e' }}
            >
              {pauta.marca}
            </span>
            <span className="text-xs uppercase font-semibold tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              Modo {pauta.modo}
            </span>
            <span className="text-xs uppercase font-semibold tracking-wider px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
              {TIPO_LABELS[tipoEfetivo]}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ID: {pauta.id.split('-')[1] || pauta.id}
            </span>
          </div>
          <h4 className="text-lg font-bold text-slate-850">
            Pauta Hits — Marca {pauta.marca}
          </h4>
        </div>
        <div className="font-mono text-[10px] text-slate-400">
          Gerado via Modo {pauta.modo} • {new Date(pauta.dataCriacao).toLocaleDateString()}
        </div>
      </div>

      {/* Grid Principal: Esquerda Copywriting e Controles / Direita Simulador Gráfico */}
      <div className={`grid grid-cols-1 gap-8 ${tipoEfetivo === 'texto_imagem' ? 'lg:grid-cols-2' : ''}`}>

        {/* Lado Esquerdo: Bloco de Copywriting — oculto se Apenas Imagem */}
        {tipoEfetivo !== 'imagem' && <div className="flex flex-col gap-5">
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center justify-between">
              <span>Célula de Copywriting Calibrado (Playbook de CRM)</span>
              <button
                id={`btn-copy-all-${pauta.id}`}
                onClick={() => copyToClipboard(
                  `ASSUNTO: ${pauta.copy.assunto}\nPRÉ-HEADER: ${pauta.copy.preHeader}\nHEADLINE: ${pauta.copy.headlineBanner}\nSUB: ${pauta.copy.subHeadlineBanner}\nCTA: ${pauta.copy.ctaBotao}`,
                  'tudo'
                )}
                className="text-[10px] text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-350 px-2.5 py-1 rounded w-auto flex items-center gap-1 cursor-pointer transition-colors"
              >
                {copiedField === 'tudo' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    Copiado completo!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copiar Todos
                  </>
                )}
              </button>
            </h5>

            {/* Campos de Copy de Email individuais */}
            <div className="flex flex-col gap-3.5 bg-slate-50 p-4.5 rounded-2xl border border-slate-100">
              
              {/* Assunto */}
              <div className="flex flex-col gap-1 relative group/copy">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Assunto do Email</span>
                <div className="flex justify-between items-start gap-4 p-2 bg-white rounded-xl border border-slate-150">
                  <p className="text-sm font-semibold text-slate-800 flex-1 leading-snug">
                    {pauta.copy.assunto}
                  </p>
                  <button
                    id={`btn-copy-assunto-${pauta.id}`}
                    onClick={() => copyToClipboard(pauta.copy.assunto, 'assunto')}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 shrink-0 transition-colors cursor-pointer"
                    title="Copiar Assunto"
                  >
                    {copiedField === 'assunto' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Pré-Header Fixo */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pré-Header (Fixo/Intocável)</span>
                  <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold uppercase">Calibrado</span>
                </div>
                <div className="flex justify-between items-center gap-4 p-2 bg-white rounded-xl border border-slate-150/70 select-none">
                  <p className="text-xs font-semibold text-slate-500 italic">
                    "{pauta.copy.preHeader}"
                  </p>
                  <button
                    id={`btn-copy-preheader-${pauta.id}`}
                    onClick={() => copyToClipboard(pauta.copy.preHeader, 'preHeader')}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 shrink-0 transition-colors cursor-pointer"
                    title="Copiar Pré-Header"
                  >
                    {copiedField === 'preHeader' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Headline do Banner */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Headline do Banner</span>
                <div className="flex justify-between items-start gap-4 p-2 bg-white rounded-xl border border-slate-150">
                  <p className={`text-sm font-bold uppercase ${isApice ? 'font-serif italic' : ''}`} style={{ color: isApice ? '#52704f' : '#BF0F26' }}>
                    {pauta.copy.headlineBanner}
                  </p>
                  <button
                    id={`btn-copy-headline-${pauta.id}`}
                    onClick={() => copyToClipboard(pauta.copy.headlineBanner, 'headline')}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 shrink-0 transition-colors cursor-pointer"
                    title="Copiar Headline"
                  >
                    {copiedField === 'headline' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Sub-headline do Banner */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sub-Headline do Banner</span>
                <div className="flex justify-between items-start gap-4 p-2 bg-white rounded-xl border border-slate-150">
                  <p className="text-xs font-medium text-slate-650">
                    {pauta.copy.subHeadlineBanner}
                  </p>
                  <button
                    id={`btn-copy-subheadline-${pauta.id}`}
                    onClick={() => copyToClipboard(pauta.copy.subHeadlineBanner, 'subHeadline')}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 shrink-0 transition-colors cursor-pointer"
                    title="Copiar Sub-Headline"
                  >
                    {copiedField === 'subHeadline' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* CTA Botão */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Ação CTA (Texto Único)</span>
                <div className="flex justify-between items-start gap-4 p-2 bg-white rounded-xl border border-slate-150">
                  <p className="text-xs font-bold text-slate-700 font-mono tracking-wider">
                    {pauta.copy.ctaBotao}
                  </p>
                  <button
                    id={`btn-copy-cta-${pauta.id}`}
                    onClick={() => copyToClipboard(pauta.copy.ctaBotao, 'cta')}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 shrink-0 transition-colors cursor-pointer"
                    title="Copiar CTA"
                  >
                    {copiedField === 'cta' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Alertas de Riscos de Entregabilidade (Playbook) */}
          {pauta.riscos && pauta.riscos.length > 0 && (
            <div className="flex flex-col gap-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Sinalização de Riscos Táticos Identificados Detetados
              </h5>
              <div className="flex flex-col gap-2.5">
                {pauta.riscos.map((risco, idx) => (
                  <div key={idx} className="bg-amber-50 p-4.5 rounded-2xl border border-amber-200 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-700">
                      <span className="px-1.5 py-0.5 bg-amber-100 text-[10px] rounded uppercase">Campo: {risco.campo}</span>
                      <span>Severidade: {risco.nivel.toUpperCase()}</span>
                    </div>
                    <p className="text-[11px] text-slate-650 leading-relaxed font-semibold">
                      {risco.mensagem}
                    </p>
                    {risco.alternativaSugerida && (
                      <div className="text-[11px] text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100 font-medium leading-normal">
                        <strong>Melodia recomendada do Playbook:</strong> {risco.alternativaSugerida}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>}

        {/* Lado Direito: Banner Simulador Gráfico — oculto se Apenas Texto */}
        {tipoEfetivo !== 'texto' && <div>
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex justify-between items-center">
            <span>Visual Playbook — Banner Autenticado</span>
            <span className="text-[10px] text-slate-400 italic">Simulação GIF Integrada</span>
          </h5>
          <BannerSimulador
            brand={pauta.marca}
            headline={pauta.copy.headlineBanner}
            subHeadline={pauta.copy.subHeadlineBanner}
            cta={pauta.copy.ctaBotao}
            mecanicaText={pauta.operacional.mecanicaEscolhida}
            recompensa={pauta.operacional.recompensaEscolhida}
            paleta={pauta.visual.paletaRecomendada}
            estiloIlustracao={pauta.visual.estiloIlustracao}
          />
        </div>}

      </div>

      {/* Accordions de Briefing Técnico Visual & Operacional */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        
        {/* Accordion Visual — oculto se Apenas Texto */}
        {tipoEfetivo !== 'texto' && <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-100">
          <button
            id={`btn-toggle-visual-${pauta.id}`}
            onClick={() => setShowVisualAccordion(!showVisualAccordion)}
            className="w-full text-left flex justify-between items-center font-bold text-xs text-slate-700 uppercase tracking-wider cursor-pointer"
          >
            <span>Briefing de Produção Visual</span>
            <span className="text-[11px] text-indigo-500 font-bold">{showVisualAccordion ? '▼ Recolher' : '▲ Expandir'}</span>
          </button>
          {showVisualAccordion && (
            <div className="mt-4 pt-4 border-t border-slate-200/60 flex flex-col gap-3 text-xs text-slate-600 animate-slide-down">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <strong className="text-slate-500 block">Formato:</strong>
                  <span>{pauta.visual.formato} (1:1 quadrado ideal)</span>
                </div>
                <div>
                  <strong className="text-slate-500 block">Paleta Cores:</strong>
                  <span className="flex items-center gap-1.5 mt-0.5">
                    {pauta.visual.paletaRecomendada.cores.map((c, i) => (
                      <span 
                        key={i} 
                        className="w-4 h-4 rounded-full border border-slate-300" 
                        style={{ backgroundColor: c }} 
                        title={`${pauta.visual.paletaRecomendada.nome}: ${c}`}
                      />
                    ))}
                    <span className="text-[9px] font-mono font-bold text-slate-400 capitalize">{pauta.visual.paletaRecomendada.nome}</span>
                  </span>
                </div>
              </div>
              <hr className="border-slate-200/40" />
              <div>
                <strong className="text-slate-500 block">Estilo Ilustração:</strong>
                <span>{pauta.visual.estiloIlustracao}</span>
              </div>
              <hr className="border-slate-200/40" />
              <div className="flex flex-col gap-1">
                <strong className="text-slate-500">Fluxo de Frames (GIF no Playbook):</strong>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-500 mt-0.5">
                  <li><strong>Estado Fechado (Frame F1):</strong> {pauta.visual.frameInicial}</li>
                  <li><strong>Frame de Ação (Frame F2):</strong> {pauta.visual.frameIntermediario}</li>
                  <li><strong>Estado Revelado (Frame F3):</strong> {pauta.visual.frameFinal}</li>
                </ul>
              </div>
              <hr className="border-slate-200/40" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <strong className="text-slate-500 block">Posicionamento CTA:</strong>
                  <span>{pauta.visual.posicaoCta}</span>
                </div>
                <div>
                  <strong className="text-slate-500 block">Filtro Tipográfico:</strong>
                  <span>{pauta.visual.tipografia}</span>
                </div>
              </div>
              <hr className="border-slate-200/40" />
              <div className="flex flex-col gap-2">
                <strong className="text-slate-500 flex items-center gap-1">
                  <Image className="w-3.5 h-3.5" />
                  Gerar Imagens dos Frames ({aspectRatio})
                </strong>
                <div className="flex flex-wrap gap-2">
                  {(['inicial', 'intermediario', 'final'] as const).map((frame) => {
                    const labels = { inicial: 'F1 — Fechado', intermediario: 'F2 — Ação', final: 'F3 — Revelação' };
                    const isGenerating = generatingFrame === frame;
                    const isDone = !!frameImages[frame];
                    return (
                      <button
                        key={frame}
                        type="button"
                        onClick={() => generateFrameImage(frame)}
                        disabled={generatingFrame !== null || isDone}
                        className={`text-[10px] font-bold px-3 py-2 rounded-lg border flex items-center gap-1 transition-colors cursor-pointer ${
                          isDone
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                            : isGenerating
                              ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed'
                              : isApice
                                ? 'bg-white border-[#688D65]/40 text-[#688D65] hover:bg-[#688D65]/5'
                                : 'bg-white border-[#BF0F26]/40 text-[#BF0F26] hover:bg-[#BF0F26]/5'
                        }`}
                      >
                        {isGenerating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Image className="w-3 h-3" />}
                        {isGenerating ? 'Gerando...' : isDone ? `${labels[frame]} ✓` : labels[frame]}
                      </button>
                    );
                  })}
                </div>
                {Object.entries(frameErrors).map(([frame, err]) => (
                  <p key={frame} className="text-[10px] text-rose-600 bg-rose-50 border border-rose-200 rounded px-2 py-1">
                    {frame === 'inicial' ? 'F1' : frame === 'intermediario' ? 'F2' : 'F3'}: {err}
                  </p>
                ))}
                {Object.entries(frameImages).map(([frame, src]) => (
                  <div key={frame} className="flex flex-col gap-1 mt-1">
                    <span className="text-[9px] uppercase font-bold text-slate-400">
                      {frame === 'inicial' ? 'F1 — Estado Fechado' : frame === 'intermediario' ? 'F2 — Ação' : 'F3 — Revelação'}
                    </span>
                    <img
                      src={src}
                      alt={`Frame ${frame}`}
                      className="rounded-lg border border-slate-200 max-w-full"
                      style={{ aspectRatio: aspectRatio.replace(':', '/') }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>}

        {/* Accordion Operacional */}
        <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-100">
          <button
            id={`btn-toggle-operacional-${pauta.id}`}
            onClick={() => setShowOperacionalAccordion(!showOperacionalAccordion)}
            className="w-full text-left flex justify-between items-center font-bold text-xs text-slate-700 uppercase tracking-wider cursor-pointer"
          >
            <span>Planejamento Operacional & Envio</span>
            <span className="text-[11px] text-indigo-500 font-bold">{showOperacionalAccordion ? '▼ Recolher' : '▲ Expandir'}</span>
          </button>
          {showOperacionalAccordion && (
            <div className="mt-4 pt-4 border-t border-slate-200/60 flex flex-col gap-3 text-xs text-slate-600 animate-slide-down">
              <div>
                <strong className="text-slate-500 block">Mecânica de Conversão Selecionada:</strong>
                <span className="font-semibold text-slate-805 text-sm">{pauta.operacional.mecanicaEscolhida}</span>
              </div>
              <div>
                <strong className="text-slate-500 block mb-0.5">Embasamento e Justificativa Histórica:</strong>
                <p className="text-[11px] text-slate-550 leading-relaxed italic bg-white p-2.5 rounded-lg border border-slate-100">
                  "{pauta.operacional.justificativaMecanica}"
                </p>
              </div>
              <hr className="border-slate-200/40" />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <strong className="text-slate-500 block flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Dia Ideal:
                  </strong>
                  <span className="font-semibold text-emerald-700 uppercase tracking-wide">{pauta.operacional.diaRecomendado}</span>
                </div>
                <div>
                  <strong className="text-slate-500 block flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" /> Janela Ótima:
                  </strong>
                  <span className="font-semibold">{pauta.operacional.horarioRecomendado}</span>
                </div>
                <div>
                  <strong className="text-slate-500 block">Segmento:</strong>
                  <span className="font-semibold truncate block" title={pauta.operacional.segmentoRecomendado}>
                    {pauta.operacional.segmentoRecomendado}
                  </span>
                </div>
              </div>
              <hr className="border-slate-200/40" />
              <div>
                <strong className="text-slate-500 block">Recompensa Associada:</strong>
                <span className="font-bold text-[#BF0F26] uppercase">{pauta.operacional.recompensaEscolhida}</span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Estimativa de Performance baseada em Análise Histórica */}
      <div className="mt-6 bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-inner">
        {/* Background glow para o bloco de performance */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500 rounded-full blur-2xl opacity-10 pointer-events-none -ml-16 -mt-16"></div>

        <div className="relative z-10 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <h5 className="text-xs uppercase font-extrabold tracking-widest text-[#AA834B]">
              Intervalo de Previsão de Performance Projetada
            </h5>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-mono">
            <div>
              <span className="text-slate-400">Abertura: </span>
              <strong className="text-emerald-400 text-sm font-bold">{pauta.previsao.aberturaEsperada}</strong>
            </div>
            <div>
              <span className="text-slate-400">CTOR: </span>
              <strong className="text-emerald-400 text-sm font-bold">{pauta.previsao.ctorEsperado}</strong>
            </div>
            <div>
              <span className="text-slate-400">Receita Est.: </span>
              <strong className="text-emerald-400 text-sm font-bold">{pauta.previsao.receitaEsperada}</strong>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2.5 leading-relaxed max-w-xl">
            Projeção tática real calculada com base científica usando como semelhança estatística de similaridade os históricos de hits reais:{" "}
            <span className="font-mono font-bold text-slate-300">
              {pauta.previsao.casesReferencia.join(", ") || "Sem cases suficientes"}
            </span>.
          </p>
        </div>

        <div className="shrink-0 relative z-10 text-right flex flex-col items-end gap-1.5">
          <span className={`px-2.5 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${
            pauta.previsao.confianca === 'alta' 
              ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800' 
              : 'bg-amber-900/40 text-amber-400 border border-amber-800 animate-pulse'
          }`}>
            Confiança: {pauta.previsao.confianca.toUpperCase()}
          </span>
          {pauta.previsao.confianca === 'baixa' && (
            <span className="text-[9px] text-amber-500 font-semibold max-w-[150px] leading-snug">
              Sem dados suficientes no banco de hits. Recomenda-se rodar teste piloto A/B inicialmente.
            </span>
          )}
        </div>
      </div>

      {/* Ações da Pauta */}
      <div className="mt-8 flex flex-wrap justify-between items-center gap-4 pt-6 border-t border-slate-100">
        <div className="flex gap-2.5">
          {pauta.status === 'rascunho' && (
            <>
              <button
                id={`btn-approve-${pauta.id}`}
                onClick={() => onApprove(pauta.id)}
                className="bg-emerald-600 hover:bg-emerald-705 text-white shadow-lg shadow-emerald-600/10 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer hover:-translate-y-0.5 transition-all"
              >
                <ThumbsUp className="w-4 h-4" />
                Aprovar Pauta
              </button>
              <button
                id={`btn-discard-${pauta.id}`}
                onClick={() => onDiscard(pauta.id)}
                className="bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-600 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <XOctagon className="w-4 h-4" />
                Descartar
              </button>
            </>
          )}

          {pauta.status === 'aprovado' && (
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs bg-emerald-50 px-4 py-3 border border-emerald-200 rounded-xl relative select-none">
              <Check className="w-4 h-4" />
              Esta pauta está aprovada e pronta para envio na plataforma CRM!
            </div>
          )}

          {pauta.status === 'descartado' && (
            <button
              id={`btn-re-approve-${pauta.id}`}
              onClick={() => onApprove(pauta.id)}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar Rascunho
            </button>
          )}
        </div>

        <div className="flex gap-2 text-slate-700 flex-wrap">
          {/* Universal mockup and download buttons */}
          <button
            id={`btn-preview-modal-trigger-${pauta.id}`}
            onClick={() => onOpenPreview(pauta)}
            className="bg-indigo-650 hover:bg-indigo-750 bg-indigo-600 text-white shadow-md shadow-indigo-600/10 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer hover:-translate-y-0.5 transition-all"
            title="Visualizar mockup e download da arte"
          >
            <Eye className="w-4 h-4" />
            Visualizar Mockup
          </button>

          <button
            id={`btn-download-pauta-briefing-${pauta.id}`}
            onClick={() => {
              const text = generatePautaBriefingText(pauta);
              const idStr = pauta.id.split('-')[1] || pauta.id;
              downloadFile(`pauta_crm_${pauta.marca.toLowerCase()}_${idStr}.txt`, text);
            }}
            className="bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors shadow"
            title="Baixar redação e parâmetros técnicos"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            Baixar Pauta
          </button>

          {pauta.status === 'rascunho' && (
            <>
              <button
                id={`btn-edit-pauta-${pauta.id}`}
                onClick={() => onEdit(pauta.id as any)}
                className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold px-3 py-3 rounded-xl text-xs uppercase cursor-pointer flex items-center gap-1 transition-colors"
                title="Voltar para edição"
              >
                Editar
              </button>

              <button
                id={`btn-variation-${pauta.id}`}
                onClick={handleVariationClick}
                disabled={loadingVariation}
                className={`border text-[10px] font-extrabold uppercase px-3 py-3 rounded-xl transition-all duration-300 flex items-center gap-1 cursor-pointer ${
                  loadingVariation 
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed border-slate-300' 
                    : isApice
                      ? 'border-[#688D65]/50 hover:bg-[#688D65]/5 text-[#688D65]' 
                      : 'border-[#BF0F26]/50 hover:bg-[#BF0F26]/5 text-[#BF0F26]'
                }`}
              >
                {loadingVariation ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Modificando...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5" />
                    Variação IA
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

    </div>
  );
}
