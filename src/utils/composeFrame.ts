export interface ComposeFrameOptions {
  imageDataUrl: string;
  headline: string;
  subheadline: string;
  cta: string;
  marca: 'Apice' | 'Barbours';
  estiloVisual?: {
    corTexto: string;
    corSubheadline: string;
    estiloBotao: 'pill' | 'retangular' | 'outline';
    corBotao: string;
    corTextoBotao: string;
    tamanhoHeadline: 'grande' | 'medio' | 'pequeno';
    pesoFonte: string;
    familiaFonte: string;
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
  'nunito': 'Nunito',
  'poppins': 'Poppins',
  'dancing script': 'Dancing+Script',
  'dancing': 'Dancing+Script',
  'lobster': 'Lobster',
  'abril fatface': 'Abril+Fatface',
  'abril': 'Abril+Fatface',
  'bebas neue': 'Bebas+Neue',
  'bebas': 'Bebas+Neue',
  'righteous': 'Righteous',
  'fredoka': 'Fredoka+One',
  'bangers': 'Bangers',
  'permanent marker': 'Permanent+Marker',
  'caveat': 'Caveat',
  'satisfy': 'Satisfy',
  'comfortaa': 'Comfortaa',
};

const SYSTEM_FONTS = new Set([
  'georgia', 'arial', 'helvetica', 'times new roman', 'times',
  'courier new', 'courier', 'impact', 'verdana', 'trebuchet ms',
  'comic sans ms', 'palatino', 'garamond',
]);

async function loadGoogleFont(familiaFonte: string, peso: string): Promise<string> {
  const nomeFonte = familiaFonte.split(',')[0].trim().replace(/['"]/g, '').toLowerCase();

  if (SYSTEM_FONTS.has(nomeFonte)) {
    return familiaFonte;
  }

  const googleFontName = GOOGLE_FONTS_MAP[nomeFonte];
  if (!googleFontName) {
    console.warn(`[composeFrame] Fonte "${nomeFonte}" não encontrada no mapeamento. Usando Georgia como fallback.`);
    return 'Georgia, serif';
  }

  const cssName = googleFontName.replace(/\+/g, ' ');

  try {
    const pesoNumerico = ['400', '600', '700', '900'].includes(peso) ? peso : '700';
    const fontFaceCheck = `${pesoNumerico} 48px "${cssName}"`;

    if (document.fonts.check(fontFaceCheck)) {
      return `"${cssName}", serif`;
    }

    const linkId = `gfont-${googleFontName}`;
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${googleFontName}:wght@400;600;700;900&display=swap`;
      document.head.appendChild(link);
    }

    await Promise.race([
      document.fonts.load(`${pesoNumerico} 48px "${cssName}"`),
      new Promise(resolve => setTimeout(resolve, 3000)),
    ]);

    console.log(`[composeFrame] Fonte carregada: ${cssName}`);
    return `"${cssName}", serif`;
  } catch (err) {
    console.warn(`[composeFrame] Falha ao carregar fonte "${cssName}":`, err);
    return 'Georgia, serif';
  }
}

export async function composeFrame(opts: ComposeFrameOptions): Promise<string> {
  const { imageDataUrl, headline, subheadline, cta, marca } = opts;
  const isApice = marca === 'Apice';

  const ev = opts.estiloVisual;
  const corTexto = ev?.corTexto ?? '#FFFFFF';
  const corSubheadline = ev?.corSubheadline ?? 'rgba(255,255,255,0.90)';
  const estiloBotao = ev?.estiloBotao ?? 'pill';
  const corBotao = ev?.corBotao ?? (isApice ? '#688D65' : '#BF0F26');
  const corTextoBotao = ev?.corTextoBotao ?? '#FFFFFF';
  const pesoFonte = ev?.pesoFonte ?? '900';
  const familiaFonteRaw = ev?.familiaFonte ?? 'Georgia, serif';

  const familiaFonte = await loadGoogleFont(familiaFonteRaw, pesoFonte);

  const headlineSizeBase = ev?.tamanhoHeadline === 'pequeno'
    ? Math.round(800 * 0.052)
    : ev?.tamanhoHeadline === 'medio'
      ? Math.round(800 * 0.062)
      : Math.round(800 * 0.072);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const SIZE = 800;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d')!;

      ctx.drawImage(img, 0, 0, SIZE, SIZE);

      const topZoneH = SIZE * 0.32;
      const grad = ctx.createLinearGradient(0, 0, 0, topZoneH);
      grad.addColorStop(0, 'rgba(0,0,0,0.55)');
      grad.addColorStop(0.7, 'rgba(0,0,0,0.15)');
      grad.addColorStop(1, 'rgba(0,0,0,0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, SIZE, topZoneH);

      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = corTexto;
      ctx.textAlign = 'center';

      const maxWidth = SIZE * 0.86;

      const wrapText = (text: string, fontSize: number, fontSpec: string, weight: string): string[] => {
        ctx.font = `${weight} ${fontSize}px ${fontSpec}`;
        const words = text.split(' ');
        const lines: string[] = [];
        let current = '';
        for (const word of words) {
          const test = current ? `${current} ${word}` : word;
          if (ctx.measureText(test).width > maxWidth && current) {
            lines.push(current);
            current = word;
          } else {
            current = test;
          }
        }
        if (current) lines.push(current);
        return lines;
      };

      let headSize = headlineSizeBase;
      let headLines = wrapText(headline, headSize, familiaFonte, pesoFonte);
      while (headLines.length > 2 && headSize > 36) {
        headSize -= 3;
        headLines = wrapText(headline, headSize, familiaFonte, pesoFonte);
      }

      const lineH = headSize * 1.25;
      const headBlockH = headLines.length * lineH;
      const topZoneCenter = SIZE * 0.16;
      let headY = topZoneCenter - headBlockH / 2 + headSize;

      headLines.forEach((line) => {
        ctx.font = `${pesoFonte} ${headSize}px ${familiaFonte}`;
        ctx.fillText(line, SIZE / 2, headY);
        headY += lineH;
      });

      ctx.shadowBlur = 5;
      let subSize = Math.round(SIZE * 0.034);
      let subLines = wrapText(subheadline, subSize, 'Arial, sans-serif', '600');
      while (subLines.length > 2 && subSize > 22) {
        subSize -= 2;
        subLines = wrapText(subheadline, subSize, 'Arial, sans-serif', '600');
      }

      ctx.fillStyle = corSubheadline;
      const subStartY = headY + SIZE * 0.018;
      let subY = subStartY;
      subLines.forEach((line) => {
        ctx.font = `600 ${subSize}px Arial, sans-serif`;
        ctx.fillText(line, SIZE / 2, subY);
        subY += subSize * 1.35;
      });

      ctx.shadowBlur = 0;
      const bottomZoneH = SIZE * 0.22;
      const bottomGrad = ctx.createLinearGradient(0, SIZE - bottomZoneH, 0, SIZE);
      bottomGrad.addColorStop(0, 'rgba(0,0,0,0.0)');
      bottomGrad.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = bottomGrad;
      ctx.fillRect(0, SIZE - bottomZoneH, SIZE, bottomZoneH);

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      const btnW = SIZE * 0.50;
      const btnH = SIZE * 0.073;
      const btnX = (SIZE - btnW) / 2;
      const btnY = SIZE * 0.876;
      const btnRadius = estiloBotao === 'retangular' ? 8 : btnH * 0.5;

      if (estiloBotao === 'outline') {
        ctx.strokeStyle = corBotao;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, btnRadius);
        ctx.stroke();
        ctx.fillStyle = corBotao;
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = corBotao;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, btnRadius);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, btnRadius);
        ctx.stroke();
        ctx.fillStyle = corTextoBotao;
      }

      const ctaSize = Math.round(SIZE * 0.036);
      ctx.font = `800 ${ctaSize}px Arial, sans-serif`;
      ctx.fillStyle = corTextoBotao;
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.textAlign = 'center';
      ctx.fillText(cta.toUpperCase(), SIZE / 2, btnY + btnH * 0.665);

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = imageDataUrl;
  });
}
