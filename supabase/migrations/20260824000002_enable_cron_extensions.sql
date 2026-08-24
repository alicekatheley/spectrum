-- Habilita as extensões necessárias para agendar a Edge Function do sync Yampi.
--
-- pg_cron: agendador em SQL (roda em UTC no Supabase; converter mentalmente BRT).
-- pg_net:  http_post assíncrono — só ele deixa o cron chamar uma Edge Function.
-- vault:   guarda o service_role_key sem deixá-lo em texto puro no cron.job (senão
--          qualquer um com SELECT em cron.job leria a chave que pode escrever qualquer
--          coisa no banco).
--
-- Todas as extensões abaixo já vêm no Supabase (não requer superuser custom); a
-- migração é IF NOT EXISTS para ser idempotente entre `sb:push`s.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- Nota operacional (para quem vai popular depois):
--
--   SELECT vault.create_secret(
--     'ey...SUA_SERVICE_ROLE_KEY_AQUI...',
--     'service_role_key',
--     'Chave service_role usada pelo cron para chamar a Edge Function sync-catalogo-yampi'
--   );
--
-- Se for rotacionar:
--
--   SELECT vault.update_secret(
--     (SELECT id FROM vault.secrets WHERE name = 'service_role_key'),
--     'ey...NOVA_SERVICE_ROLE_KEY_AQUI...'
--   );
