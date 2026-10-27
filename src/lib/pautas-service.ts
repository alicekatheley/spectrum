import { supabase } from './supabase';
import type { PautaEnvioInsider, PautaGerada, TesteAbProposta } from '../types';

// Maps a DB row (snake_case) to the PautaGerada interface
function fromDb(row: Record<string, unknown>): PautaGerada {
  return {
    id: row.id as string,
    marca: row.marca as PautaGerada['marca'],
    modo: row.modo as PautaGerada['modo'],
    tipoGeracao: ((row.tipo_geracao ?? 'texto_imagem') as PautaGerada['tipoGeracao']),
    copy: row.copy as PautaGerada['copy'],
    visual: row.visual as PautaGerada['visual'],
    operacional: row.operacional as PautaGerada['operacional'],
    previsao: row.previsao as PautaGerada['previsao'],
    riscos: (row.riscos as PautaGerada['riscos']) || [],
    status: row.status as PautaGerada['status'],
    dataCriacao: (row.data_criacao ?? row.dataCriacao) as string,
    inputOriginal: row.input_original ?? undefined,
    aspectRatio: (row.aspect_ratio ?? undefined) as string | undefined,
    frameUrls: (row.frame_urls ?? undefined) as Record<string, string> | undefined,
  } as any;
}

// frame_urls só guarda URL pública. Um data URL (base64) de cada frame pesa MBs e, somado no
// histórico, já gerou upserts de 18 MB que derrubaram o Supabase (27/10/2026).
function semDataUrls(frameUrls: Record<string, string> | undefined): Record<string, string> | null {
  if (!frameUrls) return null;
  const limpas = Object.fromEntries(
    Object.entries(frameUrls).filter(([, url]) => typeof url === 'string' && !url.startsWith('data:'))
  );
  return Object.keys(limpas).length > 0 ? limpas : null;
}

// Colunas lidas pelo front — explícitas pra uma coluna pesada nova não entrar no polling sem querer.
const PAUTA_COLUNAS =
  'id, marca, modo, tipo_geracao, copy, visual, operacional, previsao, riscos, status, data_criacao, input_original, aspect_ratio, frame_urls';

// Maps a PautaGerada to a DB row (snake_case columns)
function toDb(p: PautaGerada) {
  return {
    id: p.id,
    marca: p.marca,
    modo: p.modo,
    tipo_geracao: p.tipoGeracao,
    copy: p.copy,
    visual: p.visual,
    operacional: p.operacional,
    previsao: p.previsao,
    riscos: p.riscos,
    status: p.status,
    data_criacao: p.dataCriacao,
    input_original: (p as any).inputOriginal ?? null,
    aspect_ratio: (p as any).aspectRatio ?? null,
    frame_urls: semDataUrls((p as any).frameUrls),
  };
}

export async function getPautas(): Promise<PautaGerada[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('pautas_geradas')
    .select(PAUTA_COLUNAS)
    .order('data_criacao', { ascending: false });
  if (error) {
    console.warn('[Supabase] getPautas falhou:', error.message);
    return null;
  }
  return (data as unknown as Record<string, unknown>[]).map(fromDb);
}

// Só os ids — usado pelo polling, que precisa descobrir pautas novas sem baixar o histórico todo.
export async function getPautaIds(): Promise<string[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('pautas_geradas').select('id');
  if (error) {
    console.warn('[Supabase] getPautaIds falhou:', error.message);
    return null;
  }
  return (data as { id: string }[]).map((row) => row.id);
}

export async function getPautasPorIds(ids: string[]): Promise<PautaGerada[] | null> {
  if (!supabase || ids.length === 0) return [];
  const { data, error } = await supabase
    .from('pautas_geradas')
    .select(PAUTA_COLUNAS)
    .in('id', ids)
    .order('data_criacao', { ascending: false });
  if (error) {
    console.warn('[Supabase] getPautasPorIds falhou:', error.message);
    return null;
  }
  return (data as unknown as Record<string, unknown>[]).map(fromDb);
}

export async function upsertPautas(pautas: PautaGerada[]): Promise<void> {
  if (!supabase || pautas.length === 0) return;
  const { error } = await supabase
    .from('pautas_geradas')
    .upsert(pautas.map(toDb), { onConflict: 'id' });
  if (error) console.warn('[Supabase] upsertPautas falhou:', error.message);
}

export async function clearPautas(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('pautas_geradas')
    .delete()
    .neq('id', '');
  if (error) console.warn('[Supabase] clearPautas falhou:', error.message);
}

// Envios de pautas (campanha única, sem A/B) pra Insider — agrupados por pauta, já que a
// mesma pauta pode ter sido enviada pra várias contas de destino.
export async function getPautaEnviosInsider(): Promise<Record<string, PautaEnvioInsider[]> | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('pauta_envios_insider')
    .select('pauta_id, marca, insider_campaign_id, gif_url, enviado_em')
    .order('enviado_em', { ascending: false });
  if (error) {
    console.warn('[Supabase] getPautaEnviosInsider falhou:', error.message);
    return null;
  }
  const porPauta: Record<string, PautaEnvioInsider[]> = {};
  for (const row of data as Record<string, unknown>[]) {
    const pautaId = row.pauta_id as string;
    (porPauta[pautaId] ??= []).push({
      marca: row.marca as PautaEnvioInsider['marca'],
      insiderCampaignId: row.insider_campaign_id as string,
      gifUrl: (row.gif_url ?? null) as string | null,
      enviadoEm: row.enviado_em as string,
    });
  }
  return porPauta;
}
