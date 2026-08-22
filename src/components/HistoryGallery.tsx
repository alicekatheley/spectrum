import { PautaGerada } from "../types";
import { Image as ImageIcon, Download, Loader2 } from "lucide-react";

interface HistoryGalleryProps {
  pautas: PautaGerada[];
  frameImagesByPauta: Record<string, Record<string, string>>;
  onOpenPauta: (pauta: PautaGerada) => void;
  onDownloadGif?: (pauta: PautaGerada) => void;
  downloadingId?: string | null;
}

const STATUS_DOT: Record<string, string> = {
  aprovado: 'bg-emerald-400',
  descartado: 'bg-slate-400',
  rascunho: 'bg-amber-400',
};

export default function HistoryGallery({ pautas, frameImagesByPauta, onOpenPauta, onDownloadGif, downloadingId }: HistoryGalleryProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {pautas.map((pauta) => {
        const isApice = pauta.marca === 'Apice';
        const thumb = (frameImagesByPauta[pauta.id] ?? {})['frame_0'];
        const label = pauta.copy?.assunto || pauta.copy?.headlineBanner || 'Pauta sem assunto';
        return (
          <button
            key={pauta.id}
            type="button"
            onClick={() => onOpenPauta(pauta)}
            title={label}
            className="group relative aspect-square rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 hover:border-slate-600 transition-all cursor-pointer text-left"
          >
            {thumb ? (
              <img src={thumb} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-700">
                <ImageIcon className="w-8 h-8" />
              </div>
            )}

            {/* Badge de marca */}
            <span
              className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full ring-2 ring-black/30"
              style={{ backgroundColor: isApice ? '#688D65' : '#BF0F26' }}
              title={pauta.marca}
            />
            {/* Badge de status */}
            <span
              className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ring-2 ring-black/30 ${STATUS_DOT[pauta.status] ?? 'bg-slate-400'}`}
              title={pauta.status}
            />

            {/* Baixar GIF — some, aparece no hover, não abre o card por baixo */}
            {onDownloadGif && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onDownloadGif(pauta); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onDownloadGif(pauta); } }}
                title="Baixar GIF animado"
                className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
              >
                {downloadingId === pauta.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
              </span>
            )}

            {/* Assunto — some, aparece no hover */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2.5 pt-8 pb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <p className="text-[10px] text-white font-semibold leading-snug line-clamp-2">{label}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
