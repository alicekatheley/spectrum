import React, { useState, useRef } from "react";
import { Brand, InputModoB } from "../types";
import { Sparkles, Trash2, ShieldAlert, Eye, RefreshCw, ImagePlus, X } from "lucide-react";
import AspectRatioSelector from "./AspectRatioSelector";
import ImageModelSelector from "./ImageModelSelector";
import DirecionamentoIAField from "./DirecionamentoIAField";
import TipoGeracaoSelector from "./TipoGeracaoSelector";

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
  nome, fontWeight = 700, selected, onSelect
}: {
  key?: React.Key; nome: string; fontWeight?: number;
  selected: boolean; onSelect: () => void;
}) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
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

interface FormModoBProps {
  brand: Brand;
  onSubmit: (input: InputModoB) => void;
  loading: boolean;
  preload?: InputModoB | null;
  key?: string | number;
  aspectRatio: string;
  onAspectRatioChange: (v: string) => void;
  imageModel: string;
  onImageModelChange: (v: string) => void;
  direcionamentoIA: string;
  onDirecionamentoChange: (v: string) => void;
  tipoGeracao: 'texto' | 'imagem' | 'texto_imagem';
  onTipoGeracaoChange: (v: 'texto' | 'imagem' | 'texto_imagem') => void;
  referenciasImagem: string[];
  onReferenciasImagemChange: (v: string[]) => void;
}

export default function FormModoB({ brand, onSubmit, loading, preload, aspectRatio, onAspectRatioChange, imageModel, onImageModelChange, direcionamentoIA, onDirecionamentoChange, tipoGeracao, onTipoGeracaoChange, referenciasImagem, onReferenciasImagemChange }: FormModoBProps) {
  const isApice = brand === 'Apice';
  const brandColor = isApice ? '#688D65' : '#BF0F26';

  // State para cada um dos 5 boxes do Briefing de CRM
  const [boxTituloEmail, setBoxTituloEmail] = useState(preload?.boxTituloEmail ?? "");
  const [boxHeadlineBanner, setBoxHeadlineBanner] = useState(preload?.boxHeadlineBanner ?? "");
  const [boxSubtituloEmail, setBoxSubtituloEmail] = useState(preload?.boxSubtituloEmail ?? "");
  const [boxCta, setBoxCta] = useState(preload?.boxCta ?? "");
  const [boxMecanicaOuEstatico, setBoxMecanicaOuEstatico] = useState(preload?.boxMecanicaOuEstatico ?? "");
  const [boxRecompensa, setBoxRecompensa] = useState(preload?.boxRecompensa ?? "");
  const [estiloVisualTexto, setEstiloVisualTexto] = useState(preload?.estiloVisualTexto ?? '');
  const [quantidadeFrames, setQuantidadeFrames] = useState<number>(
    preload?.quantidadeFrames ?? 3
  );
  const [quantidadeCustom, setQuantidadeCustom] = useState<string>('');
  const [fonteEscolhida, setFonteEscolhida] = useState(preload?.fonteEscolhida ?? '');
  const [estiloBotaoEscolhido, setEstiloBotaoEscolhido] = useState(preload?.estiloBotaoEscolhido ?? 'pill');
  const [corTextoPrincipal, setCorTextoPrincipal] = useState(preload?.corTextoPrincipal ?? '#FFFFFF');
  const [estiloDesign, setEstiloDesign] = useState(preload?.estiloDesign ?? '');
  const [fonteDropdownOpen, setFonteDropdownOpen] = useState(false);
  const [fonteBusca, setFonteBusca] = useState('');
  const [fonteBuscaSub, setFonteBuscaSub] = useState('');
  const [fonteBuscaBotao, setFonteBuscaBotao] = useState('');
  const [fonteSubtitulo, setFonteSubtitulo] = useState(preload?.fonteSubtitulo ?? '');
  const [corSubtitulo, setCorSubtitulo] = useState(preload?.corSubtitulo ?? 'rgba(255,255,255,0.90)');
  const [fonteSubtituloDropdownOpen, setFonteSubtituloDropdownOpen] = useState(false);
  const [corBotaoEscolhida, setCorBotaoEscolhida] = useState(preload?.corBotaoEscolhida ?? '');
  const [fonteBotao, setFonteBotao] = useState(preload?.fonteBotao ?? '');
  const [fonteBotaoDropdownOpen, setFonteBotaoDropdownOpen] = useState(false);
  const [customW, setCustomW] = useState('');
  const [customH, setCustomH] = useState('');

  // Limpar campos individuais
  const clearField = (field: string) => {
    if (field === "titulo") setBoxTituloEmail("");
    if (field === "subtitulo") setBoxSubtituloEmail("");
    if (field === "cta") setBoxCta("");
    if (field === "mecanica") setBoxMecanicaOuEstatico("");
    if (field === "recompensa") setBoxRecompensa("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      brand, // marca obrigatória
      marca: brand, // mantendo duplicado para retrocompatibilidade
      boxTituloEmail,
      boxHeadlineBanner,
      boxSubtituloEmail,
      boxCta,
      boxMecanicaOuEstatico,
      boxRecompensa,
      estiloVisualTexto,
      fonteEscolhida,
      estiloBotaoEscolhido,
      corTextoPrincipal,
      fonteSubtitulo,
      corSubtitulo,
      corBotaoEscolhida,
      fonteBotao,
      estiloDesign,
      aspectRatio: customW && customH ? `custom_${customW}x${customH}` : aspectRatio,
      quantidadeFrames: quantidadeCustom ? parseInt(quantidadeCustom) : quantidadeFrames,
    } as any);
  };

  // Requisitos de caracteres dinâmicos para visualização do usuário
  const assuntoLen = boxTituloEmail.length;
  const minAssunto = isApice ? 27 : 16;
  const maxAssunto = isApice ? 47 : 39;
  const isAssuntoViolandoTamanho = assuntoLen > 0 && (assuntoLen < minAssunto || assuntoLen > maxAssunto);

  // Proibir %, OFF, R$, GRÁTIS no formulário
  const containsProhibitedTerm = (str: string) => {
    const s = str.toUpperCase();
    return s.includes("%") || s.includes("OFF") || s.includes("R$") || s.includes("GRÁTIS") || s.includes("GRATIS");
  };

  const isAssuntoViolandoTermos = containsProhibitedTerm(boxTituloEmail);

  const getAspectRatioWarning = () => {
    if (!customW || !customH) return null;
    const w = parseInt(customW);
    const h = parseInt(customH);
    if (!w || !h) return null;
    const ratio = w / h;
    const standards = [
      { ratio: 1,     name: '1:1',  tolerance: 0.05 },
      { ratio: 0.75,  name: '3:4',  tolerance: 0.05 },
      { ratio: 1.333, name: '4:3',  tolerance: 0.05 },
      { ratio: 1.778, name: '16:9', tolerance: 0.08 },
      { ratio: 0.563, name: '9:16', tolerance: 0.05 },
    ];
    const closest = standards.reduce((prev, curr) =>
      Math.abs(curr.ratio - ratio) < Math.abs(prev.ratio - ratio) ? curr : prev
    );
    const diff = Math.abs(closest.ratio - ratio);
    if (diff <= closest.tolerance) return { type: 'ok', message: `✓ Proporção próxima de ${closest.name} — sem distorção` };
    if (diff <= 0.15) return { type: 'warn', message: `⚠️ Leve distorção possível em relação a ${closest.name}` };
    return { type: 'error', message: `⚠️ Proporção muito diferente do padrão — imagem pode distorcer. Sugestão: ${closest.ratio < 1 ? Math.round(h * closest.ratio) + '×' + h : w + '×' + Math.round(w / closest.ratio)}px` };
  };
  const aspectWarning = getAspectRatioWarning();

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-md border border-slate-100 flex flex-col gap-6">
      <div className="border-b border-slate-100 pb-4 mb-2">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span>Modo B: Geração Co-Pilot / Briefing Parcial</span>
          <span className="text-xs font-normal text-indigo-500 bg-indigo-50 px-2.5 py-0.5 rounded-full">Manual + Refinamento</span>
        </h3>
        <p className="text-slate-500 text-xs mt-1">
          Preencha o que já estruturou na sua mente e a inteligência completa as lacunas, polindo o copy e gerando o briefing do banner de acordo com as regras táticas.
        </p>
      </div>

      <DirecionamentoIAField
        label="Direcionamento para a IA"
        required={false}
        value={direcionamentoIA}
        onChange={onDirecionamentoChange}
      />

      <TipoGeracaoSelector
        value={tipoGeracao}
        onChange={onTipoGeracaoChange}
        brand={brand}
      />

      {/* Campo de Referência Visual */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-slate-700">
            Referência Visual
            <span className="text-xs text-slate-400 font-normal ml-1">
              (Opcional — até 4 imagens)
            </span>
          </label>
          {referenciasImagem.length > 0 && (
            <button
              type="button"
              onClick={() => onReferenciasImagemChange([])}
              className="text-xs text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
            >
              ✕ Limpar todas
            </button>
          )}
        </div>

        {/* Grid de referências */}
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => {
            const src = referenciasImagem[i];
            return (
              <div key={i} className="relative">
                {src ? (
                  <div className="relative rounded-xl overflow-hidden border-2 border-emerald-400 aspect-square">
                    <img src={src} alt={`Ref ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...referenciasImagem];
                        updated.splice(i, 1);
                        onReferenciasImagemChange(updated);
                      }}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs transition-colors cursor-pointer"
                    >
                      ✕
                    </button>
                    <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                      REF {i + 1}
                    </span>
                  </div>
                ) : referenciasImagem.length === i ? (
                  <label className="flex flex-col items-center justify-center w-full aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer gap-1">
                    <span className="text-slate-400 text-xl">+</span>
                    <span className="text-[10px] text-slate-400 font-medium">Adicionar</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const result = ev.target?.result as string;
                          onReferenciasImagemChange([...referenciasImagem, result]);
                        };
                        reader.readAsDataURL(file);
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

        <p className="text-[10px] text-slate-400">
          Adicione até 4 imagens de referência. A IA usará o estilo visual de todas elas.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Box 1: Título do email (Assunto) */}
        <div className={`bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2 relative transition-opacity ${tipoGeracao === 'imagem' ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="box-titulo" className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
              Box 1: Assunto do Email
              <span className="text-[10px] text-slate-400 font-normal normal-case">(Se vazio, a IA gera)</span>
            </label>
            <div className="flex items-center gap-3">
              <span className={`text-[11px] font-mono font-bold ${isAssuntoViolandoTamanho ? 'text-amber-600' : 'text-slate-400'}`}>
                {assuntoLen}c / ideal {minAssunto}-{maxAssunto}c
              </span>
              {boxTituloEmail && (
                <button
                  id="btn-clear-titulo"
                  type="button"
                  onClick={() => clearField("titulo")}
                  className="text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                  title="Limpar campo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <input
            id="box-titulo"
            type="text"
            value={boxTituloEmail}
            onChange={(e) => setBoxTituloEmail(e.target.value)}
            placeholder={isApice ? "Ex: Seu status foi atualizado ✅" : "Ex: ⚠️ (1) atualização pendente"}
            className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all"
          />
          
          {/* Alertas dinâmicos no Assunto */}
          {isAssuntoViolandoTermos && (
            <div className="flex items-start gap-1 text-[11px] text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-100 mt-1">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                <strong>Detector de Risco:</strong> O assunto contém termos comerciais (ex: %, OFF ou R$). A IA irá sanitizar/ajustar seu assunto por segurança ao enviar ao Playbook!
              </span>
            </div>
          )}
          {isAssuntoViolandoTamanho && (
            <div className="flex items-start gap-1 text-[11px] text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100 mt-1">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Comprimento {assuntoLen}c foge da faixa perfeita da marca ({minAssunto}-{maxAssunto}c). A IA tentará recalibrar se necessário.
              </span>
            </div>
          )}
        </div>

        {/* Box 1B: Headline do Banner */}
        <div className={`bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2 relative transition-opacity ${tipoGeracao === 'imagem' ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="box-headline-banner" className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Box 1B: Headline do Banner
              <span className="text-[10px] text-slate-400 font-normal normal-case ml-1">(Se vazio, a IA gera)</span>
            </label>
            {boxHeadlineBanner && (
              <button type="button" onClick={() => setBoxHeadlineBanner("")}
                className="text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <input
            id="box-headline-banner"
            type="text"
            value={boxHeadlineBanner}
            onChange={(e) => setBoxHeadlineBanner(e.target.value)}
            placeholder="Ex: ESTOURE O BALÃO, ABRA O PRESENTE, PUXE O ADESIVO"
            className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all"
          />
          <div className="text-[10px] text-slate-400">
            Texto principal em destaque no topo do banner. Use verbo de ação da mecânica em caixa alta.
          </div>
        </div>

        {/* Box 2: Sub-título do email */}
        <div className={`bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2 relative transition-opacity ${tipoGeracao === 'imagem' ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="box-subtitulo" className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Box 2: Sub-headline do Banner
              <span className="text-[10px] text-slate-400 font-normal normal-case ml-1">(Se vazio, a IA gera)</span>
            </label>
            {boxSubtituloEmail && (
              <button
                id="btn-clear-subtitulo"
                type="button"
                onClick={() => clearField("subtitulo")}
                className="text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                title="Limpar campo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <input
            id="box-subtitulo"
            type="text"
            value={boxSubtituloEmail}
            onChange={(e) => setBoxSubtituloEmail(e.target.value)}
            placeholder="Ex: Seu brinde especial te espera — apenas hoje"
            className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all"
          />
        </div>

        {/* Box 3: Verbo CTA do botão */}
        <div className={`bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2 relative transition-opacity ${tipoGeracao === 'imagem' ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="box-cta-botao" className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Box 3: Verbo CTA do Botão
              <span className="text-[10px] text-slate-400 font-normal normal-case ml-1">(Se vazio, a IA gera)</span>
            </label>
            {boxCta && (
              <button
                id="btn-clear-cta"
                type="button"
                onClick={() => clearField("cta")}
                className="text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                title="Limpar campo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <input
            id="box-cta-botao"
            type="text"
            value={boxCta}
            onChange={(e) => setBoxCta(e.target.value)}
            placeholder="Ex: ABRIR, DESCOBRIR, RASGAR, PUXAR"
            className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all"
          />
          <div className="text-[10px] text-slate-400">
            Recomendado verbo de apenas uma palavra combinada com a mecânica visual.
          </div>
        </div>

        {/* Box 4: Mecânica / GIF animado */}
        <div className={`bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2 relative transition-opacity ${tipoGeracao === 'texto' ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="box-desc-mecanica" className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Box 4: Mecânica do GIF ou Conceito Estático
              <span className="text-[10px] text-slate-400 font-normal normal-case ml-1">(Se vazio, a IA gera)</span>
            </label>
            {boxMecanicaOuEstatico && (
              <button
                id="btn-clear-mecanica"
                type="button"
                onClick={() => clearField("mecanica")}
                className="text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                title="Limpar campo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <textarea
            id="box-desc-mecanica"
            rows={2}
            value={boxMecanicaOuEstatico}
            onChange={(e) => setBoxMecanicaOuEstatico(e.target.value)}
            placeholder={isApice ? "Ex: Um mini post-it colado fofinho que é puxado de lado revelando cupom físico" : "Ex: Um luxuoso cubo de presente que se abre para cima de onde sai o brinde físico da marca"}
            className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all resize-none"
          />
        </div>

        {/* Box 5: Recompensa */}
        <div className={`bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2 relative transition-opacity ${tipoGeracao === 'imagem' ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="box-premio-recompensa" className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Box 5: Recompensa Central
              <span className="text-[10px] text-slate-400 font-normal normal-case ml-1">(Se vazio, a IA gera)</span>
            </label>
            {boxRecompensa && (
              <button
                id="btn-clear-recompensa"
                type="button"
                onClick={() => clearField("recompensa")}
                className="text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                title="Limpar campo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <input
            id="box-premio-recompensa"
            type="text"
            value={boxRecompensa}
            onChange={(e) => setBoxRecompensa(e.target.value)}
            placeholder={isApice ? "Ex: Máscara Nutrição Grátis + Brinde" : "Ex: Cupom de R$ 40 em compras ou Brinde Luxuoso"}
            className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all"
          />
        </div>
      </div>

      {tipoGeracao !== 'texto' && (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Estilo de Design da Imagem
          </span>
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: '', label: 'Padrão' },
              { value: '3D Realista', label: '3D Realista' },
              { value: '3D Cartoon', label: '3D Cartoon' },
              { value: '2D Cartoon', label: '2D Cartoon' },
              { value: 'Fotográfico', label: 'Fotográfico' },
              { value: 'Ilustrado', label: 'Ilustrado' },
              { value: 'Minimalista', label: 'Minimalista' },
              { value: 'Aquarela', label: 'Aquarela' },
              { value: 'Neon/Bold', label: 'Neon/Bold' },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setEstiloDesign(value)}
                className={`py-2 px-1 rounded-lg text-xs font-semibold border transition-all ${
                  estiloDesign === value
                    ? 'border-transparent text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                }`}
                style={estiloDesign === value ? { backgroundColor: brandColor } : {}}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {tipoGeracao !== 'texto' && (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Estilo Visual do Texto
          </span>

          {/* Fonte */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-600">Fonte do Título</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setFonteDropdownOpen(!fonteDropdownOpen); setFonteBusca(''); }}
                className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 flex justify-between items-center"
              >
                <span style={{ fontFamily: fonteEscolhida ? `"${fonteEscolhida}", sans-serif` : 'inherit', fontWeight: 700 }}>
                  {fonteEscolhida || 'Padrão da marca'}
                </span>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${fonteDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {fonteDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl">
                  <div className="p-2 border-b border-slate-100">
                    <input
                      type="text"
                      value={fonteBusca}
                      onChange={(e) => setFonteBusca(e.target.value)}
                      placeholder="Buscar fonte..."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    <FontOption nome="" fontWeight={700} selected={fonteEscolhida === ''} onSelect={() => { setFonteEscolhida(''); setFonteDropdownOpen(false); }} />
                    {fonteBusca.trim() ? (
                      TODAS_FONTES
                        .filter(f => f.toLowerCase().includes(fonteBusca.toLowerCase()))
                        .map(f => (
                          <FontOption key={f} nome={f} fontWeight={700} selected={fonteEscolhida === f} onSelect={() => { setFonteEscolhida(f); setFonteDropdownOpen(false); setFonteBusca(''); }} />
                        ))
                    ) : (
                      Object.entries(FONTES_CATALOGO).map(([categoria, fontes]) => (
                        <div key={categoria}>
                          <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-slate-400 bg-slate-50 sticky top-0">
                            {categoria}
                          </div>
                          {fontes.map(f => (
                            <FontOption key={f} nome={f} fontWeight={700} selected={fonteEscolhida === f} onSelect={() => { setFonteEscolhida(f); setFonteDropdownOpen(false); }} />
                          ))}
                        </div>
                      ))
                    )}
                    {fonteBusca.trim() && TODAS_FONTES.filter(f => f.toLowerCase().includes(fonteBusca.toLowerCase())).length === 0 && (
                      <div className="px-4 py-6 text-center text-sm text-slate-400">
                        Nenhuma fonte encontrada para "{fonteBusca}"
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cor do texto */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-600">Cor do Texto</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: 'Branco', value: '#FFFFFF' },
                { label: 'Preto', value: '#000000' },
                { label: 'Cor da marca', value: brand === 'Apice' ? '#688D65' : '#BF0F26' },
                { label: 'Amarelo', value: '#FFD700' },
              ].map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCorTextoPrincipal(value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer ${
                    corTextoPrincipal === value
                      ? 'border-slate-600 bg-slate-100'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block"
                    style={{ backgroundColor: value }}
                  />
                  {label}
                </button>
              ))}
              <input
                type="color"
                value={corTextoPrincipal}
                onChange={(e) => setCorTextoPrincipal(e.target.value)}
                className="w-9 h-9 rounded-lg cursor-pointer border border-slate-200"
                title="Cor personalizada"
              />
            </div>
          </div>

          {/* Separador */}
          <div className="border-t border-slate-200 pt-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Subtítulo</span>
          </div>

          {/* Fonte do Subtítulo */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-600">Fonte do Subtítulo</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setFonteSubtituloDropdownOpen(!fonteSubtituloDropdownOpen); setFonteBuscaSub(''); }}
                className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 flex justify-between items-center"
              >
                <span style={{ fontFamily: fonteSubtitulo ? `"${fonteSubtitulo}", sans-serif` : 'inherit', fontWeight: 400 }}>
                  {fonteSubtitulo || 'Padrão da marca'}
                </span>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${fonteSubtituloDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {fonteSubtituloDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl">
                  <div className="p-2 border-b border-slate-100">
                    <input
                      type="text"
                      value={fonteBuscaSub}
                      onChange={(e) => setFonteBuscaSub(e.target.value)}
                      placeholder="Buscar fonte..."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    <FontOption nome="" fontWeight={400} selected={fonteSubtitulo === ''} onSelect={() => { setFonteSubtitulo(''); setFonteSubtituloDropdownOpen(false); }} />
                    {fonteBuscaSub.trim() ? (
                      TODAS_FONTES
                        .filter(f => f.toLowerCase().includes(fonteBuscaSub.toLowerCase()))
                        .map(f => (
                          <FontOption key={f} nome={f} fontWeight={400} selected={fonteSubtitulo === f} onSelect={() => { setFonteSubtitulo(f); setFonteSubtituloDropdownOpen(false); setFonteBuscaSub(''); }} />
                        ))
                    ) : (
                      Object.entries(FONTES_CATALOGO).map(([categoria, fontes]) => (
                        <div key={categoria}>
                          <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-slate-400 bg-slate-50 sticky top-0">
                            {categoria}
                          </div>
                          {fontes.map(f => (
                            <FontOption key={f} nome={f} fontWeight={400} selected={fonteSubtitulo === f} onSelect={() => { setFonteSubtitulo(f); setFonteSubtituloDropdownOpen(false); }} />
                          ))}
                        </div>
                      ))
                    )}
                    {fonteBuscaSub.trim() && TODAS_FONTES.filter(f => f.toLowerCase().includes(fonteBuscaSub.toLowerCase())).length === 0 && (
                      <div className="px-4 py-6 text-center text-sm text-slate-400">
                        Nenhuma fonte encontrada para "{fonteBuscaSub}"
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cor do Subtítulo */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-600">Cor do Subtítulo</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: 'Branco', value: 'rgba(255,255,255,0.90)' },
                { label: 'Branco puro', value: '#FFFFFF' },
                { label: 'Preto', value: '#000000' },
                { label: 'Cor da marca', value: brand === 'Apice' ? '#688D65' : '#BF0F26' },
                { label: 'Amarelo', value: '#FFD700' },
              ].map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCorSubtitulo(value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer ${
                    corSubtitulo === value
                      ? 'border-slate-600 bg-slate-100'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block"
                    style={{ backgroundColor: value.startsWith('rgba') ? 'rgba(255,255,255,0.90)' : value }}
                  />
                  {label}
                </button>
              ))}
              <input
                type="color"
                value={corSubtitulo.startsWith('rgba') ? '#FFFFFF' : corSubtitulo}
                onChange={(e) => setCorSubtitulo(e.target.value)}
                className="w-9 h-9 rounded-lg cursor-pointer border border-slate-200"
                title="Cor personalizada"
              />
            </div>
          </div>

          {/* Estilo do botão */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-600">Estilo do Botão CTA</label>
            <div className="flex gap-2">
              {[
                { id: 'pill', label: 'Pill', desc: '●' },
                { id: 'retangular', label: 'Retangular', desc: '■' },
                { id: 'outline', label: 'Outline', desc: '○' },
              ].map(({ id, label, desc }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setEstiloBotaoEscolhido(id)}
                  className={`flex-1 flex flex-col items-center py-2 rounded-xl border-2 text-xs font-bold transition-all cursor-pointer ${
                    estiloBotaoEscolhido === id
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="text-lg">{desc}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Cor do Botão */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-600">Cor do Botão</label>
            <div className="flex gap-2 flex-wrap items-center">
              {[
                { label: 'Cor da marca', value: '' },
                { label: 'Preto', value: '#000000' },
                { label: 'Branco', value: '#FFFFFF' },
                { label: 'Verde', value: '#1A8A4A' },
                { label: 'Vermelho', value: '#BF0F26' },
                { label: 'Azul', value: '#1A6BB5' },
              ].map(({ label, value }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setCorBotaoEscolhida(value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer ${
                    corBotaoEscolhida === value
                      ? 'border-slate-600 bg-slate-100'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block"
                    style={{ backgroundColor: value || (brand === 'Apice' ? '#688D65' : '#BF0F26') }}
                  />
                  {label}
                </button>
              ))}
              <input
                type="color"
                value={corBotaoEscolhida || (brand === 'Apice' ? '#688D65' : '#BF0F26')}
                onChange={(e) => setCorBotaoEscolhida(e.target.value)}
                className="w-9 h-9 rounded-lg cursor-pointer border border-slate-200"
                title="Cor personalizada"
              />
            </div>
          </div>

          {/* Fonte do Botão */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-600">Fonte do Botão</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setFonteBotaoDropdownOpen(!fonteBotaoDropdownOpen); setFonteBuscaBotao(''); }}
                className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 flex justify-between items-center"
              >
                <span style={{ fontFamily: fonteBotao ? `"${fonteBotao}", sans-serif` : 'inherit', fontWeight: 800 }}>
                  {fonteBotao || 'Padrão da marca'}
                </span>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${fonteBotaoDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {fonteBotaoDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl">
                  <div className="p-2 border-b border-slate-100">
                    <input
                      type="text"
                      value={fonteBuscaBotao}
                      onChange={(e) => setFonteBuscaBotao(e.target.value)}
                      placeholder="Buscar fonte..."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    <FontOption nome="" fontWeight={800} selected={fonteBotao === ''} onSelect={() => { setFonteBotao(''); setFonteBotaoDropdownOpen(false); }} />
                    {fonteBuscaBotao.trim() ? (
                      TODAS_FONTES
                        .filter(f => f.toLowerCase().includes(fonteBuscaBotao.toLowerCase()))
                        .map(f => (
                          <FontOption key={f} nome={f} fontWeight={800} selected={fonteBotao === f} onSelect={() => { setFonteBotao(f); setFonteBotaoDropdownOpen(false); setFonteBuscaBotao(''); }} />
                        ))
                    ) : (
                      Object.entries(FONTES_CATALOGO).map(([categoria, fontes]) => (
                        <div key={categoria}>
                          <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-slate-400 bg-slate-50 sticky top-0">
                            {categoria}
                          </div>
                          {fontes.map(f => (
                            <FontOption key={f} nome={f} fontWeight={800} selected={fonteBotao === f} onSelect={() => { setFonteBotao(f); setFonteBotaoDropdownOpen(false); }} />
                          ))}
                        </div>
                      ))
                    )}
                    {fonteBuscaBotao.trim() && TODAS_FONTES.filter(f => f.toLowerCase().includes(fonteBuscaBotao.toLowerCase())).length === 0 && (
                      <div className="px-4 py-6 text-center text-sm text-slate-400">
                        Nenhuma fonte encontrada para "{fonteBuscaBotao}"
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tipoGeracao !== 'texto' && (
        <div className="flex flex-col gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Quantidade de Frames do GIF
          </label>
          <div className="flex flex-wrap gap-2 items-center">
            {[3, 5, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { setQuantidadeFrames(n); setQuantidadeCustom(''); }}
                className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all cursor-pointer ${
                  quantidadeFrames === n && !quantidadeCustom
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {n} frames
              </button>
            ))}
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={2}
                max={20}
                value={quantidadeCustom}
                onChange={(e) => {
                  setQuantidadeCustom(e.target.value);
                  if (e.target.value) setQuantidadeFrames(0);
                }}
                placeholder="Outro"
                className={`w-20 border-2 rounded-xl px-3 py-2 text-sm font-bold text-center transition-all focus:outline-none ${
                  quantidadeCustom
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              />
              {quantidadeCustom && (
                <span className="text-xs text-slate-500">frames</span>
              )}
            </div>
          </div>
          <p className="text-[10px] text-slate-400">
            Descreva a lógica de cada frame no campo "Direcionamento para a IA" acima.
            Sem direcionamento, a IA cria frames com progressão automática.
          </p>
        </div>
      )}

      <AspectRatioSelector
        value={aspectRatio}
        onChange={onAspectRatioChange}
        brand={brand}
      />

      <div className="flex flex-col gap-2 mt-2">
        <span className="text-xs font-semibold text-slate-600">
          Ou defina em pixels:
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="number"
            min={100}
            max={4000}
            value={customW}
            onChange={(e) => setCustomW(e.target.value)}
            placeholder="Largura"
            className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          <span className="text-slate-400 font-bold">×</span>
          <input
            type="number"
            min={100}
            max={4000}
            value={customH}
            onChange={(e) => setCustomH(e.target.value)}
            placeholder="Altura"
            className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          <span className="text-xs text-slate-400">px</span>
          {customW && customH && (
            <button
              type="button"
              onClick={() => { setCustomW(''); setCustomH(''); }}
              className="text-xs text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
            >
              ✕ Limpar
            </button>
          )}
        </div>
        {aspectWarning && (
          <p className={`text-[11px] font-medium ${
            aspectWarning.type === 'ok'   ? 'text-emerald-600' :
            aspectWarning.type === 'warn' ? 'text-amber-500' : 'text-rose-500'
          }`}>
            {aspectWarning.message}
          </p>
        )}
        {customW && customH && (
          <span className="text-[10px] text-emerald-600 font-semibold">
            ✓ Usando {customW}×{customH}px — proporções padrão ignoradas
          </span>
        )}
      </div>

      {tipoGeracao !== 'texto' && (
        <ImageModelSelector
          value={imageModel}
          onChange={onImageModelChange}
          brand={brand}
        />
      )}

      <button
        id="btn-submit-modo-b"
        type="submit"
        disabled={loading}
        className={`w-full py-4 text-sm font-bold tracking-wider uppercase rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
          loading 
            ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
            : brand === 'Apice'
              ? 'bg-[#688D65] hover:bg-[#52704f] text-white shadow-lg shadow-[#688D65]/20'
              : 'bg-[#BF0F26] hover:bg-[#990c1e] text-white shadow-lg shadow-[#BF0F26]/20'
        }`}
      >
        {loading ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Integrando Briefing & Preenchendo...
          </>
        ) : (
          <>
            ✦ Completar e Fechar Pauta com IA ✦
          </>
        )}
      </button>
    </form>
  );
}
