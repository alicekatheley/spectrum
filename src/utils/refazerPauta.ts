import { PautaGerada, PautaVisual } from "../types";

// Estilos de render do brief do Agente (ESTILOS_BRIEF em worker.ts) → botões de
// "Estilo de Design da Imagem" do FormModoB.
const ESTILO_DESIGN_POR_BRIEF: Record<string, string> = {
  'flat-grao': '2D Cartoon',
  'foto-still': 'Fotográfico',
  'colagem': 'Fotográfico',
  'clay-3d': '3D Cartoon',
  'isometrico': '3D Cartoon',
  'grafico-minimal': 'Minimalista',
  'papercraft': 'Ilustrado',
  'line-art': 'Ilustrado',
  'retro-print': 'Ilustrado',
};

export function inferirEstiloDesign(visual?: PautaVisual): string {
  const doBrief = visual?.briefCriativo?.estilo && ESTILO_DESIGN_POR_BRIEF[visual.briefCriativo.estilo];
  if (doBrief) return doBrief;
  const s = (visual?.estiloIlustracao ?? '').toLowerCase();
  if (/aquarela|watercolor/.test(s)) return 'Aquarela';
  if (/neon/.test(s)) return 'Neon/Bold';
  if (/minimal/.test(s)) return 'Minimalista';
  if (/photo|fotogr|foto /.test(s)) return 'Fotográfico';
  if (/3d/.test(s)) return /cartoon|clay|toy|isometric/.test(s) ? '3D Cartoon' : '3D Realista';
  if (/2d|flat|vetor|vector/.test(s)) return '2D Cartoon';
  if (/ilustra|illustrat|line art|papercraft/.test(s)) return 'Ilustrado';
  return '';
}

// Direcionamento reconstruído a partir do conceito salvo — usado quando a pauta não guardou o
// texto original (ex: pautas do Agente), pra o "Refazer" não esbarrar na validação do campo.
export function montarDirecionamentoDaPauta(pauta: PautaGerada, frames: string[]): string {
  const v = pauta.visual;
  const linhas: string[] = [];
  if (pauta.operacional.mecanicaEscolhida) linhas.push(`Mecânica: ${pauta.operacional.mecanicaEscolhida}.`);
  if (pauta.operacional.recompensaEscolhida) linhas.push(`Recompensa: ${pauta.operacional.recompensaEscolhida}.`);
  if (v?.paletaRecomendada?.fundo) linhas.push(`Fundo: ${v.paletaRecomendada.fundo}.`);
  if (v?.paletaRecomendada?.cores?.length) {
    const nome = v.paletaRecomendada.nome ? `${v.paletaRecomendada.nome} ` : '';
    linhas.push(`Paleta: ${nome}(${v.paletaRecomendada.cores.join(', ')}).`);
  }
  if (v?.estiloIlustracao) linhas.push(`Estilo de ilustração: ${v.estiloIlustracao}.`);
  if (v?.posicaoCta) linhas.push(`Posição do CTA: ${v.posicaoCta}.`);
  frames.forEach((f, i) => linhas.push(`Frame ${i + 1}: ${f}`));
  return linhas.join('\n');
}
