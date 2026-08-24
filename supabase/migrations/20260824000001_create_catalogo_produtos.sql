-- Catálogo de produtos por marca, sincronizado diariamente do Yampi.
--
-- Existe para dar substrato REAL às ofertas geradas: no lugar de o modelo inventar
-- "Necessaire Bege R$ 79", ele escolhe a partir de um conjunto vivo, com preço e
-- disponibilidade daquele dia. Sem catálogo real, a geração volta a sofrer do mesmo
-- problema que o BigQuery corrigiu no calendário: um plano bonito com números
-- fabricados é pior que tela vazia, porque é indistinguível de um plano verdadeiro.
--
-- A sincronização é feita por uma Edge Function (`sync-catalogo-yampi`) chamada por
-- pg_cron. Nada é escrito por anon — só service_role via Edge Function bypassa RLS.

CREATE TABLE IF NOT EXISTS catalogo_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Case consistente com o resto do app (pautas_geradas usa 'Apice'/'Barbours'; aqui
  -- estendemos para as 5 marcas com catálogo Yampi). Nomes canonicalizados sem acento
  -- para evitar 'Rituária' vs 'Rituaria' fora do controle — a UI mostra o nome bonito
  -- via COMPANY_DISPLAY_NAMES; o banco guarda o slug ASCII.
  marca text NOT NULL CHECK (marca IN ('Apice', 'Barbours', 'Lescent', 'Kokeshi', 'Rituaria')),

  -- IDs vindos do Yampi. `yampi_product_id` é a chave estável do produto; `sku` é do
  -- SKU principal (produto pode ter variações — guardamos o SKU "de exibição").
  yampi_product_id bigint NOT NULL,
  yampi_alias text NOT NULL,
  sku text,

  nome text NOT NULL,
  descricao text,
  descricao_curta text,

  -- Preços em BRL. `preco_de` é o "de", `preco_por` é o "por" (pode ser igual quando
  -- não há promoção). `em_promocao` sai calculado no upsert para simplificar filtro.
  preco_de numeric(10,2),
  preco_por numeric(10,2),
  em_promocao boolean NOT NULL DEFAULT false,

  categorias jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Array de {url, thumbnail_url, principal, ordem}. Guardamos só URLs — Yampi já
  -- hospeda em CDN e re-hospedar aqui não paga o custo (ver .claude/decisão em
  -- 2026-08-24: se a URL cair, o produto também caiu no Yampi, então não perdemos
  -- nada além do que já está perdido).
  imagens jsonb NOT NULL DEFAULT '[]'::jsonb,
  imagem_principal text,

  url_produto text,
  estoque integer,

  -- `disponivel` é a fusão de "está ativo no Yampi" + "tem estoque" + "não foi
  -- removido no último sync". A UI que gera ofertas SEMPRE filtra por disponivel=true.
  -- Quando um produto some do sync, marcamos false em vez de deletar — preserva
  -- referência histórica de pautas antigas.
  disponivel boolean NOT NULL DEFAULT true,

  -- Objeto Yampi cru. Fica aqui porque o custo é baixo (tabela pequena) e nos poupa
  -- re-sincronizar quando descobrirmos um campo novo que passamos a querer.
  raw jsonb,

  -- Marcador do último sync que viu esse produto. `UPDATE ... WHERE sincronizado_em <
  -- last_run_started_at` no fim do sync é o que dispara disponivel=false.
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (marca, yampi_product_id)
);

CREATE INDEX IF NOT EXISTS idx_catalogo_produtos_marca_disponivel
  ON catalogo_produtos (marca, disponivel);
CREATE INDEX IF NOT EXISTS idx_catalogo_produtos_categorias
  ON catalogo_produtos USING gin (categorias);
CREATE INDEX IF NOT EXISTS idx_catalogo_produtos_nome_trgm
  ON catalogo_produtos USING gin (nome gin_trgm_ops);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TRIGGER catalogo_produtos_updated_at
  BEFORE UPDATE ON catalogo_produtos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE catalogo_produtos ENABLE ROW LEVEL SECURITY;

-- Leitura pública (o Express server usa anon key). Escrita bloqueada — só service_role
-- da Edge Function passa, o que é exatamente o que queremos.
DROP POLICY IF EXISTS "read_catalogo_produtos" ON catalogo_produtos;
CREATE POLICY "read_catalogo_produtos" ON catalogo_produtos
  FOR SELECT TO public USING (true);

-- ─── Log de sincronizações ──────────────────────────────────────────────────
-- Existe para o cron ser DEBUGÁVEL sem depender de logs efêmeros da Edge Function.
-- Quando alguém pergunta "por que a UI está mostrando produto antigo?", este é o
-- primeiro lugar a olhar: `SELECT * FROM catalogo_sync_runs ORDER BY iniciado_em
-- DESC LIMIT 10` responde na hora.

CREATE TABLE IF NOT EXISTS catalogo_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marca text NOT NULL,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  terminado_em timestamptz,
  status text NOT NULL DEFAULT 'em_execucao'
    CHECK (status IN ('em_execucao', 'sucesso', 'falha')),
  produtos_processados integer NOT NULL DEFAULT 0,
  produtos_novos integer NOT NULL DEFAULT 0,
  produtos_atualizados integer NOT NULL DEFAULT 0,
  produtos_desativados integer NOT NULL DEFAULT 0,
  erro text,
  duracao_ms integer
);

CREATE INDEX IF NOT EXISTS idx_catalogo_sync_runs_marca_iniciado
  ON catalogo_sync_runs (marca, iniciado_em DESC);

ALTER TABLE catalogo_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_catalogo_sync_runs" ON catalogo_sync_runs;
CREATE POLICY "read_catalogo_sync_runs" ON catalogo_sync_runs
  FOR SELECT TO public USING (true);
