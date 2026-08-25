-- =============================================================================
-- crm_modelo :: grade_horarios derivada + guardas de saúde
-- =============================================================================
--
-- APLICADO EM 24/08/2026 (via MCP, como avila.farias). Este arquivo é a fonte
-- versionada do que está no BigQuery — se divergir, o BigQuery está errado.
--
--
-- 1. O QUE ESTAVA QUEBRADO
-- -----------------------------------------------------------------------------
--
-- `marca_config.grade_horarios` estava NULL em barbours, apice, rituaria e
-- kokeshi. Só lescent tinha valor, declarado à mão no seed original.
--
-- Causa: o seed da Barbour's foi escrito a partir do da Lescent SEM essa coluna,
-- e os três seguintes foram cópias do da Barbour's. A omissão se propagou quatro
-- vezes. Passou em silêncio porque no DDL a coluna é opcional:
--
--     grade_horarios JSON OPTIONS(description='{"Segunda":[9,15,19], ...}')
--
-- INSERT sem ela → NULL, zero erro.
--
-- Sintoma: `gradeDoContexto` vira [[],[],[],[],[],[],[]], o gerador não tem hora
-- onde encaixar slot, e devolve calendário de ZERO slots com procedencia="dados",
-- catálogo real carregado e avisos plausíveis. Nenhum erro na tela. O único sinal
-- visível era a leitura assistida falhando com 400 "Nenhum calendário gerado".
--
--
-- 2. A REGRA DE DERIVAÇÃO
-- -----------------------------------------------------------------------------
--
-- Uma hora entra na grade do dia da semana se a marca disparou nela em pelo menos
-- `p_limiar` das ocorrências daquele dia na janela, contando só slots acima de
-- `min_enviados_slot` — o mesmo corte que o ajuste dos índices usa. Não inventa
-- limiar novo. Default: 0.30.
--
-- RECORRÊNCIA, NÃO VOLUME. Uma grade é o que a marca usa com REGULARIDADE.
-- Ordenar por volume elege o disparo único gigante e ignora o horário fixo de
-- todo dia — o oposto do que grade significa. Medido na Barbour's: por volume,
-- sexta sairia [9,10,11]; por recorrência, [8,9,17], e 17h aparece em 11 das 20
-- sextas da janela enquanto 11h aparece em 4.
--
--
-- 3. A GRADE DECLARADA DA LESCENT NÃO DESCREVIA A LESCENT
-- -----------------------------------------------------------------------------
--
-- Era o único valor humano do sistema, e não batia com o comportamento da marca:
--
--   dia       declarado        derivado (recorrência >= 30%)
--   Domingo   9,15,19          9,10,11,17
--   Segunda   9,15,19          9,10,11,18,19
--   Terça     8,15,19          9,10,11,19
--   Quarta    8,15,19          9,10,11,19
--   Quinta    9,15,19          9,10,19
--   Sexta     8,12,19          9,10,11,17
--   Sábado    9,15,19          9,11,17
--
-- 15h está em 6 dos 7 dias declarados e nunca passa de 3% do volume observado em
-- dia nenhum. 8h está em três dias declarados e não aparece em nenhum derivado.
--
-- E a grade derivada da KOKESHI saiu quase idêntica à declarada da Lescent
-- ({"Quarta":[8,15,19],"Quinta":[9,15,19],"Segunda":[9,15,19],...}). A hipótese
-- mais simples é que o valor da Lescent foi copiado da operação de outra marca.
-- Não foi confirmado com o autor.
--
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 4. A PROCEDURE
-- -----------------------------------------------------------------------------

CREATE OR REPLACE PROCEDURE `gogroup-crm.crm_modelo.sp_deriva_grade_horarios`(p_marca STRING, p_limiar FLOAT64)
BEGIN
  DECLARE v_json JSON;
  DECLARE v_dias_com_hora INT64;

  SET (v_json, v_dias_com_hora) = (
    WITH cfg AS (
      SELECT IFNULL(min_enviados_slot, 0) AS min_env
      FROM `gogroup-crm.crm_modelo.marca_config` WHERE marca = p_marca
    ),
    base AS (
      SELECT f.dow, f.hora, f.data
      FROM `gogroup-crm.crm_modelo.fato_slot` f, cfg
      WHERE f.marca = p_marca AND f.enviados >= cfg.min_env
    ),
    ocorr AS (SELECT dow, COUNT(DISTINCT data) AS dias_dow FROM base GROUP BY dow),
    uso   AS (SELECT dow, hora, COUNT(DISTINCT data) AS dias_usados FROM base GROUP BY dow, hora),
    sel   AS (
      SELECT u.dow, u.hora FROM uso u JOIN ocorr o USING (dow)
      WHERE o.dias_dow > 0 AND u.dias_usados / o.dias_dow >= p_limiar
    ),
    porDia AS (
      SELECT dow,
             CASE dow WHEN 1 THEN 'Domingo' WHEN 2 THEN 'Segunda' WHEN 3 THEN 'Terca'
                      WHEN 4 THEN 'Quarta'  WHEN 5 THEN 'Quinta'  WHEN 6 THEN 'Sexta'
                      WHEN 7 THEN 'Sabado' END AS nome,
             STRING_AGG(CAST(hora AS STRING), ',' ORDER BY hora) AS lista
      FROM sel GROUP BY dow
    )
    SELECT AS STRUCT
      SAFE.PARSE_JSON(CONCAT('{', STRING_AGG(FORMAT('"%s":[%s]', nome, lista), ',' ORDER BY dow), '}')),
      COUNT(*)
    FROM porDia
  );

  -- Falha alta. Grade vazia é o bug de 24/08; melhor derrubar o job da marca do
  -- que gravar NULL e o calendário sair mudo de novo.
  IF v_json IS NULL OR v_dias_com_hora = 0 THEN
    RAISE USING MESSAGE = FORMAT(
      'sp_deriva_grade_horarios: %s nao tem hora nenhuma acima do limiar %.2f -- grade ficaria vazia',
      p_marca, p_limiar);
  END IF;

  UPDATE `gogroup-crm.crm_modelo.marca_config`
  SET grade_horarios = v_json,
      atualizado_em  = CURRENT_TIMESTAMP(),
      atualizado_por = FORMAT('sp_deriva_grade_horarios (recorrencia >= %.0f%% em fato_slot)', 100 * p_limiar)
  WHERE marca = p_marca;

  INSERT INTO `gogroup-crm.crm_modelo.job_log` (job, marca, inicio, fim, status, linhas, mensagem)
  VALUES ('sp_deriva_grade_horarios', p_marca, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 'ok',
          v_dias_com_hora, FORMAT('limiar %.2f, %d dias com grade', p_limiar, v_dias_com_hora));
END;


-- -----------------------------------------------------------------------------
-- 5. GUARDAS EM v_saude_marca
-- -----------------------------------------------------------------------------
--
-- Duas colunas novas, que são as duas falhas silenciosas que já morderam:
--
--   grade_ausente         config incompleta. Teria gritado em 24/08 12:57, no
--                         primeiro seed da Barbour's, em vez de dois dias depois.
--   indice_desatualizado  snapshot mais velho que o fato_slot que o gerou. Não é
--                         "atrasado", é INVÁLIDO: o fato do ajuste foi apagado e
--                         reescrito depois. Estado real em 24/08: verdadeiro nas
--                         5 marcas (fato às 16:20, último snapshot às 15:47).

CREATE OR REPLACE VIEW `gogroup-crm.crm_modelo.v_saude_marca` AS
WITH slot AS (
  SELECT marca,
         MAX(data) AS ultimo_dia_fato,
         TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), MAX(atualizado_em), HOUR) AS atraso_horas,
         MAX(atualizado_em) AS fato_atualizado_em,
         COUNT(*) AS slots
  FROM `gogroup-crm.crm_modelo.fato_slot`
  GROUP BY marca
),
snap AS (
  SELECT marca, MAX(gerado_em) AS ultimo_snapshot
  FROM `gogroup-crm.crm_modelo.snapshot_indices`
  GROUP BY marca
),
mon AS (
  SELECT marca, pct_outros
  FROM (
    SELECT marca, pct_outros,
           ROW_NUMBER() OVER (PARTITION BY marca ORDER BY medido_em DESC) AS rn
    FROM `gogroup-crm.crm_modelo.monitor_classificador`
  )
  WHERE rn = 1
)
SELECT
  c.marca,
  c.ativo,
  s.ultimo_dia_fato,
  s.atraso_horas,
  IFNULL(s.slots, 0) AS slots,
  sn.ultimo_snapshot,
  m.pct_outros,
  (c.grade_horarios IS NULL
   OR ARRAY_LENGTH(JSON_KEYS(c.grade_horarios)) = 0) AS grade_ausente,
  (sn.ultimo_snapshot IS NULL
   OR sn.ultimo_snapshot < s.fato_atualizado_em) AS indice_desatualizado,
  sn.ultimo_snapshot < s.fato_atualizado_em AS indice_anterior_ao_fato
FROM `gogroup-crm.crm_modelo.marca_config` c
LEFT JOIN slot s  ON s.marca  = c.marca
LEFT JOIN snap sn ON sn.marca = c.marca
LEFT JOIN mon  m  ON m.marca  = c.marca;


-- =============================================================================
-- 6. PENDENTE — precisa de `gcloud auth login`, não dá para aplicar pelo MCP
-- =============================================================================
--
-- 6.1. [ATUALIZADO pela §9] O bloco 1 do 14_scheduled_queries.sql precisa de DUAS
--      chamadas novas no laço por marca, DEPOIS de sp_carrega_fato_slot e NESTA
--      ordem (a grade lê min_enviados_slot, que sp_deriva_config acabou de gravar):
--
--          CALL `gogroup-crm.crm_modelo.sp_deriva_config`(rec.marca);
--          CALL `gogroup-crm.crm_modelo.sp_deriva_grade_horarios`(rec.marca, 0.30);
--
--      Texto original abaixo, mantido por referência:
--
-- 6.1b. A derivação precisa entrar no ETL diário, DEPOIS de sp_carrega_fato_slot
--      (ela lê fato_slot). No bloco 1 de 14_scheduled_queries.sql, dentro do
--      loop por marca, logo após o CALL de fato_slot:
--
--          CALL `gogroup-crm.crm_modelo.sp_deriva_grade_horarios`(rec.marca, 0.30);
--
--      Aplicar com:
--          python3 15_criar_scheduled_queries.py --aplicar
--
-- 6.2. Os dois alertas novos, no bloco 3 ("alerta de saude"), como mais dois
--      UNION ALL dentro do SET problemas:
--
--          SELECT FORMAT('%s sem grade_horarios', marca)
--          FROM `gogroup-crm.crm_modelo.v_saude_marca`
--          WHERE ativo AND grade_ausente
--          UNION ALL
--          SELECT FORMAT('%s indice mais velho que o fato', marca)
--          FROM `gogroup-crm.crm_modelo.v_saude_marca`
--          WHERE ativo AND indice_desatualizado
--
-- 6.3. O Cloud Run Job do 06_job_indices.py — §13 do INFRA, item 2 do caminho
--      crítico do handoff, e o que está de fato congelado hoje. É o job que NÃO
--      pode rodar no BigQuery (quasi-Poisson com offset e IC corrigido por
--      superdispersão; BQML não tem nenhum dos dois). É append-only, então
--      reprocessar não destrói histórico.
--
--          gcloud run jobs create crm-modelo-indices \
--            --project=gogroup-crm --region=southamerica-east1 \
--            --image=<imagem com statsmodels/patsy/pandas + 06_job_indices.py> \
--            --service-account=crm-calendario-etl@gogroup-crm.iam.gserviceaccount.com \
--            --set-env-vars=MARCA=lescent --max-retries=1 --task-timeout=15m
--
--          gcloud scheduler jobs create http crm-modelo-indices-diario \
--            --project=gogroup-crm --location=southamerica-east1 \
--            --schedule="15 12 * * *" --time-zone=UTC \
--            --uri="https://run.googleapis.com/v2/projects/gogroup-crm/locations/southamerica-east1/jobs/crm-modelo-indices:run" \
--            --http-method=POST --oauth-service-account-email=crm-calendario-etl@gogroup-crm.iam.gserviceaccount.com
--
--      12:15 UTC = 09:15 BRT, 45 min depois do ETL diário (11:30 UTC, ~2 min de
--      execução). Uma execução por marca — 5 jobs, ou um job com MARCA vindo de
--      --args e 5 tasks.
--
-- 6.4. NÃO VERIFICADO: que o ETL diário dispara sozinho. A única execução da SA
--      crm-calendario-etl foi 24/08 16:15–16:22, que não bate com o
--      `every day 11:30` — provavelmente "Run now" no setup. O primeiro teste
--      real é 25/08 11:30 UTC. Conferir depois disso:
--
--          SELECT job, marca, inicio, status FROM `gogroup-crm.crm_modelo.job_log`
--          WHERE inicio > TIMESTAMP('2026-08-25 11:00:00') ORDER BY inicio;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. GUARDA NO FRONTEND — o mesmo defeito, dito na tela
--
-- A correção acima fecha a causa. Não fecha o modo de falha: o caminho do NULL
-- até a tela era mudo em todos os pontos. `worker.ts:353` traduz JSON ausente
-- para sete listas vazias, o gerador não acha hora onde encaixar oferta e devolve
-- zero slots, e a aba mostra o banner verde "CATÁLOGO EXTRAÍDO DO HISTÓRICO" com
-- uma grade em branco embaixo. Nada distingue "o modelo não recomendou disparar"
-- de "a config está quebrada" — e essa ambiguidade é o motivo de o bug ter durado.
--
-- Dois avisos novos, ambos em vermelho e ambos acima da grade:
--
--   src/utils/calendarioContexto.ts → `avisosDoContexto()`
--     (a) grade totalmente vazia — cita a marca e o CALL que corrige;
--     (b) dia declarado em `dias_ativos` sem hora nenhuma na grade, que o gerador
--         pula em silêncio (ou a operação nunca disparou nele com recorrência
--         suficiente, ou `dias_ativos` está desatualizado).
--
--   src/components/calendario/CalendarioWorkspace.tsx
--     (c) calendário com `slots.length === 0` — diz que zero disparo nunca é
--         recomendação, e imprime as três entradas a conferir com os números
--         medidos (horas na semana, famílias agendáveis, dias ativos no período).
--
-- (a) e (b) aparecem ANTES de gerar, assim que o contexto carrega.

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. v_horas_dow — a saída #4 da FASE 1, que nunca foi implementada
--
-- O MODELO_CALENDARIO_MULTIMARCA.md, FASE 1 (Censo de viabilidade), lista cinco
-- saídas obrigatórias. A #4 é:
--
--     "Horas já usadas por dia. Um horário nunca usado num dia é uma hipótese,
--      não uma prescrição."
--
-- e a query da fase traz `ARRAY_AGG(DISTINCT hora) AS horas_ja_usadas` agrupado
-- por dow. Das cinco saídas, essa é a única que não chegou na `v_viabilidade` —
-- a view implementada tinha só o censo de ofertas (dias_1/2/3_oferta). A grade
-- NULL e a saída #4 ausente são o mesmo buraco visto de dois lados: o modelo
-- perdeu, ao mesmo tempo, o lugar de onde a grade sai e a grade em si.
--
-- v_horas_dow, grão (marca, dow, hora):
--   dias_usados, dias_dow, recorrencia   -- o critério da grade
--   enviados, receita, rpm               -- para julgar a hora, não só contá-la
--   share_volume_dow                     -- peso da hora dentro do dia
--   na_grade                             -- LÊ marca_config.grade_horarios (não
--                                           re-deriva) — então divergência entre
--                                           recorrencia e na_grade é deriva real
--
-- `sp_deriva_grade_horarios` foi reescrita para SELECIONAR desta view em vez de
-- recalcular o censo internamente. Uma definição só: o que a view mostra é
-- exatamente o que elege a grade. Verificado — as 5 grades saíram byte-idênticas
-- às da §4 depois da reescrita.
--
-- `v_viabilidade` ganhou `horas_ja_usadas` (o censo, literal do spec) e
-- `horas_na_grade` (o subconjunto agendável). A diferença entre as duas é a
-- faixa de hipótese de que o spec fala. Colunas antigas preservadas; worker.ts e
-- server/bigquery.ts selecionam coluna a coluna, então nada quebra.
--
-- DUAS COISAS QUE O CENSO EXPÔS:
--
-- 8.1. O filtro `min_enviados_slot` é INERTE. Eu o reusei na §2 apresentando
--      como virtude ("reaproveita o limiar que a marca já declara") — ele não
--      filtra nada. Com 5000 em todas as marcas, corta 0 a 3 slots de ~370, e
--      ZERO combinações (marca, dow, hora): as poucas cortadas dividem dow+hora
--      com outras que passam. O limiar de recorrência faz 100% do trabalho.
--      Enviados mediano por slot é 72k–171k; 5000 não separa nada.
--
-- 8.2. O corte em 0,30 é um penhasco para ~11% do censo:
--
--          >=50%  folgado dentro            59  16,6%
--          35-50% dentro                    44  12,4%
--          30-35% entra raspando            18   5,1%   <-- 40 combos (11,3%)
--          25-30% fica de fora raspando     22   6,2%   <-- decididos por ±5pp
--          10-25% ocasional                129  36,3%
--          <10%   raro                      83  23,4%
--
--      Não é motivo para abandonar o limiar — é motivo para a faixa vizinha
--      ficar visível em vez de sumir. É o que `horas_ja_usadas` devolve.
--
-- Total: 355 linhas de censo, 121 na grade (34%).

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. O RESTO DA CONFIG — mesma regra, aplicada às outras cinco colunas
--
-- Regra do usuário: tudo que hoje está manual ou vazio tem que ser preenchido e
-- automatizado POR MARCA. `grade_horarios` (§2–§4) era só a coluna onde o
-- problema estourou. As outras estavam no mesmo estado, disfarçado: preenchidas
-- com o valor-padrão do spec, idêntico nas 5 marcas — 8 das 10 colunas eram o
-- mesmo número copiado. E `volume_maximo_semana` estava NULL nas 5, exatamente
-- como a grade, só que com fallback silencioso (baseline) em vez de tela vazia.
--
-- 9.1. v_config_derivada — o que marca_config DEVERIA ter, por marca
--
--   dias_ativos          dias com envio observado
--   janela_dias          span de fato_slot (MAX-MIN+1)
--   min_enviados_slot    p5 dos enviados por slot da marca (piso de ruído)
--   max_dias_com_3       p90 de dias/semana com 3+ ofertas
--   max_oferta_semana    p90 da repetição máxima de uma oferta na semana
--   volume_maximo_semana p90 dos enviados em semanas COMPLETAS (>= 6 dias)
--
--   Semana incompleta na borda da janela é descartada: uma semana de 2 dias vira
--   "a marca só manda 500k" e derruba qualquer teto semanal.
--
--   p90 e não MAX: MAX ratifica a pior semana como norma. p90 é "o que a marca
--   já demonstrou que consegue fazer", descartando o outlier.
--
-- 9.2. sp_deriva_config(p_marca) — aplica, com guardas que falham alto:
--      sem dia ativo, < 4 semanas completas, ou qualquer teto NULL/<=0 -> RAISE.
--      Registra antes/depois no job_log.
--
--   ORDEM NO ETL IMPORTA: sp_deriva_config ANTES de sp_deriva_grade_horarios.
--   A grade lê min_enviados_slot via v_horas_dow. Invertida, a grade de hoje sai
--   com o piso de ontem.
--
-- 9.3. O QUE MUDOU (antes -> depois):
--
--     marca      min_env         max_dias_com_3   max_oferta   volume_max_semana
--     apice      5000 -> 24.254   3 -> 0           2 -> 4       NULL -> 4.684.665
--     barbours   5000 -> 36.400   3 -> 3           2 -> 3       NULL -> 5.847.350
--     kokeshi    5000 -> 36.888   3 -> 4           2 -> 4       NULL -> 2.921.522
--     lescent    5000 -> 14.179   3 -> 3           2 -> 4       NULL -> 2.194.349
--     rituaria   5000 -> 41.879   3 -> 1           2 -> 3       NULL -> 3.672.015
--
--   ÁPICE NUNCA TEVE UM DIA COM 3 OFERTAS em 137 dias — e a config autorizava 3
--   dias por semana. Rituária: máximo observado 1, config dizia 3. O gate H3
--   (v_viabilidade, dias_3_ofertas = 0) provavelmente impedia na prática, mas o
--   teto declarado contradizia o histórico da marca e ninguém veria.
--
--   Efeito na grade: o piso de ruído agora filtra de fato (era inerte, §8.1).
--   8 horas saíram de 121; nenhuma entrou; todos os 7 dias de todas as marcas
--   mantiveram >= 2 horas (o mínimo para manhã+noite). Barbour's perdeu 18h na
--   Quarta. Calendário 25-30/08 revalidado: 16 slots, previsão +2,0%, idêntico
--   ao anterior exceto Qua 18h -> 19h.
--
-- 9.4. A ARMADILHA DO TETO — por que preencher a coluna quase inflou a previsão
--
--   `volume_maximo_semana` é teto (H4, "saúde da base"), mas o gerador usa esse
--   campo como o TOTAL que vai distribuir (defeito conhecido, calendarioDemo.ts
--   :392). Com a coluna NULL, caía no baseline de 4 semanas. Preenchida com p90,
--   o plano CRESCERIA até ele: Barbour's saltaria de 4,21M (ritmo real) para
--   5,85M — +39% de receita prevista sem nenhum ganho de modelagem, só porque um
--   NULL virou número.
--
--   Corrigido em calendarioContexto.ts: volumeSemana = MIN(baseline, teto).
--   Planeja no ritmo atual; o teto só morde se a marca estiver acima do próprio
--   p90 — que é o que H4 descreve. Verificado: Barbour's segue em 4.207.722.
--
-- 9.5. marca_oferta_familia — a única parte que NÃO dá para derivar
--
--   Hoje está 100% coberta (0 ofertas sem família nas 5 marcas), mas envelhece:
--   oferta nova aparece em fato_slot e fica órfã. Nenhuma análise infere que
--   "cupom10off" é da família Cupom — isso é semântica, não estatística.
--   O que dá para automatizar é a VIGILÂNCIA: v_oferta_sem_familia lista a fila
--   com dias, enviados e share de volume, e v_saude_marca/v_validacao alertam.
--
-- 9.6. v_saude_marca ganhou 3 checagens (além de C1/C2 da §5):
--   C3 config_incompleta  qualquer coluna operacional NULL
--   C4 config_divergente  preenchida, mas != v_config_derivada (padrão copiado)
--   C5 ofertas_sem_familia + share_sem_familia
--
-- 9.7. v_validacao — substitui o 03_validacao.sql
--
--   O 03 era one-shot, hardcoded em lescent, e cobria estrutura de bootstrap.
--   v_validacao é recorrente e por marca: 11 verificações x 5 marcas, uma linha
--   por (marca, verificacao), com severidade bloqueia|alerta.
--
--       SELECT * FROM `gogroup-crm.crm_modelo.v_validacao`
--       WHERE NOT ok AND severidade = 'bloqueia'
--
--   Estado atual: 55 checagens, 50 passam. As 5 que falham são a mesma —
--   indices_validos, nas 5 marcas, pelo Cloud Run que não existe (§6.3).
