# Arquitetura — Spectrum CRM Email Generator

## Visão Geral

Aplicação full-stack em processo único: Express serve tanto a API quanto o React SPA. Em dev, o Vite roda como middleware dentro do Express. Em produção, Express serve o `dist/` estático.

```
Browser
  └─ React SPA (src/)
       ├─ App.tsx — estado global, roteamento por tab
       ├─ src/lib/supabase.ts — cliente Supabase (frontend)
       └─ src/lib/pautas-service.ts — CRUD de pautas_geradas

Express (server.ts)
  ├─ GET  /api/historico          → retorna databaseDisparos (Supabase ou fallback hardcoded)
  ├─ POST /api/generate-pauta     → validação determinística → Gemini → JSON estruturado
  ├─ POST /api/generate-variation → variação de copy via Gemini
  └─ /*                           → Vite middleware (dev) | dist/ estático (prod)

Supabase
  ├─ disparos_historicos          → lido pelo server.ts no startup
  └─ pautas_geradas               → lido/escrito diretamente pelo frontend
```

## Fluxo de Dados

### Geração de Pauta (Modo A ou B)
1. Usuário preenche formulário → `App.tsx` faz POST `/api/generate-pauta`
2. `server.ts` roda validações determinísticas (assunto, emojis, palavras proibidas)
3. `server.ts` injeta `databaseDisparos` filtrado por marca no prompt do Gemini
4. Gemini retorna JSON estruturado com schema enforced
5. `server.ts` sanitiza e adiciona campos obrigatórios (`id`, `marca`, `status`, `dataCriacao`)
6. Resposta volta ao `App.tsx` → `saveHistory()` → Supabase (upsert) + localStorage (fallback)

### Carregamento Inicial
1. `App.tsx` monta → `getPautas()` consulta `pautas_geradas` no Supabase
2. Se Supabase retornar dados: usa remote
3. Se vazio: carrega localStorage e dispara migração silenciosa para Supabase
4. `server.ts` no startup: `loadDisparosFromSupabase()` substitui array hardcoded

## Stack Tecnológico

| Camada | Tecnologia |
|---|---|
| Frontend | React 19, TypeScript 5.8, Tailwind CSS 4 |
| Backend | Express 4, Node.js, TypeScript (tsx em dev, esbuild CJS em prod) |
| IA | Google Gemini (`gemini-3.5-flash`) via `@google/genai` |
| Banco | Supabase (PostgreSQL) via `@supabase/supabase-js` |
| Build | Vite 6 (SPA) + esbuild (server bundle) |

## Persistência

| Dado | Supabase | localStorage |
|---|---|---|
| Campanhas de referência | `disparos_historicos` (read-only pelo server) | — |
| Pautas geradas | `pautas_geradas` (upsert pelo frontend) | Fallback imediato |

## Marcas e Playbooks

Duas marcas com regras rígidas injetadas no system prompt do Gemini:

- **Ápice**: Cuidado capilar feminino — Verde Floresta `#688D65`, assunto 27-47 chars, mecânicas de manipulação
- **Barbours**: Luxo acessível — Ruby Red `#BF0F26`, assunto 16-39 chars, mecânicas de abrir

Ver `docs/supabase.md` para schema completo das tabelas.
