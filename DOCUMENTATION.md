# Spectrum — Documentação Técnica

> Gerador de pautas de CRM (email marketing) para as marcas **Ápice** (cuidado capilar feminino) e **Barbours** (beleza acessível de luxo). App full-stack single-process: servidor Express serve API + SPA React.
>
> Este documento existe para dar uma visão externa de como o Spectrum está construído hoje — modelo de dados, serviços implementados e integrações externas — como ponto de partida para unificar padrões entre aplicações do time.

---

## 1. Visão geral da arquitetura

```
Browser (React SPA, src/)
     │
     ▼
Express (server.ts → server/index.ts)
     ├─ /api/historico            GET   → disparos históricos carregados no boot
     ├─ /api/mecanicas            GET   → catálogo de mecânicas (fixas + geradas por IA)
     ├─ /api/generate-pauta       POST  → geração principal de pauta (Gemini)
     ├─ /api/analyze-frame        POST  → extrai metadados visuais de um frame (Gemini)
     ├─ /api/generate-image       POST  → gera 1 frame de imagem (PiApp)
     ├─ /api/generate-gif         POST  → gera 3 frames em paralelo (PiApp)
     ├─ /api/parse-estilo-visual  POST  → parseia estilo de texto livre (Claude/Anthropic)
     ├─ /api/generate-variation   POST  → variação de copy de uma pauta existente (Gemini)
     ├─ /api/save-frame           POST  → salva um frame no Supabase Storage
     ├─ /api/approve-pauta        POST  → grava pauta aprovada em crm_ai.ia_outputs
     └─ /*                        → Vite middleware (dev) ou dist/ estático (prod)
```

- **Entry point:** [server.ts](server.ts) apenas carrega `.env` e chama `startServer()` de [server/index.ts](server/index.ts).
- **Framework do servidor:** Express (não Hono, apesar de `hono` estar como dependência no `package.json` — não está em uso em `server/`).
- **Módulos do servidor** (`server/`):
  | Arquivo | Responsabilidade |
  |---|---|
  | [server/index.ts](server/index.ts) | Rotas HTTP, orquestração, boot do servidor |
  | [server/supabase.ts](server/supabase.ts) | Clientes Supabase, cache em memória, loaders de contexto |
  | [server/gemini.ts](server/gemini.ts) | Prompt engineering + chamadas ao Gemini |
  | [server/piapp.ts](server/piapp.ts) | Integração com PiApp (geração de imagem via MCP) |
  | [server/validators.ts](server/validators.ts) | Validação/sanitização determinística do playbook |
  | [server/data.ts](server/data.ts) | Constantes: DNA das marcas, fallback de histórico, variantes de composição/iluminação |
  | [server/types.ts](server/types.ts) | Tipos de contexto (`MarcaDnaContext`, `EmailHitContext`) |
- **Frontend:** React 19 + Vite, sem router (abas controladas por estado em `App.tsx`), Tailwind 4.
- **Persistência:** Supabase (Postgres + Storage), com fallback para dados hardcoded em memória quando as credenciais não estão presentes.

⚠️ **CLAUDE.md está desatualizado** em relação ao código atual: descreve `server.ts` como monolito Express direto e não menciona o schema `crm_ai`, o catálogo de mecânicas, nem a integração PiApp/Anthropic. Este documento reflete o estado real do código lido em `server/*.ts`, `src/lib/*.ts` e `supabase/migrations/*.sql`.

---

## 2. Modelo de banco de dados

**Projeto Supabase:** `krxuwejvkdkrjrppcwsw` (região us-west-1) — schema público `public` + schema separado `crm_ai`.

### 2.1 Schema `public` (versionado em `supabase/migrations/`)

#### `disparos_historicos`
Histórico de referência (few-shot) usado no prompt do Gemini. Carregado inteiro na memória do servidor no boot.

| Coluna | Tipo | Constraint |
|---|---|---|
| `id` | `text` | PK |
| `marca` | `text` | `NOT NULL`, `CHECK IN ('Apice','Barbours')` |
| `mecanica` | `text` | `NOT NULL` |
| `disparos` | `integer` | `NOT NULL DEFAULT 0` |
| `receita_media` | `numeric` | `NOT NULL DEFAULT 0` |
| `performance` | `text` | `NOT NULL` |
| `contextos_recomendados` | `text[]` | `NOT NULL DEFAULT '{}'` |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` |

RLS: habilitado, policy `allow_read_disparos` — leitura pública (`USING (true)`), sem policy de escrita (seed via `supabase/seeds/disparos_historicos.sql`).

#### `pautas_geradas`
Histórico de pautas geradas pela IA (substitui o antigo `localStorage`).

| Coluna | Tipo | Constraint | Migration |
|---|---|---|---|
| `id` | `text` | PK | 20260522000002 |
| `marca` | `text` | `NOT NULL CHECK IN ('Apice','Barbours')` | 20260522000002 |
| `modo` | `text` | `NOT NULL CHECK IN ('A','B')` | 20260522000002 |
| `status` | `text` | `NOT NULL DEFAULT 'rascunho' CHECK IN ('rascunho','aprovado','descartado')` | 20260522000002 |
| `data_criacao` | `timestamptz` | `NOT NULL` | 20260522000002 |
| `copy` | `jsonb` | `NOT NULL DEFAULT '{}'` | 20260522000002 |
| `visual` | `jsonb` | `NOT NULL DEFAULT '{}'` | 20260522000002 |
| `operacional` | `jsonb` | `NOT NULL DEFAULT '{}'` | 20260522000002 |
| `previsao` | `jsonb` | `NOT NULL DEFAULT '{}'` | 20260522000002 |
| `riscos` | `jsonb` | `NOT NULL DEFAULT '[]'` | 20260522000002 |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | 20260522000002 |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()`, atualizado via trigger `pautas_geradas_updated_at` | 20260522000002 |
| `tipo_geracao` | `text` | `NOT NULL DEFAULT 'texto_imagem' CHECK IN ('texto','imagem','texto_imagem')` | 20260528000001 |
| `input_original` | `jsonb` | nullable | 20260610000001 |

RLS: habilitado, policy `allow_all_pautas` — leitura/escrita liberadas (`USING (true) WITH CHECK (true)`), ou seja, sem controle de acesso por usuário hoje.

Mapeamento snake_case (DB) ↔ camelCase (TS) fica em [src/lib/pautas-service.ts](src/lib/pautas-service.ts):
`data_criacao↔dataCriacao`, `tipo_geracao↔tipoGeracao`, `input_original↔inputOriginal`.

#### `mecanicas_catalog`
Catálogo de mecânicas de campanha (fixas + auto-registradas pela IA quando ela inventa uma mecânica nova).

| Coluna | Tipo | Constraint |
|---|---|---|
| `id` | `SERIAL` | PK |
| `nome` | `TEXT` | `UNIQUE NOT NULL` |
| `categoria` | `TEXT` | `NOT NULL DEFAULT 'manipulacao'` |
| `criado_por` | `TEXT` | `NOT NULL DEFAULT 'sistema'` (`'sistema'` ou `'ia_auto'`) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` |

RLS: habilitado, policies `allow_read_mecanicas` (SELECT público) e `allow_insert_mecanicas` (INSERT público). Seed com 10 mecânicas clássicas (`Abra o presente`, `Puxe o Adesivo`, `Jogo da Velha`, etc.).

#### Storage bucket `campaign-images`
Bucket público, 10 MB por arquivo, mime types `image/png|jpeg|webp|gif`. Policies: leitura pública, insert/update liberados para a anon key (usada pelo próprio servidor Express para subir os frames gerados). Caminho de armazenamento: `{marca_lowercase}/{pautaId}/{frameName}.png`.

### 2.2 Schema `crm_ai` (⚠️ NÃO versionado neste repositório)

O servidor consome um segundo schema, `crm_ai`, exclusivamente via **RPC functions** (`SECURITY DEFINER` no schema `public`, contornando a restrição padrão do PostgREST a schemas não expostos). Não há migration em `supabase/migrations/` para esse schema — ele foi criado fora deste repo (provavelmente diretamente no painel/outra fonte), então **precisa ser reverse-engenheirado no Supabase antes de qualquer unificação**.

RPCs consumidas (ver [server/supabase.ts](server/supabase.ts:60)):
- `crm_ai_get_marcas()` → linhas com `nome`, `marca_id`, `tom_de_voz`, `paleta_cores` (jsonb com chaves de cor incluindo `primaria`/`secundaria`)
- `crm_ai_get_lists()` → `{ mecanicas: [{id, valor}], estilos: [{id, valor}] }`
- `crm_ai_get_top_emails({ limit_n })` → linhas com `marca_id`, `mecanica_id`, `descricao_visual`, `receita`, `taxa_abertura`, `ctor`
- `crm_ai_insert_ia_output({ p_marca_id, p_tipo_canal, p_analisado, p_prompt, p_modelo, p_parametros, p_imagens })` → grava registro de geração de imagem/GIF

Tabela `crm_ai.ia_outputs` é escrita diretamente (não via RPC) em `/api/approve-pauta` através do client `supabaseCrmAi` (cliente Supabase configurado com `db.schema = 'crm_ai'`). Colunas inferidas do código ([server/index.ts](server/index.ts:763)): `output_id` (retornado no insert), `marca_id`, `tipo_canal`, `o_que_foi_analisado`, `fontes_referenciadas` (jsonb), `modelo`, `parametros` (jsonb), `recomendacao_texto`, `recomendacao_estruturada` (jsonb), `imagens_geradas` (jsonb), `aprovado` (boolean).

**Ação recomendada para unificação:** rodar `supabase db pull` ou `list_tables`/`get_advisors` (MCP Supabase) contra o projeto remoto para capturar o DDL real de `crm_ai` e trazê-lo para uma migration versionada.

---

## 3. Serviços implementados

### 3.1 Endpoints HTTP (`server/index.ts`)

| Rota | Método | Entrada principal | Saída | Efeito colateral |
|---|---|---|---|---|
| `/api/historico` | GET | — | `{status, data: DisparoHistorico[]}` | leitura de cache em memória |
| `/api/mecanicas` | GET | — | `{status, data: string[]}` | leitura de cache em memória |
| `/api/generate-pauta` | POST | `{modo, input, aspectRatio, direcionamentoIA, tipoGeracao, referenciaImagem\|referenciasImagem}` | `{status, data: PautaGerada[]}` | chama Gemini; auto-registra mecânica nova em `mecanicas_catalog` |
| `/api/analyze-frame` | POST | `{imageDataUrl}` | JSON de metadados visuais (cores, posições, tipografia) | chama Gemini (`gemini-2.0-flash`, vision) |
| `/api/generate-image` | POST | `{frameDescription, marca, aspectRatio, imageModel, ...}` | `{imageBytes, mimeType, publicUrl}` | chama PiApp; opcionalmente redimensiona com `sharp`; upload no Storage; grava `crm_ai.ia_outputs` via RPC (fire-and-forget) |
| `/api/generate-gif` | POST | `{frameInicial, frameIntermediario, frameFinal, marca, ...}` | `{frames: [{frameName, imageBytes, mimeType, publicUrl}]}` | 3 chamadas PiApp em paralelo; upload no Storage; grava `crm_ai.ia_outputs` via RPC |
| `/api/parse-estilo-visual` | POST | `{estiloVisualTexto, marca}` | JSON com cores/fonte/estilo de botão | chama API da Anthropic diretamente (fetch) |
| `/api/generate-variation` | POST | `{pauta}` | `{status, data: PautaCopy}` | chama Gemini |
| `/api/save-frame` | POST | `{pautaId, frameName, imageDataUrl}` | `{publicUrl}` | upload no Storage bucket `campaign-images` |
| `/api/approve-pauta` | POST | `{pauta, frameImages}` | `{success, output_id}` | insert direto em `crm_ai.ia_outputs` |

Validação de segurança notável: `/api/generate-pauta` detecta tentativas de prompt injection no campo `direcionamentoIA` via regex (`ignore|esqueça|não siga|desconsidere` + `regra|playbook|instrução`) e as neutraliza, registrando um risco de nível alto.

### 3.2 Validação determinística do playbook ([server/validators.ts](server/validators.ts))

Roda **antes** da chamada ao Gemini (Modo B) e **depois** (sanitização do output), garantindo que as regras invioláveis nunca dependam só do LLM:

- `validateSubjectModoB(assunto, marca)` — detecta `%`, `OFF`, `GRÁTIS`/`GRATIS`, `R$`, caixa alta total, >2 emojis, e comprimento fora da faixa da marca (Ápice 27–47, Barbours 16–39). Retorna lista de `RiscoAlerta`.
- `sanitizeAssunto(assunto, marca, riscosExistentes)` — remove termos proibidos e normaliza caixa alta total, devolvendo assunto limpo + riscos.
- `sanitizeBannerText(texto)` — remove os mesmos termos proibidos de headline/sub-headline do banner.
- `risksUnique(lista)` — deduplica riscos por `campo + mensagem`.

### 3.3 Camada de dados/estado do servidor ([server/supabase.ts](server/supabase.ts))

Mantém estado mutável em memória, populado no boot (`startServer()`):
- `loadDisparosFromSupabase()` — carrega `disparos_historicos`; fallback para `hardcodedDisparos` (em `server/data.ts`) se Supabase falhar ou não tiver linhas.
- `loadMecanicasFromSupabase()` — carrega `mecanicas_catalog.nome`; fallback para `DEFAULT_MECANICAS`.
- `loadCrmAiContext()` — carrega marcas/paletas, listas de mecânica/estilo e top emails por receita do schema `crm_ai` via RPC; fallback silencioso (log de warning) se falhar.
- `buildVisualHitsBlock(marca)` — formata os top emails da marca em texto para injetar no prompt do Gemini.
- `autoRegisterMecanica(nome)` — upsert em `mecanicas_catalog` quando a IA usa uma mecânica ainda não catalogada.

### 3.4 Serviço de persistência de pautas — frontend ([src/lib/pautas-service.ts](src/lib/pautas-service.ts))

- `getPautas(): Promise<PautaGerada[] | null>` — lê `pautas_geradas` ordenado por `data_criacao desc`; retorna `null` em erro/sem Supabase (caller cai para `localStorage`, ver `App.tsx`).
- `upsertPautas(pautas: PautaGerada[]): Promise<void>` — upsert em lote por `id`.
- `clearPautas(): Promise<void>` — limpa todas as linhas (`neq('id','')`).

Mapeamento de campos camelCase↔snake_case fica isolado neste arquivo (`fromDb`/`toDb`), então nenhum outro lugar do frontend lida com nomes de coluna do banco.

### 3.5 Autenticação/controle de acesso ([src/lib/supabase.ts](src/lib/supabase.ts))

Cliente Supabase Auth configurado com PKCE + `localStorage` (`storageKey: 'spectrum-auth-token'`). Não há RLS por usuário nas tabelas (`allow_all_pautas` é irrestrito) — o controle de acesso hoje é só um allowlist de domínio de email:

```
ALLOWED_DOMAINS = ['gocase.com', 'gogroup.com', 'gobeaute.com', 'gobeaute.com.br']
isEmailAllowed(email) // usado no fluxo de login para restringir quem pode entrar
```

---

## 4. Integrações com API externa

| Serviço | Uso | Onde | Autenticação | Env var |
|---|---|---|---|---|
| **Google Gemini** (`@google/genai`) | Geração de pauta (copy+visual+operacional+previsão+riscos), variação de copy, análise visual de frame, extração de metadados de frame de referência | [server/gemini.ts](server/gemini.ts), [server/index.ts](server/index.ts:176) | API key | `GEMINI_API_KEY` |
| **Supabase** (Postgres + Storage + Auth) | Banco relacional (`public` e `crm_ai`), bucket `campaign-images`, autenticação de usuário no frontend | [server/supabase.ts](server/supabase.ts), [src/lib/supabase.ts](src/lib/supabase.ts) | anon/public key (front e back usam a **mesma** anon key — não há service key separada) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| **PiApp** (geração de imagem, MCP over HTTP) | Geração dos frames de banner/GIF; upload de imagem de referência | [server/piapp.ts](server/piapp.ts) | Bearer token | `PIAPP_API_KEY` (URL fixa no código: `https://piapp-v2.vercel.app/api/ai/mcp`) |
| **Anthropic (Claude)** | Parser de estilo visual em texto livre → JSON de cores/fonte/botão (`/api/parse-estilo-visual`) | [server/index.ts](server/index.ts:637), modelo `claude-haiku-4-5-20251001` | API key | `ANTHROPIC_API_KEY` — **não documentada em `.env.example`, mas usada em produção** |

### Detalhes por integração

**Gemini** — modelo `gemini-2.5-flash` para geração estruturada (`responseSchema` tipado via `Type.*`), `gemini-2.0-flash` para as chamadas de visão (análise de frame). Cliente único (`ai`) instanciado uma vez em `server/gemini.ts:5` com header customizado `User-Agent: aistudio-build`. O prompt embute: playbook fixo por marca, histórico de disparos filtrado por marca, top emails de receita do `crm_ai` (quando disponíveis), e o direcionamento do usuário — com uma hierarquia de prioridade explícita (regras de entregabilidade > playbook > direcionamento do usuário).

**PiApp** — protocolo MCP JSON-RPC sobre HTTP com resposta em formato SSE (`data: <json>`). Fluxo: `upload_reference` (se houver imagem de referência) → `generate_image` (retorna `job_id`) → polling `check_jobs` a cada 3s por até 90s → download do `output_url` e conversão para base64. Modelos válidos ficam em `VALID_IMAGE_MODELS` ([server/data.ts:56](server/data.ts)); default `wavespeed-gpt-image-2-t2i`.

**Anthropic** — única chamada fora do SDK `@google/genai`, via `fetch` direto ao endpoint REST (`https://api.anthropic.com/v1/messages`), sem SDK. Motivo aparente: tarefa pequena e isolada (parsing de estilo). **Risco de inconsistência de padrão**: é o único ponto do backend que fala com um provedor de LLM sem passar pelo módulo `server/gemini.ts` — candidato natural a unificação se o time padronizar em um único client/wrapper de LLM.

**Domínio `gobeaute.com.br`** (commit recente `feat: adicionar gobeaute.com.br aos domínios permitidos`) — não é uma integração de API, é apenas uma entrada adicionada em `ALLOWED_DOMAINS` (controle de acesso por email, [src/lib/supabase.ts](src/lib/supabase.ts:23)).

### Variáveis de ambiente — estado real vs `.env.example`

`.env.example` hoje lista apenas `GEMINI_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `PIAPP_API_KEY`. **Falta `ANTHROPIC_API_KEY`**, que é lida em `server/index.ts:641` e é obrigatória para `/api/parse-estilo-visual` funcionar. Também vale registrar: não existe hoje um `SUPABASE_SERVICE_ROLE_KEY` — todas as operações de escrita (incluindo Storage) usam a anon key, o que depende inteiramente das RLS policies acima para segurança.

---

## 5. Pontos de atenção para unificação entre apps

- **RLS permissiva por padrão**: `pautas_geradas` e `mecanicas_catalog` aceitam escrita irrestrita pela anon key. Qualquer app compartilhando este projeto Supabase herda esse mesmo nível de exposição.
- **Schema `crm_ai` não versionado**: existe e é ativamente lido/escrito pelo Spectrum, mas seu DDL não está em `supabase/migrations/`. Precisa ser importado antes de outra aplicação depender dele.
- **Padrão de integração LLM inconsistente**: Gemini via SDK oficial, Anthropic via `fetch` manual — vale padronizar se mais apps forem falar com LLMs.
- **Duas fontes de verdade para "marca"**: hardcoded em `server/data.ts` (`BRAND_DNA_FALLBACK`, `hardcodedDisparos`) e dinâmico no `crm_ai` (paletas, tom de voz, mecânicas canônicas) — o código sempre prioriza o dinâmico e cai para o hardcoded, mas os dois precisam ser mantidos em sincronia manualmente.
- **`CLAUDE.md` desatualizado**: descreve uma arquitetura anterior (server.ts monolítico, sem `crm_ai`, sem PiApp/Anthropic). Recomendo atualizá-lo junto com qualquer trabalho de unificação para não confundir quem chegar depois.
