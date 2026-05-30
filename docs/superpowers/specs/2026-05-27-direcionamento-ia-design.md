# Design: Campo "Direcionamento para a IA"

**Data:** 2026-05-27  
**Projeto:** Spectrum CRM  
**Status:** Aprovado

---

## Contexto

Os formulários de Modo A e Modo B não oferecem atualmente um campo de texto livre para o usuário orientar a IA antes da geração. O usuário precisa expressar estilo de conteúdo, tipo de merchandising ou qualquer direção adicional que não cabe nos campos estruturados existentes.

Esta feature adiciona:
1. Um componente reutilizável `DirecionamentoIAField` (textarea compartilhada)
2. O campo em Modo A como **obrigatório** — bloqueia o botão de geração enquanto vazio
3. O campo em Modo B como **opcional** — sem impacto no fluxo existente quando vazio
4. Injeção do conteúdo no prompt do Gemini com hierarquia de prioridade explícita

---

## Decisões de Design

- **Gerenciamento de estado:** `direcionamentoIA` vive em `App.tsx` (Approach A), espelhando o padrão de `aspectRatio`. O App controla o valor, passa `value + onChange` para os formulários, e limpa o campo (`setDirecionamentoIA('')`) apenas no caminho de sucesso dos handlers de submit.
- **Persistência:** limpa após geração bem-sucedida; preservado em caso de erro (rede ou servidor).
- **Sem placeholder:** campo começa completamente vazio em ambos os modos.
- **Sem mudanças em `src/types.ts`:** `direcionamentoIA` é enviado como campo top-level no body do POST (igual a `aspectRatio`), não dentro de `InputModoA` ou `InputModoB`.

---

## Arquitetura

```
App.tsx
  ├─ useState<string>('') → direcionamentoIA
  ├─ handleFormASubmit → clear on success only
  ├─ handleFormBSubmit → clear on success only
  ├─ FormModoA (direcionamentoIA, onDirecionamentoChange)
  └─ FormModoB (direcionamentoIA, onDirecionamentoChange)

FormModoA
  └─ DirecionamentoIAField (required=true)
       ↓ validação: botão desabilitado se vazio
       ↓ erro inline se submit com vazio (via Enter)

FormModoB
  └─ DirecionamentoIAField (required=false)
       ↓ sem validação

POST /api/generate-pauta
  body: { modo, input, aspectRatio, direcionamentoIA }
  → server.ts injeta no prompt com prioridade correta
```

---

## Arquivos Afetados

| Arquivo | Tipo de mudança |
|---|---|
| `src/components/DirecionamentoIAField.tsx` | **Novo** |
| `src/App.tsx` | Adiciona estado + props + clear no sucesso |
| `src/components/FormModoA.tsx` | Campo obrigatório + validação |
| `src/components/FormModoB.tsx` | Campo opcional |
| `server.ts` | Extrai `direcionamentoIA` + injeta no prompt |

---

## Especificação dos Componentes

### `DirecionamentoIAField.tsx`

```typescript
interface DirecionamentoIAFieldProps {
  label: string;
  required: boolean;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}
```

**Visual:**
- Label acima do campo. Se `required=false`, exibe sufixo `(Opcional)` em `text-xs font-normal text-slate-400` — idêntico ao padrão de "Previsão de Disparo (Opcional)" em FormModoA.
- Textarea: `rows={3}`, `resize-y`, sem placeholder.
- Estilo: `bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all`
- Erro: `text-xs text-rose-500` abaixo do textarea, renderizado quando `error` estiver preenchido.

---

### Modo A — `FormModoA.tsx`

**Posição:** logo abaixo do slider "Quantidade de Pautas a sugerir" e antes da seção "Contexto de Campanha".

**Interface adicional:**
```typescript
direcionamentoIA: string;
onDirecionamentoChange: (v: string) => void;
```

**Validação:**
- Botão de submit: `disabled={loading || direcionamentoIA.trim() === ''}`
- Estado local `direcionamentoError: string`: preenchido com `"Preencha o direcionamento antes de gerar."` se `handleSubmit` for disparado com campo vazio (defesa contra submit via tecla Enter em outros campos).
- Limpo ao digitar: `onChange` chama `setDirecionamentoError('')` antes de `onDirecionamentoChange(v)`.

---

### Modo B — `FormModoB.tsx`

**Posição:** logo após o parágrafo de descrição do modo ("Preencha o que já estruturou na sua mente...") e antes do Box 1: Assunto do Email.

**Interface adicional:**
```typescript
direcionamentoIA: string;
onDirecionamentoChange: (v: string) => void;
```

**Validação:** nenhuma. O botão de submit não é alterado. Campo vazio = comportamento atual.

---

### Injeção no Prompt — `server.ts`

O campo `direcionamentoIA` é extraído do body do POST:

```typescript
const { modo, input, aspectRatio: rawAspectRatio, direcionamentoIA } = req.body;
const direcStr = typeof direcionamentoIA === 'string' ? direcionamentoIA.trim() : '';
```

#### Modo A (sempre injetado — campo obrigatório no frontend)

Bloco inserido **no topo de `promptModo`**, antes dos parâmetros estruturados:

```
=== INSTRUÇÃO PRINCIPAL DO USUÁRIO (prioridade máxima sobre o histórico) ===
"${direcStr}"

Trate essa instrução como o objetivo central desta geração. Se ela conflitar com
padrões do histórico de Hits (ex: histórico sugere conteúdos curtos mas o usuário
pediu algo mais longo), siga a instrução do usuário.
```

**Hierarquia final do prompt no Modo A:**
1. `systemInstruction` — regras invioláveis do playbook da marca
2. Instrução principal do usuário (`direcStr`) — objetivo central
3. Campos estruturados (Contexto, Segmento, Recompensa, Data, Mecânicas a evitar)
4. Histórico de hits da marca

#### Modo B (injetado somente quando `direcStr` não for vazio)

Bloco inserido **no topo de `promptModo`**, antes dos boxes, **omitido completamente quando o campo estiver vazio** (sem string vazia, sem menção ao campo):

```
=== DIREÇÃO MACRO DO BRIEFING (orientação geral do usuário) ===
"${direcStr}"

Use essa direção para orientar o preenchimento dos boxes vazios e o refinamento
dos boxes preenchidos.
REGRA DE CONFLITO: Se essa direção conflitar com o conteúdo de um box preenchido
pelo usuário, respeite o conteúdo literal do box (ele foi digitado explicitamente)
e aplique esta direção apenas nos boxes que você gerar do zero.
```

**Hierarquia final do prompt no Modo B (quando preenchido):**
1. `systemInstruction` — regras invioláveis do playbook da marca
2. Direção macro do briefing (`direcStr`) — orientação geral
3. Boxes preenchidos pelo usuário — referências literais a respeitar ou polir
4. Instruções de geração para boxes vazios
5. Histórico de hits da marca

---

## Comportamento de Limpeza do Campo

| Evento | Resultado |
|---|---|
| Geração bem-sucedida | Campo limpo (`setDirecionamentoIA('')` em App.tsx) |
| Erro de rede (catch) | Campo preservado |
| Erro do servidor (else com `resData.error`) | Campo preservado |
| Troca de marca ou modo | Campo preservado (estado em App.tsx persiste) |
