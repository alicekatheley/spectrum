# Design: Seleção de Aspect Ratio + Geração Real de Imagens

**Data:** 2026-05-27  
**Projeto:** Spectrum CRM  
**Status:** Aprovado

---

## Contexto

O Spectrum hoje gera *descrições textuais* dos 3 frames do GIF de campanha usando o Gemini. O componente `BannerSimulador.tsx` simula esses frames como HTML/CSS no browser. Não existe geração real de imagem.

Esta feature adiciona:
1. Um seletor de aspect ratio nos formulários (Modo A e Modo B)
2. Injeção da proporção no prompt do Gemini (para que as descrições textuais sejam escritas já pensando no recorte visual)
3. Um endpoint novo `/api/generate-image` que chama o Google Imagen 4
4. Um botão por frame no painel de resultado para gerar a imagem real on-demand

---

## Decisões de Design

- **Abordagem escolhida:** C — seletor no formulário, geração de imagem on-demand no resultado
- **API de imagem:** Google Imagen 4 (`imagen-4.0-generate-001`) via `@google/genai` v1.52.0 (já instalado), usando a `GEMINI_API_KEY` existente
- **Aspect ratios:** apenas os 5 suportados nativamente pela Imagen API (`"1:1"`, `"3:4"`, `"16:9"`, `"9:16"`, `"4:3"`). Os formatos 4:5, 3:2, 2:3 e "Personalizado" em pixels foram descartados por não terem suporte na API escolhida.
- **Persistência:** `aspectRatio` vive em `useState` no `App.tsx` — persiste durante a sessão, reseta no reload. Sem `localStorage` nem Supabase.

---

## Arquitetura

```
FormModoA / FormModoB
  └─ AspectRatioSelector (novo componente)
       ↓ onChange → App.tsx (aspectRatio: useState<string>('1:1'))
  └─ onSubmit inclui aspectRatio no body

POST /api/generate-pauta { ..., aspectRatio }
  → server.ts injeta aspectRatio no prompt do Gemini
  → Gemini descreve os frames ciente do recorte visual
  → retorna PautaGerada (sem mudanças na estrutura de tipos)

ResultPauta
  └─ seção "Imagens dos Frames" (nova, dentro do accordion visual existente)
       ↓ botão por frame → POST /api/generate-image
            → server.ts chama ai.models.generateImages(...)
            → retorna { imageBytes: string, mimeType: string }
            → exibido como <img src="data:{mimeType};base64,{imageBytes}">
```

---

## Arquivos Afetados

| Arquivo | Tipo de mudança |
|---|---|
| `src/components/AspectRatioSelector.tsx` | **Novo** |
| `src/App.tsx` | Adiciona `aspectRatio` state + passa como prop |
| `src/components/FormModoA.tsx` | Recebe + renderiza `AspectRatioSelector` |
| `src/components/FormModoB.tsx` | Idem |
| `src/components/ResultPauta.tsx` | Nova seção de geração de imagem |
| `src/types.ts` | Adiciona `aspectRatio?: string` em `InputModoA` e `InputModoB` |
| `server.ts` | Injeta `aspectRatio` no prompt + novo endpoint `/api/generate-image` |

---

## Especificação dos Componentes

### `AspectRatioSelector.tsx`

```typescript
interface AspectRatioSelectorProps {
  value: string;
  onChange: (v: string) => void;
  brand: Brand;
}
```

**5 opções (em ordem de exibição):**

| value   | Label | Descrição exibida       |
|---------|-------|-------------------------|
| `"1:1"` | 1:1   | Feed, post estático     |
| `"3:4"` | 3:4   | Retrato — email         |
| `"16:9"`| 16:9  | Header widescreen       |
| `"9:16"`| 9:16  | Stories, mobile         |
| `"4:3"` | 4:3   | Paisagem padrão         |

**Visual:** grid de 5 cards horizontais. Cada card tem um retângulo SVG na proporção exata + label abaixo. Card selecionado: borda na cor primária da marca (`#688D65` Ápice / `#BF0F26` Barbours). Default: `"1:1"`.

**Posição nos formulários:** logo acima do botão "Gerar Pauta", em ambos Modo A e Modo B.

---

### Mudança no prompt do Gemini (`server.ts`)

No bloco de instruções de geração de frames, adicionar:

> "Os frames do GIF devem ser compostos visualmente para a proporção `{aspectRatio}`. Considere o recorte ao descrever posicionamento de elementos, hierarquia visual e o que deve ser cortado ou omitido nas bordas."

---

### Novo endpoint `/api/generate-image` (`server.ts`)

**Request:**
```typescript
{
  frameDescription: string;  // texto do frame (frameInicial | frameIntermediario | frameFinal)
  aspectRatio: string;        // "1:1" | "3:4" | "16:9" | "9:16" | "4:3"
  marca: string;              // "Apice" | "Barbours"
}
```

**Response (sucesso):**
```typescript
{ imageBytes: string; mimeType: string }
```

**Response (erro):**
```typescript
{ error: string }
```

**Implementação interna:**
1. Validar `aspectRatio` contra whitelist das 5 opções válidas
2. Montar prompt: `frameDescription` + contexto da marca (paleta HEX, estilo de ilustração)
3. Chamar `ai.models.generateImages({ model: "imagen-4.0-generate-001", prompt, config: { aspectRatio, numberOfImages: 1 } })`
4. Retornar `generatedImages[0].image.imageBytes` + `mimeType`

---

### Seção de imagens em `ResultPauta.tsx`

Dentro do accordion visual existente, abaixo das descrições textuais dos 3 frames:

**Estado local adicionado:**
```typescript
const [frameImages, setFrameImages] = useState<{
  inicial?: string;
  intermediario?: string;
  final?: string;
}>({});
const [generatingFrame, setGeneratingFrame] = useState<string | null>(null);
```

**Nova prop recebida:**
```typescript
aspectRatio: string;
```

**Layout:**
- 3 botões individuais: "Gerar Imagem — Frame Inicial", "Frame Intermediário", "Frame Final"
- Durante geração: spinner no botão do frame em progresso, demais desabilitados
- Após geração: `<img>` exibida abaixo do botão correspondente, com o `aspectRatio` refletido no tamanho visual via CSS (`aspect-ratio` CSS property)
- Sem persistência: imagens somem ao recarregar ou gerar nova pauta

---

## Restrições e Riscos

| Item | Detalhe |
|---|---|
| Imagen requer billing ativo | A `GEMINI_API_KEY` do Google AI Studio pode não ter acesso ao Imagen 4. Se retornar 403/404, o usuário precisará habilitar a API no Google Cloud Console. |
| Custo por imagem | Cada chamada ao Imagen gera custo na conta Google. A geração é opt-in (botão manual) para evitar gastos acidentais. |
| Latência | Imagen leva tipicamente 5–15 segundos por imagem. O spinner por frame garante feedback adequado. |
| Sem armazenamento | As imagens geradas não são salvas no Supabase. Vivem apenas em memória local do componente. Se necessário no futuro, pode-se adicionar Supabase Storage. |
