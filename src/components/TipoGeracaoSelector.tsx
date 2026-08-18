import React from "react";
import { Image, Layers } from "lucide-react";
import { Brand } from "../types";

type TipoGeracao = 'texto' | 'imagem' | 'texto_imagem';

interface TipoGeracaoSelectorProps {
  value: TipoGeracao;
  onChange: (v: TipoGeracao) => void;
  brand: Brand;
}

const OPTIONS: Array<{
  value: TipoGeracao;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}> = [
  { value: 'texto_imagem', label: 'Texto + Imagem', description: 'Gera copy e briefing visual', Icon: Layers },
  { value: 'imagem', label: 'Apenas Imagem', description: 'Só visual — sem copy', Icon: Image },
];

export default function TipoGeracaoSelector({ value, onChange, brand }: TipoGeracaoSelectorProps) {
  const brandColor = brand === 'Apice' ? '#688D65' : '#BF0F26';

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-slate-700">
        Tipo de Geração
      </span>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map(({ value: v, label, description, Icon }) => {
          const isSelected = value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={`p-3 rounded-xl border-2 flex flex-col items-start gap-1.5 text-left transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-slate-50 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
              style={isSelected ? { borderColor: brandColor } : {}}
            >
              <Icon
                className="w-4 h-4"
                style={{ color: isSelected ? brandColor : '#94a3b8' }}
              />
              <span className="text-xs font-bold text-slate-700 leading-tight">{label}</span>
              <span className="text-[10px] text-slate-400 leading-tight">{description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
