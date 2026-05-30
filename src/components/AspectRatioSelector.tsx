// src/components/AspectRatioSelector.tsx
import { Brand } from "../types";

interface AspectRatioSelectorProps {
  value: string;
  onChange: (v: string) => void;
  brand: Brand;
}

const RATIOS: { value: string; label: string; description: string; w: number; h: number }[] = [
  { value: "1:1",  label: "1:1",  description: "Feed, post estático", w: 40, h: 40 },
  { value: "3:4",  label: "3:4",  description: "Retrato — email",     w: 30, h: 40 },
  { value: "16:9", label: "16:9", description: "Header widescreen",   w: 48, h: 27 },
  { value: "9:16", label: "9:16", description: "Stories, mobile",     w: 22, h: 40 },
  { value: "4:3",  label: "4:3",  description: "Paisagem padrão",     w: 40, h: 30 },
];

export default function AspectRatioSelector({ value, onChange, brand }: AspectRatioSelectorProps) {
  const brandColor = brand === 'Apice' ? '#688D65' : '#BF0F26';

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-slate-700">
        Proporção da Imagem
      </span>
      <div className="flex gap-2 flex-wrap">
        {RATIOS.map((ratio) => {
          const isSelected = value === ratio.value;
          return (
            <button
              key={ratio.value}
              type="button"
              onClick={() => onChange(ratio.value)}
              className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all duration-200 cursor-pointer min-w-[60px] ${
                isSelected
                  ? 'bg-slate-50 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
              style={isSelected ? { borderColor: brandColor } : {}}
              title={ratio.description}
            >
              <div className="flex items-center justify-center w-12 h-10">
                <div
                  className="rounded-sm"
                  style={{
                    width: `${ratio.w}px`,
                    height: `${ratio.h}px`,
                    backgroundColor: isSelected ? brandColor : '#cbd5e1',
                    opacity: isSelected ? 0.85 : 0.5,
                    transition: 'background-color 0.2s',
                  }}
                />
              </div>
              <span
                className="text-[11px] font-bold tracking-wide"
                style={{ color: isSelected ? brandColor : '#64748b' }}
              >
                {ratio.label}
              </span>
              <span className="text-[9px] text-slate-400 text-center leading-tight max-w-[64px]">
                {ratio.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
