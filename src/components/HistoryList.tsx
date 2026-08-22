import { useState } from "react";
import { PautaGerada } from "../types";
import { TrendingUp, Trash, ListFilter, Download, Calendar, List, Search, X } from "lucide-react";
import { downloadFile, modoLabel } from "../utils";

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
  historySearchQuery: string;
  setHistorySearchQuery: (v: string) => void;
  historyTimeRange: '7d' | '30d' | '60d' | '120d' | 'custom';
  setHistoryTimeRange: (v: '7d' | '30d' | '60d' | '120d' | 'custom') => void;
  customDateRange: { start: string; end: string };
  setCustomDateRange: (v: { start: string; end: string }) => void;
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
  historySearchQuery,
  setHistorySearchQuery,
  historyTimeRange,
  setHistoryTimeRange,
  customDateRange,
  setCustomDateRange,
}: HistoryListProps) {
  const hasActiveFilters = brandFilter !== "all" || statusFilter !== "all" || modoFilter !== "all" || tipoGeracaoFilter !== "all" || historySearchQuery.trim() !== "";

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
      modoLabel(p.modo),
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

    const BOM = "﻿";
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
    <div className="bg-[var(--shell-panel)] text-[var(--shell-text)] rounded-3xl p-6 shadow-xl border border-[var(--shell-border)] flex flex-col gap-6 text-left" id="historical-crm-consolidation-panel">

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[var(--shell-border)] pb-5">
        <div>
          <h3 className="text-base font-black text-[var(--shell-text)] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Consolidação Operacional de CRM Hits
          </h3>
          <p className="text-[var(--shell-text-muted)] text-xs mt-0.5">
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
              className="text-xs text-rose-400 hover:text-rose-350 bg-[var(--shell-panel-soft)] border border-[var(--shell-border)] hover:border-rose-900/40 px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
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
        <div className="bg-[var(--shell-panel-soft)] border border-[var(--shell-border)] p-4 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] text-[var(--shell-text-muted)] uppercase font-extrabold tracking-wider">Pautas Aprovadas</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold font-sans text-[var(--shell-text)]">{totalAprovadas}</span>
            <span className="text-xs text-[var(--shell-text-muted)]">unid.</span>
          </div>
        </div>

        <div className="bg-[var(--shell-panel-soft)] border border-[var(--shell-border)] p-4 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] text-[var(--shell-text-muted)] uppercase font-extrabold tracking-wider">Receita Est. Acumulada</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold font-sans text-emerald-400">
              {receitaPlanejadaAcumulada > 0
                ? `R$ ${(receitaPlanejadaAcumulada / 1000).toFixed(1)}k`
                : 'R$ 0,0'
              }
            </span>
            <span className="text-xs text-[var(--shell-text-muted)]">projetado</span>
          </div>
        </div>

        <div className="bg-[var(--shell-panel-soft)] border border-[var(--shell-border)] p-4 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] text-[var(--shell-text-muted)] uppercase font-extrabold tracking-wider">Abertura Projetada Méd.</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold font-sans text-amber-400">{aberturaMediaAprovadas}%</span>
            <span className="text-xs text-[var(--shell-text-muted)]">taxa</span>
          </div>
        </div>

        <div className="bg-[var(--shell-panel-soft)] border border-[var(--shell-border)] p-4 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] text-[var(--shell-text-muted)] uppercase font-extrabold tracking-wider">Histórico Gerado</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold font-sans text-[var(--shell-text)]">{history.length}</span>
            <span className="text-xs text-[var(--shell-text-muted)]">geradas</span>
          </div>
        </div>
      </div>
      </div>

      {/* Barra de Seleção de Visualização de Sub-Abas e Filtros */}
      <div className="bg-[var(--shell-panel-soft)] p-3.5 rounded-2xl border border-[var(--shell-border)] flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        {/* Toggle para Modo de Visualização: Lista vs Planejador Semanal (Point 4) */}
        <div className="flex bg-[var(--shell-panel)] rounded-xl p-1 border border-[var(--shell-border)] text-xs self-start lg:self-auto select-none">
          <button
            id="subtab-btn-history-list"
            onClick={() => setHistorySubTab('lista')}
            className={`px-4 py-2 rounded-lg font-bold tracking-wider uppercase transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
              historySubTab === 'lista'
                ? "bg-slate-800 text-white font-extrabold shadow"
                : "text-[var(--shell-text-muted)] hover:text-[var(--shell-text)]"
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
                : "text-[var(--shell-text-muted)] hover:text-[var(--shell-text)]"
            }`}
            style={{ backgroundColor: historySubTab === 'planner' ? '#4f46e5' : '' }}
          >
            <Calendar className="w-3.5 h-3.5 text-amber-300" />
            Planejador Semanal
          </button>
        </div>

        {/* Filtros em cascata: busca + 4 linhas */}
        <div className="flex flex-col gap-2 w-full lg:w-auto">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--shell-text-muted)] mb-0.5">
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

          {/* Busca por texto (assunto / headline / sub / CTA) */}
          <div className="relative w-full lg:w-72">
            <Search className="w-3.5 h-3.5 text-[var(--shell-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={historySearchQuery}
              onChange={(e) => setHistorySearchQuery(e.target.value)}
              placeholder="Buscar por assunto, headline, CTA..."
              className="w-full bg-[var(--shell-panel)] border border-[var(--shell-border)] rounded-xl pl-8 pr-8 py-2 text-xs text-[var(--shell-text)] placeholder:text-[var(--shell-text-muted)] focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {historySearchQuery && (
              <button
                type="button"
                onClick={() => setHistorySearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--shell-text-muted)] hover:text-[var(--shell-text)] cursor-pointer"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Linha 1: Marca */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-[var(--shell-text-muted)] w-14 shrink-0">Marca</span>
            <div className="flex bg-[var(--shell-panel)] rounded-xl p-1 border border-[var(--shell-border)] text-xs">
              <button
                id="btn-filter-brand-all"
                onClick={() => setBrandFilter("all")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${brandFilter === "all" ? "bg-slate-800 text-white font-bold" : "text-[var(--shell-text-muted)]"}`}
              >
                Todas
              </button>
              <button
                id="btn-filter-brand-apice"
                onClick={() => setBrandFilter("Apice")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${brandFilter === "Apice" ? "bg-[#325E49] text-white font-bold" : "text-[var(--shell-text-muted)]"}`}
              >
                Apice
              </button>
              <button
                id="btn-filter-brand-barbours"
                onClick={() => setBrandFilter("Barbours")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${brandFilter === "Barbours" ? "bg-[#BF0F26] text-white font-bold" : "text-[var(--shell-text-muted)]"}`}
              >
                Barbours
              </button>
            </div>
          </div>

          {/* Linha 2: Modo */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-[var(--shell-text-muted)] w-14 shrink-0">Modo</span>
            <div className="flex bg-[var(--shell-panel)] rounded-xl p-1 border border-[var(--shell-border)] text-xs">
              <button
                id="btn-filter-modo-all"
                onClick={() => setModoFilter("all")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${modoFilter === "all" ? "bg-slate-800 text-white font-bold" : "text-[var(--shell-text-muted)]"}`}
              >
                Todos
              </button>
              <button
                id="btn-filter-modo-a"
                onClick={() => setModoFilter("A")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${modoFilter === "A" ? "bg-slate-700 text-white font-bold" : "text-[var(--shell-text-muted)]"}`}
              >
                Modo A
              </button>
              <button
                id="btn-filter-modo-b"
                onClick={() => setModoFilter("B")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${modoFilter === "B" ? "bg-indigo-700 text-white font-bold" : "text-[var(--shell-text-muted)]"}`}
              >
                Modo B
              </button>
            </div>
          </div>

          {/* Linha 3: Tipo de Geração */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-[var(--shell-text-muted)] w-14 shrink-0">Tipo</span>
            <div className="flex bg-[var(--shell-panel)] rounded-xl p-1 border border-[var(--shell-border)] text-xs">
              <button
                id="btn-filter-tipo-all"
                onClick={() => setTipoGeracaoFilter("all")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${tipoGeracaoFilter === "all" ? "bg-slate-800 text-white font-bold" : "text-[var(--shell-text-muted)]"}`}
              >
                Todos
              </button>
              <button
                id="btn-filter-tipo-texto-imagem"
                onClick={() => setTipoGeracaoFilter("texto_imagem")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${tipoGeracaoFilter === "texto_imagem" ? "bg-slate-700 text-white font-bold" : "text-[var(--shell-text-muted)]"}`}
              >
                Texto+Img
              </button>
              <button
                id="btn-filter-tipo-texto"
                onClick={() => setTipoGeracaoFilter("texto")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${tipoGeracaoFilter === "texto" ? "bg-slate-700 text-white font-bold" : "text-[var(--shell-text-muted)]"}`}
              >
                Só Texto
              </button>
              <button
                id="btn-filter-tipo-imagem"
                onClick={() => setTipoGeracaoFilter("imagem")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${tipoGeracaoFilter === "imagem" ? "bg-slate-700 text-white font-bold" : "text-[var(--shell-text-muted)]"}`}
              >
                Só Imagem
              </button>
            </div>
          </div>

          {/* Linha 4: Status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-[var(--shell-text-muted)] w-14 shrink-0">Status</span>
            <div className="flex bg-[var(--shell-panel)] rounded-xl p-1 border border-[var(--shell-border)] text-xs">
              <button
                id="btn-filter-status-all"
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${statusFilter === "all" ? "bg-slate-800 text-white font-bold" : "text-[var(--shell-text-muted)]"}`}
              >
                Todos
              </button>
              <button
                id="btn-filter-status-rascunho"
                onClick={() => setStatusFilter("rascunho")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${statusFilter === "rascunho" ? "bg-amber-600/50 text-white font-bold border border-amber-500/20" : "text-[var(--shell-text-muted)]"}`}
              >
                Rascunho
              </button>
              <button
                id="btn-filter-status-aprovado"
                onClick={() => setStatusFilter("aprovado")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${statusFilter === "aprovado" ? "bg-emerald-600/50 text-white font-bold border border-emerald-500/30" : "text-[var(--shell-text-muted)]"}`}
              >
                Aprovado
              </button>
              <button
                id="btn-filter-status-descartado"
                onClick={() => setStatusFilter("descartado")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${statusFilter === "descartado" ? "bg-rose-900/50 text-white font-bold border border-rose-800/30" : "text-[var(--shell-text-muted)]"}`}
              >
                Descartado
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Filtro de período — janelas relativas ou intervalo customizado no calendário */}
      {historySubTab === 'lista' && (
        <div className="bg-[var(--shell-panel-soft)] p-3.5 rounded-2xl border border-[var(--shell-border)] flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--shell-text-muted)]">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            Período
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {([
              ['7d', 'Últimos 7d'],
              ['30d', 'Últimos 30d'],
              ['60d', 'Últimos 60d'],
              ['120d', 'Últimos 120d'],
            ] as const).map(([value, labelText]) => (
              <button
                key={value}
                type="button"
                onClick={() => setHistoryTimeRange(value)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  historyTimeRange === value
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow'
                    : 'bg-[var(--shell-panel)] border-[var(--shell-border)] text-[var(--shell-text-muted)] hover:text-[var(--shell-text)]'
                }`}
              >
                {labelText}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setHistoryTimeRange('custom')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                historyTimeRange === 'custom'
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow'
                  : 'bg-[var(--shell-panel)] border-[var(--shell-border)] text-[var(--shell-text-muted)] hover:text-[var(--shell-text)]'
              }`}
            >
              Personalizado
            </button>

            {historyTimeRange === 'custom' && (
              <div className="flex items-center gap-2 ml-1">
                <input
                  type="date"
                  value={customDateRange.start}
                  onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                  className="bg-[var(--shell-panel)] border border-[var(--shell-border)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--shell-text)] focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[var(--shell-text-muted)] text-xs">até</span>
                <input
                  type="date"
                  value={customDateRange.end}
                  onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                  className="bg-[var(--shell-panel)] border border-[var(--shell-border)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--shell-text)] focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
