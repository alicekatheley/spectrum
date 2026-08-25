export type Brand = 'Apice' | 'Barbours';

// Contas da Insider com acesso configurado (Passo 3 do Modo C) — mais amplo que Brand porque
// o conteúdo do agente não é amarrado a marca; qualquer pauta pode ir pra qualquer conta aqui.
export type ContaInsider = 'Apice' | 'Barbours' | 'Rituaria' | 'Lescent' | 'Kokeshi' | 'Gocase';

// ─────────────────────────────────────────────────────────────────────────────
// Geração de Calendários
//
// Estes tipos espelham a §9.1 de MODELO_CALENDARIO_MULTIMARCA.md — o schema de
// saída do gerador. `snapshotIndicesId`, `restricoesAplicadas`, `restricoesRelaxadas`,
// `avisos` e os três cenários de `previsao` NÃO são opcionais: a §14 (checklist de
// aceite) proíbe publicar um calendário sem eles.
// ─────────────────────────────────────────────────────────────────────────────

// Marcas atendidas pela aba de Geração de Calendários — conjunto mais amplo que `Brand`,
// que segue restrito às duas marcas com playbook de conteúdo.
// `Gocase` fica no seletor mas não gera: a origem (Spree) não tem coluna de UTM nenhuma,
// o que torna a atribuição da §2.4 impossível. É bloqueio de origem, não de prioridade (§2.9).
export type MarcaCalendario = 'Apice' | 'Barbours' | 'Rituaria' | 'Gocase' | 'Kokeshi' | 'Lescent';

// Nomes por extenso, como o modelo emite em `dia_semana`. A abreviação de 3 letras é
// só de exibição e vive no mapa DIA_CURTO do CalendarioGrid.
export type DiaSemana = 'Domingo' | 'Segunda' | 'Terca' | 'Quarta' | 'Quinta' | 'Sexta' | 'Sabado';

// §6 — os dois modos. Valores idênticos ao check de `calendario.modo` no Supabase (§11.2).
export type ModoCalendario = 'receita_maxima' | 'eficiencia';

// Índices que sustentam o slot (§9.1). Cada um carrega seu próprio coeficiente de
// transferência (§4.5) — em Lescent, hora e oferta transferiram a 0,00.
export interface IndicesSlot {
  dia: number;
  hora: number;
  oferta: number;
  familia: number;
}

// SLOT = (marca, data, hora, oferta) — a unidade de calendário da §1.2. Um slot agrega
// ~2 campanhas. O calendário decide quando, o quê e quanto; nunca para quem, que é
// decisão do gerador de segmentação (§9.2).
export interface CalendarioSlot {
  data: string; // YYYY-MM-DD
  diaSemana: DiaSemana;
  slot: number; // ordem dentro do dia: 1, 2 ou 3
  hora: number; // hora cheia, 0–23
  oferta: string;
  familia: string; // unidade de fadiga (§1.4)
  agressividade: number; // escada 1–4 (§1.4)
  enviosPlanejados: number;
  indices: IndicesSlot;
  gapFamiliaH: number; // descanso de família que o índice I2 assume (§9.3)
  janelaFamilia: string; // bucket do gap, ex.: '4-7d'
  score: number;
  rpmPrevisto: number;
  receitaPrevista: number;
  confianca: { validado: boolean; ic80: [number, number] };
  // Marcado quando o slot foi alterado à mão depois da geração. O plano continua sendo do
  // modelo; o que muda é que ESTE slot deixou de ser proposta dele e a tela precisa dizer isso.
  editado?: boolean;
}

// Os três cenários da Fase 6. Emitir os três é obrigatório: `inSampleNaoUsar` existe
// só para expor o tamanho do viés e precisa ser exibido com aviso de "NÃO USE".
export interface PrevisaoCalendario {
  ritmoDeHoje: number;
  validado: number;
  inSampleNaoUsar: number;
  ganhoValidadoPct: number;
}

// Decomposição alavanca a alavanca, em ordem de transferência decrescente (Fase 6).
export interface EtapaDecomposicao {
  etapa: string;
  receita: number;
  ganhoPct: number;
  validado: boolean;
}

// Um ponto da fronteira receita × RPM (§6.4). O modelo emite a curva, não um ponto.
export interface PontoFronteira {
  deltaVolumePct: number;
  receita: number;
  rpm: number;
}

export interface MetaCalendario {
  tipo: 'receita' | 'rpm';
  valor: number;
}

export interface CalendarioGerado {
  id: string;
  marca: MarcaCalendario;
  periodo: { inicio: string; fim: string };
  modo: ModoCalendario;
  meta: MetaCalendario | null;
  snapshotIndicesId: string;
  geradoEm: string; // ISO
  slots: CalendarioSlot[];
  previsao: PrevisaoCalendario;
  decomposicao: EtapaDecomposicao[];
  fronteira: PontoFronteira[];
  restricoesAplicadas: string[];
  restricoesRelaxadas: string[];
  avisos: string[];
  // Modo degradado (§8.3): marca que não passa o gate mínimo sai sem previsão de receita.
  degradado?: boolean;
  // Ligado no primeiro slot editado à mão. Previsão e fronteira são recalculadas a cada
  // edição; a decomposição, não — ela descreve como o MODELO chegou ao plano original, e
  // reescrevê-la depois de uma edição manual seria atribuir ao modelo uma decisão que não
  // foi dele.
  editadoManualmente?: boolean;
  /**
   * De onde veio o catálogo que gerou ESTE plano — 'sintetico' | 'ditado' | 'dados'.
   *
   * Carimbado no plano, e não consultado por marca na hora de exibir, porque o
   * usuário pode trocar o seletor de marca depois de gerar. Lido por marca, o
   * rótulo passaria a descrever a marca selecionada em vez do plano na tela.
   */
  procedencia?: 'sintetico' | 'ditado' | 'dados';
}

// Entrada do gerador. TODAS as metas são opcionais: elas são leitura sobre o plano, nunca
// comando sobre ele. Modo A aceita meta de receita (§6.2); Modo B aceita meta de RPM e piso
// de receita — o piso é o parâmetro que responde "até onde a eficiência pode ceder receita"
// (§6.3). Sem piso declarado, o modo B para no corte medido de 15%.
// `diasAgressivos` (dow 0–6) e `eventosEspeciais` são direcionamento do usuário, também
// opcionais. `eventosEspeciais` é prosa e não entra em cálculo nenhum (Regra 1 — o LLM
// nunca calcula um número).
export interface InputCalendario {
  marca: MarcaCalendario;
  modo: ModoCalendario;
  dataInicio: string;
  dataFim: string;
  metaReceita?: number;
  metaRpm?: number;
  pisoReceita?: number;
  diasAgressivos?: number[];
  eventosEspeciais: string;
}

export type CampaignContext =
  | 'lancamento' 
  | 'recompra' 
  | 'reativacao' 
  | 'sazonal' 
  | 'queima_estoque' 
  | 'datas_comemorativas';

export type RewardType = 
  | 'desconto_percentual' 
  | 'cupom_valor_fixo' 
  | 'brinde_fisico' 
  | 'produto_mimo' 
  | 'combo'
  | 'choose_for_me';

export interface DisparoHistorico {
  id: string;
  marca: Brand;
  mecanica: string;
  disparos: number;
  receitaMedia: number;
  performance: string;
  contextosRecomendados: CampaignContext[];
}

export interface InputModoA {
  marca: Brand;
  quantidadePautas: number;
  contextoCampanha: CampaignContext | '';
  segmentoAlvo: string;
  dataDisparo: string;
  tipoRecompensa: RewardType;
  evitarMecanicas: string[];
}

export interface InputModoB {
  marca: Brand;
  boxTituloEmail: string;
  boxHeadlineBanner?: string;
  boxSubtituloEmail: string;
  boxCta: string;
  boxMecanicaOuEstatico: string;
  boxRecompensa: string;
  estiloVisualTexto?: string;
  fonteEscolhida?: string;
  estiloBotaoEscolhido?: string;
  corTextoPrincipal?: string;
  fonteSubtitulo?: string;
  corSubtitulo?: string;
  corBotaoEscolhida?: string;
  corTextoBotao?: string;
  fonteBotao?: string;
  quantidadeFrames?: number;
  estiloDesign?: string;
}

export interface PautaCopy {
  assunto: string;
  preHeader: string;
  headlineBanner: string;
  subHeadlineBanner: string;
  ctaBotao: string;
}

export interface PautaVisual {
  formato: string;
  paletaRecomendada: {
    nome: string;
    cores: string[]; // HEX codes
    fundo?: string; // descrição livre do background, quando o conceito propõe um (ex: Modo C)
  };
  estiloIlustracao: string;
  frameInicial?: string;
  frameIntermediario?: string;
  frameFinal?: string;
  frames?: string[];
  quantidadeFrames?: number;
  posicaoCta: string;
  tipografia: string;
}

export interface PautaOperacional {
  mecanicaEscolhida: string;
  justificativaMecanica: string;
  recompensaEscolhida: string;
  diaRecomendado: string;
  horarioRecomendado: string;
  segmentoRecomendado: string;
}

export interface PerformancePrevisao {
  aberturaEsperada: string; // ex: "28-35%"
  ctorEsperado: string; // ex: "3-5%"
  receitaEsperada: string; // ex: "R$ 6k-10k"
  casesReferencia: string[]; // ex: ["EMA-101", "EMA-102"]
  confianca: 'alta' | 'baixa';
  confiancaMotivo?: string;
}

export interface RiscoAlerta {
  campo: string;
  nivel: 'alto' | 'medio' | 'baixo';
  mensagem: string;
  alternativaSugerida: string;
}

export interface PautaGerada {
  id: string;
  marca: Brand;
  // 'C' = gerada automaticamente pelo Agente de GIF (sem intervenção humana na criação).
  modo: 'A' | 'B' | 'C';
  tipoGeracao: 'texto' | 'imagem' | 'texto_imagem';
  copy: PautaCopy;
  visual?: PautaVisual;
  operacional: PautaOperacional;
  previsao: PerformancePrevisao;
  riscos: RiscoAlerta[];
  status: 'rascunho' | 'aprovado' | 'descartado';
  dataCriacao: string;
  // Aspect ratio usado na geração dos frames desta pauta. Fixado no momento da criação —
  // não deve ser substituído pelo seletor global de aspect ratio da UI, que muda livremente
  // entre gerações e não reflete o formato já "assado" nas imagens já geradas desta pauta.
  aspectRatio?: string;
  // URLs públicas dos frames gerados automaticamente pelo Agente de GIF (modo 'C'), já
  // prontas pra exibição — não dependem do usuário clicar em "gerar imagem".
  frameUrls?: Record<string, string>;
}

export interface TesteAbProposta {
  id: string;
  marca: Brand;
  pautaId: string;
  conteudoVarianteB: {
    id: string | null;
    nomeDesign: string | null;
    storageUrl: string | null;
    insiderOriginalUrl: string | null;
  } | null;
  racional: string;
  status: 'pendente' | 'aceito' | 'rejeitado';
  createdAt: string;
  // Passo 3 — envios pra Insider (só possível depois de status === 'aceito'). A mesma
  // comparação pode ser enviada pra várias contas Insider (uma linha por marca de destino) —
  // o conteúdo do agente é genérico, não amarrado a uma marca específica.
  envios: TesteAbEnvioInsider[];
  // Campos legados (1º envio, antes de existir a tabela teste_ab_envios) — mantidos só
  // pra não quebrar leituras antigas; usar `envios` daqui pra frente.
  insiderCampaignId?: string | null;
  enviadoInsiderEm?: string | null;
  insiderDestinoMarca?: ContaInsider | null;
}

export interface TesteAbEnvioInsider {
  marca: ContaInsider;
  insiderCampaignId: string;
  varianteAGifUrl?: string | null;
  enviadoEm: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo de produtos (Yampi → Supabase)
//
// Sincronizado diariamente pela Edge Function `sync-catalogo-yampi`. A UI de
// geração de ofertas escolhe dessa lista em vez de o Gemini inventar um produto
// — mesmo motivo do BigQuery no calendário: número real ou tela vazia, sem
// meio-termo fabricado.
//
// `MarcaCatalogo` é PROPOSITALMENTE mais amplo que `Brand`: playbook de conteúdo
// só existe pra Ápice/Barbours, mas o catálogo cobre as 5 lojas Yampi do grupo.
// Um seletor de produto (futuro) pode mostrar Lescent/Kokeshi/Rituária mesmo sem
// haver Modo A/B de pauta pra elas — a integração serve outros fluxos também.
// ─────────────────────────────────────────────────────────────────────────────

export type MarcaCatalogo = 'Apice' | 'Barbours' | 'Lescent' | 'Kokeshi' | 'Rituaria';

export interface ImagemProduto {
  url: string;
  thumbnailUrl: string | null;
  ordem: number;
  principal: boolean;
}

export interface CategoriaProduto {
  id: number;
  nome: string;
}

export interface ProdutoCatalogo {
  id: string;
  marca: MarcaCatalogo;
  yampiProductId: number;
  yampiAlias: string;
  sku: string | null;
  nome: string;
  descricao: string | null;
  descricaoCurta: string | null;
  precoDe: number | null;
  precoPor: number | null;
  emPromocao: boolean;
  categorias: CategoriaProduto[];
  imagens: ImagemProduto[];
  imagemPrincipal: string | null;
  urlProduto: string | null;
  estoque: number | null;
  disponivel: boolean;
  sincronizadoEm: string;
}

export interface CatalogoSyncRun {
  id: string;
  marca: string;
  iniciadoEm: string;
  terminadoEm: string | null;
  status: 'em_execucao' | 'sucesso' | 'falha';
  produtosProcessados: number;
  produtosNovos: number;
  produtosAtualizados: number;
  produtosDesativados: number;
  erro: string | null;
  duracaoMs: number | null;
}
