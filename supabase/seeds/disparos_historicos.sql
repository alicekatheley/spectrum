INSERT INTO disparos_historicos (id, marca, mecanica, disparos, receita_media, performance, contextos_recomendados) VALUES
  ('EMA-101', 'Apice',    'Abra o presente',  1, 8767,  'excelente',    ARRAY['lancamento','sazonal']),
  ('EMA-102', 'Apice',    'Abra a caixa',     3, 6312,  'hit',          ARRAY['recompra']),
  ('EMA-103', 'Apice',    'Abra a carta',     3, 4711,  'medio',        ARRAY['reativacao']),
  ('EMA-104', 'Apice',    'Puxe o Adesivo',   6, 6348,  'hit',          ARRAY['queima_estoque','datas_comemorativas']),
  ('EMA-105', 'Apice',    'Corte o fio',      5, 6048,  'hit',          ARRAY['lancamento']),
  ('EMA-106', 'Apice',    'Jogo da Velha',    3, 6880,  'hit',          ARRAY['datas_comemorativas','sazonal']),
  ('EMA-107', 'Apice',    'Rasgue o papel',   3, 5508,  'medio',        ARRAY['recompra']),
  ('EMA-108', 'Apice',    'Puxe o post-it',   3, 4658,  'medio',        ARRAY['reativacao']),
  ('EMA-109', 'Apice',    'Estoure o balão',  2, 3854,  'fraco',        ARRAY['queima_estoque']),
  ('EMA-110', 'Apice',    'Puxe o cupom',     1, 2415,  'aposentar',    ARRAY['sazonal']),
  ('EMA-201', 'Barbours', 'Abra o presente',  8, 13295, 'dominante',    ARRAY['lancamento','datas_comemorativas']),
  ('EMA-204', 'Barbours', 'Abra a caixa',     6, 12691, 'dominante',    ARRAY['recompra','sazonal']),
  ('EMA-205', 'Barbours', 'Abra a carta',     1, 9658,  'medio',        ARRAY['reativacao']),
  ('EMA-206', 'Barbours', 'Corte o fio',      2, 11346, 'hit',          ARRAY['lancamento','reativacao']),
  ('EMA-207', 'Barbours', 'Rasgue o papel',   1, 6321,  'incompativel', ARRAY['queima_estoque']),
  ('EMA-208', 'Barbours', 'Estoure o balão',  1, 19220, 'outlier',      ARRAY['datas_comemorativas']),
  ('EMA-209', 'Barbours', 'Puxe o cupom',     2, 12600, 'hit',          ARRAY['sazonal'])
ON CONFLICT (id) DO NOTHING;
