#!/usr/bin/env bash
# Setup completo do sync Yampi → Supabase catalogo_produtos.
#
# Rode UMA vez. Idempotente: pode rodar de novo sem quebrar (secrets sobrescrevem,
# `supabase link` reaproveita o link existente, `sb:push` aplica só o que falta).
#
# Lê credenciais de .env na raiz do repo (que está no .gitignore). Se .env não
# existir ou faltar variável, avisa e para — nunca usa fallback silencioso.
#
# Uso:
#   bash scripts/setup-yampi-sync.sh
#
# Pré-requisitos:
#   - supabase CLI instalada (`brew install supabase/tap/supabase` ou `npm i -g supabase`)
#   - .env preenchido com SUPABASE_ACCESS_TOKEN, SPECTRUM_SERVICE_ROLE_KEY,
#     YAMPI_USER_TOKEN, YAMPI_USER_SECRET_KEY e YAMPI_<MARCA>_ALIAS x 5.

set -euo pipefail

PROJETO_REF="krxuwejvkdkrjrppcwsw"
FUNC_URL="https://${PROJETO_REF}.supabase.co/functions/v1/sync-catalogo-yampi"

cd "$(dirname "$0")/.."

# ─── Carrega .env ──────────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  echo "ERRO: .env não encontrado. Copie de .env.example e preencha as variáveis Yampi/Supabase."
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env
set +a

# ─── Sanity check ──────────────────────────────────────────────────────────
faltando=()
for var in SUPABASE_ACCESS_TOKEN SPECTRUM_SERVICE_ROLE_KEY \
           YAMPI_USER_TOKEN YAMPI_USER_SECRET_KEY \
           YAMPI_APICE_ALIAS YAMPI_BARBOURS_ALIAS YAMPI_LESCENT_ALIAS \
           YAMPI_KOKESHI_ALIAS YAMPI_RITUARIA_ALIAS; do
  if [[ -z "${!var:-}" ]]; then
    faltando+=("$var")
  fi
done
if [[ ${#faltando[@]} -gt 0 ]]; then
  echo "ERRO: variáveis faltando no .env: ${faltando[*]}"
  echo "  SUPABASE_ACCESS_TOKEN     → https://supabase.com/dashboard/account/tokens"
  echo "  SPECTRUM_SERVICE_ROLE_KEY → Project Settings → API → service_role (secret)"
  exit 1
fi

# ─── 1. Link CLI ao projeto ────────────────────────────────────────────────
echo "→ Linkando CLI ao projeto ${PROJETO_REF}..."
supabase link --project-ref "${PROJETO_REF}"

# ─── 2. Aplicar migrations ─────────────────────────────────────────────────
echo "→ Aplicando migrations (catalogo_produtos, extensões, schedule)..."
supabase db push

# ─── 3. Popular vault com service_role_key ─────────────────────────────────
echo "→ Populando vault.secrets.service_role_key..."
supabase db execute --stdin <<SQL
DO \$\$
BEGIN
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'service_role_key') THEN
    PERFORM vault.update_secret(
      (SELECT id FROM vault.secrets WHERE name = 'service_role_key'),
      '${SPECTRUM_SERVICE_ROLE_KEY}'
    );
    RAISE NOTICE 'service_role_key ATUALIZADO no vault';
  ELSE
    PERFORM vault.create_secret(
      '${SPECTRUM_SERVICE_ROLE_KEY}',
      'service_role_key',
      'Usada pelo cron para chamar sync-catalogo-yampi'
    );
    RAISE NOTICE 'service_role_key CRIADO no vault';
  END IF;
END\$\$;
SQL

# ─── 4. Re-rodar a migration do schedule ───────────────────────────────────
# A migration schedule NÃO agenda se o vault estiver vazio (design intencional).
# Como acabamos de popular, precisamos re-executar o bloco de agendamento.
echo "→ Agendando cron (04h BRT / 07h UTC)..."
supabase db execute --file supabase/migrations/20260824000003_schedule_yampi_sync.sql

# ─── 5. Secrets da Edge Function ───────────────────────────────────────────
echo "→ Definindo secrets da Edge Function..."
supabase secrets set \
  YAMPI_USER_TOKEN="${YAMPI_USER_TOKEN}" \
  YAMPI_USER_SECRET_KEY="${YAMPI_USER_SECRET_KEY}" \
  YAMPI_APICE_ALIAS="${YAMPI_APICE_ALIAS}" \
  YAMPI_BARBOURS_ALIAS="${YAMPI_BARBOURS_ALIAS}" \
  YAMPI_LESCENT_ALIAS="${YAMPI_LESCENT_ALIAS}" \
  YAMPI_KOKESHI_ALIAS="${YAMPI_KOKESHI_ALIAS}" \
  YAMPI_RITUARIA_ALIAS="${YAMPI_RITUARIA_ALIAS}"

# ─── 6. Deploy da Edge Function ────────────────────────────────────────────
echo "→ Deployando sync-catalogo-yampi..."
supabase functions deploy sync-catalogo-yampi --project-ref "${PROJETO_REF}"

# ─── 7. Sync inicial (manual) — teste antes do primeiro cron ───────────────
echo "→ Rodando sync inicial das 5 marcas (pode levar ~1min)..."
curl -sS -X POST "${FUNC_URL}" \
  -H "Authorization: Bearer ${SPECTRUM_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  --max-time 300 \
  | python3 -m json.tool

echo ""
echo "✓ Setup concluído."
echo ""
echo "Próxima execução automática: amanhã às 04h BRT."
echo "Verificar no SQL Editor:"
echo "  SELECT marca, iniciado_em, status, produtos_processados, produtos_desativados, erro"
echo "  FROM catalogo_sync_runs ORDER BY iniciado_em DESC LIMIT 10;"
