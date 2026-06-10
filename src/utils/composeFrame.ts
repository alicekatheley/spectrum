export interface ComposeFrameOptions {
  imageDataUrl: string;
  headline: string;
  subheadline: string;
  cta: string;
  marca: 'Apice' | 'Barbours';
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
};

const SYSTEM_FONTS = new Set([
  'georgia', 'arial', 'helvetica', 'times new roman', 'times',
  'courier new', 'impact', 'verdana', 'trebuchet ms',
]);

async function loadFont(familiaFonte: string, peso: string): Promise<string> {
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

export async function composeFrame(opts: ComposeFrameOptions): Promise<string> {
  const { imageDataUrl, headline, subheadline, cta, marca } = opts;
  const isApice = marca === 'Apice';
  const ev = opts.estiloVisual ?? {};

  const corTexto = ev.corTexto ?? '#FFFFFF';
  const corSubheadline = ev.corSubheadline ?? 'rgba(255,255,255,0.92)';
  const estiloBotao = ev.estiloBotao ?? 'pill';
  const corBotao = ev.corBotao ?? (isApice ? '#688D65' : '#BF0F26');
  const corTextoBotao = ev.corTextoBotao ?? '#FFFFFF';
  const pesoFonte = ev.pesoFonte ?? '900';
  const familiaFonteRaw = ev.familiaFonte ?? (isApice ? 'Playfair Display' : 'Oswald');
  const familiaFonteSubRaw = ev.familiaFonteSubheadline ?? 'Montserrat';

  const familiaFonte = await loadFont(familiaFonteRaw, pesoFonte);
  const familiaFonteSub = await loadFont(familiaFonteSubRaw, '600');

  console.log('[composeFrame] Estilo aplicado:', {
    familiaFonte: familiaFonteRaw,
    familiaFonteResolvida: familiaFonte,
    corTexto,
    estiloBotao,
    corBotao,
    tamanhoHeadline: ev.tamanhoHeadline,
  });

  const headlineSizeBase =
    ev.tamanhoHeadline === 'pequeno' ? 52 :
    ev.tamanhoHeadline === 'medio'   ? 62 : 72;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const SIZE = 800;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d')!;

      // 1. Imagem base
      ctx.drawImage(img, 0, 0, SIZE, SIZE);

      // 2. Overlay topo
      const topH = SIZE * 0.34;
      const topGrad = ctx.createLinearGradient(0, 0, 0, topH);
      topGrad.addColorStop(0, 'rgba(0,0,0,0.60)');
      topGrad.addColorStop(0.65, 'rgba(0,0,0,0.18)');
      topGrad.addColorStop(1, 'rgba(0,0,0,0.0)');
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, SIZE, topH);

      // 3. Overlay rodapé
      const botH = SIZE * 0.24;
      const botGrad = ctx.createLinearGradient(0, SIZE - botH, 0, SIZE);
      botGrad.addColorStop(0, 'rgba(0,0,0,0.0)');
      botGrad.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = botGrad;
      ctx.fillRect(0, SIZE - botH, SIZE, botH);

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

      // ZONA DE TEXTO SEGURA: máximo 38% do topo (0 a 304px em 800x800)
      const TEXT_ZONE_MAX_H = SIZE * 0.38;
      const TEXT_ZONE_TOP = SIZE * 0.04;
      const maxW = SIZE * 0.88;

      // Calcular tamanhos que cabem juntos na zona
      let hSize = headlineSizeBase;
      let sSize = Math.round(hSize * 0.46);

      let hLines: string[] = [];
      let sLines: string[] = [];

      // Reduzir até tudo caber em 30%
      for (let attempt = 0; attempt < 20; attempt++) {
        hLines = wrap(headline, maxW, `${pesoFonte} ${hSize}px ${familiaFonte}`);
        sLines = wrap(subheadline, maxW * 0.86, `600 ${sSize}px ${familiaFonteSub}`);

        const hBlockH = hLines.length * (hSize * 1.2);
        const sBlockH = sLines.length * (sSize * 1.28);
        const gap = SIZE * 0.010;
        const totalH = hBlockH + gap + sBlockH;

        if (totalH <= TEXT_ZONE_MAX_H) break;

        // Reduzir proporcionalmente
        hSize = Math.max(hSize - 3, 28);
        sSize = Math.max(Math.round(hSize * 0.46), 16);
      }

      const hLineH = hSize * 1.2;
      const sLineH = sSize * 1.28;
      // 4. Headline
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 14;
      ctx.fillStyle = corTexto;

      let hY = TEXT_ZONE_TOP + hSize;
      hLines.forEach(line => {
        ctx.font = `${pesoFonte} ${hSize}px ${familiaFonte}`;
        ctx.fillText(line, SIZE / 2, hY);
        hY += hLineH;
      });

      // 5. Sub-headline — colado imediatamente abaixo do headline
      ctx.shadowBlur = 5;
      ctx.fillStyle = corSubheadline;
      const gap = 6; // 6px fixos — quase colado
      let sY = hY + gap + sSize;
      sLines.forEach(line => {
        ctx.font = `600 ${sSize}px ${familiaFonteSub}`;
        ctx.fillText(line, SIZE / 2, sY);
        sY += sLineH;
      });

      // 6. Botão CTA
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.shadowOffsetY = 0;

      const btnW = SIZE * 0.52;
      const btnH = SIZE * 0.074;
      const btnX = (SIZE - btnW) / 2;
      const btnY = SIZE * 0.874;
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

      const ctaSize = 34;
      ctx.font = `800 ${ctaSize}px ${familiaFonteSub}`;
      ctx.fillStyle = corTextoBotao;
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillText(cta.toUpperCase(), SIZE / 2, btnY + btnH * 0.665);

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = imageDataUrl;
  });
}
