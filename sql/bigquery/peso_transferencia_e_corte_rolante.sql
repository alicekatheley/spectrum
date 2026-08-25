-- =============================================================================
-- crm_modelo :: peso de transferência encolhido + corte walk-forward rolante
-- =============================================================================
--
-- Este arquivo é a fonte versionada do que está no BigQuery. Se divergir, o
-- BigQuery está errado.
--
--
-- 1. O QUE ESTAVA ERRADO
-- -----------------------------------------------------------------------------
--
-- O walk-forward mede `coef_transferencia` (b) rodando uma Poisson GLM com
-- offset log(enviados) nos dados DEPOIS do corte, contra o índice construído
-- ANTES dele:
--
--     ln(taxa_teste(k)) = intercepto + b · ln(idx_treino(k))
--
-- ou seja, a relação que o teste realmente afirma é
--
--     taxa_teste(k) / base  =  idx_treino(k) ^ b
--
-- `b` NÃO é uma nota de aprovação — é o EXPOENTE que converte o índice medido
-- no passado no índice válido no futuro. b=1 mantém a vantagem inteira; b=0,5
-- comprime pela raiz (ordem preservada, amplitude na metade); b=0 achata para 1.
--
-- O código anterior jogava esse número fora: convertia b em quatro rótulos de
-- texto (`veredito`) e o consumidor não olhava nem para os rótulos. Na prática
-- o gerador aplicava o I1 CRU (expoente 1) para as cinco marcas e ignorava
-- I2/I3/I4 por completo. Medição de I1 em 25/08/2026, já com o corte rolante:
--
--     kokeshi   b=-0,26  se=1,23  -> peso 0,00
--     rituaria  b=-0,02  se=0,31  -> peso 0,00
--     barbours  b= 0,85  se=0,74  -> peso 0,21
--     apice     b= 0,73  se=0,45  -> peso 0,45
--     lescent   b= 1,72  se=0,58  -> peso 1,50 (no teto)
--
-- Em kokeshi e rituaria o coeficiente é NEGATIVO: o dia "bom" do treino não foi
-- melhor no teste, e o gerador estava concentrando envio nele a 100% assim mesmo.
--
-- O erro tem as duas direções, e nenhuma delas dá erro visível:
--   - super-aplica onde o sinal não se sustenta (kokeshi, rituaria, barbours)
--   - sub-aplica onde ele é mais forte do que o índice cru sugere (lescent I1
--     tem b=1,72: o índice cru SUB-estima a quarta-feira)
--
--
-- 2. O PESO
-- -----------------------------------------------------------------------------
--
-- Encolhimento empírico-Bayes ("positive-part James-Stein") sobre b:
--
--     tau²  = max(0, b² − se²)          -- variância do sinal, descontado o ruído
--     peso  = b · tau² / (tau² + se²)
--
-- Coeficiente preciso encolhe pouco; coeficiente incerto colapsa para 0 sozinho.
-- Isso DISPENSA a tabela de limiares: não existe mais fronteira arbitrária em
-- 0,15 ou 0,5 onde um índice muda de comportamento de um dia para o outro. A
-- incerteza regula a força de forma contínua, que é o que ela deveria fazer.
--
-- Duas travas deliberadas:
--
--   piso em 0. Dois índices têm b negativo (kokeshi I4 −0,46; lescent I4 −0,30).
--   A conta manda INVERTER o índice. Não fazemos isso: a taxa histórica de uma
--   oferta reflete PARA QUEM ela foi mandada, não a força intrínseca dela —
--   escolha de oferta é endógena. b<0 é quase certamente artefato de seleção
--   (reversão à média + público que muda), e apostar na inversão é apostar no
--   artefato. Neutralizar (peso 0, POW(x,0)=1) é o meio-termo honesto.
--
--   teto em 1,5. b>1 é legítimo e acontece, mas extrapolar um expoente alto
--   amplifica cauda: um índice de 2,0 com expoente 2,5 vira 5,7. O teto é grade
--   de proteção contra estimativa selvagem, não julgamento sobre o sinal.
--
--   HOJE O TETO ESTÁ ATIVO em exatamente um caso: lescent I1, peso não-truncado
--   1,53 -> 1,50. Uma marca no teto é aceitável. Se virarem duas ou mais, a
--   correção certa é pooling parcial de b entre as marcas (encolher para a média
--   do grupo em vez de para 0), não subir o teto.
--
-- `valor_efetivo = POW(valor, peso)` fica gravado JUNTO do `valor` cru. O cru
-- permanece para diagnóstico; o efetivo é o que se usa. Calcular aqui e não no
-- consumidor é decisão de arquitetura, não preguiça: este repositório tem DOIS
-- servidores (Express em dev, worker.ts em produção) e toda lógica duplicada
-- entre eles já divergiu uma vez em silêncio. Em SQL existe uma implementação só.
--
-- A invariante do sum coding sobrevive, e isso é verificável:
--     AVG(LN(valor^b)) = b · AVG(LN(valor)) = b · 0 = 0  →  EXP(0) = 1
-- Ou seja EXP(AVG(LN(valor_efetivo))) continua 1 por (marca, índice).
--
-- I6_alpha fica de fora: alpha é o expoente de saturação de volume, um escalar,
-- não um índice sum-coded. O `coef_transferencia` da linha dele mede outra coisa
-- (se o alpha se sustenta), e elevar alpha a esse número não tem significado.
-- peso NULL, valor_efetivo = valor.
--
--
-- 3. O CORTE ROLANTE
-- -----------------------------------------------------------------------------
--
-- `p_corte` era a data fixa 2026-07-01, escrita à mão. Com data fixa só o lado
-- do TESTE cresce: o treino congela em abril-junho para sempre e a janela de
-- teste se estica indefinidamente. Em 25/08 já estava 83 dias de treino contra
-- 55 de teste; em três meses seria 83 contra 145 — um índice de abril validado
-- contra um futuro cada vez mais longo.
--
-- Agora `p_corte NULL` significa "um mês antes da data em que este batch roda".
-- O default mora DENTRO da procedure de propósito: quem chamar sem pensar acerta,
-- e quem quiser reproduzir um snapshot antigo ainda pode passar a data explícita.
--
-- CONSEQUÊNCIA QUE PRECISA SER DITA: a janela de teste encurta de ~55 para ~27
-- dias, então `se` cresce e os pesos caem um pouco em quase todo lugar. Isso não
-- é regressão, é a incerteza aparecendo onde ela sempre esteve. E só é seguro
-- PORQUE o peso agora é contínuo: com o veredito categórico, uma janela mais
-- curta faria os rótulos oscilarem de um dia para o outro e o comportamento do
-- gerador pularia junto. Trocar o corte sem trocar o peso deixaria o sistema
-- pior — as duas mudanças vêm no mesmo commit por isso.
--
-- Fica um acoplamento conhecido: o corte é ancorado em HOJE, não no período que
-- o usuário pede no calendário. Os dois coincidem no caso normal (planejar o mês
-- que vem, hoje). Não coincidem se alguém pedir um período distante, e nesse
-- caso o índice foi validado contra outra janela. Ancorar no período pedido
-- exigiria rodar sp_deriva_indices por request (~3 min/marca) e travaria a aba;
-- por isso o snapshot grava `corte_walkforward` e os servidores passam a expor
-- esse campo, para a tela poder avisar em vez de mentir.
--
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 4. COLUNAS NOVAS
-- -----------------------------------------------------------------------------
ALTER TABLE `gogroup-crm.crm_modelo.snapshot_indices`
  ADD COLUMN IF NOT EXISTS transf_se FLOAT64
    OPTIONS(description='Erro padrao de coef_transferencia. Base do encolhimento.'),
  ADD COLUMN IF NOT EXISTS peso_transferencia FLOAT64
    OPTIONS(description='Expoente encolhido (empirico-Bayes) aplicado a valor. 0=indice neutralizado, 1=usado como medido. NULL em I6_alpha, que nao e sum-coded.'),
  ADD COLUMN IF NOT EXISTS valor_efetivo FLOAT64
    OPTIONS(description='POW(valor, peso_transferencia) — o numero que o gerador deve usar. valor permanece cru para diagnostico.');


-- -----------------------------------------------------------------------------
-- 5. A PROCEDURE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE `gogroup-crm.crm_modelo.sp_deriva_indices`(
  p_marca STRING, p_corte DATE, p_maturacao INT64, p_min_enviados INT64)
BEGIN
  DECLARE v_min INT64;
  DECLARE v_snap STRING DEFAULT GENERATE_UUID();
  DECLARE v_fim DATE;
  DECLARE v_corte DATE;
  DECLARE v_jan_ini DATE; DECLARE v_jan_fim DATE;
  DECLARE v_metodo STRING;
  DECLARE v_b FLOAT64; DECLARE v_se FLOAT64; DECLARE v_n INT64;
  DECLARE v_atr FLOAT64; DECLARE v_ini TIMESTAMP DEFAULT CURRENT_TIMESTAMP();
  DECLARE v_linhas INT64;

  SET v_min = IFNULL(
    p_min_enviados,
    (SELECT min_enviados_slot FROM `gogroup-crm.crm_modelo.marca_config` WHERE marca = p_marca));
  IF v_min IS NULL THEN
    RAISE USING MESSAGE = FORMAT('sp_deriva_indices: %s sem min_enviados_slot em marca_config', p_marca);
  END IF;

  SET v_fim = DATE_SUB(CURRENT_DATE(), INTERVAL p_maturacao DAY);

  -- Corte rolante. NULL = um mes antes de hoje; explicito ainda funciona, para
  -- reproduzir snapshot antigo.
  SET v_corte = IFNULL(p_corte, DATE_SUB(CURRENT_DATE('America/Sao_Paulo'), INTERVAL 1 MONTH));

  IF v_corte >= v_fim THEN
    RAISE USING MESSAGE = FORMAT(
      'sp_deriva_indices: %s com corte %t >= fim da janela %t - nao sobra teste',
      p_marca, v_corte, v_fim);
  END IF;

  CREATE OR REPLACE TEMP TABLE _base AS
  WITH f AS (
    SELECT data, hora, oferta, familia, n_campanhas, enviados, receita,
           TIMESTAMP_ADD(TIMESTAMP(data), INTERVAL hora HOUR) AS ts,
           ['Segunda','Terca','Quarta','Quinta','Sexta','Sabado','Domingo']
             [OFFSET(MOD(EXTRACT(DAYOFWEEK FROM data) + 5, 7))] AS ds
    FROM `gogroup-crm.crm_modelo.fato_slot`
    WHERE marca = p_marca AND data <= v_fim AND enviados >= v_min
  ),
  g AS (
    SELECT *, TIMESTAMP_DIFF(ts, LAG(ts) OVER (PARTITION BY familia ORDER BY ts), SECOND) / 3600.0 AS gap_h
    FROM f
  )
  SELECT data, hora, oferta, familia, ds, n_campanhas, enviados, receita,
    CASE
      WHEN gap_h IS NULL   THEN '30d+'
      WHEN gap_h <= 0      THEN NULL
      WHEN gap_h <= 12     THEN '<12h'
      WHEN gap_h <= 24     THEN '12-24h'
      WHEN gap_h <= 48     THEN '24-48h'
      WHEN gap_h <= 96     THEN '2-4d'
      WHEN gap_h <= 168    THEN '4-7d'
      WHEN gap_h <= 720    THEN '7-30d'
      ELSE '30d+'
    END AS gap_b
  FROM g;

  IF (SELECT COUNT(*) FROM _base) < 30 THEN
    RAISE USING MESSAGE = FORMAT(
      'sp_deriva_indices: %s tem so %d slots com enviados>=%d ate %t - amostra insuficiente',
      p_marca, (SELECT COUNT(*) FROM _base), v_min, v_fim);
  END IF;

  SET (v_jan_ini, v_jan_fim) = (SELECT AS STRUCT MIN(data), MAX(data) FROM _base);
  SET v_metodo = FORMAT(
    'GLM quasi-Poisson, offset=log(enviados), codificacao Sum; IC80 com se*sqrt(phi). '
    || 'Transferencia: walk-forward treino<%t<=teste (corte rolante = hoje-1mes). '
    || 'peso_transferencia = encolhimento empirico-Bayes de b, piso 0 teto 1.5; '
    || 'valor_efetivo = valor^peso. Slots com enviados>=%d. '
    || 'Pontos em forma fechada (modelo saturado); transferencia e alpha por IRLS 2p.',
    v_corte, v_min);

  CREATE OR REPLACE TEMP TABLE _long AS
  SELECT 'I1_dia' AS indice, ds AS nivel, enviados, receita, n_campanhas FROM _base
  UNION ALL SELECT 'I2_familia', gap_b, enviados, receita, n_campanhas FROM _base
  UNION ALL SELECT 'I3_hora', CAST(hora AS STRING), enviados, receita, n_campanhas FROM _base
  UNION ALL SELECT 'I4_oferta', oferta, enviados, receita, n_campanhas FROM _base;

  CREATE OR REPLACE TEMP TABLE _pontos AS
  WITH niv AS (
    SELECT indice, nivel, SUM(enviados) AS env, SUM(receita) AS rec, COUNT(*) AS n
    FROM _long WHERE nivel IS NOT NULL GROUP BY indice, nivel
  ),
  taxa AS (SELECT *, rec / env AS r FROM niv WHERE env > 0 AND rec > 0),
  ag AS (
    SELECT indice, COUNT(*) AS j, AVG(LN(r)) AS media_ln, SUM(1 / rec) AS soma_inv
    FROM taxa GROUP BY indice
  ),
  disp AS (
    SELECT l.indice,
           SUM(POW(l.receita - l.enviados * t.r, 2) / NULLIF(l.enviados * t.r, 0))
             / (COUNT(*) - ANY_VALUE(a.j)) AS phi
    FROM _long l
    JOIN taxa t USING (indice, nivel)
    JOIN ag a USING (indice)
    GROUP BY l.indice
  )
  SELECT
    t.indice, t.nivel, t.n AS n_observacoes, d.phi,
    EXP(LN(t.r) - a.media_ln) AS valor,
    EXP(LN(t.r) - a.media_ln - 1.2816 * SQRT(
      (POW(1 - 1 / a.j, 2) / t.rec + (a.soma_inv - 1 / t.rec) / POW(a.j, 2)) * d.phi)) AS ic80_lo,
    EXP(LN(t.r) - a.media_ln + 1.2816 * SQRT(
      (POW(1 - 1 / a.j, 2) / t.rec + (a.soma_inv - 1 / t.rec) / POW(a.j, 2)) * d.phi)) AS ic80_hi
  FROM taxa t JOIN ag a USING (indice) JOIN disp d USING (indice)
  WHERE a.j >= 2;

  CREATE OR REPLACE TEMP TABLE _transf (
    indice STRING, coef_transferencia FLOAT64, transf_lo FLOAT64, transf_hi FLOAT64,
    transf_se FLOAT64, peso_transferencia FLOAT64, veredito STRING
  );

  FOR ix IN (
    SELECT * FROM UNNEST([
      STRUCT('I1_dia' AS indice, 'ds' AS col, 5 AS minn),
      STRUCT('I2_familia', 'gap_b', 5),
      STRUCT('I3_hora', 'CAST(hora AS STRING)', 5),
      STRUCT('I4_oferta', 'oferta', 3)
    ])
  ) DO
    CALL `gogroup-crm.crm_modelo.sp_glm_pois_1x`(
      FORMAT("""
        WITH tr AS (SELECT %s AS k, enviados, receita FROM _base WHERE data < DATE '%t'),
             te AS (SELECT %s AS k, enviados, receita FROM _base WHERE data >= DATE '%t'),
             base AS (SELECT SUM(receita)/SUM(enviados) AS b FROM tr),
             mapa AS (
               SELECT k, (SUM(receita)/SUM(enviados)) / (SELECT b FROM base) AS idx
               FROM tr WHERE k IS NOT NULL GROUP BY k HAVING COUNT(*) >= %d AND SUM(enviados) > 0
             )
        SELECT te.receita AS y, LN(GREATEST(m.idx, 0.05)) AS x, LN(te.enviados) AS off
        FROM te JOIN mapa m USING (k) WHERE te.enviados > 0
      """, ix.col, v_corte, ix.col, v_corte, ix.minn),
      v_b, v_se, v_n);

    INSERT INTO _transf
    SELECT ix.indice,
           IF(v_n < 20, NULL, v_b),
           IF(v_n < 20, NULL, v_b - 1.2816 * v_se),
           IF(v_n < 20, NULL, v_b + 1.2816 * v_se),
           IF(v_n < 20, NULL, v_se),
           -- peso = b · tau²/(tau²+se²), tau² = max(0, b²−se²). Piso 0, teto 1.5.
           -- Amostra insuficiente vira 0 (índice neutro), nunca NULL: NULL viraria
           -- POW(valor, NULL) = NULL e apagaria o índice em vez de neutralizá-lo.
           IFNULL(
             CASE
               WHEN v_n < 20 OR v_b IS NULL OR v_se IS NULL THEN 0.0
               ELSE LEAST(1.5, GREATEST(0.0,
                    v_b * SAFE_DIVIDE(GREATEST(0.0, v_b * v_b - v_se * v_se),
                                      GREATEST(0.0, v_b * v_b - v_se * v_se) + v_se * v_se)))
             END, 0.0),
           -- Mantido para leitura humana e para o painel de saúde. NÃO é mais
           -- portão de nada: quem decide a força é peso_transferencia.
           CASE
             WHEN v_n < 20 OR v_b IS NULL THEN 'amostra insuficiente'
             WHEN v_b + 1.2816 * v_se < 0.15 THEN 'NAO transfere'
             WHEN v_b - 1.2816 * v_se > 0.5  THEN 'TRANSFERE'
             WHEN v_b - 1.2816 * v_se > 0    THEN 'transfere em parte'
             ELSE 'inconclusivo'
           END;
  END FOR;

  CREATE OR REPLACE TEMP TABLE _dia AS
  SELECT data, SUM(enviados) AS env, SUM(receita) AS rec, LN(SUM(enviados)) AS lv
  FROM _base GROUP BY data HAVING SUM(enviados) > 0;

  CALL `gogroup-crm.crm_modelo.sp_glm_pois_1x`(
    FORMAT("SELECT rec AS y, lv AS x, 0.0 AS off FROM _dia WHERE data < DATE '%t'", v_corte),
    v_atr, v_se, v_n);

  BEGIN
    DECLARE a FLOAT64; DECLARE sea FLOAT64; DECLARE na INT64;
    DECLARE bt FLOAT64; DECLARE set_ FLOAT64; DECLARE nt INT64;

    CALL `gogroup-crm.crm_modelo.sp_glm_pois_1x`(
      "SELECT rec AS y, lv AS x, 0.0 AS off FROM _dia", a, sea, na);
    CALL `gogroup-crm.crm_modelo.sp_glm_pois_1x`(
      FORMAT("SELECT rec AS y, %f * lv AS x, 0.0 AS off FROM _dia WHERE data >= DATE '%t'",
             v_atr, v_corte),
      bt, set_, nt);

    INSERT INTO `gogroup-crm.crm_modelo.snapshot_indices`
      (snapshot_id, marca, gerado_em, janela_ini, janela_fim, corte_walkforward,
       indice, nivel, valor, ic80_lo, ic80_hi, n_observacoes, phi,
       coef_transferencia, transf_lo, transf_hi, transf_se, peso_transferencia,
       valor_efetivo, veredito, metodo, versao_codigo)
    SELECT v_snap, p_marca, CURRENT_TIMESTAMP(), v_jan_ini, v_jan_fim, v_corte,
           p.indice, p.nivel, p.valor, p.ic80_lo, p.ic80_hi, p.n_observacoes, p.phi,
           t.coef_transferencia, t.transf_lo, t.transf_hi, t.transf_se,
           IFNULL(t.peso_transferencia, 0.0),
           POW(p.valor, IFNULL(t.peso_transferencia, 0.0)),
           t.veredito,
           v_metodo, 'sp_deriva_indices@sql-v2'
    FROM _pontos p LEFT JOIN _transf t USING (indice)
    UNION ALL
    -- I6_alpha nao e sum-coded: e o expoente de saturacao de volume. O bt dele
    -- mede se o alpha se sustenta, nao um fator de encolhimento — elevar alpha a
    -- bt nao significa nada. peso NULL, valor_efetivo = valor.
    SELECT v_snap, p_marca, CURRENT_TIMESTAMP(), v_jan_ini, v_jan_fim, v_corte,
           'I6_alpha', NULL, a, a - 1.2816 * sea, a + 1.2816 * sea, na, NULL,
           bt, bt - 1.2816 * set_, bt + 1.2816 * set_, set_, NULL,
           a,
           CASE
             WHEN bt + 1.2816 * set_ < 0.15 THEN 'NAO transfere'
             WHEN bt - 1.2816 * set_ > 0.5  THEN 'TRANSFERE'
             WHEN bt - 1.2816 * set_ > 0    THEN 'transfere em parte'
             ELSE 'inconclusivo'
           END,
           v_metodo, 'sp_deriva_indices@sql-v2';
  END;

  SET v_linhas = (SELECT COUNT(*) FROM `gogroup-crm.crm_modelo.snapshot_indices` WHERE snapshot_id = v_snap);

  INSERT INTO `gogroup-crm.crm_modelo.job_log` (job, marca, inicio, fim, status, linhas, mensagem)
  VALUES ('sp_deriva_indices', p_marca, v_ini, CURRENT_TIMESTAMP(), 'ok', v_linhas,
          FORMAT('snapshot %s, janela %t a %t, corte %t (rolante), min_enviados %d',
                 v_snap, v_jan_ini, v_jan_fim, v_corte, v_min));
END;
