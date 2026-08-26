import { useState, useEffect, useRef } from "react";
import { Brand, ContaInsider, PautaGerada, InputModoA, InputModoB, TesteAbProposta } from "./types";
import { getPautas, upsertPautas, clearPautas } from "./lib/pautas-service";
import { supabase, isEmailAllowed } from "./lib/supabase";
import LoginPage from "./components/LoginPage";
import Header from "./components/Header";
import FormModoA from "./components/FormModoA";
import FormModoB from "./components/FormModoB";
import ResultPauta from "./components/ResultPauta";
import { DEFAULT_IMAGE_MODEL } from "./components/ImageModelSelector";
import HistoryList from "./components/HistoryList";
import ModoCPanel from "./components/ModoCPanel";
import HistoryGallery from "./components/HistoryGallery";
import PreviewModal from "./components/PreviewModal";
import WeeklyPlanner from "./components/WeeklyPlanner";
import Sidebar, { AppSection } from "./components/Sidebar";
import CalendarioSecao from "./components/calendario/CalendarioSecao";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { Sparkles, Layers, BookOpen, Clock, Heart, Sliders, X, Bot } from "lucide-react";
import { loadGifshot } from "./utils/loadGifshot";

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

function AppInner() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [section, setSection] = useState<AppSection>('conteudos');
  const [currentBrand, setCurrentBrand] = useState<Brand>('Apice');
  const [currentMode, setCurrentMode] = useState<'A' | 'B'>('A');
  const [mainTab, setMainTab] = useState<'geracao' | 'historico' | 'agente'>('geracao');
  const [history, setHistory] = useState<PautaGerada[]>([]);
  const [loading, setLoading] = useState(false);
  const [activePreviewPauta, setActivePreviewPauta] = useState<PautaGerada | null>(null);
  const [previewInitialTab, setPreviewInitialTab] = useState<'visual' | 'edit'>('visual');
  const openPreview = (pauta: PautaGerada, tab: 'visual' | 'edit' = 'visual') => {
    setPreviewInitialTab(tab);
    setActivePreviewPauta(pauta);
  };
  const [historySubTab, setHistorySubTab] = useState<'lista' | 'planner'>('lista');

  // Estados para Filtros de Histórico
  const [brandFilter, setBrandFilter] = useState<"all" | "Apice" | "Barbours">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "rascunho" | "aprovado" | "descartado">("all");
  const [modoFilter, setModoFilter] = useState<"all" | "A" | "B">("all");
  const [tipoGeracaoFilter, setTipoGeracaoFilter] = useState<"all" | "texto" | "imagem" | "texto_imagem">("all");
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyTimeRange, setHistoryTimeRange] = useState<'7d' | '30d' | '60d' | '120d' | 'custom'>('7d');
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [galleryOpenPautaId, setGalleryOpenPautaId] = useState<string | null>(null);

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
  const generatingPautasRef = useRef<Set<string>>(new Set());

  const handleFrameGenerated = async (
    pautaId: string,
    frameName: string,
    imageData: string,
    publicUrl?: string,
  ) => {
    // Sempre usa base64 para exibição — URL só para persistência
    const imageToStore = imageData;

    setAllFrameImages(prev => ({
      ...prev,
      [pautaId]: {
        ...(prev[pautaId] ?? {}),
        [frameName]: imageToStore,
      },
    }));

    // Sempre salva base64 para exibição imediata
    try {
      const stored = JSON.parse(localStorage.getItem('crm_frame_b64') || '{}');
      stored[pautaId] = stored[pautaId] ?? {};
      stored[pautaId][frameName] = imageData;
      localStorage.setItem('crm_frame_b64', JSON.stringify(stored));
    } catch (err) {
      console.warn('[handleFrameGenerated] Falha ao salvar base64:', err);
    }
    // Também salva URL pública se disponível (para reconstituição futura)
    if (publicUrl) {
      try {
        const stored = JSON.parse(localStorage.getItem('crm_frame_urls') || '{}');
        stored[pautaId] = stored[pautaId] ?? {};
        stored[pautaId][frameName] = publicUrl;
        localStorage.setItem('crm_frame_urls', JSON.stringify(stored));
      } catch (err) {
        console.warn('[handleFrameGenerated] Falha ao salvar URL:', err);
      }
    }
  };

  // Auth: verifica sessão e escuta mudanças
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('error')) {
      window.history.replaceState({}, document.title, '/');
    }

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

  // Semeia allFrameImages com os frames já prontos das pautas do Agente de GIF (modo 'C') —
  // essas pautas chegam do backend já com frameUrls preenchido, sem precisar do usuário clicar
  // em "gerar imagem".
  const seedFrameUrlsFromPautas = (pautas: PautaGerada[]) => {
    const withFrames = pautas.filter(p => (p as any).frameUrls && Object.keys((p as any).frameUrls).length > 0);
    if (withFrames.length === 0) return;
    setAllFrameImages(prev => {
      const next = { ...prev };
      for (const p of withFrames) {
        next[p.id] = { ...((p as any).frameUrls), ...(next[p.id] ?? {}) };
      }
      return next;
    });
  };

  // Carrega histórico: Supabase primeiro, fallback para localStorage
  useEffect(() => {
    const init = async () => {
      const remote = await getPautas();
      if (remote && remote.length > 0) {
        setHistory(remote);
        seedFrameUrlsFromPautas(remote);
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

  // Sem botão manual: o Agente de GIF roda no backend (cron) e escreve direto em pautas_geradas.
  // Esse polling é o único jeito do front descobrir pautas modo 'C' novas sem precisar recarregar
  // a página. Não reescreve o localStorage (fallback só é reconstruído num reload completo).
  useEffect(() => {
    const interval = setInterval(async () => {
      const remote = await getPautas();
      if (!remote) return;
      setHistory(prev => {
        const knownIds = new Set(prev.map(p => p.id));
        const novas = remote.filter(p => !knownIds.has(p.id));
        if (novas.length === 0) return prev;
        seedFrameUrlsFromPautas(novas);
        return [...novas, ...prev];
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Propostas de teste A/B geradas pelo agente após aprovação de uma pauta modo 'C'.
  const [testesAb, setTestesAb] = useState<TesteAbProposta[]>([]);
  const fetchTestesAb = async () => {
    try {
      const resp = await fetch('/api/teste-ab');
      const resData = await resp.json();
      if (resData.status === 'success' && Array.isArray(resData.data)) {
        setTestesAb(resData.data.map((row: any): TesteAbProposta => ({
          id: row.id,
          marca: row.marca,
          pautaId: row.pauta_id,
          conteudoVarianteB: row.conteudos_links
            ? {
                id: row.variante_b_conteudo_id,
                nomeDesign: row.conteudos_links.nome_design,
                storageUrl: row.conteudos_links.storage_url,
                insiderOriginalUrl: row.conteudos_links.insider_original_url,
              }
            : (row.variante_b_conteudo_id ? { id: row.variante_b_conteudo_id, nomeDesign: null, storageUrl: null, insiderOriginalUrl: null } : null),
          racional: row.racional,
          status: row.status,
          createdAt: row.created_at,
          envios: Array.isArray(row.teste_ab_envios) ? row.teste_ab_envios.map((e: any) => ({
            marca: e.marca,
            insiderCampaignId: e.insider_campaign_id,
            varianteAGifUrl: e.variante_a_gif_url ?? null,
            enviadoEm: e.enviado_em,
          })) : [],
          insiderCampaignId: row.insider_campaign_id ?? null,
          enviadoInsiderEm: row.enviado_insider_em ?? null,
          insiderDestinoMarca: row.insider_destino_marca ?? null,
        })));
      }
    } catch (err) {
      console.warn('[teste-ab] Falha ao buscar propostas:', err);
    }
  };
  useEffect(() => {
    fetchTestesAb();
    const interval = setInterval(fetchTestesAb, 60000);
    return () => clearInterval(interval);
  }, []);

  // Aprovar a comparação do teste A/B (o usuário concorda com o conteúdo histórico escolhido
  // pelo agente) — é só um update de status, sem chamada de IA, então faz direto no Supabase.
  const handleAceitarAb = async (proposta: TesteAbProposta) => {
    setTestesAb(prev => prev.map(t => t.id === proposta.id ? { ...t, status: 'aceito' } : t));
    if (!supabase) return;
    const { error } = await supabase.from('teste_ab_propostas').update({ status: 'aceito' }).eq('id', proposta.id);
    if (error) console.warn('[teste-ab] Falha ao aceitar comparação:', error.message);
  };

  // "Não faz sentido" — o usuário reprova o conteúdo histórico escolhido; o backend busca um
  // novo candidato (excluindo os já reprovados) e atualiza a mesma proposta.
  const [regenerandoAbId, setRegenerandoAbId] = useState<string | null>(null);
  const handleRejeitarAb = async (proposta: TesteAbProposta) => {
    setRegenerandoAbId(proposta.id);
    try {
      const resp = await fetch('/api/teste-ab-regenerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propostaId: proposta.id }),
      });
      const resData = await resp.json();
      if (resData.status === 'success') {
        await fetchTestesAb();
      } else {
        console.warn('[teste-ab-regenerar] Falha:', resData.error);
        alert('Não consegui encontrar outro conteúdo do histórico agora. Tenta de novo em alguns segundos.');
      }
    } catch (err) {
      console.warn('[teste-ab-regenerar] Erro de rede:', err);
    } finally {
      setRegenerandoAbId(null);
    }
  };

  // Passo 3 — envia a comparação aceita pra Insider como campanha "experiment" (A/B nativo).
  // A Insider só aceita um GIF de verdade por URL (não frames separados), então primeiro
  // codifica os 3 frames compostos num .gif real (gifshot, mesma lib do botão "Baixar GIF"
  // já existente), sobe pro Storage, e só então chama o backend (que tem a chave da Insider).
  const [enviandoInsiderId, setEnviandoInsiderId] = useState<string | null>(null);
  const handleEnviarInsider = async (
    proposta: TesteAbProposta,
    opts: { destinoMarca: ContaInsider; linkCampanha?: string; assunto?: string; nomeCampanha?: string },
  ) => {
    const { destinoMarca, linkCampanha, assunto, nomeCampanha } = opts;
    if (!supabase) { alert('Supabase não configurado.'); return; }
    const pautaA = history.find(p => p.id === proposta.pautaId);
    const frameImages = allFrameImages[proposta.pautaId] ?? {};
    const keys = Object.keys(frameImages).sort();
    if (!pautaA || keys.length < 2) {
      alert('Os frames dessa pauta ainda não estão prontos — aguarde a composição terminar.');
      return;
    }

    setEnviandoInsiderId(proposta.id);
    try {
      const toBase64 = async (src: string): Promise<string> => {
        if (src.startsWith('data:')) return src;
        const resp = await fetch(src);
        const blob = await resp.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };
      const framesBase64 = await Promise.all(keys.map(k => toBase64(frameImages[k])));

      const gifshot = await loadGifshot();
      const { resolveCanvasSize } = await import('./utils/composeFrame');
      const [rawW, rawH] = resolveCanvasSize(pautaA.aspectRatio);
      const scale = 600 / Math.max(rawW, rawH);
      const gifWidth = Math.round(rawW * scale);
      const gifHeight = Math.round(rawH * scale);

      const gifDataUrl: string = await new Promise((resolve, reject) => {
        gifshot.createGIF({
          images: framesBase64,
          gifWidth, gifHeight,
          interval: 0.7,
          numFrames: framesBase64.length,
          frameDuration: 1,
          sampleInterval: 10,
          numWorkers: 2,
        }, (obj: any) => {
          if (obj.error) reject(new Error(obj.error));
          else resolve(obj.image);
        });
      });

      const base64Data = gifDataUrl.split(',')[1];
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const path = `insider-gifs/${proposta.pautaId}.gif`;
      const { error: upErr } = await supabase.storage
        .from('campaign-images')
        .upload(path, bytes, { contentType: 'image/gif', upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('campaign-images').getPublicUrl(path);

      const resp = await fetch('/api/teste-ab-enviar-insider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propostaId: proposta.id, gifUrlVarianteA: urlData.publicUrl, destinoMarca, linkCampanha, assunto, nomeCampanha }),
      });
      const resData = await resp.json();
      if (resData.status === 'success') {
        const novoEnvio = { marca: destinoMarca, insiderCampaignId: resData.insiderCampaignId, varianteAGifUrl: urlData.publicUrl, enviadoEm: new Date().toISOString() };
        setTestesAb(prev => prev.map(t => t.id === proposta.id
          ? { ...t, envios: [...t.envios.filter(e => e.marca !== destinoMarca), novoEnvio] }
          : t));
      } else {
        alert(resData.error || 'Falha ao enviar pra Insider.');
      }
    } catch (err: any) {
      console.warn('[teste-ab-enviar-insider] Erro:', err);
      alert('Erro ao enviar pra Insider: ' + (err.message ?? 'erro desconhecido'));
    } finally {
      setEnviandoInsiderId(null);
    }
  };

  // Passo 2 — baixa o GIF animado (já composto) de uma pauta aprovada do agente, sem precisar
  // abrir o modal de teste A/B. Mesma técnica de composição de handleEnviarInsider/ResultPauta.
  const [baixandoGifId, setBaixandoGifId] = useState<string | null>(null);
  const handleDownloadGifAgente = async (pauta: PautaGerada) => {
    if (baixandoGifId) return; // evita disparar 2 gerações de GIF em paralelo (botão sem debounce)
    const frameImages = allFrameImages[pauta.id] ?? {};
    const keys = Object.keys(frameImages).sort();
    if (keys.length < 2) {
      alert('Os frames dessa pauta ainda não estão prontos — aguarde a composição terminar.');
      return;
    }
    setBaixandoGifId(pauta.id);
    try {
      const toBase64 = async (src: string): Promise<string> => {
        if (src.startsWith('data:')) return src;
        const resp = await fetch(src);
        const blob = await resp.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };
      const framesBase64 = await Promise.all(keys.map(k => toBase64(frameImages[k])));

      const gifshot = await loadGifshot();
      const { resolveCanvasSize } = await import('./utils/composeFrame');
      const [rawW, rawH] = resolveCanvasSize(pauta.aspectRatio);
      const scale = 600 / Math.max(rawW, rawH);
      const gifWidth = Math.round(rawW * scale);
      const gifHeight = Math.round(rawH * scale);

      // gifshot processa via Web Workers e, se algo travar internamente ali, o callback nunca
      // é chamado — sem esse timeout o botão fica girando pra sempre sem feedback nenhum.
      const gifDataUrl = await Promise.race([
        new Promise<string>((resolve, reject) => {
          gifshot.createGIF({
            images: framesBase64,
            gifWidth, gifHeight,
            interval: 0.7,
            numFrames: framesBase64.length,
            frameDuration: 1,
            sampleInterval: 10,
            numWorkers: 2,
          }, (obj: any) => {
            if (obj.error) reject(new Error(obj.error));
            else resolve(obj.image);
          });
        }),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Tempo esgotado gerando o GIF — tenta de novo.')), 25000)),
      ]);

      const link = document.createElement('a');
      link.download = `agente-${pauta.marca}-${pauta.operacional?.mecanicaEscolhida ?? 'gif'}.gif`.replace(/\s+/g, '-');
      link.href = gifDataUrl;
      link.click();
    } catch (err: any) {
      console.warn('[handleDownloadGifAgente] Erro:', err);
      alert('Erro ao baixar o GIF: ' + (err.message ?? 'erro desconhecido'));
    } finally {
      setBaixandoGifId(null);
    }
  };

  // Reconstrói URLs do Supabase Storage pra pautas sem frames carregados neste navegador —
  // inclui pautas geradas por OUTRAS pessoas, já que o Storage é compartilhado mesmo que
  // 'crm_frame_pautas'/'crm_frame_urls' (localStorage) sejam por-navegador.
  useEffect(() => {
    if (history.length === 0) return;
    const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL as string) || '';
    if (!SUPABASE_URL) return;

    const storedUrls: Record<string, Record<string, string>> = (() => {
      try { return JSON.parse(localStorage.getItem('crm_frame_urls') || '{}'); }
      catch { return {}; }
    })();

    // Quantidade real de frames da pauta (N configurável no Modo B) — a geração sempre
    // nomeia como frame_0..frame_{N-1}, então a reconstrução precisa cobrir todos eles.
    const getExpectedFrameKeys = (p: PautaGerada): string[] => {
      const framesArray = p.visual?.frames ?? [
        p.visual?.frameInicial ?? '',
        p.visual?.frameIntermediario ?? '',
        p.visual?.frameFinal ?? '',
      ].filter(Boolean);
      return framesArray.map((_: any, i: number) => `frame_${i}`);
    };

    const toReconstruct = history.filter(p => {
      if (reconstructedRef.current.has(p.id)) return false;
      const expectedKeys = getExpectedFrameKeys(p);
      if (expectedKeys.length === 0) return false;
      const have = new Set([
        ...Object.keys(storedUrls[p.id] ?? {}),
        ...Object.keys(allFrameImages[p.id] ?? {}),
      ]);
      return expectedKeys.some(k => !have.has(k));
    });
    if (toReconstruct.length === 0) return;

    const reconstruct = async () => {
      // Todas as pautas e todos os frames em paralelo — com dezenas de pautas x N frames cada,
      // fazer isso em série (um HEAD request de cada vez) podia levar dezenas de segundos até
      // chegar na pauta que o usuário está olhando.
      const results = await Promise.all(toReconstruct.map(async (pauta) => {
        reconstructedRef.current.add(pauta.id);
        const safeMarca = pauta.marca.toLowerCase().replace(/[^a-z0-9]/g, '');
        const frameKeys = getExpectedFrameKeys(pauta);

        const frameResults = await Promise.all(frameKeys.map(async (frameName) => {
          // Preservar '_' — o backend salva como "frame_0.png", não "frame0.png"
          const safeFrame = frameName.replace(/[^a-z0-9_]/g, '');
          // "frames/{pautaId}/..." é a versão COMPOSTA (com headline/subheadline/CTA já
          // desenhados via /api/save-frame) — é essa que deve ser exibida. "{marca}/{pautaId}/..."
          // é só a imagem crua do PiApp, sem texto; usada como fallback se a composta não existir.
          const composedUrl = `${SUPABASE_URL}/storage/v1/object/public/campaign-images/frames/${pauta.id}/${safeFrame}.png`;
          const rawUrl = `${SUPABASE_URL}/storage/v1/object/public/campaign-images/${safeMarca}/${pauta.id}/${safeFrame}.png`;
          try {
            const composedResp = await fetch(composedUrl, { method: 'HEAD' });
            if (composedResp.ok) return [frameName, composedUrl] as const;
            const rawResp = await fetch(rawUrl, { method: 'HEAD' });
            return rawResp.ok ? [frameName, rawUrl] as const : null;
          } catch {
            return null;
          }
        }));

        const found: Record<string, string> = {};
        for (const entry of frameResults) {
          if (entry) found[entry[0]] = entry[1];
        }
        return { id: pauta.id, found };
      }));

      const urlUpdates: Record<string, Record<string, string>> = {};
      for (const { id, found } of results) {
        if (Object.keys(found).length > 0) urlUpdates[id] = found;
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
      try {
        upsertPautas(newHistory).catch(err => console.warn("[Supabase] upsertPautas falhou:", err));
      } catch (err) {
        console.warn("[Supabase] upsertPautas erro síncrono:", err);
      }
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
      console.error("[FormA] Erro completo:", err);
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
            corTextoBotao: (inputB as any).corTextoBotao || '#FFFFFF',
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

        // Manter os campos preenchidos após gerar, pra permitir regenerar/ajustar sem retypar tudo
        setEditInputPreload(inputB);
        // Redireciona para o histórico recém gerado
        setMainTab('historico');
      } else {
        alert(resData.error || "Erro de geração no servidor.");
      }
    } catch (err) {
      console.error("[FormB] Erro completo:", err);
      alert("Houve uma falha de rede ao calibrar o copilot de email CRM.");
    } finally {
      setLoading(false);
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

    if (pautaAprovada.modo === 'C') {
      try {
        const resp = await fetch('/api/feedback-agente-gif', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pauta: pautaAprovada, aprovado: true }),
        });
        const resData = await resp.json().catch(() => ({}));
        if (resData?.testeAb) {
          fetchTestesAb();
        }
      } catch (err) {
        console.warn('[feedback-agente-gif] Erro de rede ao registrar aprovação:', err);
      }
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

  const handleDiscardPauta = (id: string, motivo?: string) => {
    const updated = history.map((item) => {
      if (item.id === id) {
        return { ...item, status: 'descartado' as const };
      }
      return item;
    });
    saveHistory(updated);

    const pautaDescartada = history.find(p => p.id === id);
    if (pautaDescartada?.modo === 'C') {
      fetch('/api/feedback-agente-gif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pauta: pautaDescartada, aprovado: false, motivo }),
      }).catch(err => console.warn('[feedback-agente-gif] Erro de rede ao registrar reprovação:', err));
    }
  };

  const handleClearHistory = () => {
    if (confirm("Tem certeza de que deseja apagar permanentemente todas as pautas sugeridas no seu painel?")) {
      saveHistory([]);
    }
  };

  // Preenche o formulário do Modo B com tudo que foi usado pra gerar essa pauta
  // (copy + estilo visual), pra "refazer" sem redigitar do zero.
  const handleRefazerPauta = (pauta: PautaGerada) => {
    const inputOriginal = (pauta as any).inputOriginal ?? {};
    setCurrentBrand(pauta.marca);
    setCurrentMode('B');
    setEditInputPreload({
      marca: pauta.marca,
      boxTituloEmail: pauta.copy.assunto,
      boxHeadlineBanner: inputOriginal.headline || pauta.copy.headlineBanner,
      boxSubtituloEmail: inputOriginal.subheadline || pauta.copy.subHeadlineBanner,
      boxCta: inputOriginal.cta || pauta.copy.ctaBotao,
      boxMecanicaOuEstatico: pauta.operacional.mecanicaEscolhida,
      boxRecompensa: pauta.operacional.recompensaEscolhida,
      estiloVisualTexto: inputOriginal.estiloVisualTexto || '',
      fonteEscolhida: inputOriginal.fonteEscolhida || '',
      estiloBotaoEscolhido: inputOriginal.estiloBotaoEscolhido || 'pill',
      corTextoPrincipal: inputOriginal.corTextoPrincipal || '#FFFFFF',
      fonteSubtitulo: inputOriginal.fonteSubtitulo || '',
      corSubtitulo: inputOriginal.corSubtitulo || 'rgba(255,255,255,0.90)',
      corBotaoEscolhida: inputOriginal.corBotaoEscolhida || '',
      corTextoBotao: inputOriginal.corTextoBotao || '#FFFFFF',
      fonteBotao: inputOriginal.fonteBotao || '',
      estiloDesign: inputOriginal.estiloDesign || '',
    } as any);
    setDirecionamentoIA(inputOriginal.direcionamento || '');
    setMainTab('geracao');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearFilters = () => {
    setBrandFilter("all");
    setModoFilter("all");
    setTipoGeracaoFilter("all");
    setStatusFilter("all");
    setHistorySearchQuery("");
  };


  // O histórico do Agente (modo 'C') tem aba própria — nunca aparece no Histórico de Pautas
  // geral, pra não misturar contagens/KPIs de geração manual com geração autônoma.
  const historyNaoAgente = history.filter((p) => p.modo !== 'C');
  const agentePautas = history.filter((p) => p.modo === 'C');
  const agenteRascunho = agentePautas.filter((p) => p.status === 'rascunho');
  const agenteAprovadas = agentePautas.filter((p) => p.status === 'aprovado');

  // As pautas do Agente são geradas 100% no backend (worker.ts), que não tem acesso a canvas/DOM
  // pra desenhar headline/subtítulo/CTA sobre o frame (isso só existe client-side, via
  // composeFrame — o mesmo usado quando o usuário gera imagem manualmente no Modo A/B). Sem este
  // passo, os GIFs do agente saem sem nenhum texto desenhado, mesmo com o copy certo nos dados.
  // Roda uma vez por pauta (marca via composedAgentPautasRef) e persiste o resultado composto em
  // frame_urls, pra não recompor de novo em outra sessão/reload.
  const composedAgentPautasRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const pendentes = agentePautas.filter((p) => {
      if (composedAgentPautasRef.current.has(p.id)) return false;
      const frameUrls = (p as any).frameUrls as Record<string, string> | undefined;
      if (!frameUrls || Object.keys(frameUrls).length === 0) return false;
      const primeiraUrl = Object.values(frameUrls)[0];
      // Já composto? A versão com texto vive em .../campaign-images/frames/{id}/...
      if (primeiraUrl.includes('/campaign-images/frames/')) return false;
      return true;
    });
    if (pendentes.length === 0) return;
    pendentes.forEach((p) => composedAgentPautasRef.current.add(p.id));

    (async () => {
      const { composeFrame } = await import('./utils/composeFrame');
      for (const pauta of pendentes) {
        try {
          const frameUrls = (pauta as any).frameUrls as Record<string, string>;
          const composed: Record<string, string> = {};
          const entradas = Object.entries(frameUrls).sort(([a], [b]) => a.localeCompare(b));
          for (const [frameName, rawUrl] of entradas) {
            const composedDataUrl = await composeFrame({
              imageDataUrl: rawUrl,
              headline: pauta.copy.headlineBanner,
              subheadline: pauta.copy.subHeadlineBanner,
              cta: pauta.copy.ctaBotao,
              marca: pauta.marca,
              aspectRatio: pauta.aspectRatio || '1:1',
            });
            let finalUrl: string | undefined;
            try {
              const saveRes = await fetch('/api/save-frame', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pautaId: pauta.id, frameName, imageDataUrl: composedDataUrl }),
              });
              if (saveRes.ok) {
                const { publicUrl } = await saveRes.json();
                finalUrl = publicUrl;
              }
            } catch (err) {
              console.warn('[agente-gif] Falha ao salvar frame composto:', err);
            }
            composed[frameName] = finalUrl ?? composedDataUrl;
            handleFrameGenerated(pauta.id, frameName, composedDataUrl, finalUrl);
          }
          upsertPautas([{ ...pauta, frameUrls: composed } as PautaGerada]).catch((err) =>
            console.warn('[agente-gif] Falha ao persistir frames compostos:', err)
          );
        } catch (err) {
          console.warn('[agente-gif] Falha ao compor texto sobre os frames desta pauta:', err);
        }
      }
    })();
  }, [agentePautas]);

  const filteredHistory = historyNaoAgente.filter((p) => {
    const matchBrand = brandFilter === "all" || p.marca === brandFilter;
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchModo = modoFilter === "all" || p.modo === modoFilter;
    const matchTipo = tipoGeracaoFilter === "all" || (p.tipoGeracao ?? 'texto_imagem') === tipoGeracaoFilter;
    const query = historySearchQuery.trim().toLowerCase();
    const matchSearch = query === "" || [
      p.copy?.assunto, p.copy?.headlineBanner, p.copy?.subHeadlineBanner, p.copy?.ctaBotao,
    ].some(v => typeof v === 'string' && v.toLowerCase().includes(query));
    return matchBrand && matchStatus && matchModo && matchTipo && matchSearch;
  });

  // Filtro de período por cima dos demais filtros — janelas relativas (7/30/60/120 dias)
  // ou um intervalo de datas personalizado escolhido no calendário.
  const timeRangeFilteredHistory = filteredHistory.filter((p) => {
    const created = new Date(p.dataCriacao);
    if (historyTimeRange === 'custom') {
      if (customDateRange.start) {
        const start = new Date(customDateRange.start);
        start.setHours(0, 0, 0, 0);
        if (created < start) return false;
      }
      if (customDateRange.end) {
        const end = new Date(customDateRange.end);
        end.setHours(23, 59, 59, 999);
        if (created > end) return false;
      }
      return true;
    }
    const days = { '7d': 7, '30d': 30, '60d': 60, '120d': 120 }[historyTimeRange];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);
    return created >= cutoff;
  });

  const galleryOpenPauta = galleryOpenPautaId ? history.find(p => p.id === galleryOpenPautaId) ?? null : null;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--shell-bg)] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-600 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-[var(--shell-bg)] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-10 max-w-md w-full flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center">
            <span className="text-rose-600 text-3xl">✕</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Acesso negado</h2>
            <p className="text-sm text-slate-500">
              Este app é restrito a emails da organização.<br />
              Use um email @gocase.com, @gogroup.com ou @gobeaute.com
            </p>
          </div>
          <button
            onClick={() => { setAccessDenied(false); }}
            className="px-6 py-2.5 bg-[#13102A] text-white rounded-xl font-semibold hover:bg-slate-700 transition-colors cursor-pointer"
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
    <div className="min-h-screen bg-[var(--shell-bg)] text-[var(--shell-text)] font-sans antialiased selection:bg-[#688D65]/30">
      <Sidebar section={section} setSection={setSection} />

      <div className="ml-16 lg:ml-60 py-10 px-4 sm:px-6 lg:px-8">
      <div className={`${section === 'calendarios' ? 'w-full' : 'max-w-7xl'} mx-auto flex flex-col gap-8`}>

        {section === 'calendarios' ? (
          <CalendarioSecao
            userEmail={session?.user?.email}
            onLogout={() => supabase?.auth.signOut()}
          />
        ) : (
        <>
        {/* Top Header & Brand Selector */}
        <Header
          currentBrand={currentBrand}
          setCurrentBrand={setCurrentBrand}
          userEmail={session?.user?.email}
          onLogout={() => supabase?.auth.signOut()}
        />

        {/* Abas Principais de Navegação */}
        <div id="main-tabs-container" className="flex border-b border-[var(--shell-border)] gap-1 sm:gap-2 mb-4 relative z-10 p-1 bg-[var(--shell-panel-soft)] rounded-2xl">
          <button
            id="tab-btn-geracao"
            onClick={() => setMainTab('geracao')}
            className={`flex-1 sm:flex-initial py-3 px-5 rounded-xl text-xs sm:text-sm font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
              mainTab === 'geracao'
                ? isLight
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-lg'
                  : 'bg-[#688D65]/20 text-emerald-300 border border-[#688D65]/30 shadow-lg'
                : 'text-[var(--shell-text-muted)] hover:text-[var(--shell-text)] hover:bg-[var(--shell-panel)]/50'
            }`}
          >
            <Sparkles className={`w-4 h-4 ${isLight ? 'text-indigo-400' : 'text-emerald-400'}`} />
            Painel de Geração Inteligente
          </button>

          <button
            id="tab-btn-historico"
            onClick={() => setMainTab('historico')}
            className={`flex-1 sm:flex-initial py-3 px-5 rounded-xl text-xs sm:text-sm font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer relative ${
              mainTab === 'historico'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-lg'
                : 'text-[var(--shell-text-muted)] hover:text-[var(--shell-text)] hover:bg-[var(--shell-panel)]/50'
            }`}
          >
            <Clock className="w-4 h-4 text-indigo-450" />
            Histórico de Pautas
          </button>

          <button
            id="tab-btn-agente"
            onClick={() => setMainTab('agente')}
            className={`flex-1 sm:flex-initial py-3 px-5 rounded-xl text-xs sm:text-sm font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer relative ${
              mainTab === 'agente'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-lg'
                : 'text-[var(--shell-text-muted)] hover:text-[var(--shell-text)] hover:bg-[var(--shell-panel)]/50'
            }`}
          >
            <Bot className="w-4 h-4 text-indigo-450" />
            Modo C: Agente Inteligente
            {agenteRascunho.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {agenteRascunho.length}
              </span>
            )}
          </button>
        </div>

        {/* Renderização condicional por Aba Principal */}
        {mainTab === 'geracao' ? (
          <div className="max-w-6xl mx-auto w-full animate-fade-in flex flex-col gap-6">

            {/* Seletor central de marcas exclusivo do Painel de Geração */}
            <div className="bg-[var(--shell-panel)] border border-[var(--shell-border)] p-6 rounded-3xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl">
              <div className="absolute top-0 right-0 w-80 h-80 bg-[var(--shell-panel-soft)] rounded-full blur-3xl opacity-10 pointer-events-none -mr-20 -mt-20"></div>

              <div className="relative z-10 flex flex-col gap-1 max-w-xl text-left">
                <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#AA834B]">
                  Workspace de Criação de E-mail de CRM
                </span>
                <h2 className="text-xl font-bold font-sans text-[var(--shell-text)]">
                  Selecione a Marca para Separar as Regras e Diretivas
                </h2>
                <p className="text-xs text-[var(--shell-text-muted)] leading-relaxed mt-1">
                  Ative o playbook apropriado para calibrar a inteligência com as restrições estritas da marca, incluindo limites de assunto, cores de proibição e tonalidades do visual.
                </p>
              </div>

              {/* Botões Grandes Detalhados de Marca */}
              <div className="bg-[var(--shell-bg)]/80 p-1.5 rounded-2xl border border-[var(--shell-border)] flex items-center gap-2 shrink-0 relative z-10 w-full md:w-auto">
                <button
                  id="tab-brand-apice-local"
                  onClick={() => { setCurrentBrand('Apice'); setEditInputPreload(null); }}
                  className={`flex-1 md:flex-none px-5 py-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                    currentBrand === 'Apice'
                      ? 'bg-[#688D65] text-white shadow-lg shadow-[#688D65]/20'
                      : 'text-[var(--shell-text-muted)] hover:text-[var(--shell-text)] hover:bg-[var(--shell-panel)]'
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
                      : 'text-[var(--shell-text-muted)] hover:text-[var(--shell-text)] hover:bg-[var(--shell-panel)]'
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
                <div className="bg-[var(--shell-panel-soft)] rounded-3xl p-5 border border-[var(--shell-border)] flex flex-col gap-4">
                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[#AA834B]">
                      Criação de {currentBrand}
                    </span>
                    <h3 className="text-sm font-black text-[var(--shell-text)]">
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
                          : 'bg-[var(--shell-bg)]/40 border-[var(--shell-border)] hover:bg-[var(--shell-panel)]/50'
                      }`}
                    >
                      <div className="flex justify-between items-start w-full">
                        <div className={`p-1.5 rounded-lg w-fit ${currentMode === 'A' ? (isLight ? 'bg-indigo-600/20 text-indigo-500' : currentBrand === 'Apice' ? 'bg-[#688D65]/20 text-emerald-300' : 'bg-[#BF0F26]/20 text-rose-300') : 'bg-[var(--shell-panel)] text-[var(--shell-text-muted)]'} mb-3`}>
                          <Sparkles className="w-4 h-4" />
                        </div>
                        {currentMode === 'A' && (
                          <span className={`w-2 h-2 rounded-full ${currentBrand === 'Apice' ? 'bg-[#688D65]' : 'bg-[#BF0F26]'}`}></span>
                        )}
                      </div>
                      <div>
                        <h4 className={`text-xs font-bold uppercase tracking-wider ${currentMode === 'A' ? 'text-[var(--shell-text)] font-extrabold' : 'text-[var(--shell-text-muted)]'}`}>
                          Modo A: Descoberta Livre
                        </h4>
                        <p className="text-[10px] text-[var(--shell-text-muted)] leading-normal mt-1">
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
                          : 'bg-[var(--shell-bg)]/40 border-[var(--shell-border)] hover:bg-[var(--shell-panel)]/50'
                      }`}
                    >
                      <div className="flex justify-between items-start w-full">
                        <div className={`p-1.5 rounded-lg w-fit ${currentMode === 'B' ? (isLight ? 'bg-indigo-600/20 text-indigo-500' : currentBrand === 'Apice' ? 'bg-[#688D65]/20 text-emerald-300' : 'bg-[#BF0F26]/20 text-rose-300') : 'bg-[var(--shell-panel)] text-[var(--shell-text-muted)]'} mb-3`}>
                          <Sliders className="w-4 h-4" />
                        </div>
                        {currentMode === 'B' && (
                          <span className={`w-2 h-2 rounded-full ${currentBrand === 'Apice' ? 'bg-[#688D65]' : 'bg-[#BF0F26]'}`}></span>
                        )}
                      </div>
                      <div>
                        <h4 className={`text-xs font-bold uppercase tracking-wider ${currentMode === 'B' ? 'text-[var(--shell-text)]' : 'text-[var(--shell-text-muted)]'}`}>
                          Modo B: Briefing Co-Pilot
                        </h4>
                        <p className="text-[10px] text-[var(--shell-text-muted)] leading-normal mt-1">
                          Escreva suas ideias parciais e a inteligência calibra, ajusta e expande seu briefing seguindo o playbook de {currentBrand}.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Perfil tático consolidado focado na marca selecionada para o Modo A e B */}
                <div className="bg-[var(--shell-panel-soft)] border border-[var(--shell-border)] p-5 rounded-3xl flex flex-col gap-3 text-left">
                  <h4 className="text-xs uppercase font-extrabold tracking-widest text-[#AA834B]">
                    Acordo tático de {currentBrand}
                  </h4>
                  <div className="flex flex-col gap-2.5 text-xs text-[var(--shell-text-muted)]">
                    <p className="leading-relaxed">
                      Todas as geração neste modo são automaticamente governadas pelas regras invioláveis:
                    </p>
                    <div className="flex justify-between pb-2 border-b border-[var(--shell-border)]">
                      <span className="text-[var(--shell-text-muted)]">Tom de voz:</span>
                      <strong className="text-[var(--shell-text)]">{currentBrand === 'Apice' ? 'Acolhedor, Íntimo e Próximo' : 'Elegante, Direto, Sofisticado'}</strong>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-[var(--shell-border)]">
                      <span className="text-[var(--shell-text-muted)]">Eixo Central:</span>
                      <strong className="text-[var(--shell-text)]">{currentBrand === 'Apice' ? 'Manipular (puxar/cortar/jogar)' : 'Abrir (carta/presente/caixa)'}</strong>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-[var(--shell-border)]">
                      <span className="text-[var(--shell-text-muted)]">Caracteres Assunto:</span>
                      <strong className="text-amber-400 font-mono">{currentBrand === 'Apice' ? '27 a 47 caracteres' : '16 a 39 caracteres'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--shell-text-muted)]">Restrição de Assunto:</span>
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
        ) : mainTab === 'historico' ? (
          <div className="w-full flex flex-col gap-8 animate-fade-in text-left">

            {/* Dashboard KPIs consolidado — pautas do Agente (modo C) ficam de fora, têm aba própria */}
            <HistoryList
              history={historyNaoAgente}
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
              historySearchQuery={historySearchQuery}
              setHistorySearchQuery={setHistorySearchQuery}
              historyTimeRange={historyTimeRange}
              setHistoryTimeRange={setHistoryTimeRange}
              customDateRange={customDateRange}
              setCustomDateRange={setCustomDateRange}
            />

            {/* Alternação entre o Timeline Semanal do Planejador e a Lista Detalhada */}
            {historySubTab === 'planner' ? (
              <WeeklyPlanner
                pautas={filteredHistory}
                onOpenPreview={(p) => openPreview(p)}
                onUpdatePautaDay={handleUpdatePautaDay}
              />
            ) : (
              /* Galeria de pautas do período selecionado — thumbnails clicáveis, abre detalhe completo */
              <div className="flex flex-col gap-4 text-left">
                {timeRangeFilteredHistory.length > 0 && (
                  <HistoryGallery
                    pautas={timeRangeFilteredHistory}
                    frameImagesByPauta={allFrameImages}
                    onOpenPauta={(pauta) => setGalleryOpenPautaId(pauta.id)}
                  />
                )}

                {timeRangeFilteredHistory.length === 0 && historyNaoAgente.length > 0 && (
                  <div className="bg-[var(--shell-panel-soft)] text-center py-12 px-8 border border-[var(--shell-border)] border-dashed rounded-[2.5rem] text-[var(--shell-text-muted)] max-w-2xl mx-auto w-full">
                    <span className="text-3xl mb-3 block">🔍</span>
                    <h4 className="text-base font-bold text-[var(--shell-text)]">Nenhuma pauta encontrada nesse período/filtros</h4>
                    <p className="text-sm text-[var(--shell-text-muted)] mt-1 mb-4">Tente um período maior ou limpe os filtros acima.</p>
                    <button
                      onClick={handleClearFilters}
                      className="bg-[var(--shell-panel)] hover:bg-[var(--shell-border)] text-[var(--shell-text)] px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Limpar filtros
                    </button>
                  </div>
                )}

                {historyNaoAgente.length === 0 && (
                  <div className="bg-[var(--shell-panel-soft)] text-center py-20 px-8 border border-[var(--shell-border)] border-dashed rounded-[2.5rem] text-[var(--shell-text-muted)] max-w-2xl mx-auto w-full">
                    <span className="text-5xl mb-4 block animate-bounce">🤖</span>
                    <h4 className="text-lg font-bold text-[var(--shell-text)]">Seu histórico de pautas geradas está vazio</h4>
                    <p className="text-sm text-[var(--shell-text-muted)] mt-2 max-w-sm mx-auto leading-relaxed">
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
        ) : (
          <ModoCPanel
            agentePautas={agentePautas}
            allFrameImages={allFrameImages}
            onOpenPautaDetail={(id) => setGalleryOpenPautaId(id)}
            testesAb={testesAb}
            onAceitarAb={handleAceitarAb}
            onRejeitarAb={handleRejeitarAb}
            regenerandoAbId={regenerandoAbId}
            onEnviarInsider={handleEnviarInsider}
            enviandoInsiderId={enviandoInsiderId}
            onDownloadGif={handleDownloadGifAgente}
            baixandoGifId={baixandoGifId}
          />
        )}
        </>
        )}

      </div>
      </div>

      {activePreviewPauta && (
        <PreviewModal
          pauta={activePreviewPauta}
          initialTab={previewInitialTab}
          onClose={() => setActivePreviewPauta(null)}
          onUpdatePauta={handleUpdatePauta}
          frameImages={allFrameImages[activePreviewPauta.id] ?? {}}
          onFrameGenerated={handleFrameGenerated}
          aspectRatio={aspectRatio}
          imageModel={imageModel}
          referenciaImagem={referenciasImagem[0] ?? undefined}
          referenciasImagem={referenciasImagem}
          onCanStartGenerating={(pautaId: string) => {
            if (generatingPautasRef.current.has(pautaId)) return false;
            generatingPautasRef.current.add(pautaId);
            return true;
          }}
          onFinishedGenerating={(pautaId: string) => {
            generatingPautasRef.current.delete(pautaId);
          }}
        />
      )}

      {galleryOpenPauta && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center p-4 overflow-y-auto backdrop-blur-md bg-slate-950/80 animate-fade-in"
          onClick={() => setGalleryOpenPautaId(null)}
        >
          <div className="relative w-full max-w-4xl my-8" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setGalleryOpenPautaId(null)}
              title="Fechar"
              className="absolute -top-3 -right-3 z-10 bg-slate-900 text-white rounded-full p-2 shadow-lg hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <ResultPauta
              pauta={galleryOpenPauta}
              onApprove={handleApprovePauta}
              onDiscard={handleDiscardPauta}
              onRefazer={(p) => { setGalleryOpenPautaId(null); handleRefazerPauta(p); }}
              onOpenPreview={(p, tab) => openPreview(p, tab)}
              aspectRatio={aspectRatio}
              imageModel={imageModel}
              referenciaImagem={referenciasImagem[0] ?? undefined}
              referenciasImagem={referenciasImagem}
              frameImages={allFrameImages[galleryOpenPauta.id] ?? {}}
              onFrameGenerated={handleFrameGenerated}
              onCanStartGenerating={(pautaId: string) => {
                if (generatingPautasRef.current.has(pautaId)) return false;
                generatingPautasRef.current.add(pautaId);
                return true;
              }}
              onFinishedGenerating={(pautaId: string) => {
                generatingPautasRef.current.delete(pautaId);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
