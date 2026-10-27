import type { PautaGerada } from '../types';

// Imagem crua (sem texto) de cada frame de uma pauta, no bucket campaign-images.
//
// Modo A/B: {marca}/{id}/frame_N.png.
// Agente (modo C): o worker salva inicial/intermediario/final.png, mas numera em frame_urls só os
// que deram certo — se "inicial" falhou, frame_0 é o intermediario e frame_1 o final. Mapear por
// índice fixo (frame_0 → inicial) dava 404 num frame e a imagem errada no outro. Um frame
// regenerado à mão no app vai pra frame_N.png e tem prioridade.
const NOMES_AGENTE = ['inicial', 'intermediario', 'final'];

async function existe(url: string): Promise<boolean> {
  try {
    return (await fetch(url, { method: 'HEAD' })).ok;
  } catch {
    return false;
  }
}

export async function resolverFramesCrus(
  supabaseUrl: string,
  pauta: Pick<PautaGerada, 'id' | 'marca' | 'modo'>,
  totalFrames: number,
): Promise<Record<string, string>> {
  const safeMarca = pauta.marca.toLowerCase().replace(/[^a-z0-9]/g, '');
  const base = `${supabaseUrl}/storage/v1/object/public/campaign-images/${safeMarca}/${pauta.id}`;
  const chaves = Array.from({ length: totalFrames }, (_, i) => `frame_${i}`);

  const [manuais, agente] = await Promise.all([
    Promise.all(chaves.map((k) => existe(`${base}/${k}.png`))),
    pauta.modo === 'C'
      ? Promise.all(NOMES_AGENTE.map((n) => existe(`${base}/${n}.png`)))
      : Promise.resolve([] as boolean[]),
  ]);
  const agenteExistentes = NOMES_AGENTE.filter((_, i) => agente[i]);

  const mapa: Record<string, string> = {};
  chaves.forEach((k, i) => {
    if (manuais[i]) mapa[k] = `${base}/${k}.png`;
    else if (agenteExistentes[i]) mapa[k] = `${base}/${agenteExistentes[i]}.png`;
  });
  return mapa;
}
