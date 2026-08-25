-- =====================================================================
-- snapshot_indices em SQL puro — substitui 06_job_indices.py
--
-- POR QUE ISTO EXISTE
-- -------------------
-- `snapshot_indices` é a única entrada do modelo que ainda dependia de um
-- processo fora do BigQuery. O `06_job_indices.py` precisa de numpy, pandas,
-- patsy e statsmodels; scheduled query só executa SQL; logo o job exigia
-- Cloud Run Job + Cloud Scheduler — infra que ninguém montou. Resultado
-- medido: o último snapshot de todas as 5 marcas é de 24/08/2026 15:47 UTC,
-- rodado à mão, e `v_validacao.indices_validos` está vermelho para 5 de 5.
--
-- O docstring do .py diz que este é "o job que o INFRA §13 diz que NÃO pode
-- rodar no BigQuery: precisa de quasi-Poisson com offset e IC corrigido por
-- superdispersão, e BQML não tem nenhum dos dois."
--
-- A frase está certa sobre o BQML e errada sobre o BigQuery. BQML não faz
-- quasi-Poisson; SQL faz, porque não é preciso ajustar modelo nenhum para
-- três dos quatro índices:
--
--   GLM Poisson com UM fator categórico e offset = log(enviados) é o modelo
--   SATURADO daquele fator. O MLE não é numérico, é aritmético:
--
--       taxa_j = Σ receita (nível j) / Σ enviados (nível j)
--
--   e a codificação Sum só reexpressa isso contra a média geométrica dos
--   níveis:   exp(beta_j) = taxa_j / geomean_k(taxa_k).
--
--   A variância também é fechada. Na parametrização natural θ_j = ln(taxa_j),
--   a informação de Fisher é diagonal com entradas Σμ_i = Σy_i (no MLE), logo
--   Var(θ_j) = 1 / Σ receita_j. Propagando o contraste da codificação Sum,
--   beta_j = θ_j − (1/J)Σθ_k, e como os θ são independentes:
--
--       Var(beta_j) = (1 − 1/J)² / Y_j  +  (1/J²) · Σ_{k≠j} 1/Y_k
--
--   φ (superdispersão) é o Pearson χ² sobre os graus de liberdade — uma
--   soma. O IC80 é exp(b ± 1,2816 · se · √φ). Nada disso itera.
--
-- O que REALMENTE precisa de ajuste numérico são os coeficientes de
-- transferência (preditor contínuo, não fator) e o I6_alpha. São GLMs
-- Poisson de DOIS parâmetros — intercepto e inclinação. IRLS com 2
-- parâmetros tem inversa de matriz 2×2 analítica, converge em ~6 iterações
-- e cabe num WHILE de script. É o que faz `sp_glm_pois_1x`.
--
-- CRITÉRIO DE ACEITE: esta reescrita não vale por ser elegante, vale se
-- reproduzir o Python. Os snapshots de 24/08 15:47 UTC ficam como referência
-- e a comparação está na seção 4. Divergência aceitável: 1e-6 relativo.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. IRLS de 2 parâmetros para GLM Poisson log-link com offset
--
-- Recebe uma query que devolve (y, x, off) e devolve o coeficiente de x,
-- o erro padrão JÁ inflado por √φ, e o n. Offset zero cobre o caso sem
-- offset (I6_alpha), então uma rotina só atende os dois usos.
--
-- Passo de IRLS, para quem for reler isto daqui a um ano:
--   η = b0 + b1·x + off ;  μ = e^η ;  peso w = μ
--   resposta de trabalho z = (η − off) + (y − μ)/μ
--   resolve mínimos quadrados ponderados de z sobre (1, x)
-- A inversa de X'WX = [[S0,S1],[S1,S2]] é (1/det)·[[S2,−S1],[−S1,S0]],
-- então Var(b1) = S0/det. Sem álgebra linear, sem biblioteca.
--
-- POR QUE 12 ITERAÇÕES FIXAS E NÃO UM TESTE DE CONVERGÊNCIA
-- --------------------------------------------------------
-- A primeira versão parava em |Δb1| < 1e-12, com teto de 60. Ficou inviável:
-- em BigQuery scripting CADA statement do laço é um job, com ~1 s de overhead
-- de despacho. O teste de convergência custa 2 statements extras por volta,
-- e 6 GLMs × 15 voltas × 3 statements passou de 4 minutos — mais que o
-- timeout de qualquer cliente.
--
-- A versão de agora faz uma única instrução por iteração (o SET de b0 e b1
-- sai de um SELECT AS STRUCT só) e um número fixo de voltas. Custo: 12 jobs
-- por GLM em vez de ~45, e a marca inteira roda em 1,5–2,3 min.
--
-- 12 é seguro, e a prova é a seção 4 e não a fé: com 12 iterações os
-- coeficientes de transferência batem com o statsmodels em 1e-15, e o
-- I6_alpha em 1e-12. IRLS de Poisson log-link com chute inicial na taxa
-- média converge quadraticamente; 12 é folga de fábrica sobre as ~6 que
-- bastam. Se algum dia um índice novo tiver preditor mal condicionado, o
-- sintoma será um coeficiente que muda entre execuções idênticas — e aí o
-- lugar de mexer é aqui.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE `gogroup-crm.crm_modelo.sp_glm_pois_1x`(
  IN  p_sql STRING,      -- deve produzir colunas y FLOAT64, x FLOAT64, off FLOAT64
  OUT o_b  FLOAT64,      -- coeficiente de x
  OUT o_se FLOAT64,      -- erro padrão × √φ
  OUT o_n  INT64
)
BEGIN
  DECLARE b0 FLOAT64;
  DECLARE b1 FLOAT64 DEFAULT 0.0;
  DECLARE i INT64 DEFAULT 0;

  SET o_b = NULL; SET o_se = NULL;

  EXECUTE IMMEDIATE FORMAT("CREATE OR REPLACE TEMP TABLE _glm AS %s", p_sql);
  SET o_n = (SELECT COUNT(*) FROM _glm);
  IF o_n < 5 THEN RETURN; END IF;

  -- chute inicial: intercepto na taxa média, inclinação zero
  SET b0 = LN(NULLIF((SELECT SUM(y) / NULLIF(SUM(EXP(off)), 0) FROM _glm), 0));
  IF b0 IS NULL THEN RETURN; END IF;

  WHILE i < 12 DO
    SET (b0, b1) = (
      SELECT AS STRUCT
        (s2 * t0 - s1 * t1) / (s0 * s2 - s1 * s1),
        (s0 * t1 - s1 * t0) / (s0 * s2 - s1 * s1)
      FROM (
        SELECT SUM(w) AS s0, SUM(w*x) AS s1, SUM(w*x*x) AS s2,
               SUM(w*z) AS t0, SUM(w*x*z) AS t1
        FROM (
          SELECT mu AS w, x, (b0 + b1 * x) + (y - mu) / mu AS z
          FROM (SELECT y, x, EXP(b0 + b1 * x + off) AS mu FROM _glm)
          WHERE mu > 0
        )
      )
    );
    SET i = i + 1;
  END WHILE;

  -- X'WX e φ saem dos coeficientes CONVERGIDOS, não dos da última iteração
  -- do laço — senão o intervalo de confiança fica um passo atrás do ponto.
  SET (o_b, o_se) = (
    SELECT AS STRUCT b1, SQRT(s0 / (s0 * s2 - s1 * s1) * phi)
    FROM (
      SELECT SUM(mu) AS s0, SUM(mu*x) AS s1, SUM(mu*x*x) AS s2,
             SUM(POW(y - mu, 2) / mu) / (COUNT(*) - 2) AS phi
      FROM (SELECT y, x, EXP(b0 + b1 * x + off) AS mu FROM _glm)
      WHERE mu > 0
    )
  );
END;


-- ---------------------------------------------------------------------
-- 2. O job em si
--
-- Mesma janela, mesmos cortes, mesma ordem de níveis do Python. APPEND-ONLY:
-- cada execução é um snapshot_id novo, jamais UPDATE ou DELETE — a série de
-- snapshots é o registro de como o modelo mudou de opinião ao longo do tempo,
-- e sobrescrever apagaria isso.
--
-- p_corte é a data de walk-forward. O Python fixa 2026-07-01 no código. Aqui
-- é parâmetro para que a reescrita possa ser comparada com o Python, mas ela
-- CONTINUA sendo uma data fixa, e isso vai apodrecer: à medida que o tempo
-- passa, o treino cresce e o teste vira "quase tudo". O certo é um corte
-- móvel (por exemplo, últimos 8 semanas como teste). Não muda aqui porque
-- mudar o corte muda todo coeficiente de transferência, e essa é uma decisão
-- de modelagem, não de portabilidade.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE `gogroup-crm.crm_modelo.sp_deriva_indices`(
  p_marca STRING,
  p_corte DATE,
  p_maturacao INT64,        -- dias de folga p/ atribuição maturar (janela é 36h; 3 é a folga)
  p_min_enviados INT64      -- NULL = lê marca_config.min_enviados_slot
)
BEGIN
  DECLARE v_min INT64;
  DECLARE v_snap STRING DEFAULT GENERATE_UUID();
  DECLARE v_fim DATE;
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

  -- ── base: mesma seleção do Python, mais o bucket de gap por família ──
  -- O gap é "horas desde o disparo anterior DA MESMA família". No Python é um
  -- dicionário atualizado em varredura ordenada; aqui é LAG particionado por
  -- família — equivalente, e sem o laço.
  --
  -- Duas fidelidades feias que são de propósito:
  --
  --   · primeira ocorrência da família vira '30d+' (o Python usa gap=1e9);
  --
  --   · gap exatamente 0 é DESCARTADO, não bucketizado. No Python o pd.cut usa
  --     right=True com primeiro intervalo (0,12], então 0 não pertence a bucket
  --     nenhum, vira NaN, e o `d[col].notna()` do pontos() joga a linha fora.
  --     Medido na Lescent: 2 slots (23/06 10h Necessaire, 25/06 10h
  --     Cupom/Desconto). Reproduzido aqui com NULL, que o `WHERE nivel IS NOT
  --     NULL` do _pontos filtra igual.
  --
  --     Isto é um DEFEITO herdado de propósito, não uma decisão. Dois disparos
  --     da mesma família na mesma hora é o caso mais extremo justamente daquilo
  --     que o I2 mede — saturação por proximidade — e o modelo responde
  --     apagando a observação. O conserto honesto é um bucket '0h'. Não entra
  --     aqui porque mudaria o I2 de todas as marcas, e o critério desta
  --     reescrita é reproduzir o Python, não melhorá-lo às escondidas.
  --
  --     Pior: qual das duas linhas do par sobrevive é ARBITRÁRIO. O Python
  --     ordena por ['ts','familia'] e a desempate cai na ordem em que o
  --     BigQuery devolveu as linhas; o LAG aqui desempata por conta própria.
  --     Na Lescent os dois pares têm gap real de 1,0h, e os membros são muito
  --     desiguais (152.976 contra 8.273 envios num deles) — então a moeda cair
  --     de um lado ou do outro move a taxa do nível '<12h'. É a ÚNICA origem
  --     da divergência residual de 0,14% documentada na seção 4.
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
      'sp_deriva_indices: %s tem só %d slots com enviados>=%d até %t — amostra insuficiente',
      p_marca, (SELECT COUNT(*) FROM _base), v_min, v_fim);
  END IF;

  SET (v_jan_ini, v_jan_fim) = (SELECT AS STRUCT MIN(data), MAX(data) FROM _base);
  SET v_metodo = FORMAT(
    'GLM quasi-Poisson, offset=log(enviados), codificacao Sum; IC80 com se*sqrt(phi). '
    || 'Transferencia: walk-forward treino<%t<=teste (g_validacao.py). Slots com enviados>=%d. '
    || 'Pontos em forma fechada (modelo saturado); transferencia e alpha por IRLS 2p.',
    p_corte, v_min);

  -- ── formato longo: um índice por linha, para tratar os quatro de uma vez ──
  CREATE OR REPLACE TEMP TABLE _long AS
  SELECT 'I1_dia'     AS indice, ds                    AS nivel, enviados, receita, n_campanhas FROM _base
  UNION ALL SELECT 'I2_familia', gap_b,                            enviados, receita, n_campanhas FROM _base
  UNION ALL SELECT 'I3_hora',    CAST(hora AS STRING),             enviados, receita, n_campanhas FROM _base
  UNION ALL SELECT 'I4_oferta',  oferta,                           enviados, receita, n_campanhas FROM _base;

  -- ── pontos + IC80, forma fechada ──
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
  -- φ é por índice: Pearson χ² sobre (n_slots − n_niveis)
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

  -- ── transferência: um IRLS por índice ──
  CREATE OR REPLACE TEMP TABLE _transf (
    indice STRING, coef_transferencia FLOAT64, transf_lo FLOAT64, transf_hi FLOAT64, veredito STRING
  );

  FOR ix IN (
    SELECT * FROM UNNEST([
      STRUCT('I1_dia' AS indice, 'ds' AS col, 5 AS minn),
      STRUCT('I2_familia', 'gap_b', 5),
      STRUCT('I3_hora', 'CAST(hora AS STRING)', 5),
      STRUCT('I4_oferta', 'oferta', 3)
    ])
  ) DO
    -- mapa estimado SÓ no treino, aplicado ao teste. É isso que separa
    -- "o índice existe no histórico" de "o índice previu o futuro".
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
      """, ix.col, p_corte, ix.col, p_corte, ix.minn),
      v_b, v_se, v_n);

    INSERT INTO _transf
    SELECT ix.indice,
           IF(v_n < 20, NULL, v_b),
           IF(v_n < 20, NULL, v_b - 1.2816 * v_se),
           IF(v_n < 20, NULL, v_b + 1.2816 * v_se),
           CASE
             WHEN v_n < 20 OR v_b IS NULL THEN 'amostra insuficiente'
             WHEN v_b + 1.2816 * v_se < 0.15 THEN 'NAO transfere'
             WHEN v_b - 1.2816 * v_se > 0.5  THEN 'TRANSFERE'
             WHEN v_b - 1.2816 * v_se > 0    THEN 'transfere em parte'
             ELSE 'inconclusivo'
           END;
  END FOR;

  -- ── I6_alpha: elasticidade da receita ao volume do DIA ──
  -- Sem offset, de propósito. Com offset o coeficiente seria (alpha − 1);
  -- sem offset ele É o alpha, e receita ~ V^alpha dá RPM ~ V^(alpha−1),
  -- de onde sai o expoente de alocação 1/(1−alpha) que o gerador usa.
  CREATE OR REPLACE TEMP TABLE _dia AS
  SELECT data, SUM(enviados) AS env, SUM(receita) AS rec, LN(SUM(enviados)) AS lv
  FROM _base GROUP BY data HAVING SUM(enviados) > 0;

  -- transferência do alpha: inclinação do treino levada ao teste
  CALL `gogroup-crm.crm_modelo.sp_glm_pois_1x`(
    FORMAT("SELECT rec AS y, lv AS x, 0.0 AS off FROM _dia WHERE data < DATE '%t'", p_corte),
    v_atr, v_se, v_n);

  BEGIN
    DECLARE a FLOAT64; DECLARE sea FLOAT64; DECLARE na INT64;
    DECLARE bt FLOAT64; DECLARE set_ FLOAT64; DECLARE nt INT64;

    CALL `gogroup-crm.crm_modelo.sp_glm_pois_1x`(
      "SELECT rec AS y, lv AS x, 0.0 AS off FROM _dia", a, sea, na);
    CALL `gogroup-crm.crm_modelo.sp_glm_pois_1x`(
      FORMAT("SELECT rec AS y, %f * lv AS x, 0.0 AS off FROM _dia WHERE data >= DATE '%t'",
             v_atr, p_corte),
      bt, set_, nt);

    INSERT INTO `gogroup-crm.crm_modelo.snapshot_indices`
      (snapshot_id, marca, gerado_em, janela_ini, janela_fim, corte_walkforward,
       indice, nivel, valor, ic80_lo, ic80_hi, n_observacoes, phi,
       coef_transferencia, transf_lo, transf_hi, veredito, metodo, versao_codigo)
    SELECT v_snap, p_marca, CURRENT_TIMESTAMP(), v_jan_ini, v_jan_fim, p_corte,
           p.indice, p.nivel, p.valor, p.ic80_lo, p.ic80_hi, p.n_observacoes, p.phi,
           t.coef_transferencia, t.transf_lo, t.transf_hi, t.veredito,
           v_metodo, 'sp_deriva_indices@sql-v1'
    FROM _pontos p LEFT JOIN _transf t USING (indice)
    UNION ALL
    SELECT v_snap, p_marca, CURRENT_TIMESTAMP(), v_jan_ini, v_jan_fim, p_corte,
           'I6_alpha', NULL, a, a - 1.2816 * sea, a + 1.2816 * sea, na, NULL,
           bt, bt - 1.2816 * set_, bt + 1.2816 * set_,
           CASE
             WHEN bt + 1.2816 * set_ < 0.15 THEN 'NAO transfere'
             WHEN bt - 1.2816 * set_ > 0.5  THEN 'TRANSFERE'
             WHEN bt - 1.2816 * set_ > 0    THEN 'transfere em parte'
             ELSE 'inconclusivo'
           END,
           v_metodo, 'sp_deriva_indices@sql-v1';
  END;

  SET v_linhas = (SELECT COUNT(*) FROM `gogroup-crm.crm_modelo.snapshot_indices` WHERE snapshot_id = v_snap);

  INSERT INTO `gogroup-crm.crm_modelo.job_log` (job, marca, inicio, fim, status, linhas, mensagem)
  VALUES ('sp_deriva_indices', p_marca, v_ini, CURRENT_TIMESTAMP(), 'ok', v_linhas,
          FORMAT('snapshot %s, janela %t a %t, corte %t, min_enviados %d',
                 v_snap, v_jan_ini, v_jan_fim, p_corte, v_min));
END;


-- =====================================================================
-- 3. Onde isto tem que ser chamado
--
-- Uma vez por marca por dia, DEPOIS do fato_slot daquela marca ter sido
-- recarregado — os índices leem fato_slot, e índice calculado antes da carga
-- é índice de ontem com carimbo de hoje. O lugar é dentro do loop por marca
-- do scheduled query "crm_modelo - ETL diario" (every day 11:30 UTC), no
-- mesmo BEGIN/EXCEPTION que já protege cada marca:
--
--   CALL `gogroup-crm.crm_modelo.sp_carrega_fato_slot`(rec.marca);
--   CALL `gogroup-crm.crm_modelo.sp_monitor_classificador`(rec.marca, 60);
--   CALL `gogroup-crm.crm_modelo.sp_deriva_config`(rec.marca);            -- < novo
--   CALL `gogroup-crm.crm_modelo.sp_deriva_grade_horarios`(rec.marca, 0.30); -- < novo
--   CALL `gogroup-crm.crm_modelo.sp_deriva_indices`(
--          rec.marca, DATE '2026-07-01', 3, NULL);                        -- < novo
--
-- A ORDEM IMPORTA E NÃO É ESTÉTICA:
--   sp_deriva_config escreve min_enviados_slot;
--   sp_deriva_grade_horarios lê min_enviados_slot;
--   sp_deriva_indices lê min_enviados_slot (p_min_enviados NULL = lê da config).
-- Invertido, a grade e os índices de hoje usam o corte de ontem — sem erro,
-- sem log, com números plausíveis. É o tipo de bug que só aparece meses depois
-- quando alguém tenta reproduzir um número e não consegue.
--
-- CUSTO: sp_deriva_indices lê fato_slot da marca uma vez (~10 MB, é tabela
-- agregada) e roda ~90 statements de script. Medido: 1,5 a 2,3 min por marca.
-- Cinco marcas somam ~10 min ao ETL diário, que hoje leva ~2 min. Se isso
-- incomodar, o caminho é semanal para os índices — eles se movem devagar —
-- e diário só para config e grade.
--
-- OS TRÊS transferConfigs (região southamerica-east1, projeto 175021348508,
-- todos rodando como crm-calendario-etl@gogroup-crm.iam.gserviceaccount.com):
--
--   6a8e9f2a-0000-296d-87dd-ac3eb14771bc  ETL diario           every day 11:30
--   6a8cfe03-0000-2ee2-ab9c-ac3eb14515a0  ETL semanal (pessoa) every monday 12:30
--   6a8ca3bf-0000-2890-b349-ac3eb1478bc0  alerta de saude      every day 12:00
--
-- CORREÇÃO DE UM ERRO DE LEITURA, registrada porque o raciocínio errado é
-- reutilizável e vai reaparecer: em 24/08 concluí que "nada está agendado"
-- porque o job_log só tinha linhas de um único dia. A dedução não se sustenta.
-- Os três configs foram criados em 24/08 às 16:22 UTC, ou seja DEPOIS do
-- horário de disparo daquele dia — a primeira execução automática só cairia
-- em 25/08. Não havia histórico porque era cedo, não porque faltava schedule.
-- job_log responde "o que rodou", nunca "o que vai rodar"; para a segunda
-- pergunta a única fonte é o transferConfig.
--
-- Scheduled query não é objeto SQL: vive no BigQuery Data Transfer Service,
-- que só tem REST API. `gcloud` desta máquina está com a autenticação morta,
-- então o caminho é scripts/dts.mjs (assina JWT RS256 com a chave da SA):
--
--   node scripts/dts.mjs list
--   node scripts/dts.mjs get <configId> > /tmp/atual.sql   # confere o corpo
--   node scripts/dts.mjs patch <configId> /tmp/novo.sql
--   node scripts/dts.mjs run <configId>                    # dispara uma vez
--
-- Exige roles/bigquery.admin (ou bigquerydatatransfer.admin + dataEditor +
-- jobUser) na identidade usada — spec-36 respondia 403 `bigquery.transfers.get`
-- até 25/08.


-- =====================================================================
-- 4. VALIDAÇÃO CONTRA O PYTHON  —  25/08/2026
--
-- Critério: rodar a versão SQL com os MESMOS parâmetros do Python (corte
-- 2026-07-01, min_enviados 5000, janela até 2026-08-21) e comparar linha a
-- linha com os snapshots que o 06_job_indices.py gravou em 24/08 15:47 UTC.
--
--   CALL sp_deriva_indices('lescent',  DATE '2026-07-01', 4, 5000);
--   CALL sp_deriva_indices('barbours', DATE '2026-07-01', 4, 5000);
--
-- Resultado (erro relativo máximo por índice; n_observacoes e veredito
-- conferidos linha a linha, zero divergência em ambos):
--
--   marca     indice       niveis  valor    IC80     phi      transferencia
--   barbours  I1_dia          7    1,8e-15  8,4e-10  3,3e-15  6,7e-15
--   barbours  I2_familia      7    2,0e-15  2,4e-09  1,1e-15  1,9e-15
--   barbours  I3_hora        13    8,0e-15  2,9e-09  4,0e-15  8,2e-15
--   barbours  I4_oferta      38    9,3e-15  1,4e-08  6,7e-15  1,6e-15
--   barbours  I6_alpha        1    4,9e-13  1,9e-09     —     8,4e-07
--   lescent   I1_dia          7    1,1e-15  5,7e-10  5,6e-16  8,4e-15
--   lescent   I2_familia      7    1,4e-03  1,5e-03  7,4e-04  2,2e-03   <<
--   lescent   I3_hora        14    3,1e-15  2,9e-11  1,1e-15  6,8e-15
--   lescent   I4_oferta      22    1,3e-14  6,1e-09  5,1e-15  5,3e-15
--   lescent   I6_alpha        1    1,0e-12  4,9e-10     —     5,2e-07
--
-- 117 linhas, 5 índices, 2 marcas. Tudo em precisão de máquina exceto uma
-- célula, e essa célula tem causa conhecida: são os dois pares de slots da
-- mesma família na mesma hora descritos na seção 2. Barbours não tem nenhum
-- par assim, e por isso bate exato nos cinco índices — o que é justamente a
-- evidência de que a causa é essa e não outra.
--
-- 1e-9 nos IC80 (contra 1e-15 nos valores) não é ruído numérico: é o Z80 do
-- Python, escrito como 1.2816, que é o quantil arredondado a 4 casas. Mesma
-- constante dos dois lados, mesmo arredondamento, propagado pelo exp().
--
-- O QUE ESTA VALIDAÇÃO NÃO PROVA: que o modelo esteja certo. Ela prova que a
-- reescrita reproduz o Python, inclusive nos defeitos dele. Se o walk-forward
-- com corte fixo em 2026-07-01 estiver errado, agora está errado em SQL — e
-- roda sozinho todo dia, que é pior. O corte móvel continua pendente.
