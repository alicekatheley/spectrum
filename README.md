# Spectrum

Gerador de pautas de CRM (e-mail marketing) das marcas do Grupo GoBeauté, e a aba
de calendário que decide **quando** e **com qual oferta** disparar, a partir do
histórico real de campanhas no BigQuery.

Duas partes que se encaixam mas não são a mesma coisa:

- **Pauta** — copy, visual, mecânica, previsão e riscos de uma campanha. Marcas
  com playbook próprio: Ápice e Barbours.
- **Calendário** — a grade de disparos de um período. Cobre cinco marcas
  (`apice`, `barbours`, `kokeshi`, `lescent`, `rituaria`) e não inventa nada: se
  o modelo no BigQuery não tem dado, a aba fica indisponível de propósito.

---

## ⚠️ Existem DOIS servidores

Este é o erro mais caro do repositório, e ele já aconteceu.

| | `server/index.ts` | `worker.ts` |
|---|---|---|
| Roda quando | `npm run dev`, local | **produção** (GoDeploy) |
| Runtime | Node + Express | Workers — sem `require`/`import` |
| Testado por | abrir `localhost:3000` | `npx tsx scripts/verificar-worker-calendario.ts` |

**Rota nova precisa entrar nos dois.** Abrir `localhost:3000` não testa o
servidor de produção. Hoje existem rotas que só existem de um lado — a lista
está em [DOCUMENTATION.md](DOCUMENTATION.md#2-rotas).

---

## Rodar

```bash
cp .env.example .env      # e preencha AI_PROXY_KEY, Supabase, BigQuery, PiApp
npm install
npm run dev               # http://localhost:3000
```

No Windows o Node está em `C:\Program Files\nodejs` e não entra no PATH sozinho:

```bash
export PATH="/c/Program Files/nodejs:$PATH"
```

Boot bem-sucedido loga:

```
[Supabase] 17 disparos históricos carregados.
[Express Server] Iniciado em http://localhost:3000
```

### Comandos

```bash
npm run dev       # Express + Vite middleware, porta 3000
npm run build     # SPA (vite) + bundle CJS do Express (esbuild) → dist/
npm run start     # roda o bundle de produção do Express
npm run lint      # tsc --noEmit — não há test runner

npx tsx scripts/servir-worker.ts                    # sobe o worker.ts local (:3100)
npx tsx scripts/verificar-worker-calendario.ts       # worker × BigQuery real
npx tsx scripts/verificar-worker-calendario.ts --ia  # idem + AI proxy
npm run verify:calendario                            # invariantes do gerador
```

`npm run build` empacota **só o Express**. O `worker.ts` não passa por build aqui.

---

## IA: proxy do Grupo, não Gemini

Toda chamada nova vai para `https://ai-proxy.gogroupbr.com/v1` (OpenAI-compatível,
`messages[]`), via `server/ai-proxy.ts` no Express e `callGemini()` no worker.
Modelo padrão `gpt-5.5`. **Nenhum modelo Google.**

Duas armadilhas que já custaram tempo:

- Apontar o SDK `@google/genai` para essa URL **não funciona** — os protocolos
  são diferentes (`contents[].parts[]` vs `messages[]`) e o erro é um 400
  *"API key not valid"*, que culpa a chave quando o problema é o formato.
- `response_format: {type:"json_schema"}` é **aceito e silenciosamente ignorado**
  (HTTP 200 devolvendo markdown). Só `{type:"json_object"}` funciona — e ele
  garante sintaxe JSON, não conformidade com schema. Por isso `chatJson` exige
  um type guard.

A migração **não terminou**: quatro funções de geração de pauta no Express ainda
usam `@google/genai` com `GEMINI_API_KEY`. Detalhe em
[DOCUMENTATION.md](DOCUMENTATION.md#3-camada-de-ia--migração-pela-metade).

---

## Onde está documentado o quê

| Documento | Assunto |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Guia operacional: como rodar, armadilhas, convenções |
| [DOCUMENTATION.md](DOCUMENTATION.md) | Servidor: rotas, IA, BigQuery, Supabase, integrações, dívidas |
| [docs/architecture.md](docs/architecture.md) | Front: estado, persistência, fluxos do navegador |
| [docs/supabase.md](docs/supabase.md) | Schema do Supabase (parcial — só as 2 tabelas originais) |
| `sql/bigquery/*.sql` | O modelo de calendário. Cabeçalhos longos explicam a derivação |
| `crm_modelo_handoff_23-08-2026/` | Estado do dataset BigQuery, fora deste repo |

A divisão é de propósito: `DOCUMENTATION.md` é servidor, `docs/architecture.md` é
cliente. Fato que aparece nos dois vai divergir — foi assim que o
`architecture.md` passou meses descrevendo um Gemini que já não existia.
