# Campo "Direcionamento para a IA" — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar o campo de texto livre "Direcionamento para a IA" em Modo A (obrigatório, bloqueia botão quando vazio) e Modo B (opcional, sem validação), com injeção no prompt do Gemini com hierarquia de prioridade explícita.

**Architecture:** `direcionamentoIA` vive como `useState<string>('')` em `App.tsx`, passado via props `direcionamentoIA + onDirecionamentoChange` para `FormModoA` e `FormModoB`, enviado como campo top-level no body do POST `/api/generate-pauta` (igual a `aspectRatio`), e injetado no início do bloco `promptModo` em `server.ts`. O campo é limpo apenas no caminho de sucesso dos submit handlers; erros de rede e de servidor preservam o valor.

**Tech Stack:** React 19 + TypeScript, Tailwind CSS, Express + Gemini (`@google/genai`). Sem framework de testes — verificação via `npm run lint` (tsc --noEmit) + smoke test manual.

---

## Estrutura de Arquivos

| Arquivo | Tipo |
|---|---|
| `src/components/DirecionamentoIAField.tsx` | **Novo** — componente textarea reutilizável |
| `src/App.tsx` | **Modificar** — estado, props, POST body, clear on success |
| `src/components/FormModoA.tsx` | **Modificar** — campo obrigatório + validação |
| `src/components/FormModoB.tsx` | **Modificar** — campo opcional |
| `server.ts` | **Modificar** — extrai `direcionamentoIA`, injeta no prompt |

---

## Contexto do Projeto

- Plataforma: Windows 11, Node.js em `C:\Program Files\nodejs`
- Sempre prefixar comandos npm com: `export PATH="/c/Program Files/nodejs:$PATH" && cd "/c/Users/Notebook/spectrum"`
- Sem repositório git — não há passos de commit
- `npm run lint` executa `tsc --noEmit`. Resultado esperado: **apenas os 2 erros pré-existentes em `src/lib/supabase.ts`** (Property 'env' does not exist on type 'ImportMeta'). Qualquer erro adicional indica regressão.
- Cores de marca: Ápice `#688D65`, Barbours `#BF0F26`

---

### Tarefa 1: Criar `DirecionamentoIAField.tsx`

**Arquivos:**
- Criar: `src/components/DirecionamentoIAField.tsx`

- [ ] **Passo 1: Criar o arquivo com o código completo**

Criar `src/components/DirecionamentoIAField.tsx` com o seguinte conteúdo:

```tsx
interface DirecionamentoIAFieldProps {
  label: string;
  required: boolean;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}

export default function DirecionamentoIAField({
  label,
  required,
  value,
  onChange,
  error,
}: DirecionamentoIAFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-slate-700">
        {label}
        {!required && (
          <span className="text-slate-400 font-normal text-xs ml-1">(Opcional)</span>
        )}
      </label>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-slate-200 text-slate-800 text-sm rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all resize-y"
      />
      {error && (
        <span className="text-xs text-rose-500">{error}</span>
      )}
    </div>
  );
}
```

- [ ] **Passo 2: Verificar lint**

```bash
export PATH="/c/Program Files/nodejs:$PATH" && cd "/c/Users/Notebook/spectrum" && npm run lint
```

Esperado: apenas os 2 erros pré-existentes de `supabase.ts`. Nenhum erro novo.

---

### Tarefa 2: Adicionar estado `direcionamentoIA` em `App.tsx`

**Arquivos:**
- Modificar: `src/App.tsx`

Esta tarefa faz 5 mudanças independentes no mesmo arquivo. Leia o arquivo antes de editar.

- [ ] **Passo 1: Adicionar estado após `aspectRatio` (linha 28)**

Localizar:
```tsx
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
```

Substituir por:
```tsx
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [direcionamentoIA, setDirecionamentoIA] = useState<string>('');
```

- [ ] **Passo 2: Incluir `direcionamentoIA` no body do POST do Modo A e limpar no sucesso**

Localizar (dentro de `handleFormASubmit`):
```tsx
        body: JSON.stringify({ modo: "A", input: inputA, aspectRatio }),
```

Substituir por:
```tsx
        body: JSON.stringify({ modo: "A", input: inputA, aspectRatio, direcionamentoIA }),
```

Em seguida, localizar o bloco de sucesso do Modo A (o `if (resData.status === "success"...)`):
```tsx
        const updated = [...resData.data, ...history];
        saveHistory(updated);
        
        // Abre o popup com a nova pauta imediatamente
        if (resData.data[0]) {
          setActivePreviewPauta(resData.data[0]);
        }
        
        // Redireciona para o histórico recém gerado
        setMainTab('historico');
```

Substituir por:
```tsx
        const updated = [...resData.data, ...history];
        saveHistory(updated);
        
        // Abre o popup com a nova pauta imediatamente
        if (resData.data[0]) {
          setActivePreviewPauta(resData.data[0]);
        }
        
        setDirecionamentoIA('');
        // Redireciona para o histórico recém gerado
        setMainTab('historico');
```

- [ ] **Passo 3: Incluir `direcionamentoIA` no body do POST do Modo B e limpar no sucesso**

Localizar (dentro de `handleFormBSubmit`):
```tsx
        body: JSON.stringify({ modo: "B", input: inputB, aspectRatio }),
```

Substituir por:
```tsx
        body: JSON.stringify({ modo: "B", input: inputB, aspectRatio, direcionamentoIA }),
```

Em seguida, localizar o bloco de sucesso do Modo B:
```tsx
        const updated = [...resData.data, ...history];
        saveHistory(updated);
        
        // Abre o popup com a nova pauta imediatamente
        if (resData.data[0]) {
          setActivePreviewPauta(resData.data[0]);
        }
        
        // Limpar preload de edição após submit bem sucedido
        setEditInputPreload(null);
        // Redireciona para o histórico recém gerado
        setMainTab('historico');
```

Substituir por:
```tsx
        const updated = [...resData.data, ...history];
        saveHistory(updated);
        
        // Abre o popup com a nova pauta imediatamente
        if (resData.data[0]) {
          setActivePreviewPauta(resData.data[0]);
        }
        
        setDirecionamentoIA('');
        // Limpar preload de edição após submit bem sucedido
        setEditInputPreload(null);
        // Redireciona para o histórico recém gerado
        setMainTab('historico');
```

- [ ] **Passo 4: Passar props para `FormModoA` (linha ~451)**

Localizar:
```tsx
                  <FormModoA
                    brand={currentBrand}
                    onSubmit={handleFormASubmit}
                    loading={loading}
                    aspectRatio={aspectRatio}
                    onAspectRatioChange={setAspectRatio}
                  />
```

Substituir por:
```tsx
                  <FormModoA
                    brand={currentBrand}
                    onSubmit={handleFormASubmit}
                    loading={loading}
                    aspectRatio={aspectRatio}
                    onAspectRatioChange={setAspectRatio}
                    direcionamentoIA={direcionamentoIA}
                    onDirecionamentoChange={setDirecionamentoIA}
                  />
```

- [ ] **Passo 5: Passar props para `FormModoB` (linha ~459)**

Localizar:
```tsx
                  <FormModoB
                    brand={currentBrand}
                    onSubmit={handleFormBSubmit}
                    loading={loading}
                    key={editInputPreload ? JSON.stringify(editInputPreload) : 'new'}
                    preload={editInputPreload}
                    aspectRatio={aspectRatio}
                    onAspectRatioChange={setAspectRatio}
                  />
```

Substituir por:
```tsx
                  <FormModoB
                    brand={currentBrand}
                    onSubmit={handleFormBSubmit}
                    loading={loading}
                    key={editInputPreload ? JSON.stringify(editInputPreload) : 'new'}
                    preload={editInputPreload}
                    aspectRatio={aspectRatio}
                    onAspectRatioChange={setAspectRatio}
                    direcionamentoIA={direcionamentoIA}
                    onDirecionamentoChange={setDirecionamentoIA}
                  />
```

- [ ] **Passo 6: Verificar lint**

```bash
export PATH="/c/Program Files/nodejs:$PATH" && cd "/c/Users/Notebook/spectrum" && npm run lint
```

Esperado: apenas os 2 erros pré-existentes de `supabase.ts`.

---

### Tarefa 3: Integrar campo em `FormModoA.tsx` (obrigatório)

**Arquivos:**
- Modificar: `src/components/FormModoA.tsx`

Leia o arquivo completo antes de começar. O arquivo tem 277 linhas.

- [ ] **Passo 1: Adicionar import do componente**

Localizar a linha de import do `AspectRatioSelector`:
```tsx
import AspectRatioSelector from "./AspectRatioSelector";
```

Substituir por:
```tsx
import AspectRatioSelector from "./AspectRatioSelector";
import DirecionamentoIAField from "./DirecionamentoIAField";
```

- [ ] **Passo 2: Estender a interface `FormModoAProps`**

Localizar:
```tsx
interface FormModoAProps {
  brand: Brand;
  onSubmit: (input: InputModoA) => void;
  loading: boolean;
  aspectRatio: string;
  onAspectRatioChange: (v: string) => void;
}
```

Substituir por:
```tsx
interface FormModoAProps {
  brand: Brand;
  onSubmit: (input: InputModoA) => void;
  loading: boolean;
  aspectRatio: string;
  onAspectRatioChange: (v: string) => void;
  direcionamentoIA: string;
  onDirecionamentoChange: (v: string) => void;
}
```

- [ ] **Passo 3: Adicionar novos parâmetros na assinatura da função**

Localizar:
```tsx
export default function FormModoA({ brand, onSubmit, loading, aspectRatio, onAspectRatioChange }: FormModoAProps) {
```

Substituir por:
```tsx
export default function FormModoA({ brand, onSubmit, loading, aspectRatio, onAspectRatioChange, direcionamentoIA, onDirecionamentoChange }: FormModoAProps) {
```

- [ ] **Passo 4: Adicionar estado local de erro do campo**

Localizar (linha ~51, após os outros useStates):
```tsx
  const [evitarMecanicas, setEvitarMecanicas] = useState<string[]>([]);
```

Substituir por:
```tsx
  const [evitarMecanicas, setEvitarMecanicas] = useState<string[]>([]);
  const [direcionamentoError, setDirecionamentoError] = useState<string>('');
```

- [ ] **Passo 5: Atualizar `handleSubmit` para validar o campo**

Localizar:
```tsx
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      marca: brand,
      quantidadePautas,
      contextoCampanha,
      segmentoAlvo,
      dataDisparo,
      tipoRecompensa,
      evitarMecanicas,
    });
  };
```

Substituir por:
```tsx
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (direcionamentoIA.trim() === '') {
      setDirecionamentoError('Preencha o direcionamento antes de gerar.');
      return;
    }
    onSubmit({
      marca: brand,
      quantidadePautas,
      contextoCampanha,
      segmentoAlvo,
      dataDisparo,
      tipoRecompensa,
      evitarMecanicas,
    });
  };
```

- [ ] **Passo 6: Inserir o campo no JSX entre "Quantidade de Pautas" e "Contexto de Campanha"**

Localizar o fechamento da seção de Quantidade de Pautas e a abertura da seção de Contexto (em torno das linhas 110-112):
```tsx
      </div>

      {/* Contexto da Campanha */}
```

Substituir por:
```tsx
      </div>

      <DirecionamentoIAField
        label="Direcionamento para a IA"
        required={true}
        value={direcionamentoIA}
        onChange={(v) => { setDirecionamentoError(''); onDirecionamentoChange(v); }}
        error={direcionamentoError}
      />

      {/* Contexto da Campanha */}
```

- [ ] **Passo 7: Atualizar a condição de `disabled` do botão de submit**

Localizar:
```tsx
        disabled={loading}
        className={`w-full py-4 text-sm font-bold tracking-wider uppercase rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
          loading 
            ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
            : brand === 'Apice'
              ? 'bg-[#688D65] hover:bg-[#52704f] text-white shadow-lg shadow-[#688D65]/20'
              : 'bg-[#BF0F26] hover:bg-[#990c1e] text-white shadow-lg shadow-[#BF0F26]/20'
        }`}
```

Substituir por:
```tsx
        disabled={loading || direcionamentoIA.trim() === ''}
        className={`w-full py-4 text-sm font-bold tracking-wider uppercase rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
          loading || direcionamentoIA.trim() === ''
            ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
            : brand === 'Apice'
              ? 'bg-[#688D65] hover:bg-[#52704f] text-white shadow-lg shadow-[#688D65]/20'
              : 'bg-[#BF0F26] hover:bg-[#990c1e] text-white shadow-lg shadow-[#BF0F26]/20'
        }`}
```

- [ ] **Passo 8: Verificar lint**

```bash
export PATH="/c/Program Files/nodejs:$PATH" && cd "/c/Users/Notebook/spectrum" && npm run lint
```

Esperado: apenas os 2 erros pré-existentes de `supabase.ts`.

---

### Tarefa 4: Integrar campo em `FormModoB.tsx` (opcional)

**Arquivos:**
- Modificar: `src/components/FormModoB.tsx`

Leia o arquivo completo antes de começar. O arquivo tem 278 linhas.

- [ ] **Passo 1: Adicionar import do componente**

Localizar:
```tsx
import AspectRatioSelector from "./AspectRatioSelector";
```

Substituir por:
```tsx
import AspectRatioSelector from "./AspectRatioSelector";
import DirecionamentoIAField from "./DirecionamentoIAField";
```

- [ ] **Passo 2: Estender a interface `FormModoBProps`**

Localizar:
```tsx
interface FormModoBProps {
  brand: Brand;
  onSubmit: (input: InputModoB) => void;
  loading: boolean;
  preload?: InputModoB | null;
  key?: string | number;
  aspectRatio: string;
  onAspectRatioChange: (v: string) => void;
}
```

Substituir por:
```tsx
interface FormModoBProps {
  brand: Brand;
  onSubmit: (input: InputModoB) => void;
  loading: boolean;
  preload?: InputModoB | null;
  key?: string | number;
  aspectRatio: string;
  onAspectRatioChange: (v: string) => void;
  direcionamentoIA: string;
  onDirecionamentoChange: (v: string) => void;
}
```

- [ ] **Passo 3: Adicionar novos parâmetros na assinatura da função**

Localizar:
```tsx
export default function FormModoB({ brand, onSubmit, loading, preload, aspectRatio, onAspectRatioChange }: FormModoBProps) {
```

Substituir por:
```tsx
export default function FormModoB({ brand, onSubmit, loading, preload, aspectRatio, onAspectRatioChange, direcionamentoIA, onDirecionamentoChange }: FormModoBProps) {
```

- [ ] **Passo 4: Inserir o campo no JSX após o cabeçalho e antes dos boxes**

Localizar o fechamento do cabeçalho do formulário e a abertura da div dos boxes (em torno das linhas 72-74):
```tsx
      </div>

      <div className="flex flex-col gap-5">
        {/* Box 1: Título do email (Assunto) */}
```

Substituir por:
```tsx
      </div>

      <DirecionamentoIAField
        label="Direcionamento para a IA"
        required={false}
        value={direcionamentoIA}
        onChange={onDirecionamentoChange}
      />

      <div className="flex flex-col gap-5">
        {/* Box 1: Título do email (Assunto) */}
```

- [ ] **Passo 5: Verificar lint**

```bash
export PATH="/c/Program Files/nodejs:$PATH" && cd "/c/Users/Notebook/spectrum" && npm run lint
```

Esperado: apenas os 2 erros pré-existentes de `supabase.ts`.

---

### Tarefa 5: Injetar `direcionamentoIA` no prompt em `server.ts`

**Arquivos:**
- Modificar: `server.ts` (linhas 83 e 188–209)

Leia o arquivo antes de editar. O arquivo tem 547 linhas.

- [ ] **Passo 1: Extrair `direcionamentoIA` do body do request (linha 83)**

Localizar:
```typescript
    const { modo, input, aspectRatio: rawAspectRatio } = req.body;
```

Substituir por:
```typescript
    const { modo, input, aspectRatio: rawAspectRatio, direcionamentoIA } = req.body;
    const direcStr = typeof direcionamentoIA === 'string' ? direcionamentoIA.trim() : '';
```

- [ ] **Passo 2: Substituir o bloco `promptModo` completo (linhas 188–209)**

Localizar o bloco inteiro:
```typescript
    const promptModo = modo === 'A' 
      ? `=== GERAÇÃO MODO A: DESCOBERTA LIVRE ===
O CRM Manager da marca ${marca} está solicitando a criação de até ${input.quantidadePautas || 3} ideias de pautas de CRM para preencher o cronograma.
Parâmetros recebidos:
- Quantidade requisitada: ${input.quantidadePautas || 3} pauta(s)
- Contexto da Campanha: ${input.contextoCampanha || 'Geral/Descobrimento'}
- Segmento Alvo: ${input.segmentoAlvo || 'Principal Padrão'}
- Data sugerida do Disparo: ${input.dataDisparo || 'Vazio (indicar recomendada)'}
- Tipo de Recompensa: ${input.tipoRecompensa || 'Selecionar com base em melhor performance'}
- Mecânicas a evitar recentemente: ${(input.evitarMecanicas || []).join(', ') || 'Nenhuma'}

Use o banco histórico da marca para priorizar os Hits históricos que performaram melhor para propor de forma calibrada.`
      : `=== GERAÇÃO MODO B: BRIEFING ASSISTIDO ===
O CRM Manager já possui conceitos parciais de briefing e deseja complementar e calibrar a estrutura de email em conformidade total com as boas práticas.
Boxes preenchidos pelo usuário (qualquer um vazio deve ser preenchido por você):
- Assunto desejado (boxTituloEmail): "${input.boxTituloEmail || 'Vazio (Gerar)'}"
- Sub-headline desejado (boxSubtituloEmail): "${input.boxSubtituloEmail || 'Vazio (Gerar)'}"
- Verbo do botão CTA (boxCta): "${input.boxCta || 'Vazio (Gerar)'}"
- Descrição da Mecânica / GIF desejado (boxMecanicaOuEstatico): "${input.boxMecanicaOuEstatico || 'Vazio (Gerar)'}"
- Recompensa pretendida (boxRecompensa): "${input.boxRecompensa || 'Vazio (Gerar)'}"

Se algum box preenchido violar as restrições estritas da marca (ex: palavra proibida, cor proibida, caps-lock ou tamanho incorreto de assunto), você DEVE preencher o copy gerado no padrão correto do Playbook, mantendo a ideia central do usuário mas corrigindo-a, e colocar obrigatoriamente um aviso de risco com a devida justificativa técnica no campo "riscos".`;
```

Substituir por (atenção: usa template literal aninhado para o bloco condicional do Modo B):
```typescript
    const direcBlocoModoA = `\n=== INSTRUÇÃO PRINCIPAL DO USUÁRIO (prioridade máxima sobre o histórico) ===\n"${direcStr}"\n\nTrate essa instrução como o objetivo central desta geração. Se ela conflitar com padrões do histórico de Hits (ex: histórico sugere conteúdos curtos mas o usuário pediu algo mais longo), siga a instrução do usuário.\n`;
    const direcBlocoModoB = direcStr ? `\n\n=== DIREÇÃO MACRO DO BRIEFING (orientação geral do usuário) ===\n"${direcStr}"\n\nUse essa direção para orientar o preenchimento dos boxes vazios e o refinamento dos boxes preenchidos.\nREGRA DE CONFLITO: Se essa direção conflitar com o conteúdo de um box preenchido pelo usuário, respeite o conteúdo literal do box (ele foi digitado explicitamente) e aplique esta direção apenas nos boxes que você gerar do zero.` : '';

    const promptModo = modo === 'A'
      ? `=== GERAÇÃO MODO A: DESCOBERTA LIVRE ===${direcBlocoModoA}
O CRM Manager da marca ${marca} está solicitando a criação de até ${input.quantidadePautas || 3} ideias de pautas de CRM para preencher o cronograma.
Parâmetros recebidos:
- Quantidade requisitada: ${input.quantidadePautas || 3} pauta(s)
- Contexto da Campanha: ${input.contextoCampanha || 'Geral/Descobrimento'}
- Segmento Alvo: ${input.segmentoAlvo || 'Principal Padrão'}
- Data sugerida do Disparo: ${input.dataDisparo || 'Vazio (indicar recomendada)'}
- Tipo de Recompensa: ${input.tipoRecompensa || 'Selecionar com base em melhor performance'}
- Mecânicas a evitar recentemente: ${(input.evitarMecanicas || []).join(', ') || 'Nenhuma'}

Use o banco histórico da marca para priorizar os Hits históricos que performaram melhor para propor de forma calibrada.`
      : `=== GERAÇÃO MODO B: BRIEFING ASSISTIDO ===${direcBlocoModoB}
O CRM Manager já possui conceitos parciais de briefing e deseja complementar e calibrar a estrutura de email em conformidade total com as boas práticas.
Boxes preenchidos pelo usuário (qualquer um vazio deve ser preenchido por você):
- Assunto desejado (boxTituloEmail): "${input.boxTituloEmail || 'Vazio (Gerar)'}"
- Sub-headline desejado (boxSubtituloEmail): "${input.boxSubtituloEmail || 'Vazio (Gerar)'}"
- Verbo do botão CTA (boxCta): "${input.boxCta || 'Vazio (Gerar)'}"
- Descrição da Mecânica / GIF desejado (boxMecanicaOuEstatico): "${input.boxMecanicaOuEstatico || 'Vazio (Gerar)'}"
- Recompensa pretendida (boxRecompensa): "${input.boxRecompensa || 'Vazio (Gerar)'}"

Se algum box preenchido violar as restrições estritas da marca (ex: palavra proibida, cor proibida, caps-lock ou tamanho incorreto de assunto), você DEVE preencher o copy gerado no padrão correto do Playbook, mantendo a ideia central do usuário mas corrigindo-a, e colocar obrigatoriamente um aviso de risco com a devida justificativa técnica no campo "riscos".`;
```

- [ ] **Passo 3: Verificar lint**

```bash
export PATH="/c/Program Files/nodejs:$PATH" && cd "/c/Users/Notebook/spectrum" && npm run lint
```

Esperado: apenas os 2 erros pré-existentes de `supabase.ts`.

- [ ] **Passo 4: Smoke test — iniciar o servidor e verificar visualmente**

Matar qualquer processo Node.js existente e subir o servidor:

```bash
taskkill //F //IM node.exe 2>/dev/null; export PATH="/c/Program Files/nodejs:$PATH" && cd "/c/Users/Notebook/spectrum" && npm run dev
```

Aguardar as mensagens de boot:
```
[Supabase] 17 disparos históricos carregados.
[Express Server] Iniciado em http://localhost:3000
```

Abrir http://localhost:3000 no browser e verificar:

1. **Modo A:** campo "Direcionamento para a IA" aparece entre o slider de quantidade e os chips de Contexto de Campanha. Sem placeholder. Label sem "(Opcional)".
2. **Modo A:** botão "Sugerir Pautas" fica cinza/desabilitado com o campo vazio. Ao digitar qualquer texto, o botão ativa.
3. **Modo A:** apagar o texto → botão desabilita novamente.
4. **Modo B:** campo "Direcionamento para a IA (Opcional)" aparece logo após o parágrafo descritivo do modo e antes do Box 1: Assunto do Email.
5. **Modo B:** botão "Completar e Fechar Pauta" funciona normalmente mesmo com o campo de direcionamento vazio.
