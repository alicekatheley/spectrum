export type Brand = 'Apice' | 'Barbours';

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
  modo: 'A' | 'B';
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
}
