import { useState } from "react";
import { PautaGerada } from "../types";
import { TrendingUp, Trash, ListFilter, Download, Calendar, List } from "lucide-react";
import { downloadFile } from "../utils";

interface HistoryListProps {
  history: PautaGerada[];
  onClearHistory: () => void;
  brandFilter: "all" | "Apice" | "Barbours";
  setBrandFilter: (brand: "all" | "Apice" | "Barbours") => void;
  statusFilter: "all" | "rascunho" | "aprovado" | "descartado";
  setStatusFilter: (status: "all" | "rascunho" | "aprovado" | "descartado") => void;
  modoFilter: "all" | "A" | "B";
  setModoFilter: (v: "all" | "A" | "B") => void;
  tipoGeracaoFilter: "all" | "texto" | "imagem" | "texto_imagem";
  setTipoGeracaoFilter: (v: "all" | "texto" | "imagem" | "texto_imagem") => void;
  onClearFilters: () => void;
  historySubTab: 'lista' | 'planner';
  setHistorySubTab: (tab: 'lista' | 'planner') => void;
}

export default function HistoryList({
  history,
  onClearHistory,
  brandFilter,
  setBrandFilter,
  statusFilter,
  setStatusFilter,
  modoFilter,
  setModoFilter,
  tipoGeracaoFilter,
  setTipoGeracaoFilter,
  onClearFilters,
  historySubTab,
  setHistorySubTab,
}: HistoryListProps) {
  const hasActiveFilters = brandFilter !== "all" || statusFilter !== "all" || modoFilter !== "all" || tipoGeracaoFilter !== "all";
  
  // Filter history to calculate accurate metrics
  const approvedCampaigns = history.filter(p => p.status === 'aprovado');
  const totalAprovadas = approvedCampaigns.length;

  // Build and Trigger CSV download of CRM calendar structure (Point 3)
  const triggerCsvExport = () => {
    const listToExport = history.filter(p => p.status !== 'descartado');
    if (listToExport.length === 0) {
      alert("Não existem pautas ativas (Rascunhos ou Aprovados) para exportar no momento.");
      return;
    }

    const headers = [
      "ID",
      "Marca",
      "Fluxo de IA",
      "Dia de Disparo Recomendado",
      "Janela Horaria Ideal",
      "Assunto do Email",
      "Preheader (Fixo)",
      "Headline do Banner",
      "Subheadline do Banner",
      "CTA Botao",
      "Mecanica CRM",
      "Recompensa Selecionada",
      "Receita Projetada",
      "Taxa Abertura Esperada",
      "CTR Esperado (CTOR)",
      "Segmento de Audiencia",
      "Nivel Confiança Previsão",
      "Status de Aprovação"
    ];

    const rows = listToExport.map(p => [
      p.id,
      p.marca,
      p.modo === 'A' ? 'Descoberta Livre' : 'Briefing Assistido',
      p.operacional.diaRecomendado,
      p.operacional.horarioRecomendado,
      p.copy.assunto.replace(/"/g, '""'),
      p.copy.preHeader.replace(/"/g, '""'),
      p.copy.headlineBanner.replace(/"/g, '""'),
      p.copy.subHeadlineBanner.replace(/"/g, '""'),
      p.copy.ctaBotao.replace(/"/g, '""'),
      p.operacional.mecanicaEscolhida.replace(/"/g, '""'),
      p.operacional.recompensaEscolhida.replace(/"/g, '""'),
      String(p.previsao?.receitaEsperada ?? ''),
      String(p.previsao?.aberturaEsperada ?? ''),
      String(p.previsao?.ctorEsperado ?? ''),
      (p.operacional?.segmentoRecomendado ?? '').replace(/"/g, '""'),
      (p.previsao?.confianca ?? '').toUpperCase(),
      p.status
    ]);

    // Force UTF-8 encoding with BOM so Excel parses special Latin characters correctly (á, ç, õ, etc.)
    const csvContent = [headers, ...rows]
      .map(line => line.map(val => `"${val}"`).join(","))
      .join("\n");

    const BOM = "\ufeff";
    downloadFile("cronograma_hits_crm_gocase.csv", BOM + csvContent, "text/csv;charset=utf-8;");
  };

  // Convert expected revenue scale metrics (e.g. "R$ 6k-10k") into numeric average values
  const receitaPlanejadaAcumulada = approvedCampaigns.reduce((acc, p) => {
    const text = p.previsao.receitaEsperada.toLowerCase();
    let num = 0;
    if (text.includes('k')) {
      const matches = text.match(/\d+(\.\d+)?/g);
      if (matches) {
        const keyNums = matches.map(Number);
        const avg = keyNums.reduce((s, k) => s + k, 0) / keyNums.length;
        num = avg * 1000;
      }
    } else {
      const matches = text.replace(/\D/g, ' ');
      const cleanNums = matches.trim().split(/\s+/).map(Number).filter(n => n > 100);
      if (cleanNums.length > 0) {
        num = cleanNums.reduce((s, k) => s + k, 0) / cleanNums.length;
      } else {
        num = p.marca === 'Apice' ? 6200 : 13400; // Calibrated defaults
      }
    }
    return acc + num;
  }, 0);

  const aberturaMediaAprovadas = approvedCampaigns.length > 0 ? (() => {
    const totalAbrev = approvedCampaigns.reduce((acc, p) => {
      const text = p.previsao.aberturaEsperada;
      const matches = text.match(/\d+/g);
      if (matches) {
        const avg = matches.map(Number).reduce((s, k) => s + k, 0) / matches.length;
        return acc + avg;
      }
      return acc + (p.marca === 'Apice' ? 38.9 : 32.5);
    }, 0);
    return (totalAbrev / approvedCampaigns.length).toFixed(1);
  })() : "0.0";

  return (
    <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800 flex flex-col gap-6 text-left" id="historical-crm-consolidation-panel">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Consolidação Operacional de CRM Hits
          </h3>
          <p className="text-slate-400 text-xs mt-0.5">
            Métricas de performance financeira e de abertura agregadas com base nas pautas aprovadas.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Botão de Exportação CSV — oculto quando brand filter ativo */}
          <div className={`overflow-hidden transition-all duration-300 ${brandFilter !== "all" ? 'max-h-0 opacity-0' : 'max-h-20 opacity-100'}`}>
            <button
              id="btn-export-cronograma-csv"
              onClick={triggerCsvExport}
              className="text-xs bg-[#AA834B] hover:bg-[#916E3C] text-slate-950 font-black px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer hover:-translate-y-0.5"
              title="Download CSV do cronograma completo para Importar no Excel ou ferramentas de Email"
            >
              <Download className="w-4 h-4 text-slate-950" />
              Exportar Cronograma (CSV)
            </button>
          </div>

          {history.length > 0 && (
            <button
              id="btn-clear-all-history"
              onClick={onClearHistory}
              className="text-xs text-rose-400 hover:text-rose-350 bg-slate-950/40 border border-slate-800 hover:border-rose-900/40 px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash className="w-3.5 h-3.5" />
              Limpar Tudo
            </button>
          )}
        </div>
      </div>

      {/* Grid de KPIs acumuladas — oculto quando brand filter ativo */}
      <div className={`overflow-hidden transition-all duration-300 ${brandFilter !== "all" ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100'}`}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Pautas Aprovadas</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold font-sans text-slate-100">{totalAprovadas}</span>
            <span className="text-xs text-slate-500">unid.</span>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Receita Est. Acumulada</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold font-sans text-emerald-400">
              {receitaPlanejadaAcumulada > 0 
                ? `R$ ${(receitaPlanejadaAcumulada / 1000).toFixed(1)}k` 
                : 'R$ 0,0'
              }
            </span>
            <span className="text-xs text-slate-500">projetado</span>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Abertura Projetada Méd.</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold font-sans text-amber-400">{aberturaMediaAprovadas}%</span>
            <span className="text-xs text-slate-500">taxa</span>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Histórico Gerado</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold font-sans text-slate-200">{history.length}</span>
            <span className="text-xs text-slate-500">geradas</span>
          </div>
        </div>
      </div>
      </div>

      {/* Barra de Seleção de Visualização de Sub-Abas e Filtros */}
      <div className="bg-slate-950/40 p-3.5 rounded-2xl border border-slate-850 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        
        {/* Toggle para Modo de Visualização: Lista vs Planejador Semanal (Point 4) */}
        <div className="flex bg-slate-950 rounded-xl p-1 border border-slate-800 text-xs self-start lg:self-auto select-none">
          <button
            id="subtab-btn-history-list"
            onClick={() => setHistorySubTab('lista')}
            className={`px-4 py-2 rounded-lg font-bold tracking-wider uppercase transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
              historySubTab === 'lista' 
                ? "bg-slate-800 text-white font-extrabold shadow" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <List className="w-3.5 h-3.5 text-indigo-400" />
            Exibição em Lista
          </button>
          
          <button
            id="subtab-btn-history-planner"
            onClick={() => setHistorySubTab('planner')}
            className={`px-4 py-2 rounded-lg font-bold tracking-wider uppercase transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
              historySubTab === 'planner' 
                ? "bg-indigo-650 text-indigo-200 font-extrabold shadow" 
                : "text-slate-400 hover:text-slate-200"
            }`}
            style={{ backgroundColor: historySubTab === 'planner' ? '#4f46e5' : '' }}
          >
            <Calendar className="w-3.5 h-3.5 text-amber-300" />
            Planejador Semanal
          </button>
        </div>

        {/* Filtros em cascata: 4 linhas */}
        <div className="flex flex-col gap-2 w-full lg:w-auto">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 mb-0.5">
            <ListFilter className="w-3.5 h-3.5 text-indigo-400" />
            Filtrar por:
            {hasActiveFilters && (
              <button
                onClick={onClearFilters}
                className="ml-2 text-[11px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer transition-colors"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {/* Linha 1: Marca */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-slate-500 w-14 shrink-0">Marca</span>
            <div className="flex bg-slate-950 rounded-xl p-1 border border-slate-800 text-xs">
              <button
                id="btn-filter-brand-all"
                onClick={() => setBrandFilter("all")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${brandFilter === "all" ? "bg-slate-800 text-white font-bold" : "text-slate-400"}`}
              >
                Todas
              </button>
              <button
                id="btn-filter-brand-apice"
                onClick={() => setBrandFilter("Apice")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${brandFilter === "Apice" ? "bg-[#325E49] text-white font-bold" : "text-slate-400"}`}
              >
                Apice
              </button>
              <button
                id="btn-filter-brand-barbours"
                onClick={() => setBrandFilter("Barbours")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${brandFilter === "Barbours" ? "bg-[#BF0F26] text-white font-bold" : "text-slate-400"}`}
              >
                Barbours
              </button>
            </div>
          </div>

          {/* Linha 2: Modo */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-slate-500 w-14 shrink-0">Modo</span>
            <div className="flex bg-slate-950 rounded-xl p-1 border border-slate-800 text-xs">
              <button
                id="btn-filter-modo-all"
                onClick={() => setModoFilter("all")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${modoFilter === "all" ? "bg-slate-800 text-white font-bold" : "text-slate-400"}`}
              >
                Todos
              </button>
              <button
                id="btn-filter-modo-a"
                onClick={() => setModoFilter("A")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${modoFilter === "A" ? "bg-slate-700 text-white font-bold" : "text-slate-400"}`}
              >
                Modo A
              </button>
              <button
                id="btn-filter-modo-b"
                onClick={() => setModoFilter("B")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${modoFilter === "B" ? "bg-indigo-700 text-white font-bold" : "text-slate-400"}`}
              >
                Modo B
              </button>
            </div>
          </div>

          {/* Linha 3: Tipo de Geração */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-slate-500 w-14 shrink-0">Tipo</span>
            <div className="flex bg-slate-950 rounded-xl p-1 border border-slate-800 text-xs">
              <button
                id="btn-filter-tipo-all"
                onClick={() => setTipoGeracaoFilter("all")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${tipoGeracaoFilter === "all" ? "bg-slate-800 text-white font-bold" : "text-slate-400"}`}
              >
                Todos
              </button>
              <button
                id="btn-filter-tipo-texto-imagem"
                onClick={() => setTipoGeracaoFilter("texto_imagem")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${tipoGeracaoFilter === "texto_imagem" ? "bg-slate-700 text-white font-bold" : "text-slate-400"}`}
              >
                Texto+Img
              </button>
              <button
                id="btn-filter-tipo-texto"
                onClick={() => setTipoGeracaoFilter("texto")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${tipoGeracaoFilter === "texto" ? "bg-slate-700 text-white font-bold" : "text-slate-400"}`}
              >
                Só Texto
              </button>
              <button
                id="btn-filter-tipo-imagem"
                onClick={() => setTipoGeracaoFilter("imagem")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${tipoGeracaoFilter === "imagem" ? "bg-slate-700 text-white font-bold" : "text-slate-400"}`}
              >
                Só Imagem
              </button>
            </div>
          </div>

          {/* Linha 4: Status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-slate-500 w-14 shrink-0">Status</span>
            <div className="flex bg-slate-950 rounded-xl p-1 border border-slate-800 text-xs">
              <button
                id="btn-filter-status-all"
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${statusFilter === "all" ? "bg-slate-800 text-white font-bold" : "text-slate-400"}`}
              >
                Todos
              </button>
              <button
                id="btn-filter-status-rascunho"
                onClick={() => setStatusFilter("rascunho")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${statusFilter === "rascunho" ? "bg-amber-600/50 text-white font-bold border border-amber-500/20" : "text-slate-400"}`}
              >
                Rascunho
              </button>
              <button
                id="btn-filter-status-aprovado"
                onClick={() => setStatusFilter("aprovado")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${statusFilter === "aprovado" ? "bg-emerald-600/50 text-white font-bold border border-emerald-500/30" : "text-slate-400"}`}
              >
                Aprovado
              </button>
              <button
                id="btn-filter-status-descartado"
                onClick={() => setStatusFilter("descartado")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${statusFilter === "descartado" ? "bg-rose-900/50 text-white font-bold border border-rose-800/30" : "text-slate-400"}`}
              >
                Descartado
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
