import { Brand } from "../types";

export const IMAGE_MODELS = [
  {
    id: 'wavespeed-gpt-image-2-t2i',
    label: 'GPT Image 2',
    provider: 'OpenAI',
    badge: 'Melhor',
    badgeColor: 'orange',
    credits: 2,
  },
  {
    id: 'gemini-3-pro-image-preview',
    label: 'Gemini 3 Pro',
    provider: 'Google',
    badge: 'Preview',
    badgeColor: 'blue',
    credits: 4,
  },
  {
    id: 'gemini-3.1-flash-image-preview',
    label: 'Gemini 3.1 Flash',
    provider: 'Google',
    badge: 'Preview',
    badgeColor: 'blue',
    credits: 2,
  },
  {
    id: 'gemini-2.5-flash-image',
    label: 'Gemini 2.5 Flash',
    provider: 'Google',
    badge: null,
    badgeColor: null,
    credits: 1,
  },
  {
    id: 'wavespeed-seedream-v5-lite',
    label: 'Seedream V5',
    provider: 'ByteDance',
    badge: 'Rápido',
    badgeColor: 'gray',
    credits: 2,
  },
];

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
        {IMAGE_MODELS.map((model) => {
          const selected = value === model.id;
          return (
            <button
              key={model.id}
              type="button"
              onClick={() => onChange(model.id)}
              className={`px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer min-w-[140px] ${
                selected ? 'bg-slate-50 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
              style={selected ? { borderColor: brandColor } : {}}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm" style={{ color: selected ? brandColor : '#475569' }}>
                    {model.label}
                  </span>
                  <span className="text-xs text-slate-400">{model.provider}</span>
                  {model.badge && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      model.badgeColor === 'orange' ? 'bg-orange-100 text-orange-600' :
                      model.badgeColor === 'blue'   ? 'bg-blue-100 text-blue-600' :
                                                      'bg-slate-100 text-slate-500'
                    }`}>
                      {model.badge}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 text-yellow-500">
                  <span className="text-xs font-bold">⚡ {model.credits}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-400 mt-1">
        ⚡ = créditos consumidos por frame gerado
      </p>
    </div>
  );
}
