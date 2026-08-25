/**
 * Cliente mínimo do BigQuery Data Transfer Service (onde vivem os "scheduled queries").
 *
 * Existe porque scheduled query NÃO é objeto SQL: não dá para criar, ler ou editar
 * por DDL. A única superfície é a REST API — e o `gcloud` desta máquina está com a
 * autenticação morta ("Reauthentication failed. cannot prompt during non-interactive
 * execution"). Então o caminho é o mesmo que o `worker.ts` usa para falar com o
 * BigQuery em produção: assinar um JWT RS256 com a chave da service account, trocar
 * por um access token, e chamar a API na mão.
 *
 *   node scripts/dts.mjs list
 *   node scripts/dts.mjs get <configId>
 *   node scripts/dts.mjs patch <configId> <arquivo-com-o-SQL>
 *   node scripts/dts.mjs run <configId>
 *   node scripts/dts.mjs runs <configId> [n]     # execuções recentes e seu estado
 *   node scripts/dts.mjs sql <arquivo-com-o-SQL> # roda avulso, sem tocar em config
 *
 * A chave sai de `credentials/`, que está no .gitignore. A service account precisa de
 * bigquery.admin: sem isso o `patch` devolve 403 mas o `list` continua funcionando, o
 * que dá a impressão errada de que a permissão está resolvida.
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const PROJETO = 'gogroup-crm';
const LOCAL = 'southamerica-east1';
const CHAVE = './credentials/gogroup-crm-4ddf461e03de.json';

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function token() {
  const sa = JSON.parse(readFileSync(CHAVE, 'utf8'));
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corpo = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: agora + 3600,
      iat: agora,
    }),
  );
  const assinatura = b64url(createSign('RSA-SHA256').update(`${cabecalho}.${corpo}`).sign(sa.private_key));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${cabecalho}.${corpo}.${assinatura}`,
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`sem token: ${JSON.stringify(j)}`);
  return j.access_token;
}

async function api(caminho, init = {}) {
  const t = await token();
  const r = await fetch(`https://bigquerydatatransfer.googleapis.com/v1/${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} ${caminho}\n${texto}`);
  return texto ? JSON.parse(texto) : {};
}

const [cmd, arg1, arg2] = process.argv.slice(2);
const pai = `projects/${PROJETO}/locations/${LOCAL}`;

if (cmd === 'list') {
  const j = await api(`${pai}/transferConfigs`);
  for (const c of j.transferConfigs ?? []) {
    console.log(
      [
        c.name.split('/').pop(),
        c.displayName,
        c.dataSourceId,
        c.schedule ?? '(sem schedule)',
        c.disabled ? 'DESABILITADO' : 'ativo',
        `próx=${c.nextRunTime ?? '-'}`,
      ].join(' | '),
    );
  }
} else if (cmd === 'get') {
  const j = await api(`${pai}/transferConfigs/${arg1}`);
  console.log(JSON.stringify({ ...j, params: { ...j.params, query: undefined } }, null, 2));
  console.log('\n───── query ─────\n');
  console.log(j.params?.query ?? '(vazia)');
} else if (cmd === 'patch') {
  // ATENÇÃO: updateMask=params.query é ACEITO e IGNORADO. A API devolve 200,
  // avança o updateTime do config — e não escreve a query. O sintoma é um
  // "ok" seguido de um `get` que devolve o corpo antigo, que é pior que erro:
  // parece instalado. A máscara tem que ser `params` (o objeto inteiro).
  // Isso é seguro aqui porque params destes configs só contém `query`; se um
  // dia contiver mais (destination_table_name_template, write_disposition…),
  // este PATCH apaga o resto — por isso lemos e mesclamos antes de escrever.
  const sql = readFileSync(arg2, 'utf8');
  const atual = await api(`${pai}/transferConfigs/${arg1}`);
  const params = { ...(atual.params ?? {}), query: sql };
  const j = await api(`${pai}/transferConfigs/${arg1}?updateMask=params`, {
    method: 'PATCH',
    body: JSON.stringify({ params }),
  });
  // Confirma lendo de volta: PATCH que responde 200 não prova escrita.
  const depois = await api(`${pai}/transferConfigs/${arg1}`);
  if ((depois.params?.query ?? '') !== sql) {
    console.error('FALHOU — a query lida de volta não é a que foi enviada.');
    process.exit(1);
  }
  console.log(`ok — query atualizada e conferida (${sql.length} bytes), próxima execução ${j.nextRunTime}`);
} else if (cmd === 'runs') {
  // Estado das execuções. job_log conta o que as PROCEDURES fizeram; isto conta
  // o que o Data Transfer achou do script inteiro. As duas coisas divergem: um
  // script pode gravar 'ok' por marca e ainda assim terminar FAILED depois.
  const j = await api(`${pai}/transferConfigs/${arg1}/runs?pageSize=${arg2 ?? 10}`);
  for (const r of j.transferRuns ?? []) {
    const dur =
      r.startTime && r.endTime
        ? `${Math.round((Date.parse(r.endTime) - Date.parse(r.startTime)) / 1000)}s`
        : '-';
    console.log([r.runTime, r.state, dur, r.errorStatus?.message ?? ''].join(' | '));
  }
} else if (cmd === 'run') {
  const agora = new Date().toISOString();
  const j = await api(`${pai}/transferConfigs/${arg1}:startManualRuns`, {
    method: 'POST',
    body: JSON.stringify({ requestedRunTime: agora }),
  });
  console.log(JSON.stringify(j, null, 2));
} else if (cmd === 'sql') {
  // Submete um arquivo .sql como job do BigQuery. Existe porque procedure de
  // 200 linhas não cabe confortavelmente num argumento de ferramenta, e copiar
  // e colar SQL longo é justamente onde nasce a divergência entre o arquivo
  // versionado e o que está de fato no banco.
  const t = await token();
  const r = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${PROJETO}/queries`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: readFileSync(arg1, 'utf8'),
      useLegacySql: false,
      location: LOCAL,
      timeoutMs: 180000,
      maxResults: 200,
    }),
  });
  const j = await r.json();
  if (j.error || j.errors) {
    console.error(JSON.stringify(j.error ?? j.errors, null, 2));
    process.exit(1);
  }
  const campos = (j.schema?.fields ?? []).map((f) => f.name);
  if (!j.jobComplete) console.log('job ainda rodando:', j.jobReference?.jobId);
  else if (!j.rows) console.log(`ok — ${j.numDmlAffectedRows ?? 0} linhas afetadas`);
  else {
    console.log(campos.join(' | '));
    for (const linha of j.rows) console.log(linha.f.map((c) => c.v).join(' | '));
  }
} else {
  console.log(
    'uso: list | get <id> | patch <id> <arquivo.sql> | run <id> | runs <id> [n] | sql <arquivo.sql>',
  );
}
