export interface ComposeFrameOptions {
  imageDataUrl: string;
  headline: string;
  subheadline: string;
  cta: string;
  marca: 'Apice' | 'Barbours';
}

export async function composeFrame(opts: ComposeFrameOptions): Promise<string> {
  const { imageDataUrl, headline, subheadline, cta, marca } = opts;
  const isApice = marca === 'Apice';

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
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      const headlineSize = Math.round(SIZE * 0.075);
      ctx.font = `900 ${headlineSize}px Georgia, serif`;
      const maxWidth = SIZE * 0.84;

      const wrapText = (text: string, fontSize: number): string[] => {
        ctx.font = `900 ${fontSize}px Georgia, serif`;
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

      const headlineLines = wrapText(headline, headlineSize);
      const lineH = headlineSize * 1.25;
      const headlineStartY = SIZE * 0.10;
      headlineLines.forEach((line, i) => {
        ctx.font = `900 ${headlineSize}px Georgia, serif`;
        ctx.fillText(line, SIZE / 2, headlineStartY + i * lineH);
      });

      // 4. Sub-headline
      const subSize = Math.round(SIZE * 0.037);
      ctx.shadowBlur = 5;
      ctx.font = `600 ${subSize}px Arial, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      const subStartY = headlineStartY + headlineLines.length * lineH + SIZE * 0.022;
      const subLines = wrapText(subheadline, subSize);
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
      const radius = btnH * 0.24;
      const brandColor = isApice ? '#688D65' : '#BF0F26';
      ctx.fillStyle = brandColor;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, radius);
      ctx.fill();
      const ctaSize = Math.round(SIZE * 0.038);
      ctx.font = `800 ${ctaSize}px Arial, sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(cta, SIZE / 2, btnY + btnH * 0.67);

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem para composição'));
    img.src = imageDataUrl;
  });
}
