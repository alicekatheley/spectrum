import dotenv from "dotenv";
dotenv.config();

/**
 * Cliente único do AI proxy do Grupo (ai-proxy.gogroupbr.com).
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * ---------------------------
 * O app foi escrito contra `@google/genai` apontando para a API pública do Gemini.
 * Essa API nunca esteve disponível nesta infra: não existe GEMINI_API_KEY para
 * preencher. O que existe é um gateway OpenAI-compatível, e o `/v1/models` dele
 * responde com gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna, gpt-5.5, gpt-5.4 e
 * gpt-5.4-mini — nenhum modelo Google. `worker.ts` já falava com ele; o servidor
 * Express não.
 *
 * Isso invalida uma tentativa anterior de conserto que ficou registrada no
 * histórico: setar `baseUrl` no cliente `@google/genai` NÃO faz o SDK falar com
 * este proxy. Os protocolos são diferentes — o SDK do Google monta
 * `:generateContent` com `contents[].parts[]`, o proxy espera
 * `/chat/completions` com `messages[]` e devolve `choices[].message.content`.
 * Apontar a URL só troca o destino do corpo errado.
 *
 * JSON ESTRUTURADO: LEIA ANTES DE CONFIAR
 * ---------------------------------------
 * O proxy ACEITA `response_format: {type:"json_schema"}` e o IGNORA em silêncio —
 * responde 200 com markdown em prosa. Testado: um pedido com schema estrito de
 * `{cores: string[]}` voltou "- Azul\n- Vermelho". É o pior modo de falha
 * possível, porque não levanta erro nenhum.
 *
 * O que funciona de verdade é `response_format: {type:"json_object"}`, que devolve
 * JSON válido. Mas ele garante apenas que a resposta é JSON — NÃO que obedece ao
 * seu formato. Por isso toda chamada estruturada aqui: descreve o formato no
 * prompt, extrai, faz parse e VALIDA com um predicado do chamador, com retry.
 * Sem o validador, o schema é decorativo.
 */

const DEFAULT_BASE_URL = "https://ai-proxy.gogroupbr.com/v1";
const DEFAULT_MODEL = "gpt-5.5";

function baseUrl(): string {
  return (process.env.AI_PROXY_BASE_URL || process.env.CALENDARIO_AI_BASE_URL || DEFAULT_BASE_URL)
    .replace(/\/+$/, "");
}

/**
 * Resolução da chave, por área.
 *
 * A separação pautas/calendário continua existindo e continua valendo: as duas
 * áreas podem ter tokens distintos para não dividirem cota nem se confundirem na
 * fatura. O que mudou é o motivo do fallback. Antes, cair de CALENDARIO_AI_KEY
 * para GEMINI_API_KEY misturava DUAS CONTAS diferentes, e por isso era proibido.
 * Agora as duas variáveis apontam para o MESMO gateway — o fallback só decide
 * qual token identifica a chamada, não com quem se fala. Um token compartilhado
 * é degradação de telemetria, não vazamento de cota entre provedores.
 */
function apiKey(area: "pautas" | "calendario"): string | undefined {
  const especifica = area === "calendario"
    ? process.env.CALENDARIO_AI_KEY
    : process.env.PAUTAS_AI_KEY;
  return especifica || process.env.AI_PROXY_KEY || process.env.CALENDARIO_AI_KEY;
}

export function aiProxyConfigurado(area: "pautas" | "calendario" = "pautas"): boolean {
  return Boolean(apiKey(area));
}

export class AiProxyError extends Error {
  constructor(message: string, readonly status?: number, readonly body?: unknown) {
    super(message);
    this.name = "AiProxyError";
  }
}

interface ChatOpts {
  system: string;
  user: string;
  area?: "pautas" | "calendario";
  model?: string;
  temperature?: number;
  /** Só para chamadas JSON. Ver nota sobre json_object acima. */
  json?: boolean;
  signal?: AbortSignal;
}

async function chamar(opts: ChatOpts): Promise<string> {
  const area = opts.area ?? "pautas";
  const key = apiKey(area);
  if (!key) {
    throw new AiProxyError(
      `Nenhuma chave do AI proxy configurada para a área "${area}". ` +
        `Defina AI_PROXY_KEY (ou ${area === "calendario" ? "CALENDARIO_AI_KEY" : "PAUTAS_AI_KEY"}) no .env.`,
    );
  }

  const res = await fetch(`${baseUrl()}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    signal: opts.signal,
    body: JSON.stringify({
      model: opts.model ?? process.env.AI_PROXY_MODEL ?? DEFAULT_MODEL,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      // json_schema é aceito e ignorado por este gateway; json_object funciona.
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    throw new AiProxyError(`AI proxy respondeu ${res.status}: ${corpo.slice(0, 500)}`, res.status, corpo);
  }

  const data: any = await res.json();
  const texto = data?.choices?.[0]?.message?.content;
  if (typeof texto !== "string" || !texto.trim()) {
    throw new AiProxyError("AI proxy respondeu sem conteúdo utilizável.", res.status, data);
  }
  return texto;
}

/** Chamada de prosa. */
export async function chatTexto(opts: Omit<ChatOpts, "json">): Promise<string> {
  return (await chamar({ ...opts, json: false })).trim();
}

/**
 * Mesmo em modo json_object o modelo às vezes embrulha em cerca de markdown ou
 * prefixa uma frase. Extrair o primeiro objeto balanceado é mais barato que
 * perder a resposta inteira por causa de três crases.
 */
function extrairJson(bruto: string): string {
  const texto = bruto.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (texto.startsWith("{") || texto.startsWith("[")) return texto;
  const ini = texto.search(/[{[]/);
  if (ini === -1) return texto;
  const abre = texto[ini];
  const fecha = abre === "{" ? "}" : "]";
  let nivel = 0;
  let emString = false;
  let escapado = false;
  for (let i = ini; i < texto.length; i++) {
    const c = texto[i];
    if (escapado) { escapado = false; continue; }
    if (c === "\\") { escapado = true; continue; }
    if (c === '"') { emString = !emString; continue; }
    if (emString) continue;
    if (c === abre) nivel++;
    else if (c === fecha && --nivel === 0) return texto.slice(ini, i + 1);
  }
  return texto.slice(ini);
}

interface ChatJsonOpts<T> extends Omit<ChatOpts, "json"> {
  /**
   * Validador do chamador. OBRIGATÓRIO de propósito: `json_object` garante JSON
   * sintático, não o SEU formato. Sem isto, um `{"erro":"não sei"}` passaria
   * adiante como se fosse o payload esperado.
   */
  validar: (valor: unknown) => valor is T;
  /** Descrição do formato, injetada no system prompt. */
  formato: string;
  tentativas?: number;
}

export async function chatJson<T>(opts: ChatJsonOpts<T>): Promise<T> {
  const tentativas = opts.tentativas ?? 3;
  const system =
    `${opts.system}\n\n` +
    `FORMATO DE RESPOSTA: responda com UM ÚNICO objeto JSON válido, sem cercas de ` +
    `markdown, sem comentários e sem texto antes ou depois. Estrutura exigida:\n${opts.formato}`;

  let ultimoErro: Error | undefined;
  for (let i = 0; i < tentativas; i++) {
    let bruto = "";
    try {
      bruto = await chamar({ ...opts, system, json: true });
      const valor = JSON.parse(extrairJson(bruto));
      if (opts.validar(valor)) return valor;
      ultimoErro = new AiProxyError(
        `Resposta é JSON válido mas não bate com o formato esperado. Recebido: ${JSON.stringify(valor).slice(0, 300)}`,
      );
    } catch (err: any) {
      // 4xx que não seja 429 é erro de requisição: repetir só gasta cota.
      if (err instanceof AiProxyError && err.status && err.status >= 400 && err.status < 500 && err.status !== 429) {
        throw err;
      }
      ultimoErro = err instanceof Error ? err : new Error(String(err));
      if (err instanceof SyntaxError) {
        ultimoErro = new AiProxyError(`Resposta não é JSON: ${bruto.slice(0, 300)}`);
      }
    }
  }
  throw new AiProxyError(
    `AI proxy não devolveu um payload válido em ${tentativas} tentativas. Último erro: ${ultimoErro?.message}`,
  );
}
