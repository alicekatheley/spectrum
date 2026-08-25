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

Environment: copy `.env.example` to `.env` e defina `AI_PROXY_KEY`. **Não existe
`GEMINI_API_KEY`** — toda chamada de IA passa pelo proxy do Grupo (ver abaixo).

```bash
npx tsx scripts/verificar-worker-calendario.ts        # rotas do Worker × BigQuery real
npx tsx scripts/verificar-worker-calendario.ts --ia   # idem + chamada ao AI proxy
npm run verify:calendario                             # invariantes do gerador
```

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

### ⚠️ Existem DOIS servidores. Toda rota nova precisa entrar nos dois.

| | `server/index.ts` (via `server.ts`) | `worker.ts` |
|---|---|---|
| Runtime | Node + Express | Workers (GoDeploy) |
| Quando roda | `npm run dev`, local | **produção** |
| Imports | livre (`@google-cloud/bigquery`, `fs`, …) | **nenhum** — arquivo autocontido, só globais de Worker (`fetch`, `crypto.subtle`, `btoa`) |

Este é o erro mais caro do repositório e ele já aconteceu: as rotas de calendário
(`/api/calendario/contexto` e `/api/calendario/explicar`) foram escritas só no Express,
passaram em todo teste local, e em produção a aba caiu no catálogo sintético sem
nenhum erro visível. Testar em `localhost:3000` **não testa o servidor de produção**.

Consequência prática: bibliotecas Node não podem ser usadas no `worker.ts`. O acesso
ao BigQuery lá é feito na mão — JWT RS256 assinado com WebCrypto + REST API. Rode
`npx tsx scripts/verificar-worker-calendario.ts` para exercitar as rotas do Worker
contra o BigQuery real (com `--ia`, também chama o AI proxy).

**Armadilha da REST API do BigQuery:** ela devolve *todo* valor como string,
inclusive `BOOLEAN` e `INTEGER` — e `Boolean("false") === true`. `TIMESTAMP` vem
como epoch em notação científica. As coerções ficam em `bqNum`/`bqBool`/`bqTimestamp`.

```
Browser → Express (server.ts, dev) ─┐
                                    ├─ /api/historico          → databaseDisparos (Supabase no boot)
Browser → Worker (worker.ts, prod) ─┘  ├─ /api/generate-pauta     → validação determinística → AI proxy
                                       ├─ /api/generate-variation → variante de copy via AI proxy
                                       ├─ /api/calendario/contexto → catálogo + índices do BigQuery
                                       ├─ /api/calendario/explicar → leitura assistida do plano
                                       └─ /*                      → Vite middleware (dev) / assets (prod)
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
- **IA: AI proxy do Grupo, não Gemini.** `https://ai-proxy.gogroupbr.com/v1`, OpenAI-compatível
  (`/chat/completions`, `messages[]`). Modelos: `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`,
  `gpt-5.5` (padrão), `gpt-5.4`, `gpt-5.4-mini`. **Nenhum modelo Google.** Cliente em
  `server/ai-proxy.ts` (Express) e `callGemini()` em `worker.ts` (produção).
  - Apontar o SDK `@google/genai` para essa URL **não funciona**: os protocolos são
    diferentes (`contents[].parts[]` vs `messages[]`) e o sintoma é um 400
    "API key not valid" que culpa a chave quando o problema é o formato.
  - `response_format: {type:"json_schema"}` é **aceito e silenciosamente ignorado**
    (HTTP 200 devolvendo markdown). Só `{type:"json_object"}` funciona — e ele garante
    sintaxe JSON, não conformidade com schema. Por isso `chatJson` exige um type guard.
- Node.js is at `C:\Program Files\nodejs` — not in default PATH, always export before running npm.
