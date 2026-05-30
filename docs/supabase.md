# Supabase — Schema e Integração

## Projeto

- **URL**: `https://krxuwejvkdkrjrppcwsw.supabase.co`
- **Chave anon/public**: configurada em `.env` como `VITE_SUPABASE_ANON_KEY`

## Tabelas

### `disparos_historicos`

Campanhas de referência históricas. Lida pelo `server.ts` no startup para alimentar o contexto do Gemini.

| Coluna | Tipo PostgreSQL | Mapeamento TypeScript |
|---|---|---|
| `id` | `text` (PK) | `id: string` (ex: `"EMA-101"`) |
| `marca` | `text` | `marca: 'Apice' \| 'Barbours'` |
| `mecanica` | `text` | `mecanica: string` |
| `disparos` | `integer` | `disparos: number` |
| `receita_media` | `numeric` | `receitaMedia: number` |
| `performance` | `text` | `performance: string` |
| `contextos_recomendados` | `text[]` ou `jsonb` | `contextosRecomendados: CampaignContext[]` |

O mapper em `server.ts` aceita tanto `receita_media` (snake_case) quanto `receitaMedia` (camelCase).

### `pautas_geradas`

Pautas criadas pela IA. Lida e escrita diretamente pelo frontend via `src/lib/pautas-service.ts`.

| Coluna | Tipo PostgreSQL | Mapeamento TypeScript |
|---|---|---|
| `id` | `text` (PK) | `id: string` (ex: `"pauta-1716000000-0"`) |
| `marca` | `text` | `marca: 'Apice' \| 'Barbours'` |
| `modo` | `text` | `modo: 'A' \| 'B'` |
| `copy` | `jsonb` | `copy: PautaCopy` |
| `visual` | `jsonb` | `visual: PautaVisual` |
| `operacional` | `jsonb` | `operacional: PautaOperacional` |
| `previsao` | `jsonb` | `previsao: PerformancePrevisao` |
| `riscos` | `jsonb` | `riscos: RiscoAlerta[]` |
| `status` | `text` | `status: 'rascunho' \| 'aprovado' \| 'descartado'` |
| `data_criacao` | `timestamptz` | `dataCriacao: string` (ISO 8601) |

## SQL de Criação (caso precise recriar)

```sql
create table disparos_historicos (
  id text primary key,
  marca text not null,
  mecanica text not null,
  disparos integer not null default 0,
  receita_media numeric not null default 0,
  performance text not null,
  contextos_recomendados text[] not null default '{}'
);

create table pautas_geradas (
  id text primary key,
  marca text not null,
  modo text not null,
  copy jsonb not null,
  visual jsonb not null,
  operacional jsonb not null,
  previsao jsonb not null,
  riscos jsonb not null default '[]',
  status text not null default 'rascunho',
  data_criacao timestamptz not null default now()
);
```

## RLS (Row Level Security)

Para uso sem autenticação (app interno), as tabelas precisam de políticas permissivas ou RLS desabilitado:

```sql
-- Opção A: desabilitar RLS (mais simples para app interno)
alter table disparos_historicos disable row level security;
alter table pautas_geradas disable row level security;

-- Opção B: políticas permissivas com anon key
alter table disparos_historicos enable row level security;
create policy "leitura publica" on disparos_historicos for select using (true);

alter table pautas_geradas enable row level security;
create policy "leitura publica" on pautas_geradas for select using (true);
create policy "escrita publica" on pautas_geradas for insert with check (true);
create policy "update publica" on pautas_geradas for update using (true);
create policy "delete publica" on pautas_geradas for delete using (true);
```

## Fluxo de Fallback

```
Frontend init
  → getPautas() do Supabase
    ✓ dados remotos → usa Supabase
    ✗ erro / vazio  → carrega localStorage
                     → dispara upsertPautas() para migrar (silencioso)

saveHistory(novaLista)
  → atualiza React state (imediato)
  → escreve localStorage (imediato)
  → upsertPautas() no Supabase (async, fire-and-forget)

server.ts startup
  → loadDisparosFromSupabase()
    ✓ dados remotos → substitui array hardcoded em memória
    ✗ erro          → mantém os 17 registros hardcoded como fallback
```
