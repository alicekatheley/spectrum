import { X } from "lucide-react";

export interface FrameGif {
  index: number; // posição do frame na pauta (frame_0, frame_1, …)
  src: string;
}

// Lê a lista de frames excluídos do GIF salva na pauta (inputOriginal.framesExcluidosGif).
export function getFramesExcluidosGif(pauta: unknown): number[] {
  const lista = (pauta as any)?.inputOriginal?.framesExcluidosGif;
  return Array.isArray(lista) ? lista.filter((n: unknown) => typeof n === 'number') : [];
}

// Grade de miniaturas dos frames já gerados — clicar num frame tira/devolve ele do GIF final.
// Sempre mantém ao menos 1 frame incluído.
export default function SeletorFramesGif({
  frames,
  excluidos,
  onChange,
  aspectRatioCss,
  tema = 'escuro',
}: {
  frames: FrameGif[];
  excluidos: number[];
  onChange: (excluidos: number[]) => void;
  aspectRatioCss?: string;
  tema?: 'escuro' | 'claro';
}) {
  const incluidos = frames.filter((f) => !excluidos.includes(f.index)).length;
  const escuro = tema === 'escuro';

  const toggle = (index: number) => {
    if (excluidos.includes(index)) {
      onChange(excluidos.filter((i) => i !== index));
    } else if (incluidos > 1) {
      onChange([...excluidos, index].sort((a, b) => a - b));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[11px] font-bold">
        <span className={escuro ? 'text-slate-400' : 'text-slate-500'}>
          {incluidos} de {frames.length} frames no GIF
        </span>
        {excluidos.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className={`text-[10px] underline cursor-pointer ${escuro ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Usar todos
          </button>
        )}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {frames.map((f) => {
          const excluido = excluidos.includes(f.index);
          const bloqueado = !excluido && incluidos <= 1;
          return (
            <button
              key={f.index}
              type="button"
              onClick={() => toggle(f.index)}
              disabled={bloqueado}
              title={
                bloqueado
                  ? 'O GIF precisa de ao menos 1 frame'
                  : excluido ? `Incluir frame ${f.index + 1} no GIF` : `Excluir frame ${f.index + 1} do GIF`
              }
              className={`relative rounded-lg overflow-hidden border-2 transition-all cursor-pointer disabled:cursor-not-allowed ${
                excluido
                  ? 'border-rose-500/70'
                  : escuro ? 'border-emerald-500/70 hover:border-emerald-400' : 'border-emerald-500 hover:border-emerald-600'
              }`}
              style={{ aspectRatio: aspectRatioCss }}
            >
              <img
                src={f.src}
                alt={`Frame ${f.index + 1}`}
                className={`w-full h-full object-cover transition-all ${excluido ? 'opacity-30 grayscale' : ''}`}
              />
              {excluido && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <X className="w-6 h-6 text-rose-500 drop-shadow" strokeWidth={3} />
                </span>
              )}
              <span
                className={`absolute top-1 left-1 min-w-[18px] px-1 rounded text-[10px] font-black leading-[18px] text-center ${
                  excluido ? 'bg-rose-600 text-white line-through' : 'bg-black/70 text-white'
                }`}
              >
                {f.index + 1}
              </span>
            </button>
          );
        })}
      </div>
      <span className={`text-[10px] ${escuro ? 'text-slate-500' : 'text-slate-400'}`}>
        Clique num frame para tirá-lo ou devolvê-lo ao GIF.
      </span>
    </div>
  );
}
