import { useState, useEffect, useRef } from "react";
import { PautaGerada, PautaCopy } from "../types";
import { X, Download, FileText, Check, Sparkles, Edit3, Clipboard, HelpCircle, AlertTriangle, RefreshCw, PenLine } from "lucide-react";
import BannerSimulador from "./BannerSimulador";
import { downloadFile, generatePautaBriefingText } from "../utils";
import { resolveCanvasSize, resolveHeadlineSizePx, resolveSubheadlineSizePx, loadFont } from "../utils/composeFrame";
import { loadGifshot } from "../utils/loadGifshot";

function SliderRow({
  label, value, min, max, step, unit, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-300 font-semibold">{label}</span>
        <span className="text-slate-400 font-mono">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-indigo-500 cursor-pointer"
      />
    </div>
  );
}

interface PreviewModalProps {
  pauta: PautaGerada;
  initialTab?: 'visual' | 'edit';
  onClose: () => void;
  onUpdatePauta?: (updated: PautaGerada) => void;
  frameImages: Record<string, string>;
  onFrameGenerated: (pautaId: string, frameName: string, imageData: string, publicUrl?: string) => void;
  aspectRatio: string;
  imageModel: string;
  referenciaImagem?: string | null;
  referenciasImagem?: string[];
  onCanStartGenerating: (pautaId: string) => boolean;
  onFinishedGenerating: (pautaId: string) => void;
}

export default function PreviewModal({
  pauta,
  initialTab,
  onClose,
  onUpdatePauta,
  frameImages,
  onFrameGenerated,
  aspectRatio,
  imageModel,
  referenciaImagem,
  referenciasImagem,
  onCanStartGenerating,
  onFinishedGenerating,
}: PreviewModalProps) {
  const [activeTab, setActiveTab] = useState<'visual' | 'edit'>(initialTab ?? 'visual');
  const [reajustandoCopy, setReajustandoCopy] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [frameErrors, setFrameErrors] = useState<Record<string, string>>({});
  const [generatingFrame, setGeneratingFrame] = useState<string | null>(null);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const autoGenStarted = useRef(false);

  // Prévia ao vivo (aba de edição): imagem crua (sem texto) + camada de overlay posicionada
  // via CSS, escalada pra bater com o tamanho real do canvas usado no composeFrame.
  const [rawPreviewFailed, setRawPreviewFailed] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewWidthPx, setPreviewWidthPx] = useState(400);

  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setPreviewWidthPx(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeTab]);

  // Usa o aspect ratio gravado nesta pauta (o que foi usado pra gerar as imagens dela),
  // não o seletor global — que pode ter mudado desde a geração e faria o recompose/GIF
  // usar dimensões diferentes das imagens já geradas, "achatando" o resultado.
  const pautaAspectRatio = (pauta as any).aspectRatio || aspectRatio;
  const [canvasWidthPx, canvasHeightPx] = resolveCanvasSize(pautaAspectRatio);
  const previewScale = previewWidthPx / canvasWidthPx;
  const previewCssAspectRatio = pautaAspectRatio.includes(':') ? pautaAspectRatio.replace(':', '/') : `${canvasWidthPx} / ${canvasHeightPx}`;

  const safeMarcaPreview = pauta.marca.toLowerCase().replace(/[^a-z0-9]/g, '');
  // Pautas do Agente (modo 'C') salvam os frames crus como inicial/intermediario/final, não
  // frame_0/frame_1/frame_2 (convenção do Modo A/B) — mesmo bug do handleReajustarCopy: sem
  // este mapeamento a prévia ao vivo tentava carregar um arquivo que não existe (404 silencioso,
  // <img> nunca troca de src sozinha) e a camada de texto CSS ficava desenhando por cima do
  // nada (ou da imagem já composta com texto, se ela for usada de fallback em outro lugar),
  // duplicando o texto na tela.
  const RAW_NAMES_AGENTE_PREVIEW = ['inicial', 'intermediario', 'final'];
  const rawPreviewSrc = (() => {
    const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL as string) || '';
    if (!SUPABASE_URL) return undefined;
    const rawFileName = pauta.modo === 'C'
      ? (RAW_NAMES_AGENTE_PREVIEW[activePreviewIndex] ?? `frame_${activePreviewIndex}`)
      : `frame_${activePreviewIndex}`;
    return `${SUPABASE_URL}/storage/v1/object/public/campaign-images/${safeMarcaPreview}/${pauta.id}/${rawFileName}.png`;
  })();

  useEffect(() => {
    setRawPreviewFailed(false);
  }, [activePreviewIndex, pauta.id]);

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
    referenceFrameUrls?: string[],
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
          aspectRatio: pautaAspectRatio,
          marca: pauta.marca,
          pautaId: pauta.id,
          imageModel,
          estiloIlustracao: pauta.visual?.estiloIlustracao,
          paleta: pauta.visual?.paletaRecomendada,
          mecanica: pauta.operacional.mecanicaEscolhida,
          recompensa: pauta.operacional.recompensaEscolhida ?? pauta.copy.subHeadlineBanner,
          referenciaImagem: referenciaImagem ?? undefined,
          referenciasImagem: referenciasImagem ?? [],
          headline: pauta.copy.headlineBanner,
          subheadline: pauta.copy.subHeadlineBanner,
          cta: pauta.copy.ctaBotao,
          referenceFrameUrls: referenceFrameUrls ?? [],
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

          if (fonteEscolhida || inputOriginal?.corBotaoEscolhida || inputOriginal?.fonteBotao || inputOriginal?.corTextoBotao) {
            estiloVisual = {
              ...estiloVisual,
              familiaFonte: fonteEscolhida || estiloVisual?.familiaFonte,
              corTexto: inputOriginal?.corTextoPrincipal || estiloVisual?.corTexto || '#FFFFFF',
              estiloBotao: (inputOriginal?.estiloBotaoEscolhido || estiloVisual?.estiloBotao || 'pill') as 'pill' | 'retangular' | 'outline',
              corBotao: inputOriginal?.corBotaoEscolhida || estiloVisual?.corBotao,
              corTextoBotao: inputOriginal?.corTextoBotao || estiloVisual?.corTextoBotao,
              familiaFonteBotao: inputOriginal?.fonteBotao || estiloVisual?.familiaFonteBotao,
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
            aspectRatio: pautaAspectRatio,
            estiloVisual: {
              ...estiloVisual,
              familiaFonteSubheadline: inputOriginal?.fonteSubtitulo || estiloVisual?.familiaFonteSubheadline,
              corSubheadline: inputOriginal?.corSubtitulo || estiloVisual?.corSubheadline,
              familiaFonteBotao: inputOriginal?.fonteBotao || estiloVisual?.familiaFonteBotao,
              corTextoBotao: inputOriginal?.corTextoBotao || estiloVisual?.corTextoBotao,
              headlineTopPercent: inputOriginal?.headlineTopPercent,
              headlineSizePx: inputOriginal?.headlineSizePx,
              subheadlineTopPercent: inputOriginal?.subheadlineTopPercent,
              subheadlineSizePx: inputOriginal?.subheadlineSizePx,
              buttonTopPercent: inputOriginal?.buttonTopPercent,
              buttonWidthPercent: inputOriginal?.buttonWidthPercent,
              buttonHeightPercent: inputOriginal?.buttonHeightPercent,
              buttonFontSizePx: inputOriginal?.buttonFontSizePx,
            },
          });
        } catch (composeErr) {
          console.warn('[composeFrame] Falha, usando imagem pura:', composeErr);
        }
        // Salvar imagem com texto no Storage (sobrescrever a imagem pura do PiApp)
        let urlFinal = data.publicUrl ?? undefined;
        try {
          const saveRes = await fetch('/api/save-frame', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pautaId: pauta.id,
              frameName,
              imageDataUrl: finalDataUrl,
            }),
          });
          if (saveRes.ok) {
            const { publicUrl: savedUrl } = await saveRes.json();
            if (savedUrl) urlFinal = savedUrl;
          }
        } catch (saveErr) {
          console.warn('[save-frame] Falha ao salvar imagem composta:', saveErr);
        }
        onFrameGenerated(pauta.id, frameName, finalDataUrl, urlFinal);
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

    // Envia o frame 1 (master, trava zoom/composição) + o frame imediatamente anterior
    // (mantém a continuidade do objeto) como referências.
    let masterUrl: string | undefined = undefined;
    let previousUrl: string | undefined = undefined;
    for (let i = 0; i < framesArray.length; i++) {
      const refs = Array.from(new Set([masterUrl, previousUrl].filter(Boolean) as string[]));
      const result = await generateFrameImage(i, refs.length > 0 ? refs : undefined);
      if (i === 0) masterUrl = result ?? undefined;
      previousUrl = result ?? previousUrl;
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
    // Só pula se os frames são válidos (base64 real, não URL quebrada)
    const jaTemFramesValidos = framesArray.every((_, i) => {
      const img = frameImages[`frame_${i}`];
      return img && img.startsWith('data:image');
    });
    if (jaTemFramesValidos) return;
    if (autoGenStarted.current) return;

    // Só auto-gerar se a pauta foi criada há menos de 2 minutos (recém-gerada)
    const dataCriacao = new Date((pauta as any).dataCriacao ?? 0).getTime();
    const isPautaRecente = (Date.now() - dataCriacao) < 2 * 60 * 1000;
    if (!isPautaRecente) return;

    if (!onCanStartGenerating(pauta.id)) return;
    autoGenStarted.current = true;
    const timer = setTimeout(() => {
      gerarTodosFrames().finally(() => onFinishedGenerating(pauta.id));
    }, 1000);
    return () => clearTimeout(timer);
  }, [pauta.id, JSON.stringify(Object.keys(frameImages))]); // eslint-disable-line react-hooks/exhaustive-deps

  // State local para edição em tempo real
  const [editedCopy, setEditedCopy] = useState<PautaCopy>({ ...pauta.copy });

  // Posição/tamanho manuais do título, subtítulo e botão — null = usa o layout automático
  // padrão; um número só é setado quando o usuário mexe no slider correspondente.
  const inputOriginalPos = (pauta as any).inputOriginal ?? {};
  const [headlineTopPercent, setHeadlineTopPercent] = useState<number | null>(inputOriginalPos.headlineTopPercent ?? null);
  const [headlineSizePx, setHeadlineSizePx] = useState<number | null>(inputOriginalPos.headlineSizePx ?? null);
  const [subheadlineTopPercent, setSubheadlineTopPercent] = useState<number | null>(inputOriginalPos.subheadlineTopPercent ?? null);
  const [subheadlineSizePx, setSubheadlineSizePx] = useState<number | null>(inputOriginalPos.subheadlineSizePx ?? null);
  const [buttonTopPercent, setButtonTopPercent] = useState<number | null>(inputOriginalPos.buttonTopPercent ?? null);
  const [buttonWidthPercent, setButtonWidthPercent] = useState<number | null>(inputOriginalPos.buttonWidthPercent ?? null);
  const [buttonHeightPercent, setButtonHeightPercent] = useState<number | null>(inputOriginalPos.buttonHeightPercent ?? null);
  const [buttonFontSizePx, setButtonFontSizePx] = useState<number | null>(inputOriginalPos.buttonFontSizePx ?? null);

  const resetPosicaoTamanho = () => {
    setHeadlineTopPercent(null);
    setHeadlineSizePx(null);
    setSubheadlineTopPercent(null);
    setSubheadlineSizePx(null);
    setButtonTopPercent(null);
    setButtonWidthPercent(null);
    setButtonHeightPercent(null);
    setButtonFontSizePx(null);
  };

  // Tamanhos/posição efetivos da prévia CSS (aba "Editar Copy") — usam os MESMOS defaults do
  // composeFrame (canvas), em vez de valores fixos, senão a prévia mostra tamanho/posição
  // diferentes do resultado real assim que o headline muda de tamanho.
  const previewHeadlineSize = resolveHeadlineSizePx(headlineSizePx ?? undefined, inputOriginalPos.tamanhoHeadline);
  const previewSubheadlineSize = resolveSubheadlineSizePx(previewHeadlineSize, subheadlineSizePx ?? undefined);
  const previewHeadlineTopPercent = headlineTopPercent ?? 3.5;
  // Réplica do cálculo padrão do composeFrame pra 1 linha de headline: sY = hY + 12 + sSize,
  // onde hY = ZONA_TOP_PX + hSize. Aproximação (não simula quebra de linha), mas já acompanha
  // o tamanho real do headline e a altura real do canvas — antes era um percentual fixo (14%)
  // que só coincidia por acaso com proporções específicas.
  const previewSubheadlineTopPercent = subheadlineTopPercent ?? (
    ((previewHeadlineTopPercent / 100) * canvasHeightPx + previewHeadlineSize + 12) / canvasHeightPx * 100
  );

  // Famílias de fonte usadas na prévia CSS — resolvidas pelo mesmo loadFont() do composeFrame,
  // pra prévia bater com o resultado final em vez de cair no font-sans genérico do Tailwind.
  const [previewHeadlineFont, setPreviewHeadlineFont] = useState('Georgia, serif');
  const [previewSubheadlineFont, setPreviewSubheadlineFont] = useState('Georgia, serif');
  const [previewButtonFont, setPreviewButtonFont] = useState('Georgia, serif');

  useEffect(() => {
    let cancelado = false;
    const headlineRaw = inputOriginalPos.fonteEscolhida || (isApice ? 'Playfair Display' : 'Oswald');
    const subRaw = inputOriginalPos.fonteSubtitulo || (isApice ? 'Montserrat' : 'Inter');
    const btnRaw = inputOriginalPos.fonteBotao || subRaw;
    Promise.all([
      loadFont(headlineRaw, '900'),
      loadFont(subRaw, '600'),
      loadFont(btnRaw, '800'),
    ]).then(([h, s, b]) => {
      if (cancelado) return;
      setPreviewHeadlineFont(h);
      setPreviewSubheadlineFont(s);
      setPreviewButtonFont(b);
    });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pauta.id, inputOriginalPos.fonteEscolhida, inputOriginalPos.fonteSubtitulo, inputOriginalPos.fonteBotao, isApice]);

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

  // Redesenha os frames JÁ GERADOS com a copy editada, sem chamar a IA de imagem de novo —
  // busca a imagem crua (pré-texto) do PiApp no Storage e desenha o texto atual por cima.
  const handleReajustarCopy = async () => {
    const framesArray = pauta.visual?.frames ?? [
      pauta.visual?.frameInicial ?? '',
      pauta.visual?.frameIntermediario ?? '',
      pauta.visual?.frameFinal ?? '',
    ].filter(Boolean);
    const framesExistentes = framesArray.map((_, i) => `frame_${i}`).filter((fn) => !!frameImages[fn]);

    if (framesExistentes.length === 0) {
      alert('Gere ao menos um frame antes de reajustar a copy.');
      return;
    }

    setReajustandoCopy(true);
    try {
      const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL as string) || '';
      const safeMarca = pauta.marca.toLowerCase().replace(/[^a-z0-9]/g, '');
      const { composeFrame } = await import('../utils/composeFrame');
      const inputOriginal = (pauta as any).inputOriginal;

      // Mesma lógica de montagem de estiloVisual usada na geração original
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
            body: JSON.stringify({ estiloVisualTexto: textoParaParse, marca: pauta.marca }),
          });
          estiloVisual = await estiloRes.json();
        } catch { /* ignore, usa defaults */ }
      }
      if (fonteEscolhida || inputOriginal?.corBotaoEscolhida || inputOriginal?.fonteBotao || inputOriginal?.corTextoBotao) {
        estiloVisual = {
          ...estiloVisual,
          familiaFonte: fonteEscolhida || estiloVisual?.familiaFonte,
          corTexto: inputOriginal?.corTextoPrincipal || estiloVisual?.corTexto || '#FFFFFF',
          estiloBotao: (inputOriginal?.estiloBotaoEscolhido || estiloVisual?.estiloBotao || 'pill') as 'pill' | 'retangular' | 'outline',
          corBotao: inputOriginal?.corBotaoEscolhida || estiloVisual?.corBotao,
          corTextoBotao: inputOriginal?.corTextoBotao || estiloVisual?.corTextoBotao,
          familiaFonteBotao: inputOriginal?.fonteBotao || estiloVisual?.familiaFonteBotao,
        };
      }
      if (estiloVisual && !estiloVisual.corBotao) {
        estiloVisual.corBotao = pauta.marca === 'Apice' ? '#688D65' : '#BF0F26';
      }
      const estiloVisualFinal = {
        ...estiloVisual,
        familiaFonteSubheadline: inputOriginal?.fonteSubtitulo || estiloVisual?.familiaFonteSubheadline,
        corSubheadline: inputOriginal?.corSubtitulo || estiloVisual?.corSubheadline,
        familiaFonteBotao: inputOriginal?.fonteBotao || estiloVisual?.familiaFonteBotao,
        corTextoBotao: inputOriginal?.corTextoBotao || estiloVisual?.corTextoBotao,
        headlineTopPercent: headlineTopPercent ?? undefined,
        headlineSizePx: headlineSizePx ?? undefined,
        subheadlineTopPercent: subheadlineTopPercent ?? undefined,
        subheadlineSizePx: subheadlineSizePx ?? undefined,
        buttonTopPercent: buttonTopPercent ?? undefined,
        buttonWidthPercent: buttonWidthPercent ?? undefined,
        buttonHeightPercent: buttonHeightPercent ?? undefined,
        buttonFontSizePx: buttonFontSizePx ?? undefined,
      };

      // Pautas do Agente (modo 'C') salvam os frames crus como inicial/intermediario/final,
      // não frame_0/frame_1/frame_2 (convenção do Modo A/B) — sem este mapeamento o fetch da
      // imagem crua sempre dava 404 pra pautas do agente e a recomposição falhava silenciosa.
      const RAW_NAMES_AGENTE = ['inicial', 'intermediario', 'final'];
      let algumaFalha = false;
      for (const frameName of framesExistentes) {
        try {
          const frameIndex = Number(frameName.replace('frame_', ''));
          const rawFileName = pauta.modo === 'C' ? (RAW_NAMES_AGENTE[frameIndex] ?? frameName) : frameName;
          const rawUrl = `${SUPABASE_URL}/storage/v1/object/public/campaign-images/${safeMarca}/${pauta.id}/${rawFileName}.png`;
          const resp = await fetch(rawUrl);
          if (!resp.ok) throw new Error('imagem original não encontrada no Storage');
          const blob = await resp.blob();
          const rawDataUrl: string = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const finalDataUrl = await composeFrame({
            imageDataUrl: rawDataUrl,
            headline: editedCopy.headlineBanner,
            subheadline: editedCopy.subHeadlineBanner,
            cta: editedCopy.ctaBotao,
            marca: pauta.marca as 'Apice' | 'Barbours',
            aspectRatio: pautaAspectRatio,
            estiloVisual: estiloVisualFinal,
          });

          let urlFinal: string | undefined;
          try {
            const saveRes = await fetch('/api/save-frame', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pautaId: pauta.id, frameName, imageDataUrl: finalDataUrl }),
            });
            if (saveRes.ok) {
              const { publicUrl } = await saveRes.json();
              urlFinal = publicUrl;
            }
          } catch { /* mantém a versão local mesmo se salvar falhar */ }

          onFrameGenerated(pauta.id, frameName, finalDataUrl, urlFinal);
        } catch (err: any) {
          algumaFalha = true;
          console.warn(`[reajustarCopy] Falha no frame ${frameName}:`, err.message);
        }
      }

      // Salva a posição/tamanho escolhidos junto da pauta, pra lembrar da próxima vez
      if (onUpdatePauta) {
        onUpdatePauta({
          ...pauta,
          copy: editedCopy,
          inputOriginal: {
            ...inputOriginal,
            headlineTopPercent: headlineTopPercent ?? undefined,
            headlineSizePx: headlineSizePx ?? undefined,
            subheadlineTopPercent: subheadlineTopPercent ?? undefined,
            subheadlineSizePx: subheadlineSizePx ?? undefined,
            buttonTopPercent: buttonTopPercent ?? undefined,
            buttonWidthPercent: buttonWidthPercent ?? undefined,
            buttonHeightPercent: buttonHeightPercent ?? undefined,
            buttonFontSizePx: buttonFontSizePx ?? undefined,
          },
        } as any);
      }

      if (algumaFalha) {
        alert('Copy reajustada, mas alguns frames não puderam ser redesenhados (imagem original não encontrada).');
      }
    } catch (err: any) {
      console.error('[reajustarCopy] Erro:', err);
      alert('Erro ao reajustar a copy: ' + err.message);
    } finally {
      setReajustandoCopy(false);
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

  const framesArrayForGif = pauta.visual?.frames ?? [
    pauta.visual?.frameInicial ?? '',
    pauta.visual?.frameIntermediario ?? '',
    pauta.visual?.frameFinal ?? '',
  ].filter(Boolean);
  const framesGeradosForGif = framesArrayForGif
    .map((_, i) => frameImages[`frame_${i}`])
    .filter(Boolean) as string[];

  // Quantidade de frames a incluir no GIF final — permite baixar só os N primeiros
  // frames em vez de exigir o conjunto completo.
  const [gifFrameLimit, setGifFrameLimit] = useState<number | null>(null);
  const gifFramesSelecionados = Math.max(2, Math.min(gifFrameLimit ?? framesGeradosForGif.length, framesGeradosForGif.length));

  const downloadGifAnimado = async (frameCount?: number) => {
    const count = Math.max(2, Math.min(frameCount ?? gifFramesSelecionados, framesGeradosForGif.length));
    const framesParaGif = framesGeradosForGif.slice(0, count);
    if (framesParaGif.length === 0) {
      alert('Aguarde os frames serem gerados antes de baixar o GIF.');
      return;
    }
    try {
      const toBase64 = async (src: string): Promise<string> => {
        if (src.startsWith('data:')) return src;
        const response = await fetch(src);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };
      const framesBase64 = await Promise.all(framesParaGif.map(toBase64));
      const gifshot = await loadGifshot();
      const { resolveCanvasSize } = await import('../utils/composeFrame');
      const [rawW, rawH] = resolveCanvasSize(pautaAspectRatio);
      const scale = 600 / Math.max(rawW, rawH);
      const gifWidth = Math.round(rawW * scale);
      const gifHeight = Math.round(rawH * scale);

      gifshot.createGIF({
        images: framesBase64,
        gifWidth,
        gifHeight,
        interval: 0.7,
        numFrames: framesBase64.length,
        frameDuration: 1,
        sampleInterval: 10,
        numWorkers: 2,
      }, (obj: any) => {
        if (!obj.error) {
          const link = document.createElement('a');
          link.download = `${pauta.marca}-gif-animado.gif`;
          link.href = obj.image;
          link.click();
        } else {
          console.error('[downloadGifAnimado] gifshot error:', obj.error);
          framesBase64.forEach((src, i) => {
            const link = document.createElement('a');
            link.download = `${pauta.marca}-frame-${i + 1}.png`;
            link.href = src;
            link.click();
          });
        }
      });
    } catch (err: any) {
      console.error('[downloadGifAnimado] Erro:', err);
      alert('Erro ao gerar GIF: ' + err.message);
    }
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
                <div
                  ref={previewContainerRef}
                  className="relative w-full rounded-2xl overflow-hidden border border-slate-700 mb-2"
                  style={{ aspectRatio: previewCssAspectRatio }}
                >
                  <img
                    src={
                      activeTab === 'edit' && rawPreviewSrc && !rawPreviewFailed
                        ? rawPreviewSrc
                        : frameImages[`frame_${activePreviewIndex}`] ?? frameImages[Object.keys(frameImages).sort()[0]]
                    }
                    onError={() => setRawPreviewFailed(true)}
                    alt="Frame gerado"
                    className="w-full h-full object-cover rounded-2xl"
                  />

                  {/* Prévia ao vivo de posição/tamanho — só na aba de edição, some se a imagem crua não carregar */}
                  {activeTab === 'edit' && !rawPreviewFailed && (
                    <div className="absolute inset-0 pointer-events-none select-none">
                      <div
                        className="absolute inset-x-0 flex justify-center px-[6%] text-center"
                        style={{ top: `${previewHeadlineTopPercent}%` }}
                      >
                        <span
                          style={{
                            fontSize: `${previewHeadlineSize * previewScale}px`,
                            fontFamily: previewHeadlineFont,
                            fontWeight: 900,
                            color: (pauta as any).inputOriginal?.corTextoPrincipal || '#FFFFFF',
                            textShadow: '0 2px 8px rgba(0,0,0,0.65)',
                            lineHeight: 1.15,
                          }}
                        >
                          {(editedCopy.headlineBanner || 'HEADLINE').toUpperCase()}
                        </span>
                      </div>
                      <div
                        className="absolute inset-x-0 flex justify-center px-[8%] text-center"
                        style={{ top: `${previewSubheadlineTopPercent}%` }}
                      >
                        <span
                          style={{
                            fontSize: `${previewSubheadlineSize * previewScale}px`,
                            fontFamily: previewSubheadlineFont,
                            fontWeight: 600,
                            color: (pauta as any).inputOriginal?.corSubtitulo || 'rgba(255,255,255,0.90)',
                            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                            lineHeight: 1.2,
                          }}
                        >
                          {(editedCopy.subHeadlineBanner || 'sub-headline').toUpperCase()}
                        </span>
                      </div>
                      <div
                        className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
                        style={{
                          top: `${buttonTopPercent ?? 87.4}%`,
                          width: `${buttonWidthPercent ?? 52}%`,
                          height: `${buttonHeightPercent ?? 7.4}%`,
                          borderRadius: ((pauta as any).inputOriginal?.estiloBotaoEscolhido || 'pill') === 'retangular' ? '6px' : '999px',
                          backgroundColor: ((pauta as any).inputOriginal?.estiloBotaoEscolhido || 'pill') === 'outline'
                            ? 'transparent'
                            : ((pauta as any).inputOriginal?.corBotaoEscolhida || (isApice ? '#688D65' : '#BF0F26')),
                          border: ((pauta as any).inputOriginal?.estiloBotaoEscolhido || 'pill') === 'outline'
                            ? `2px solid ${(pauta as any).inputOriginal?.corBotaoEscolhida || (isApice ? '#688D65' : '#BF0F26')}`
                            : 'none',
                        }}
                      >
                        <span
                          style={{
                            fontSize: `${(buttonFontSizePx ?? 34) * previewScale}px`,
                            fontFamily: previewButtonFont,
                            fontWeight: 800,
                            color: (pauta as any).inputOriginal?.corTextoBotao || '#FFFFFF',
                            textTransform: 'uppercase',
                          }}
                        >
                          {editedCopy.ctaBotao || 'CTA'}
                        </span>
                      </div>
                    </div>
                  )}

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

                    {/* Posição e tamanho manuais do título, subtítulo e botão */}
                    <div className="mt-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-extrabold tracking-widest text-indigo-300">
                          Posição e Tamanho
                        </span>
                        <button
                          type="button"
                          onClick={resetPosicaoTamanho}
                          className="text-[10px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
                        >
                          Restaurar padrão
                        </button>
                      </div>

                      <SliderRow
                        label="Posição do Título"
                        value={previewHeadlineTopPercent}
                        min={0} max={30} step={0.5} unit="%"
                        onChange={setHeadlineTopPercent}
                      />
                      <SliderRow
                        label="Tamanho do Título"
                        value={previewHeadlineSize}
                        min={24} max={96} step={1} unit="px"
                        onChange={setHeadlineSizePx}
                      />
                      <SliderRow
                        label="Posição do Subtítulo"
                        value={previewSubheadlineTopPercent}
                        min={0} max={40} step={0.5} unit="%"
                        onChange={setSubheadlineTopPercent}
                      />
                      <SliderRow
                        label="Tamanho do Subtítulo"
                        value={previewSubheadlineSize}
                        min={12} max={48} step={1} unit="px"
                        onChange={setSubheadlineSizePx}
                      />
                      <SliderRow
                        label="Posição do Botão"
                        value={buttonTopPercent ?? 87.4}
                        min={50} max={95} step={0.5} unit="%"
                        onChange={setButtonTopPercent}
                      />
                      <SliderRow
                        label="Largura do Botão"
                        value={buttonWidthPercent ?? 52}
                        min={20} max={90} step={1} unit="%"
                        onChange={setButtonWidthPercent}
                      />
                      <SliderRow
                        label="Altura do Botão"
                        value={buttonHeightPercent ?? 7.4}
                        min={4} max={16} step={0.2} unit="%"
                        onChange={setButtonHeightPercent}
                      />
                      <SliderRow
                        label="Tamanho do Texto do Botão"
                        value={buttonFontSizePx ?? 34}
                        min={16} max={56} step={1} unit="px"
                        onChange={setButtonFontSizePx}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleReajustarCopy}
                      disabled={reajustandoCopy}
                      className={`mt-2 w-full py-3.5 rounded-2xl font-extrabold text-sm uppercase tracking-wider text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 ${
                        isApice ? 'bg-[#688D65] hover:bg-[#52704f]' : 'bg-[#BF0F26] hover:bg-[#990c1e]'
                      }`}
                    >
                      {reajustandoCopy ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Redesenhando frames...
                        </>
                      ) : (
                        <>
                          <PenLine className="w-4 h-4" />
                          Reajustar Copy
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-slate-500 text-center -mt-1">
                      Redesenha os frames já gerados com o texto acima, sem gerar imagem nova na IA.
                    </p>

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

                {framesGeradosForGif.length > 2 && (
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-3">
                    <span>Frames a incluir no GIF final</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setGifFrameLimit(Math.max(2, gifFramesSelecionados - 1))}
                        disabled={gifFramesSelecionados <= 2}
                        className="w-6 h-6 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
                      >
                        −
                      </button>
                      <span className="w-14 text-center font-mono text-slate-200">{gifFramesSelecionados} / {framesGeradosForGif.length}</span>
                      <button
                        type="button"
                        onClick={() => setGifFrameLimit(Math.min(framesGeradosForGif.length, gifFramesSelecionados + 1))}
                        disabled={gifFramesSelecionados >= framesGeradosForGif.length}
                        className="w-6 h-6 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
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

                  {/* Botão de download do GIF animado */}
                  <button
                    id="download-gif-btn-modal"
                    onClick={() => downloadGifAnimado()}
                    className={`flex-1 py-3 px-4 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow ${
                      isApice ? 'bg-[#688D65] hover:bg-[#52704f]' : 'bg-[#BF0F26] hover:bg-[#990c1e]'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                    Baixar GIF Animado{gifFramesSelecionados > 0 ? ` (${gifFramesSelecionados}${gifFramesSelecionados < framesGeradosForGif.length ? ` de ${framesGeradosForGif.length}` : ''} frames)` : ''}
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
