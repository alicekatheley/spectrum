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
  const familiaFonte = ev?.familiaFonte ?? 'Georgia, serif';

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const SIZE = 800;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d')!;

      // 1. Imagem base
      ctx.drawImage(img, 0, 0, SIZE, SIZE);

      // 2. Overlay gradiente no topo para legibilidade
      const topZoneH = SIZE * 0.32;
      const grad = ctx.createLinearGradient(0, 0, 0, topZoneH);
      grad.addColorStop(0, 'rgba(0,0,0,0.62)');
      grad.addColorStop(1, 'rgba(0,0,0,0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, SIZE, topZoneH);

      // 3. Headline
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = corTexto;
      ctx.textAlign = 'center';
      const headlineSizeBase = ev?.tamanhoHeadline === 'pequeno'
        ? Math.round(SIZE * 0.052)
        : ev?.tamanhoHeadline === 'medio'
          ? Math.round(SIZE * 0.062)
          : Math.round(SIZE * 0.072);
      ctx.font = `${pesoFonte} ${headlineSizeBase}px ${familiaFonte}`;
      const maxWidth = SIZE * 0.84;

      const wrapText = (text: string, fontSize: number, fontSpec: string): string[] => {
        ctx.font = `${pesoFonte} ${fontSize}px ${fontSpec}`;
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

      const headlineLines = wrapText(headline, headlineSizeBase, familiaFonte);
      const lineH = headlineSizeBase * 1.25;
      const headlineStartY = SIZE * 0.10;
      headlineLines.forEach((line, i) => {
        ctx.font = `${pesoFonte} ${headlineSizeBase}px ${familiaFonte}`;
        ctx.fillText(line, SIZE / 2, headlineStartY + i * lineH);
      });

      // 4. Sub-headline
      const subSize = Math.round(SIZE * 0.037);
      ctx.shadowBlur = 5;
      ctx.font = `600 ${subSize}px Arial, sans-serif`;
      ctx.fillStyle = corSubheadline;
      const subStartY = headlineStartY + headlineLines.length * lineH + SIZE * 0.022;
      const subLines = wrapText(subheadline, subSize, 'Arial, sans-serif');
      subLines.forEach((line, i) => {
        ctx.font = `600 ${subSize}px Arial, sans-serif`;
        ctx.fillText(line, SIZE / 2, subStartY + i * (subSize * 1.3));
      });

      // 5. Overlay no rodapé para o botão
      ctx.shadowBlur = 0;
      const bottomZoneH = SIZE * 0.20;
      const bottomGrad = ctx.createLinearGradient(0, SIZE - bottomZoneH, 0, SIZE);
      bottomGrad.addColorStop(0, 'rgba(0,0,0,0.0)');
      bottomGrad.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = bottomGrad;
      ctx.fillRect(0, SIZE - bottomZoneH, SIZE, bottomZoneH);

      // 6. Botão CTA
      const btnW = SIZE * 0.50;
      const btnH = SIZE * 0.073;
      const btnX = (SIZE - btnW) / 2;
      const btnY = SIZE * 0.876;
      const btnRadius = estiloBotao === 'retangular' ? 8 : btnH * 0.5;

      if (estiloBotao === 'outline') {
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, btnRadius);
        ctx.fill();
        ctx.strokeStyle = corBotao;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, btnRadius);
        ctx.stroke();
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = corBotao;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, btnRadius);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, btnRadius);
        ctx.stroke();
      }

      const ctaSize = Math.round(SIZE * 0.038);
      ctx.font = `800 ${ctaSize}px Arial, sans-serif`;
      ctx.fillStyle = corTextoBotao;
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.textAlign = 'center';
      ctx.fillText(cta, SIZE / 2, btnY + btnH * 0.67);

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem para composição'));
    img.src = imageDataUrl;
  });
}
