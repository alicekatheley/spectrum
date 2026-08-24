import React, { useState, useRef, useEffect } from "react";

// Catálogo de fontes + dropdown de busca compartilhados entre o Modo B (briefing inicial) e o
// "Reajustar Copy" do PreviewModal (histórico geral e agente) — nasceu duplicado em FormModoB.tsx,
// extraído aqui pra não divergir a lista de fontes disponível entre os dois fluxos.
const FONTES_CATALOGO: Record<string, string[]> = {
  'Elegantes / Serif': [
    'Playfair Display', 'Merriweather', 'Abril Fatface', 'Lora',
    'Cormorant Garamond', 'EB Garamond', 'Libre Baskerville',
    'Crimson Text', 'Spectral', 'Vollkorn', 'Cardo', 'Domine',
  ],
  'Modernas / Sans-serif': [
    'Montserrat', 'Nunito Sans', 'Poppins', 'Raleway', 'Oswald',
    'Inter', 'DM Sans', 'Lato', 'Open Sans', 'Roboto', 'Source Sans 3',
    'Barlow', 'Exo 2', 'Rubik', 'Karla', 'Manrope', 'Outfit',
    'Space Grotesk', 'Figtree', 'Plus Jakarta Sans', 'Syne',
    'Urbanist', 'Jost', 'Lexend', 'Nunito',
  ],
  'Impactantes / Display': [
    'Bebas Neue', 'Teko', 'Fjalla One', 'Black Han Sans',
    'Barlow Condensed', 'Anton', 'Squada One',
    'Russo One', 'Arvo', 'Chakra Petch', 'Saira Condensed',
    'Kanit', 'Prompt', 'Rajdhani', 'Yanone Kaffeesatz',
  ],
  'Divertidas / Cartoon': [
    'Bangers', 'Fredoka One', 'Boogaloo', 'Pacifico', 'Righteous',
    'Lilita One', 'Titan One', 'Chewy', 'Permanent Marker',
    'Patrick Hand', 'Gochi Hand', 'Kalam', 'Gloria Hallelujah',
  ],
  'Cursivas / Handwritten': [
    'Dancing Script', 'Caveat', 'Satisfy',
    'Sacramento', 'Great Vibes', 'Allura', 'Parisienne',
    'Alex Brush', 'Courgette', 'Kaushan Script', 'Lobster Two',
    'Marck Script', 'Pinyon Script', 'Rochester',
  ],
  'Mono / Tech': [
    'Space Mono', 'JetBrains Mono', 'Fira Code', 'Source Code Pro',
    'IBM Plex Mono', 'Roboto Mono', 'Courier Prime', 'Share Tech Mono',
  ],
};

const TODAS_FONTES = Object.values(FONTES_CATALOGO).flat();

function FontOption({
  nome, fontWeight = 700, selected, onSelect,
}: {
  key?: React.Key; nome: string; fontWeight?: number; selected: boolean; onSelect: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !nome) return;
    const linkId = `gfont-preview-${nome.replace(/\s/g, '-')}`;
    if (document.getElementById(linkId)) return;
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${nome.replace(/\s/g, '+')}:wght@400;700;900&display=swap`;
    document.head.appendChild(link);
  }, [visible, nome]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      className={`w-full px-4 py-2 text-left text-base transition-colors cursor-pointer flex items-center justify-between ${
        selected ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50 text-slate-700'
      }`}
      style={{
        fontFamily: visible && nome ? `"${nome}", sans-serif` : 'inherit',
        fontSize: '15px',
        fontWeight: visible ? fontWeight : 400,
      }}
    >
      <span>{nome || 'Padrão da marca'}</span>
      {selected && <span className="text-emerald-500 text-xs">✓</span>}
    </button>
  );
}

function FontPickerDropdown({
  label, value, fontWeight, onChange,
}: { label: string; value: string; fontWeight: number; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const filtradas = busca.trim()
    ? TODAS_FONTES.filter(f => f.toLowerCase().includes(busca.toLowerCase()))
    : null;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => { setOpen(!open); setBusca(''); }}
          className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 flex justify-between items-center"
        >
          <span style={{ fontFamily: value ? `"${value}", sans-serif` : 'inherit', fontWeight }}>
            {value || 'Padrão da marca'}
          </span>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl">
            <div className="p-2 border-b border-slate-100">
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar fonte..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
                autoFocus
              />
            </div>
            <div className="max-h-72 overflow-y-auto">
              <FontOption nome="" fontWeight={fontWeight} selected={value === ''} onSelect={() => { onChange(''); setOpen(false); }} />
              {filtradas ? (
                filtradas.map(f => (
                  <FontOption key={f} nome={f} fontWeight={fontWeight} selected={value === f} onSelect={() => { onChange(f); setOpen(false); setBusca(''); }} />
                ))
              ) : (
                Object.entries(FONTES_CATALOGO).map(([categoria, fontes]) => (
                  <div key={categoria}>
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-slate-400 bg-slate-50 sticky top-0">
                      {categoria}
                    </div>
                    {fontes.map(f => (
                      <FontOption key={f} nome={f} fontWeight={fontWeight} selected={value === f} onSelect={() => { onChange(f); setOpen(false); }} />
                    ))}
                  </div>
                ))
              )}
              {filtradas && filtradas.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-slate-400">
                  Nenhuma fonte encontrada para "{busca}"
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ColorSwatchPicker({
  label, value, options, customDefault, onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string; swatch?: string }[];
  customDefault: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      <div className="flex gap-2 flex-wrap items-center">
        {options.map(({ label: optLabel, value: optValue, swatch }) => (
          <button
            key={optLabel}
            type="button"
            onClick={() => onChange(optValue)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer ${
              value === optValue
                ? 'border-slate-600 bg-slate-100 text-slate-800'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            <span
              className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block"
              style={{ backgroundColor: swatch ?? optValue }}
            />
            {optLabel}
          </button>
        ))}
        <input
          type="color"
          value={!value || value.startsWith('rgba') ? customDefault : value}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded-lg cursor-pointer border border-slate-200"
          title="Cor personalizada"
        />
      </div>
    </div>
  );
}

export interface EstiloTextoValues {
  fonteEscolhida: string;
  corTextoPrincipal: string;
  fonteSubtitulo: string;
  corSubtitulo: string;
  corBotaoEscolhida: string;
  corTextoBotao: string;
  fonteBotao: string;
}

type Marca = 'Apice' | 'Barbours';

export function TituloFontColorFields({
  marca, values, onChange,
}: { marca: Marca; values: Pick<EstiloTextoValues, 'fonteEscolhida' | 'corTextoPrincipal'>; onChange: (patch: Partial<EstiloTextoValues>) => void }) {
  const brandColor = marca === 'Apice' ? '#688D65' : '#BF0F26';
  return (
    <>
      <FontPickerDropdown label="Fonte do Título" value={values.fonteEscolhida} fontWeight={700} onChange={(v) => onChange({ fonteEscolhida: v })} />
      <ColorSwatchPicker
        label="Cor do Texto"
        value={values.corTextoPrincipal}
        customDefault="#FFFFFF"
        options={[
          { label: 'Branco', value: '#FFFFFF' },
          { label: 'Preto', value: '#000000' },
          { label: 'Cor da marca', value: brandColor },
          { label: 'Amarelo', value: '#FFD700' },
        ]}
        onChange={(v) => onChange({ corTextoPrincipal: v })}
      />
    </>
  );
}

export function SubtituloFontColorFields({
  marca, values, onChange,
}: { marca: Marca; values: Pick<EstiloTextoValues, 'fonteSubtitulo' | 'corSubtitulo'>; onChange: (patch: Partial<EstiloTextoValues>) => void }) {
  const brandColor = marca === 'Apice' ? '#688D65' : '#BF0F26';
  return (
    <>
      <FontPickerDropdown label="Fonte do Subtítulo" value={values.fonteSubtitulo} fontWeight={400} onChange={(v) => onChange({ fonteSubtitulo: v })} />
      <ColorSwatchPicker
        label="Cor do Subtítulo"
        value={values.corSubtitulo}
        customDefault="#FFFFFF"
        options={[
          { label: 'Branco', value: 'rgba(255,255,255,0.90)', swatch: 'rgba(255,255,255,0.90)' },
          { label: 'Branco puro', value: '#FFFFFF' },
          { label: 'Preto', value: '#000000' },
          { label: 'Cor da marca', value: brandColor },
          { label: 'Amarelo', value: '#FFD700' },
        ]}
        onChange={(v) => onChange({ corSubtitulo: v })}
      />
    </>
  );
}

export function BotaoFontColorFields({
  marca, values, onChange,
}: { marca: Marca; values: Pick<EstiloTextoValues, 'corBotaoEscolhida' | 'corTextoBotao' | 'fonteBotao'>; onChange: (patch: Partial<EstiloTextoValues>) => void }) {
  const brandColor = marca === 'Apice' ? '#688D65' : '#BF0F26';
  return (
    <>
      <ColorSwatchPicker
        label="Cor do Botão"
        value={values.corBotaoEscolhida}
        customDefault={brandColor}
        options={[
          { label: 'Cor da marca', value: '', swatch: brandColor },
          { label: 'Preto', value: '#000000' },
          { label: 'Branco', value: '#FFFFFF' },
          { label: 'Verde', value: '#1A8A4A' },
          { label: 'Vermelho', value: '#BF0F26' },
          { label: 'Azul', value: '#1A6BB5' },
        ]}
        onChange={(v) => onChange({ corBotaoEscolhida: v })}
      />
      <ColorSwatchPicker
        label="Cor da Fonte do Botão"
        value={values.corTextoBotao}
        customDefault="#FFFFFF"
        options={[
          { label: 'Branco', value: '#FFFFFF' },
          { label: 'Preto', value: '#000000' },
          { label: 'Cor da marca', value: brandColor },
          { label: 'Amarelo', value: '#FFD700' },
        ]}
        onChange={(v) => onChange({ corTextoBotao: v })}
      />
      <FontPickerDropdown label="Fonte do Botão" value={values.fonteBotao} fontWeight={800} onChange={(v) => onChange({ fonteBotao: v })} />
    </>
  );
}
