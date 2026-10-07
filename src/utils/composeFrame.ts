import { parseDestaque, ESCALA_DESTAQUE, COR_DESTAQUE_PADRAO, temDestaque, type SegmentoDestaque } from './destaque';

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
    // Cor dos trechos marcados com ~texto~ (ver utils/destaque.ts).
    corDestaque?: string;
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

// Cache por (fonte + peso) — os 3 frames de um mesmo GIF chamam loadFont() em sequência para
// a mesma família/peso. Sem cache, cada frame corria sua própria race contra o timeout de
// carregamento: o primeiro frame podia bater o timeout (fonte ainda baixando) e cair no
// fallback Georgia, enquanto o segundo/terceiro já achavam a fonte no cache do navegador e
// resolviam certo — resultado: cada frame do mesmo GIF saía com uma fonte de título diferente.
// Compartilhar a mesma Promise garante que todos os frames esperem o mesmo carregamento e
// cheguem exatamente ao mesmo resultado (fonte real ou fallback), nunca uma mistura dos dois.
const fontLoadCache = new Map<string, Promise<string>>();

async function loadFontUncached(familiaFonte: string, peso: string): Promise<string> {
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

    // Sem race contra timeout: esperar de verdade o carregamento evita que um frame renderize
    // com o fallback só porque a rede estava lenta naquele instante — o cache acima garante que
    // essa espera só acontece uma vez por fonte, não uma vez por frame.
    await document.fonts.load(`${pesoNum} 48px "${cssName}"`);

    return document.fonts.check(`${pesoNum} 48px "${cssName}"`) ? `"${cssName}", sans-serif` : 'Georgia, serif';
  } catch {
    return 'Georgia, serif';
  }
}

export async function loadFont(familiaFonte: string, peso: string): Promise<string> {
  const key = `${familiaFonte}|${peso}`;
  let cached = fontLoadCache.get(key);
  if (!cached) {
    cached = loadFontUncached(familiaFonte, peso);
    fontLoadCache.set(key, cached);
  }
  return cached;
}

export async function composeFrame(opts: ComposeFrameOptions): Promise<string> {
  const { imageDataUrl, cta, marca, aspectRatio } = opts;
  // Convenção visual do playbook: headline e sub-headline sempre em caixa alta no banner final
  // (mesmo padrão já aplicado via CSS em BannerSimulador/ResultPauta) — força aqui pq canvas
  // não tem text-transform, então se o texto salvo vier em minúsculas (regeneração de copy,
  // edição manual etc.) o resultado final não pode "vazar" a capitalização original.
  const headline = (opts.headline ?? '').toUpperCase();
  const subheadline = (opts.subheadline ?? '').toUpperCase();
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
  // Trechos *negrito* do sub-headline usam peso 900 — carregar antes pra não cair no fallback.
  if (temDestaque(opts.subheadline)) await loadFont(familiaFonteSubRaw, '900');
  const corDestaque = ev.corDestaque || COR_DESTAQUE_PADRAO;

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

      // 1. Imagem base — sem nenhum ajuste de brilho/contraste em cima: o PiApp já entrega o
      // frame com iluminação uniforme, e uma correção heurística por faixas horizontais aqui
      // era o que estava introduzindo o efeito de vinheta (lia o objeto central mais escuro/claro
      // que o fundo como "vinheta" e clareava/escurecia faixas inteiras por engano).
      ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);

      // Sem overlay de escurecimento fixo pra "dar contraste" ao texto — a legibilidade vem
      // só da sombra (shadowColor/shadowBlur) aplicada em cada elemento abaixo.

      // Texto rico: cada linha é uma lista de palavras, cada palavra uma lista de trechos com
      // estilo próprio (negrito/maior/cor — ver utils/destaque.ts). Sem marcadores, cai no mesmo
      // layout de antes: um trecho por palavra, escala 1, linha centralizada.
      type Palavra = SegmentoDestaque[];
      interface Linha { palavras: Palavra[]; largura: number; escala: number }

      const palavrasDe = (text: string): Palavra[] => {
        const palavras: Palavra[] = [];
        let atual: Palavra = [];
        for (const seg of parseDestaque(text)) {
          const partes = seg.texto.split(' ');
          partes.forEach((parte, i) => {
            if (i > 0) { if (atual.length) palavras.push(atual); atual = []; }
            if (parte) atual.push({ ...seg, texto: parte });
          });
        }
        if (atual.length) palavras.push(atual);
        return palavras;
      };

      const fonteDo = (seg: SegmentoDestaque, size: number, familia: string, peso: string) =>
        `${seg.negrito ? '900' : peso} ${Math.round(size * (seg.maior ? ESCALA_DESTAQUE : 1))}px ${familia}`;

      const larguraPalavra = (p: Palavra, size: number, familia: string, peso: string) =>
        p.reduce((acc, seg) => { ctx.font = fonteDo(seg, size, familia, peso); return acc + ctx.measureText(seg.texto).width; }, 0);

      const escalaPalavra = (p: Palavra) => (p.some((s) => s.maior) ? ESCALA_DESTAQUE : 1);

      const wrap = (text: string, maxW: number, size: number, familia: string, peso: string): Linha[] => {
        ctx.font = `${peso} ${size}px ${familia}`;
        const espaco = ctx.measureText(' ').width;
        const linhas: Linha[] = [];
        let cur: Linha | null = null;
        for (const p of palavrasDe(text)) {
          const w = larguraPalavra(p, size, familia, peso);
          if (cur && cur.largura + espaco + w > maxW) { linhas.push(cur); cur = null; }
          if (!cur) cur = { palavras: [p], largura: w, escala: escalaPalavra(p) };
          else { cur.palavras.push(p); cur.largura += espaco + w; cur.escala = Math.max(cur.escala, escalaPalavra(p)); }
        }
        if (cur) linhas.push(cur);
        return linhas;
      };

      // Altura do bloco: 1ª linha ocupa size×escala, cada linha seguinte soma o entrelinha dela.
      const alturaBloco = (linhas: Linha[], size: number, fator: number) =>
        linhas.reduce((acc, l, i) => acc + (i === 0 ? size * l.escala : size * fator * l.escala), 0);

      // Desenha as linhas a partir do topo e devolve o baseline da última.
      const desenhar = (
        linhas: Linha[], top: number, size: number, fator: number,
        familia: string, peso: string, cor: string,
      ): number => {
        ctx.font = `${peso} ${size}px ${familia}`;
        const espaco = ctx.measureText(' ').width;
        ctx.textAlign = 'left';
        let y = top;
        linhas.forEach((linha, i) => {
          y += i === 0 ? size * linha.escala : size * fator * linha.escala;
          let x = WIDTH / 2 - linha.largura / 2;
          linha.palavras.forEach((p, j) => {
            if (j > 0) x += espaco;
            for (const seg of p) {
              ctx.font = fonteDo(seg, size, familia, peso);
              ctx.fillStyle = seg.cor ? corDestaque : cor;
              ctx.fillText(seg.texto, x, y);
              // Headline já sai em peso 900: negrito ali só aparece engrossando o traço.
              if (seg.negrito && Number(peso) >= 800) {
                ctx.strokeStyle = ctx.fillStyle;
                ctx.lineWidth = size * (seg.maior ? ESCALA_DESTAQUE : 1) * 0.045;
                ctx.lineJoin = 'round';
                ctx.strokeText(seg.texto, x, y);
              }
              x += ctx.measureText(seg.texto).width;
            }
          });
        });
        ctx.textAlign = 'center';
        return y;
      };

      // ZONA DE TEXTO: headline + sub agrupados no topo, máximo 32%
      const ZONA_MAX_PX = HEIGHT * 0.32;
      const ZONA_TOP_PX = ev.headlineTopPercent != null ? HEIGHT * (ev.headlineTopPercent / 100) : HEIGHT * 0.035;
      const maxW = WIDTH * 0.88;

      let hSize = headlineSizeBase;
      let sSize = resolveSubheadlineSizePx(hSize, ev.subheadlineSizePx);
      let hLines: Linha[] = [];
      let sLines: Linha[] = [];

      if (tamanhoManual) {
        // Tamanho escolhido manualmente — só quebra linha, não encolhe pra caber na zona.
        hLines = wrap(headline, maxW, hSize, familiaFonte, pesoFonte);
        sLines = wrap(subheadline, maxW * 0.86, sSize, familiaFonteSub, '600');
      } else {
        for (let attempt = 0; attempt < 30; attempt++) {
          hLines = wrap(headline, maxW, hSize, familiaFonte, pesoFonte);
          sLines = wrap(subheadline, maxW * 0.86, sSize, familiaFonteSub, '600');
          const totalH = alturaBloco(hLines, hSize, 1.18) + 12 + alturaBloco(sLines, sSize, 1.25);
          if (ZONA_TOP_PX + totalH <= ZONA_MAX_PX) break;
          hSize = Math.max(hSize - 2, 22);
          sSize = Math.max(Math.round(hSize * 0.44), 13);
        }
      }

      // 4. Headline
      const hY = desenhar(hLines, ZONA_TOP_PX, hSize, 1.18, familiaFonte, pesoFonte, corTexto);

      // 5. Sub-headline — por padrão 12px abaixo da ÚLTIMA linha do headline,
      // ou em posição própria se subheadlineTopPercent for definido manualmente.
      const sTop = ev.subheadlineTopPercent != null ? HEIGHT * (ev.subheadlineTopPercent / 100) : hY + 12;
      desenhar(sLines, sTop, sSize, 1.25, familiaFonteSub, '600', corSubheadline);

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

      // WebP em vez de PNG: o frame composto vai pro Storage via /api/save-frame e em PNG
      // cada um ocupava ~1,2 MB — o bucket estourou a cota de 1 GB do plano Free do Supabase.
      resolve(canvas.toDataURL('image/webp', 0.9));
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = imageDataUrl;
  });
}
