import { PautaGerada } from "../types";
import { Calendar, AlertTriangle, Clock, ArrowRight, Eye, CalendarRange, RefreshCw } from "lucide-react";

interface WeeklyPlannerProps {
  pautas: PautaGerada[];
  onOpenPreview: (pauta: PautaGerada) => void;
  onUpdatePautaDay: (pautaId: string, newDay: string) => void;
}

const DAYS_OF_WEEK = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo"
];

export default function WeeklyPlanner({ pautas, onOpenPreview, onUpdatePautaDay }: WeeklyPlannerProps) {
  
  // Categorize a pauta to one of the 7 days of the week
  function getPautaDay(pauta: PautaGerada): string {
    const day = pauta.operacional.diaRecomendado.toLowerCase();
    if (day.includes("seg") || day.includes("mon")) return "Segunda-feira";
    if (day.includes("ter") || day.includes("tue")) return "Terça-feira";
    if (day.includes("qua") || day.includes("wed")) return "Quarta-feira";
    if (day.includes("qui") || day.includes("thu")) return "Quinta-feira";
    if (day.includes("sex") || day.includes("fri")) return "Sexta-feira";
    if (day.includes("sab") || day.includes("sat") || day.includes("sáb")) return "Sábado";
    if (day.includes("dom") || day.includes("sun")) return "Domingo";
    
    // Fallback standard day per brand
    return pauta.marca === "Apice" ? "Quarta-feira" : "Domingo";
  }

  // Filter approved or active pautas (show approved first, but can display draft rascunhos as planned drafts too!)
  const plannedPautas = pautas.filter(p => p.status !== 'descartado');

  // Group campaigns by day
  const campaignsByDay: Record<string, PautaGerada[]> = {};
  DAYS_OF_WEEK.forEach(day => {
    campaignsByDay[day] = [];
  });

  plannedPautas.forEach(p => {
    const day = getPautaDay(p);
    if (campaignsByDay[day]) {
      campaignsByDay[day].push(p);
    } else {
      // Catch-all
      campaignsByDay["Quarta-feira"].push(p);
    }
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-6 text-left" id="weekly-campaign-planner">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-indigo-400" />
            Weekly Planner: Calendário Semanal Planificado CRM
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Gerencie o fluxo de disparos de marcas para evitar canibalização da base nas quartas-feiras ou domingos.
          </p>
        </div>
        
        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-1.5 shrink-0 select-none">
          <span className="w-2.5 h-2.5 bg-[#688D65] rounded-full inline-block"></span>
          <span>Apice</span>
          <span className="w-2.5 h-2.5 bg-[#BF0F26] rounded-full inline-block ml-2"></span>
          <span>Barbours</span>
        </div>
      </div>

      {/* Grid Semanal responsivo */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3.5 mt-2">
        {DAYS_OF_WEEK.map((day) => {
          const dayCampaigns = campaignsByDay[day] || [];
          const hasClash = dayCampaigns.length > 1; // Duplicidade de disparos no mesmo dia

          return (
            <div 
              key={day}
              className={`flex flex-col rounded-2xl border min-h-[340px] transition-all bg-slate-950/30 p-2.5 h-full ${
                hasClash 
                  ? "border-amber-500/30 bg-amber-500/[0.02]" 
                  : "border-slate-850 bg-slate-950/20"
              }`}
            >
              {/* Dia da Semana Header */}
              <div className="pb-2 border-b border-slate-800 flex justify-between items-center mb-2.5 shrink-0 px-1">
                <span className="text-xs font-black tracking-wider text-slate-200 uppercase">
                  {day.split("-")[0]}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  dayCampaigns.length > 0 
                    ? "bg-slate-800 text-slate-350" 
                    : "text-slate-600 font-normal"
                }`}>
                  {dayCampaigns.length}
                </span>
              </div>

              {/* Conflito alert */}
              {hasClash && (
                <div className="bg-amber-500/10 border border-amber-500/30 text-[10px] p-2 rounded-xl text-amber-300 font-medium leading-relaxed mb-2.5 flex gap-1 items-start shadow-sm">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Aviso de Clivagem:</span> Envio simultâneo detectado. Risco de fadiga das assinantes!
                  </div>
                </div>
              )}

              {/* Lista de cards do dia */}
              <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto">
                {dayCampaigns.map((p) => {
                  const isApice = p.marca === "Apice";
                  const statusColor = 
                    p.status === "aprovado" 
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" 
                      : "bg-amber-500/20 text-amber-300 border-amber-500/30";

                  return (
                    <div 
                      key={p.id}
                      className={`relative rounded-xl border p-2.5 flex flex-col gap-2 shadow-lg group hover:scale-[1.02] transition-all duration-300 ${
                        isApice 
                          ? "border-[#688D65]/40 bg-[#688D65]/5 text-emerald-100/90" 
                          : "border-[#BF0F26]/30 bg-[#BF0F26]/5 text-rose-100/90"
                      }`}
                    >
                      {/* Brand Label & Indicator */}
                      <div className="flex justify-between items-center">
                        <span className={`text-[9px] uppercase font-serif-brand italic font-extrabold select-none ${
                          isApice ? "text-emerald-300" : "text-rose-400"
                        }`}>
                          {p.marca}
                        </span>
                        
                        <div className="flex gap-1.5 items-center">
                          <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${statusColor}`}>
                            {p.status}
                          </span>
                        </div>
                      </div>

                      {/* Mechanics / Headline Text */}
                      <div className="text-[10px] font-black uppercase text-slate-100 truncate tracking-tight leading-none mt-1">
                        {p.operacional.mecanicaEscolhida || "Abra a caneca"}
                      </div>
                      
                      <div className="text-[10px] font-medium text-slate-350 leading-tight italic truncate">
                        "{p.copy.assunto}"
                      </div>

                      {/* Info & Metrics */}
                      <div className="bg-slate-900/90 border border-slate-850 p-1.5 rounded-lg flex flex-col gap-0.5 text-[9px] font-mono leading-tight mt-1">
                        <div className="flex justify-between font-bold">
                          <span className="text-slate-500">Abertura:</span>
                          <span className="text-amber-400">{p.previsao.aberturaEsperada}</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span className="text-slate-500">Janela:</span>
                          <span className="text-indigo-300">{p.operacional.horarioRecomendado}</span>
                        </div>
                      </div>

                      {/* Quick Dropdown: Reschedule action and popup trigger */}
                      <div className="flex justify-between items-center gap-1.5 border-t border-slate-800/60 pt-2 mt-1 shrink-0">
                        <button
                          id={`btn-planner-view-mockup-${p.id}`}
                          onClick={() => onOpenPreview(p)}
                          className="p-1 hover:bg-slate-800 rounded text-slate-300 cursor-pointer transition-colors"
                          title="Visualizar no Celular"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <div className="relative inline-block w-full text-right">
                          <select
                            id={`planner-reschedule-select-${p.id}`}
                            value={day}
                            onChange={(e) => onUpdatePautaDay(p.id, e.target.value)}
                            className="bg-slate-900/80 hover:bg-slate-800 text-[8px] font-black text-slate-300 uppercase px-1.5 py-1 rounded border border-slate-800 max-w-[80px] truncate leading-none outline-none cursor-pointer"
                            title="Reagendar pauta para outro dia"
                          >
                            {DAYS_OF_WEEK.map(dOption => (
                              <option key={dOption} value={dOption} className="text-slate-900 text-xs font-bold uppercase p-2">
                                REPLANARA {dOption.split("-")[0].toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>

              {dayCampaigns.length === 0 && (
                <div className="flex-1 flex flex-col justify-center items-center text-center p-3 text-[9px] text-slate-600 border border-dashed border-slate-850/60 rounded-xl select-none">
                  <Clock className="w-5 h-5 opacity-20 mb-1" />
                  Vazio
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
