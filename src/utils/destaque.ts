// Marcação de destaque em headline/sub-headline do banner. Três marcadores, combináveis:
//   *palavra*  → negrito
//   ^palavra^  → maior (ESCALA_DESTAQUE × o tamanho da linha)
//   ~palavra~  → cor de destaque
// Ex.: "ABRA O *^PRESENTE^*" = PRESENTE em negrito e maior.
// Cada marcador só alterna um flag — não existe escape; esses caracteres não aparecem em copy
// de CRM. Marcador sem par vale até o fim do texto (nunca quebra o render).

export const ESCALA_DESTAQUE = 1.3;
export const COR_DESTAQUE_PADRAO = '#FFD700';

export interface SegmentoDestaque {
  texto: string;
  negrito: boolean;
  maior: boolean;
  cor: boolean;
}

const MARCADORES = /[*^~]/;

export function temDestaque(texto: string | undefined | null): boolean {
  return !!texto && MARCADORES.test(texto);
}

export function parseDestaque(texto: string): SegmentoDestaque[] {
  const segmentos: SegmentoDestaque[] = [];
  let negrito = false, maior = false, cor = false;
  let atual = '';
  const flush = () => {
    if (atual) segmentos.push({ texto: atual, negrito, maior, cor });
    atual = '';
  };
  for (const ch of texto ?? '') {
    if (ch === '*') { flush(); negrito = !negrito; }
    else if (ch === '^') { flush(); maior = !maior; }
    else if (ch === '~') { flush(); cor = !cor; }
    else atual += ch;
  }
  flush();
  return segmentos;
}

// Texto puro, sem marcadores — pra copiar, exportar, contar caracteres e mandar pra IA de imagem.
export function removerDestaque(texto: string | undefined | null): string {
  return (texto ?? '').replace(/[*^~]/g, '');
}

// Envolve o trecho [inicio, fim) com o marcador, ou remove se ele já estiver envolvido.
// Sem seleção, expande pra palavra sob o cursor.
export function alternarMarcador(
  texto: string, inicio: number, fim: number, marcador: '*' | '^' | '~',
): { texto: string; inicio: number; fim: number } {
  if (inicio === fim) {
    while (inicio > 0 && !/\s/.test(texto[inicio - 1])) inicio--;
    while (fim < texto.length && !/\s/.test(texto[fim])) fim++;
    if (inicio === fim) return { texto, inicio, fim };
  }
  if (texto[inicio - 1] === marcador && texto[fim] === marcador) {
    return {
      texto: texto.slice(0, inicio - 1) + texto.slice(inicio, fim) + texto.slice(fim + 1),
      inicio: inicio - 1,
      fim: fim - 1,
    };
  }
  const trecho = texto.slice(inicio, fim);
  if (trecho.length >= 2 && trecho.startsWith(marcador) && trecho.endsWith(marcador)) {
    return { texto: texto.slice(0, inicio) + trecho.slice(1, -1) + texto.slice(fim), inicio, fim: fim - 2 };
  }
  return {
    texto: texto.slice(0, inicio) + marcador + trecho + marcador + texto.slice(fim),
    inicio: inicio + 1,
    fim: fim + 1,
  };
}
