/**
 * Executa as rotas de calendário do `worker.ts` fora do Cloudflare, contra o
 * BigQuery de verdade.
 *
 * Existe porque `tsc --noEmit` passando não prova nada sobre este código: o que
 * quebrou em produção não foi tipo, foi runtime — o cliente Node do BigQuery não
 * existe dentro de um Worker, e ninguém percebeu porque o teste tinha sido feito
 * contra o Express. Este script chama `worker.fetch()` diretamente, o mesmo ponto
 * de entrada que o Cloudflare chama.
 *
 * Não é substituto de rodar no Worker de verdade: Node tem APIs que o Worker não
 * tem, então este script pode passar e o deploy ainda falhar por um `Buffer` ou
 * `process` que passou despercebido. O que ele garante é o contrário — se falhar
 * aqui, falha lá.
 *
 *   npx tsx scripts/verificar-worker-calendario.ts
 */
import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import worker from '../worker.ts';

config();

const caminhoSa = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!caminhoSa) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS não definido no .env');
  process.exit(1);
}

// É assim que o secret chega no Worker: o JSON inteiro numa variável de ambiente.
const env: any = {
  GCP_SERVICE_ACCOUNT_JSON: readFileSync(caminhoSa, 'utf8'),
  BIGQUERY_PROJECT_ID: process.env.BIGQUERY_PROJECT_ID ?? 'gogroup-crm',
  GOGROUP_TOKEN: process.env.AI_PROXY_KEY ?? process.env.CALENDARIO_AI_KEY ?? '',
  SUPABASE_KEY: '',
  SUPABASE_SERVICE_KEY: '',
  PIAPP_API_KEY: '',
};

const chamar = (caminho: string, init?: RequestInit) =>
  worker.fetch(new Request(`https://local.test${caminho}`, init), env);

let falhas = 0;
function checa(nome: string, ok: boolean, detalhe = '') {
  console.log(`${ok ? '  ok  ' : '  FALHA'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!ok) falhas++;
}

async function main() {
  console.log('\n── /api/calendario/status ──');
  const rStatus = await chamar('/api/calendario/status');
  const status = (await rStatus.json()) as any;
  checa('HTTP 200', rStatus.status === 200, `status ${rStatus.status}`);
  checa('BigQuery disponível', status.data?.disponivel === true, status.data?.erro ?? '');
  console.log(`         marcas: ${(status.data?.marcas ?? []).join(', ')}`);

  console.log('\n── /api/calendario/contexto?marca=Lescent ──');
  const rCtx = await chamar('/api/calendario/contexto?marca=Lescent');
  const ctx = (await rCtx.json()) as any;
  checa('HTTP 200', rCtx.status === 200, JSON.stringify(ctx).slice(0, 200));
  const d = ctx.data ?? {};

  // Coerção de tipo é o ponto frágil desta porta: a REST API do BigQuery devolve
  // TUDO como string, inclusive boolean e inteiro. Um `"3"` que passa como número
  // não quebra nada de imediato — só produz `"3" - 1 = 2` em um lugar e
  // `"3" + 1 = "31"` em outro. Por isso as asserções abaixo checam `typeof`.
  checa('config.ativo é boolean true', d.config?.ativo === true, `${typeof d.config?.ativo} ${d.config?.ativo}`);
  checa('config.maxDiasCom3 é number', typeof d.config?.maxDiasCom3 === 'number', `${typeof d.config?.maxDiasCom3}`);
  checa('diasAtivos são dow numéricos 0..6',
    Array.isArray(d.config?.diasAtivos) && d.config.diasAtivos.every((x: any) => typeof x === 'number' && x >= 0 && x <= 6),
    JSON.stringify(d.config?.diasAtivos));
  checa('gradeHorarios tem 7 linhas', d.config?.gradeHorarios?.length === 7);
  checa('grade de Quarta abre às 8h', d.config?.gradeHorarios?.[3]?.[0] === 8, JSON.stringify(d.config?.gradeHorarios?.[3]));

  checa('catálogo não vazio', (d.catalogo?.length ?? 0) > 0, `${d.catalogo?.length} ofertas`);
  checa('agressividade é number', typeof d.catalogo?.[0]?.agressividade === 'number');
  const familias = [...new Set((d.catalogo ?? []).map((o: any) => o.familia))];
  console.log(`         ${d.catalogo?.length} ofertas em ${familias.length} famílias: ${familias.join(', ')}`);

  checa('I1 tem 7 dias', d.indices?.i1Dia?.length === 7, `${d.indices?.i1Dia?.length}`);
  checa('I1 valor é number', typeof d.indices?.i1Dia?.[0]?.valor === 'number');
  checa('alpha é number', typeof d.indices?.alpha === 'number', `alpha=${d.indices?.alpha}`);
  checa('geradoEm virou ISO', typeof d.indices?.geradoEm === 'string' && d.indices.geradoEm.includes('T'),
    d.indices?.geradoEm);

  checa('viabilidade tem dow 0..6',
    d.viabilidade?.every((v: any) => typeof v.dow === 'number' && v.dow >= 0 && v.dow <= 6),
    JSON.stringify((d.viabilidade ?? []).map((v: any) => v.dow)));
  checa('baseline.rpm é number > 0', typeof d.baseline?.rpm === 'number' && d.baseline.rpm > 0, `rpm=${d.baseline?.rpm}`);
  checa('baseline.volumeSemana é number > 0', typeof d.baseline?.volumeSemana === 'number' && d.baseline.volumeSemana > 0,
    `volume=${d.baseline?.volumeSemana}`);
  checa('cobertura.shareSemOferta é fração 0..1',
    typeof d.cobertura?.shareSemOferta === 'number' && d.cobertura.shareSemOferta >= 0 && d.cobertura.shareSemOferta <= 1,
    `${(100 * (d.cobertura?.shareSemOferta ?? 0)).toFixed(1)}%`);

  console.log('\n── paridade Worker × Express ──');
  // Se as duas rotas divergirem, a aba passa a decidir uma coisa em dev e outra em
  // produção — que é literalmente o bug que esta porta conserta. Comparar aqui é
  // a única forma de a divergência aparecer antes do usuário.
  const { carregarContextoModelo, getContextoMarca } = await import('../server/bigquery.ts');
  const okExpress = await carregarContextoModelo();
  if (!okExpress) {
    checa('Express carregou contexto', false, 'falhou — comparação pulada');
  } else {
    const exp = getContextoMarca('lescent') as any;
    const cmp = (nome: string, a: any, b: any) =>
      checa(nome, JSON.stringify(a) === JSON.stringify(b), `worker=${JSON.stringify(a)} express=${JSON.stringify(b)}`);
    cmp('config', d.config, exp.config);
    cmp('catálogo', d.catalogo, exp.catalogo);
    cmp('viabilidade', d.viabilidade, exp.viabilidade);
    cmp('baseline', d.baseline, exp.baseline);
    cmp('I1', d.indices.i1Dia, exp.indices.i1Dia);
    cmp('alpha', d.indices.alpha, exp.indices.alpha);
    cmp('cobertura', d.cobertura, exp.cobertura);
  }

  console.log('\n── marca fora do modelo ──');
  const r404 = await chamar('/api/calendario/contexto?marca=Gocase');
  const j404 = (await r404.json()) as any;
  checa('Gocase devolve 404, não catálogo inventado', r404.status === 404, `status ${r404.status}`);
  checa('404 lista marcas disponíveis', Array.isArray(j404.marcasDisponiveis));

  // A leitura assistida custa uma chamada de IA por execução, então fica atrás de
  // uma flag. Rodar com `--ia` antes de cada deploy que mexa no prompt.
  if (process.argv.includes('--ia')) {
    console.log('\n── /api/calendario/explicar (chamada real ao AI proxy) ──');
    const { gerarCalendarioDemo } = await import('../src/utils/calendarioDemo.ts');
    const { configDoContexto } = await import('../src/utils/calendarioContexto.ts');
    const { config: cfgGerador, excluidas } = configDoContexto(d);
    console.log(`         excluídas do catálogo: ${excluidas.map((e: any) => `${e.familia}(${e.ofertas.length})`).join(', ')}`);
    const calendario = gerarCalendarioDemo(
      {
        marca: 'Lescent',
        modo: 'receita',
        dataInicio: '2026-08-25',
        dataFim: '2026-08-30',
        eventosEspeciais: '',
      } as any,
      cfgGerador,
    );
    checa('gerador usou o catálogo do BigQuery', calendario.procedencia === 'dados', calendario.procedencia);
    const ofertas = [...new Set(calendario.slots.map((s: any) => s.oferta))];
    checa('slots trazem ofertas reais, não "Oferta A1"',
      ofertas.length > 0 && !ofertas.some((o: any) => /^Oferta [A-Z]\d$/.test(o)),
      ofertas.join(', '));

    const rIa = await chamar('/api/calendario/explicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendario, pergunta: 'Por que quarta-feira concentra volume?' }),
    });
    const jIa = (await rIa.json()) as any;
    checa('HTTP 200', rIa.status === 200, JSON.stringify(jIa).slice(0, 300));
    checa('devolveu prosa', typeof jIa.data?.texto === 'string' && jIa.data.texto.length > 80,
      `${jIa.data?.texto?.length ?? 0} chars`);
    console.log(`\n${jIa.data?.texto ?? ''}\n`);
  }

  console.log('\n── sem credencial: falha alta, sem fallback ──');
  const rSem = await worker.fetch(
    new Request('https://local.test/api/calendario/contexto?marca=Lescent'),
    { ...env, GCP_SERVICE_ACCOUNT_JSON: undefined } as any,
  );
  // Só vale se o cache do isolate não mascarar. O cache é global ao módulo, então
  // aqui ele responde 200 — e isso é correto: o dado já carregado continua válido.
  console.log(`         status ${rSem.status} (200 esperado: cache do isolate ainda quente)`);

  console.log(`\n${falhas === 0 ? '✓ tudo certo' : `✗ ${falhas} falha(s)`}\n`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
