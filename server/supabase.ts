import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";
import type { MarcaDnaContext, EmailHitContext } from "./types.ts";
import { hardcodedDisparos, DEFAULT_MECANICAS } from "./data.ts";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
export const supabaseCrmAi = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { db: { schema: 'crm_ai' } })
  : null;

// ─── Mutable state ────────────────────────────────────────────────────────────
let _databaseDisparos: typeof hardcodedDisparos = hardcodedDisparos;
let _mecanicasCatalog: string[] = [...DEFAULT_MECANICAS];
let _crmAiMarcas: Record<string, MarcaDnaContext> = {};
let _crmAiHits: Record<string, EmailHitContext[]> = {};
let _crmAiEstilos: string[] = [];
let _crmAiMecanicasCanonical: string[] = [];

export const getDatabaseDisparos = () => _databaseDisparos;
export const getMecanicasCatalog = () => _mecanicasCatalog;
export const getCrmAiMarcas = () => _crmAiMarcas;
export const getCrmAiHits = () => _crmAiHits;
export const getCrmAiEstilos = () => _crmAiEstilos;

// ─── Loaders ─────────────────────────────────────────────────────────────────
export async function loadDisparosFromSupabase() {
  if (!supabase) return;
  const { data, error } = await supabase.from("disparos_historicos").select("*");
  if (error || !data || data.length === 0) {
    console.warn("[Supabase] Fallback para banco local:", error?.message ?? "sem dados");
    return;
  }
  _databaseDisparos = data.map((row: any) => ({
    id: row.id,
    marca: row.marca,
    mecanica: row.mecanica,
    disparos: row.disparos,
    receitaMedia: row.receita_media ?? row.receitaMedia ?? 0,
    performance: row.performance,
    contextosRecomendados: row.contextos_recomendados ?? row.contextosRecomendados ?? [],
  }));
  console.log(`[Supabase] ${_databaseDisparos.length} disparos históricos carregados.`);
}

export async function loadMecanicasFromSupabase() {
  if (!supabase) return;
  const { data, error } = await supabase.from('mecanicas_catalog').select('nome').order('id');
  if (error || !data || data.length === 0) {
    console.warn('[Supabase] Catálogo de mecânicas não carregado, usando padrão.');
    return;
  }
  _mecanicasCatalog = data.map((r: any) => r.nome as string);
  console.log(`[Supabase] ${_mecanicasCatalog.length} mecânicas no catálogo.`);
}

export async function loadCrmAiContext() {
  if (!supabase) return;
  try {
    // Uses RPC proxy functions (SECURITY DEFINER in public schema) — bypasses PostgREST schema restriction

    // 1. marcas
    const { data: marcasRaw, error: marcasErr } = await supabase.rpc('crm_ai_get_marcas');
    if (marcasErr) throw new Error(`crm_ai_get_marcas: ${marcasErr.message}`);
    for (const m of (marcasRaw as any[]) ?? []) {
      const paleta = (m.paleta_cores ?? {}) as Record<string, any>;
      const formatted = Object.entries(paleta)
        .filter(([k]) => !['primaria', 'secundaria'].includes(k))
        .map(([, v]: any) => `${v.hex} — ${v.uso}`)
        .join('; ');
      _crmAiMarcas[m.nome] = {
        marcaId: m.marca_id,
        tomDeVoz: m.tom_de_voz ?? '',
        paletaFormatada: formatted,
        primaryHex: paleta.primaria ?? '',
        secondaryHex: paleta.secundaria ?? '',
      };
    }
    console.log(`[crm_ai] ${Object.keys(_crmAiMarcas).length} marcas carregadas.`);

    // 2. list_mecanica + list_estilo_visual
    const { data: listsRaw, error: listsErr } = await supabase.rpc('crm_ai_get_lists');
    if (listsErr) throw new Error(`crm_ai_get_lists: ${listsErr.message}`);
    const lists = (listsRaw ?? {}) as { mecanicas: any[]; estilos: any[] };
    const mecMap: Record<number, string> = {};
    for (const m of lists.mecanicas ?? []) {
      mecMap[m.id] = m.valor;
      _crmAiMecanicasCanonical.push(m.valor as string);
    }
    _crmAiEstilos = (lists.estilos ?? []).map((e: any) => e.valor as string);

    // 3. top emails por receita
    const { data: emailsRaw, error: emailsErr } = await supabase.rpc('crm_ai_get_top_emails', { limit_n: 40 });
    if (emailsErr) throw new Error(`crm_ai_get_top_emails: ${emailsErr.message}`);
    const hitsByMarcaId: Record<number, EmailHitContext[]> = {};
    for (const e of (emailsRaw as any[]) ?? []) {
      const mid = e.marca_id as number;
      if (!hitsByMarcaId[mid]) hitsByMarcaId[mid] = [];
      if (hitsByMarcaId[mid].length >= 8) continue;
      hitsByMarcaId[mid].push({
        mecanicaNome: mecMap[e.mecanica_id] ?? 'Outra',
        descricaoVisual: String(e.descricao_visual).slice(0, 500),
        receita: `R$${Number(e.receita).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`,
        taxaAbertura: e.taxa_abertura ? `${(Number(e.taxa_abertura) * 100).toFixed(1)}%` : '?',
        ctor: e.ctor ? `${(Number(e.ctor) * 100).toFixed(2)}%` : '?',
      });
    }
    for (const [nomeMarca, ctx] of Object.entries(_crmAiMarcas)) {
      _crmAiHits[nomeMarca] = hitsByMarcaId[ctx.marcaId] ?? [];
    }

    const totalHits = Object.values(_crmAiHits).reduce((s, a) => s + a.length, 0);
    console.log(`[crm_ai] ${totalHits} email hits + ${_crmAiEstilos.length} estilos + ${_crmAiMecanicasCanonical.length} mecânicas carregados.`);
  } catch (err: any) {
    console.warn('[crm_ai] Falha ao carregar contexto (usando fallbacks):', err.message);
  }
}

export function buildVisualHitsBlock(marca: string): string {
  const hits = _crmAiHits[marca];
  if (!hits || hits.length === 0) return '';
  const lines = hits.map((h, i) =>
    `  ${i + 1}. Mecânica: "${h.mecanicaNome}" | Receita: ${h.receita} | Abertura: ${h.taxaAbertura} | CTOR: ${h.ctor}\n     Visual: ${h.descricaoVisual.replace(/\n+/g, ' ')}`
  );
  return `\n=== TOP EMAILS DE MAIOR RECEITA DA MARCA ${marca.toUpperCase()} (use como referência visual obrigatória) ===\n${lines.join('\n\n')}\n`;
}

export async function autoRegisterMecanica(nome: string) {
  if (!nome || !supabase) return;
  const normalized = nome.trim();
  if (!normalized) return;
  if (_mecanicasCatalog.some(m => m.toLowerCase() === normalized.toLowerCase())) return;
  const { error } = await supabase
    .from('mecanicas_catalog')
    .upsert({ nome: normalized, categoria: 'ia_gerada', criado_por: 'ia_auto' }, { onConflict: 'nome' });
  if (!error) {
    _mecanicasCatalog.push(normalized);
    console.log(`[Mecânicas] Nova mecânica registrada automaticamente: "${normalized}"`);
  }
}
