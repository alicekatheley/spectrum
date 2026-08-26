import dotenv from "dotenv";
dotenv.config();
import { GoogleGenAI, Type } from "@google/genai";
import { chatTexto, aiProxyConfigurado } from "./ai-proxy.ts";

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

/**
 * Cliente separado para a área de calendários.
 *
 * Existe para as duas áreas não dividirem cota nem histórico de uso: um pico de
 * geração de pautas não pode derrubar a explicação de um calendário, e o consumo
 * de cada área precisa ser legível em separado na fatura.
 *
 * Note o que este bloco NÃO faz: cair para `GEMINI_API_KEY` quando a chave própria
 * falta. Esse fallback é tentador e destrói o motivo de existir da separação — as
 * duas áreas voltariam a se misturar exatamente no dia em que alguém esquecesse de
 * configurar, e sem nenhum sinal de que isso aconteceu.
 */
// A área de calendários fala com o AI proxy do Grupo via `server/ai-proxy.ts`.
//
// Aqui existia um segundo cliente `@google/genai` com `baseUrl` apontando para o
// proxy, e um comentário afirmando que era isso que um token `gw-tok-` precisava.
// Estava errado, e vale registrar por quê: os dois protocolos não são compatíveis.
// O SDK do Google fala `:generateContent` com `contents[].parts[]`; o proxy é
// OpenAI-compatível e espera `/chat/completions` com `messages[]`. Trocar a URL
// mandava o corpo errado para o endereço certo — e o sintoma era um 400
// "API key not valid" vindo de generativelanguage.googleapis.com, que apontava
// para a chave quando o problema era o formato da requisição.

function buildPlaybook(marca: string): string {
  const isApice = marca === 'Apice';
  return isApice
    ? `=== PLAYBOOK DA MARCA: ÁPICE ===
- Foco: Cuidado capilar feminino, próximo, transformador, acolhedor, empoderamento e autoestima das mulheres.
- Tom de Voz: Acolhedor, tipográfico, primeira pessoa, íntimo.
- Paleta Cromática: Verde Floresta (#688D65, protagonista principal). Cores quentes permitidas apenas para destaque promocional (Magenta #D553A5, Terracota #B46D55, Beringela #562D4A).
- Tipografia: Roca (serifada, em itálico e negrito) para headlines de destaque, Host Grotesk para o texto do corpo.
- Eixo de Mecânica: Eixo de MANIPULAÇÃO (puxar adesivo, cortar fio, jogo da velha, puxar post-it, etc.).
- Recompensa Dominante: Diversificada (cupom, cupom valor fixo, brinde físico, produto + mimo). Alta intenção favorece % desconto, volume favorece cupom valor fixo, reativação produto + mimo.
- Horário recomendado: Janela das 08h30 às 09h30 (abertura média de 38,9%). Melhor dia: Quarta-feira. Pior dia: Sexta-feira.
- Limite de caracteres do Assunto: Entre 27 e 47 caracteres.`
    : `=== PLAYBOOK DA MARCA: BARBOURS ===
- Foco: Luxo acessível, beleza que inspira confiança, sofisticação, sensualidade moderna e feminilidade contemporânea.
- Tom de Voz: Direto, sofisticado, elegante, formato que imita push-notifications elegantes de smartphones.
- Paleta Cromática: Ruby Red (#BF0F26, protagonista dominante com 2/3 ou mais da composição), Gold (#AA834B) para os detalhes de exclusividade, profundidade com Merlot (#4F080E), contemporaneidade com Pink Blush (#FFCCD5), e fundo Off white (#E7E3D8).
- Cores PROIBIDAS (NUNCA usar em Barbours): Verde, laranja vivo, amarelo, azul.
- Tipografia: Serifa de display de alto contraste restrita exclusivamente para o logotipo. No texto das Headlines e Corpo do banner, use Sans-serif de alto contraste.
- Eixo de Mecânica: Eixo de ABRIR (abrir presente, abrir caixa, abrir carta, abrir envelope).
- Recompensa Dominante: Brinde físico ou % desconto em segundo caso. Recompensas ligadas visualmente ao tema (presente na caixa, carta no envelope, etc.).
- Horário recomendado: Janela das 09h00 às 11h00 (CTR de 1,66% e receita alta). Melhor dia: Quarta-feira ou Domingo. Pior dia: Sábado.
- Limite de caracteres do Assunto: Entre 16 e 39 caracteres.`;
}

function buildSystemInstruction(
  marca: string,
  aspectRatio: string,
  crmAiEstilos: string[],
  visualHitsBlock: string,
  playbookMarca: string,
  tipoGeracao: string,
): string {
  return `Você é o Agente de IA de CRM de alta performance especialista para a marca ${marca}, gerador de pautas de email lucrativas e autênticas com base no histórico de Hits validados da marca.

=== HIERARQUIA DE PRIORIDADE ===
1) Regras invioláveis de assunto abaixo: NUNCA podem ser violadas, nem a pedido do usuário.
2) Playbook da marca: pode ser flexibilizado SE o usuário pedir explicitamente via direcionamento, mas SEMPRE sinalize como risco.
3) Direcionamento do usuário: orienta o conteúdo criativo dentro dos limites acima.

=== REGRAS INVIOLÁVEIS DE ASSUNTO (ENTREGABILIDADE) ===
1. NUNCA use Caps Lock no assunto inteiro.
2. NUNCA use mais de 2 emojis por assunto.
3. NUNCA use as palavras ou símbolos "%", "OFF", "GRÁTIS", "R$" ou números gritantes em CAPS LOCK no assunto do email (regras estritas para evitar caixa de spam, aba de promoção ou bloqueio dos ISPs).
4. O Pré-header deve ser SEMPRE E EXCLUSIVAMENTE o texto fixo "Mas, vou precisar cancelar em breve" independente dos inputs. Não invente!

IMPORTANTE: As regras invioláveis de assunto e o playbook da marca NUNCA podem ser substituídos pelo direcionamento do usuário. Se o direcionamento pedir algo que viole essas regras, gere o conteúdo respeitando as regras e adicione um alerta no bloco de riscos explicando que o pedido foi ajustado.

${playbookMarca}

=== REGRAS DO PROCESSO DE GERAÇÃO ===
- Ao propor uma pauta, associe-a sempre com pelo menos 1 (e até 3) ID de disparo de Hit do banco de referência da marca selecionada, para basear sua previsão realista de taxas de abertura (28-35%), CTOR (3-5%) e receita.
- Previsões de performance reais devem ser informadas como faixas numéricas de intervalo, nunca números fixos únicos.
- Se houver menos que 3 cases análogos próximos no banco, indique de forma clara como "baixa confiança".
- Se houver alguma violação nas diretivas de playbook pelo usuário, sinalize no bloco de riscos, mas garanta que o resultado visual e de copy gerados por você permaneça 100% calibrado dentro do Playbook.
- Estruture o banner no formato ${aspectRatio} (proporção escolhida pelo usuário), ilustrado, instigante, preferencialmente formato GIF (com 3 frames detalhados: Inicial com o objeto intocado/fechado, Intermediário opcional com a ação ocorrendo, e Final com a revelação da recompensa e botão CTA visível em contraste). Ao descrever cada frame, considere o recorte visual da proporção ${aspectRatio}: posicionamento de elementos, hierarquia e o que será cortado nas bordas.
- ⚠️ CONTINUIDADE VISUAL ENTRE FRAMES (REGRA CRÍTICA — FORMATO DE ESCRITA DOS FRAMES): os frames de um mesmo GIF são fotogramas de UMA ÚNICA cena, não cenas independentes. Para reduzir a chance de a IA de imagem "reinventar" a cena a cada frame, escreva os frames com escopo decrescente:
  • FRAME 1 (estabelecimento): única descrição completa — objeto herói + TODOS os objetos secundários/props + cores + fundo + atmosfera + posição de cada elemento. Este frame define o layout que todos os outros devem copiar.
  • FRAMES 2+ (somente o delta): descreva APENAS o que muda em relação ao frame anterior — o novo estado/posição do objeto herói da ação. NÃO redescreva objetos secundários, fundo, paleta ou atmosfera que já apareceram no Frame 1 — apenas cite-os de passagem como inalterados (ex: "a necessaire segue parada no canto inferior direito, sem alteração"), nunca com detalhamento completo de novo. Redescrever um objeto estático em detalhe a cada frame é o que faz a IA de imagem reinterpretar e reposicionar esse objeto por engano.
  Objetos que não fazem parte da ação NUNCA podem mudar de posição entre frames; o objeto herói pode mudar de posição/estado apenas de forma incremental e contínua (nunca teletransportando).
- A headline do banner deve ser sempre baseada no verbo de ação da mecânica escolhida (ex: "ABRA O PRESENTE", "PUXE O ADESIVO") em destaque tipográfico. O sub-headline deve expor a recompensa concreta + o prazo de urgência (ex: "Seu brinde te espera — válido até 23h59"). O CTA do botão deve conter um verbo único direto correspondente à mecânica ("ABRIR", "PUXAR", etc.).
- Se o segmento alvo fornecido for desengajado (como Desengajados, Abertura 0x90), restrinja estritamente para mecânicas de baixíssimo atrito (ex: "abrir presente" antes de inventar mecânicas interativas longas como "jogo da velha" ou jogar).

Você extrairá as mecânicas, previsões de faturamento médio e performances do banco de referência real fornecido adiante.
${crmAiEstilos.length > 0 ? `\n=== ESTILOS VISUAIS DISPONÍVEIS (use exatamente esses nomes no campo estiloIlustracao) ===\n${crmAiEstilos.join(', ')}\n` : ''}${tipoGeracao === 'texto' ? '\n=== MODO GERAÇÃO: TEXTO ===\nFoque 100% na qualidade do copy e estratégia. Não gere briefing visual.' : ''}${tipoGeracao === 'imagem' ? '\n=== MODO GERAÇÃO: IMAGEM ===\nDê atenção especial às descrições visuais dos 3 frames do GIF.' : ''}`;
}

function buildPromptModo(
  modo: string,
  input: any,
  marca: string,
  direcStr: string,
  refImageData: { mimeType: string; data: string } | null,
  mecanicasCatalog: string[],
  aspectRatio: string,
  estiloIlustracao?: string,
): string {
  const direcBlocoModoA = direcStr
    ? `\n\n=== ⚠️ INSTRUÇÃO DIRETA DO USUÁRIO — PRIORIDADE MÁXIMA, ACIMA DE TUDO ===\n"${direcStr}"\n\nEsta instrução tem PRIORIDADE ABSOLUTA sobre qualquer padrão do histórico, regra do Playbook ou preferência de marca. Siga-a literalmente. Se ela conflitar com o histórico de Hits, ignore o histórico e siga a instrução. Se ela conflitar com padrões visuais da marca, siga a instrução e registre o conflito em "riscos". O usuário sabe o que quer — sua função é executar, não reinterpretar.\n`
    : '';

  const direcBlocoModoB = direcStr
    ? `\n\n=== ⚠️ DIRECIONAMENTO OBRIGATÓRIO DO USUÁRIO — EXECUTE LITERALMENTE ===\n"${direcStr}"\n\nEste direcionamento é uma ORDEM DIRETA, não uma sugestão. Regras:\n1. Se especifica tema, objeto, cor, estilo ou conceito → use EXATAMENTE esse elemento nos frames visuais e no copy\n2. Se conflita com box preenchido pelo usuário → respeite o box (é mais específico) e aplique o direcionamento só nos boxes vazios\n3. Se conflita com o Playbook → execute o direcionamento e registre em "riscos" com severidade BAIXO\n4. Nunca interprete, melhore ou substitua — execute literalmente o que está escrito\n`
    : `\n\n=== DIRECIONAMENTO DO USUÁRIO: Não fornecido ===\nNenhum direcionamento específico foi dado. Use o histórico de hits e o Playbook da marca como base.\n`;

  if (modo === 'A') {
    return `=== GERAÇÃO MODO A: DESCOBERTA LIVRE ===${direcBlocoModoA}
O CRM Manager da marca ${marca} está solicitando a criação de até ${input.quantidadePautas || 3} ideias de pautas de CRM para preencher o cronograma.
Parâmetros recebidos:
- Quantidade requisitada: ${input.quantidadePautas || 3} pauta(s)
- Contexto da Campanha: ${input.contextoCampanha || 'Geral/Descobrimento'}
- Segmento Alvo: ${input.segmentoAlvo || 'Principal Padrão'}
- Data sugerida do Disparo: ${input.dataDisparo || 'Vazio (indicar recomendada)'}
- Tipo de Recompensa: ${input.tipoRecompensa || 'Selecionar com base em melhor performance'}
- Mecânicas a evitar recentemente: ${(input.evitarMecanicas || []).join(', ') || 'Nenhuma'}

Use o banco histórico da marca para priorizar os Hits históricos que performaram melhor para propor de forma calibrada.`;
  }

  const qtdFrames = typeof (input as any).quantidadeFrames === 'number'
    ? Math.min(Math.max((input as any).quantidadeFrames, 2), 20)
    : 3;

  return `=== GERAÇÃO MODO B: BRIEFING ASSISTIDO ===${direcBlocoModoB}
O CRM Manager já possui conceitos parciais de briefing. Sua função é COMPLETAR os boxes vazios e RESPEITAR LITERALMENTE os boxes preenchidos.

=== ⚠️ REGRA INVIOLÁVEL DOS BOXES PREENCHIDOS ===
Se o usuário preencheu um box, você DEVE usar o valor EXATO como output final.
NÃO reescreva. NÃO melhore. NÃO substitua. NÃO interprete.
O box preenchido é uma ORDEM, não uma sugestão.
Apenas sanitize violações técnicas de entregabilidade (caps lock inteiro no assunto, termos proibidos como %, OFF, R$) — e mesmo assim preserve a ideia central e registre o ajuste em "riscos".

Boxes fornecidos pelo usuário:
- Assunto do email (boxTituloEmail): "${input.boxTituloEmail || 'VAZIO — gere você'}"
- Headline do banner (boxHeadlineBanner): "${input.boxHeadlineBanner || 'VAZIO — gere você usando verbo de ação da mecânica em caixa alta'}"
- Sub-headline do banner (boxSubtituloEmail): "${input.boxSubtituloEmail || 'VAZIO — gere você expondo recompensa + prazo'}"
- Verbo do botão CTA (boxCta): "${input.boxCta || 'VAZIO — gere você com verbo único no imperativo'}"
- Mecânica / Conceito do GIF (boxMecanicaOuEstatico): "${input.boxMecanicaOuEstatico || 'VAZIO — invente uma mecânica original'}"
- Recompensa central (boxRecompensa): "${input.boxRecompensa || 'VAZIO — gere você baseado no histórico da marca'}"

NOTA: O campo "estiloVisualTexto" existe mas é usado apenas pelo Canvas para compor o texto sobre a imagem — NÃO interfere no conteúdo criativo que você deve gerar. Ignore-o completamente nesta etapa.
${refImageData ? '\n=== IMAGEM DE REFERÊNCIA VISUAL ANEXADA ===\nO usuário enviou uma imagem de referência. Analise estilo visual, paleta, composição e mood. Use para enriquecer a descrição dos frames visuais adaptando ao DNA da marca.\n' : ''}
=== REGRAS DOS FRAMES VISUAIS ===
- Gere exatamente ${qtdFrames} frames para este GIF
- Os frames devem ser visualmente consistentes: mesmo objeto, mesma paleta, mesmo estilo, mesmo fundo
- ⚠️ CONTINUIDADE VISUAL ENTRE FRAMES (REGRA CRÍTICA — FORMATO DE ESCRITA DOS FRAMES): trate os frames como fotogramas de UMA ÚNICA cena, não cenas independentes. Escreva com escopo decrescente:
  • FRAME 1 (estabelecimento): única descrição completa — objeto herói + TODOS os objetos secundários/props + cores + fundo + atmosfera + posição de cada elemento.
  • FRAMES 2+ (somente o delta): descreva APENAS o que muda em relação ao frame anterior (o novo estado/posição do objeto herói da ação). NÃO redescreva em detalhe objetos secundários, fundo, paleta ou atmosfera já estabelecidos no Frame 1 — cite-os no máximo de passagem como inalterados (ex: "a necessaire segue parada no canto inferior direito, sem alteração"). Redescrever um objeto estático em detalhe a cada frame é o que faz a IA de imagem reinterpretar e reposicionar esse objeto por engano.
  Todo objeto que não é o foco da ação deve manter EXATAMENTE a mesma posição (x/y) e escala em todos os frames; o objeto herói só pode mudar de posição/estado de forma incremental/contínua, nunca um salto brusco.
- Se o direcionamento descrever a lógica de cada frame, siga-a LITERALMENTE
- Se o direcionamento for genérico ou vazio, crie uma progressão narrativa natural com ${qtdFrames} momentos distintos
- Cada frame deve ser descrito individualmente com: objeto + cor + estado + posição + fundo + atmosfera
- NÃO use obrigatoriamente a lógica fechado/ação/revelação — use a narrativa que fizer mais sentido para o conceito

=== BOX 4 — MECÂNICA ===
- Se o usuário preencheu: use como base EXATA e apenas adicione detalhes de produção visual (cores, texturas, iluminação)
- Se o usuário deixou vazio: invente uma mecânica original que funcione como GIF de 3 frames
- Mecânicas no catálogo (referência, não limitante): ${mecanicasCatalog.join(', ')}

Se algum box preenchido violar restrições técnicas (palavra proibida, caps-lock no assunto), corrija apenas o necessário, preserve a ideia central, e registre obrigatoriamente em "riscos".${estiloIlustracao ? `\n\n=== ESTILO DE DESIGN SELECIONADO PELO USUÁRIO (OBRIGATÓRIO) ===\n"${estiloIlustracao}"\nEste estilo DEVE ser usado nos frames visuais. O campo estiloIlustracao no JSON de resposta DEVE ser exatamente: "${estiloIlustracao}"\n` : ''}`;
}

function buildResponseSchema(aspectRatio: string, tipoGeracao: string, qtdFrames: number = 3) {
  const includeVisual = tipoGeracao !== 'texto';

  const visualSchema = {
    type: Type.OBJECT,
    description: `Briefing de produção visual do banner do email (aspect ratio ${aspectRatio}, formato GIF)`,
    properties: {
      formato: { type: Type.STRING, description: "Formato do banner (ex: GIF animado 3 frames, estático, etc.)" },
      paletaRecomendada: {
        type: Type.OBJECT,
        properties: {
          nome: { type: Type.STRING },
          cores: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Códigos HEX de cores recomendadas na proporção certa"
          }
        },
        required: ["nome", "cores"]
      },
      estiloIlustracao: { type: Type.STRING, description: "Descrição do estilo visual. Ex: Ilustrado 3D ou 2D orgânico com presença humana" },
      frames: {
        type: Type.ARRAY,
        description: `Array com EXATAMENTE ${qtdFrames} descrições de frames para o GIF — nem mais, nem menos. ESCOPO DECRESCENTE OBRIGATÓRIO: o item [0] (frame 1) é a ÚNICA descrição completa — objeto herói + todos os objetos secundários + cor + posição + fundo + atmosfera. Os itens seguintes descrevem SOMENTE o delta — apenas o que muda no objeto herói da ação — sem redescrever em detalhe objetos secundários/fundo/atmosfera já estabelecidos no item [0] (cite-os no máximo de passagem como inalterados). Isso evita que a IA de imagem redesenhe e desloque por engano objetos que deveriam ficar parados. Todo objeto que não é o foco da ação deve permanecer na MESMA posição em todos os frames — só o objeto da ação principal pode mudar, de forma incremental/contínua.`,
        items: { type: Type.STRING },
      },
      quantidadeFrames: {
        type: Type.NUMBER,
        description: `Deve ser exatamente ${qtdFrames}`,
      },
      posicaoCta: { type: Type.STRING, description: "Descrição de onde o botão CTA se posiciona" },
      tipografia: { type: Type.STRING, description: "Indicação estrita de fontes (Apice: Roca e Host Grotesk. Barbours: Sans-serif alto contraste)" }
    },
    required: ["formato", "paletaRecomendada", "estiloIlustracao", "frames", "quantidadeFrames", "posicaoCta", "tipografia"]
  };

  const properties: Record<string, any> = {
    copy: {
      type: Type.OBJECT,
      description: "Bloco de copy calibrado",
      properties: {
        assunto: { type: Type.STRING, description: "Assunto do email, tamanho correto do playbook (SEM %, OFF, R$, GRÁTIS, CAPS LOCK)" },
        preHeader: { type: Type.STRING, description: "Sempre fixo em 'Mas, vou precisar cancelar em breve'" },
        headlineBanner: { type: Type.STRING, description: "Headline textual do banner usando verbo de mecânica (ex: 'ABRA RECEBA SEU MIMO')" },
        subHeadlineBanner: { type: Type.STRING, description: "Subtopico ilustrando recompensa + prazo" },
        ctaBotao: { type: Type.STRING, description: "Verbo simples no imperativo/infinitivo do botão (ex: 'ABRIR')" }
      },
      required: ["assunto", "preHeader", "headlineBanner", "subHeadlineBanner", "ctaBotao"]
    },
    ...(includeVisual ? { visual: visualSchema } : {}),
    operacional: {
      type: Type.OBJECT,
      description: "Briefing de operação e envio",
      properties: {
        mecanicaEscolhida: { type: Type.STRING, description: "Mecânica da pauta" },
        justificativaMecanica: { type: Type.STRING, description: "Uma justificativa embasada nas estatísticas ou KPIs reais do histórico" },
        recompensaEscolhida: { type: Type.STRING, description: "Recompensa recomendada ligada de forma coerente" },
        diaRecomendado: { type: Type.STRING, description: "Melhor dia sugerido (priorizar quartas ou domingos" },
        horarioRecomendado: { type: Type.STRING, description: "Janela horária sugerida" },
        segmentoRecomendado: { type: Type.STRING, description: "Segmento ideal" }
      },
      required: ["mecanicaEscolhida", "justificativaMecanica", "recompensaEscolhida", "diaRecomendado", "horarioRecomendado", "segmentoRecomendado"]
    },
    previsao: {
      type: Type.OBJECT,
      description: "Previsão calculada de performance com base nas referências de Hits análogas",
      properties: {
        aberturaEsperada: { type: Type.STRING, description: "Exemplo: '28-35%'" },
        ctorEsperado: { type: Type.STRING, description: "Exemplo: '3-5%'" },
        receitaEsperada: { type: Type.STRING, description: "Exemplo: 'R$ 6.000 - R$ 9.000'" },
        casesReferencia: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Lista de 1 a 3 IDs de disparos históricos reais do banco (ex: ['EMA-101', 'EMA-104'])"
        },
        confianca: { type: Type.STRING, enum: ["alta", "baixa"], description: "alta quando há 3+ cases análogos, baixa quando histórico análogo é menor que 3 cases" },
        confiancaMotivo: { type: Type.STRING, description: "Texto justificando o nível de confiança" }
      },
      required: ["aberturaEsperada", "ctorEsperado", "receitaEsperada", "casesReferencia", "confianca", "confiancaMotivo"]
    },
    riscos: {
      type: Type.ARRAY,
      description: "Quaisquer riscos técnicos identificados infringindo as regras invioláveis ou boas práticas",
      items: {
        type: Type.OBJECT,
        properties: {
          campo: { type: Type.STRING },
          nivel: { type: Type.STRING, enum: ["alto", "medio", "baixo"], description: "Nível de severidade do risco" },
          mensagem: { type: Type.STRING },
          alternativaSugerida: { type: Type.STRING }
        },
        required: ["campo", "nivel", "mensagem", "alternativaSugerida"]
      }
    }
  };

  return {
    type: Type.ARRAY,
    description: "Lista de propostas de pauta geradas em total harmonia com o Playbook",
    items: {
      type: Type.OBJECT,
      properties,
      required: includeVisual
        ? ["copy", "visual", "operacional", "previsao", "riscos"]
        : ["copy", "operacional", "previsao", "riscos"]
    }
  };
}

export async function generatePautaContent(params: {
  modo: string;
  input: any;
  marca: string;
  aspectRatio: string;
  tipoGeracao: string;
  direcStr: string;
  refImageData: { mimeType: string; data: string } | null;
  databaseDisparos: any[];
  visualHitsBlock: string;
  crmAiEstilos: string[];
  mecanicasCatalog: string[];
  estiloIlustracao?: string;
}): Promise<any[]> {
  const { modo, input, marca, aspectRatio, tipoGeracao, direcStr, refImageData, databaseDisparos, visualHitsBlock, crmAiEstilos, mecanicasCatalog, estiloIlustracao } = params;

  const contextDb = databaseDisparos.filter((d: any) => d.marca === marca);
  const dbFormatted = JSON.stringify(contextDb, null, 2);

  const playbookMarca = buildPlaybook(marca);
  const systemInstruction = buildSystemInstruction(marca, aspectRatio, crmAiEstilos, visualHitsBlock, playbookMarca, tipoGeracao);
  const promptModo = buildPromptModo(modo, input, marca, direcStr, refImageData, mecanicasCatalog, aspectRatio, estiloIlustracao);

  const instructionsPrompt = `${promptModo}

Aqui está o histórico completo de disparos reais da marca ${marca} para você carregar como contexto primário e justificar as escolhas:
${dbFormatted}
${visualHitsBlock}
Gere um formato JSON contendo um array de ideias de pautas (com o tamanho exato solicitado: ${modo === 'A' ? input.quantidadePautas : 1}). Respeite à risca o esquema de tipos definido.`;

  const contentsPayload = refImageData
    ? [{ role: 'user', parts: [{ text: instructionsPrompt }, { inlineData: { mimeType: refImageData.mimeType, data: refImageData.data } }] }]
    : instructionsPrompt;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: contentsPayload,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: buildResponseSchema(aspectRatio, tipoGeracao, modo === 'B' && typeof input.quantidadeFrames === 'number' ? Math.min(Math.max(input.quantidadeFrames, 2), 20) : 3),
    }
  });

  return JSON.parse(response.text || "[]");
}

export async function generateGifAgentConcept(params: {
  marca: string;
  conteudosAprendizado: any[];
  feedbackAprovados: any[];
  feedbackRejeitados: any[];
  motivoRejeicaoAnterior?: string;
}): Promise<any> {
  const { marca, conteudosAprendizado, feedbackAprovados, feedbackRejeitados, motivoRejeicaoAnterior } = params;

  const playbookMarca = buildPlaybook(marca);
  const aspectRatio = '1:1';

  // Amostra aleatória (não os 272 de uma vez) — mandar a lista completa em todo prompt
  // estoura a quota de tokens/minuto do tier gratuito do Gemini rapidinho, já que o agente
  // dispara várias gerações em sequência (cota diária + regeneração por reprovação).
  const AMOSTRA_MAX = 25;
  const amostraGifs = conteudosAprendizado.length > AMOSTRA_MAX
    ? [...conteudosAprendizado].sort(() => Math.random() - 0.5).slice(0, AMOSTRA_MAX)
    : conteudosAprendizado;

  const gifsBlock = amostraGifs.length > 0
    ? amostraGifs.map((c, i) =>
        `  ${i + 1}. [${c.marca}] "${c.nome_design}" — Mecânica: ${c.mecanica_texto}\n     Composição: ${c.composicao_texto}`
      ).join('\n\n')
    : '  Nenhum GIF analisado disponível ainda.';

  const aprovadosBlock = feedbackAprovados.length > 0
    ? feedbackAprovados.map((f, i) => {
        const op = f.recomendacao_estruturada?.operacional;
        return `  ${i + 1}. Mecânica aprovada: "${op?.mecanicaEscolhida ?? '?'}" — Racional: ${op?.justificativaMecanica ?? '?'}`;
      }).join('\n')
    : '  Nenhum conceito aprovado ainda — este é um dos primeiros.';

  const reprovadosBlock = feedbackRejeitados.length > 0
    ? feedbackRejeitados.map((f, i) => {
        const op = f.recomendacao_estruturada?.operacional;
        return `  ${i + 1}. Mecânica REPROVADA: "${op?.mecanicaEscolhida ?? '?'}"${f.feedback_usuario ? ` — Motivo da reprovação: "${f.feedback_usuario}"` : ''}`;
      }).join('\n')
    : '  Nenhum conceito reprovado ainda.';

  const systemInstruction = `Você é o Agente Autônomo de Criação de GIFs para CRM da marca ${marca}. Sua função é propor, sem intervenção humana no momento da criação, UM novo conceito de GIF de email marketing (mecânica + racional + copy + frames visuais), inspirado no que já funcionou historicamente, mas com uma mecânica e racional GENUINAMENTE NOVOS — nunca repita literalmente uma mecânica já existente na lista de GIFs analisados ou já aprovada/reprovada abaixo.

${playbookMarca}

=== REGRAS INVIOLÁVEIS DE ASSUNTO (ENTREGABILIDADE) ===
1. NUNCA use Caps Lock no assunto inteiro.
2. NUNCA use mais de 2 emojis por assunto.
3. NUNCA use as palavras ou símbolos "%", "OFF", "GRÁTIS", "R$" no assunto.
4. O Pré-header deve ser SEMPRE E EXCLUSIVAMENTE o texto fixo "Mas, vou precisar cancelar em breve".

=== GIFS ANALISADOS QUE JÁ FUNCIONARAM (grounding — de qualquer marca do grupo, use como entendimento de padrões visuais e de mecânica que geram engajamento, mas NÃO copie) ===
${gifsBlock}

=== CONCEITOS JÁ AVALIADOS POR HUMANOS NESTE PROGRAMA DO AGENTE ===
Aprovados (reforce o padrão que funcionou, mas não repita a mesma mecânica):
${aprovadosBlock}

Reprovados (NÃO proponha de novo; evite o mesmo problema apontado no motivo):
${reprovadosBlock}
${motivoRejeicaoAnterior ? `\n=== ESTA É UMA REGENERAÇÃO IMEDIATA APÓS REPROVAÇÃO ===\nO conceito anterior gerado nesta mesma rodada foi reprovado com o motivo: "${motivoRejeicaoAnterior}". Gere um conceito claramente diferente que evite esse problema específico.\n` : ''}
Gere exatamente 1 conceito de GIF com 3 frames (inicial, intermediário, final), seguindo o formato ${aspectRatio}, com racional de por que essa mecânica nova deve funcionar para ${marca}. Em "previsao.casesReferencia" cite o(s) nome(s) de GIF (campo nome_design) da lista de grounding que mais inspiraram o conceito.`;

  const instructionsPrompt = `Proponha o novo conceito de GIF autônomo para a marca ${marca}, em formato JSON, respeitando à risca o esquema de tipos definido.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: instructionsPrompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: buildResponseSchema(aspectRatio, 'imagem', 3),
    }
  });

  const parsed = JSON.parse(response.text || "[]");
  return Array.isArray(parsed) ? parsed[0] : parsed;
}

export async function generateAbTestProposal(params: {
  marca: string;
  pautaAprovada: any;
  candidatosHistoricos: any[];
}): Promise<{ conteudoId: string | null; racional: string }> {
  const { marca, pautaAprovada, candidatosHistoricos } = params;

  const AMOSTRA_MAX = 25;
  const amostraCandidatos = candidatosHistoricos.length > AMOSTRA_MAX
    ? [...candidatosHistoricos].sort(() => Math.random() - 0.5).slice(0, AMOSTRA_MAX)
    : candidatosHistoricos;

  const candidatosBlock = amostraCandidatos.map((c, i) =>
    `  ${i + 1}. id="${c.id}" [${c.marca}] "${c.nome_design}" — Mecânica: ${c.mecanica_texto}\n     Composição: ${c.composicao_texto}`
  ).join('\n\n');

  const systemInstruction = `Você é um estrategista de testes A/B de CRM. Dado um novo conceito de GIF recém-aprovado, escolha, dentre os GIFs históricos analisados abaixo, o melhor "adversário" para um teste A/B — seja por ser da mesma família de mecânica (testar uma variação de execução) ou por representar a hipótese oposta que vale confrontar. Justifique a escolha de forma objetiva e prática para quem vai rodar o teste no Insider.`;

  const instructionsPrompt = `Novo conceito aprovado (marca ${marca}):
Mecânica: ${pautaAprovada.operacional?.mecanicaEscolhida}
Racional: ${pautaAprovada.operacional?.justificativaMecanica}
Recompensa: ${pautaAprovada.operacional?.recompensaEscolhida}
Assunto: ${pautaAprovada.copy?.assunto}

Candidatos históricos disponíveis para parear no teste A/B:
${candidatosBlock}

Escolha exatamente um "id" da lista de candidatos (campo conteudoId) e escreva o racional da comparação (campo racional). Responda em JSON.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: instructionsPrompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          conteudoId: { type: Type.STRING, description: "id exato de um dos candidatos históricos listados" },
          racional: { type: Type.STRING, description: "Racional da comparação A/B" },
        },
        required: ["conteudoId", "racional"],
      },
    }
  });

  const parsed = JSON.parse(response.text || "{}");
  const validId = candidatosHistoricos.some(c => c.id === parsed.conteudoId) ? parsed.conteudoId : null;
  return { conteudoId: validId, racional: parsed.racional ?? '' };
}

export async function generateVariationContent(pauta: any): Promise<any> {
  const { marca, operacional } = pauta;
  const isApice = marca === 'Apice';

  const systemInstruction = `Você é um refinador de e-mails para equipe de CRM. Sua tarefa única é fornecer uma variação alternativa do assunto, headline e CTA mantendo a mesma mecânica e recompensa em conformidade estrita com o playbook de ${marca}. Não altere o pré-header.`;

  const instructionsPrompt = `Refine e me dê uma nova alternativa de Copy (Assunto, Headline, CTA) para a seguinte pauta de CRM:
Marca: ${marca}
Mecânica original: ${operacional.mecanicaEscolhida}
Recompensa original: ${operacional.recompensaEscolhida}

Assunto antigo: "${pauta.copy.assunto}"
Headline do banner antigo: "${pauta.copy.headlineBanner}"
CTA antigo: "${pauta.copy.ctaBotao}"

Regras invioláveis de assunto para ${marca}:
- NUNCA use Caps Lock inteiro.
- NUNCA use as palavras ou símbolos "%", "OFF", "GRÁTIS", "R$".
- Máximo de 2 emojis.
- Tamanho: entre ${isApice ? '27 e 47' : '16 e 39'} caracteres.
- Pré-header de ser fixo em: "Mas, vou precisar cancelar em breve".

Retorne em formato JSON contendo o objeto de copy refinado.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: instructionsPrompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          assunto: { type: Type.STRING },
          preHeader: { type: Type.STRING },
          headlineBanner: { type: Type.STRING },
          subHeadlineBanner: { type: Type.STRING },
          ctaBotao: { type: Type.STRING }
        },
        required: ["assunto", "preHeader", "headlineBanner", "subHeadlineBanner", "ctaBotao"]
      }
    }
  });

  const parsedCopy = JSON.parse(response.text || "{}");
  parsedCopy.preHeader = "Mas, vou precisar cancelar em breve";
  return parsedCopy;
}

// ─────────────────────────────────────────────────────────────────────────────
// Leitura assistida do calendário.
//
// REGRA 1 do modelo: o LLM nunca calcula um número. Aqui isso não é uma recomendação no
// prompt que a gente torce para ser obedecida — é uma propriedade do desenho. O calendário
// chega pronto, com receita, R$/mil, índices e restrições já decididos pelo gerador
// determinístico. Não existe pergunta que faça a IA produzir um número que não esteja no
// payload, porque não há nada para ela calcular: ela recebe o resultado e o explica.
//
// A resposta é prosa, sem responseSchema. Um schema aqui empurraria o modelo a preencher
// campos — e campo vazio que precisa ser preenchido é exatamente como um número inventado
// nasce.
// ─────────────────────────────────────────────────────────────────────────────

// Mantido em sincronia com `instrucaoCalendario()` em worker.ts — o Worker é o que
// roda em produção, este é o Express local. Divergir os dois prompts significa que
// a leitura assistida explica o plano de um jeito na sua máquina e de outro na
// mão de quem usa.
const instrucaoCalendario = (catalogoReal: boolean) => `Você é analista de CRM do Grupo GoBeaute e está lendo um calendário de disparos que JÁ FOI GERADO por um modelo estatístico determinístico.

REGRA ABSOLUTA E INEGOCIÁVEL: você NUNCA calcula, estima, projeta ou inventa um número. Todo número que você escrever tem de estar literalmente presente no JSON do calendário que recebeu. Se alguém perguntar algo que exija um número que não está lá, responda que o modelo não emite esse número e diga qual decisão do modelo chega mais perto. Nunca some, multiplique ou faça média de valores do payload para produzir um número novo.

O que você faz: explica POR QUE o plano é como é, usando o que o payload declara — os índices de cada slot, as restrições aplicadas e relaxadas, os avisos, a decomposição por alavanca e a fronteira receita × eficiência.

Contexto do modelo que você precisa dominar para explicar bem:
- SLOT = (marca, data, hora, oferta). Um dia tem 2 ou 3 slots.
- FAMÍLIA é a unidade de fadiga, e o rodízio entre famílias é uma das alavancas.
- I1 (dia da semana) é a alavanca #1, coeficiente 0,90. Quarta é historicamente o dia mais forte.
- Quais alavancas valem NESTA marca não é fixo, e você não deve supor: cada etapa da decomposição no payload traz um campo "validado". Etapa validada = o índice sobreviveu à validação fora da amostra desta marca e o ganho dela é medido, então pode ser citado como razão. Etapa não validada = o índice não transferiu aqui; a decisão correspondente veio da grade operacional e do rodízio, e a resposta honesta a "por que esse horário?" é exatamente essa. Nunca invente justificativa de performance para uma etapa não validada, e nunca negue o ganho de uma etapa validada.
- I2 é a FAIXA DE ESPAÇAMENTO desde o disparo anterior da mesma família, não a família em si. I3 é a hora dentro da grade daquele dia. I4 é a oferta dentro da família já eleita. Cada índice é medido contra o conjunto de onde a escolha saiu, então o ganho de cada etapa é o que MIRAR acrescenta — não o nível absoluto do índice.
- Elasticidade de volume α = 0,31: receita ∝ V^0,31 e R$/mil ∝ V^-0,69. Mais volume sempre traz mais receita e sempre custa eficiência.
- O 3º disparo do dia não sobreviveu à validação — é hipótese, não compromisso.
- H1 (teto semanal de dias com 3 ofertas), H2 (nunca duas famílias iguais no mesmo dia), H3 (célula sem suporte histórico é bloqueada), H5 (dias inativos da marca) são restrições rígidas.

${catalogoReal
  ? `CATÁLOGO REAL: as ofertas e famílias deste plano vêm do histórico da marca (dataset crm_modelo), não são posições vazias. Pode citá-las pelo nome. O que continua fora do que o modelo mede: se a oferta "combina" com a data, com a estação ou com o público — nada disso foi estimado. O plano decide POSIÇÕES (qual dia, qual hora, qual família) a partir de fadiga e de índice por dia; a adequação comercial da oferta continua sendo julgamento de quem executa. Fluxos automatizados (carrinho abandonado, recompra, expresso) foram excluídos do catálogo porque não são agendáveis — se perguntarem por eles, diga isso e diga também o custo: a pressão que eles exercem na caixa de entrada não entra no modelo de fadiga.`
  : `CATÁLOGO SINTÉTICO: enquanto as ofertas vierem nomeadas como "Oferta A1", "Oferta B2" e as famílias como "Família A", "Família B", elas são posições vazias — não são o catálogo real da marca. Nunca atribua significado comercial a esses nomes, nunca deduza o que a oferta seria, nunca comente se ela combina com a data ou com o público. Fale delas como o que são: a 1ª família, a 2ª família, o rodízio entre elas. Se o usuário perguntar sobre o conteúdo de uma oferta, diga que o catálogo real ainda não foi conectado e que o plano decide POSIÇÕES (qual dia, qual hora, qual família), não qual produto entra em cada posição — essa escolha continua sendo de quem executa.`}

Tom: direto, técnico, em português do Brasil, sem emoji, sem bullet decorativo, sem elogiar o plano. Escreva como quem apresenta um plano para quem vai executá-lo e cobrar resultado. Prefira frases curtas. Quando o payload declarar uma restrição relaxada ou um aviso, mencione — é o tipo de coisa que quem executa precisa saber e ninguém lê no rodapé.`;

/** Resumo compacto do calendário. Slot a slot cabe em ~90 linhas; acima disso, agrega por dia. */
function resumirCalendario(cal: any): string {
  const slots: any[] = cal.slots ?? [];
  const porDia = new Map<string, any[]>();
  for (const s of slots) porDia.set(s.data, [...(porDia.get(s.data) ?? []), s]);

  const detalhado = porDia.size <= 31;
  const grade = detalhado
    ? [...porDia.entries()]
        .map(
          ([data, doDia]) =>
            `${data} (${doDia[0].diaSemana}, I1=${doDia[0].indices.dia}): ` +
            doDia
              .sort((a, b) => a.hora - b.hora)
              .map(
                (s) =>
                  `${String(s.hora).padStart(2, '0')}h "${s.oferta}" [família ${s.familia}, idx família ${s.indices.familia}, agr ${s.agressividade}, gap ${s.gapFamiliaH}h, ${s.enviosPlanejados} envios, R$ ${s.receitaPrevista}, ${s.rpmPrevisto} R$/mil${s.confianca.validado ? '' : ', NÃO VALIDADO'}${s.editado ? ', EDITADO À MÃO' : ''}]`,
              )
              .join(' | '),
        )
        .join('\n')
    : [...porDia.entries()]
        .map(
          ([data, doDia]) =>
            `${data} (${doDia[0].diaSemana}): ${doDia.length} disparos, famílias ${doDia.map((s) => s.familia).join('/')}, ${doDia.reduce((a, s) => a + s.enviosPlanejados, 0)} envios, R$ ${doDia.reduce((a, s) => a + s.receitaPrevista, 0)}`,
        )
        .join('\n');

  return `MARCA: ${cal.marca}
PERÍODO: ${cal.periodo?.inicio} a ${cal.periodo?.fim} (${porDia.size} dias ativos, ${slots.length} disparos)
MODO: ${cal.modo === 'eficiencia' ? 'eficiência (R$/mil)' : 'receita máxima'}
META DECLARADA: ${cal.meta ? `${cal.meta.tipo} = ${cal.meta.valor}` : 'nenhuma (metas são opcionais neste modelo)'}
PROCEDÊNCIA DOS DADOS: ${cal.procedencia === 'dados' ? 'catálogo e índices medidos no histórico (BigQuery)' : cal.procedencia === 'ditado' ? 'parâmetros ditados à mão' : 'catálogo sintético (posições vazias)'}
${cal.editadoManualmente ? 'ATENÇÃO: este calendário foi editado à mão depois de gerado. Slots marcados EDITADO À MÃO não são proposta do modelo.\n' : ''}
PREVISÃO:
- ritmo de hoje (sem modelo): R$ ${cal.previsao?.ritmoDeHoje}
- plano validado: R$ ${cal.previsao?.validado} (${cal.previsao?.ganhoValidadoPct}% sobre o ritmo de hoje)
- in-sample (NÃO USAR, existe só para expor o viés): R$ ${cal.previsao?.inSampleNaoUsar}

DECOMPOSIÇÃO POR ALAVANCA:
${(cal.decomposicao ?? []).map((e: any) => `- ${e.etapa}: R$ ${e.receita} (${e.ganhoPct >= 0 ? '+' : ''}${e.ganhoPct}%)${e.validado ? '' : ' — não validado, ganho creditado 0,00'}`).join('\n')}

FRONTEIRA RECEITA × EFICIÊNCIA:
${(cal.fronteira ?? []).map((p: any) => `- volume ${p.deltaVolumePct >= 0 ? '+' : ''}${p.deltaVolumePct}%: R$ ${p.receita}, ${p.rpm} R$/mil`).join('\n')}

RESTRIÇÕES APLICADAS:
${(cal.restricoesAplicadas ?? []).map((r: string) => `- ${r}`).join('\n') || '- nenhuma'}

RESTRIÇÕES RELAXADAS (cederam durante a geração):
${(cal.restricoesRelaxadas ?? []).map((r: string) => `- ${r}`).join('\n') || '- nenhuma'}

AVISOS DO MODELO:
${(cal.avisos ?? []).map((a: string) => `- ${a}`).join('\n') || '- nenhum'}

GRADE${detalhado ? '' : ' (agregada por dia — o período é longo demais para slot a slot)'}:
${grade}`;
}

export async function explicarCalendario(params: {
  calendario: any;
  pergunta?: string;
  eventosEspeciais?: string;
}): Promise<string> {
  const { calendario, pergunta, eventosEspeciais } = params;
  const dias = new Set((calendario.slots ?? []).map((s: any) => s.data)).size;

  // Períodos longos pedem síntese, não narração dia a dia. Trinta parágrafos descrevendo
  // trinta quartas-feiras não é leitura assistida, é o calendário outra vez em prosa.
  const formato = pergunta
    ? `PERGUNTA DO USUÁRIO: ${pergunta}

Responda a pergunta e só ela, em no máximo dois parágrafos curtos. Se a resposta honesta for "o modelo não mede isso", diga exatamente isso e explique de onde a decisão veio de fato.`
    : dias > 14
      ? `Escreva uma leitura GERAL do período, em 3 a 4 parágrafos curtos. O período é longo (${dias} dias): não narre dia a dia. Cubra, nesta ordem: (1) a lógica de distribuição — quais dias concentram volume e por quê; (2) como o rodízio de famílias foi montado e onde a fadiga apertou; (3) o trade-off receita × eficiência neste modo, ancorado na fronteira; (4) o que exige atenção de quem vai executar — restrições relaxadas, avisos e slots não validados.`
      : `Escreva uma leitura do calendário em 3 parágrafos curtos. Cubra: (1) a lógica de distribuição entre os dias e o motivo; (2) o rodízio de famílias e os pontos onde a fadiga apertou; (3) o trade-off do modo escolhido e o que exige atenção na execução — restrições relaxadas, avisos e slots não validados.`;

  const conteudo = `${resumirCalendario(calendario)}

${eventosEspeciais?.trim() ? `CONTEXTO INFORMADO PELO USUÁRIO (prosa, não entrou em cálculo nenhum — use só para comentar encaixe, nunca para justificar número):\n${eventosEspeciais.trim()}\n` : ''}
${formato}`;

  if (!aiProxyConfigurado('calendario')) {
    throw new Error(
      'Nenhuma chave do AI proxy configurada para a área de calendários. ' +
        'Defina AI_PROXY_KEY (ou CALENDARIO_AI_KEY) no .env.',
    );
  }

  // Prosa, não JSON: a leitura é texto corrido e um schema aqui empurraria o modelo
  // a preencher campos em vez de responder o que foi perguntado (ver nota na §527).
  return chatTexto({
    area: 'calendario',
    system: instrucaoCalendario(calendario.procedencia === 'dados'),
    user: conteudo,
  });
}
