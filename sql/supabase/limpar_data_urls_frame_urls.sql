-- Remove data URLs (base64) gravados em pautas_geradas.frame_urls.
-- Eles inflaram o histórico a ~18 MB e, somados a upserts do histórico inteiro, derrubaram o
-- Supabase em 27/10/2026. O front corrigido não grava mais base64; isto limpa o que já está lá.
-- Rodar no SQL Editor do Supabase depois que o projeto voltar.

-- 1. Diagnóstico: quanto pesa e quantas linhas têm base64.
SELECT
  count(*)                                              AS linhas,
  count(*) FILTER (WHERE frame_urls::text LIKE '%data:%') AS com_data_url,
  pg_size_pretty(sum(pg_column_size(frame_urls)))       AS peso_frame_urls,
  pg_size_pretty(pg_total_relation_size('pautas_geradas')) AS peso_tabela
FROM pautas_geradas;

-- 2. Limpeza: mantém só as entradas com URL; vira NULL se não sobrar nenhuma.
UPDATE pautas_geradas p
SET frame_urls = (
  SELECT nullif(coalesce(jsonb_object_agg(k, v), '{}'::jsonb), '{}'::jsonb)
  FROM jsonb_each_text(p.frame_urls::jsonb) AS e(k, v)
  WHERE v NOT LIKE 'data:%'
)
WHERE p.frame_urls::text LIKE '%data:%';

-- 3. Devolve o espaço do TOAST.
VACUUM (ANALYZE) pautas_geradas;
