/**
 * Sobe o `worker.ts` num servidor HTTP local, servindo o SPA de `dist/`.
 *
 * POR QUE ISTO EXISTE: `npm run dev` roda `server/index.ts` (Express). Produção
 * roda `worker.ts`. São dois servidores com rotas diferentes, e testar no primeiro
 * já deu a impressão de que a aba de calendário funcionava enquanto em produção
 * ela caía no catálogo sintético. Este script fecha essa distância — mesma UI,
 * mesmo código de servidor que o GoDeploy executa.
 *
 * NÃO é o runtime de Workers: é Node. Um `Buffer` ou `process` que escape passa
 * aqui e quebra lá. O que ele garante é o roteamento e o comportamento das rotas,
 * não a compatibilidade de runtime (para isso, `npx esbuild worker.ts --bundle
 * --platform=browser`).
 *
 *   npm run build && npx tsx scripts/servir-worker.ts
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import worker from '../worker.ts';

config();

const PORTA = Number(process.env.PORTA_WORKER ?? 3100);
const DIST = new URL('../dist/', import.meta.url).pathname;

const caminhoSa = process.env.GOOGLE_APPLICATION_CREDENTIALS;

// É assim que os secrets chegam no Worker em produção: strings de ambiente.
const env: any = {
  GCP_SERVICE_ACCOUNT_JSON: caminhoSa ? readFileSync(caminhoSa, 'utf8') : undefined,
  BIGQUERY_PROJECT_ID: process.env.BIGQUERY_PROJECT_ID ?? 'gogroup-crm',
  GOGROUP_TOKEN: process.env.AI_PROXY_KEY ?? process.env.CALENDARIO_AI_KEY ?? '',
  SUPABASE_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? '',
  SUPABASE_SERVICE_KEY: process.env.SPECTRUM_SERVICE_ROLE_KEY ?? '',
  PIAPP_API_KEY: process.env.PIAPP_API_KEY ?? '',
};

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORTA}`);

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/tasks/')) {
    const corpo = ['GET', 'HEAD'].includes(req.method ?? 'GET')
      ? undefined
      : await new Promise<Buffer>((ok) => {
          const partes: Buffer[] = [];
          req.on('data', (c) => partes.push(c));
          req.on('end', () => ok(Buffer.concat(partes)));
        });

    const requisicao = new Request(url.toString(), {
      method: req.method,
      headers: req.headers as any,
      body: corpo && corpo.length ? new Uint8Array(corpo) : undefined,
    });

    const inicio = Date.now();
    const resposta = await worker.fetch(requisicao, env);
    console.log(`${req.method} ${url.pathname}${url.search} → ${resposta.status} (${Date.now() - inicio}ms)`);
    res.writeHead(resposta.status, Object.fromEntries(resposta.headers));
    res.end(Buffer.from(await resposta.arrayBuffer()));
    return;
  }

  // Estático. Em produção quem serve isto é o binding de assets do GoDeploy, antes
  // de a requisição chegar no Worker — por isso o Worker devolve 404 para tudo que
  // não é /api.
  const alvo = normalize(join(DIST, url.pathname === '/' ? 'index.html' : url.pathname));
  try {
    if (!alvo.startsWith(DIST)) throw new Error('fora de dist');
    const dados = await readFile(alvo);
    res.writeHead(200, { 'Content-Type': MIME[extname(alvo)] ?? 'application/octet-stream' });
    res.end(dados);
  } catch {
    const html = await readFile(join(DIST, 'index.html')); // fallback de SPA
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }
}).listen(PORTA, () => {
  console.log(`[worker local] http://localhost:${PORTA} — servindo worker.ts sobre dist/`);
  console.log(`[worker local] BigQuery: ${env.GCP_SERVICE_ACCOUNT_JSON ? 'credencial carregada' : 'SEM CREDENCIAL'}`);
  console.log(`[worker local] AI proxy: ${env.GOGROUP_TOKEN ? 'token carregado' : 'SEM TOKEN'}`);
});
