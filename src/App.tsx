import { useState, useEffect, useRef } from "react";
import { Brand, PautaGerada, InputModoA, InputModoB } from "./types";
import { getPautas, upsertPautas, clearPautas } from "./lib/pautas-service";
import { supabase, isEmailAllowed } from "./lib/supabase";
import LoginPage from "./components/LoginPage";
import Header from "./components/Header";
import FormModoA from "./components/FormModoA";
import FormModoB from "./components/FormModoB";
import ResultPauta from "./components/ResultPauta";
import { DEFAULT_IMAGE_MODEL } from "./components/ImageModelSelector";
import HistoryList from "./components/HistoryList";
import PreviewModal from "./components/PreviewModal";
import WeeklyPlanner from "./components/WeeklyPlanner";
import { Sparkles, Layers, BookOpen, Clock, Heart, Sliders, ChevronDown } from "lucide-react";

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [currentBrand, setCurrentBrand] = useState<Brand>('Apice');
  const [currentMode, setCurrentMode] = useState<'A' | 'B'>('A');
  const [mainTab, setMainTab] = useState<'geracao' | 'historico'>('geracao');
  const [history, setHistory] = useState<PautaGerada[]>([]);
  const [loading, setLoading] = useState(false);
  const [activePreviewPauta, setActivePreviewPauta] = useState<PautaGerada | null>(null);
  const [historySubTab, setHistorySubTab] = useState<'lista' | 'planner'>('lista');

  // Estados para Filtros de Histórico
  const [brandFilter, setBrandFilter] = useState<"all" | "Apice" | "Barbours">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "rascunho" | "aprovado" | "descartado">("all");
  const [modoFilter, setModoFilter] = useState<"all" | "A" | "B">("all");
  const [tipoGeracaoFilter, setTipoGeracaoFilter] = useState<"all" | "texto" | "imagem" | "texto_imagem">("all");

  // Estado para preencher formulário do Modo B quando for solicitado Editar pauta
  const [editInputPreload, setEditInputPreload] = useState<InputModoB | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [imageModel, setImageModel] = useState<string>(DEFAULT_IMAGE_MODEL);
  const [direcionamentoIA, setDirecionamentoIA] = useState<string>('');
  const [tipoGeracao, setTipoGeracao] = useState<'texto' | 'imagem' | 'texto_imagem'>('texto_imagem');
  const [referenciasImagem, setReferenciasImagem] = useState<string[]>([]);
  const [allFrameImages, setAllFrameImages] = useState<Record<string, Record<string, string>>>(() => {
    try {
      const urls: Record<string, Record<string, string>> = JSON.parse(localStorage.getItem('crm_frame_urls') || '{}');
      const b64: Record<string, Record<string, string>> = JSON.parse(localStorage.getItem('crm_frame_b64') || '{}');
      // b64 como base, URLs públicas sobrepõem (preferência)
      const merged: Record<string, Record<string, string>> = {};
      for (const [id, frames] of Object.entries(b64)) {
        merged[id] = { ...frames };
      }
      for (const [id, frames] of Object.entries(urls)) {
        merged[id] = { ...(merged[id] ?? {}), ...frames };
      }
      return merged;
    } catch {
      return {};
    }
  });
  const reconstructedRef = useRef<Set<string>>(new Set());

  const handleFrameGenerated = async (
    pautaId: string,
    frameName: string,
    imageData: string,
    publicUrl?: string,
  ) => {
    const imageToStore = publicUrl || imageData;

    setAllFrameImages(prev => ({
      ...prev,
      [pautaId]: {
        ...(prev[pautaId] ?? {}),
        [frameName]: imageToStore,
      },
    }));

    // Registra pautaId como tendo frames (usado para reconstituição no reload)
    try {
      const knownPautas: string[] = JSON.parse(localStorage.getItem('crm_frame_pautas') || '[]');
      if (!knownPautas.includes(pautaId)) {
        knownPautas.push(pautaId);
        localStorage.setItem('crm_frame_pautas', JSON.stringify(knownPautas));
      }
    } catch { /* ignore */ }

    if (publicUrl) {
      try {
        const stored = JSON.parse(localStorage.getItem('crm_frame_urls') || '{}');
        stored[pautaId] = stored[pautaId] ?? {};
        stored[pautaId][frameName] = publicUrl;
        localStorage.setItem('crm_frame_urls', JSON.stringify(stored));
        console.log(`[handleFrameGenerated] URL persistida: ${publicUrl}`);
      } catch (err) {
        console.warn('[handleFrameGenerated] Falha ao salvar URL:', err);
      }
    } else {
      // Fallback: persiste base64 para sobreviver ao reload quando upload falhou
      try {
        const stored = JSON.parse(localStorage.getItem('crm_frame_b64') || '{}');
        stored[pautaId] = stored[pautaId] ?? {};
        stored[pautaId][frameName] = imageData;
        localStorage.setItem('crm_frame_b64', JSON.stringify(stored));
        console.log(`[handleFrameGenerated] base64 persistido como fallback: ${pautaId}/${frameName}`);
      } catch (err) {
        console.warn('[handleFrameGenerated] Falha ao salvar base64:', err);
      }
    }
  };

  // Auth: verifica sessão e escuta mudanças
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const email = session.user?.email ?? '';
        if (!isEmailAllowed(email)) {
          supabase!.auth.signOut();
          setAccessDenied(true);
          setSession(null);
        } else {
          setSession(session);
          setAccessDenied(false);
        }
      }
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const email = session.user?.email ?? '';
        if (!isEmailAllowed(email)) {
          supabase!.auth.signOut();
          setAccessDenied(true);
          setSession(null);
        } else {
          setSession(session);
          setAccessDenied(false);
        }
      } else {
        setSession(null);
      }
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Carrega histórico: Supabase primeiro, fallback para localStorage
  useEffect(() => {
    const init = async () => {
      const remote = await getPautas();
      if (remote && remote.length > 0) {
        setHistory(remote);
        return;
      }
      try {
        const stored = localStorage.getItem("crm_pautas_history");
        if (stored) {
          const raw: PautaGerada[] = JSON.parse(stored);
          const local = raw.map(p => ({
            ...p,
            tipoGeracao: (p.tipoGeracao ?? 'texto_imagem') as PautaGerada['tipoGeracao'],
          }));
          setHistory(local);
          // Migra dados locais para o Supabase na primeira vez
          if (local.length > 0) {
            upsertPautas(local).catch(err =>
              console.warn("[Supabase] Migração inicial falhou:", err)
            );
          }
        }
      } catch (e) {
        console.error("[localStorage] Erro ao carregar:", e);
      }
    };
    init();
  }, []);

  // Reconstrói URLs do Supabase Storage para pautas cujos frames sumiram do localStorage
  useEffect(() => {
    if (history.length === 0) return;
    const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL as string) || '';
    if (!SUPABASE_URL) return;

    const knownPautas: string[] = (() => {
      try { return JSON.parse(localStorage.getItem('crm_frame_pautas') || '[]'); }
      catch { return []; }
    })();
    if (knownPautas.length === 0) return;

    const storedUrls: Record<string, Record<string, string>> = (() => {
      try { return JSON.parse(localStorage.getItem('crm_frame_urls') || '{}'); }
      catch { return {}; }
    })();

    const toReconstruct = history.filter(p =>
      knownPautas.includes(p.id) &&
      !storedUrls[p.id] &&
      !reconstructedRef.current.has(p.id)
    );
    if (toReconstruct.length === 0) return;

    const reconstruct = async () => {
      const urlUpdates: Record<string, Record<string, string>> = {};
      const frameKeys = ['frame_0', 'frame_1', 'frame_2'];

      for (const pauta of toReconstruct) {
        reconstructedRef.current.add(pauta.id);
        const safeMarca = pauta.marca.toLowerCase().replace(/[^a-z0-9]/g, '');
        const found: Record<string, string> = {};

        for (const frameName of frameKeys) {
          const safeFrame = frameName.replace(/[^a-z0-9]/g, '');
          const url = `${SUPABASE_URL}/storage/v1/object/public/campaign-images/${safeMarca}/${pauta.id}/${safeFrame}.png`;
          try {
            const resp = await fetch(url, { method: 'HEAD' });
            if (resp.ok) found[frameName] = url;
          } catch { /* network error */ }
        }

        if (Object.keys(found).length > 0) urlUpdates[pauta.id] = found;
      }

      if (Object.keys(urlUpdates).length === 0) return;

      setAllFrameImages(prev => {
        const next = { ...prev };
        for (const [id, frames] of Object.entries(urlUpdates)) {
          next[id] = { ...(next[id] ?? {}), ...frames };
        }
        return next;
      });

      try {
        const stored = JSON.parse(localStorage.getItem('crm_frame_urls') || '{}');
        for (const [id, frames] of Object.entries(urlUpdates)) {
          stored[id] = { ...(stored[id] ?? {}), ...frames };
        }
        localStorage.setItem('crm_frame_urls', JSON.stringify(stored));
        console.log(`[reconstruct] URLs recuperadas para ${Object.keys(urlUpdates).length} pauta(s)`);
      } catch { /* ignore */ }
    };

    reconstruct();
  }, [history]);

  // Persiste histórico no localStorage (imediato) e no Supabase (async)
  const saveHistory = (newHistory: PautaGerada[]) => {
    setHistory(newHistory);
    try {
      localStorage.setItem("crm_pautas_history", JSON.stringify(newHistory));
    } catch (e) {
      console.error("[localStorage] Erro ao persistir:", e);
    }
    if (newHistory.length === 0) {
      clearPautas().catch(err => console.warn("[Supabase] clearPautas falhou:", err));
    } else {
      upsertPautas(newHistory).catch(err => console.warn("[Supabase] upsertPautas falhou:", err));
    }
  };

  // Enviar formulário Modo A ao backend Express
  const handleFormASubmit = async (inputA: InputModoA) => {
    setLoading(true);
    try {
      const response = await fetch("/api/generate-pauta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo: "A", input: inputA, aspectRatio, direcionamentoIA, tipoGeracao }),
      });
      const resData = await response.json();
      if (resData.status === "success" && Array.isArray(resData.data)) {
        // Concatenar novas propostas no topo do histórico
        const updated = [...resData.data, ...history];
        saveHistory(updated);

        // Abre o popup com a nova pauta imediatamente
        if (resData.data[0]) {
          setActivePreviewPauta(resData.data[0]);
        }

        setDirecionamentoIA('');
        // Redireciona para o histórico recém gerado
        setMainTab('historico');
      } else {
        alert(resData.error || "Erro de geração no servidor.");
      }
    } catch (err) {
      console.error(err);
      alert("Houve uma falha de rede ao conectar com a IA do robô de email CRM.");
    } finally {
      setLoading(false);
    }
  };

  // Enviar formulário Modo B ao backend Express
  const handleFormBSubmit = async (inputB: InputModoB) => {
    setLoading(true);
    try {
      const response = await fetch("/api/generate-pauta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo: "B", input: inputB, aspectRatio, direcionamentoIA, tipoGeracao, referenciasImagem }),
      });
      const resData = await response.json();
      if (resData.status === "success" && Array.isArray(resData.data)) {
        const pautasComInput = resData.data.map((p: any) => ({
          ...p,
          inputOriginal: {
            headline: inputB.boxHeadlineBanner || '',
            subheadline: inputB.boxSubtituloEmail || '',
            cta: inputB.boxCta || '',
            direcionamento: direcionamentoIA || '',
            estiloVisualTexto: (inputB as any).estiloVisualTexto || '',
            fonteEscolhida: (inputB as any).fonteEscolhida || '',
            estiloBotaoEscolhido: (inputB as any).estiloBotaoEscolhido || 'pill',
            corTextoPrincipal: (inputB as any).corTextoPrincipal || '#FFFFFF',
            fonteSubtitulo: (inputB as any).fonteSubtitulo || '',
            corSubtitulo: (inputB as any).corSubtitulo || 'rgba(255,255,255,0.90)',
            corBotaoEscolhida: (inputB as any).corBotaoEscolhida || '',
            fonteBotao: (inputB as any).fonteBotao || '',
            estiloDesign: (inputB as any).estiloDesign || '',
          },
        }));
        const updated = [...pautasComInput, ...history];
        saveHistory(updated);

        // Abre o popup com a nova pauta imediatamente
        if (pautasComInput[0]) {
          setActivePreviewPauta(pautasComInput[0]);
        }

        setDirecionamentoIA('');
        // Limpar preload de edição após submit bem sucedido
        setEditInputPreload(null);
        // Redireciona para o histórico recém gerado
        setMainTab('historico');
      } else {
        alert(resData.error || "Erro de geração no servidor.");
      }
    } catch (err) {
      console.error(err);
      alert("Houve uma falha de rede ao calibrar o copilot de email CRM.");
    } finally {
      setLoading(false);
    }
  };

  // Gerar variação alternativa de um bloco de copy específico via backend
  const handleGenerateVariation = async (pauta: PautaGerada) => {
    try {
      const response = await fetch("/api/generate-variation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pauta }),
      });
      const resData = await response.json();
      if (resData.status === "success" && resData.data) {
        // Atualizar bloco de copy na pauta correspondente
        const updated = history.map((item) => {
          if (item.id === pauta.id) {
            return {
              ...item,
              copy: resData.data,
              status: 'rascunho' as const // reverter para rascunho para aprovação
            };
          }
          return item;
        });
        saveHistory(updated);
      } else {
        alert("Não foi possível gerar variação do copy com a IA.");
      }
    } catch (err) {
      console.error(err);
      alert("Falha ao comunicar com o gerador de variação rápida.");
    }
  };

  const handleApprovePauta = async (id: string) => {
    const updated = history.map((item) => {
      if (item.id === id) {
        return { ...item, status: 'aprovado' as const };
      }
      return item;
    });
    saveHistory(updated);

    const pautaAprovada = history.find(p => p.id === id);
    if (!pautaAprovada) return;

    const framesDestaPauta = allFrameImages[id] ?? {};

    try {
      const response = await fetch('/api/approve-pauta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pauta: pautaAprovada,
          frameImages: framesDestaPauta,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.warn('[approve-pauta] Falha ao salvar no banco:', err);
      } else {
        const result = await response.json();
        console.log('[approve-pauta] Salvo no Supabase com output_id:', result.output_id);
      }
    } catch (err) {
      console.warn('[approve-pauta] Erro de rede ao salvar aprovação:', err);
    }
  };

  const handleUpdatePautaDay = (pautaId: string, newDay: string) => {
    const updated = history.map((item) => {
      if (item.id === pautaId) {
        return {
          ...item,
          operacional: {
            ...item.operacional,
            diaRecomendado: newDay
          }
        };
      }
      return item;
    });
    saveHistory(updated);
  };

  const handleUpdatePauta = (updatedPauta: PautaGerada) => {
    const updated = history.map((item) => {
      if (item.id === updatedPauta.id) {
        return updatedPauta;
      }
      return item;
    });
    saveHistory(updated);
    // Keep active preview sandbox fresh
    setActivePreviewPauta(updatedPauta);
  };

  const handleDiscardPauta = (id: string) => {
    const updated = history.map((item) => {
      if (item.id === id) {
        return { ...item, status: 'descartado' as const };
      }
      return item;
    });
    saveHistory(updated);
  };

  const handleClearHistory = () => {
    if (confirm("Tem certeza de que deseja apagar permanentemente todas as pautas sugeridas no seu painel?")) {
      saveHistory([]);
    }
  };

  const handleClearFilters = () => {
    setBrandFilter("all");
    setModoFilter("all");
    setTipoGeracaoFilter("all");
    setStatusFilter("all");
  };

  // Carrega dados da pauta gerada e abre de volta no formulário do Modo B para ajustes manuais
  const handleEditPauta = (id: string) => {
    const pautaToEdit = history.find((p) => p.id === id);
    if (pautaToEdit) {
      // Definir marca para coincidir com a pauta editada
      setCurrentBrand(pautaToEdit.marca);
      // Mudar fluxo de modo para assistido
      setCurrentMode('B');
      // Passar dados originais para preenchimento
      setEditInputPreload({
        marca: pautaToEdit.marca,
        boxTituloEmail: pautaToEdit.copy.assunto,
        boxSubtituloEmail: pautaToEdit.copy.subHeadlineBanner,
        boxCta: pautaToEdit.copy.ctaBotao,
        boxMecanicaOuEstatico: pautaToEdit.operacional.mecanicaEscolhida,
        boxRecompensa: pautaToEdit.operacional.recompensaEscolhida,
      });

      // Mudar de aba para a criação onde o form de edição estará carregado
      setMainTab('geracao');

      // Rolar suavemente para o topo do formulário
      window.scrollTo({ top: 300, behavior: 'smooth' });
    }
  };

  const filteredHistory = history.filter((p) => {
    const matchBrand = brandFilter === "all" || p.marca === brandFilter;
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchModo = modoFilter === "all" || p.modo === modoFilter;
    const matchTipo = tipoGeracaoFilter === "all" || (p.tipoGeracao ?? 'texto_imagem') === tipoGeracaoFilter;
    return matchBrand && matchStatus && matchModo && matchTipo;
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-600 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-10 max-w-md w-full flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center">
            <span className="text-rose-600 text-3xl">✕</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Acesso negado</h2>
            <p className="text-sm text-slate-500">
              Este app é restrito a emails da organização.<br />
              Use um email @gocase.com.br, @gogroup.com.br ou @gobeaute.com.br
            </p>
          </div>
          <button
            onClick={() => { setAccessDenied(false); }}
            className="px-6 py-2.5 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (supabase && !session) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-150 py-10 px-4 sm:px-6 lg:px-8 font-sans antialiased selection:bg-[#688D65]/30">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        
        {/* Top Header & Brand Selector */}
        <Header
          currentBrand={currentBrand}
          setCurrentBrand={setCurrentBrand}
          userEmail={session?.user?.email}
          onLogout={() => supabase?.auth.signOut()}
        />

        {/* Abas Principais de Navegação */}
        <div id="main-tabs-container" className="flex border-b border-slate-800 gap-1 sm:gap-2 mb-4 relative z-10 p-1 bg-slate-900/40 rounded-2xl">
          <button
            id="tab-btn-geracao"
            onClick={() => setMainTab('geracao')}
            className={`flex-1 sm:flex-initial py-3 px-5 rounded-xl text-xs sm:text-sm font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
              mainTab === 'geracao'
                ? 'bg-[#688D65]/20 text-emerald-300 border border-[#688D65]/30 shadow-lg'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Painel de Geração Inteligente
          </button>
          
          <button
            id="tab-btn-historico"
            onClick={() => setMainTab('historico')}
            className={`flex-1 sm:flex-initial py-3 px-5 rounded-xl text-xs sm:text-sm font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer relative ${
              mainTab === 'historico'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-lg'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Clock className="w-4 h-4 text-indigo-450" />
            Histórico de Pautas
            {history.length > 0 && (
              <span className="bg-indigo-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full border border-indigo-400 flex items-center justify-center scale-90">
                {history.length}
              </span>
            )}
          </button>
        </div>

        {/* Renderização condicional por Aba Principal */}
        {mainTab === 'geracao' ? (
          <div className="max-w-6xl mx-auto w-full animate-fade-in flex flex-col gap-6">
            
            {/* Seletor central de marcas exclusivo do Painel de Geração */}
            <div className="bg-slate-900 border border-slate-850 p-6 rounded-3xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl">
              <div className="absolute top-0 right-0 w-80 h-80 bg-slate-800 rounded-full blur-3xl opacity-10 pointer-events-none -mr-20 -mt-20"></div>
              
              <div className="relative z-10 flex flex-col gap-1 max-w-xl text-left">
                <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#AA834B]">
                  Workspace de Criação de E-mail de CRM
                </span>
                <h2 className="text-xl font-bold font-sans text-white">
                  Selecione a Marca para Separar as Regras e Diretivas
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed mt-1">
                  Ative o playbook apropriado para calibrar a inteligência com as restrições estritas da marca, incluindo limites de assunto, cores de proibição e tonalidades do visual.
                </p>
              </div>

              {/* Botões Grandes Detalhados de Marca */}
              <div className="bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 flex items-center gap-2 shrink-0 relative z-10 w-full md:w-auto">
                <button
                  id="tab-brand-apice-local"
                  onClick={() => { setCurrentBrand('Apice'); setEditInputPreload(null); }}
                  className={`flex-1 md:flex-none px-5 py-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                    currentBrand === 'Apice'
                      ? 'bg-[#688D65] text-white shadow-lg shadow-[#688D65]/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-350"></span>
                  Apice Cosméticos
                </button>
                <button
                  id="tab-brand-barbours-local"
                  onClick={() => { setCurrentBrand('Barbours'); setEditInputPreload(null); }}
                  className={`flex-1 md:flex-none px-5 py-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                    currentBrand === 'Barbours'
                      ? 'bg-[#BF0F26] text-white shadow-lg shadow-[#BF0F26]/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  Barbours Beauty
                </button>
              </div>
            </div>

            {/* Grid dos Formulários separados por marca no modo A e B */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Coluna Seletor de Modo Operacional por Marca */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                
                {/* Seletor de Modo Operacional com estilo adaptativo */}
                <div className="bg-slate-900/60 rounded-3xl p-5 border border-slate-800/80 flex flex-col gap-4">
                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[#AA834B]">
                      Criação de {currentBrand}
                    </span>
                    <h3 className="text-sm font-black text-slate-100">
                      Escolha o Fluxo Operacional
                    </h3>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    <button
                      id="tab-modo-a-local"
                      onClick={() => { setCurrentMode('A'); setEditInputPreload(null); }}
                      className={`p-4 rounded-2xl text-left border flex flex-col justify-between transition-all duration-300 relative cursor-pointer ${
                        currentMode === 'A'
                          ? currentBrand === 'Apice'
                            ? 'bg-[#688D65]/10 border-[#688D65]/40 shadow-lg'
                            : 'bg-[#BF0F26]/10 border-[#BF0F26]/40 shadow-lg'
                          : 'bg-slate-950/40 border-slate-900/20 hover:bg-slate-900/30'
                      }`}
                    >
                      <div className="flex justify-between items-start w-full">
                        <div className={`p-1.5 rounded-lg w-fit ${currentMode === 'A' ? currentBrand === 'Apice' ? 'bg-[#688D65]/20 text-emerald-300' : 'bg-[#BF0F26]/20 text-rose-300' : 'bg-slate-850 text-slate-500'} mb-3`}>
                          <Sparkles className="w-4 h-4" />
                        </div>
                        {currentMode === 'A' && (
                          <span className={`w-2 h-2 rounded-full ${currentBrand === 'Apice' ? 'bg-[#688D65]' : 'bg-[#BF0F26]'}`}></span>
                        )}
                      </div>
                      <div>
                        <h4 className={`text-xs font-bold uppercase tracking-wider ${currentMode === 'A' ? 'text-white font-extrabold' : 'text-slate-400'}`}>
                          Modo A: Descoberta Livre
                        </h4>
                        <p className="text-[10px] text-slate-400 leading-normal mt-1">
                          A IA analisa o histórico de hits de {currentBrand} e propõe propostas sob medida do zero de alto desempenho.
                        </p>
                      </div>
                    </button>

                    <button
                      id="tab-modo-b-local"
                      onClick={() => setCurrentMode('B')}
                      className={`p-4 rounded-2xl text-left border flex flex-col justify-between transition-all duration-300 relative cursor-pointer ${
                        currentMode === 'B'
                          ? currentBrand === 'Apice'
                            ? 'bg-[#688D65]/10 border-[#688D65]/40 shadow-lg'
                            : 'bg-[#BF0F26]/10 border-[#BF0F26]/40 shadow-lg'
                          : 'bg-slate-950/40 border-slate-900/20 hover:bg-slate-900/30'
                      }`}
                    >
                      <div className="flex justify-between items-start w-full">
                        <div className={`p-1.5 rounded-lg w-fit ${currentMode === 'B' ? currentBrand === 'Apice' ? 'bg-[#688D65]/20 text-emerald-300' : 'bg-[#BF0F26]/20 text-rose-300' : 'bg-slate-850 text-slate-500'} mb-3`}>
                          <Sliders className="w-4 h-4" />
                        </div>
                        {currentMode === 'B' && (
                          <span className={`w-2 h-2 rounded-full ${currentBrand === 'Apice' ? 'bg-[#688D65]' : 'bg-[#BF0F26]'}`}></span>
                        )}
                      </div>
                      <div>
                        <h4 className={`text-xs font-bold uppercase tracking-wider ${currentMode === 'B' ? 'text-white' : 'text-slate-400'}`}>
                          Modo B: Briefing Co-Pilot
                        </h4>
                        <p className="text-[10px] text-slate-400 leading-normal mt-1">
                          Escreva suas ideias parciais e a inteligência calibra, ajusta e expande seu briefing seguindo o playbook de {currentBrand}.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Perfil tático consolidado focado na marca selecionada para o Modo A e B */}
                <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-3xl flex flex-col gap-3 text-left">
                  <h4 className="text-xs uppercase font-extrabold tracking-widest text-[#AA834B]">
                    Acordo tático de {currentBrand}
                  </h4>
                  <div className="flex flex-col gap-2.5 text-xs text-slate-350">
                    <p className="leading-relaxed">
                      Todas as geração neste modo são automaticamente governadas pelas regras invioláveis:
                    </p>
                    <div className="flex justify-between pb-2 border-b border-slate-850/60">
                      <span className="text-slate-400">Tom de voz:</span>
                      <strong className="text-slate-100">{currentBrand === 'Apice' ? 'Acolhedor, Íntimo e Próximo' : 'Elegante, Direto, Sofisticado'}</strong>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-slate-850/60">
                      <span className="text-slate-400">Eixo Central:</span>
                      <strong className="text-slate-100">{currentBrand === 'Apice' ? 'Manipular (puxar/cortar/jogar)' : 'Abrir (carta/presente/caixa)'}</strong>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-slate-850/60">
                      <span className="text-slate-400">Caracteres Assunto:</span>
                      <strong className="text-amber-400 font-mono">{currentBrand === 'Apice' ? '27 a 47 caracteres' : '16 a 39 caracteres'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Restrição de Assunto:</span>
                      <strong className="text-rose-400 text-right">Proibido %, OFF, GRÁTIS ou Caps completo</strong>
                    </div>
                  </div>
                </div>

              </div>

              {/* Coluna do Formulário renderizado de forma adaptada */}
              <div className="lg:col-span-7 w-full flex flex-col">
                {currentMode === 'A' ? (
                  <FormModoA
                    brand={currentBrand}
                    onSubmit={handleFormASubmit}
                    loading={loading}
                    aspectRatio={aspectRatio}
                    onAspectRatioChange={setAspectRatio}
                    imageModel={imageModel}
                    onImageModelChange={setImageModel}
                    direcionamentoIA={direcionamentoIA}
                    onDirecionamentoChange={setDirecionamentoIA}
                    tipoGeracao={tipoGeracao}
                    onTipoGeracaoChange={setTipoGeracao}
                  />
                ) : (
                  <FormModoB
                    brand={currentBrand}
                    onSubmit={handleFormBSubmit}
                    loading={loading}
                    key={editInputPreload ? JSON.stringify(editInputPreload) : 'new'}
                    preload={editInputPreload}
                    aspectRatio={aspectRatio}
                    onAspectRatioChange={setAspectRatio}
                    imageModel={imageModel}
                    onImageModelChange={setImageModel}
                    direcionamentoIA={direcionamentoIA}
                    onDirecionamentoChange={setDirecionamentoIA}
                    tipoGeracao={tipoGeracao}
                    onTipoGeracaoChange={setTipoGeracao}
                    referenciasImagem={referenciasImagem}
                    onReferenciasImagemChange={setReferenciasImagem}
                  />
                )}
              </div>

            </div>

          </div>
        ) : (
          <div className="w-full flex flex-col gap-8 animate-fade-in text-left">
            
            {/* Dashboard KPIs consolidado */}
            <HistoryList
              history={history}
              onClearHistory={handleClearHistory}
              brandFilter={brandFilter}
              setBrandFilter={setBrandFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              modoFilter={modoFilter}
              setModoFilter={setModoFilter}
              tipoGeracaoFilter={tipoGeracaoFilter}
              setTipoGeracaoFilter={setTipoGeracaoFilter}
              onClearFilters={handleClearFilters}
              historySubTab={historySubTab}
              setHistorySubTab={setHistorySubTab}
            />

            {/* Alternação entre o Timeline Semanal do Planejador e a Lista Detalhada */}
            {historySubTab === 'planner' ? (
              <WeeklyPlanner
                pautas={filteredHistory}
                onOpenPreview={setActivePreviewPauta}
                onUpdatePautaDay={handleUpdatePautaDay}
              />
            ) : (
              /* Lista unificada com visualização 100% expandida das pautas geradas */
              <div className="flex flex-col gap-8 text-left">
                {filteredHistory.map((pauta) => (
                    <ResultPauta
                      key={pauta.id}
                      pauta={pauta}
                      onApprove={handleApprovePauta}
                      onDiscard={handleDiscardPauta}
                      onGenerateVariation={handleGenerateVariation}
                      onEdit={() => handleEditPauta(pauta.id)}
                      onOpenPreview={setActivePreviewPauta}
                      aspectRatio={aspectRatio}
                      imageModel={imageModel}
                      referenciaImagem={referenciasImagem[0] ?? undefined}
                      referenciasImagem={referenciasImagem}
                      frameImages={allFrameImages[pauta.id] ?? {}}
                      onFrameGenerated={handleFrameGenerated}
                    />
                  ))}

                {filteredHistory.length === 0 && history.length > 0 && (
                  <div className="bg-slate-900/30 text-center py-12 px-8 border border-slate-800 border-dashed rounded-[2.5rem] text-slate-400 max-w-2xl mx-auto w-full">
                    <span className="text-3xl mb-3 block">🔍</span>
                    <h4 className="text-base font-bold text-slate-200">Nenhuma pauta encontrada com esses filtros</h4>
                    <p className="text-sm text-slate-400 mt-1 mb-4">Tente ajustar os filtros acima ou limpe para ver todas as pautas.</p>
                    <button
                      onClick={handleClearFilters}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Limpar filtros
                    </button>
                  </div>
                )}

                {history.length === 0 && (
                  <div className="bg-slate-900/30 text-center py-20 px-8 border border-slate-800 border-dashed rounded-[2.5rem] text-slate-400 max-w-2xl mx-auto w-full">
                    <span className="text-5xl mb-4 block animate-bounce">🤖</span>
                    <h4 className="text-lg font-bold text-slate-200">Seu histórico de pautas geradas está vazio</h4>
                    <p className="text-sm text-slate-444 mt-2 max-w-sm mx-auto leading-relaxed">
                      Você ainda não gerou propostas de e-mail de CRM nesta sessão. Vá para o <strong>Painel de Geração Inteligente</strong>, preencha os campos de briefings e clique para acionar a inteligência artificial do Playbook integrado!
                    </p>
                    <button
                      onClick={() => setMainTab('geracao')}
                      className="mt-6 bg-[#688D65] hover:bg-[#52704f] pb-3 pt-3 px-6 rounded-xl font-bold uppercase text-xs tracking-wider transition-all cursor-pointer shadow-lg"
                    >
                      Começar Criação de Pauta
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>

      {activePreviewPauta && (
        <PreviewModal
          pauta={activePreviewPauta}
          onClose={() => setActivePreviewPauta(null)}
          onUpdatePauta={handleUpdatePauta}
          frameImages={allFrameImages[activePreviewPauta.id] ?? {}}
          onFrameGenerated={handleFrameGenerated}
          aspectRatio={aspectRatio}
          imageModel={imageModel}
          referenciaImagem={referenciasImagem[0] ?? undefined}
          referenciasImagem={referenciasImagem}
        />
      )}
    </div>
  );
}
