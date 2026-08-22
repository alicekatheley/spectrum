import { useState } from "react";
import { PautaGerada, TesteAbProposta } from "../types";
import GifViewer from "./GifViewer";
import { FlaskConical, ThumbsUp, RefreshCw } from "lucide-react";

interface TesteAbCardProps {
  proposta: TesteAbProposta;
  pautaA?: PautaGerada;
  frameImagesA: Record<string, string>;
  onAceitar?: (proposta: TesteAbProposta) => void;
  onRejeitar?: (proposta: TesteAbProposta) => void;
  regenerando?: boolean;
  key?: string | number;
}

export default function TesteAbCard({ proposta, pautaA, frameImagesA, onAceitar, onRejeitar, regenerando }: TesteAbCardProps) {
  // storage_url é raro no banco (só 1 de ~270 GIFs) — a maioria só tem insider_original_url.
  // Sem esse fallback a Variante B ficaria "indisponível" quase sempre.
  const varianteBUrl = proposta.conteudoVarianteB?.storageUrl || proposta.conteudoVarianteB?.insiderOriginalUrl;
  // insider_original_url é um link externo (CDN da Insider) — pode ter restrição de hotlink;
  // se a imagem falhar ao carregar, cai pro placeholder em vez de mostrar ícone quebrado.
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-indigo-100 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider">
          <FlaskConical className="w-4 h-4" />
          Proposta de Teste A/B — {proposta.marca}
        </div>
        {proposta.status !== 'pendente' && (
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
            proposta.status === 'aceito' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}>
            {proposta.status === 'aceito' ? 'Aceito' : proposta.status}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
            Variante A — Novo conceito (Agente)
          </span>
          {Object.keys(frameImagesA).length > 0 ? (
            <GifViewer frameImages={frameImagesA} />
          ) : (
            <div className="w-full aspect-square rounded-2xl border border-slate-200 flex items-center justify-center text-xs text-slate-400 text-center p-4">
              Frames ainda não disponíveis
            </div>
          )}
          <p className="text-xs text-slate-600">
            Mecânica: <strong>{pautaA?.operacional?.mecanicaEscolhida ?? '—'}</strong>
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Variante B — Histórico
          </span>
          {varianteBUrl && !imgFailed ? (
            <div className="w-full rounded-2xl overflow-hidden border border-slate-200">
              <img
                src={varianteBUrl}
                alt={proposta.conteudoVarianteB?.nomeDesign ?? 'GIF histórico'}
                className="w-full object-cover"
                onError={() => setImgFailed(true)}
              />
            </div>
          ) : (
            <div className="w-full aspect-square rounded-2xl border border-slate-200 flex items-center justify-center text-xs text-slate-400 text-center p-4">
              GIF histórico indisponível
            </div>
          )}
          <p className="text-xs text-slate-600">
            {proposta.conteudoVarianteB?.nomeDesign ?? '—'}
          </p>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-500 block mb-1">
          Racional da comparação
        </span>
        <p className="text-sm text-slate-700">{proposta.racional}</p>
      </div>

      {proposta.status === 'pendente' && (onAceitar || onRejeitar) && (
        <div className="flex gap-2.5 flex-wrap">
          <button
            onClick={() => onAceitar?.(proposta)}
            disabled={regenerando}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            Aprovar Comparação
          </button>
          <button
            onClick={() => onRejeitar?.(proposta)}
            disabled={regenerando}
            className="bg-white hover:bg-amber-50 disabled:opacity-50 border border-slate-200 hover:border-amber-200 text-slate-500 hover:text-amber-600 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Não faz sentido comparar com esse conteúdo — busca outro do histórico"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerando ? 'animate-spin' : ''}`} />
            {regenerando ? 'Buscando novo conteúdo...' : 'Não faz sentido — buscar outro'}
          </button>
        </div>
      )}
    </div>
  );
}
