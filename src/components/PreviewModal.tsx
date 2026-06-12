import { useState, useEffect, useRef } from "react";
import { PautaGerada, PautaCopy } from "../types";
import { X, Download, FileText, Code, Check, Sparkles, Database, Edit3, Clipboard, HelpCircle, AlertTriangle } from "lucide-react";
import BannerSimulador from "./BannerSimulador";
import { downloadFile, generatePautaBriefingText, generateInteractiveHtmlBanner } from "../utils";

interface PreviewModalProps {
  pauta: PautaGerada;
  onClose: () => void;
  onUpdatePauta?: (updated: PautaGerada) => void;
  frameImages: Record<string, string>;
  onFrameGenerated: (pautaId: string, frameName: string, imageData: string, publicUrl?: string) => void;
  aspectRatio: string;
  imageModel: string;
  referenciaImagem?: string | null;
}

export default function PreviewModal({
  pauta,
  onClose,
  onUpdatePauta,
  frameImages,
  onFrameGenerated,
  aspectRatio,
  imageModel,
  referenciaImagem,
}: PreviewModalProps) {
  const [activeTab, setActiveTab] = useState<'visual' | 'edit'>('visual');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [frameErrors, setFrameErrors] = useState<Record<string, string>>({});
  const [generatingFrame, setGeneratingFrame] = useState<string | null>(null);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const autoGenStarted = useRef(false);

  useEffect(() => {
    setActivePreviewIndex(0);
  }, [pauta.id]);

  useEffect(() => {
    if (Object.keys(frameImages).length < 2) return;
    const iv = setInterval(() => {
      setActivePreviewIndex(prev => {
        const total = Object.keys(frameImages).length;
        return (prev + 1) % total;
      });
    }, 700);
    return () => clearInterval(iv);
  }, [Object.keys(frameImages).length]);

  const isApice = pauta.marca === 'Apice';

  const generateFrameImage = async (
    frameIndex: number,
    referenceFrameUrl?: string,
  ): Promise<string | null> => {
    if (!pauta.visual) return null;

    const framesArray = pauta.visual.frames ?? [
      pauta.visual.frameInicial ?? '',
      pauta.visual.frameIntermediario ?? '',
      pauta.visual.frameFinal ?? '',
    ].filter(Boolean);

    const frameDescription = framesArray[frameIndex] ?? '';
    const frameName = `frame_${frameIndex}`;

    setGeneratingFrame(frameName);
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameName,
          frameIndex,
          totalFrames: framesArray.length,
          frameDescription,
          aspectRatio,
          marca: pauta.marca,
          pautaId: pauta.id,
          imageModel,
          estiloIlustracao: pauta.visual?.estiloIlustracao,
          paleta: pauta.visual?.paletaRecomendada,
          mecanica: pauta.operacional.mecanicaEscolhida,
          recompensa: pauta.operacional.recompensaEscolhida ?? pauta.copy.subHeadlineBanner,
          referenciaImagem: referenciaImagem ?? undefined,
          headline: pauta.copy.headlineBanner,
          subheadline: pauta.copy.subHeadlineBanner,
          cta: pauta.copy.ctaBotao,
          referenceFrameUrl,
          direcionamento: (pauta as any).inputOriginal?.direcionamento ?? '',
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        setFrameErrors(prev => ({ ...prev, [frameName]: (errData as any).error ?? `Erro ${response.status}` }));
        return null;
      }
      const data = await response.json();
      if (data.imageBytes) {
        const rawDataUrl = `data:${data.mimeType};base64,${data.imageBytes}`;
        let finalDataUrl = rawDataUrl;
        try {
          const { composeFrame } = await import('../utils/composeFrame');
          const inputOriginal = (pauta as any).inputOriginal;

          // Montar estiloVisual diretamente dos campos — sem depender do parse por IA
          const fonteEscolhida = inputOriginal?.fonteEscolhida || '';
          const estiloTexto = inputOriginal?.estiloVisualTexto;
          const direcionamento = inputOriginal?.direcionamento;
          const textoParaParse = estiloTexto || direcionamento;

          let estiloVisual: any = undefined;

          if (textoParaParse) {
            try {
              const estiloRes = await fetch('/api/parse-estilo-visual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  estiloVisualTexto: textoParaParse,
                  marca: pauta.marca,
                }),
              });
              estiloVisual = await estiloRes.json();
              console.log('[parse-estilo-visual] Estilo extraído:', estiloVisual);
            } catch {
              console.warn('[parse-estilo-visual] Falha, usando defaults');
            }
          }

          if (fonteEscolhida) {
            estiloVisual = {
              ...estiloVisual,
              familiaFonte: fonteEscolhida,
              corTexto: inputOriginal?.corTextoPrincipal || estiloVisual?.corTexto || '#FFFFFF',
              estiloBotao: (inputOriginal?.estiloBotaoEscolhido || estiloVisual?.estiloBotao || 'pill') as 'pill' | 'retangular' | 'outline',
              corBotao: estiloVisual?.corBotao, // preservar cor do botão extraída do parse
            };
          }

          // Garantir que a cor do botão nunca seja undefined — fallback para a cor da marca
          if (estiloVisual && !estiloVisual.corBotao) {
            estiloVisual.corBotao = pauta.marca === 'Apice' ? '#688D65' : '#BF0F26';
          }

          finalDataUrl = await composeFrame({
            imageDataUrl: rawDataUrl,
            headline: (inputOriginal?.headline || pauta.copy.headlineBanner) as string,
            subheadline: (inputOriginal?.subheadline || pauta.copy.subHeadlineBanner) as string,
            cta: (inputOriginal?.cta || pauta.copy.ctaBotao) as string,
            marca: pauta.marca as 'Apice' | 'Barbours',
            estiloVisual: {
              ...estiloVisual,
              familiaFonteSubheadline: inputOriginal?.fonteSubtitulo || estiloVisual?.familiaFonteSubheadline,
              corSubheadline: inputOriginal?.corSubtitulo || estiloVisual?.corSubheadline,
              familiaFonteBotao: estiloVisual?.familiaFonteBotao, // extraído do parse
            },
          });
        } catch (composeErr) {
          console.warn('[composeFrame] Falha, usando imagem pura:', composeErr);
        }
        onFrameGenerated(pauta.id, frameName, finalDataUrl, data.publicUrl ?? undefined);
        return finalDataUrl;
      } else {
        setFrameErrors(prev => ({ ...prev, [frameName]: data.error ?? 'Resposta inválida.' }));
        return null;
      }
    } catch {
      setFrameErrors(prev => ({ ...prev, [frameName]: 'Erro de rede.' }));
      return null;
    } finally {
      setGeneratingFrame(null);
    }
  };

  const gerarTodosFrames = async () => {
    setFrameErrors({});
    const framesArray = pauta.visual?.frames ?? [
      pauta.visual?.frameInicial ?? '',
      pauta.visual?.frameIntermediario ?? '',
      pauta.visual?.frameFinal ?? '',
    ].filter(Boolean);

    let previousUrl: string | undefined = undefined;
    for (let i = 0; i < framesArray.length; i++) {
      previousUrl = await generateFrameImage(i, previousUrl) ?? undefined;
    }
  };

  useEffect(() => {
    // Reset do ref quando muda de pauta
    autoGenStarted.current = false;
  }, [pauta.id]);

  useEffect(() => {
    const tipoEfetivo = pauta.tipoGeracao ?? 'texto_imagem';
    if (tipoEfetivo === 'texto') return;
    const framesArray = pauta.visual?.frames ?? [
      pauta.visual?.frameInicial,
      pauta.visual?.frameIntermediario,
      pauta.visual?.frameFinal,
    ].filter(Boolean);
    const jaTemFrames = framesArray.some((_, i) => !!frameImages[`frame_${i}`]);
    if (jaTemFrames) return;
    if (autoGenStarted.current) return;
    autoGenStarted.current = true;
    const timer = setTimeout(() => {
      gerarTodosFrames();
    }, 1000);
    return () => clearTimeout(timer);
  }, [pauta.id, JSON.stringify(Object.keys(frameImages))]); // eslint-disable-line react-hooks/exhaustive-deps

  // State local para edição em tempo real
  const [editedCopy, setEditedCopy] = useState<PautaCopy>({ ...pauta.copy });

  // Disparar atualização para o pai para que o BannerSimulador atualize ao digito
  const handleFieldChange = (key: keyof PautaCopy, value: string) => {
    const updatedCopy = { ...editedCopy, [key]: value };
    setEditedCopy(updatedCopy);
    
    if (onUpdatePauta) {
      onUpdatePauta({
        ...pauta,
        copy: updatedCopy
      });
    }
  };

  const notifyCopy = (fieldName: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const triggerDownloadTxt = () => {
    const text = generatePautaBriefingText(pauta);
    const idStr = pauta.id.split('-')[1] || pauta.id;
    downloadFile(`pauta_crm_${pauta.marca.toLowerCase()}_${idStr}.txt`, text);
  };

  const triggerDownloadHtml = () => {
    const htmlText = generateInteractiveHtmlBanner(pauta);
    const idStr = pauta.id.split('-')[1] || pauta.id;
    downloadFile(`mockup_crm_${pauta.marca.toLowerCase()}_${idStr}.html`, htmlText, "text/html");
  };

  const triggerDownloadJson = () => {
    const rawJson = JSON.stringify(pauta, null, 2);
    const idStr = pauta.id.split('-')[1] || pauta.id;
    downloadFile(`pauta_ia_config_${pauta.marca.toLowerCase()}_${idStr}.json`, rawJson, "application/json");
  };

  // Real-time Playbook Validation for the edited copywriting
  const validationAlerts: string[] = [];
  const minLen = isApice ? 27 : 16;
  const maxLen = isApice ? 47 : 39;
  const originalAssunto = editedCopy.assunto || "";

  if (originalAssunto === originalAssunto.toUpperCase() && originalAssunto.length > 5) {
    validationAlerts.push("⚠️ O assunto está totalmente em Caps Lock, infringindo as diretivas da marca.");
  }
  const forbiddenWords = ["%", "OFF", "GRÁTIS", "GRATIS", "R$"];
  forbiddenWords.forEach(w => {
    if (originalAssunto.toUpperCase().includes(w)) {
      validationAlerts.push(`⚠️ Termo proibido de entregabilidade detectado: "${w}". Isso aumentará as chances de ir para a caixa de Spam.`);
    }
  });
  if (originalAssunto.length < minLen || originalAssunto.length > maxLen) {
    validationAlerts.push(`⚠️ Comprimento do assunto (${originalAssunto.length} caracteres) fora da janela de impacto recomendada de ${minLen} a ${maxLen} caracteres.`);
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-md bg-slate-950/80 animate-fade-in text-left select-none"
      id="preview-popup-overlay"
    >
      <div 
        id="preview-popup-content-box"
        className="relative bg-slate-900 border border-slate-800 rounded-[2rem] w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col md:max-h-[90vh]"
      >
        {/* Banner Decorativo no Topo do Modal dependendo da marca */}
        <div 
          className="h-2.5 w-full shrink-0" 
          style={{ backgroundColor: isApice ? '#688D65' : '#BF0F26' }}
        ></div>

        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 border-b border-slate-800 bg-slate-900/90 z-10 shrink-0 gap-4">
          <div className="flex items-center gap-3">
            <span className={`p-2 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-300`}>
              <Sparkles className="w-5 h-5" />
            </span>
            <div className="text-left">
              <span className="text-[10px] font-black tracking-widest text-[#AA834B] uppercase block">
                Visualização de Disparo Ativo
              </span>
              <h2 className="text-lg font-bold text-slate-100">
                Pauta CRM de {pauta.marca}
              </h2>
            </div>
          </div>
          
          {/* Seletor de Sub-Abas de Edição Rápida */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-950 rounded-xl p-1 border border-slate-800 flex text-xs">
              <button
                id="btn-tab-preview-visual"
                onClick={() => setActiveTab('visual')}
                className={`px-3 py-1.5 rounded-lg font-bold tracking-wider uppercase transition-all cursor-pointer ${
                  activeTab === 'visual'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Visualizar Mockup
              </button>
              <button
                id="btn-tab-preview-editor"
                onClick={() => setActiveTab('edit')}
                className={`px-3 py-1.5 rounded-lg font-bold tracking-wider uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'edit'
                    ? 'bg-indigo-650 text-indigo-200'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                style={{ backgroundColor: activeTab === 'edit' ? '#4f46e5' : '' }}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar Copy
              </button>
            </div>

            <button 
              onClick={onClose}
              id="close-popup-btn"
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              title="Fechar Visualização"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Coluna Esquerda: Simulador Animado da Pauta */}
            <div className="lg:col-span-5 flex flex-col gap-4 text-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">
                Visualização do GIF de E-mail CRM
              </span>

              {/* Erro de geração */}
              {Object.keys(frameErrors).length > 0 && (
                <div className="text-xs text-rose-400 bg-rose-900/20 border border-rose-800 rounded-xl px-3 py-2 mb-2 text-left">
                  {Object.entries(frameErrors).map(([f, err]) => (
                    <p key={f}>{f}: {err}</p>
                  ))}
                </div>
              )}

              {/* Visualização do GIF */}
              {Object.keys(frameImages).length > 0 ? (
                <div className="relative w-full rounded-2xl overflow-hidden border border-slate-700 mb-2">
                  <img
                    src={frameImages[`frame_${activePreviewIndex}`] ?? frameImages[Object.keys(frameImages).sort()[0]]}
                    alt="Frame gerado"
                    className="w-full object-cover rounded-2xl"
                  />
                  {generatingFrame && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-2xl">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-4 border-slate-400 border-t-emerald-400 rounded-full animate-spin" />
                        <span className="text-white text-sm font-bold animate-pulse">
                          Gerando frame {generatingFrame}...
                        </span>
                      </div>
                    </div>
                  )}
                  {Object.keys(frameImages).length > 1 && (
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                      {Object.keys(frameImages).sort().map((key, i) => (
                        <button
                          key={key}
                          onClick={() => setActivePreviewIndex(i)}
                          className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                            activePreviewIndex === i ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/70'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {generatingFrame && (
                    <div className="w-full rounded-2xl border border-slate-700 bg-slate-800 flex flex-col items-center justify-center py-12 mb-4 gap-3">
                      <div className="w-8 h-8 border-4 border-slate-600 border-t-emerald-500 rounded-full animate-spin" />
                      <span className="text-sm text-slate-400 font-medium">
                        Gerando frames do GIF... ({generatingFrame})
                      </span>
                    </div>
                  )}
                  <BannerSimulador
                    brand={pauta.marca}
                    headline={editedCopy.headlineBanner}
                    subHeadline={editedCopy.subHeadlineBanner}
                    cta={editedCopy.ctaBotao}
                    mecanicaText={pauta.operacional.mecanicaEscolhida}
                    recompensa={pauta.operacional.recompensaEscolhida}
                    paleta={pauta.visual?.paletaRecomendada ?? { nome: '', cores: [] }}
                    estiloIlustracao={pauta.visual?.estiloIlustracao}
                    frameImages={{}}
                  />
                </>
              )}
            </div>

            {/* Coluna Direita: Informações Gerais dependendo da Tab selecionada */}
            <div className="lg:col-span-7 flex flex-col gap-6 text-left">
              
              {activeTab === 'visual' ? (
                <>
                  {/* Bloco de Copy Estático com Botão de Cópia Unificada */}
                  <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-xs uppercase font-extrabold tracking-widest text-[#AA834B] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Redação e Textos Ativos do Email
                      </h4>
                      <span className="text-[10px] text-slate-500 font-bold leading-none">clique no ícone para copiar</span>
                    </div>
                    
                    <div className="flex flex-col gap-3.5 text-xs">
                      
                      {/* Assunto */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-slate-400 font-bold">Assunto do E-mail</span>
                          <button
                            id="btn-copy-subject"
                            onClick={() => notifyCopy('assunto', editedCopy.assunto)}
                            className="p-1 text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"
                            title="Copiar Assunto"
                          >
                            {copiedField === 'assunto' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                            <span className="text-[9px] uppercase font-bold">{copiedField === 'assunto' ? 'Copiado!' : 'Copiar'}</span>
                          </button>
                        </div>
                        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 font-semibold leading-relaxed">
                          {editedCopy.assunto}
                        </div>
                      </div>

                      {/* PréHeader */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-slate-400 font-bold">Pré-Header Fixo (Inviolável)</span>
                          <button
                            id="btn-copy-preheader"
                            onClick={() => notifyCopy('preheader', editedCopy.preHeader)}
                            className="p-1 text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"
                            title="Copiar Préheader"
                          >
                            {copiedField === 'preheader' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                            <span className="text-[9px] uppercase font-bold">{copiedField === 'preheader' ? 'Copiado!' : 'Copiar'}</span>
                          </button>
                        </div>
                        <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl text-slate-400 font-medium italic">
                          "{editedCopy.preHeader}"
                        </div>
                      </div>

                      {/* Banner Text metrics */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-slate-400 font-bold">Headline da Arte</span>
                            <button
                              id="btn-copy-headline"
                              onClick={() => notifyCopy('headlineBanner', editedCopy.headlineBanner)}
                              className="p-1 text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Copiar Headline"
                            >
                              {copiedField === 'headlineBanner' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                              <span className="text-[9px] uppercase font-bold">{copiedField === 'headlineBanner' ? 'Copiado!' : 'Copiar'}</span>
                            </button>
                          </div>
                          <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 font-bold uppercase truncate" title={editedCopy.headlineBanner}>
                            {editedCopy.headlineBanner}
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-slate-400 font-bold">Botão CTA</span>
                            <button
                              id="btn-copy-cta"
                              onClick={() => notifyCopy('ctaBotao', editedCopy.ctaBotao)}
                              className="p-1 text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Copiar CTA"
                            >
                              {copiedField === 'ctaBotao' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                              <span className="text-[9px] uppercase font-bold">{copiedField === 'ctaBotao' ? 'Copiado!' : 'Copiar'}</span>
                            </button>
                          </div>
                          <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-amber-400 font-semibold text-center font-mono">
                            {editedCopy.ctaBotao}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </>
              ) : (
                /* Aba de Edição direta em tempo real (Point 2) */
                <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 flex flex-col gap-4 animate-fade-in">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs uppercase font-extrabold tracking-widest text-[#AA834B] flex items-center gap-1.5 animate-pulse">
                      <Edit3 className="w-4 h-4 text-indigo-400" />
                      Editor de Copywriting do Copilot (Tempo Real)
                    </h4>
                    <span className="text-[10px] bg-slate-900 font-bold text-slate-400 px-2 py-1 rounded">Visualização se atualiza ao vivo</span>
                  </div>

                  <p className="text-xs text-slate-400 leading-normal mb-1">
                    Ajuste os textos abaixo para calibrar o mockup do email. Suas edições atualizam a imagem e o arquivo de download automaticamente!
                  </p>

                  <div className="flex flex-col gap-4 text-xs">
                    
                    {/* Campo Assunto */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between font-bold">
                        <label className="text-slate-300">Assunto do E-mail</label>
                        <span className={`text-[10px] ${
                          originalAssunto.length > maxLen || originalAssunto.length < minLen 
                            ? 'text-amber-400' 
                            : 'text-emerald-300'
                        }`}>
                          {originalAssunto.length} / {maxLen} caract.
                        </span>
                      </div>
                      <input
                        type="text"
                        id="input-inline-editor-assunto"
                        value={editedCopy.assunto}
                        onChange={(e) => handleFieldChange('assunto', e.target.value)}
                        className="p-3 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl focus:border-indigo-500 text-slate-100 font-semibold outline-none transition-all"
                        placeholder="Digite o assunto..."
                      />
                    </div>

                    {/* Campo Pré-Header Fixo Aviso */}
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400 font-bold">Pré-Header Fixo (Inviolável / Não editável)</label>
                      <input
                        type="text"
                        disabled
                        value={editedCopy.preHeader}
                        className="p-3 bg-slate-900/40 border border-slate-800 text-slate-500 rounded-xl italic cursor-not-allowed leading-relaxed"
                      />
                      <span className="text-[9px] text-slate-500 tracking-wide font-medium">Assegura o maior fluxo de abertura do playbook por curiosidade móvel</span>
                    </div>

                    {/* Grid Headline Banner e CTA */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      <div className="flex flex-col gap-1">
                        <label className="text-slate-300 font-bold">Headline do Banner</label>
                        <input
                          type="text"
                          id="input-inline-editor-headline"
                          value={editedCopy.headlineBanner}
                          onChange={(e) => handleFieldChange('headlineBanner', e.target.value)}
                          className="p-3 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl focus:border-indigo-500 text-white font-extrabold outline-none transition-all uppercase"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-slate-300 font-bold">Verbo CTA do Botão</label>
                        <input
                          type="text"
                          id="input-inline-editor-cta"
                          value={editedCopy.ctaBotao}
                          onChange={(e) => handleFieldChange('ctaBotao', e.target.value)}
                          className="p-3 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl focus:border-indigo-500 text-amber-300 font-black tracking-widest font-mono text-center outline-none transition-all uppercase"
                        />
                      </div>

                    </div>

                    {/* Sub-headline do banner */}
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-300 font-bold">Sub-headline Detalhes da Oferta</label>
                      <input
                        type="text"
                        id="input-inline-editor-subheadline"
                        value={editedCopy.subHeadlineBanner}
                        onChange={(e) => handleFieldChange('subHeadlineBanner', e.target.value)}
                        className="p-3 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl focus:border-indigo-500 text-slate-200 font-bold outline-none transition-all"
                      />
                    </div>

                    {/* Alertas de validação instantâneos */}
                    {validationAlerts.length > 0 && (
                      <div className="mt-2 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex flex-col gap-1.5 text-amber-300 transition-all">
                        <span className="font-extrabold flex items-center gap-1.5 uppercase text-[10px] tracking-wider leading-none">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          Calibração de Regras Invioláveis do CRM
                        </span>
                        <div className="flex flex-col gap-1 font-semibold leading-relaxed">
                          {validationAlerts.map((alertMessage, i) => (
                            <p key={i} className="text-[10px]">{alertMessage}</p>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )}

              {/* Bloco de Metadados Críticos */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl text-xs">
                  <span className="text-slate-500 uppercase font-bold tracking-wider block mb-1">Mecânica Operacional</span>
                  <span className="font-extrabold text-slate-200 text-sm block truncate">{pauta.operacional.mecanicaEscolhida}</span>
                  <span className="text-[10px] text-slate-400 block mt-1">Recompensa: {pauta.operacional.recompensaEscolhida}</span>
                </div>
                
                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl text-xs">
                  <span className="text-slate-500 uppercase font-bold tracking-wider block mb-1">Performance Esperada</span>
                  <span className="font-extrabold text-emerald-400 text-sm block">Receita: {pauta.previsao.receitaEsperada}</span>
                  <span className="text-[10px] text-slate-400 block mt-1">Abertura: {pauta.previsao.aberturaEsperada}</span>
                </div>
              </div>

              {/* Central de Exportação e Downloads (Point 3) */}
              <div className="bg-[#AA834B]/5 border border-[#AA834B]/20 p-5 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <Download className="w-4 h-4 text-[#AA834B]" />
                  <h4 className="text-xs uppercase font-extrabold tracking-widest text-[#AA834B]">
                    Central de Exportação e Download
                  </h4>
                </div>

                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Baixe a pauta de CRM para integrá-la às suas plataformas de envio de email ou encaminhe os briefings de layouts criados diretamente para sua equipe de design!
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Botão de download do Briefing de texto */}
                  <button
                    id="download-briefing-txt-btn-modal"
                    onClick={triggerDownloadTxt}
                    className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-750 shadow"
                  >
                    <FileText className="w-4 h-4 text-emerald-400" />
                    Baixar Briefing (TXT)
                  </button>

                  {/* Botão de download da Arte Interativa em HTML */}
                  <button
                    id="download-mockup-html-btn-modal"
                    onClick={triggerDownloadHtml}
                    className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow"
                  >
                    <Code className="w-4 h-4 text-amber-200" />
                    Baixar Arte (HTML)
                  </button>

                  {/* Botão de download do JSON */}
                  <button
                    id="download-pauta-json-btn-modal"
                    onClick={triggerDownloadJson}
                    className="py-3 px-4 bg-slate-950/60 hover:bg-slate-900 text-slate-400 hover:text-slate-250 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-850"
                    title="Exportar Configuração raw em JSON"
                  >
                    <Database className="w-4 h-4" />
                    JSON
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 p-6 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            id="close-popup-footer-btn"
            className="py-2.5 px-6 bg-slate-800 hover:bg-slate-700 text-slate-350 hover:text-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Fechar Visualização
          </button>
        </div>

      </div>
    </div>
  );
}
