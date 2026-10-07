import React from "react";
import { parseDestaque, alternarMarcador, ESCALA_DESTAQUE, COR_DESTAQUE_PADRAO } from "../utils/destaque";

// Render CSS do texto com marcadores (*negrito*, ^maior^, ~cor~) — espelha o composeFrame
// (canvas): mesma escala, e negrito também engrossa o traço pra aparecer em headline peso 900.
export function TextoDestaque({ texto, corDestaque }: { texto: string; corDestaque?: string }) {
  return (
    <>
      {parseDestaque(texto).map((seg, i) =>
        seg.negrito || seg.maior || seg.cor ? (
          <span
            key={i}
            style={{
              fontWeight: seg.negrito ? 900 : undefined,
              WebkitTextStroke: seg.negrito ? '0.045em currentColor' : undefined,
              fontSize: seg.maior ? `${ESCALA_DESTAQUE}em` : undefined,
              color: seg.cor ? (corDestaque || COR_DESTAQUE_PADRAO) : undefined,
            }}
          >
            {seg.texto}
          </span>
        ) : (
          <React.Fragment key={i}>{seg.texto}</React.Fragment>
        ),
      )}
    </>
  );
}

const BOTOES: { marcador: '*' | '^' | '~'; rotulo: string; titulo: string; classe: string }[] = [
  { marcador: '*', rotulo: 'B', titulo: 'Negrito — envolve com *texto*', classe: 'font-black' },
  { marcador: '^', rotulo: 'A+', titulo: 'Aumentar — envolve com ^texto^', classe: 'font-bold' },
  { marcador: '~', rotulo: 'Cor', titulo: 'Cor de destaque — envolve com ~texto~', classe: 'font-bold' },
];

// Barra de destaque para um <input>: selecione a palavra (ou deixe o cursor nela) e clique.
// Recebe o ref do input pra ler a seleção; devolve o texto novo via onChange.
export function BarraDestaque({
  inputRef, valor, onChange, tema = 'claro', corDestaque, onCorDestaqueChange,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  valor: string;
  onChange: (v: string) => void;
  tema?: 'claro' | 'escuro';
  corDestaque?: string;
  onCorDestaqueChange?: (cor: string) => void;
}) {
  const aplicar = (marcador: '*' | '^' | '~') => {
    const el = inputRef.current;
    const inicio = el?.selectionStart ?? valor.length;
    const fim = el?.selectionEnd ?? valor.length;
    const r = alternarMarcador(valor, inicio, fim, marcador);
    onChange(r.texto);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(r.inicio, r.fim);
    });
  };
  const btn = tema === 'escuro'
    ? 'border-slate-700 bg-slate-900 text-slate-200 hover:border-indigo-500'
    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400';
  const legenda = tema === 'escuro' ? 'text-slate-500' : 'text-slate-400';

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {BOTOES.map(({ marcador, rotulo, titulo, classe }) => (
        <button
          key={marcador}
          type="button"
          title={titulo}
          // mousedown não tira o foco do input, então a seleção continua valendo no click
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => aplicar(marcador)}
          className={`px-2 py-0.5 rounded-md border text-[11px] transition-colors cursor-pointer ${btn} ${classe}`}
          style={marcador === '~' ? { color: corDestaque || COR_DESTAQUE_PADRAO } : undefined}
        >
          {rotulo}
        </button>
      ))}
      {onCorDestaqueChange && (
        <input
          type="color"
          value={corDestaque || COR_DESTAQUE_PADRAO}
          onChange={(e) => onCorDestaqueChange(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer border border-slate-300"
          title="Cor usada nos trechos ~destacados~"
        />
      )}
      <span className={`text-[10px] ${legenda}`}>
        Selecione a palavra e clique para destacar no banner
      </span>
    </div>
  );
}

