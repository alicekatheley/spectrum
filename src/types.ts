export type Brand = 'Apice' | 'Barbours';

// Contas da Insider com acesso configurado (Passo 3 do Modo C) — mais amplo que Brand porque
// o conteúdo do agente não é amarrado a marca; qualquer pauta pode ir pra qualquer conta aqui.
export type ContaInsider = 'Apice' | 'Barbours' | 'Rituaria' | 'Lescent' | 'Kokeshi' | 'Gocase';

// Marcas atendidas pela aba de Geração de Calendários — conjunto mais amplo que `Brand`,
// que segue restrito às duas marcas com playbook de conteúdo.
export type MarcaCalendario = 'Apice' | 'Barbours' | 'Rituaria' | 'Gocase' | 'Kokeshi' | 'Lescent';

export type RecomendacaoVolume = 'aumentar' | 'manter' | 'reduzir';

export type DiaSemana = 'DOM' | 'SEG' | 'TER' | 'QUA' | 'QUI' | 'SEX' | 'SAB';

export interface CalendarioOferta {
  nome: string;
  receitaPorMil: number;
}

export interface CalendarioCelula {
  data: string; // YYYY-MM-DD
  diaSemana: DiaSemana;
  // C1 = disparo principal do dia; C2 = disparo complementar (reforço da mesma oferta
  // ou uma oferta nova), ausente quando o dia tem só um envio.
  c1: CalendarioOferta;
  c2: (CalendarioOferta & { tipo: 'novo' | 'reforco' }) | null;
  recomendacao: RecomendacaoVolume;
}

export interface CalendarioSemana {
  label: string; // 'S1', 'S2', ...
  celulas: CalendarioCelula[];
}

export interface CalendarioGerado {
  id: string;
  marca: MarcaCalendario;
  dataInicio: string;
  dataFim: string;
  semanas: CalendarioSemana[];
  criadoEm: string;
}

export interface InputCalendario {
  marca: MarcaCalendario;
  dataInicio: string;
  dataFim: string;
  eventosEspeciais: string;
  volumeMensagens: string;
  diretrizes: string;
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
