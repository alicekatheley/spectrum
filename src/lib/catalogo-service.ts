import { supabase } from './supabase';
import type { CatalogoSyncRun, MarcaCatalogo, ProdutoCatalogo } from '../types';

// Camada de leitura do catálogo Yampi sincronizado. Só read — a escrita mora na
// Edge Function `sync-catalogo-yampi`, chamada pelo pg_cron.

function fromDb(row: Record<string, unknown>): ProdutoCatalogo {
  return {
    id: row.id as string,
    marca: row.marca as MarcaCatalogo,
    yampiProductId: Number(row.yampi_product_id),
    yampiAlias: row.yampi_alias as string,
    sku: (row.sku as string | null) ?? null,
    nome: row.nome as string,
    descricao: (row.descricao as string | null) ?? null,
    descricaoCurta: (row.descricao_curta as string | null) ?? null,
    precoDe: row.preco_de == null ? null : Number(row.preco_de),
    precoPor: row.preco_por == null ? null : Number(row.preco_por),
    emPromocao: Boolean(row.em_promocao),
    categorias: (row.categorias as ProdutoCatalogo['categorias']) ?? [],
    imagens: (row.imagens as ProdutoCatalogo['imagens']) ?? [],
    imagemPrincipal: (row.imagem_principal as string | null) ?? null,
    urlProduto: (row.url_produto as string | null) ?? null,
    estoque: row.estoque == null ? null : Number(row.estoque),
    disponivel: Boolean(row.disponivel),
    sincronizadoEm: row.sincronizado_em as string,
  };
}

export interface ListarProdutosParams {
  marca: MarcaCatalogo;
  /** Filtra por texto no nome do produto (usa índice trigram). Case-insensitive. */
  busca?: string;
  /** Se true (padrão), só produtos com `disponivel = true`. */
  somenteDisponiveis?: boolean;
  /** ID de categoria Yampi para filtrar. */
  categoriaId?: number;
  limite?: number;
}

export async function listarProdutos(
  params: ListarProdutosParams,
): Promise<ProdutoCatalogo[]> {
  if (!supabase) return [];

  let query = supabase
    .from('catalogo_produtos')
    .select('*')
    .eq('marca', params.marca)
    .order('nome', { ascending: true });

  if (params.somenteDisponiveis !== false) {
    query = query.eq('disponivel', true);
  }
  if (params.busca && params.busca.trim().length > 0) {
    query = query.ilike('nome', `%${params.busca.trim()}%`);
  }
  if (params.categoriaId != null) {
    // Match no jsonb: any element with { id: <categoriaId> }
    query = query.contains('categorias', [{ id: params.categoriaId }]);
  }
  if (params.limite && params.limite > 0) {
    query = query.limit(params.limite);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('[Supabase] listarProdutos falhou:', error.message);
    return [];
  }
  return (data as Record<string, unknown>[]).map(fromDb);
}

export async function getUltimaSync(marca: MarcaCatalogo): Promise<CatalogoSyncRun | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('catalogo_sync_runs')
    .select('*')
    .eq('marca', marca)
    .order('iniciado_em', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[Supabase] getUltimaSync falhou:', error.message);
    return null;
  }
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    marca: row.marca as string,
    iniciadoEm: row.iniciado_em as string,
    terminadoEm: (row.terminado_em as string | null) ?? null,
    status: row.status as CatalogoSyncRun['status'],
    produtosProcessados: Number(row.produtos_processados ?? 0),
    produtosNovos: Number(row.produtos_novos ?? 0),
    produtosAtualizados: Number(row.produtos_atualizados ?? 0),
    produtosDesativados: Number(row.produtos_desativados ?? 0),
    erro: (row.erro as string | null) ?? null,
    duracaoMs: row.duracao_ms == null ? null : Number(row.duracao_ms),
  };
}
