# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

**When the user asks to "rodar", "subir", "iniciar" or "run" the app — run it immediately without asking.**

Node.js is at `C:\Program Files\nodejs`. Always prefix npm commands with the PATH export:

```bash
export PATH="/c/Program Files/nodejs:$PATH"
cd "/c/Users/Notebook/spectrum"
npm run dev
```

The server starts at **http://localhost:3000**. On successful boot it logs:
```
[Supabase] 17 disparos históricos carregados.
[Express Server] Iniciado em http://localhost:3000
```

## Commands

```bash
# App
npm run dev       # Dev server (Express + Vite middleware) on port 3000
npm run build     # Vite SPA build + esbuild bundles server.ts → dist/server.cjs
npm run start     # Run production bundle
npm run lint      # TypeScript type-check only (no test runner configured)

# Supabase CLI
npm run sb:link   # Link local CLI to remote project (needs Supabase access token)
npm run sb:push   # Apply local migrations to remote DB
npm run sb:pull   # Pull remote schema to local
npm run sb:types  # Generate src/lib/database.types.ts from live schema
```

Environment: copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`.

## Supabase

**Project:** `CRM Aplicativo ok` · ID: `krxuwejvkdkrjrppcwsw` · Region: us-west-1  
**URL:** `https://krxuwejvkdkrjrppcwsw.supabase.co`  
**Credentials:** stored in `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### Tables

| Table | Rows | Purpose |
|-------|------|---------|
| `disparos_historicos` | 17 | Reference campaigns — loaded at server boot, used as few-shot examples in Gemini prompt |
| `pautas_geradas` | — | Generated campaign history — replaces `localStorage` key `crm_pautas_history` |
| `catalogo_produtos` | — | Catálogo Yampi sincronizado por marca. Fonte para geração de ofertas com produto real. |
| `catalogo_sync_runs` | — | Log de cada execução do sync Yampi (debug do cron sem depender de logs de Edge Function). |

### Key files

| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Client init (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`) |
| `src/lib/pautas-service.ts` | `getPautas` / `upsertPautas` / `clearPautas` — maps snake_case DB ↔ camelCase TS |
| `src/lib/catalogo-service.ts` | `listarProdutos` / `getUltimaSync` — leitura do catálogo Yampi |
| `supabase/migrations/` | Versioned DDL migrations (apply with `npm run sb:push`) |
| `supabase/functions/sync-catalogo-yampi/` | Edge Function (Deno) que sincroniza o catálogo Yampi diariamente |
| `supabase/seeds/` | Seed data for `disparos_historicos` |

### Column mapping (`pautas_geradas`)

`data_criacao` (DB) ↔ `dataCriacao` (TS)  
`receita_media` (DB) ↔ `receitaMedia` (TS)  
`contextos_recomendados` (DB) ↔ `contextosRecomendados` (TS)

Supabase migration is **complete** — both tables exist and are active.

## Sync Yampi → catálogo (cron diário)

O catálogo (`catalogo_produtos`) é sincronizado todo dia às **04h BRT (07h UTC)** pela
Edge Function `sync-catalogo-yampi`, agendada via `pg_cron` + `pg_net`. Setup em três passos:

### 1. Popular o vault com a service_role_key

Necessário só uma vez (e a cada rotação de chave). No SQL Editor do Supabase:

```sql
SELECT vault.create_secret(
  'ey...SUA_SERVICE_ROLE_KEY...',
  'service_role_key',
  'Usada pelo cron para chamar sync-catalogo-yampi'
);
```

A chave está em Project Settings → API → `service_role` (a "secret", não a `anon`).

### 2. Definir secrets Yampi

O Grupo Beauté tem uma única conta Yampi que administra 5 lojas — logo, um par
(`YAMPI_USER_TOKEN`, `YAMPI_USER_SECRET_KEY`) compartilhado + um alias por marca:

```bash
supabase secrets set \
  YAMPI_USER_TOKEN=... \
  YAMPI_USER_SECRET_KEY=sk_... \
  YAMPI_APICE_ALIAS=apice-cosmeticos \
  YAMPI_BARBOURS_ALIAS=group-barbours-beauty \
  YAMPI_LESCENT_ALIAS=lescent-varejo-sp2 \
  YAMPI_KOKESHI_ALIAS=kokeshi \
  YAMPI_RITUARIA_ALIAS=rituaria
```

Marca sem alias é **pulada** no sync (log warn, outras marcas rodam).
Se `YAMPI_USER_TOKEN` ou `YAMPI_USER_SECRET_KEY` faltar, TODAS são puladas.

**Cuidado com o header:** o Yampi usa `User-Secret-Key` (com "-Key"), não `User-Secret`.
A Edge Function já trata isso — se aparecer 401 "Missing User-Secret-Key header" é
sinal de que alguém quebrou o header name.

### 3. Deploy da função e das migrations

```bash
npm run sb:push                                  # aplica migrations (tabela, extensões, schedule)
supabase functions deploy sync-catalogo-yampi    # sobe o código Deno
```

### Rodar sync manualmente

```bash
# Ambas as marcas
curl -X POST "https://krxuwejvkdkrjrppcwsw.supabase.co/functions/v1/sync-catalogo-yampi" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

# Só uma marca (útil pra debugar)
curl -X POST "https://krxuwejvkdkrjrppcwsw.supabase.co/functions/v1/sync-catalogo-yampi?marca=Apice" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

### Debug do cron

```sql
-- Últimas execuções por marca
SELECT marca, iniciado_em, status, produtos_processados, produtos_desativados, erro
FROM catalogo_sync_runs
ORDER BY iniciado_em DESC LIMIT 20;

-- Confirma que o cron está agendado
SELECT * FROM cron.job WHERE jobname = 'sync-catalogo-yampi-diario';

-- Histórico de execuções do pg_cron
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-catalogo-yampi-diario')
ORDER BY start_time DESC LIMIT 10;
```

## Architecture

**Single-process full-stack app** — `server.ts` (Express) runs both the API and serves the React SPA. In dev, Vite is mounted as middleware inside Express; in prod, Express serves the static `dist/` folder built by Vite.

```
Browser → Express (server.ts)
            ├─ /api/historico          → returns databaseDisparos (loaded from Supabase on boot)
            ├─ /api/generate-pauta     → deterministic validation → Gemini → structured JSON
            ├─ /api/generate-variation → lightweight copy variant via Gemini
            └─ /*                      → Vite middleware (dev) or static dist/ (prod)
```

**React SPA (`src/`)** — All routing is tab-based state in `App.tsx` (no router library). `App.tsx` owns all global state: `history` (persisted to Supabase + `localStorage` fallback), active brand, active mode, and modal state. Components are pure presentational/form leaves that call callbacks up to `App.tsx`.

## Domain Model

All types live in `src/types.ts`. The central type is `PautaGerada`:

```
PautaGerada
  ├─ copy: PautaCopy          # assunto, preHeader, headlineBanner, subHeadlineBanner, ctaBotao
  ├─ visual: PautaVisual      # palette (HEX[]), illustration style, 3 GIF frame descriptions
  ├─ operacional: PautaOperacional  # mecanica, recompensa, diaRecomendado, horarioRecomendado
  ├─ previsao: PerformancePrevisao  # aberturaEsperada, ctorEsperado, receitaEsperada, casesReferencia
  └─ riscos: RiscoAlerta[]    # campo, nivel (alto/medio/baixo), mensagem, alternativaSugerida
```

## Two Brands, Two Playbooks

The server embeds strict per-brand playbook rules that are injected verbatim into the Gemini system prompt:

| | Ápice | Barbours |
|---|---|---|
| Niche | Women's hair care | Accessible luxury beauty |
| Tone | Warm, intimate, 1st person | Direct, elegant, push-notification |
| Primary color | Forest Green `#688D65` | Ruby Red `#BF0F26` |
| Subject length | 27–47 chars | 16–39 chars |
| Mechanics focus | Manipulation (pull, cut, tear, tic-tac-toe) | Opening (present, box, letter, envelope) |
| Best send time | Wed 8:30–9:30 AM | Wed or Sun 9–11 AM |

Prohibited subject terms for both brands: `%`, `OFF`, `GRÁTIS`, `R$`, ALL CAPS, >2 emojis.

## Generation Modes

- **Modo A (Free Discovery):** User sets brand, quantity (1–5), context, segment, date, reward type, and mechanics to avoid. Gemini generates complete proposals from scratch.
- **Modo B (Assisted Co-Pilot):** User fills 5 boxes (subject, subtitle, CTA, mechanic, reward). Gemini validates against playbook rules and completes the brief. Risk alerts are generated deterministically *before* the Gemini call (in `server.ts`) and merged with AI-generated alerts.

## Key Constraints

- **No test framework** is configured — `npm run lint` only runs `tsc --noEmit`.
- **ES Modules** throughout (`"type": "module"` in package.json). Server build uses `--format=cjs` via esbuild to produce a CJS bundle for Node.js compatibility.
- **`DISABLE_HMR=true`** disables Vite file watching and HMR — set by AI Studio during agent edits to prevent flickering.
- The `@` path alias resolves to the repo root (`.`), not `src/`.
- Gemini model in use: `gemini-2.5-flash`. Response parsing uses `@google/genai` structured output with a JSON schema enforced via `responseSchema`.
- Node.js is at `C:\Program Files\nodejs` — not in default PATH, always export before running npm.
