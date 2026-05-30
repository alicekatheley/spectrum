# 4-Attribute Metadata & Cascading Filters — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `tipoGeracao` as the 4th pauta attribute, expose a shared `TipoGeracaoSelector` in both forms, and restructure the Histórico screen with 4 cascading filter rows, conditional KPI cards, and metadata badges on every pauta card.

**Architecture:** `tipoGeracao` state lives in `App.tsx` (mirrors `aspectRatio` pattern). DB gains a single `tipo_geracao` column DEFAULT `'texto_imagem'`. Server echoes the field back in the response. `HistoryList` receives all 4 filter states as props from `App.tsx`; filtering is computed once in `App.tsx` via a `filteredHistory` variable. Old pautas in localStorage are normalized to `'texto_imagem'` on init.

**Tech Stack:** React 19 + TypeScript + Tailwind CSS + Express + Supabase (PostgreSQL) + Lucide icons

---

## Audit Results (confirmed before writing this plan)

| Attribute | Status |
|---|---|
| Marca | ✅ Already saved — `marca` column, mapped in service, sent by server |
| Modo | ✅ Already saved — `modo` column, server sets `modo === 'B' ? 'B' : 'A'` |
| Status | ✅ Already saved — `status` column DEFAULT `'rascunho'`, promoted via `handleApprovePauta` |
| Tipo geração | ❌ Missing — needs everything from scratch |

---

## Files

| File | Change |
|---|---|
| `supabase/migrations/20260528000001_add_tipo_geracao.sql` | **New** |
| `src/types.ts` | Add `tipoGeracao` to `PautaGerada` |
| `src/lib/pautas-service.ts` | Map `tipo_geracao` ↔ `tipoGeracao` in `fromDb`/`toDb` |
| `src/components/TipoGeracaoSelector.tsx` | **New** — shared 3-card selector |
| `src/App.tsx` | `tipoGeracao`, `modoFilter`, `tipoGeracaoFilter` states; `filteredHistory`; form props; POST bodies; `handleClearFilters`; localStorage normalization |
| `src/components/FormModoA.tsx` | New props + `TipoGeracaoSelector` |
| `src/components/FormModoB.tsx` | New props + `TipoGeracaoSelector` + conditional box disabling |
| `server.ts` | Extract + validate + echo `tipoGeracao` |
| `src/components/HistoryList.tsx` | 4-row cascading filters; conditional KPI section; `onClearFilters` prop |
| `src/components/ResultPauta.tsx` | 4 metadata badges; conditional left/right column visibility |

---

### Task 1: DB migration + types + service mapping

**Files:**
- Create: `supabase/migrations/20260528000001_add_tipo_geracao.sql`
- Modify: `src/types.ts`
- Modify: `src/lib/pautas-service.ts`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/20260528000001_add_tipo_geracao.sql` with this exact content:

```sql
ALTER TABLE pautas_geradas
  ADD COLUMN IF NOT EXISTS tipo_geracao text NOT NULL DEFAULT 'texto_imagem'
  CHECK (tipo_geracao IN ('texto', 'imagem', 'texto_imagem'));
```

- [ ] **Step 2: Add `tipoGeracao` to `PautaGerada` in `src/types.ts`**

The current `PautaGerada` interface at lines 95–106 is:

```typescript
export interface PautaGerada {
  id: string;
  marca: Brand;
  modo: 'A' | 'B';
  copy: PautaCopy;
  visual: PautaVisual;
  operacional: PautaOperacional;
  previsao: PerformancePrevisao;
  riscos: RiscoAlerta[];
  status: 'rascunho' | 'aprovado' | 'descartado';
  dataCriacao: string;
}
```

Replace with:

```typescript
export interface PautaGerada {
  id: string;
  marca: Brand;
  modo: 'A' | 'B';
  tipoGeracao: 'texto' | 'imagem' | 'texto_imagem';
  copy: PautaCopy;
  visual: PautaVisual;
  operacional: PautaOperacional;
  previsao: PerformancePrevisao;
  riscos: RiscoAlerta[];
  status: 'rascunho' | 'aprovado' | 'descartado';
  dataCriacao: string;
}
```

- [ ] **Step 3: Update `fromDb` in `src/lib/pautas-service.ts`**

Current `fromDb` (lines 5–18):

```typescript
function fromDb(row: Record<string, unknown>): PautaGerada {
  return {
    id: row.id as string,
    marca: row.marca as PautaGerada['marca'],
    modo: row.modo as PautaGerada['modo'],
    copy: row.copy as PautaGerada['copy'],
    visual: row.visual as PautaGerada['visual'],
    operacional: row.operacional as PautaGerada['operacional'],
    previsao: row.previsao as PautaGerada['previsao'],
    riscos: (row.riscos as PautaGerada['riscos']) || [],
    status: row.status as PautaGerada['status'],
    dataCriacao: (row.data_criacao ?? row.dataCriacao) as string,
  };
}
```

Replace with:

```typescript
function fromDb(row: Record<string, unknown>): PautaGerada {
  return {
    id: row.id as string,
    marca: row.marca as PautaGerada['marca'],
    modo: row.modo as PautaGerada['modo'],
    tipoGeracao: ((row.tipo_geracao ?? 'texto_imagem') as PautaGerada['tipoGeracao']),
    copy: row.copy as PautaGerada['copy'],
    visual: row.visual as PautaGerada['visual'],
    operacional: row.operacional as PautaGerada['operacional'],
    previsao: row.previsao as PautaGerada['previsao'],
    riscos: (row.riscos as PautaGerada['riscos']) || [],
    status: row.status as PautaGerada['status'],
    dataCriacao: (row.data_criacao ?? row.dataCriacao) as string,
  };
}
```

- [ ] **Step 4: Update `toDb` in `src/lib/pautas-service.ts`**

Current `toDb` (lines 21–33):

```typescript
function toDb(p: PautaGerada) {
  return {
    id: p.id,
    marca: p.marca,
    modo: p.modo,
    copy: p.copy,
    visual: p.visual,
    operacional: p.operacional,
    previsao: p.previsao,
    riscos: p.riscos,
    status: p.status,
    data_criacao: p.dataCriacao,
  };
}
```

Replace with:

```typescript
function toDb(p: PautaGerada) {
  return {
    id: p.id,
    marca: p.marca,
    modo: p.modo,
    tipo_geracao: p.tipoGeracao,
    copy: p.copy,
    visual: p.visual,
    operacional: p.operacional,
    previsao: p.previsao,
    riscos: p.riscos,
    status: p.status,
    data_criacao: p.dataCriacao,
  };
}
```

- [ ] **Step 5: Verify lint**

Run:
```bash
export PATH="/c/Program Files/nodejs:$PATH" && cd "/c/Users/Notebook/spectrum" && npm run lint
```

Expected: Only 2 pre-existing errors (unrelated to this feature). No new errors.

---

### Task 2: TipoGeracaoSelector component

**Files:**
- Create: `src/components/TipoGeracaoSelector.tsx`

- [ ] **Step 1: Create `src/components/TipoGeracaoSelector.tsx`**

```tsx
import React from "react";
import { FileText, Image, Layers } from "lucide-react";
import { Brand } from "../types";

type TipoGeracao = 'texto' | 'imagem' | 'texto_imagem';

interface TipoGeracaoSelectorProps {
  value: TipoGeracao;
  onChange: (v: TipoGeracao) => void;
  brand: Brand;
}

const OPTIONS: Array<{
  value: TipoGeracao;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}> = [
  { value: 'texto_imagem', label: 'Texto + Imagem', description: 'Gera copy e briefing visual', Icon: Layers },
  { value: 'texto', label: 'Apenas Texto', description: 'Só copy — sem imagem', Icon: FileText },
  { value: 'imagem', label: 'Apenas Imagem', description: 'Só visual — sem copy', Icon: Image },
];

export default function TipoGeracaoSelector({ value, onChange, brand }: TipoGeracaoSelectorProps) {
  const brandColor = brand === 'Apice' ? '#688D65' : '#BF0F26';

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-slate-700">
        Tipo de Geração
      </span>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map(({ value: v, label, description, Icon }) => {
          const isSelected = value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={`p-3 rounded-xl border-2 flex flex-col items-start gap-1.5 text-left transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-slate-50 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
              style={isSelected ? { borderColor: brandColor } : {}}
            >
              <Icon
                className="w-4 h-4"
                style={{ color: isSelected ? brandColor : '#94a3b8' }}
              />
              <span className="text-xs font-bold text-slate-700 leading-tight">{label}</span>
              <span className="text-[10px] text-slate-400 leading-tight">{description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify lint**

Run:
```bash
export PATH="/c/Program Files/nodejs:$PATH" && cd "/c/Users/Notebook/spectrum" && npm run lint
```

Expected: No new errors.

---

### Task 3: App.tsx — new states + filter wiring + POST bodies

**Files:**
- Modify: `src/App.tsx`

Context: This file currently has `brandFilter`/`statusFilter` states, `handleFormASubmit`/`handleFormBSubmit` that POST to `/api/generate-pauta`, and inline filter logic in the history rendering. All changes below are additive and follow existing patterns.

- [ ] **Step 1: Add `tipoGeracao`, `modoFilter`, `tipoGeracaoFilter` states**

Find this block (around lines 22–29):
```tsx
  // Estados para Filtros de Histórico
  const [brandFilter, setBrandFilter] = useState<"all" | "Apice" | "Barbours">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "rascunho" | "aprovado" | "descartado">("all");

  // Estado para preencher formulário do Modo B quando for solicitado Editar pauta
  const [editInputPreload, setEditInputPreload] = useState<InputModoB | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [direcionamentoIA, setDirecionamentoIA] = useState<string>('');
```

Replace with:
```tsx
  // Estados para Filtros de Histórico
  const [brandFilter, setBrandFilter] = useState<"all" | "Apice" | "Barbours">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "rascunho" | "aprovado" | "descartado">("all");
  const [modoFilter, setModoFilter] = useState<"all" | "A" | "B">("all");
  const [tipoGeracaoFilter, setTipoGeracaoFilter] = useState<"all" | "texto" | "imagem" | "texto_imagem">("all");

  // Estado para preencher formulário do Modo B quando for solicitado Editar pauta
  const [editInputPreload, setEditInputPreload] = useState<InputModoB | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [direcionamentoIA, setDirecionamentoIA] = useState<string>('');
  const [tipoGeracao, setTipoGeracao] = useState<'texto' | 'imagem' | 'texto_imagem'>('texto_imagem');
```

- [ ] **Step 2: Add localStorage normalization in `init` function**

Find in the `useEffect` init function (around lines 39–50):
```tsx
        try {
          const stored = localStorage.getItem("crm_pautas_history");
          if (stored) {
            const local: PautaGerada[] = JSON.parse(stored);
            setHistory(local);
            // Migra dados locais para o Supabase na primeira vez
            if (local.length > 0) {
              upsertPautas(local).catch(err =>
                console.warn("[Supabase] Migração inicial falhou:", err)
              );
            }
          }
```

Replace with:
```tsx
        try {
          const stored = localStorage.getItem("crm_pautas_history");
          if (stored) {
            const raw: PautaGerada[] = JSON.parse(stored);
            // Normalize old records that predate the tipoGeracao field
            const local = raw.map(p => ({
              ...p,
              tipoGeracao: (p.tipoGeracao ?? 'texto_imagem') as PautaGerada['tipoGeracao'],
            }));
            setHistory(local);
            // Migra dados locais para o Supabase na primeira vez
            if (local.length > 0) {
              upsertPautas(local).catch(err =>
                console.warn("[Supabase] Migração inicial falhou:", err)
              );
            }
          }
```

- [ ] **Step 3: Add `tipoGeracao` to both POST bodies**

Find in `handleFormASubmit` (around line 80):
```tsx
        body: JSON.stringify({ modo: "A", input: inputA, aspectRatio, direcionamentoIA }),
```
Replace with:
```tsx
        body: JSON.stringify({ modo: "A", input: inputA, aspectRatio, direcionamentoIA, tipoGeracao }),
```

Find in `handleFormBSubmit` (around line 113):
```tsx
        body: JSON.stringify({ modo: "B", input: inputB, aspectRatio, direcionamentoIA }),
```
Replace with:
```tsx
        body: JSON.stringify({ modo: "B", input: inputB, aspectRatio, direcionamentoIA, tipoGeracao }),
```

- [ ] **Step 4: Add `handleClearFilters` function**

Add this function after `handleClearHistory` (around line 225):
```tsx
  const handleClearFilters = () => {
    setBrandFilter("all");
    setModoFilter("all");
    setTipoGeracaoFilter("all");
    setStatusFilter("all");
  };
```

- [ ] **Step 5: Extract `filteredHistory` computed variable**

Find the start of the history tab rendering section — the `historySubTab === 'planner'` block (around line 497). Add this computed variable BEFORE the JSX return (above the `return (` at line 253, or just before the `{mainTab === 'historico' ? (` block at line 481):

Add as a computed variable right after all the handler function definitions and before the `return (`:
```tsx
  const filteredHistory = history.filter((p) => {
    const matchBrand = brandFilter === "all" || p.marca === brandFilter;
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchModo = modoFilter === "all" || p.modo === modoFilter;
    const matchTipo = tipoGeracaoFilter === "all" || (p.tipoGeracao ?? 'texto_imagem') === tipoGeracaoFilter;
    return matchBrand && matchStatus && matchModo && matchTipo;
  });
```

- [ ] **Step 6: Replace the WeeklyPlanner inline filter with `filteredHistory`**

Find (around line 498):
```tsx
              <WeeklyPlanner 
                pautas={history.filter((p) => {
                  const matchBrand = brandFilter === "all" || p.marca === brandFilter;
                  const matchStatus = statusFilter === "all" || p.status === statusFilter;
                  return matchBrand && matchStatus;
                })}
```
Replace with:
```tsx
              <WeeklyPlanner 
                pautas={filteredHistory}
```

- [ ] **Step 7: Replace the lista inline filter and add zero-results state**

Find (around lines 509–527):
```tsx
              {history
                .filter((p) => {
                  const matchBrand = brandFilter === "all" || p.marca === brandFilter;
                  const matchStatus = statusFilter === "all" || p.status === statusFilter;
                  return matchBrand && matchStatus;
                })
                .map((pauta) => (
                  <ResultPauta
                    key={pauta.id}
                    pauta={pauta}
                    onApprove={handleApprovePauta}
                    onDiscard={handleDiscardPauta}
                    onGenerateVariation={handleGenerateVariation}
                    onEdit={() => handleEditPauta(pauta.id)}
                    onOpenPreview={setActivePreviewPauta}
                    aspectRatio={aspectRatio}
                  />
                ))}

              {history.length === 0 && (
```

Replace with:
```tsx
              {filteredHistory.map((pauta) => (
                <ResultPauta
                  key={pauta.id}
                  pauta={pauta}
                  onApprove={handleApprovePauta}
                  onDiscard={handleDiscardPauta}
                  onGenerateVariation={handleGenerateVariation}
                  onEdit={() => handleEditPauta(pauta.id)}
                  onOpenPreview={setActivePreviewPauta}
                  aspectRatio={aspectRatio}
                />
              ))}

              {filteredHistory.length === 0 && history.length > 0 && (
                <div className="bg-slate-900/30 text-center py-12 px-8 border border-slate-800 border-dashed rounded-[2.5rem] text-slate-400 max-w-2xl mx-auto w-full">
                  <span className="text-3xl mb-3 block">🔍</span>
                  <h4 className="text-base font-bold text-slate-200">Nenhuma pauta encontrada com esses filtros</h4>
                  <p className="text-sm text-slate-400 mt-1 mb-4">Tente ajustar os filtros acima ou limpe para ver todas as pautas.</p>
                  <button
                    onClick={handleClearFilters}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Limpar filtros
                  </button>
                </div>
              )}

              {history.length === 0 && (
```

- [ ] **Step 8: Pass new props to `HistoryList` JSX**

Find the `<HistoryList` JSX block (around lines 485–494):
```tsx
            <HistoryList
              history={history}
              onClearHistory={handleClearHistory}
              brandFilter={brandFilter}
              setBrandFilter={setBrandFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              historySubTab={historySubTab}
              setHistorySubTab={setHistorySubTab}
            />
```
Replace with:
```tsx
            <HistoryList
              history={history}
              onClearHistory={handleClearHistory}
              brandFilter={brandFilter}
              setBrandFilter={setBrandFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              modoFilter={modoFilter}
              setModoFilter={setModoFilter}
              tipoGeracaoFilter={tipoGeracaoFilter}
              setTipoGeracaoFilter={setTipoGeracaoFilter}
              onClearFilters={handleClearFilters}
              historySubTab={historySubTab}
              setHistorySubTab={setHistorySubTab}
            />
```

- [ ] **Step 9: Pass `tipoGeracao` + `onTipoGeracaoChange` to `FormModoA`**

Find the `<FormModoA` JSX block (around lines 454–462):
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
Replace with:
```tsx
                  <FormModoA
                    brand={currentBrand}
                    onSubmit={handleFormASubmit}
                    loading={loading}
                    aspectRatio={aspectRatio}
                    onAspectRatioChange={setAspectRatio}
                    direcionamentoIA={direcionamentoIA}
                    onDirecionamentoChange={setDirecionamentoIA}
                    tipoGeracao={tipoGeracao}
                    onTipoGeracaoChange={setTipoGeracao}
                  />
```

- [ ] **Step 10: Pass `tipoGeracao` + `onTipoGeracaoChange` to `FormModoB`**

Find the `<FormModoB` JSX block (around lines 463–475):
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
Replace with:
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
                    tipoGeracao={tipoGeracao}
                    onTipoGeracaoChange={setTipoGeracao}
                  />
```

- [ ] **Step 11: Verify lint**

Run:
```bash
export PATH="/c/Program Files/nodejs:$PATH" && cd "/c/Users/Notebook/spectrum" && npm run lint
```

Expected: New TypeScript errors will appear for `FormModoA`, `FormModoB`, and `HistoryList` because those components don't have the new props yet. That's expected — they'll be resolved in Tasks 4, 5, and 7. There should be no new errors for `App.tsx` itself.

---

### Task 4: FormModoA — TipoGeracaoSelector integration

**Files:**
- Modify: `src/components/FormModoA.tsx`

- [ ] **Step 1: Add import and extend the interface**

Find (lines 1–15):
```tsx
import React, { useState } from "react";
import { Brand, CampaignContext, RewardType, InputModoA } from "../types";
import { Calendar, Layers, Gift, AlertCircle, RefreshCw, HelpCircle } from "lucide-react";
import AspectRatioSelector from "./AspectRatioSelector";
import DirecionamentoIAField from "./DirecionamentoIAField";

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

Replace with:
```tsx
import React, { useState } from "react";
import { Brand, CampaignContext, RewardType, InputModoA } from "../types";
import { Calendar, Layers, Gift, AlertCircle, RefreshCw, HelpCircle } from "lucide-react";
import AspectRatioSelector from "./AspectRatioSelector";
import DirecionamentoIAField from "./DirecionamentoIAField";
import TipoGeracaoSelector from "./TipoGeracaoSelector";

interface FormModoAProps {
  brand: Brand;
  onSubmit: (input: InputModoA) => void;
  loading: boolean;
  aspectRatio: string;
  onAspectRatioChange: (v: string) => void;
  direcionamentoIA: string;
  onDirecionamentoChange: (v: string) => void;
  tipoGeracao: 'texto' | 'imagem' | 'texto_imagem';
  onTipoGeracaoChange: (v: 'texto' | 'imagem' | 'texto_imagem') => void;
}
```

- [ ] **Step 2: Add `tipoGeracao` and `onTipoGeracaoChange` to the destructured props**

Find (line 48):
```tsx
export default function FormModoA({ brand, onSubmit, loading, aspectRatio, onAspectRatioChange, direcionamentoIA, onDirecionamentoChange }: FormModoAProps) {
```
Replace with:
```tsx
export default function FormModoA({ brand, onSubmit, loading, aspectRatio, onAspectRatioChange, direcionamentoIA, onDirecionamentoChange, tipoGeracao, onTipoGeracaoChange }: FormModoAProps) {
```

- [ ] **Step 3: Insert `TipoGeracaoSelector` between `DirecionamentoIAField` and Contexto de Campanha**

Find (lines 120–129):
```tsx
      <DirecionamentoIAField
        label="Direcionamento para a IA"
        required={true}
        value={direcionamentoIA}
        onChange={(v) => { setDirecionamentoError(''); onDirecionamentoChange(v); }}
        error={direcionamentoError}
      />

      {/* Contexto da Campanha */}
```
Replace with:
```tsx
      <DirecionamentoIAField
        label="Direcionamento para a IA"
        required={true}
        value={direcionamentoIA}
        onChange={(v) => { setDirecionamentoError(''); onDirecionamentoChange(v); }}
        error={direcionamentoError}
      />

      <TipoGeracaoSelector
        value={tipoGeracao}
        onChange={onTipoGeracaoChange}
        brand={brand}
      />

      {/* Contexto da Campanha */}
```

- [ ] **Step 4: Verify lint**

Run:
```bash
export PATH="/c/Program Files/nodejs:$PATH" && cd "/c/Users/Notebook/spectrum" && npm run lint
```

Expected: No new errors for FormModoA. Errors for FormModoB and HistoryList will still be present (they are resolved in Tasks 5 and 7).

---

### Task 5: FormModoB — TipoGeracaoSelector + conditional box disabling

**Files:**
- Modify: `src/components/FormModoB.tsx`

Context: The form has 5 boxes. When `tipoGeracao === 'texto'`, Box 4 (Mecânica do GIF) is disabled. When `tipoGeracao === 'imagem'`, Boxes 1, 2, 3, 5 (text boxes) are disabled. Disabled boxes get `opacity-50 pointer-events-none` on their outer wrapper div plus a one-line italic note.

- [ ] **Step 1: Add import and extend the interface**

Find (lines 1–17):
```tsx
import React, { useState } from "react";
import { Brand, InputModoB } from "../types";
import { Sparkles, Trash2, ShieldAlert, Eye, RefreshCw } from "lucide-react";
import AspectRatioSelector from "./AspectRatioSelector";
import DirecionamentoIAField from "./DirecionamentoIAField";

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
Replace with:
```tsx
import React, { useState } from "react";
import { Brand, InputModoB } from "../types";
import { Sparkles, Trash2, ShieldAlert, Eye, RefreshCw } from "lucide-react";
import AspectRatioSelector from "./AspectRatioSelector";
import DirecionamentoIAField from "./DirecionamentoIAField";
import TipoGeracaoSelector from "./TipoGeracaoSelector";

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
  tipoGeracao: 'texto' | 'imagem' | 'texto_imagem';
  onTipoGeracaoChange: (v: 'texto' | 'imagem' | 'texto_imagem') => void;
}
```

- [ ] **Step 2: Add new props to destructuring**

Find (line 19):
```tsx
export default function FormModoB({ brand, onSubmit, loading, preload, aspectRatio, onAspectRatioChange, direcionamentoIA, onDirecionamentoChange }: FormModoBProps) {
```
Replace with:
```tsx
export default function FormModoB({ brand, onSubmit, loading, preload, aspectRatio, onAspectRatioChange, direcionamentoIA, onDirecionamentoChange, tipoGeracao, onTipoGeracaoChange }: FormModoBProps) {
```

- [ ] **Step 3: Insert `TipoGeracaoSelector` after `DirecionamentoIAField` and before the boxes div**

Find (lines 77–84):
```tsx
      <DirecionamentoIAField
        label="Direcionamento para a IA"
        required={false}
        value={direcionamentoIA}
        onChange={onDirecionamentoChange}
      />

      <div className="flex flex-col gap-5">
```
Replace with:
```tsx
      <DirecionamentoIAField
        label="Direcionamento para a IA"
        required={false}
        value={direcionamentoIA}
        onChange={onDirecionamentoChange}
      />

      <TipoGeracaoSelector
        value={tipoGeracao}
        onChange={onTipoGeracaoChange}
        brand={brand}
      />

      <div className="flex flex-col gap-5">
```

- [ ] **Step 4: Disable Box 1 (Assunto) when `tipoGeracao === 'imagem'`**

Find the Box 1 outer div opening tag (around line 86):
```tsx
        {/* Box 1: Título do email (Assunto) */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2 relative">
```
Replace with:
```tsx
        {/* Box 1: Título do email (Assunto) */}
        <div className={`bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2 relative ${tipoGeracao === 'imagem' ? 'opacity-50 pointer-events-none' : ''}`}>
```

Add warning note just before the closing `</div>` of Box 1's container (right before the next `{/* Box 2 */}` comment). The closing tag of Box 1 is after `isAssuntoViolandoTamanho` alert div at around line 134. Add before that closing `</div>`:
```tsx
          {tipoGeracao === 'imagem' && (
            <p className="text-[10px] text-slate-500 italic">Selecionado modo Apenas Imagem — copy não será gerado</p>
          )}
```

- [ ] **Step 5: Disable Box 2 (Sub-headline) when `tipoGeracao === 'imagem'`**

Find Box 2 outer div opening:
```tsx
        {/* Box 2: Sub-título do email */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2 relative">
```
Replace with:
```tsx
        {/* Box 2: Sub-título do email */}
        <div className={`bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2 relative ${tipoGeracao === 'imagem' ? 'opacity-50 pointer-events-none' : ''}`}>
```

Add before Box 2's closing `</div>` (just before `{/* Box 3 */}`):
```tsx
          {tipoGeracao === 'imagem' && (
            <p className="text-[10px] text-slate-500 italic">Selecionado modo Apenas Imagem — copy não será gerado</p>
          )}
```

- [ ] **Step 6: Disable Box 3 (CTA) when `tipoGeracao === 'imagem'`**

Find Box 3 outer div opening:
```tsx
        {/* Box 3: Verbo CTA do botão */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2 relative">
```
Replace with:
```tsx
        {/* Box 3: Verbo CTA do botão */}
        <div className={`bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2 relative ${tipoGeracao === 'imagem' ? 'opacity-50 pointer-events-none' : ''}`}>
```

Add before Box 3's closing `</div>` (just before `{/* Box 4 */}`):
```tsx
          {tipoGeracao === 'imagem' && (
            <p className="text-[10px] text-slate-500 italic">Selecionado modo Apenas Imagem — copy não será gerado</p>
          )}
```

- [ ] **Step 7: Disable Box 4 (Mecânica visual) when `tipoGeracao === 'texto'`**

Find Box 4 outer div opening:
```tsx
        {/* Box 4: Mecânica / GIF animado */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2 relative">
```
Replace with:
```tsx
        {/* Box 4: Mecânica / GIF animado */}
        <div className={`bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2 relative ${tipoGeracao === 'texto' ? 'opacity-50 pointer-events-none' : ''}`}>
```

Add before Box 4's closing `</div>` (just before `{/* Box 5 */}`):
```tsx
          {tipoGeracao === 'texto' && (
            <p className="text-[10px] text-slate-500 italic">Selecionado modo Apenas Texto — mecânica visual não será gerada</p>
          )}
```

- [ ] **Step 8: Disable Box 5 (Recompensa) when `tipoGeracao === 'imagem'`**

Find Box 5 outer div opening:
```tsx
        {/* Box 5: Recompensa */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2 relative">
```
Replace with:
```tsx
        {/* Box 5: Recompensa */}
        <div className={`bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2 relative ${tipoGeracao === 'imagem' ? 'opacity-50 pointer-events-none' : ''}`}>
```

Add before Box 5's closing `</div>` (just before `</div>` that closes the `flex flex-col gap-5` boxes container):
```tsx
          {tipoGeracao === 'imagem' && (
            <p className="text-[10px] text-slate-500 italic">Selecionado modo Apenas Imagem — copy não será gerado</p>
          )}
```

- [ ] **Step 9: Verify lint**

Run:
```bash
export PATH="/c/Program Files/nodejs:$PATH" && cd "/c/Users/Notebook/spectrum" && npm run lint
```

Expected: No new errors for FormModoB. Only HistoryList errors remain.

---

### Task 6: server.ts — tipoGeracao extraction + response

**Files:**
- Modify: `server.ts`

- [ ] **Step 1: Destructure `tipoGeracao` from request body**

Find (line 83):
```typescript
    const { modo, input, aspectRatio: rawAspectRatio, direcionamentoIA } = req.body;
```
Replace with:
```typescript
    const { modo, input, aspectRatio: rawAspectRatio, direcionamentoIA, tipoGeracao: rawTipoGeracao } = req.body;
```

- [ ] **Step 2: Validate `tipoGeracao` immediately after the existing `aspectRatio` validation**

Find (around lines 90–91):
```typescript
    const VALID_RATIOS = ['1:1', '3:4', '16:9', '9:16', '4:3'];
    const aspectRatio = VALID_RATIOS.includes(rawAspectRatio) ? rawAspectRatio : '1:1';
```
Replace with:
```typescript
    const VALID_RATIOS = ['1:1', '3:4', '16:9', '9:16', '4:3'];
    const aspectRatio = VALID_RATIOS.includes(rawAspectRatio) ? rawAspectRatio : '1:1';
    const VALID_TIPO = ['texto', 'imagem', 'texto_imagem'];
    const tipoGeracao = VALID_TIPO.includes(rawTipoGeracao) ? rawTipoGeracao : 'texto_imagem';
```

- [ ] **Step 3: Include `tipoGeracao` in the response object**

Find the return object inside the `pautasProps.map` (around lines 387–398):
```typescript
      return {
        id: `pauta-${Date.now()}-${index}`,
        marca,
        modo: modo === 'B' ? 'B' : 'A',
        copy: p.copy,
        visual: p.visual,
        operacional: p.operacional,
        previsao: p.previsao,
        riscos: risksUnique(riscosFinais),
        status: 'rascunho',
        dataCriacao: new Date().toISOString()
      };
```
Replace with:
```typescript
      return {
        id: `pauta-${Date.now()}-${index}`,
        marca,
        modo: modo === 'B' ? 'B' : 'A',
        tipoGeracao,
        copy: p.copy,
        visual: p.visual,
        operacional: p.operacional,
        previsao: p.previsao,
        riscos: risksUnique(riscosFinais),
        status: 'rascunho',
        dataCriacao: new Date().toISOString()
      };
```

- [ ] **Step 4: Verify lint**

Run:
```bash
export PATH="/c/Program Files/nodejs:$PATH" && cd "/c/Users/Notebook/spectrum" && npm run lint
```

Expected: No new errors.

---

### Task 7: HistoryList — 4-row cascading filters + conditional KPI section

**Files:**
- Modify: `src/components/HistoryList.tsx`

Context: This file currently receives `brandFilter`/`statusFilter` and renders 2 filter groups plus KPI cards. Replace the filter section with 4 labeled rows; hide the KPI grid + export button when `brandFilter !== 'all'`; add `onClearFilters` button when any filter is active.

- [ ] **Step 1: Update the `HistoryListProps` interface**

Find (lines 6–15):
```typescript
interface HistoryListProps {
  history: PautaGerada[];
  onClearHistory: () => void;
  brandFilter: "all" | "Apice" | "Barbours";
  setBrandFilter: (brand: "all" | "Apice" | "Barbours") => void;
  statusFilter: "all" | "rascunho" | "aprovado" | "descartado";
  setStatusFilter: (status: "all" | "rascunho" | "aprovado" | "descartado") => void;
  historySubTab: 'lista' | 'planner';
  setHistorySubTab: (tab: 'lista' | 'planner') => void;
}
```
Replace with:
```typescript
interface HistoryListProps {
  history: PautaGerada[];
  onClearHistory: () => void;
  brandFilter: "all" | "Apice" | "Barbours";
  setBrandFilter: (brand: "all" | "Apice" | "Barbours") => void;
  statusFilter: "all" | "rascunho" | "aprovado" | "descartado";
  setStatusFilter: (status: "all" | "rascunho" | "aprovado" | "descartado") => void;
  modoFilter: "all" | "A" | "B";
  setModoFilter: (v: "all" | "A" | "B") => void;
  tipoGeracaoFilter: "all" | "texto" | "imagem" | "texto_imagem";
  setTipoGeracaoFilter: (v: "all" | "texto" | "imagem" | "texto_imagem") => void;
  onClearFilters: () => void;
  historySubTab: 'lista' | 'planner';
  setHistorySubTab: (tab: 'lista' | 'planner') => void;
}
```

- [ ] **Step 2: Add new props to destructuring**

Find (line 17):
```typescript
export default function HistoryList({
  history,
  onClearHistory,
  brandFilter,
  setBrandFilter,
  statusFilter,
  setStatusFilter,
  historySubTab,
  setHistorySubTab,
}: HistoryListProps) {
```
Replace with:
```typescript
export default function HistoryList({
  history,
  onClearHistory,
  brandFilter,
  setBrandFilter,
  statusFilter,
  setStatusFilter,
  modoFilter,
  setModoFilter,
  tipoGeracaoFilter,
  setTipoGeracaoFilter,
  onClearFilters,
  historySubTab,
  setHistorySubTab,
}: HistoryListProps) {
```

- [ ] **Step 3: Add `hasActiveFilters` computed variable**

Add after the closing `})();` of `aberturaMediaAprovadas` (around line 125), before the `return (`:
```typescript
  const hasActiveFilters = brandFilter !== 'all' || modoFilter !== 'all' || tipoGeracaoFilter !== 'all' || statusFilter !== 'all';
```

- [ ] **Step 4: Wrap the KPI grid and Export CSV button in a conditional visibility block**

Find the "Grid de KPIs acumuladas" section (around lines 167–205):
```tsx
      {/* Grid de KPIs acumuladas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        ...4 KPI cards...
      </div>
```

Wrap the entire block — from `{/* Grid de KPIs acumuladas */}` up through the closing `</div>` of the grid — in a conditional:
```tsx
      {/* Grid de KPIs acumuladas — hidden when a specific brand is selected */}
      <div className={`overflow-hidden transition-all duration-500 ${brandFilter !== 'all' ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100'}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          ...existing 4 KPI card divs unchanged...
        </div>
      </div>
```

Also wrap the Export CSV button in the header in the same condition. Find in the header actions area (around line 144):
```tsx
          {/* Botão de Exportação CSV do Cronograma (Point 3) */}
          <button
            id="btn-export-cronograma-csv"
```
Wrap it:
```tsx
          {brandFilter === 'all' && (
            <button
              id="btn-export-cronograma-csv"
              ...existing button content...
            </button>
          )}
```

- [ ] **Step 5: Replace the filter section with 4 labeled rows**

Find the entire "Barra de Seleção de Visualização de Sub-Abas e Filtros" div (around lines 207–301). Replace the `{/* Filtros em Linha */}` subsection (the `<div className="flex flex-wrap gap-3.5 items-center">` block that contains the brand filter and status filter chip groups) with the new 4-row structure. Keep the Lista/Planejador toggle untouched.

Find the Filtros em Linha block starting with:
```tsx
        {/* Filtros em Linha */}
        <div className="flex flex-wrap gap-3.5 items-center">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
            <ListFilter className="w-3.5 h-3.5 text-indigo-400" />
            Segmentar por:
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Filtro Marca */}
            ...brand filter chips...
            {/* Filtro Status */}
            ...status filter chips...
          </div>

        </div>
```

Replace with:
```tsx
        {/* Filtros em Cascata — 4 linhas */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 mb-0.5">
            <ListFilter className="w-3.5 h-3.5 text-indigo-400" />
            Filtrar por:
            {hasActiveFilters && (
              <button
                onClick={onClearFilters}
                className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer underline underline-offset-2 font-normal ml-1"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {/* Linha 1: Marca */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase font-bold text-slate-500 w-14 shrink-0">Marca</span>
            <div className="flex bg-slate-950 rounded-xl p-1 border border-slate-800 text-xs">
              <button id="btn-filter-brand-all" onClick={() => setBrandFilter("all")} className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${brandFilter === "all" ? "bg-slate-800 text-white font-bold" : "text-slate-400 hover:text-slate-200"}`}>Todas</button>
              <button id="btn-filter-brand-apice" onClick={() => setBrandFilter("Apice")} className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${brandFilter === "Apice" ? "bg-[#325E49] text-white font-bold" : "text-slate-400 hover:text-slate-200"}`}>Apice</button>
              <button id="btn-filter-brand-barbours" onClick={() => setBrandFilter("Barbours")} className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${brandFilter === "Barbours" ? "bg-[#BF0F26] text-white font-bold" : "text-slate-400 hover:text-slate-200"}`}>Barbours</button>
            </div>
          </div>

          {/* Linha 2: Modo */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase font-bold text-slate-500 w-14 shrink-0">Modo</span>
            <div className="flex bg-slate-950 rounded-xl p-1 border border-slate-800 text-xs">
              <button onClick={() => setModoFilter("all")} className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${modoFilter === "all" ? "bg-slate-800 text-white font-bold" : "text-slate-400 hover:text-slate-200"}`}>Todos</button>
              <button onClick={() => setModoFilter("A")} className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${modoFilter === "A" ? "bg-slate-700 text-white font-bold" : "text-slate-400 hover:text-slate-200"}`}>Modo A</button>
              <button onClick={() => setModoFilter("B")} className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${modoFilter === "B" ? "bg-slate-700 text-white font-bold" : "text-slate-400 hover:text-slate-200"}`}>Modo B</button>
            </div>
          </div>

          {/* Linha 3: Tipo */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] uppercase font-bold text-slate-500 w-14 shrink-0">Tipo</span>
            <div className="flex flex-wrap bg-slate-950 rounded-xl p-1 border border-slate-800 text-xs gap-0.5">
              <button onClick={() => setTipoGeracaoFilter("all")} className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${tipoGeracaoFilter === "all" ? "bg-slate-800 text-white font-bold" : "text-slate-400 hover:text-slate-200"}`}>Todos</button>
              <button onClick={() => setTipoGeracaoFilter("texto_imagem")} className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${tipoGeracaoFilter === "texto_imagem" ? "bg-slate-700 text-white font-bold" : "text-slate-400 hover:text-slate-200"}`}>Texto + Imagem</button>
              <button onClick={() => setTipoGeracaoFilter("texto")} className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${tipoGeracaoFilter === "texto" ? "bg-slate-700 text-white font-bold" : "text-slate-400 hover:text-slate-200"}`}>Apenas Texto</button>
              <button onClick={() => setTipoGeracaoFilter("imagem")} className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${tipoGeracaoFilter === "imagem" ? "bg-indigo-800/60 text-white font-bold" : "text-slate-400 hover:text-slate-200"}`}>Apenas Imagem</button>
            </div>
          </div>

          {/* Linha 4: Status */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase font-bold text-slate-500 w-14 shrink-0">Status</span>
            <div className="flex bg-slate-950 rounded-xl p-1 border border-slate-800 text-xs">
              <button id="btn-filter-status-all" onClick={() => setStatusFilter("all")} className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${statusFilter === "all" ? "bg-slate-800 text-white font-bold" : "text-slate-400 hover:text-slate-200"}`}>Todos</button>
              <button id="btn-filter-status-aprovado" onClick={() => setStatusFilter("aprovado")} className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${statusFilter === "aprovado" ? "bg-emerald-600/50 text-white font-bold border border-emerald-500/30" : "text-slate-400 hover:text-slate-200"}`}>Aprovados</button>
              <button id="btn-filter-status-rascunho" onClick={() => setStatusFilter("rascunho")} className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${statusFilter === "rascunho" ? "bg-amber-600/50 text-white font-bold border border-amber-500/20" : "text-slate-400 hover:text-slate-200"}`}>Rascunhos</button>
            </div>
          </div>
        </div>
```

- [ ] **Step 6: Verify lint**

Run:
```bash
export PATH="/c/Program Files/nodejs:$PATH" && cd "/c/Users/Notebook/spectrum" && npm run lint
```

Expected: Only the 2 pre-existing errors remain. No new errors.

---

### Task 8: ResultPauta — 4 metadata badges + conditional sections

**Files:**
- Modify: `src/components/ResultPauta.tsx`

Context: The card has a header section (lines 114–132) with a status badge and an ID tag, then a 2-column grid (left: copywriting, right: BannerSimulador). Add 3 new badges in the header alongside the existing status badge. Conditionally hide the left column when `tipoGeracao === 'imagem'` and the right column when `tipoGeracao === 'texto'`. The visual briefing accordion (`Briefing de Produção Visual`) is hidden when `tipoGeracao === 'texto'`.

- [ ] **Step 1: Add `tipoGeracao` derived variables below `isApice` and `displayStatus`**

Find (around lines 93–98):
```tsx
  const isApice = pauta.marca === 'Apice';
  const displayStatus = pauta.status === 'aprovado' 
    ? { text: 'Aprovada', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
    : pauta.status === 'descartado'
      ? { text: 'Descartada', bg: 'bg-slate-100 text-slate-500 border-slate-200' }
      : { text: 'Rascunho', bg: 'bg-amber-100 text-amber-800 border-amber-300' };
```
Replace with:
```tsx
  const isApice = pauta.marca === 'Apice';
  const displayStatus = pauta.status === 'aprovado' 
    ? { text: 'Aprovada', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
    : pauta.status === 'descartado'
      ? { text: 'Descartada', bg: 'bg-slate-100 text-slate-500 border-slate-200' }
      : { text: 'Rascunho', bg: 'bg-amber-100 text-amber-800 border-amber-300' };
  const tipoEfetivo = pauta.tipoGeracao ?? 'texto_imagem';
  const TIPO_LABELS: Record<string, string> = {
    'texto_imagem': 'Texto + Imagem',
    'texto': 'Apenas Texto',
    'imagem': 'Apenas Imagem',
  };
```

- [ ] **Step 2: Add metadata badges in the header**

Find the header badge row (around lines 115–124):
```tsx
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs uppercase font-extrabold tracking-wider px-2.5 py-1 rounded-full ${displayStatus.bg} border`}>
              {displayStatus.text}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ID: {pauta.id.split('-')[1] || pauta.id}
            </span>
          </div>
          <h4 className="text-lg font-bold text-slate-850">
            Pauta Hits — Marca {pauta.marca}
          </h4>
        </div>
```
Replace with:
```tsx
        <div>
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={`text-xs uppercase font-extrabold tracking-wider px-2.5 py-1 rounded-full ${displayStatus.bg} border`}>
              {displayStatus.text}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isApice ? 'bg-[#688D65]/10 text-[#52704f] border-[#688D65]/30' : 'bg-[#BF0F26]/10 text-[#BF0F26] border-[#BF0F26]/30'}`}>
              {pauta.marca}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              Modo {pauta.modo}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
              {TIPO_LABELS[tipoEfetivo]}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ID: {pauta.id.split('-')[1] || pauta.id}
            </span>
          </div>
          <h4 className="text-lg font-bold text-slate-850">
            Pauta Hits — Marca {pauta.marca}
          </h4>
        </div>
```

- [ ] **Step 3: Update the main grid to conditionally hide columns**

Find (around lines 135–311):
```tsx
      {/* Grid Principal: Esquerda Copywriting e Controles / Direita Simulador Gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Lado Esquerdo: Bloco de Copywriting */}
        <div className="flex flex-col gap-5">
          ...copywriting content...
        </div>

        {/* Lado Direito: Banner Simulador Gráfico */}
        <div>
          ...BannerSimulador...
        </div>

      </div>
```
Replace with:
```tsx
      {/* Grid Principal: Esquerda Copywriting e Controles / Direita Simulador Gráfico */}
      <div className={`grid grid-cols-1 gap-8 ${tipoEfetivo === 'texto_imagem' ? 'lg:grid-cols-2' : ''}`}>
        
        {/* Lado Esquerdo: Bloco de Copywriting */}
        {tipoEfetivo !== 'imagem' && (
          <div className="flex flex-col gap-5">
            ...copywriting content unchanged...
          </div>
        )}

        {/* Lado Direito: Banner Simulador Gráfico */}
        {tipoEfetivo !== 'texto' && (
          <div>
            ...BannerSimulador unchanged...
          </div>
        )}

      </div>
```

Important: The content inside each column div is unchanged. Only the wrapping conditional and grid class changes.

- [ ] **Step 4: Conditionally hide the Visual Briefing accordion**

Find (around lines 316–427) the visual accordion div opening:
```tsx
        {/* Accordion Visual */}
        <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-100">
          <button
            id={`btn-toggle-visual-${pauta.id}`}
```
Wrap the entire visual accordion div in a conditional:
```tsx
        {/* Accordion Visual — hidden for texto-only pautas */}
        {tipoEfetivo !== 'texto' && (
          <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-100">
            <button
              id={`btn-toggle-visual-${pauta.id}`}
              ...existing content unchanged...
            </div>
          </div>
        )}
```

The closing `</div>` of the accordion and the outer `)}` close the conditional.

- [ ] **Step 5: Verify lint**

Run:
```bash
export PATH="/c/Program Files/nodejs:$PATH" && cd "/c/Users/Notebook/spectrum" && npm run lint
```

Expected: Only the 2 pre-existing errors. No new errors.

- [ ] **Step 6: Start the dev server and verify visually**

Run:
```bash
export PATH="/c/Program Files/nodejs:$PATH" && cd "/c/Users/Notebook/spectrum" && npm run dev
```

Open `http://localhost:3000` and verify:
1. Modo A form shows `TipoGeracaoSelector` between Direcionamento field and Contexto de Campanha chips. Default is "Texto + Imagem". Cards respond to brand color.
2. Modo B form shows `TipoGeracaoSelector` between Direcionamento field and Box 1. Selecting "Apenas Imagem" grays out Boxes 1, 2, 3, 5. Selecting "Apenas Texto" grays out Box 4.
3. Histórico screen has 4 labeled filter rows (Marca / Modo / Tipo / Status). KPI cards disappear with transition when a brand is selected. "Limpar filtros" link appears when any filter is active.
4. (If any pautas exist) Pauta cards show 4 badges: status + brand + modo + tipo.
