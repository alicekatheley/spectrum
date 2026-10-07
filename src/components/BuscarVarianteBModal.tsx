import { useEffect, useState } from "react";
import { Search, X, Loader2, Check } from "lucide-react";
import { buscarConteudosGif, ConteudoGifBusca } from "../lib/conteudos-service";

interface BuscarVarianteBModalProps {
  onClose: () => void;
  onSelecionar: (conteudo: ConteudoGifBusca) => void;
}

export default function BuscarVarianteBModal({ onClose, onSelecionar }: BuscarVarianteBModalProps) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ConteudoGifBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [buscouUmaVez, setBuscouUmaVez] = useState(false);

  const executarBusca = async (termo: string) => {
    setBuscando(true);
    setErro(null);
    const resp = await buscarConteudosGif(termo);
    setBuscando(false);
    setBuscouUmaVez(true);
    if (resp === null) {
      setErro("Não consegui buscar agora. Tenta de novo em alguns segundos.");
      return;
    }
    setResultados(resp);
  };

  // Carrega os primeiros resultados assim que o modal abre, sem exigir digitação.
  useEffect(() => {
    executarBusca("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto backdrop-blur-md bg-slate-950/80 animate-fade-in"
      onClick={onClose}
    >
      <div className="relative w-full max-w-3xl my-8 bg-white rounded-3xl shadow-2xl p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          title="Fechar"
          className="absolute -top-3 -right-3 z-10 bg-slate-900 text-white rounded-full p-2 shadow-lg hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-500 block mb-1">
            Buscar Variante B manualmente
          </span>
          <p className="text-sm text-slate-600">
            Procure pelo nome do design ou pela mecânica no histórico de GIFs analisados e escolha qual usar na comparação.
          </p>
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            executarBusca(query);
          }}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex.: caixa, gaveta, presente..."
            className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            autoFocus
          />
          <button
            type="submit"
            disabled={buscando}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            {buscando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Buscar
          </button>
        </form>

        {erro && <p className="text-xs text-rose-500">{erro}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[55vh] overflow-y-auto pr-1">
          {resultados.map((c) => {
            const url = c.storageUrl || c.insiderOriginalUrl;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelecionar(c)}
                className="group text-left border border-slate-200 hover:border-indigo-300 rounded-2xl overflow-hidden flex flex-col transition-colors cursor-pointer"
              >
                <div className="w-full aspect-square bg-slate-50 flex items-center justify-center overflow-hidden relative">
                  {url ? (
                    <img src={url} alt={c.nomeDesign ?? "GIF histórico"} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-slate-400 text-center p-2">Sem prévia</span>
                  )}
                  <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/70 transition-colors flex items-center justify-center">
                    <Check className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-[11px] font-semibold text-slate-700 truncate">{c.nomeDesign ?? "—"}</p>
                  {c.marca && <p className="text-[10px] text-slate-400">{c.marca}</p>}
                </div>
              </button>
            );
          })}
        </div>

        {!buscando && buscouUmaVez && resultados.length === 0 && !erro && (
          <p className="text-sm text-slate-400 text-center py-6">Nenhum GIF encontrado pra essa busca.</p>
        )}
      </div>
    </div>
  );
}
