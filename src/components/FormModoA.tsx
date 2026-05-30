import React, { useState } from "react";
import { Brand, CampaignContext, RewardType, InputModoA } from "../types";
import { Calendar, Layers, Gift, AlertCircle, RefreshCw, HelpCircle } from "lucide-react";
import AspectRatioSelector from "./AspectRatioSelector";
import ImageModelSelector from "./ImageModelSelector";
import DirecionamentoIAField from "./DirecionamentoIAField";
import TipoGeracaoSelector from "./TipoGeracaoSelector";

interface FormModoAProps {
  brand: Brand;
  onSubmit: (input: InputModoA) => void;
  loading: boolean;
  aspectRatio: string;
  onAspectRatioChange: (v: string) => void;
  imageModel: string;
  onImageModelChange: (v: string) => void;
  direcionamentoIA: string;
  onDirecionamentoChange: (v: string) => void;
  tipoGeracao: 'texto' | 'imagem' | 'texto_imagem';
  onTipoGeracaoChange: (v: 'texto' | 'imagem' | 'texto_imagem') => void;
}

const CONTEXTS: { value: CampaignContext; label: string }[] = [
  { value: "lancamento", label: "Lançamento" },
  { value: "recompra", label: "Recompra" },
  { value: "reativacao", label: "Reativação" },
  { value: "sazonal", label: "Sazonal" },
  { value: "queima_estoque", label: "Queima de Estoque" },
  { value: "datas_comemorativas", label: "Datas Comemorativas" },
];

const REWARDS: { value: RewardType; label: string }[] = [
  { value: "choose_for_me", label: "🪄 Escolher pra mim (Otimizado por IA)" },
  { value: "desconto_percentual", label: "🏷️ % Desconto" },
  { value: "cupom_valor_fixo", label: "💵 Cupom Valor Fixo" },
  { value: "brinde_fisico", label: "🎁 Brinde Físico" },
  { value: "produto_mimo", label: "🌸 Produto + Mimo" },
  { value: "combo", label: "📦 Combo Especial" },
];

const MECANICAS = [
  "Abra o presente",
  "Abra a caixa",
  "Abra a carta",
  "Puxe o Adesivo",
  "Corte o fio",
  "Jogo da Velha",
  "Rasgue o papel",
  "Puxe o post-it",
  "Estoure o balão",
  "Puxe o cupom"
];

export default function FormModoA({ brand, onSubmit, loading, aspectRatio, onAspectRatioChange, imageModel, onImageModelChange, direcionamentoIA, onDirecionamentoChange, tipoGeracao, onTipoGeracaoChange }: FormModoAProps) {
  const [quantidadePautas, setQuantidadePautas] = useState<number>(3);
  const [contextoCampanha, setContextoCampanha] = useState<CampaignContext | "">("");
  const [segmentoAlvo, setSegmentoAlvo] = useState<string>("Principal Padrão");
  const [dataDisparo, setDataDisparo] = useState<string>("");
  const [tipoRecompensa, setTipoRecompensa] = useState<RewardType>("choose_for_me");
  const [evitarMecanicas, setEvitarMecanicas] = useState<string[]>([]);
  const [direcionamentoError, setDirecionamentoError] = useState<string>('');

  const handleToggleMecanica = (mecanica: string) => {
    if (evitarMecanicas.includes(mecanica)) {
      setEvitarMecanicas(evitarMecanicas.filter((m) => m !== mecanica));
    } else {
      setEvitarMecanicas([...evitarMecanicas, mecanica]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (direcionamentoIA.trim() === '') {
      setDirecionamentoError('Preencha o direcionamento antes de gerar.');
      return;
    }
    onSubmit({
      marca: brand,
      quantidadePautas,
      contextoCampanha,
      segmentoAlvo,
      dataDisparo,
      tipoRecompensa,
      evitarMecanicas,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-md border border-slate-100 flex flex-col gap-6">
      <div className="border-b border-slate-100 pb-4 mb-2">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span>Modo A: Descoberta Livre</span>
          <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Automático</span>
        </h3>
        <p className="text-slate-500 text-xs mt-1">
          A IA analisa o banco histórico de hits da marca e recomenda as melhores propostas completas.
        </p>
      </div>

      {/* Quantidade de Pautas */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <label htmlFor="input-qty-pautas" className="text-sm font-semibold text-slate-700 font-sans">
            Quantidade de Pautas a sugerir
          </label>
          <span className="text-sm font-bold bg-slate-100 text-slate-800 px-3 py-1 rounded-lg">
            {quantidadePautas} {quantidadePautas === 1 ? 'sugestão' : 'sugestões'}
          </span>
        </div>
        <input
          id="input-qty-pautas"
          type="range"
          min="1"
          max="5"
          value={quantidadePautas}
          onChange={(e) => setQuantidadePautas(parseInt(e.target.value))}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-800"
        />
        <div className="flex justify-between text-[10px] text-slate-400 px-1">
          <span>1 pauta</span>
          <span>3 pautas (Padrão)</span>
          <span>5 pautas</span>
        </div>
      </div>

      <DirecionamentoIAField
        label="Direcionamento para a IA"
        required={true}
        value={direcionamentoIA}
        onChange={(v) => { setDirecionamentoError(''); onDirecionamentoChange(v); }}
        error={direcionamentoError}
      />

      <TipoGeracaoSelector
        value={tipoGeracao}
        onChange={onTipoGeracaoChange}
        brand={brand}
      />

      {/* Contexto da Campanha */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          Contexto de Campanha <span className="text-slate-400 font-normal text-xs">(Opcional)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {CONTEXTS.map((item) => (
            <button
              id={`chip-contexto-${item.value}`}
              type="button"
              key={item.value}
              onClick={() => setContextoCampanha(contextoCampanha === item.value ? "" : item.value)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all duration-200 cursor-pointer ${
                contextoCampanha === item.value
                  ? brand === 'Apice'
                    ? 'bg-[#688D65]/10 border-[#688D65] text-[#688D65]'
                    : 'bg-[#BF0F26]/10 border-[#BF0F26] text-[#BF0F26]'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Segmento Alvo */}
        <div className="flex flex-col gap-2">
          <label htmlFor="select-segmento" className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-slate-400" />
            Segmento Alvo
          </label>
          <select
            id="select-segmento"
            value={segmentoAlvo}
            onChange={(e) => setSegmentoAlvo(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all font-medium"
          >
            <option value="Principal Padrão">Principal Padrão (Hits de alto retorno)</option>
            <option value="Abertura 3x30d">Abertura Recente (3 aberturas em 30d para volume)</option>
            <option value="Desengajados">Desengajados (Gera mecânicas de baixíssimo atrito)</option>
            <option value="Compradores Recorrentes">Compradores Recorrentes</option>
            <option value="Abertura 0x90">Inativos (Abertura 0x90d)</option>
          </select>
          {segmentoAlvo === "Desengajados" && (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                <strong>Regra Ativada:</strong> Segmento desengajado força a IA a restringir mecânicas para menor barreira de engajamento (Ex: abrir primeiro antes de jogar).
              </span>
            </div>
          )}
        </div>

        {/* Tipo de Recompensa */}
        <div className="flex flex-col gap-2">
          <label htmlFor="select-recompensa" className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <Gift className="w-4 h-4 text-slate-400" />
            Tipo de Recompensa
          </label>
          <select
            id="select-recompensa"
            value={tipoRecompensa}
            onChange={(e) => setTipoRecompensa(e.target.value as RewardType)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all font-medium"
          >
            {REWARDS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Data do Disparo */}
        <div className="flex flex-col gap-2">
          <label htmlFor="input-data-disparo" className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            Previsão de Disparo <span className="text-slate-400 font-normal text-xs">(Opcional)</span>
          </label>
          <input
            id="input-data-disparo"
            type="date"
            value={dataDisparo}
            onChange={(e) => setDataDisparo(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all"
          />
        </div>

        {/* Informações Auxiliares Táticas */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 text-xs text-slate-500 flex flex-col gap-1.5">
          <div className="font-semibold text-slate-700 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            Alinhamento Automático do Playbook
          </div>
          <p className="leading-relaxed">
            {brand === 'Apice' 
              ? 'Mapeia disparos e valida com regras de mecânicas de Manipulação em tons íntimos e acolhedores no Verde Floresta.' 
              : 'Verifica se pautas alinham com mecânicas de Abrir e se contém tons sofisticados inspirados em Ruby Red.'}
          </p>
        </div>
      </div>

      {/* Evitar Mecânicas */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          Evitar Mecânicas recentes <span className="text-slate-400 font-normal text-xs">(Evita repetições indesejadas)</span>
        </label>
        <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100 max-h-36 overflow-y-auto">
          {MECANICAS.map((mec) => {
            const isSelected = evitarMecanicas.includes(mec);
            return (
              <button
                id={`btn-evitar-${mec.toLowerCase().replace(/\s+/g, '-')}`}
                type="button"
                key={mec}
                onClick={() => handleToggleMecanica(mec)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-all ${
                  isSelected
                    ? 'bg-rose-50 border-rose-300 text-rose-700 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                {isSelected ? '❌ ' : ''}
                {mec}
              </button>
            );
          })}
        </div>
      </div>

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
        id="btn-submit-modo-a"
        type="submit"
        disabled={loading || direcionamentoIA.trim() === ''}
        className={`w-full py-4 text-sm font-bold tracking-wider uppercase rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
          loading || direcionamentoIA.trim() === ''
            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
            : brand === 'Apice'
              ? 'bg-[#688D65] hover:bg-[#52704f] text-white shadow-lg shadow-[#688D65]/20'
              : 'bg-[#BF0F26] hover:bg-[#990c1e] text-white shadow-lg shadow-[#BF0F26]/20'
        }`}
      >
        {loading ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Processando Playbook & Historico...
          </>
        ) : (
          <>
            ✦ Sugerir {quantidadePautas} Pautas Hits de {brand} ✦
          </>
        )}
      </button>
    </form>
  );
}
