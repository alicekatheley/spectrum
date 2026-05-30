# Aspect Ratio Selector + Google Imagen Image Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an aspect ratio selector to both generation forms (Modo A and B) that informs the Gemini prompt, and a per-frame "Gerar Imagem" button in the result panel that calls Google Imagen 4 to generate real images.

**Architecture:** `aspectRatio` state lives in `App.tsx`, is passed as a controlled prop to both forms and to `ResultPauta`. Forms render a new `AspectRatioSelector` component. `App.tsx` includes `aspectRatio` in the POST body to `/api/generate-pauta`. A new `/api/generate-image` endpoint calls `ai.models.generateImages()` using the existing Gemini client.

**Tech Stack:** React + TypeScript (frontend), Express + `@google/genai` v1.52.0 (backend), Tailwind CSS, Lucide React icons. Verification: `npm run lint` (`tsc --noEmit`).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/AspectRatioSelector.tsx` | **Create** | 5-card ratio picker, brand-coloured highlight |
| `src/App.tsx` | **Modify** | Add `aspectRatio` state; pass to forms + ResultPauta; include in fetch bodies |
| `src/components/FormModoA.tsx` | **Modify** | Accept + render `AspectRatioSelector` above submit button |
| `src/components/FormModoB.tsx` | **Modify** | Same as FormModoA |
| `src/components/ResultPauta.tsx` | **Modify** | Accept `aspectRatio` prop; add per-frame image generation section |
| `server.ts` | **Modify** | Accept `aspectRatio` in generate-pauta; update Gemini prompt; add `/api/generate-image` endpoint |

`src/types.ts` — **no changes needed** (`aspectRatio` travels as a top-level request field, not inside `InputModoA`/`InputModoB`).

---

## Task 1: Create `AspectRatioSelector` component

**Files:**
- Create: `src/components/AspectRatioSelector.tsx`

The 5 valid ratios (matching Imagen API exactly): `1:1`, `3:4`, `16:9`, `9:16`, `4:3`.

Each card shows a proportional SVG rectangle. The selected card gets a 2px border in the brand primary colour.

- [ ] **Step 1: Create the file**

```tsx
// src/components/AspectRatioSelector.tsx
import { Brand } from "../types";

interface AspectRatioSelectorProps {
  value: string;
  onChange: (v: string) => void;
  brand: Brand;
}

const RATIOS: { value: string; label: string; description: string; w: number; h: number }[] = [
  { value: "1:1",  label: "1:1",  description: "Feed, post estático", w: 40, h: 40 },
  { value: "3:4",  label: "3:4",  description: "Retrato — email",     w: 30, h: 40 },
  { value: "16:9", label: "16:9", description: "Header widescreen",   w: 48, h: 27 },
  { value: "9:16", label: "9:16", description: "Stories, mobile",     w: 22, h: 40 },
  { value: "4:3",  label: "4:3",  description: "Paisagem padrão",     w: 40, h: 30 },
];

export default function AspectRatioSelector({ value, onChange, brand }: AspectRatioSelectorProps) {
  const brandColor = brand === 'Apice' ? '#688D65' : '#BF0F26';

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-slate-700">
        Proporção da Imagem
      </span>
      <div className="flex gap-2 flex-wrap">
        {RATIOS.map((ratio) => {
          const isSelected = value === ratio.value;
          return (
            <button
              key={ratio.value}
              type="button"
              onClick={() => onChange(ratio.value)}
              className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all duration-200 cursor-pointer min-w-[60px] ${
                isSelected
                  ? 'bg-slate-50 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
              style={isSelected ? { borderColor: brandColor } : {}}
              title={ratio.description}
            >
              <div className="flex items-center justify-center w-12 h-10">
                <div
                  className="rounded-sm"
                  style={{
                    width: `${ratio.w}px`,
                    height: `${ratio.h}px`,
                    backgroundColor: isSelected ? brandColor : '#cbd5e1',
                    opacity: isSelected ? 0.85 : 0.5,
                    transition: 'background-color 0.2s',
                  }}
                />
              </div>
              <span
                className="text-[11px] font-bold tracking-wide"
                style={{ color: isSelected ? brandColor : '#64748b' }}
              >
                {ratio.label}
              </span>
              <span className="text-[9px] text-slate-400 text-center leading-tight max-w-[64px]">
                {ratio.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from repo root (adjust PATH for Windows):
```bash
export PATH="/c/Program Files/nodejs:$PATH"
cd "/c/Users/Notebook/spectrum"
npm run lint
```
Expected: exit 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/AspectRatioSelector.tsx
git commit -m "feat: add AspectRatioSelector component for Imagen aspect ratio selection"
```

---

## Task 2: Add `aspectRatio` state to `App.tsx`

**Files:**
- Modify: `src/App.tsx`

Three changes:
1. Add `const [aspectRatio, setAspectRatio] = useState<string>('1:1');`
2. Include `aspectRatio` in the fetch bodies of both `handleFormASubmit` and `handleFormBSubmit`
3. Pass `aspectRatio` + `onAspectRatioChange` to both forms, and `aspectRatio` to `ResultPauta`

- [ ] **Step 1: Add aspectRatio state — insert after the `editInputPreload` state line**

Find this line in `src/App.tsx`:
```tsx
  const [editInputPreload, setEditInputPreload] = useState<InputModoB | null>(null);
```

Replace with:
```tsx
  const [editInputPreload, setEditInputPreload] = useState<InputModoB | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
```

- [ ] **Step 2: Include `aspectRatio` in the Modo A fetch body**

Find in `handleFormASubmit`:
```tsx
        body: JSON.stringify({ modo: "A", input: inputA }),
```
Replace with:
```tsx
        body: JSON.stringify({ modo: "A", input: inputA, aspectRatio }),
```

- [ ] **Step 3: Include `aspectRatio` in the Modo B fetch body**

Find in `handleFormBSubmit`:
```tsx
        body: JSON.stringify({ modo: "B", input: inputB }),
```
Replace with:
```tsx
        body: JSON.stringify({ modo: "B", input: inputB, aspectRatio }),
```

- [ ] **Step 4: Pass props to `FormModoA`**

Find:
```tsx
                  <FormModoA 
                    brand={currentBrand} 
                    onSubmit={handleFormASubmit} 
                    loading={loading} 
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
                  />
```

- [ ] **Step 5: Pass props to `FormModoB`**

Find:
```tsx
                  <FormModoB 
                    brand={currentBrand} 
                    onSubmit={handleFormBSubmit} 
                    loading={loading} 
                    key={editInputPreload ? JSON.stringify(editInputPreload) : 'new'}
                    preload={editInputPreload}
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
                  />
```

- [ ] **Step 6: Pass `aspectRatio` to `ResultPauta`**

Find (inside the `.map((pauta) => (` block):
```tsx
                    <ResultPauta
                      key={pauta.id}
                      pauta={pauta}
                      onApprove={handleApprovePauta}
                      onDiscard={handleDiscardPauta}
                      onGenerateVariation={handleGenerateVariation}
                      onEdit={() => handleEditPauta(pauta.id)}
                      onOpenPreview={setActivePreviewPauta}
                    />
```
Replace with:
```tsx
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
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
export PATH="/c/Program Files/nodejs:$PATH" && npm run lint
```
Expected: will fail because `FormModoA`, `FormModoB`, and `ResultPauta` don't accept the new props yet. That's expected — proceed.

- [ ] **Step 8: Commit partial work**

```bash
git add src/App.tsx
git commit -m "feat: add aspectRatio state and pass to forms and ResultPauta"
```

---

## Task 3: Update `FormModoA` to render `AspectRatioSelector`

**Files:**
- Modify: `src/components/FormModoA.tsx`

- [ ] **Step 1: Add import and new props to interface**

Find at top of `src/components/FormModoA.tsx`:
```tsx
import React, { useState } from "react";
import { Brand, CampaignContext, RewardType, InputModoA } from "../types";
import { Calendar, Layers, Gift, AlertCircle, RefreshCw, HelpCircle } from "lucide-react";

interface FormModoAProps {
  brand: Brand;
  onSubmit: (input: InputModoA) => void;
  loading: boolean;
}
```
Replace with:
```tsx
import React, { useState } from "react";
import { Brand, CampaignContext, RewardType, InputModoA } from "../types";
import { Calendar, Layers, Gift, AlertCircle, RefreshCw, HelpCircle } from "lucide-react";
import AspectRatioSelector from "./AspectRatioSelector";

interface FormModoAProps {
  brand: Brand;
  onSubmit: (input: InputModoA) => void;
  loading: boolean;
  aspectRatio: string;
  onAspectRatioChange: (v: string) => void;
}
```

- [ ] **Step 2: Destructure new props**

Find:
```tsx
export default function FormModoA({ brand, onSubmit, loading }: FormModoAProps) {
```
Replace with:
```tsx
export default function FormModoA({ brand, onSubmit, loading, aspectRatio, onAspectRatioChange }: FormModoAProps) {
```

- [ ] **Step 3: Insert `AspectRatioSelector` just above the submit button**

Find in `FormModoA.tsx`:
```tsx
      <button
        id="btn-submit-modo-a"
        type="submit"
```
Replace with:
```tsx
      <AspectRatioSelector
        value={aspectRatio}
        onChange={onAspectRatioChange}
        brand={brand}
      />

      <button
        id="btn-submit-modo-a"
        type="submit"
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
export PATH="/c/Program Files/nodejs:$PATH" && npm run lint
```
Expected: FormModoA errors gone. FormModoB and ResultPauta still fail — that's expected.

- [ ] **Step 5: Commit**

```bash
git add src/components/FormModoA.tsx
git commit -m "feat: add AspectRatioSelector to FormModoA"
```

---

## Task 4: Update `FormModoB` to render `AspectRatioSelector`

**Files:**
- Modify: `src/components/FormModoB.tsx`

- [ ] **Step 1: Add import and extend interface**

Find at top of `src/components/FormModoB.tsx`:
```tsx
import React, { useState } from "react";
import { Brand, InputModoB } from "../types";
import { Sparkles, Trash2, ShieldAlert, Eye, RefreshCw } from "lucide-react";

interface FormModoBProps {
  brand: Brand;
  onSubmit: (input: InputModoB) => void;
  loading: boolean;
  preload?: InputModoB | null;
  key?: string | number;
}
```
Replace with:
```tsx
import React, { useState } from "react";
import { Brand, InputModoB } from "../types";
import { Sparkles, Trash2, ShieldAlert, Eye, RefreshCw } from "lucide-react";
import AspectRatioSelector from "./AspectRatioSelector";

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

- [ ] **Step 2: Destructure new props**

Find:
```tsx
export default function FormModoB({ brand, onSubmit, loading, preload }: FormModoBProps) {
```
Replace with:
```tsx
export default function FormModoB({ brand, onSubmit, loading, preload, aspectRatio, onAspectRatioChange }: FormModoBProps) {
```

- [ ] **Step 3: Insert `AspectRatioSelector` just above the submit button**

Find in `FormModoB.tsx`:
```tsx
      <button
        id="btn-submit-modo-b"
        type="submit"
```
Replace with:
```tsx
      <AspectRatioSelector
        value={aspectRatio}
        onChange={onAspectRatioChange}
        brand={brand}
      />

      <button
        id="btn-submit-modo-b"
        type="submit"
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
export PATH="/c/Program Files/nodejs:$PATH" && npm run lint
```
Expected: FormModoA and FormModoB errors gone. ResultPauta still fails — expected.

- [ ] **Step 5: Commit**

```bash
git add src/components/FormModoB.tsx
git commit -m "feat: add AspectRatioSelector to FormModoB"
```

---

## Task 5: Update `server.ts` — inject `aspectRatio` into Gemini prompt

**Files:**
- Modify: `server.ts`

The server currently has the aspect ratio hardcoded as `"1:1"` in the system prompt (line 178). We need to:
1. Extract `aspectRatio` from `req.body`
2. Validate it against the whitelist
3. Replace the hardcoded mention with the dynamic value

- [ ] **Step 1: Extract and validate `aspectRatio` at the top of the `/api/generate-pauta` handler**

Find in `server.ts` inside the `app.post("/api/generate-pauta", ...)` handler:
```typescript
    const { modo, input } = req.body;

    if (!input || !input.marca) {
      return res.status(400).json({ error: "A marca é obrigatória." });
    }
```
Replace with:
```typescript
    const { modo, input, aspectRatio: rawAspectRatio } = req.body;

    if (!input || !input.marca) {
      return res.status(400).json({ error: "A marca é obrigatória." });
    }

    const VALID_RATIOS = ['1:1', '3:4', '16:9', '9:16', '4:3'];
    const aspectRatio = VALID_RATIOS.includes(rawAspectRatio) ? rawAspectRatio : '1:1';
```

- [ ] **Step 2: Update the hardcoded aspect ratio reference in the system instruction**

Find in `systemInstruction` (inside the same handler, around line 178):
```typescript
- Estruture o banner como sempre quadrado (aspect ratio 1:1), ilustrado, instigante, preferencialmente formato GIF (com 3 frames detalhados: Inicial com o objeto intocado/fechado, Intermediário opcional com a ação ocorrendo, e Final com a revelação da recompensa e botão CTA visível em contraste).
```
Replace with:
```typescript
- Estruture o banner no formato ${aspectRatio} (proporção escolhida pelo usuário), ilustrado, instigante, preferencialmente formato GIF (com 3 frames detalhados: Inicial com o objeto intocado/fechado, Intermediário opcional com a ação ocorrendo, e Final com a revelação da recompensa e botão CTA visível em contraste). Ao descrever cada frame, considere o recorte visual da proporção ${aspectRatio}: posicionamento de elementos, hierarquia e o que será cortado nas bordas.
```

Note: because `systemInstruction` is a `const` string declared before `aspectRatio` is known, you'll need to move `systemInstruction` to after the `aspectRatio` validation, or convert it to a template literal function. The simplest fix is to change `systemInstruction` from a top-level `const` to a variable declared after the `aspectRatio` is resolved. Since `systemInstruction` is already inside the `async` handler function body, this just means moving its declaration to after the `aspectRatio` line.

The `systemInstruction` is declared at line 142 of `server.ts`. Confirm it is inside the `app.post(...)` handler body (it is — the `const systemInstruction = \`...\`` starts at line 142, after `const { marca } = input;` at line 89). So moving it below the `aspectRatio` line is safe since both are in the same function scope.

Move the `const systemInstruction = \`...\`` block to appear **after** the `aspectRatio` line you added in Step 1.

The actual edit: in the system instruction template literal, simply replace the static `1:1` reference as described above. Because `systemInstruction` is already declared inside the handler function after `aspectRatio`, the template literal interpolation `${aspectRatio}` will resolve correctly.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
export PATH="/c/Program Files/nodejs:$PATH" && npm run lint
```
Expected: no new errors from server.ts.

- [ ] **Step 4: Commit**

```bash
git add server.ts
git commit -m "feat: pass aspectRatio from request into Gemini system prompt"
```

---

## Task 6: Add `/api/generate-image` endpoint to `server.ts`

**Files:**
- Modify: `server.ts`

Add a new POST endpoint after the existing `app.post("/api/generate-pauta", ...)` handler (around line 400).

- [ ] **Step 1: Add the endpoint**

Find in `server.ts` after the closing `});` of the generate-pauta handler:
```typescript
// Endpoint para variação alternativa de copy de email via AI
```

Insert **before** that line (i.e., between the two endpoints):

```typescript
const VALID_IMAGE_RATIOS = ['1:1', '3:4', '16:9', '9:16', '4:3'];

const BRAND_VISUAL_CONTEXT: Record<string, string> = {
  Apice: 'estilo de ilustração 2D orgânico ou 3D suave, paleta com Verde Floresta #688D65 como cor protagonista, tom acolhedor e feminino',
  Barbours: 'estilo sofisticado de luxo acessível, paleta com Ruby Red #BF0F26 dominante (2/3 da composição), detalhes dourados #AA834B, fundo Off White #E7E3D8',
};

app.post("/api/generate-image", async (req, res) => {
  try {
    const { frameDescription, aspectRatio: rawRatio, marca } = req.body;

    if (!frameDescription || typeof frameDescription !== 'string') {
      return res.status(400).json({ error: "frameDescription é obrigatório." });
    }
    if (!marca || !BRAND_VISUAL_CONTEXT[marca]) {
      return res.status(400).json({ error: "marca inválida. Use 'Apice' ou 'Barbours'." });
    }

    const aspectRatio = VALID_IMAGE_RATIOS.includes(rawRatio) ? rawRatio : '1:1';
    const brandContext = BRAND_VISUAL_CONTEXT[marca];

    const prompt = `Email marketing GIF banner frame para a marca ${marca}. Contexto visual da marca: ${brandContext}. Frame: ${frameDescription}. Estilo: ilustração limpa para email de CRM, sem texto sobreposto, sem watermark, fundo simples.`;

    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt,
      config: {
        numberOfImages: 1,
        aspectRatio,
      },
    });

    const generated = response.generatedImages?.[0];
    if (!generated?.image?.imageBytes) {
      return res.status(500).json({ error: "A API não retornou imagem. Verifique se o Imagen 4 está habilitado para esta chave." });
    }

    res.json({
      imageBytes: generated.image.imageBytes,
      mimeType: generated.image.mimeType ?? 'image/png',
    });
  } catch (err: any) {
    console.error("[generate-image] Erro:", err);
    res.status(500).json({ error: "Falha ao gerar imagem com Imagen.", details: err.message });
  }
});

```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
export PATH="/c/Program Files/nodejs:$PATH" && npm run lint
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add server.ts
git commit -m "feat: add /api/generate-image endpoint using Imagen 4"
```

---

## Task 7: Add image generation section to `ResultPauta`

**Files:**
- Modify: `src/components/ResultPauta.tsx`

Three changes:
1. Add `aspectRatio` to the props interface
2. Add `frameImages` + `generatingFrame` local state
3. Add the "Gerar Imagens dos Frames" section inside the visual accordion (below the frame list)

- [ ] **Step 1: Update imports and interface**

Find at top of `src/components/ResultPauta.tsx`:
```tsx
import { useState } from "react";
import { PautaGerada } from "../types";
import BannerSimulador from "./BannerSimulador";
import { 
  Copy, Check, Eye, EyeOff, Calendar, Clock, BarChart3, 
  HelpCircle, AlertTriangle, Sparkles, Wand2, ThumbsUp, XOctagon, RefreshCw, RotateCcw, Download 
} from "lucide-react";
import { downloadFile, generatePautaBriefingText } from "../utils";

interface ResultPautaProps {
  pauta: PautaGerada;
  onApprove: (id: string) => void;
  onDiscard: (id: string) => void;
  onGenerateVariation: (pauta: PautaGerada) => Promise<void>;
  onEdit: (pauta: PautaGerada) => void;
  onOpenPreview: (pauta: PautaGerada) => void;
  key?: string | number;
}
```
Replace with:
```tsx
import { useState } from "react";
import { PautaGerada } from "../types";
import BannerSimulador from "./BannerSimulador";
import { 
  Copy, Check, Eye, EyeOff, Calendar, Clock, BarChart3, 
  HelpCircle, AlertTriangle, Sparkles, Wand2, ThumbsUp, XOctagon, RefreshCw, RotateCcw, Download, Image 
} from "lucide-react";
import { downloadFile, generatePautaBriefingText } from "../utils";

interface ResultPautaProps {
  pauta: PautaGerada;
  onApprove: (id: string) => void;
  onDiscard: (id: string) => void;
  onGenerateVariation: (pauta: PautaGerada) => Promise<void>;
  onEdit: (pauta: PautaGerada) => void;
  onOpenPreview: (pauta: PautaGerada) => void;
  key?: string | number;
  aspectRatio: string;
}
```

- [ ] **Step 2: Destructure `aspectRatio` and add new state**

Find:
```tsx
export default function ResultPauta({
  pauta,
  onApprove,
  onDiscard,
  onGenerateVariation,
  onEdit,
  onOpenPreview,
}: ResultPautaProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showVisualAccordion, setShowVisualAccordion] = useState(true);
  const [showOperacionalAccordion, setShowOperacionalAccordion] = useState(true);
  const [loadingVariation, setLoadingVariation] = useState(false);
```
Replace with:
```tsx
export default function ResultPauta({
  pauta,
  onApprove,
  onDiscard,
  onGenerateVariation,
  onEdit,
  onOpenPreview,
  aspectRatio,
}: ResultPautaProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showVisualAccordion, setShowVisualAccordion] = useState(true);
  const [showOperacionalAccordion, setShowOperacionalAccordion] = useState(true);
  const [loadingVariation, setLoadingVariation] = useState(false);
  const [frameImages, setFrameImages] = useState<{ inicial?: string; intermediario?: string; final?: string }>({});
  const [generatingFrame, setGeneratingFrame] = useState<string | null>(null);
```

- [ ] **Step 3: Add the `generateFrameImage` handler function**

After the `handleVariationClick` function definition (and before the `const isApice` line), add:

```tsx
  const generateFrameImage = async (frameName: 'inicial' | 'intermediario' | 'final') => {
    const descriptions: Record<string, string> = {
      inicial: pauta.visual.frameInicial,
      intermediario: pauta.visual.frameIntermediario,
      final: pauta.visual.frameFinal,
    };
    setGeneratingFrame(frameName);
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameDescription: descriptions[frameName],
          aspectRatio,
          marca: pauta.marca,
        }),
      });
      const data = await response.json();
      if (data.imageBytes) {
        setFrameImages(prev => ({
          ...prev,
          [frameName]: `data:${data.mimeType};base64,${data.imageBytes}`,
        }));
      } else {
        alert(data.error ?? 'Falha ao gerar imagem.');
      }
    } catch {
      alert('Erro de rede ao gerar imagem.');
    } finally {
      setGeneratingFrame(null);
    }
  };
```

- [ ] **Step 4: Add the image generation section inside the visual accordion**

Find inside the visual accordion's expanded content (inside `{showVisualAccordion && (...)}`) the closing tags of the frame list:
```tsx
              <hr className="border-slate-200/40" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <strong className="text-slate-500 block">Posicionamento CTA:</strong>
                  <span>{pauta.visual.posicaoCta}</span>
                </div>
                <div>
                  <strong className="text-slate-500 block">Filtro Tipográfico:</strong>
                  <span>{pauta.visual.tipografia}</span>
                </div>
              </div>
            </div>
          )}
        </div>
```
Replace with:
```tsx
              <hr className="border-slate-200/40" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <strong className="text-slate-500 block">Posicionamento CTA:</strong>
                  <span>{pauta.visual.posicaoCta}</span>
                </div>
                <div>
                  <strong className="text-slate-500 block">Filtro Tipográfico:</strong>
                  <span>{pauta.visual.tipografia}</span>
                </div>
              </div>
              <hr className="border-slate-200/40" />
              <div className="flex flex-col gap-2">
                <strong className="text-slate-500 flex items-center gap-1">
                  <Image className="w-3.5 h-3.5" />
                  Gerar Imagens dos Frames ({aspectRatio})
                </strong>
                <div className="flex flex-wrap gap-2">
                  {(['inicial', 'intermediario', 'final'] as const).map((frame) => {
                    const labels = { inicial: 'F1 — Fechado', intermediario: 'F2 — Ação', final: 'F3 — Revelação' };
                    const isGenerating = generatingFrame === frame;
                    const isDone = !!frameImages[frame];
                    return (
                      <button
                        key={frame}
                        type="button"
                        onClick={() => generateFrameImage(frame)}
                        disabled={generatingFrame !== null}
                        className={`text-[10px] font-bold px-3 py-2 rounded-lg border flex items-center gap-1 transition-colors cursor-pointer ${
                          isDone
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                            : isGenerating
                              ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed'
                              : isApice
                                ? 'bg-white border-[#688D65]/40 text-[#688D65] hover:bg-[#688D65]/5'
                                : 'bg-white border-[#BF0F26]/40 text-[#BF0F26] hover:bg-[#BF0F26]/5'
                        }`}
                      >
                        {isGenerating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Image className="w-3 h-3" />}
                        {isGenerating ? 'Gerando...' : isDone ? `${labels[frame]} ✓` : labels[frame]}
                      </button>
                    );
                  })}
                </div>
                {Object.entries(frameImages).map(([frame, src]) => (
                  <div key={frame} className="flex flex-col gap-1 mt-1">
                    <span className="text-[9px] uppercase font-bold text-slate-400">
                      {frame === 'inicial' ? 'F1 — Estado Fechado' : frame === 'intermediario' ? 'F2 — Ação' : 'F3 — Revelação'}
                    </span>
                    <img
                      src={src}
                      alt={`Frame ${frame}`}
                      className="rounded-lg border border-slate-200 max-w-full"
                      style={{ aspectRatio: aspectRatio.replace(':', '/') }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
export PATH="/c/Program Files/nodejs:$PATH" && npm run lint
```
Expected: exit 0, all errors resolved.

- [ ] **Step 6: Commit**

```bash
git add src/components/ResultPauta.tsx
git commit -m "feat: add per-frame Imagen image generation to ResultPauta"
```

---

## Task 8: Manual smoke test

- [ ] **Step 1: Start dev server**

```bash
export PATH="/c/Program Files/nodejs:$PATH"
cd "/c/Users/Notebook/spectrum"
npm run dev
```
Expected output includes:
```
[Supabase] 17 disparos históricos carregados.
[Express Server] Iniciado em http://localhost:3000
```

- [ ] **Step 2: Test aspect ratio selector in Modo A**

Open `http://localhost:3000`. Go to Modo A. Confirm:
- 5 cards appear above "Sugerir Pautas" button
- Cards show proportional rectangles (1:1 is square, 16:9 is wide, 9:16 is tall)
- Clicking a card highlights it with brand colour; previously selected card loses highlight
- Default selected is "1:1"
- Switching brand (Ápice ↔ Barbours) updates the highlight colour

- [ ] **Step 3: Test selector persistence**

Switch to Modo B. Confirm the selector appears, shows the same value chosen in Modo A (state shared via App.tsx). Choose "16:9" in Modo B — switch to Modo A, confirm it still shows "16:9".

- [ ] **Step 4: Test pauta generation with non-default ratio**

Select "9:16". Click "Sugerir Pautas". After generation, open the result in the history tab. Open the Briefing Visual accordion. Confirm the frame descriptions mention vertical framing or tall composition (Gemini should have received the 9:16 instruction).

- [ ] **Step 5: Test image generation (requires Imagen API access)**

In a generated result's visual accordion, click "F1 — Fechado". Confirm:
- Button shows spinner + "Gerando..."
- Other frame buttons are disabled during generation
- After ~10–20s, button shows "F1 — Fechado ✓" with green colour
- Image appears below the buttons, sized to reflect the chosen aspect ratio

If the response is a 403 error, the `GEMINI_API_KEY` does not have Imagen access. Check the error message in the browser console. In that case, enable the Imagen API at https://console.cloud.google.com/apis/library.

- [ ] **Step 6: Commit smoke test result**

If all checks pass:
```bash
git add -p  # no new files, nothing to stage
git commit --allow-empty -m "chore: aspect-ratio + imagen feature validated in browser"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Selector with 5 ratios (1:1, 3:4, 16:9, 9:16, 4:3) — Task 1
- ✅ Default 1:1 — Task 1 (`value` initialised in App.tsx)
- ✅ Session persistence (useState, no reload reset) — Task 2
- ✅ Proportion passed to Gemini prompt — Task 5
- ✅ Real image generation with Imagen 4 — Task 6
- ✅ Per-frame individual buttons in result panel — Task 7
- ✅ Brand-coloured highlight on selector — Task 1

**Type consistency:**
- `aspectRatio: string` used consistently across `AspectRatioSelector`, `App.tsx`, `FormModoA`, `FormModoB`, `ResultPauta`
- `generateFrameImage` uses `'inicial' | 'intermediario' | 'final'` — matches `frameImages` state keys
- `frameImages` state: `{ inicial?: string; intermediario?: string; final?: string }` — matches `.map()` in step 4

**Placeholder scan:** No TBD, TODO, or "implement later" patterns present.

**Potential issue to watch:** The `Image` icon from `lucide-react` — verify it exists in the installed version. If it doesn't (it was added in lucide-react v0.290), replace with `ImageIcon` or `Aperture`. Run `npm run lint` to catch it immediately.
