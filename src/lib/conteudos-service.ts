import { supabase } from './supabase';

export interface ConteudoGifBusca {
  id: string;
  marca: string | null;
  nomeDesign: string | null;
  storageUrl: string | null;
  insiderOriginalUrl: string | null;
  mecanicaTexto: string | null;
}

// Busca manual de GIFs históricos pra usar como Variante B do teste A/B (Modo C, Passo 2).
// Sem filtro de marca no WHERE porque o conteúdo do agente é genérico (não amarrado a uma
// marca específica) — a coluna `marca` aqui é só um rótulo informativo pro usuário escolher.
export async function buscarConteudosGif(query: string): Promise<ConteudoGifBusca[] | null> {
  if (!supabase) return null;
  let builder = supabase
    .from('conteudos_links')
    .select('id, marca, nome_design, storage_url, insider_original_url, mecanica_texto')
    .eq('tipo_midia', 'gif')
    .neq('status_analise', 'descartado');

  const termo = query.trim();
  if (termo) {
    const escaped = termo.replace(/[%_]/g, (c) => `\\${c}`);
    builder = builder.or(`nome_design.ilike.%${escaped}%,mecanica_texto.ilike.%${escaped}%`);
  }

  const { data, error } = await builder.order('nome_design').limit(40);
  if (error) {
    console.warn('[Supabase] buscarConteudosGif falhou:', error.message);
    return null;
  }
  return (data as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    marca: (row.marca ?? null) as string | null,
    nomeDesign: (row.nome_design ?? null) as string | null,
    storageUrl: (row.storage_url ?? null) as string | null,
    insiderOriginalUrl: (row.insider_original_url ?? null) as string | null,
    mecanicaTexto: (row.mecanica_texto ?? null) as string | null,
  }));
}
