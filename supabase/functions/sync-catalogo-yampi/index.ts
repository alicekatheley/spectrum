// Edge Function: sync-catalogo-yampi
//
// Rodando no runtime Deno do Supabase. Chamada pelo pg_cron todo dia às 04h BRT
// (07h UTC) e também manualmente via `curl -X POST .../sync-catalogo-yampi` para
// disparar sync sob demanda quando alguém acaba de subir um produto novo.
//
// O grupo (Grupo Beauté) tem UMA conta Yampi que administra 5 lojas — logo, um
// único par (User-Token, User-Secret-Key) autentica todas, e o que muda por marca
// é só o `alias` no path. Modelo dos secrets reflete isso:
//   YAMPI_USER_TOKEN        (1 secret compartilhado)
//   YAMPI_USER_SECRET_KEY   (1 secret compartilhado)
//   YAMPI_APICE_ALIAS       (1 secret por marca)
//   YAMPI_BARBOURS_ALIAS
//   YAMPI_LESCENT_ALIAS
//   YAMPI_KOKESHI_ALIAS
//   YAMPI_RITUARIA_ALIAS
//
// Se qualquer secret faltar, essa marca é pulada — nunca reutilizamos alias/token
// entre marcas "por esperteza", isso já causou vazamento de catálogo em outros lugares.
//
// Fluxo por marca:
//   1. Cria linha em catalogo_sync_runs com status='em_execucao'.
//   2. Pagina a Yampi Catalog API.
//   3. Upserta cada produto em catalogo_produtos (marca + yampi_product_id é a chave).
//   4. Marca disponivel=false para produtos que não foram vistos nesta run.
//   5. Atualiza a run com status='sucesso' e as contagens.
//
// Erros por marca são isolados: se Ápice falha, Barbours ainda tenta. A resposta
// da função é 200 mesmo com falhas parciais — o pg_cron não sabe reagir a status
// HTTP e a UI de erro fica em catalogo_sync_runs, onde o operador de fato vai olhar.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ─── Config de marcas ──────────────────────────────────────────────────────

type MarcaCatalogo = "Apice" | "Barbours" | "Lescent" | "Kokeshi" | "Rituaria";

interface CredencialMarca {
  marca: MarcaCatalogo;
  alias: string;
  userToken: string;
  userSecretKey: string;
}

function lerCredenciais(): CredencialMarca[] {
  const userToken = Deno.env.get("YAMPI_USER_TOKEN") ?? "";
  const userSecretKey = Deno.env.get("YAMPI_USER_SECRET_KEY") ?? "";

  if (!userToken || !userSecretKey) {
    console.warn(
      "[yampi-sync] YAMPI_USER_TOKEN e/ou YAMPI_USER_SECRET_KEY ausentes — nenhuma marca vai sincronizar.",
    );
    return [];
  }

  const marcas: Array<{ marca: MarcaCatalogo; envAlias: string }> = [
    { marca: "Apice", envAlias: "YAMPI_APICE_ALIAS" },
    { marca: "Barbours", envAlias: "YAMPI_BARBOURS_ALIAS" },
    { marca: "Lescent", envAlias: "YAMPI_LESCENT_ALIAS" },
    { marca: "Kokeshi", envAlias: "YAMPI_KOKESHI_ALIAS" },
    { marca: "Rituaria", envAlias: "YAMPI_RITUARIA_ALIAS" },
  ];

  const out: CredencialMarca[] = [];
  for (const { marca, envAlias } of marcas) {
    const alias = Deno.env.get(envAlias);
    if (!alias) {
      console.warn(`[yampi-sync] ${marca}: ${envAlias} não definido — marca ignorada.`);
      continue;
    }
    out.push({ marca, alias, userToken, userSecretKey });
  }
  return out;
}

// ─── Yampi API ─────────────────────────────────────────────────────────────
//
// Auth: dois headers.
//   User-Token       — token do usuário admin (curto, alfanumérico).
//   User-Secret-Key  — chave `sk_...`. Cuidado: o painel Yampi chama isso de
//                      "chave secreta" mas o header é literalmente "User-Secret-Key"
//                      com o "-Key" no final. `User-Secret` (sem -Key) retorna 401
//                      com "Missing User-Secret-Key header" — descoberto batendo.

interface YampiSku {
  id: number;
  sku: string | null;
  price_sale?: number | null;
  price_discount?: number | null;
  blocked_sale?: boolean;
  balance?: number | null;
}

interface YampiProduto {
  id: number;
  name: string;
  description?: string | null;
  html_description?: string | null;
  simple_description?: string | null;
  slug?: string | null;
  url?: string | null;
  active?: boolean;
  sku?: string | null;
  images?: {
    data: Array<{
      url: string;
      large?: { url: string };
      medium?: { url: string };
      thumbnail?: { url: string };
    }>;
  };
  skus?: { data: YampiSku[] };
  categories?: { data: Array<{ id: number; name: string }> };
}

async function buscarPagina(
  cred: CredencialMarca,
  page: number,
): Promise<{ produtos: YampiProduto[]; totalPaginas: number }> {
  const url = new URL(`https://api.dooki.com.br/v2/${cred.alias}/catalog/products`);
  url.searchParams.set("include", "images,skus,categories");
  url.searchParams.set("limit", "50");
  url.searchParams.set("page", String(page));

  const resp = await fetch(url, {
    headers: {
      "User-Token": cred.userToken,
      "User-Secret-Key": cred.userSecretKey,
      "Accept": "application/json",
    },
  });

  if (!resp.ok) {
    const corpo = await resp.text().catch(() => "");
    throw new Error(`Yampi ${resp.status}: ${corpo.slice(0, 300)}`);
  }

  const json = await resp.json();
  const produtos = (json.data ?? []) as YampiProduto[];
  const totalPaginas = json?.meta?.pagination?.total_pages ?? 1;
  return { produtos, totalPaginas };
}

// ─── Normalização ──────────────────────────────────────────────────────────

interface RegistroCatalogo {
  marca: string;
  yampi_product_id: number;
  yampi_alias: string;
  sku: string | null;
  nome: string;
  descricao: string | null;
  descricao_curta: string | null;
  preco_de: number | null;
  preco_por: number | null;
  em_promocao: boolean;
  categorias: unknown;
  imagens: unknown;
  imagem_principal: string | null;
  url_produto: string | null;
  estoque: number | null;
  disponivel: boolean;
  raw: unknown;
  sincronizado_em: string;
}

function normalizar(
  cred: CredencialMarca,
  p: YampiProduto,
  sincronizadoEm: string,
): RegistroCatalogo {
  // SKU principal = primeiro SKU não bloqueado. Fallback: primeiro da lista, ou
  // o campo `sku` top-level do produto (que a Yampi expõe pra produto "simples"
  // sem variações). Assumimos 1 produto Yampi ≈ 1 registro de catálogo — variações
  // (tamanho, cor) ficam agregadas ao produto pai. Se um dia precisarmos abrir por
  // variação, criar tabela catalogo_produto_variantes; por ora basta pra "gerar
  // oferta com produto X".
  const skus = p.skus?.data ?? [];
  const skuPrincipal =
    skus.find((s) => !s.blocked_sale) ?? skus[0] ?? null;

  const imagensRaw = p.images?.data ?? [];
  const imagens = imagensRaw.map((img, ordem) => ({
    url: img.large?.url ?? img.url,
    thumbnail_url: img.thumbnail?.url ?? img.medium?.url ?? img.url,
    ordem,
    principal: ordem === 0,
  }));

  const precoDe = skuPrincipal?.price_sale ?? null;
  const precoPor =
    skuPrincipal?.price_discount ?? skuPrincipal?.price_sale ?? null;
  const emPromocao =
    precoDe != null && precoPor != null && precoPor < precoDe;

  const estoque = skuPrincipal?.balance ?? null;
  // "Disponível" = ativo no Yampi E não bloqueado E com estoque. Yampi trata cada
  // um desses independentemente (produto pode estar ativo mas com SKU bloqueado);
  // consolidamos aqui pra UI só precisar filtrar `disponivel = true`.
  const disponivel =
    p.active !== false &&
    (skuPrincipal ? !skuPrincipal.blocked_sale : true) &&
    (estoque == null || estoque > 0);

  // URL do produto: Yampi já entrega `url` completo no payload; se não vier,
  // reconstruímos a partir do alias + slug. `preview_url` também existe mas aponta
  // pro rascunho, evitar.
  const urlProduto =
    p.url ?? (p.slug ? `https://${cred.alias}.com.br/${p.slug}` : null);

  return {
    marca: cred.marca,
    yampi_product_id: p.id,
    yampi_alias: cred.alias,
    sku: skuPrincipal?.sku ?? p.sku ?? null,
    nome: p.name,
    descricao: p.html_description ?? p.description ?? null,
    descricao_curta: p.simple_description ?? null,
    preco_de: precoDe,
    preco_por: precoPor,
    em_promocao: emPromocao,
    categorias: (p.categories?.data ?? []).map((c) => ({ id: c.id, nome: c.name })),
    imagens,
    imagem_principal: imagens[0]?.url ?? null,
    url_produto: urlProduto,
    estoque,
    disponivel,
    raw: p,
    sincronizado_em: sincronizadoEm,
  };
}

// ─── Sync por marca ────────────────────────────────────────────────────────

interface ResultadoSync {
  marca: string;
  status: "sucesso" | "falha";
  produtosProcessados: number;
  produtosNovos: number;
  produtosAtualizados: number;
  produtosDesativados: number;
  erro?: string;
  duracaoMs: number;
}

async function sincronizarMarca(
  supabase: ReturnType<typeof createClient>,
  cred: CredencialMarca,
): Promise<ResultadoSync> {
  const iniciadoEm = new Date();
  const iniciadoEmIso = iniciadoEm.toISOString();

  // Cria a run agora, mesmo antes de saber se vai dar certo — importante pra
  // que uma falha na primeira query já apareça no log em vez de sumir.
  const { data: runInserida, error: runErro } = await supabase
    .from("catalogo_sync_runs")
    .insert({ marca: cred.marca, iniciado_em: iniciadoEmIso, status: "em_execucao" })
    .select("id")
    .single();

  if (runErro || !runInserida) {
    return {
      marca: cred.marca,
      status: "falha",
      produtosProcessados: 0,
      produtosNovos: 0,
      produtosAtualizados: 0,
      produtosDesativados: 0,
      erro: `Falha ao criar run: ${runErro?.message ?? "?"}`,
      duracaoMs: Date.now() - iniciadoEm.getTime(),
    };
  }
  const runId = runInserida.id;

  try {
    // Conta o que já existia antes pra separar "novos" de "atualizados" no final.
    const { count: existentesAntes } = await supabase
      .from("catalogo_produtos")
      .select("*", { count: "exact", head: true })
      .eq("marca", cred.marca);

    let processados = 0;
    let pagina = 1;
    let totalPaginas = 1;

    // Yampi retorna total_pages já na primeira resposta. Loop simples é suficiente —
    // não precisamos de paralelismo (Edge Function tem timeout de ~150s e mesmo
    // catálogos grandes cabem em série; a maior loja hoje tem <1000 produtos).
    while (pagina <= totalPaginas) {
      const { produtos, totalPaginas: tp } = await buscarPagina(cred, pagina);
      totalPaginas = tp;

      if (produtos.length > 0) {
        const registros = produtos.map((p) => normalizar(cred, p, iniciadoEmIso));
        const { error } = await supabase
          .from("catalogo_produtos")
          .upsert(registros, { onConflict: "marca,yampi_product_id" });
        if (error) throw new Error(`Upsert página ${pagina}: ${error.message}`);
        processados += produtos.length;
      }

      pagina++;
    }

    // Marca desativados: qualquer produto da marca cujo sincronizado_em ficou pra
    // trás desta run. Faz num UPDATE só, mais barato que iterar.
    const { count: desativados, error: errDesativa } = await supabase
      .from("catalogo_produtos")
      .update({ disponivel: false })
      .eq("marca", cred.marca)
      .lt("sincronizado_em", iniciadoEmIso)
      .eq("disponivel", true)
      .select("*", { count: "exact", head: true });

    if (errDesativa) throw new Error(`Desativação: ${errDesativa.message}`);

    const novos = Math.max(0, processados - (existentesAntes ?? 0));
    const atualizados = processados - novos;

    const duracaoMs = Date.now() - iniciadoEm.getTime();
    await supabase
      .from("catalogo_sync_runs")
      .update({
        terminado_em: new Date().toISOString(),
        status: "sucesso",
        produtos_processados: processados,
        produtos_novos: novos,
        produtos_atualizados: atualizados,
        produtos_desativados: desativados ?? 0,
        duracao_ms: duracaoMs,
      })
      .eq("id", runId);

    return {
      marca: cred.marca,
      status: "sucesso",
      produtosProcessados: processados,
      produtosNovos: novos,
      produtosAtualizados: atualizados,
      produtosDesativados: desativados ?? 0,
      duracaoMs,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const duracaoMs = Date.now() - iniciadoEm.getTime();
    await supabase
      .from("catalogo_sync_runs")
      .update({
        terminado_em: new Date().toISOString(),
        status: "falha",
        erro: msg,
        duracao_ms: duracaoMs,
      })
      .eq("id", runId);

    return {
      marca: cred.marca,
      status: "falha",
      produtosProcessados: 0,
      produtosNovos: 0,
      produtosAtualizados: 0,
      produtosDesativados: 0,
      erro: msg,
      duracaoMs,
    };
  }
}

// ─── Handler HTTP ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const credenciais = lerCredenciais();
  if (credenciais.length === 0) {
    return new Response(
      JSON.stringify({
        ok: false,
        erro:
          "Nenhuma credencial Yampi configurada. Defina YAMPI_USER_TOKEN, " +
          "YAMPI_USER_SECRET_KEY e YAMPI_<MARCA>_ALIAS.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Query param `marca` restringe a uma marca só — útil pra testar sem esperar
  // todas terminarem. Case-insensitive porque URLs.
  const url = new URL(req.url);
  const marcaFiltro = url.searchParams.get("marca");
  const alvo = marcaFiltro
    ? credenciais.filter((c) => c.marca.toLowerCase() === marcaFiltro.toLowerCase())
    : credenciais;

  const resultados: ResultadoSync[] = [];
  for (const cred of alvo) {
    resultados.push(await sincronizarMarca(supabase, cred));
  }

  const houveFalha = resultados.some((r) => r.status === "falha");
  return new Response(
    JSON.stringify({ ok: !houveFalha, resultados }, null, 2),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
