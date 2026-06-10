import React, { useState, useRef } from "react";
import { Brand, InputModoB } from "../types";
import { Sparkles, Trash2, ShieldAlert, Eye, RefreshCw, ImagePlus, X } from "lucide-react";
import AspectRatioSelector from "./AspectRatioSelector";
import ImageModelSelector from "./ImageModelSelector";
import DirecionamentoIAField from "./DirecionamentoIAField";
import TipoGeracaoSelector from "./TipoGeracaoSelector";

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
  referenciaImagem: string | null;
  onReferenciaImagemChange: (v: string | null) => void;
}

export default function FormModoB({ brand, onSubmit, loading, preload, aspectRatio, onAspectRatioChange, imageModel, onImageModelChange, direcionamentoIA, onDirecionamentoChange, tipoGeracao, onTipoGeracaoChange, referenciaImagem, onReferenciaImagemChange }: FormModoBProps) {
  const isApice = brand === 'Apice';
  const brandColor = isApice ? '#688D65' : '#BF0F26';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onReferenciaImagemChange(reader.result as string);
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

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
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-slate-700">
          Referência Visual <span className="text-xs font-normal text-slate-400">(Opcional — ajuda a IA a entender o estilo)</span>
        </span>
        {referenciaImagem ? (
          <div className="relative w-full rounded-xl overflow-hidden border-2 border-slate-200 group">
            <img
              src={referenciaImagem}
              alt="Referência visual"
              className="w-full max-h-48 object-cover"
            />
            <button
              type="button"
              onClick={() => onReferenciaImagemChange(null)}
              className="absolute top-2 right-2 bg-slate-900/70 hover:bg-rose-600 text-white rounded-full p-1.5 transition-colors cursor-pointer"
              title="Remover imagem"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-900/60 to-transparent px-3 py-2">
              <span className="text-[10px] text-white font-semibold">Referência carregada ✓</span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-xl p-5 flex flex-col items-center gap-2 transition-all cursor-pointer hover:bg-slate-50 group"
            style={{ borderColor: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = brandColor + '60')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
          >
            <div className="border-2 border-dashed border-slate-200 group-hover:border-slate-300 rounded-xl p-5 w-full flex flex-col items-center gap-2 transition-all"
              style={{}}>
              <ImagePlus className="w-6 h-6 text-slate-300 group-hover:text-slate-400 transition-colors" />
              <span className="text-xs text-slate-400 font-medium">Clique para anexar uma imagem de referência</span>
              <span className="text-[10px] text-slate-300">JPG, PNG ou WEBP</span>
            </div>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageUpload}
          className="hidden"
        />
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
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Estilo Visual do Texto
          </span>

          {/* Fonte */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-600">Fonte do Título</label>
            <select
              value={fonteEscolhida}
              onChange={(e) => setFonteEscolhida(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">Padrão da marca</option>
              <optgroup label="Elegantes / Serif">
                <option value="Playfair Display">Playfair Display</option>
                <option value="Merriweather">Merriweather</option>
                <option value="Abril Fatface">Abril Fatface</option>
                <option value="Lora">Lora</option>
              </optgroup>
              <optgroup label="Modernas / Sans-serif">
                <option value="Montserrat">Montserrat</option>
                <option value="Nunito Sans">Nunito Sans</option>
                <option value="Poppins">Poppins</option>
                <option value="Raleway">Raleway</option>
                <option value="Oswald">Oswald</option>
                <option value="Inter">Inter</option>
                <option value="DM Sans">DM Sans</option>
              </optgroup>
              <optgroup label="Impactantes / Display">
                <option value="Bebas Neue">Bebas Neue</option>
                <option value="Teko">Teko</option>
                <option value="Fjalla One">Fjalla One</option>
                <option value="Barlow">Barlow</option>
                <option value="Black Han Sans">Black Han Sans</option>
              </optgroup>
              <optgroup label="Divertidas / Cartoon">
                <option value="Bangers">Bangers</option>
                <option value="Fredoka One">Fredoka One</option>
                <option value="Boogaloo">Boogaloo</option>
                <option value="Pacifico">Pacifico</option>
                <option value="Righteous">Righteous</option>
              </optgroup>
              <optgroup label="Cursivas / Handwritten">
                <option value="Dancing Script">Dancing Script</option>
                <option value="Caveat">Caveat</option>
                <option value="Satisfy">Satisfy</option>
                <option value="Permanent Marker">Permanent Marker</option>
              </optgroup>
            </select>
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
