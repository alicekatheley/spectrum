interface DirecionamentoIAFieldProps {
  label: string;
  required: boolean;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}

export default function DirecionamentoIAField({
  label,
  required,
  value,
  onChange,
  error,
}: DirecionamentoIAFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="direcionamento-ia" className="text-sm font-semibold text-slate-700">
        {label}
        {!required && (
          <span className="text-slate-400 font-normal text-xs ml-1">(Opcional)</span>
        )}
      </label>
      <textarea
        id="direcionamento-ia"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-slate-200 text-slate-800 text-sm rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all resize-y"
      />
      {error && (
        <span className="text-xs text-rose-500">{error}</span>
      )}
    </div>
  );
}
