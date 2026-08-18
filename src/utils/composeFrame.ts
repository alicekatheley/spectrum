const RATIO_DIMENSIONS: Record<string, [number, number]> = {
  '1:1':  [800, 800],
  '3:4':  [800, 1067],
  '4:3':  [1067, 800],
  '16:9': [1200, 675],
  '9:16': [675, 1200],
};

export function resolveCanvasSize(aspectRatio?: string): [number, number] {
  if (!aspectRatio) return RATIO_DIMENSIONS['1:1'];
  if (aspectRatio.startsWith('custom_')) {
    const [w, h] = aspectRatio.replace('custom_', '').split('x').map(Number);
    if (w > 0 && h > 0) {
      // Escalar mantendo a razão original para o lado maior não passar de 1200px
      const scale = 1200 / Math.max(w, h);
      return [Math.round(w * scale), Math.round(h * scale)];
    }
  }
  return RATIO_DIMENSIONS[aspectRatio] ?? RATIO_DIMENSIONS['1:1'];
}

// Fonte única dos defaults de tamanho de headline/subheadline — usado tanto no composeFrame
// (render final em canvas) quanto na prévia ao vivo em CSS (aba "Editar Copy"), pra evitar
// que as duas implementações divirjam e a prévia mostre um layout diferente do resultado real.
export function resolveHeadlineSizePx(headlineSizePx?: number, tamanhoHeadline?: 'grande' | 'medio' | 'pequeno'): number {
  return headlineSizePx ?? (
    tamanhoHeadline === 'pequeno' ? 52 :
    tamanhoHeadline === 'medio'   ? 62 : 72
  );
}

export function resolveSubheadlineSizePx(headlineSizePx: number, subheadlineSizePx?: number): number {
  return subheadlineSizePx ?? Math.round(headlineSizePx * 0.44);
}

export interface ComposeFrameOptions {
  imageDataUrl: string;
  headline: string;
  subheadline: string;
  cta: string;
  marca: 'Apice' | 'Barbours';
  aspectRatio?: string;
  estiloVisual?: {
    corTexto?: string;
    corSubheadline?: string;
    estiloBotao?: 'pill' | 'retangular' | 'outline';
    corBotao?: string;
    corTextoBotao?: string;
    tamanhoHeadline?: 'grande' | 'medio' | 'pequeno';
    pesoFonte?: string;
    familiaFonte?: string;
    familiaFonteSubheadline?: string;
    familiaFonteBotao?: string;
    // Posição/tamanho manuais — em % do canvas (0-100) ou px de fonte. Quando ausentes,
    // usa o layout automático padrão (headline no topo, sub logo abaixo, botão no rodapé).
    headlineTopPercent?: number;
    headlineSizePx?: number;
    subheadlineTopPercent?: number;
    subheadlineSizePx?: number;
    buttonTopPercent?: number;
    buttonWidthPercent?: number;
    buttonHeightPercent?: number;
    buttonFontSizePx?: number;
  };
}

const GOOGLE_FONTS_MAP: Record<string, string> = {
  'playfair display': 'Playfair+Display',
  'playfair': 'Playfair+Display',
  'montserrat': 'Montserrat',
  'pacifico': 'Pacifico',
  'roboto': 'Roboto',
  'lato': 'Lato',
  'raleway': 'Raleway',
  'oswald': 'Oswald',
  'merriweather': 'Merriweather',
  'nunito sans': 'Nunito+Sans',
  'nunito': 'Nunito',
  'open sans': 'Open+Sans',
  'open': 'Open+Sans',
  'source sans': 'Source+Sans+3',
  'ubuntu': 'Ubuntu',
  'exo': 'Exo+2',
  'exo 2': 'Exo+2',
  'rubik': 'Rubik',
  'karla': 'Karla',
  'manrope': 'Manrope',
  'outfit': 'Outfit',
  'space grotesk': 'Space+Grotesk',
  'dm sans': 'DM+Sans',
  'figtree': 'Figtree',
  'plus jakarta sans': 'Plus+Jakarta+Sans',
  'jakarta': 'Plus+Jakarta+Sans',
  'poppins': 'Poppins',
  'dancing script': 'Dancing+Script',
  'lobster': 'Lobster',
  'abril fatface': 'Abril+Fatface',
  'bebas neue': 'Bebas+Neue',
  'bebas': 'Bebas+Neue',
  'righteous': 'Righteous',
  'fredoka one': 'Fredoka+One',
  'fredoka': 'Fredoka+One',
  'bangers': 'Bangers',
  'permanent marker': 'Permanent+Marker',
  'caveat': 'Caveat',
  'satisfy': 'Satisfy',
  'comfortaa': 'Comfortaa',
  'inter': 'Inter',
  'barlow': 'Barlow',
  'teko': 'Teko',
  'fjalla one': 'Fjalla+One',
  'black han sans': 'Black+Han+Sans',
  'boogaloo': 'Boogaloo',
  'cormorant garamond': 'Cormorant+Garamond',
  'cormorant': 'Cormorant+Garamond',
  'eb garamond': 'EB+Garamond',
  'libre baskerville': 'Libre+Baskerville',
  'crimson text': 'Crimson+Text',
  'spectral': 'Spectral',
  'vollkorn': 'Vollkorn',
  'cardo': 'Cardo',
  'domine': 'Domine',
  'source sans 3': 'Source+Sans+3',
  'syne': 'Syne',
  'urbanist': 'Urbanist',
  'jost': 'Jost',
  'lexend': 'Lexend',
  'barlow condensed': 'Barlow+Condensed',
  'anton': 'Anton',
  'squada one': 'Squada+One',
  'russo one': 'Russo+One',
  'chakra petch': 'Chakra+Petch',
  'saira condensed': 'Saira+Condensed',
  'kanit': 'Kanit',
  'prompt': 'Prompt',
  'rajdhani': 'Rajdhani',
  'yanone kaffeesatz': 'Yanone+Kaffeesatz',
  'lilita one': 'Lilita+One',
  'titan one': 'Titan+One',
  'chewy': 'Chewy',
  'patrick hand': 'Patrick+Hand',
  'gochi hand': 'Gochi+Hand',
  'kalam': 'Kalam',
  'gloria hallelujah': 'Gloria+Hallelujah',
  'sacramento': 'Sacramento',
  'great vibes': 'Great+Vibes',
  'allura': 'Allura',
  'parisienne': 'Parisienne',
  'alex brush': 'Alex+Brush',
  'courgette': 'Courgette',
  'kaushan script': 'Kaushan+Script',
  'lobster two': 'Lobster+Two',
  'marck script': 'Marck+Script',
  'pinyon script': 'Pinyon+Script',
  'rochester': 'Rochester',
  'space mono': 'Space+Mono',
  'jetbrains mono': 'JetBrains+Mono',
  'fira code': 'Fira+Code',
  'source code pro': 'Source+Code+Pro',
  'ibm plex mono': 'IBM+Plex+Mono',
  'courier prime': 'Courier+Prime',
  'share tech mono': 'Share+Tech+Mono',
  'arvo': 'Arvo',
  'lora': 'Lora',
};

const SYSTEM_FONTS = new Set([
  'georgia', 'arial', 'helvetica', 'times new roman', 'times',
  'courier new', 'impact', 'verdana', 'trebuchet ms',
]);

export async function loadFont(familiaFonte: string, peso: string): Promise<string> {
  const nomeFonte = familiaFonte.split(',')[0].trim().replace(/['"]/g, '').toLowerCase();
  if (SYSTEM_FONTS.has(nomeFonte)) return familiaFonte;

  const googleName = GOOGLE_FONTS_MAP[nomeFonte];
  if (!googleName) {
    console.warn(`[composeFrame] Fonte "${nomeFonte}" não mapeada. Usando padrão.`);
    return 'Georgia, serif';
  }

  const cssName = googleName.replace(/\+/g, ' ');
  const pesoNum = ['400', '600', '700', '800', '900'].includes(peso) ? peso : '700';

  try {
    if (document.fonts.check(`${pesoNum} 48px "${cssName}"`)) return `"${cssName}", sans-serif`;

    const linkId = `gfont-${googleName}`;
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${googleName}:wght@400;600;700;800;900&display=swap`;
      document.head.appendChild(link);
    }

    await Promise.race([
      document.fonts.load(`${pesoNum} 48px "${cssName}"`),
      new Promise(r => setTimeout(r, 4000)),
    ]);

    return `"${cssName}", sans-serif`;
  } catch {
    return 'Georgia, serif';
  }
}

// Corrige vinheta/gradiente escuro que o modelo de geração de imagem às vezes aplica no
// topo/rodapé (apesar da instrução de prompt pra evitar isso). Mede o brilho médio em faixas
// horizontais e "levanta" as faixas mais escuras que a faixa mais clara via blend 'screen' —
// faixas já uniformes recebem alpha ~0 e ficam praticamente intocadas.
function flattenVerticalVignette(ctx: CanvasRenderingContext2D, img: CanvasImageSource, width: number, height: number) {
  const ROWS = 24;
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = 1;
  sampleCanvas.height = ROWS;
  const sctx = sampleCanvas.getContext('2d')!;
  sctx.drawImage(img, 0, 0, width, height, 0, 0, 1, ROWS);

  let rowLuma: number[];
  try {
    const data = sctx.getImageData(0, 0, 1, ROWS).data;
    rowLuma = Array.from({ length: ROWS }, (_, i) => {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      return 0.299 * r + 0.587 * g + 0.114 * b;
    });
  } catch {
    return; // Canvas tainted (CORS) — não corrige, mas não quebra a geração.
  }

  const sorted = [...rowLuma].sort((a, b) => a - b);
  const target = sorted[Math.floor(sorted.length * 0.75)]; // faixa clara de referência (p75)
  const MAX_ALPHA = 0.5;

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  rowLuma.forEach((luma, i) => {
    const deficit = Math.max(0, target - luma);
    const alpha = Math.min(MAX_ALPHA, deficit / 255);
    grad.addColorStop(i / (ROWS - 1), `rgba(255,255,255,${alpha.toFixed(3)})`);
  });

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export async function composeFrame(opts: ComposeFrameOptions): Promise<string> {
  const { imageDataUrl, headline, subheadline, cta, marca, aspectRatio } = opts;
  const isApice = marca === 'Apice';
  const ev = opts.estiloVisual ?? {};

  const corTexto = ev.corTexto ?? '#FFFFFF';
  const corSubheadline = ev?.corSubheadline || opts.estiloVisual?.corSubheadline || 'rgba(255,255,255,0.90)';
  const estiloBotao = ev.estiloBotao ?? 'pill';
  const corBotao = ev.corBotao ?? (isApice ? '#688D65' : '#BF0F26');
  const corTextoBotao = ev.corTextoBotao ?? '#FFFFFF';
  const pesoFonte = ev.pesoFonte ?? '900';
  const familiaFonteRaw = ev.familiaFonte ?? (isApice ? 'Playfair Display' : 'Oswald');
  const familiaFonteSubRaw = ev?.familiaFonteSubheadline || opts.estiloVisual?.familiaFonte || (isApice ? 'Montserrat' : 'Inter');

  const familiaFonteBotaoRaw = ev?.familiaFonteBotao || familiaFonteSubRaw;

  const familiaFonte = await loadFont(familiaFonteRaw, pesoFonte);
  const familiaFonteSub = await loadFont(familiaFonteSubRaw, '600');
  const familiaFonteBotao = await loadFont(familiaFonteBotaoRaw, '800');

  console.log('[composeFrame] Estilo aplicado:', {
    familiaFonte: familiaFonteRaw,
    familiaFonteResolvida: familiaFonte,
    corTexto,
    estiloBotao,
    corBotao,
    tamanhoHeadline: ev.tamanhoHeadline,
  });

  const headlineSizeBase = resolveHeadlineSizePx(ev.headlineSizePx, ev.tamanhoHeadline);
  // Quando o tamanho é escolhido manualmente, não encolher automaticamente pra caber na zona —
  // o usuário já decidiu o tamanho, respeitar exatamente.
  const tamanhoManual = ev.headlineSizePx != null || ev.subheadlineSizePx != null;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const [WIDTH, HEIGHT] = resolveCanvasSize(aspectRatio);
      const canvas = document.createElement('canvas');
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      const ctx = canvas.getContext('2d')!;

      // 1. Imagem base
      ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);

      // 2. Corrige vinheta escura que o modelo de imagem eventualmente gera no topo/rodapé.
      flattenVerticalVignette(ctx, img, WIDTH, HEIGHT);

      // Sem overlay de escurecimento fixo pra "dar contraste" ao texto — a legibilidade vem
      // só da sombra (shadowColor/shadowBlur) aplicada em cada elemento abaixo.

      // Helper: wrap com font-size adaptativo
      const wrap = (text: string, maxW: number, fontSpec: string): string[] => {
        ctx.font = fontSpec;
        const words = text.split(' ');
        const lines: string[] = [];
        let cur = '';
        for (const w of words) {
          const test = cur ? `${cur} ${w}` : w;
          if (ctx.measureText(test).width > maxW && cur) {
            lines.push(cur); cur = w;
          } else cur = test;
        }
        if (cur) lines.push(cur);
        return lines;
      };

      // ZONA DE TEXTO: headline + sub agrupados no topo, máximo 32%
      const ZONA_MAX_PX = HEIGHT * 0.32;
      const ZONA_TOP_PX = ev.headlineTopPercent != null ? HEIGHT * (ev.headlineTopPercent / 100) : HEIGHT * 0.035;
      const maxW = WIDTH * 0.88;

      let hSize = headlineSizeBase;
      let sSize = resolveSubheadlineSizePx(hSize, ev.subheadlineSizePx);
      let hLines: string[] = [];
      let sLines: string[] = [];

      if (tamanhoManual) {
        // Tamanho escolhido manualmente — só quebra linha, não encolhe pra caber na zona.
        hLines = wrap(headline, maxW, `${pesoFonte} ${hSize}px ${familiaFonte}`);
        sLines = wrap(subheadline, maxW * 0.86, `600 ${sSize}px ${familiaFonteSub}`);
      } else {
        for (let attempt = 0; attempt < 30; attempt++) {
          hLines = wrap(headline, maxW, `${pesoFonte} ${hSize}px ${familiaFonte}`);
          sLines = wrap(subheadline, maxW * 0.86, `600 ${sSize}px ${familiaFonteSub}`);
          // Cálculo CORRETO: sem linha extra no final
          const hBlockH = (hLines.length - 1) * (hSize * 1.18) + hSize;
          const sBlockH = (sLines.length - 1) * (sSize * 1.25) + sSize;
          const totalH = hBlockH + 12 + sBlockH;
          if (ZONA_TOP_PX + totalH <= ZONA_MAX_PX) break;
          hSize = Math.max(hSize - 2, 22);
          sSize = Math.max(Math.round(hSize * 0.44), 13);
        }
      }

      const hLineH = hSize * 1.18;
      const sLineH = sSize * 1.25;

      // 4. Headline
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = 14;
      ctx.fillStyle = corTexto;

      let hY = ZONA_TOP_PX + hSize;
      hLines.forEach((line, i) => {
        ctx.font = `${pesoFonte} ${hSize}px ${familiaFonte}`;
        ctx.fillText(line, WIDTH / 2, hY);
        if (i < hLines.length - 1) hY += hLineH;
      });

      // 5. Sub-headline — por padrão 12px abaixo da ÚLTIMA linha do headline,
      // ou em posição própria se subheadlineTopPercent for definido manualmente.
      ctx.shadowBlur = 5;
      ctx.fillStyle = corSubheadline;
      let sY = ev.subheadlineTopPercent != null
        ? HEIGHT * (ev.subheadlineTopPercent / 100) + sSize
        : hY + 12 + sSize;
      sLines.forEach((line, i) => {
        ctx.font = `600 ${sSize}px ${familiaFonteSub}`;
        ctx.fillText(line, WIDTH / 2, sY);
        if (i < sLines.length - 1) sY += sLineH;
      });

      // 6. Botão CTA
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.shadowOffsetY = 0;

      const btnW = ev.buttonWidthPercent != null ? WIDTH * (ev.buttonWidthPercent / 100) : WIDTH * 0.52;
      const btnH = ev.buttonHeightPercent != null ? HEIGHT * (ev.buttonHeightPercent / 100) : HEIGHT * 0.074;
      const btnX = (WIDTH - btnW) / 2;
      const btnY = ev.buttonTopPercent != null ? HEIGHT * (ev.buttonTopPercent / 100) : HEIGHT * 0.874;
      const btnR = estiloBotao === 'retangular' ? 10 : btnH * 0.5;

      if (estiloBotao === 'outline') {
        ctx.strokeStyle = corBotao;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, btnR);
        ctx.stroke();
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = corBotao;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, btnR);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, btnR);
        ctx.stroke();
      }

      const ctaSize = ev.buttonFontSizePx ?? 34;
      ctx.font = `800 ${ctaSize}px ${familiaFonteBotao}`;
      ctx.fillStyle = corTextoBotao;
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillText(cta.toUpperCase(), WIDTH / 2, btnY + btnH * 0.665);

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = imageDataUrl;
  });
}
