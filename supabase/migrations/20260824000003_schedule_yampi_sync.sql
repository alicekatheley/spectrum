-- Agenda a Edge Function `sync-catalogo-yampi` para rodar todo dia às 04h BRT.
--
-- pg_cron opera em UTC (o Supabase não expõe timezone do agendador). BRT = UTC-3,
-- então 04:00 BRT ≡ 07:00 UTC. Um horário que NÃO é meia-noite intencionalmente:
-- na virada do dia o Yampi ainda está fechando o dia anterior e a chance de pegar
-- estado inconsistente é maior; às 04h isso já assentou.
--
-- Autenticação: o cron precisa apresentar service_role para bypassar RLS na
-- escrita. A chave vem do vault (populada manualmente uma vez — ver 20260824000002).
-- Se o vault não estiver populado, o cron roda mas a Edge Function recebe 401.

DO $$
DECLARE
  project_url text;
  service_key text;
BEGIN
  -- URL do projeto. Fica hardcoded aqui porque `sb:push` não expõe variável de
  -- ambiente do CLI. Se um dia rodarmos em outro projeto (staging), duplicar esta
  -- migração no branch — não é caso comum o bastante pra parametrizar.
  project_url := 'https://krxuwejvkdkrjrppcwsw.supabase.co/functions/v1/sync-catalogo-yampi';

  -- Se o vault já tem a chave, agenda. Se não, avisa e não agenda (senão o cron
  -- fica falhando toda noite sem ninguém perceber, e um erro silencioso é o
  -- pior tipo).
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF service_key IS NULL THEN
    RAISE NOTICE 'vault.secrets não tem "service_role_key" — cron não foi agendado. '
                 'Popule com vault.create_secret() e rode sb:push de novo.';
    RETURN;
  END IF;

  -- Remove agendamento anterior (permite re-rodar a migração sem duplicar).
  PERFORM cron.unschedule('sync-catalogo-yampi-diario')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-catalogo-yampi-diario');

  PERFORM cron.schedule(
    'sync-catalogo-yampi-diario',
    '0 7 * * *',  -- 07h UTC = 04h BRT
    format(
      $cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'service_role_key' LIMIT 1
          )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 150000
      );
      $cron$,
      project_url
    )
  );
END $$;
