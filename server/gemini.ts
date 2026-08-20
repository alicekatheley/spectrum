import dotenv from "dotenv";
dotenv.config();
import { GoogleGenAI, Type } from "@google/genai";

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

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
