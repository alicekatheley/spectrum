import { supabase } from './supabase';
import type { PautaGerada } from '../types';

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
  };
}

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
  };
}

export async function getPautas(): Promise<PautaGerada[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('pautas_geradas')
    .select('*')
    .order('data_criacao', { ascending: false });
  if (error) {
    console.warn('[Supabase] getPautas falhou:', error.message);
    return null;
  }
  return (data as Record<string, unknown>[]).map(fromDb);
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
