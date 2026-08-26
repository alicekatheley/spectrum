# Spectrum — Documentação Técnica

> Atualizado em **25/08/2026** contra o código em `HEAD`. A versão anterior era de
> 18/08 e descrevia a aplicação como processo único Express com Gemini — as duas
> coisas deixaram de ser verdade.

Spectrum gera pautas de CRM (e-mail marketing) para **Ápice** e **Barbours**, e
monta calendários de disparo para **cinco** marcas (`apice`, `barbours`,
`kokeshi`, `lescent`, `rituaria`) a partir de um modelo estatístico que vive no
BigQuery.

---

## 1. Os dois servidores

A aplicação tem **dois** servidores que implementam a mesma API em runtimes
diferentes. Não é redundância: é o custo de a plataforma de produção não ser Node.

| | `server/index.ts` (1.274 linhas) | `worker.ts` (2.671 linhas) |
|---|---|---|
| Entry point | `server.ts` → `startServer()` | `export default { async fetch }` |
| Runtime | Node + Express 4 | Workers (GoDeploy) |
| Roda quando | `npm run dev` | **produção** |
| Imports | livres (`@google-cloud/bigquery`, `sharp`, `node-cron`) | **nenhum** — arquivo autocontido |
| BigQuery | SDK oficial + ADC | REST API, JWT RS256 assinado com WebCrypto |
| Supabase | `@supabase/supabase-js` | REST na mão (`supabaseRestGet`, `supabaseRpc`) |
| Agendamento | `node-cron` in-process | `POST /tasks/agente-gif-tick` chamado pela plataforma |
| SPA/estáticos | serve `dist/` | **não serve** — fallback é `404 JSON` |
| Build | `npm run build` → `dist/server.cjs` | **nenhum build no repo** |

**Consequência prática:** bibliotecas Node não podem ser usadas no `worker.ts`. E
testar em `localhost:3000` não testa o servidor de produção. Para exercitar o
worker de verdade:

```bash
npx tsx scripts/verificar-worker-calendario.ts   # chama worker.fetch() contra BigQuery real
npx tsx scripts/servir-worker.ts                 # sobe o worker num HTTP local (:3100)
```

### Armadilha da REST API do BigQuery

Ela devolve **todo** valor como string, inclusive `BOOLEAN` e `INTEGER` — e
`Boolean("false") === true`. `TIMESTAMP` vem como epoch em notação científica.
As coerções ficam em `bqNum` / `bqBool` / `bqTimestamp` no `worker.ts`.

---

## 2. Rotas

18 rotas no total. **Cinco divergem entre os servidores** — essa tabela é a parte
mais importante deste documento.

| Rota | Express | Worker | Situação |
|---|:---:|:---:|---|
| `GET /api/historico` | ✅ | ✅ | ⚠️ **fontes diferentes**: Express lê `disparos_historicos` do Supabase; worker devolve `hardcodedDisparos` embutido |
| `GET /api/mecanicas` | ✅ | ✅ | ⚠️ **fontes diferentes**: Express lê `mecanicas_catalog`; worker devolve `DEFAULT_MECANICAS` embutido |
| `POST /api/generate-pauta` | ✅ | ✅ | Express via `@google/genai`; worker via AI proxy |
| `POST /api/generate-variation` | ✅ | ✅ | idem |
| `POST /api/generate-image` | ✅ | ✅ | PiApp nos dois |
| `POST /api/generate-gif` | ✅ | ✅ | PiApp nos dois, 3 frames em paralelo |
| `POST /api/save-frame` | ✅ | ✅ | Storage `campaign-images` |
| `POST /api/approve-pauta` | ✅ | ✅ | insert em `crm_ai.ia_outputs` |
| `POST /api/feedback-agente-gif` | ✅ | ✅ | |
| `GET /api/calendario/status` | ✅ | ✅ | |
| `GET /api/calendario/contexto` | ✅ | ✅ | catálogo + índices do BigQuery |
| `GET /api/calendario/nao-classificadas` | ✅ | ✅ | |
| `POST /api/calendario/explicar` | ✅ | ✅ | AI proxy nos dois; 503 sem chave |
| `GET /api/teste-ab` | ✅ | ✅ | |
| `POST /api/parse-estilo-visual` | ✅ | ⚠️ | **stub no worker** — ver abaixo |
| `POST /api/analyze-frame` | ✅ | ❌ | **só Express, e ninguém chama** — código morto dos dois lados |
| `POST /api/teste-ab-regenerar` | ❌ | ✅ | **só worker** — `src/App.tsx:297` chama ⇒ 404 em `npm run dev` |
| `POST /api/teste-ab-enviar-insider` | ❌ | ✅ | **só worker** — `src/App.tsx:383` chama ⇒ 404 em `npm run dev` |
| `POST /tasks/agente-gif-tick` | ❌ | ✅ | cron da plataforma. No Express o equivalente é `node-cron` in-process |

### `/api/parse-estilo-visual` — divergência funcional silenciosa

No Express (`server/index.ts:839`) a rota chama a API da Anthropic
(`claude-haiku-4-5-20251001`) e parseia estilo visual de texto livre.

No worker (`worker.ts:2387`) ela devolve uma **paleta fixa por marca sem chamar
IA nenhuma**. Em produção esse endpoint não parseia coisa alguma — devolve
sempre `#688D65` para Ápice e `#BF0F26` para o resto, com `Georgia, serif`.

O código não tem comentário justificando, ao contrário do resto do arquivo, que é
fartamente comentado. **Não está determinado** se é degradação aceita ou
esquecimento.

### Espelho do bug de calendário, na direção contrária

O `CLAUDE.md` documenta o caso em que rotas foram escritas só no Express e
falharam em produção. Hoje existe o inverso: duas rotas de teste A/B existem só
no worker e o frontend as chama. Quem desenvolve localmente vê esses fluxos
quebrados; em produção funcionam.

### Agente de GIF (Modo C) — mesma cota, estratégias diferentes

Ambos limitam a **5 pautas modo `C` por dia**. A diferença é como completam:

- Express (`ensureDailyAgenteGifQuota`, `server/index.ts:713`) — conta quantas
  faltam e gera todas num laço, espaçando as chamadas.
- Worker (`/tasks/agente-gif-tick`, `worker.ts:2651`) — gera **no máximo 1 por
  chamada** e devolve `skipped:true` se já houver 5. Quem garante a cota é a
  frequência do agendamento.

---

## 3. Camada de IA — migração pela metade

O destino é o **AI proxy do Grupo**: `https://ai-proxy.gogroupbr.com/v1`,
OpenAI-compatível (`messages[]`), modelo padrão `gpt-5.5`. Cliente em
`server/ai-proxy.ts` (199 linhas) e `callGemini()` em `worker.ts:75`.

O estado real hoje:

| Onde | Provedor | Modelo |
|---|---|---|
| `worker.ts` — **tudo** | AI proxy | `gpt-5.5` (hardcoded, `worker.ts:83`) |
| `server/gemini.ts:633` `explicarCalendario` | AI proxy | `AI_PROXY_MODEL` ou `gpt-5.5` |
| `server/gemini.ts:322` `generatePautaContent` | **`@google/genai`** | `gemini-2.5-flash` |
| `server/gemini.ts:399` `generateGifAgentConcept` | **`@google/genai`** | `gemini-2.5-flash` |
| `server/gemini.ts:442` `generateAbTestProposal` | **`@google/genai`** | `gemini-2.5-flash` |
| `server/gemini.ts:488` `generateVariationContent` | **`@google/genai`** | `gemini-2.5-flash` |
| `server/index.ts:188` (analyze-frame) | **`@google/genai`** | `gemini-2.0-flash` |
| `server/index.ts:334` (metadados de frame) | **`@google/genai`** | `gemini-2.0-flash` |
| `server/index.ts:839` (parse-estilo-visual) | Anthropic, `fetch` direto | `claude-haiku-4-5-20251001` |
| `scripts/analisar-conteudos-links.ts:113` | **`@google/genai`** | `gemini-2.5-flash` |

**Seis call sites ativos ainda dependem de `GEMINI_API_KEY`**, apesar de
`.env.example` e `CLAUDE.md` afirmarem que essa variável não existe. Ela é lida em
`server/gemini.ts:7`. `@google/genai@^1.29.0` continua no `package.json`.

Isso só não quebrou porque o worker — que é produção — já está 100% no proxy. O
Express é que ficou para trás.

### Duas armadilhas do proxy

1. Apontar o SDK `@google/genai` para a URL do proxy **não funciona**. Os
   protocolos são diferentes (`contents[].parts[]` vs `messages[]`) e o sintoma é
   um 400 *"API key not valid"* — culpa a chave quando o problema é o formato.
2. `response_format: {type:"json_schema"}` é **aceito e silenciosamente ignorado**
   (HTTP 200 devolvendo markdown). Só `{type:"json_object"}` funciona, e ele
   garante sintaxe JSON, não conformidade com schema. Por isso `chatJson<T>` exige
   um type guard obrigatório.

---

## 4. Modelo de calendário (BigQuery)

Dataset **`gogroup-crm.crm_modelo`**, região `southamerica-east1`. É a fonte da
aba de calendário. Não há fallback para dados sintéticos — sem BigQuery, a aba
fica indisponível de propósito.

### Objetos

- **12 tabelas** — `marca_config`, `marca_oferta_familia`, `fato_slot`,
  `fato_pessoa_dia`, `fato_gap_pessoa`, `snapshot_indices`, `calendario_publicado`,
  `calendario_realizado`, `job_log`, `monitor_classificador` (+ 2 backups
  `_bkp_*_20260825`)
- **7 views** — `v_indices_atuais`, `v_config_derivada`, `v_horas_dow`,
  `v_viabilidade`, `v_validacao`, `v_saude_marca`, `v_oferta_sem_familia`
- **8 procedures** — `sp_carrega_fato_slot`, `sp_carrega_pessoa_dia`,
  `sp_carrega_gap_pessoa`, `sp_monitor_classificador`, `sp_deriva_config`,
  `sp_deriva_grade_horarios`, `sp_deriva_indices`, `sp_glm_pois_1x`

### Scheduled queries

| Nome | Quando (UTC) | O que faz |
|---|---|---|
| `crm_modelo - ETL diario` | todo dia 11:30 | fatos + as três derivações, por marca |
| `crm_modelo - ETL semanal (pessoa)` | segunda 12:30 | `fato_pessoa_dia` e `fato_gap_pessoa` |
| `crm_modelo - alerta de saude` | todo dia 12:00 | dá `RAISE` se algo está quebrado |

O alerta **se derruba de propósito**: o `RAISE` faz o Data Transfer Service
disparar o e-mail nativo de "scheduled query failed" (`enableFailureEmail`), sem
infra de alerta adicional. Destinatário: `avila.farias@gobeaute.com.br`.

O ETL diário termina ~11:46 e o alerta roda 12:00 — **13,7 minutos de margem**.
É pouco e está registrado como pendência.

### Tudo é derivado, nada é semeado à mão

A ordem das três procedures de derivação **é obrigatória e não é estética**:
`sp_deriva_config` GRAVA `marca_config.min_enviados_slot`, e as duas seguintes
LEEM essa coluna. Invertida, a grade e os índices do dia saem calculados com o
limiar de ontem — sem erro, sem log, sem sintoma.

Estado atual de `marca_config` (5 marcas, todas ativas, janela de 138 dias):

| marca | min_enviados_slot | max_dias_com_3 | volume_maximo_semana |
|---|---|---|---|
| apice | 24.254 | 5 | 4.684.665 |
| barbours | 36.400 | 6 | 5.847.350 |
| kokeshi | 36.809 | 7 | 2.921.522 |
| lescent | 14.179 | 6 | 2.194.349 |
| rituaria | 42.389 | 5 | 3.672.078 |

### Índices e peso de transferência

`sp_deriva_indices` faz walk-forward: constrói os índices num período de treino e
mede num período de teste posterior via GLM Poisson. A relação é

```
taxa_teste(k) / base = idx_treino(k) ^ b
```

`b` **não é uma nota de aprovação — é o expoente**. `snapshot_indices` grava
`coef_transferencia` (b), `transf_se`, `peso_transferencia` (b encolhido por
James-Stein positive-part, piso 0 e teto 1,5) e `valor_efetivo = valor^peso`.

**`peso_transferencia` é por ÍNDICE, não por nível** — e é por isso que
`valorEfetivo` não é o que o app consome. Dentro de um mesmo índice, um nível com
n=97 e um nível com n=1 recebem o mesmo expoente; quando o peso passa de 1, o
expoente **amplifica** em vez de encolher, e um horário visto uma única vez entrava
no plano valendo 3,35×. `configDoContexto` (`src/utils/calendarioContexto.ts`)
aplica então uma segunda camada de credibilidade, esta por nível:

```
idx = clamp( valor ^ (peso · n/(n + 10)), 0,6 … 1,8 )
```

O SQL continua sendo a fonte de `peso` e `valor` — a divisão é deliberada: o peso é
propriedade do índice e se mede no walk-forward; a credibilidade é propriedade da
amostra de cada nível e só o consumidor sabe quantos níveis vai de fato usar. O
cálculo compartilhado vive no SQL justamente porque Express e worker já divergiram
uma vez, e `v_indices_atuais` é `SELECT s.*` — coluna nova chega aos dois servidores
sem edição dupla.

O gerador usa I1 (dia), I2 (faixa de gap), I3 (hora) e I4 (oferta), cada um
normalizado pelo conjunto de onde a escolha sai: I3 pela grade **daquele dia**, I4
pelas ofertas **daquela família**, I2 pelo próprio plano rodado sem mirar em gap.
Normalizar por um conjunto mais amplo cobra da etapa um nível que o plano não tinha
como escolher, e aparece na decomposição como ganho negativo. Quais alavancas valem
é **por marca**: onde o peso deu 0, a alavanca entra neutra, a etapa sai marcada como
não validada e um aviso diz isso.

O corte do walk-forward é **rolante**: `hoje − 1 mês`, recalculado a cada
execução. Passar `p_corte` explícito só é útil para reprocessar o passado.

Detalhe completo da derivação nos cabeçalhos de `sql/bigquery/*.sql` — em
particular `peso_transferencia_e_corte_rolante.sql`, que tem ~110 linhas
explicando por que o piso é 0 e não permite inverter índice negativo.

### Acesso

| Service account | Papel |
|---|---|
| `crm-calendario-etl@` | `dataEditor` em `crm_modelo`, `dataViewer` nas 12 origens |
| `crm-calendario-app@` | `dataViewer` **só** em `crm_modelo` — não há caminho para dado bruto |

`scripts/dts.mjs` é um cliente mínimo do Data Transfer Service (assina JWT RS256
na mão, porque o `gcloud` da máquina está sem auth). Comandos: `list`, `show`,
`patch`, `runs`, `sql`.

⚠️ **Scheduled query não é objeto SQL** — é Data Transfer Service, só REST, sem
DDL. E `updateMask=params.query` é aceito e **silenciosamente ignorado**; tem que
ser `updateMask=params` com releitura para confirmar. O `patch` do `dts.mjs` já
faz a releitura sozinho.

---

## 5. Banco de dados (Supabase)

**Projeto:** `krxuwejvkdkrjrppcwsw` (us-west-1). 15 migrations em
`supabase/migrations/`.

### Tabelas versionadas

| Tabela | Papel |
|---|---|
| `disparos_historicos` | 17 campanhas de referência (few-shot no prompt). Carregada no boot do Express |
| `pautas_geradas` | Histórico de pautas. `modo ∈ (A,B,C)`, `status ∈ (rascunho,aprovado,descartado)` |
| `mecanicas_catalog` | Mecânicas fixas + auto-registradas pela IA |
| `teste_ab_propostas` | Propostas do agente de teste A/B (+ `insider_campaign_id`, `variante_a_gif_url`) |
| `teste_ab_envios` | Log de envios ao Insider |
| `catalogo_produtos` | Catálogo Yampi por marca. UNIQUE(marca, yampi_product_id), índice GIN trigram |
| `catalogo_sync_runs` | Log de cada execução do sync Yampi |
| Bucket `campaign-images` | Público, 10 MB, `{marca}/{pautaId}/{frame}.png` |

Colunas de `pautas_geradas` acrescentadas depois da doc anterior: `tipo_geracao`,
`input_original`, `aspect_ratio`, `frame_urls`, e `modo` passou a aceitar `'C'`.

Mapeamento snake_case ↔ camelCase fica isolado em `src/lib/pautas-service.ts`
(`fromDb`/`toDb`) — nenhum outro ponto do frontend lida com nome de coluna.

### Não versionado neste repo

- **Schema `crm_ai`** — consumido via RPCs `SECURITY DEFINER` (`crm_ai_get_marcas`,
  `crm_ai_get_lists`, `crm_ai_get_top_emails`, `crm_ai_insert_ia_output`) e escrita
  direta em `crm_ai.ia_outputs`. DDL não está aqui.
- **`conteudos_links`** — duas migrations fazem `ALTER` nela, mas **nenhuma a cria**.
  Mesmo problema do `crm_ai`.

Ambos precisam de `supabase db pull` antes de qualquer unificação.

### RLS

`pautas_geradas` e `mecanicas_catalog` aceitam escrita irrestrita pela anon key
(`allow_all_pautas`). `catalogo_produtos` é a exceção: leitura pública, escrita só
`service_role`. Não há RLS por usuário — o controle de acesso é um allowlist de
domínio de e-mail no frontend (`gocase.com`, `gogroup.com`, `gobeaute.com`,
`gobeaute.com.br`).

### Sync Yampi

Edge Function `sync-catalogo-yampi` (Deno), agendada por `pg_cron` + `pg_net` às
**07:00 UTC** (04h BRT). Uma conta Yampi administra as 5 lojas: um par
`YAMPI_USER_TOKEN`/`YAMPI_USER_SECRET_KEY` compartilhado + um alias por marca.
Marca sem alias é pulada (warn); sem o par, todas são puladas.

O header é `User-Secret-Key` (com "-Key"). Se aparecer 401 *"Missing
User-Secret-Key header"*, alguém quebrou o nome do header.

---

## 6. Integrações externas

| Serviço | Uso | Onde | Credencial |
|---|---|---|---|
| **AI proxy do Grupo** | Toda IA nova | `server/ai-proxy.ts`, `worker.ts:75` | `AI_PROXY_KEY` / `GOGROUP_TOKEN` |
| **Google Gemini** | 6 call sites legados no Express | `server/gemini.ts` | `GEMINI_API_KEY` |
| **Anthropic** | `parse-estilo-visual` (só Express) | `server/index.ts:839` | `ANTHROPIC_API_KEY` |
| **BigQuery** | Modelo de calendário | `server/bigquery.ts`, REST no worker | ADC / `GCP_SERVICE_ACCOUNT_JSON` |
| **Supabase** | Postgres + Storage + Auth | `server/supabase.ts`, `src/lib/supabase.ts` | anon key |
| **PiApp** | Geração de imagem (MCP over HTTP) | `server/piapp.ts` | `PIAPP_API_KEY` |
| **Insider** | Criação de campanha de e-mail | `worker.ts` (**só worker**) | `INSIDER_API_KEY_<MARCA>` ×6 |
| **Yampi** | Catálogo de produtos | Edge Function | `YAMPI_USER_*` |

**PiApp** — JSON-RPC sobre HTTP com resposta SSE (`data: <json>`). Fluxo:
`upload_reference` → `generate_image` (devolve `job_id`) → polling `check_jobs` a
cada 3s por até 90s → download e base64. Modelos em `server/data.ts:56`, default
`wavespeed-gpt-image-2-t2i`.

**Insider** — `POST https://mail.useinsider.com/content/v1/campaign/create`, com
templates HTML de Ápice/Barbours/Gocase embutidos no `worker.ts`. Seis API keys,
uma por marca. Existe **só em produção**.

---

## 7. Variáveis de ambiente

`.env.example` está atualizado e é a referência. Ressalvas conhecidas:

| Variável | Situação |
|---|---|
| `GEMINI_API_KEY` | `.env.example` afirma que **não existe**; ainda é lida em `server/gemini.ts:7` por 6 call sites ativos |
| `ANTHROPIC_API_KEY` | Lida em `server/index.ts:885`, **não documentada** |
| `INSIDER_API_KEY_*` (6) | Secrets do worker, **não documentadas** |
| `SUPABASE_KEY` / `SUPABASE_SERVICE_KEY` | Nomes que o **worker** usa; o `.env.example` só documenta `VITE_SUPABASE_*` |
| `PORTA_WORKER` | Usada por `scripts/servir-worker.ts` (default 3100), não documentada |
| `YAMPI_*`, `SUPABASE_ACCESS_TOKEN` | Documentadas, mas lidas **só** pelo script de setup — nunca em runtime |

Existem service role keys hoje (`SPECTRUM_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_KEY`
no worker, e a chave no `vault` do Postgres para o `pg_cron`) — a afirmação
anterior de que "tudo usa anon key" deixou de valer.

---

## 8. Scripts

| Script | O que faz |
|---|---|
| `verificar-worker-calendario.ts` | Chama `worker.fetch()` contra BigQuery real. Com `--ia`, exercita o proxy |
| `servir-worker.ts` | Sobe o `worker.ts` num HTTP Node local servindo `dist/` |
| `verificar-calendario.ts` | Invariantes do gerador determinístico (todas as marcas × modos × períodos) |
| `efeito-indices.ts` | Decomposição por alavanca, marca a marca, contra o BigQuery real. Complementa o anterior, que roda no CONFIG estático e por isso não tem índice de hora nem de oferta para exercitar |
| `dts.mjs` | Cliente do BigQuery Data Transfer Service |
| `analisar-conteudos-links.ts` | Extrai frames de GIFs e classifica via Gemini |
| `aplicar-analise.ts` / `extrair-frames.ts` / `verificar-frames.ts` | Utilitários de frame |
| `setup-yampi-sync.sh` | Setup idempotente do sync Yampi |

---

## 9. Dívidas conhecidas

Ordenadas por risco de morder alguém.

1. **`parse-estilo-visual` é stub em produção** (§2). O usuário recebe paleta fixa
   e nada indica isso na tela.
2. **Duas rotas de teste A/B não existem no Express** (§2) — fluxo quebrado em dev.
3. **Migração de IA pela metade** (§3) — 6 call sites em `@google/genai` com uma
   variável que a documentação diz não existir.
4. **13,7 min de margem** entre o ETL diário e o alerta de saúde (§4).
5. **`crm_ai` e `conteudos_links` sem DDL versionado** (§5).
6. **`catalogo_produtos` é código morto no frontend** — `src/lib/catalogo-service.ts`
   existe e funciona, mas **nenhum componente o importa**. O catálogo Yampi é
   sincronizado diariamente e não é consumido em lugar nenhum.
7. **`/api/analyze-frame` é código morto** — existe só no Express e nenhum
   componente chama.
8. **`worker.ts` não tem build nem pipeline no repo** — não há script npm, nem
   `wrangler.toml`, nem workflow. Como ele é deployado **não está determinado**.
9. **`hono` está no `package.json` e não é usado** em lugar nenhum.
10. **`sb:types` gera `src/lib/database.types.ts`**, arquivo que não existe no repo.
11. **Não há test runner.** `npm run lint` é `tsc --noEmit`. Os scripts
    `verificar-*` são o mais próximo de teste que existe, e precisam ser rodados
    à mão.
