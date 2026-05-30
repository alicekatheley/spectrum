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

### Key files

| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Client init (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`) |
| `src/lib/pautas-service.ts` | `getPautas` / `upsertPautas` / `clearPautas` — maps snake_case DB ↔ camelCase TS |
| `supabase/migrations/` | Versioned DDL migrations (apply with `npm run sb:push`) |
| `supabase/seeds/` | Seed data for `disparos_historicos` |

### Column mapping (`pautas_geradas`)

`data_criacao` (DB) ↔ `dataCriacao` (TS)  
`receita_media` (DB) ↔ `receitaMedia` (TS)  
`contextos_recomendados` (DB) ↔ `contextosRecomendados` (TS)

Supabase migration is **complete** — both tables exist and are active.

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
