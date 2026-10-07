import { loadGifshot } from "./loadGifshot";

export interface EncodeAndDownloadGifOptions {
  gifWidth: number;
  gifHeight: number;
  filename: string;
}

// Converte cada frame (data URL ou URL remota) pra base64, monta um .gif animado de verdade
// via gifshot e dispara o download. Extraído de PreviewModal.downloadGifAnimado — mesma lógica,
// generalizada pra qualquer lista de frames (não só os de uma PautaGerada).
export async function encodeAndDownloadGif(frames: string[], opts: EncodeAndDownloadGifOptions): Promise<void> {
  const { gifWidth, gifHeight, filename } = opts;
  const toBase64 = async (src: string): Promise<string> => {
    if (src.startsWith("data:")) return src;
    const response = await fetch(src);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };
  const framesBase64 = await Promise.all(frames.map(toBase64));
  const gifshot = await loadGifshot();

  await new Promise<void>((resolve, reject) => {
    gifshot.createGIF({
      images: framesBase64,
      gifWidth,
      gifHeight,
      interval: 0.7,
      numFrames: framesBase64.length,
      frameDuration: 1,
      // sampleInterval baixo = amostragem densa de pixels ao treinar a paleta NeuQuant (ver nota
      // original em PreviewModal.tsx — sem isso, highlights pequenos/brilhantes viram feixes de luz).
      sampleInterval: 1,
      numWorkers: 2,
    }, (obj: any) => {
      if (!obj.error) {
        const link = document.createElement("a");
        link.download = filename;
        link.href = obj.image;
        link.click();
        resolve();
      } else {
        console.error("[encodeAndDownloadGif] gifshot error:", obj.error);
        framesBase64.forEach((src, i) => {
          const link = document.createElement("a");
          link.download = filename.replace(/\.gif$/i, "") + `-frame-${i + 1}.${src.startsWith("data:image/webp") ? "webp" : "png"}`;
          link.href = src;
          link.click();
        });
        resolve();
      }
    });
  });
}
