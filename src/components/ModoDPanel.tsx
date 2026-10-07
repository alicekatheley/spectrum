import { useRef, useState, type ChangeEvent } from "react";
import {
  ImagePlus, Search, Loader2, Wand2, Download, X, ArrowUp, ArrowDown, Eraser, RotateCcw,
} from "lucide-react";
import { decodeGifFrames } from "../utils/decodeGif";
import { encodeAndDownloadGif } from "../utils/downloadGif";
import { resolveCanvasSize } from "../utils/composeFrame";
import { buscarConteudosGif, ConteudoGifBusca } from "../lib/conteudos-service";
import GifViewer from "./GifViewer";
import ReferenciasImagemField from "./ReferenciasImagemField";

const ASPECT_RATIOS: { value: string; label: string; ratio: number }[] = [
  { value: '1:1', label: '1:1 — Quadrado', ratio: 1 },
  { value: '3:4', label: '3:4 — Retrato', ratio: 0.75 },
  { value: '4:3', label: '4:3 — Paisagem', ratio: 1.333 },
  { value: '16:9', label: '16:9 — Widescreen', ratio: 1.778 },
  { value: '9:16', label: '9:16 — Story', ratio: 0.5625 },
];

function nearestAspectRatio(width: number, height: number): string {
  const target = width / height;
  let best = ASPECT_RATIOS[0];
  let bestDiff = Math.abs(target - best.ratio);
  for (const opt of ASPECT_RATIOS) {
    const diff = Math.abs(target - opt.ratio);
    if (diff < bestDiff) { bestDiff = diff; best = opt; }
  }
  return best.value;
}

export default function ModoDPanel() {
  // ─── Fonte do GIF ────────────────────────────────────────────────────────
  const [carregandoFonte, setCarregandoFonte] = useState(false);
  const [erroFonte, setErroFonte] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [buscaQuery, setBuscaQuery] = useState('');
  const [buscaResultados, setBuscaResultados] = useState<ConteudoGifBusca[]>([]);
  const [buscando, setBuscando] = useState(false);

  // ─── GIF decodificado ────────────────────────────────────────────────────
  const [baseFrames, setBaseFrames] = useState<string[] | null>(null);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [ordem, setOrdem] = useState<number[]>([]);
  const [incluidos, setIncluidos] = useState<Set<number>>(new Set());

  const carregarFrames = async (arrayBuffer: ArrayBuffer, origemLabel: string) => {
    setCarregandoFonte(true);
    setErroFonte(null);
    try {
      const { frames, width, height } = await decodeGifFrames(arrayBuffer);
      if (frames.length === 0) throw new Error('Não encontrei frames nesse GIF.');
      setBaseFrames(frames);
      setAspectRatio(nearestAspectRatio(width, height));
      setOrdem(frames.map((_, i) => i));
      setIncluidos(new Set(frames.map((_, i) => i)));
    } catch (err: any) {
      console.error(`[ModoD] Falha ao decodificar GIF (${origemLabel}):`, err);
      setErroFonte(`Não consegui decodificar esse GIF: ${err.message}`);
    } finally {
      setCarregandoFonte(false);
    }
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const buffer = await file.arrayBuffer();
    await carregarFrames(buffer, 'upload');
  };

  const executarBusca = async (query: string) => {
    setBuscando(true);
    const resp = await buscarConteudosGif(query);
    setBuscando(false);
    if (resp) setBuscaResultados(resp);
  };

  const escolherDoHistorico = async (c: ConteudoGifBusca) => {
    const url = c.storageUrl || c.insiderOriginalUrl;
    if (!url) {
      setErroFonte('Esse item do histórico não tem uma URL de GIF disponível.');
      return;
    }
    setCarregandoFonte(true);
    setErroFonte(null);
    try {
      const resp = await fetch(`/api/gif-proxy?url=${encodeURIComponent(url)}`);
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `Falha ao buscar o GIF (${resp.status}).`);
      }
      const buffer = await resp.arrayBuffer();
      await carregarFrames(buffer, 'histórico');
    } catch (err: any) {
      console.error('[ModoD] Falha ao buscar GIF do histórico:', err);
      setErroFonte(`Não consegui buscar esse GIF: ${err.message}`);
      setCarregandoFonte(false);
    }
  };

  const reiniciar = () => {
    setBaseFrames(null);
    setOrdem([]);
    setIncluidos(new Set());
    setErroFonte(null);
    setBuscaResultados([]);
    setBuscaQuery('');
  };

  // ─── Editar com IA — texto, cor ou item, direto na imagem (a IA entende o
  // direcionamento livre e aplica a mudança certa; não há overlay de texto separado
  // como no Modo A/B/C, já que aqui o GIF de origem já vem com o texto "queimado" no pixel).
  const [instrucaoIA, setInstrucaoIA] = useState('');
  const [referenciasImagem, setReferenciasImagem] = useState<string[]>([]);
  const [aplicandoIA, setAplicandoIA] = useState<Set<number>>(new Set());
  const [progressoTodos, setProgressoTodos] = useState<{ done: number; total: number } | null>(null);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Chama /iniciar (rápido — só dispara o job no PiApp) e depois faz polling em /status até
  // terminar. Uma única requisição bloqueada por até 150s (o tempo que o PiApp pode levar num
  // edit) estourava o timeout do gateway do GoDeploy, que devolve uma página HTML de erro em vez
  // de JSON — daí o "Unexpected token '<'" que aparecia às vezes no meio de um lote de frames.
  // `frameReferenciaUrl` é opcional: quando presente, é o resultado JÁ editado de outro frame do
  // mesmo GIF, mandado só pra travar layout/posição (câmera, zoom, posição do texto) — sem isso,
  // cada frame é gerado por uma chamada de IA independente e o layout tende a "andar" de frame
  // pra frame, quebrando a continuidade da animação. Retorna a imagem final (ou undefined em
  // erro) pra quem chama poder encadear como referência do próximo frame do mesmo lote.
  const editarFrameComIA = async (indice: number, frameReferenciaUrl?: string): Promise<string | undefined> => {
    if (!baseFrames || !instrucaoIA.trim()) return undefined;
    setAplicandoIA(prev => new Set(prev).add(indice));
    try {
      const iniciarResp = await fetch('/api/editar-frame-externo/iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: baseFrames[indice],
          instrucao: instrucaoIA,
          aspectRatio,
          referenciasImagem: referenciasImagem.length > 0 ? referenciasImagem : undefined,
          frameReferencia: frameReferenciaUrl,
        }),
      });
      const iniciarData = await iniciarResp.json();
      if (!iniciarResp.ok) throw new Error(iniciarData.error || 'Falha ao iniciar a edição do frame.');
      const { jobId } = iniciarData;

      let data: { done: true; imageBytes: string; mimeType: string } | null = null;
      for (let tentativa = 0; tentativa < 50; tentativa++) {
        await sleep(3000);
        const statusResp = await fetch(`/api/editar-frame-externo/status?jobId=${encodeURIComponent(jobId)}`);
        const statusData = await statusResp.json();
        if (!statusResp.ok) throw new Error(statusData.error || 'Falha ao consultar o status da edição.');
        if (statusData.done) { data = statusData; break; }
      }
      if (!data) throw new Error('A edição demorou demais (timeout).');

      const novaImagem = `data:${data.mimeType};base64,${data.imageBytes}`;
      setBaseFrames(prev => {
        if (!prev) return prev;
        const novo = [...prev];
        novo[indice] = novaImagem;
        return novo;
      });
      return novaImagem;
    } catch (err: any) {
      console.error('[ModoD] Falha ao editar frame com IA:', err);
      alert(`Erro ao editar o frame ${indice + 1}: ${err.message}`);
      return undefined;
    } finally {
      setAplicandoIA(prev => {
        const novo = new Set(prev);
        novo.delete(indice);
        return novo;
      });
    }
  };

  const aplicarIATodosSelecionados = async () => {
    if (!baseFrames || !instrucaoIA.trim()) return;
    const alvos = ordem.filter(i => incluidos.has(i));
    setProgressoTodos({ done: 0, total: alvos.length });
    // O primeiro frame editado no lote vira a referência de layout dos demais — mantém câmera,
    // zoom e posição do texto consistentes entre todos os frames do mesmo GIF.
    let frameReferenciaUrl: string | undefined;
    for (let i = 0; i < alvos.length; i++) {
      const resultado = await editarFrameComIA(alvos[i], frameReferenciaUrl);
      if (i === 0 && resultado) frameReferenciaUrl = resultado;
      setProgressoTodos({ done: i + 1, total: alvos.length });
    }
    setProgressoTodos(null);
  };

  // ─── Frames: incluir/excluir/reordenar ──────────────────────────────────
  const moverFrame = (posicao: number, direcao: -1 | 1) => {
    setOrdem(prev => {
      const novo = [...prev];
      const alvo = posicao + direcao;
      if (alvo < 0 || alvo >= novo.length) return prev;
      [novo[posicao], novo[alvo]] = [novo[alvo], novo[posicao]];
      return novo;
    });
  };

  const alternarInclusao = (indice: number) => {
    setIncluidos(prev => {
      const novo = new Set(prev);
      if (novo.has(indice)) novo.delete(indice); else novo.add(indice);
      return novo;
    });
  };

  // ─── Frames finais (pra preview e download) ─────────────────────────────
  const framesIncluidosOrdem = ordem.filter(i => incluidos.has(i));
  const framesFinais = framesIncluidosOrdem.map(i => baseFrames?.[i] ?? '');
  const gifViewerFrames: Record<string, string> = {};
  framesFinais.forEach((src, pos) => { gifViewerFrames[`frame_${String(pos).padStart(2, '0')}`] = src; });

  const baixarGif = async () => {
    if (framesFinais.length < 1) return;
    const [gifWidth, gifHeight] = resolveCanvasSize(aspectRatio);
    try {
      await encodeAndDownloadGif(framesFinais, { gifWidth, gifHeight, filename: 'gif-editado.gif' });
    } catch (err: any) {
      alert('Erro ao baixar o GIF: ' + err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full animate-fade-in flex flex-col gap-6">
      <div className="bg-[var(--shell-panel)] border border-[var(--shell-border)] p-6 rounded-3xl flex flex-col gap-1">
        <h2 className="text-xl font-bold font-sans text-[var(--shell-text)]">
          Editor de GIF Externo
        </h2>
        <p className="text-xs text-[var(--shell-text-muted)] leading-relaxed mt-1">
          Traga um GIF já pronto — do seu computador ou do histórico — pra pedir mudanças de texto,
          cor ou produto com IA, e recortar ou reordenar os frames. Baixe o resultado no final.
        </p>
      </div>

      {!baseFrames ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-indigo-100 flex flex-col gap-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
              Upload do computador
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={carregandoFonte}
              className="border-2 border-dashed border-slate-200 hover:border-indigo-300 rounded-2xl p-8 flex flex-col items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer disabled:opacity-50"
            >
              {carregandoFonte ? <Loader2 className="w-8 h-8 animate-spin" /> : <ImagePlus className="w-8 h-8" />}
              <span className="text-xs font-semibold">Escolher um arquivo .gif</span>
            </button>
            <input ref={fileInputRef} type="file" accept=".gif,image/gif" className="hidden" onChange={handleUpload} />
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-indigo-100 flex flex-col gap-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
              Escolher do histórico
            </span>
            <form
              className="flex gap-2"
              onSubmit={(e) => { e.preventDefault(); executarBusca(buscaQuery); }}
            >
              <input
                type="text"
                value={buscaQuery}
                onChange={(e) => setBuscaQuery(e.target.value)}
                placeholder="Ex.: caixa, gaveta, presente..."
                className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              />
              <button
                type="submit"
                disabled={buscando}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {buscando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              </button>
            </form>
            <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
              {buscaResultados.map((c) => {
                const url = c.storageUrl || c.insiderOriginalUrl;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => escolherDoHistorico(c)}
                    disabled={carregandoFonte}
                    className="border border-slate-200 hover:border-indigo-300 rounded-xl overflow-hidden flex flex-col disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    <div className="w-full aspect-square bg-slate-50 flex items-center justify-center overflow-hidden">
                      {url ? <img src={url} alt={c.nomeDesign ?? ''} className="w-full h-full object-cover" /> : <span className="text-[10px] text-slate-400">Sem prévia</span>}
                    </div>
                    <p className="text-[10px] text-slate-600 truncate px-1.5 py-1">{c.nomeDesign ?? '—'}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {carregandoFonte && (
            <div className="bg-white rounded-2xl p-4 text-sm text-slate-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Decodificando o GIF...
            </div>
          )}

          <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-indigo-100 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                Frames ({baseFrames.length})
              </span>
              <button type="button" onClick={reiniciar} className="text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer">
                <RotateCcw className="w-3.5 h-3.5" /> Trocar GIF
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {ordem.map((indice, posicao) => {
                const incluido = incluidos.has(indice);
                const carregandoEsteFrame = aplicandoIA.has(indice);
                return (
                  <div key={indice} className={`relative shrink-0 w-28 border-2 rounded-2xl overflow-hidden flex flex-col ${incluido ? 'border-indigo-200' : 'border-slate-100 opacity-40'}`}>
                    <div className="w-28 h-28 bg-slate-50 relative">
                      <img src={baseFrames[indice]} alt={`Frame ${posicao + 1}`} className="w-full h-full object-cover" />
                      {carregandoEsteFrame && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between px-1.5 py-1 bg-white gap-1">
                      <button type="button" onClick={() => moverFrame(posicao, -1)} disabled={posicao === 0} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer">
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button type="button" onClick={() => alternarInclusao(indice)} title={incluido ? 'Excluir do GIF final' : 'Incluir no GIF final'} className={`p-1 cursor-pointer ${incluido ? 'text-indigo-500' : 'text-slate-300'}`}>
                        <Eraser className="w-3 h-3" />
                      </button>
                      <button type="button" onClick={() => moverFrame(posicao, 1)} disabled={posicao === ordem.length - 1} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer">
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-indigo-100 flex flex-col gap-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                Editar com IA
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed -mt-2">
                Descreva a mudança em texto livre — troca de texto, cor ou de um item/produto. A IA
                aplica a mudança direto na imagem, preservando o resto.
              </p>
              <textarea
                value={instrucaoIA}
                onChange={(e) => setInstrucaoIA(e.target.value)}
                placeholder='Ex.: troque o título para "GANHE 20% OFF"; deixe o fundo rosa; troque o produto pelo da referência...'
                rows={3}
                className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
              />
              <ReferenciasImagemField
                value={referenciasImagem}
                onChange={setReferenciasImagem}
                label="Referência de produto"
                helpText='Se a mudança envolve trocar um produto/item por outro, anexe fotos reais dele aqui — a IA reproduz exatamente o que estiver nas referências.'
              />
              <button
                type="button"
                onClick={aplicarIATodosSelecionados}
                disabled={!instrucaoIA.trim() || aplicandoIA.size > 0 || progressoTodos !== null}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5" />
                {progressoTodos ? `Aplicando ${progressoTodos.done}/${progressoTodos.total}...` : 'Aplicar a todos os frames incluídos'}
              </button>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Ou aplique em um frame só:
              </p>
              <div className="flex flex-wrap gap-2">
                {ordem.filter(i => incluidos.has(i)).map((indice, pos) => (
                  <button
                    key={indice}
                    type="button"
                    onClick={() => editarFrameComIA(indice)}
                    disabled={!instrucaoIA.trim() || aplicandoIA.has(indice)}
                    className="bg-white hover:bg-indigo-50 disabled:opacity-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider cursor-pointer transition-colors"
                  >
                    Editar frame {pos + 1}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-indigo-100 flex flex-col gap-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                Prévia e download
              </span>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Aspect ratio:</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700"
                >
                  {ASPECT_RATIOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {framesFinais.length > 0 ? (
                <GifViewer frameImages={gifViewerFrames} />
              ) : (
                <div className="w-full aspect-square rounded-2xl border border-slate-200 flex items-center justify-center text-xs text-slate-400 text-center p-4">
                  Nenhum frame incluído
                </div>
              )}
              <button
                type="button"
                onClick={baixarGif}
                disabled={framesFinais.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar GIF
              </button>
            </div>
          </div>
        </div>
      )}

      {erroFonte && (
        <div className="bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-2xl p-4 flex items-center justify-between gap-2">
          {erroFonte}
          <button type="button" onClick={() => setErroFonte(null)} className="text-rose-400 hover:text-rose-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
