import dotenv from "dotenv";
dotenv.config();

export const hardcodedDisparos = [
  // Apice (Foco em cabelo feminino, tom acolhedor, primeira pessoa)
  { id: "EMA-101", marca: "Apice", mecanica: "Abra o presente", disparos: 1, receitaMedia: 8767, performance: "excelente", contextosRecomendados: ["lancamento", "sazonal"] },
  { id: "EMA-102", marca: "Apice", mecanica: "Abra a caixa", disparos: 3, receitaMedia: 6312, performance: "hit", contextosRecomendados: ["recompra"] },
  { id: "EMA-103", marca: "Apice", mecanica: "Abra a carta", disparos: 3, receitaMedia: 4711, performance: "medio", contextosRecomendados: ["reativacao"] },
  { id: "EMA-104", marca: "Apice", mecanica: "Puxe o Adesivo", disparos: 6, receitaMedia: 6348, performance: "hit", contextosRecomendados: ["queima_estoque", "datas_comemorativas"] },
  { id: "EMA-105", marca: "Apice", mecanica: "Corte o fio", disparos: 5, receitaMedia: 6048, performance: "hit", contextosRecomendados: ["lancamento"] },
  { id: "EMA-106", marca: "Apice", mecanica: "Jogo da Velha", disparos: 3, receitaMedia: 6880, performance: "hit", contextosRecomendados: ["datas_comemorativas", "sazonal"] },
  { id: "EMA-107", marca: "Apice", mecanica: "Rasgue o papel", disparos: 3, receitaMedia: 5508, performance: "medio", contextosRecomendados: ["recompra"] },
  { id: "EMA-108", marca: "Apice", mecanica: "Puxe o post-it", disparos: 3, receitaMedia: 4658, performance: "medio", contextosRecomendados: ["reativacao"] },
  { id: "EMA-109", marca: "Apice", mecanica: "Estoure o balão", disparos: 2, receitaMedia: 3854, performance: "fraco", contextosRecomendados: ["queima_estoque"] },
  { id: "EMA-110", marca: "Apice", mecanica: "Puxe o cupom", disparos: 1, receitaMedia: 2415, performance: "aposentar", contextosRecomendados: ["sazonal"] },

  // Barbours (Luxo acessível, tom direto e sofisticado, push-notification)
  { id: "EMA-201", marca: "Barbours", mecanica: "Abra o presente", disparos: 8, receitaMedia: 13295, performance: "dominante", contextosRecomendados: ["lancamento", "datas_comemorativas"] },
  { id: "EMA-204", marca: "Barbours", mecanica: "Abra a caixa", disparos: 6, receitaMedia: 12691, performance: "dominante", contextosRecomendados: ["recompra", "sazonal"] },
  { id: "EMA-205", marca: "Barbours", mecanica: "Abra a carta", disparos: 1, receitaMedia: 9658, performance: "medio", contextosRecomendados: ["reativacao"] },
  { id: "EMA-206", marca: "Barbours", mecanica: "Corte o fio", disparos: 2, receitaMedia: 11346, performance: "hit", contextosRecomendados: ["lancamento", "reativacao"] },
  { id: "EMA-207", marca: "Barbours", mecanica: "Rasgue o papel", disparos: 1, receitaMedia: 6321, performance: "incompativel", contextosRecomendados: ["queima_estoque"] },
  { id: "EMA-208", marca: "Barbours", mecanica: "Estoure o balão", disparos: 1, receitaMedia: 19220, performance: "outlier", contextosRecomendados: ["datas_comemorativas"] },
  { id: "EMA-209", marca: "Barbours", mecanica: "Puxe o cupom", disparos: 2, receitaMedia: 12600, performance: "hit", contextosRecomendados: ["sazonal"] },
];

export const DEFAULT_MECANICAS = [
  'Abra o presente', 'Abra a caixa', 'Abra a carta',
  'Puxe o Adesivo', 'Corte o fio', 'Jogo da Velha',
  'Rasgue o papel', 'Puxe o post-it', 'Estoure o balão', 'Puxe o cupom',
];

export const BRAND_DNA_FALLBACK: Record<string, {
  primaryColors: string;
  backgrounds: string;
  style: string;
  hitFormula: string;
  prohibitedColors: string;
}> = {
  Apice: {
    primaryColors: 'Forest Green #688D65 (dominant), Magenta #D553A5 (promo accent), Aqua #AAD4C7 (freshness), Leaf Green #A4CA7A (natural), Terracotta #B46D55 (warmth), Off-White #F4F1E5 (backgrounds)',
    backgrounds: 'Clean off-white #F4F1E5 or soft aqua tint — always calm, airy, warm.',
    style: 'Clean 2D organic or soft 3D digital illustration, warm feminine mood, natural soft lighting, premium editorial quality',
    hitFormula: 'ONE large central mechanic object (post-it, scissors, tic-tac-toe, gift box) filling 50–70% of frame on clean off-white bg. Optional feminine hand as interaction cue. One object = one emotion.',
    prohibitedColors: 'Avoid harsh neons and cold blues. Keep palette warm and organic.',
  },
  Barbours: {
    primaryColors: 'Ruby Red #BF0F26 (dominant — 60–70%), Gold #AA834B (luxury accents), Merlot #4F080E (depth), Pink Blush #FFCCD5 (high-converting background), Off-White #E7E3D8 (neutral)',
    backgrounds: 'Pastel pink #FFCCD5 (highest-converting), OR Off-White #E7E3D8, OR deep Merlot #4F080E for theatrical. Always ONE solid color.',
    style: 'Premium 3D illustrated luxury editorial style, dramatic studio lighting, sophisticated modern feminine, bold high-contrast',
    hitFormula: 'Dominant 3D central object in Ruby Red on pastel pink bg. Human hand creates interaction/anticipation. One large hero element.',
    prohibitedColors: 'NEVER use green, orange, yellow or cold blue — explicitly prohibited by brand guidelines.',
  },
};

export const VALID_IMAGE_MODELS = new Set([
  'wavespeed-gpt-image-2-t2i',
  'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview',
  'gemini-2.5-flash-image',
  'wavespeed-seedream-v5-lite',
]);
export const DEFAULT_IMAGE_MODEL = 'wavespeed-gpt-image-2-t2i';

export const VALID_IMAGE_RATIOS = ['1:1', '3:4', '16:9', '9:16', '4:3'];

export const COMPOSITION_VARIANTS = [
  'Composition: centered hero object, slight 3/4 angle view, premium product placement.',
  'Composition: front-facing symmetrical layout, generous negative space top and bottom.',
  'Composition: dynamic diagonal tilt, object angled 15–20 degrees, energetic feel.',
  'Composition: top-down overhead view, clean flat-lay arrangement, editorial style.',
  'Composition: slight low-angle upward view, object feels grand and imposing.',
];

export const LIGHTING_VARIANTS = [
  'Lighting: soft diffused studio light from above, gentle cast shadows below the object.',
  'Lighting: warm golden ambient glow, subtle rim light outlining the object edges.',
  'Lighting: clean cool white studio light, minimal shadows, crisp and modern.',
  'Lighting: dramatic single-source spotlight from upper-left, bold shadow play.',
  'Lighting: soft gradient ambient fill, delicate depth without harsh shadows.',
];

export const PIAPP_API_KEY = process.env.PIAPP_API_KEY;
export const PIAPP_MCP_URL = 'https://piapp-v2.vercel.app/api/ai/mcp';
