import { Brand } from "../types";

export const IMAGE_MODELS = [
  { id: 'wavespeed-gpt-image-2-t2i',      label: 'GPT Image 2',      provider: 'OpenAI',    badge: '⚡ Melhor' },
  { id: 'gemini-3-pro-image-preview',      label: 'Gemini 3 Pro',     provider: 'Google',    badge: 'Preview' },
  { id: 'gemini-3.1-flash-image-preview',  label: 'Gemini 3.1 Flash', provider: 'Google',    badge: 'Preview' },
  { id: 'gemini-2.5-flash-image',          label: 'Gemini 2.5 Flash', provider: 'Google',    badge: null },
  { id: 'wavespeed-seedream-v5-lite',      label: 'Seedream V5',      provider: 'ByteDance', badge: 'Rápido' },
] as const;

export const DEFAULT_IMAGE_MODEL = 'wavespeed-gpt-image-2-t2i';

interface ImageModelSelectorProps {
  value: string;
  onChange: (v: string) => void;
  brand: Brand;
}

export default function ImageModelSelector({ value, onChange, brand }: ImageModelSelectorProps) {
  const brandColor = brand === 'Apice' ? '#688D65' : '#BF0F26';

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-slate-700">Modelo de Geração de Imagem</span>
      <div className="flex flex-wrap gap-2">
        {IMAGE_MODELS.map(({ id, label, provider, badge }) => {
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer ${
                selected ? 'bg-slate-50 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
              style={selected ? { borderColor: brandColor } : {}}
            >
              <span style={{ color: selected ? brandColor : '#475569' }}>{label}</span>
              <span className="text-[10px] text-slate-400 font-normal">{provider}</span>
              {badge && (
                <span
                  className="text-[9px] font-bold px-1 py-0.5 rounded"
                  style={selected
                    ? { backgroundColor: brandColor + '18', color: brandColor }
                    : { backgroundColor: '#f1f5f9', color: '#94a3b8' }
                  }
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
