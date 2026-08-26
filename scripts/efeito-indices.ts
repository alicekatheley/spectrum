/**
 * Mede o efeito de I2/I3/I4 sobre o plano, marca a marca, contra o BigQuery real.
 *
 * Existe porque `verificar-calendario.ts` roda o gerador com o CONFIG estático, e
 * o CONFIG estático não tem índice de hora nem de oferta — ou seja, ele não
 * exercita nada do que esta mudança fez. A pergunta que este script responde é a
 * que interessa: com dados de verdade, quanto cada alavanca move a receita, e ela
 * aparece justamente nas marcas cujo walk-forward deu peso a ela?
 *
 *   npx tsx scripts/efeito-indices.ts
 */
import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import worker from '../worker.ts';
import { configDoContexto, type ContextoBigQuery } from '../src/utils/calendarioContexto.ts';
import { gerarCalendarioDemo } from '../src/utils/calendarioDemo.ts';
import type { MarcaCalendario } from '../src/types.ts';

config();

const caminhoSa = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!caminhoSa) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS não definido no .env');
  process.exit(1);
}

const env: any = {
  GCP_SERVICE_ACCOUNT_JSON: readFileSync(caminhoSa, 'utf8'),
  BIGQUERY_PROJECT_ID: process.env.BIGQUERY_PROJECT_ID ?? 'gogroup-crm',
  GOGROUP_TOKEN: '',
  SUPABASE_KEY: '',
  SUPABASE_SERVICE_KEY: '',
  PIAPP_API_KEY: '',
};

const MARCAS: MarcaCalendario[] = ['Apice', 'Barbours', 'Lescent', 'Kokeshi', 'Rituaria', 'Gocase'];

for (const marca of MARCAS) {
  const resp = await worker.fetch(
    new Request(`https://local.test/api/calendario/contexto?marca=${encodeURIComponent(marca)}`),
    env,
  );
  if (!resp.ok) {
    console.log(`\n${marca}: contexto indisponível (HTTP ${resp.status})`);
    continue;
  }
  const ctx = (await resp.json()).data as ContextoBigQuery;
  const { config: cfg, avisos } = configDoContexto(ctx);

  const cal = gerarCalendarioDemo(
    {
      marca, modo: 'receita_maxima',
      dataInicio: '2026-09-01', dataFim: '2026-09-21', eventosEspeciais: '',
    },
    cfg,
  );

  console.log(`\n── ${marca} ${'─'.repeat(40 - marca.length)}`);
  console.log(`   slots ${cal.slots.length} · receita R$ ${cal.previsao.validado.toLocaleString('pt-BR')} · ganho ${cal.previsao.ganhoValidadoPct}%`);
  for (const e of cal.decomposicao) {
    console.log(
      `   ${e.validado ? 'medido  ' : 'neutro  '} ${e.etapa.padEnd(52)} ` +
      `R$ ${String(e.receita).padStart(9)}  ${e.ganhoPct >= 0 ? '+' : ''}${e.ganhoPct}%`,
    );
  }
  const horas = [...new Set(cal.slots.map((s) => s.hora))].sort((a, b) => a - b);
  console.log(`   horas usadas: ${horas.join(', ')}`);
  const ofertas = new Map<string, number>();
  for (const s of cal.slots) ofertas.set(s.oferta, (ofertas.get(s.oferta) ?? 0) + 1);
  const top = [...ofertas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  console.log(`   ofertas mais usadas: ${top.map(([o, n]) => `${o} (${n}×)`).join(', ')}`);
  console.log(`   ofertas distintas: ${ofertas.size} de ${cfg.familias.flatMap((f) => f.ofertas).length} no catálogo`);
  for (const a of [...avisos, ...cal.avisos]) console.log(`   aviso: ${a}`);
}
