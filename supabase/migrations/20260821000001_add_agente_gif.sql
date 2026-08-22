-- Agente de GIF auto-gerador: novo modo 'C' de pauta, frames pré-gerados,
-- tabela de propostas de teste A/B, e RPC de leitura do feedback (crm_ai.ia_outputs
-- não tem policy de SELECT pra role anon, só INSERT — precisa de RPC SECURITY DEFINER).

ALTER TABLE pautas_geradas DROP CONSTRAINT IF EXISTS pautas_geradas_modo_check;
ALTER TABLE pautas_geradas ADD CONSTRAINT pautas_geradas_modo_check CHECK (modo = ANY (ARRAY['A'::text, 'B'::text, 'C'::text]));

ALTER TABLE pautas_geradas ADD COLUMN IF NOT EXISTS frame_urls JSONB;

CREATE TABLE IF NOT EXISTS teste_ab_propostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marca TEXT NOT NULL CHECK (marca = ANY (ARRAY['Apice'::text, 'Barbours'::text])),
  pauta_id TEXT NOT NULL REFERENCES pautas_geradas(id),
  variante_b_conteudo_id UUID REFERENCES conteudos_links(id),
  racional TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status = ANY (ARRAY['pendente'::text, 'aceito'::text, 'rejeitado'::text])),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE teste_ab_propostas ADD COLUMN IF NOT EXISTS conteudos_rejeitados UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE teste_ab_propostas ADD COLUMN IF NOT EXISTS insider_campaign_id TEXT;
ALTER TABLE teste_ab_propostas ADD COLUMN IF NOT EXISTS enviado_insider_em TIMESTAMPTZ;
ALTER TABLE teste_ab_propostas ADD COLUMN IF NOT EXISTS variante_a_gif_url TEXT;
ALTER TABLE teste_ab_propostas ADD COLUMN IF NOT EXISTS insider_destino_marca TEXT;

ALTER TABLE teste_ab_propostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_all_teste_ab_propostas ON teste_ab_propostas;
CREATE POLICY allow_all_teste_ab_propostas ON teste_ab_propostas FOR ALL TO public USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.crm_ai_get_conceito_feedback(limit_n integer DEFAULT 20)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT COALESCE(json_agg(row_to_json(f)), '[]'::json)
  FROM (
    SELECT output_id, aprovado, feedback_usuario, recomendacao_estruturada, fontes_referenciadas, created_at
    FROM crm_ai.ia_outputs
    WHERE tipo_canal = 'conceito' AND aprovado IS NOT NULL
    ORDER BY created_at DESC
    LIMIT limit_n
  ) f;
$function$;

-- PostgREST só expõe os schemas public/graphql_public (nem com Content-Profile dá pra
-- escrever direto em crm_ai.ia_outputs via REST) — toda escrita precisa passar por RPC
-- SECURITY DEFINER. crm_ai_insert_ia_output (já existente) não tem aprovado/feedback_usuario/
-- recomendacao_estruturada; esta v2 cobre os campos que approve-pauta e feedback-agente-gif usam.
CREATE OR REPLACE FUNCTION public.crm_ai_insert_ia_output_v2(
  p_marca_id bigint,
  p_tipo_canal text,
  p_analisado text,
  p_fontes jsonb DEFAULT NULL,
  p_modelo text DEFAULT NULL,
  p_parametros jsonb DEFAULT NULL,
  p_recomendacao_texto text DEFAULT NULL,
  p_recomendacao_estruturada jsonb DEFAULT NULL,
  p_imagens jsonb DEFAULT NULL,
  p_aprovado boolean DEFAULT NULL,
  p_feedback_usuario text DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $function$
  INSERT INTO crm_ai.ia_outputs
    (marca_id, tipo_canal, o_que_foi_analisado, fontes_referenciadas, modelo, parametros,
     recomendacao_texto, recomendacao_estruturada, imagens_geradas, aprovado, feedback_usuario)
  VALUES
    (p_marca_id, p_tipo_canal, p_analisado, p_fontes, p_modelo, p_parametros,
     p_recomendacao_texto, p_recomendacao_estruturada, p_imagens, p_aprovado, p_feedback_usuario)
  RETURNING output_id;
$function$;
