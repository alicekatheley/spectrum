# Arquitetura do front (SPA)

Este documento cobre **só o cliente**: quem é dono do estado, o que persiste onde,
e em que ordem as coisas acontecem no navegador.

Servidor, rotas, IA, BigQuery e Supabase (schema) estão em
[DOCUMENTATION.md](../DOCUMENTATION.md). **Não repita esses fatos aqui** — a versão
anterior deste arquivo duplicava a lista de rotas e o stack, e foi exatamente
por isso que ela apodreceu: descrevia um "processo único Express" e um Gemini que
já não existiam havia meses, sem que ninguém notasse.

---

## `App.tsx` é o dono de tudo

Não há router. Não há store. `App.tsx` concentra ~32 `useState` e passa tudo
para baixo por props; os componentes são folhas de apresentação/formulário que
devolvem callbacks. Navegação é estado (`activeTab`), não URL.

Consequência prática: **não existe deep-link**. Não dá para mandar a alguém o
link de uma pauta — recarregar cai sempre na aba inicial. Se isso um dia
incomodar, o conserto é um router de verdade, não um parâmetro de query.

---

## Três camadas de persistência, com escopos diferentes

Esta é a parte que confunde, e a distinção que importa é **compartilhado vs.
por-navegador**:

| Onde | O quê | Escopo |
|---|---|---|
| Supabase (`pautas_geradas`) | Pautas geradas | **Compartilhado** entre todas as pessoas |
| Supabase Storage | Frames de GIF (arquivos) | **Compartilhado** |
| `localStorage` | Ver tabela abaixo | **Só este navegador** |

Chaves de `localStorage` em uso:

| Chave | Conteúdo |
|---|---|
| `crm_pautas_history` | Fallback do histórico, se o Supabase não responder |
| `crm_frame_b64` | Frames em base64, por pauta |
| `crm_frame_urls` | URLs de frames no Storage, por pauta |
| `crm_theme` | Tema claro/escuro |

O descasamento é deliberado e é a razão de um `useEffect` que parece
supérfluo: como o **Storage é compartilhado mas `crm_frame_urls` é
por-navegador**, uma pauta gerada por outra pessoa chega sem frames neste
navegador. O efeito em `App.tsx` (~linha 473) reconstrói as URLs a partir da
convenção de nome (`frame_0`…`frame_{N-1}`) em vez de depender do
`localStorage` local. Sem ele, o trabalho de um colega aparece como pauta sem
imagem — e parece bug de geração, não de cache.

> Nota: um comentário perto dessa linha cita uma chave `crm_frame_pautas` que
> **não existe** no código. É resíduo; ignore.

---

## Fluxos

### Carregamento inicial

1. `getPautas()` consulta `pautas_geradas`.
2. Se vier dado: usa e semeia as URLs de frame. **Fim** — o `localStorage` nem
   é lido.
3. Se vier vazio: lê `crm_pautas_history`, normaliza `tipoGeracao` (pautas
   antigas não têm o campo) e dispara `upsertPautas()` para migrar o local para
   o remoto, uma vez só.

O passo 2 encerrar cedo é o que impede o fallback de sobrescrever dado bom com
dado velho.

### Geração de pauta (Modo A e B)

`App.tsx` faz `POST /api/generate-pauta` → servidor valida deterministicamente
(assunto, emojis, termos proibidos), injeta o histórico da marca no prompt e
chama o AI proxy → resposta sanitizada volta → `saveHistory()`.

`saveHistory()` escreve **`localStorage` de imediato e Supabase em async**. A UI
nunca espera a rede. O preço é que uma falha do Supabase é silenciosa até o
próximo reload.

> O doc antigo dizia que o Gemini devolvia "JSON com schema enforced". Isso
> nunca foi verdade no proxy atual: `response_format: {type:"json_schema"}` é
> aceito e ignorado. Ver DOCUMENTATION.md §3.

### Polling do Agente de GIF (Modo C)

Pautas modo `C` nascem **no backend, por cron** — ninguém clica em nada. Um
`setInterval` de 60s chama `getPautas()` e mescla só os `id` desconhecidos.

Duas decisões embutidas:

- O merge é por `id`, não substituição, para não derrubar estado local de
  pautas abertas.
- O polling **não reescreve o `localStorage`**; o fallback só é reconstruído
  num reload completo.

Modo `C` tem aba própria e é filtrado do Histórico de Pautas
(`p.modo !== 'C'`), senão o volume do agente enterraria as pautas manuais.

---

## Modos

| Modo | Origem | Descrição |
|---|---|---|
| A | Usuário | Descoberta livre — marca, quantidade, contexto, segmento |
| B | Usuário | Co-piloto assistido — 5 caixas preenchidas, IA valida e completa |
| C | Cron (backend) | Agente de GIF, cota de 5/dia |

Playbooks por marca (Ápice, Barbours) ficam no servidor e estão em
[DOCUMENTATION.md](../DOCUMENTATION.md); repetir os valores aqui é como o
arquivo anterior passou a mentir.
