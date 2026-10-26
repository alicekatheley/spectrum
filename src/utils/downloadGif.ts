import { loadGifshot } from "./loadGifshot";

// Dispara o download de um data URL (ou Blob) como arquivo. Data URLs grandes num <a download>
// solto falham em silêncio no Chrome (GIF de 1200px passa fácil de alguns MB), e alguns
// navegadores ignoram o click() em âncora fora do DOM — por isso converte pra Blob + object URL
// e anexa o link antes de clicar.
export function triggerDownload(data: string | Blob, filename: string): void {
  let blob: Blob;
  if (typeof data === "string") {
    const [header, base64] = data.split(",");
    const mime = header.match(/data:([^;]+)/)?.[1] ?? "application/octet-stream";
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    blob = new Blob([bytes], { type: mime });
  } else {
    blob = data;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

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
        triggerDownload(obj.image, filename);
        resolve();
      } else {
        console.error("[encodeAndDownloadGif] gifshot error:", obj.error);
        framesBase64.forEach((src, i) => {
          triggerDownload(src, filename.replace(/\.gif$/i, "") + `-frame-${i + 1}.${src.startsWith("data:image/webp") ? "webp" : "png"}`);
        });
        resolve();
      }
    });
  });
}
