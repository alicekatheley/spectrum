// Campo de upload de imagens de referência (até `max` fotos), extraído do Modo B pra ser
// reaproveitado onde mais precisar de referência de produto real (ex.: Modo D).
interface ReferenciasImagemFieldProps {
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
  label?: string;
  helpText?: string;
}

export default function ReferenciasImagemField({
  value, onChange, max = 4,
  label = "Referência Visual",
  helpText = "Adicione até 4 imagens de referência. A IA usará o estilo visual de todas elas.",
}: ReferenciasImagemFieldProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-700">
          {label}
          <span className="text-xs text-slate-400 font-normal ml-1">
            (Opcional — até {max} imagens)
          </span>
        </label>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
          >
            ✕ Limpar todas
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 max-w-xs">
        {Array.from({ length: max }).map((_, i) => {
          const src = value[i];
          return (
            <div key={i} className="relative">
              {src ? (
                <div className="relative rounded-xl overflow-hidden border-2 border-emerald-400 aspect-square">
                  <img src={src} alt={`Ref ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...value];
                      updated.splice(i, 1);
                      onChange(updated);
                    }}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                  <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                    REF {i + 1}
                  </span>
                </div>
              ) : value.length === i ? (
                <label className="flex flex-col items-center justify-center w-full aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer gap-1">
                  <span className="text-slate-400 text-xl">+</span>
                  <span className="text-[10px] text-slate-400 font-medium">Adicionar</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []) as File[];
                      if (files.length === 0) return;
                      const remainingSlots = max - value.length;
                      const filesToAdd = files.slice(0, remainingSlots);
                      Promise.all(
                        filesToAdd.map((file) => new Promise<string>((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = (ev) => resolve(ev.target?.result as string);
                          reader.onerror = reject;
                          reader.readAsDataURL(file);
                        }))
                      ).then((results) => {
                        onChange([...value, ...results]);
                      });
                      e.target.value = '';
                    }}
                  />
                </label>
              ) : (
                <div className="w-full aspect-square rounded-xl border-2 border-dashed border-slate-100 bg-slate-50 flex items-center justify-center">
                  <span className="text-slate-200 text-xl">{i + 1}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-400">{helpText}</p>
    </div>
  );
}
