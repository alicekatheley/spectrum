-- =============================================================================
-- Lescent — classificador de oferta corrigido (`crm_modelo.marca_config.oferta_case`)
-- =============================================================================
--
-- NÃO APLIQUE ESTE ARQUIVO SEM LER A SEÇÃO "DECISÕES EM ABERTO" NO FIM.
-- Ele mexe no insumo do modelo inteiro: `oferta_case` é o que transforma o nome da
-- campanha em OFERTA, e `marca_oferta_familia` transforma OFERTA em FAMÍLIA, que é a
-- unidade de fadiga do calendário. Errar aqui não dá erro — dá número plausível.
--
-- Escrito contra os dados reais de `gogroup-crm.crm_lescent.crm_campanhas_insider`
-- (2.257 disparos, 2025-07 a 2026-08). Todos os números nos comentários foram medidos,
-- não estimados.
--
--
-- 1. O QUE ESTÁ QUEBRADO HOJE
-- -----------------------------------------------------------------------------
--
-- 1.1. O CASE atual casa substring no nome inteiro, e o nome começa com a data.
--      `c LIKE '%20%'` casa 2.255 dos 2.257 disparos, porque toda campanha começa com
--      `2025...` ou `2026...`. Qualquer regra de desconto escrita como `LIKE '%NN%'`
--      é lixo. Por isso aqui todo número é ancorado com `(^|_)` — o prefixo de data
--      não tem underscore interno, então `(^|_)15poff` só casa em início de token.
--
-- 1.2. A mesma oferta cai em duas famílias dependendo de o operador ter digitado a
--      palavra "cupom". No CASE atual:
--          WHEN c LIKE '%cupom%' AND (... '%10ou20%') THEN 'Cupom a Escolha'
--          WHEN c LIKE '%10ou20%' ...                 THEN 'Cupom Escalonado (10-20%)'
--      `20260112_cupomescolha_10ou20` → 'Cupom a Escolha'
--      `20251208_10ou20off`          → 'Cupom Escalonado'
--      É o mesmo cupom. A família se parte por artefato de nomenclatura.
--
-- 1.3. Existem famílias para 15% e 18% e nenhuma para 10%, 12%, 20% e 25%.
--      Historicamente isso jogou ~10M de envios em 'OUTROS' → família 'Sem Oferta'.
--
-- 1.4. `cupomescolha_25ou100` estava dentro de 'Cupom a Escolha'. Confirmado por você:
--      25 e 100 são TAMANHOS (25ml e 100ml), não valores de desconto — o cupom em si
--      costuma ser em R$. É outra oferta: a escolha é de tamanho, não de profundidade.
--      Vale para `25mlou100ml` / `100mlou25ml`, que hoje nem classificados são.
--
--
-- 2. O QUE ESTE ARQUIVO **NÃO** RESOLVE — e é o problema maior
-- -----------------------------------------------------------------------------
--
-- "Expresso" não é uma oferta. É a pilha de automação, e ela está misturada com
-- campanha na mesma tabela. Padrões medidos dentro de 'Expresso (generico)':
--
--      expresso_yampi, expresso_omnisend, expresso_insider, expresso_sms, expresso_wpp,
--      expresso_flow19h, expresso_cart2x3d, expresso_viuproduto3x7d, expresso_checkout7d,
--      expresso_purchaseprioritario_click7d, expresso_repurchaseterciario_semclick30d
--
-- São carrinho abandonado / browse abandonment / recompra, em vários canais. Público
-- médio de 100 a 3.800, RPM de 1.200 a 16.000. Ao lado deles, no MESMO rótulo, estão
-- `expresso_geral_9h` (83.749 de público médio, RPM 162) e os blasts `expresso18poff`
-- (RPM ~120). A família 'Expresso' hoje tem RPM 366 — número que não descreve nada,
-- é a média de duas populações que não se parecem.
--
-- Na janela que o modelo consome (>= 2026-04-09), medido:
--
--      tipo              disparos    envios   % envios    receita   % receita     RPM
--      ----------------  --------  ---------  --------  ---------  ---------  ------
--      campanha               807  34.584.872    96,9%  4.794.678      81,9%  138,64
--      automação/fluxo        362   1.097.375     3,1%  1.059.568      18,1%  965,55
--
-- 3% do volume carregando 18% da receita a 7x o RPM. Se `fato_slot` inclui automação,
-- toda família com contrapartida automatizada (Expresso na frente, mas também
-- Necessaire e 18poff, que aparecem em `_recompra` / `_compra_prioritaria`) tem
-- baseline inflado — e o calendário vai recomendar essas famílias por um motivo que
-- não tem nada a ver com calendário. Os coeficientes I2/I4 do Lescent são estimados
-- em cima disso.
--
-- O separador certo NÃO é o nome da oferta, é campanha vs automação. Este arquivo
-- marca 'FLUXO' só no caso estreito e inequívoco (`15_menos4`, `15_recompra`), porque
-- o resto exige uma decisão sua sobre o que o modelo deve enxergar. Ver seção 6.
--
--
-- 3. CONVENÇÃO DE NOME
-- -----------------------------------------------------------------------------
--      AAAAMMDD_oferta_segmento_hora     ex.: 20260805_cupomescolha_10ou20_geral_8h
--
-- A oferta ocupa os tokens 1..k. Tokens de segmento observados que NÃO podem ser
-- lidos como oferta: geral, desengajados*, open\d+x\d+d, clientes?\d+d, engajamento\d+d,
-- inscritos\d+d, leads, mulheres, homens, checkout, cart, viuproduto, viupag, clicou\d,
-- extra, noite, uh, prioritari[oa], alto/alta/altissimo, frio/fria, acima\d+, apartir\d+.
-- Nenhum deles contém `off`/`pff`, e é por isso que exigir o marcador de desconto
-- colado ao número (e não o número solto) basta para não pescar segmento.
--
-- CUIDADO: `bestsellers` aparece nas DUAS posições. Em `15poff_bestsellers_geral_19h`
-- é ângulo de produto sobre um desconto; em `bestsellers_engajamento_18h` é a oferta.
-- Por isso a regra de Curadoria vem DEPOIS das regras de desconto, nunca antes.
--
--
-- 4. O CLASSIFICADOR
-- -----------------------------------------------------------------------------
-- Primeiro WHEN que casa vence. A ordem abaixo é deliberada; não reordene sem rodar a
-- query de verificação da seção 7.

/*
UPDATE `gogroup-crm.crm_modelo.marca_config`
SET oferta_case = r"""
CASE
  -- --- Ruído: não é oferta, não deve entrar em baseline de família. --------------
  WHEN c LIKE '%[insider one]%'
    OR REGEXP_CONTAINS(c, r'(^|_)(pesquisa|desculpas|convocacao|captacao|captação|acessoantecipado|grupo)(_|$)')
    THEN 'NAO_OFERTA'

  -- --- Gatilho de ciclo de vida (público < 8k, cadência diária). Ver seção 6.1. --
  WHEN REGEXP_CONTAINS(c, r'(^|_)15_(menos\d|compra|recompra)') THEN 'FLUXO'

  -- --- Teste A/B: dois conceitos no mesmo disparo, não dá para atribuir família. -
  -- `cupomescolha_15vs12` NÃO entra aqui de propósito: os dois lados são números
  -- soltos sob prefixo de cupom, é a mesma escolha 12/15 escrita com "vs".
  WHEN REGEXP_CONTAINS(c, r'ou\d+vs|(necessaire|expresso|desconto)vs|vs(necessaire|expresso|desconto)|poffvs|roffvs|vs\d+(p|r)off|(^|_)(a&b|aeb|ab|testeab)(_|$)')
    THEN 'TESTE_AB'

  -- --- Linha Necessaire (do mais específico para o mais genérico). ---------------
  WHEN c LIKE '%necessaire%' AND c LIKE '%portaperfume%' THEN 'Necessaire Porta-Perfume'
  WHEN c LIKE '%necessaire%' AND c LIKE '%silhueta%'     THEN 'Necessaire Silhueta'
  WHEN c LIKE '%necessaire%' AND c LIKE '%preta%'        THEN 'Necessaire Preta'
  WHEN c LIKE '%necessaire%' AND c LIKE '%bege%'         THEN 'Necessaire Bege'
  WHEN c LIKE '%necessaire%' AND c LIKE '%premium%'      THEN 'Necessaire Premium'
  WHEN c LIKE '%necessaire%' AND c LIKE '%amostra%'      THEN 'Necessaire + Amostra'
  WHEN c LIKE '%necessaire%' AND c LIKE '%surpresa%'     THEN 'Necessaire Surpresa'
  WHEN c LIKE '%necessaire%' AND (c LIKE '%brinde%' OR c LIKE '%kit%') THEN 'Necessaire Brinde (Kit)'
  WHEN c LIKE '%necessaire%' AND c LIKE '%cupom%'        THEN 'Necessaire + Cupom'
  WHEN c LIKE '%necessaire%' AND c LIKE '%escolha%'      THEN 'Necessaire a Escolha'
  WHEN c LIKE '%necessaire%'                             THEN 'Necessaire (generico)'

  -- --- Linha Expresso. 'Expresso (generico)' está contaminado por automação. -----
  WHEN c LIKE '%expresso%' AND c LIKE '%100ml%'          THEN 'Expresso 100ml'
  WHEN c LIKE '%expresso%' AND c LIKE '%25ml%'           THEN 'Expresso 25ml'
  WHEN c LIKE '%expresso%' AND REGEXP_CONTAINS(c, r'1?8\s*%?p?(off|ff|percentoff)|expresso18') THEN 'Expresso 18% OFF'
  WHEN c LIKE '%expresso%' AND REGEXP_CONTAINS(c, r'17\s*%?p?off')                THEN 'Expresso 17% OFF'
  WHEN c LIKE '%expresso%' AND REGEXP_CONTAINS(c, r'20\s*%?p?off')                THEN 'Expresso 20% OFF'
  WHEN c LIKE '%expresso%' AND REGEXP_CONTAINS(c, r'15\s*%?p?(off|ff)|expresso15') THEN 'Expresso 15% OFF'
  WHEN c LIKE '%expresso%'                               THEN 'Expresso (generico)'

  -- --- Escolha de TAMANHO. Antes das regras de cupom: `cupomescolha_25ou100`
  --     carrega as duas palavras e a escolha ali é de tamanho, não de desconto.
  WHEN REGEXP_CONTAINS(c, r'25\D{0,4}ou\D{0,2}100|100\D{0,4}ou\D{0,2}25')
    THEN 'Tamanho a Escolha (25/100ml)'

  -- --- Escolha de CUPOM, pelo par e não pela palavra "cupom" (corrige 1.2). -----
  --     `\D{0,4}` absorve as grafias observadas: 10ou20, 10offou20off, 10pou20p,
  --     10%offou20, r10our20, 20ou10off.
  WHEN REGEXP_CONTAINS(c, r'10\D{0,4}ou\D{0,2}20|20\D{0,4}ou\D{0,2}10|10our20') THEN 'Cupom a Escolha 10/20'
  WHEN REGEXP_CONTAINS(c, r'12\D{0,4}ou\D{0,2}15|15\D{0,4}ou\D{0,2}12|15vs12|12vs15') THEN 'Cupom a Escolha 12/15'
  WHEN REGEXP_CONTAINS(c, r'10\D{0,4}ou\D{0,2}15|15\D{0,4}ou\D{0,2}10') THEN 'Cupom a Escolha 10/15'
  WHEN c LIKE '%escalonado%'                            THEN 'Cupom a Escolha (generico)'
  WHEN c LIKE '%cupom%' AND c LIKE '%escolha%'          THEN 'Cupom a Escolha (generico)'

  WHEN c LIKE '%amostra%'                               THEN 'Amostras a Escolha'

  -- --- Cupom em R$. Antes do %: `15roff` também casaria a regra de 15%. ---------
  WHEN REGEXP_CONTAINS(c, r'(^|_)(r\$?s?)?10\s*roff|(^|_)r\$?s?10\s*%?p?off') THEN '10R OFF'
  WHEN REGEXP_CONTAINS(c, r'(^|_)(r\$?s?)?15\s*roff|(^|_)r\$?s?15\s*%?p?off') THEN '15R OFF'
  WHEN REGEXP_CONTAINS(c, r'(^|_)(r\$?s?)?18\s*roff|(^|_)r\$?s?18\s*%?p?off') THEN '18R OFF'
  WHEN REGEXP_CONTAINS(c, r'(^|_)(r\$?s?)?20\s*roff|(^|_)r\$?s?20\s*%?p?off') THEN '20R OFF'

  -- --- Desconto em %. `(off|ff)` cobre os typos reais 10pff / 12pff / 18pff. ----
  WHEN REGEXP_CONTAINS(c, r'(^|_)10\s*%?p?(off|ff)') THEN 'Desconto 10%'
  WHEN REGEXP_CONTAINS(c, r'(^|_)12\s*%?p?(off|ff)') THEN 'Desconto 12%'
  WHEN REGEXP_CONTAINS(c, r'(^|_)15\s*%?p?(off|ff)') THEN 'Desconto 15%'
  WHEN REGEXP_CONTAINS(c, r'(^|_)18\s*%?p?(off|ff)') THEN 'Desconto 18%'
  WHEN REGEXP_CONTAINS(c, r'(^|_)20\s*%?p?(off|ff)') THEN 'Desconto 20%'
  WHEN REGEXP_CONTAINS(c, r'(^|_)25\s*%?p?(off|ff)') THEN 'Desconto 25%'

  -- --- Ofertas sem desconto. DEPOIS do desconto, senão roubam `15poff_bestsellers`.
  WHEN REGEXP_CONTAINS(c, r'(^|_)(best|bestsellers|top\d|trioessencial)(_|$)') THEN 'Curadoria (Best Sellers)'
  WHEN c LIKE '%fretegratis%'                        THEN 'Frete Gratis'
  WHEN c LIKE '%creme%'                              THEN 'Creme'

  ELSE 'OUTROS'
END
"""
WHERE marca = 'lescent';
*/


-- 5. MAPA OFERTA → FAMÍLIA (`crm_modelo.marca_oferta_familia`)
-- -----------------------------------------------------------------------------
-- A família é a unidade de fadiga. As variantes de cupom viram ofertas SEPARADAS
-- (para você conseguir medir 10/20 contra 12/15) mas caem na MESMA família, porque
-- para efeito de cansaço do cliente é o mesmo estímulo. Isso é seguro: I4_oferta tem
-- coeficiente de transferência -0,436 no Lescent, então separar oferta não muda a
-- previsão de receita do plano — muda o que o operador consegue enxergar.
--
-- Volumes medidos (histórico completo) das ofertas novas ou remapeadas:
--      Cupom a Escolha 10/20            95 disparos   5.839.518 envios   RPM 141,66
--      Cupom a Escolha 12/15            59            3.191.640          RPM 117,47
--      Cupom a Escolha (generico)       42            2.990.749          RPM 145,98
--      Cupom a Escolha 10/15            21            1.171.671          RPM 117,03
--      Tamanho a Escolha (25/100ml)     18              948.668          RPM 164,47
--      Desconto 10%                     40            3.514.668          RPM 144,60
--      Desconto 12%                     99            6.714.368          RPM 153,59
--      Desconto 20%                     15            1.064.755          RPM 200,04
--      Desconto 25%                      1              140.608          RPM 145,69
--      Curadoria (Best Sellers)         15              640.429          RPM 216,65

/*
MERGE `gogroup-crm.crm_modelo.marca_oferta_familia` AS t
USING (
  SELECT * FROM UNNEST([
    STRUCT('lescent' AS marca, 'Cupom a Escolha 10/20'        AS oferta, 'Cupom/Desconto' AS familia, 2 AS agressividade),
           ('lescent', 'Cupom a Escolha 12/15',        'Cupom/Desconto', 2),
           ('lescent', 'Cupom a Escolha 10/15',        'Cupom/Desconto', 1),
           ('lescent', 'Cupom a Escolha (generico)',   'Cupom/Desconto', 1),
           ('lescent', 'Tamanho a Escolha (25/100ml)', 'Cupom/Desconto', 2),
           ('lescent', 'Desconto 10%',                 'Cupom/Desconto', 1),
           ('lescent', 'Desconto 12%',                 'Cupom/Desconto', 2),
           ('lescent', 'Desconto 20%',                 'Cupom/Desconto', 4),
           ('lescent', 'Desconto 25%',                 'Cupom/Desconto', 5),
           ('lescent', 'Curadoria (Best Sellers)',     'Curadoria',      1),
           ('lescent', 'Frete Gratis',                 'Frete',          2),
           ('lescent', 'Creme',                        'Produto',        1),
           ('lescent', 'Necessaire + Amostra',         'Necessaire',     2),
           ('lescent', 'Necessaire Silhueta',          'Necessaire',     2),
           ('lescent', 'Necessaire Preta',             'Necessaire',     2),
           ('lescent', 'Necessaire Premium',           'Necessaire',     3),
           ('lescent', 'Expresso 17% OFF',             'Expresso',       2),
           ('lescent', 'Expresso 20% OFF',             'Expresso',       4),
           -- Rótulos de exclusão: existem para o pipeline poder FILTRAR, não para
           -- entrar em baseline. Se 'Sem Oferta' hoje é consumida como família comum,
           -- isso precisa mudar junto — senão a exclusão não exclui nada.
           ('lescent', 'NAO_OFERTA',                   'Excluir',        1),
           ('lescent', 'FLUXO',                        'Excluir',        1),
           ('lescent', 'TESTE_AB',                     'Excluir',        1)
  ])
) AS s
ON t.marca = s.marca AND t.oferta = s.oferta
WHEN MATCHED THEN UPDATE SET familia = s.familia, agressividade = s.agressividade, atualizado_em = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT (marca, oferta, familia, agressividade, atualizado_em)
  VALUES (s.marca, s.oferta, s.familia, s.agressividade, CURRENT_TIMESTAMP());

-- 'Cupom Escalonado (10-20%)' deixa de ser produzida pelo CASE (virou 10/20 ou
-- genérico). Não apague a linha: histórico já materializado em fato_slot referencia
-- ela. Deixe apontando para a mesma família.
*/


-- 6. DECISÕES EM ABERTO — precisam de você, não dos dados
-- -----------------------------------------------------------------------------
--
-- 6.1. AUTOMAÇÃO DENTRO DO MODELO (seção 2). É a mais importante. Opções:
--      (a) excluir automação de `fato_slot` — calendário passa a descrever só o que
--          o calendário controla; famílias perdem 18% da receita do baseline;
--      (b) manter e adicionar um eixo `tipo_envio`, com índices separados;
--      (c) manter como está — e aceitar que o RPM da família Expresso é uma média
--          de duas populações diferentes.
--      Eu não escolho isso sozinho. Se for (a) ou (b), a regra de detecção precisa
--      cobrir os canais (`yampi`, `omnisend`, `insider`, `sms`, `wpp`, `flow`) e os
--      gatilhos (`cart`, `viuproduto`, `viupag`, `checkout\d+d`, `purchase*`,
--      `repurchase*`), não só o `15_menos4` que marquei aqui.
--
-- 6.2. 'Tamanho a Escolha (25/100ml)' → família 'Cupom/Desconto'. Coloquei ali porque
--      você disse "é cupom em 25ml ou 100ml, geralmente em R$". Se para o cliente o
--      estímulo é "escolher tamanho" e não "ganhar desconto", ela pertence a uma
--      família própria e não deve dividir fadiga com os cupons.
--
-- 6.3. 10/20, 12/15 e 10/15 como ofertas distintas na MESMA família. Se você quiser
--      que profundidades diferentes cansem o cliente de formas diferentes, elas
--      precisam de famílias diferentes — e aí o custo aparece no plano.
--
-- 6.4. `agressividade` das ofertas novas é minha leitura pela profundidade do
--      desconto. Não é medida. Confira antes de aplicar.
--
-- 6.5. 'Desconto 25%' tem 1 disparo. Manter como oferta própria ou dobrar em 20%?
--
--
-- 7. VERIFICAÇÃO — rode ANTES do UPDATE e compare com DEPOIS
-- -----------------------------------------------------------------------------
-- Nenhuma linha deve sair de 'OUTROS' para uma família que já tinha baseline sólido
-- sem você entender por quê. O que esta query responde: de onde veio cada linha.

/*
WITH base AS (
  SELECT LOWER(campaign_name) AS c, sent, revenue
  FROM `gogroup-crm.crm_lescent.crm_campanhas_insider`
  WHERE campaign_name IS NOT NULL
)
SELECT
  <CASE_ATUAL> AS antes,
  <CASE_NOVO>  AS depois,
  COUNT(*) AS disparos,
  SUM(sent) AS envios,
  ROUND(SAFE_DIVIDE(SUM(revenue), SUM(sent)) * 1000, 2) AS rpm
FROM base
GROUP BY antes, depois
HAVING antes <> depois
ORDER BY envios DESC;
*/

-- Resultado esperado da migração no histórico completo (2.257 disparos):
--   'OUTROS' cai de 353 disparos / 24.370.412 envios para 55 / 4.639.581.
--   Na janela que o modelo consome (>= 2026-04-09) 'OUTROS' já era só 1,6% dos
--   envios — o buraco de 32% é histórico, de antes da convenção de nome estabilizar.
--   Ou seja: isto conserta a leitura do passado, não a do que o modelo vê hoje.
--   O que conserta o presente é a decisão 6.1.
--
--   Dos 55 restantes, 52 são de 2025 (`cupombrinde`, `brindedesconto`,
--   `desconto_progressivo`, `100ml_por_79`, `n13_por_99`...). Na janela viva sobram 3:
--
--      20260416_100ml_mulheres_lead_17h        21.011   oferta de tamanho sem desconto
--      2026028_100ml                           17.779   data com 7 dígitos, não 8
--      20260229_25mlpor29_clientes7d            2.785   29/02/2026 não existe
--
--   Os dois últimos não são falha do classificador, são nome de campanha malformado —
--   qualquer regra que dependa da data (inclusive `dataMinEvento`) os perde em
--   silêncio. Vale corrigir na origem. O primeiro é decisão: '100ml' sozinho é
--   'Tamanho 100ml' (oferta de produto) ou fica em OUTROS mesmo?
