import { parseGIF, decompressFrames } from "gifuct-js";

export interface GifFramesDecoded {
  frames: string[];
  width: number;
  height: number;
}

// Decodifica um .gif animado inteiramente no navegador (sem backend nem lib nativa tipo sharp,
// que não roda no worker.ts de produção). gifuct-js só devolve o "patch" (região que mudou) de
// cada frame — a composição em imagem completa por frame é feita aqui à mão, respeitando o
// disposalType de cada frame (0/1: mantém o canvas como está pro próximo frame, 2: limpa a
// região do frame pro fundo, 3: restaura o canvas pro estado de antes deste frame).
export async function decodeGifFrames(arrayBuffer: ArrayBuffer): Promise<GifFramesDecoded> {
  const gif = parseGIF(arrayBuffer);
  const parsedFrames = decompressFrames(gif, true);
  const width = gif.lsd.width;
  const height = gif.lsd.height;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível criar contexto 2D pra decodificar o GIF.");

  // Canvas auxiliar só pra segurar o "patch" (região que mudou) antes de compor no canvas
  // principal. Importante usar drawImage (não putImageData) pra levar o patch pro canvas
  // principal — putImageData SUBSTITUI os pixels do destino, inclusive os transparentes, o que
  // apaga a cor de frames anteriores sempre que o patch tem pixels transparentes dentro da sua
  // própria área (comum em GIFs onde cada frame só redesenha a parte que mudou). drawImage usa
  // composição normal (source-over) e só sobrescreve onde o patch realmente tem pixel opaco.
  const patchCanvas = document.createElement("canvas");
  const patchCtx = patchCanvas.getContext("2d");
  if (!patchCtx) throw new Error("Não foi possível criar contexto 2D pra decodificar o GIF.");

  const frames: string[] = [];
  let savedImageData: ImageData | null = null;

  for (const frame of parsedFrames) {
    const { dims, patch, disposalType } = frame;

    if (disposalType === 3) {
      savedImageData = ctx.getImageData(0, 0, width, height);
    }

    patchCanvas.width = dims.width;
    patchCanvas.height = dims.height;
    const patchImageData = patchCtx.createImageData(dims.width, dims.height);
    patchImageData.data.set(patch);
    patchCtx.putImageData(patchImageData, 0, 0);

    ctx.drawImage(patchCanvas, dims.left, dims.top);
    frames.push(canvas.toDataURL("image/png"));

    if (disposalType === 2) {
      ctx.clearRect(dims.left, dims.top, dims.width, dims.height);
    } else if (disposalType === 3 && savedImageData) {
      ctx.putImageData(savedImageData, 0, 0);
    }
  }

  return { frames, width, height };
}
