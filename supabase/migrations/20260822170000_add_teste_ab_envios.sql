-- Um teste A/B aprovado (comparação Variante A x Variante B) hoje só guardava UM envio pra
-- Insider (colunas singulares em teste_ab_propostas) — isso travava a mesma comparação a uma
-- única marca de destino: depois de enviada pra Ápice, por exemplo, sumia a opção de também
-- mandar pra Barbours/Gocase/etc. Passa a existir 1 linha por (proposta, marca de destino),
-- permitindo reenviar a mesma comparação pra quantas contas Insider fizer sentido.
CREATE TABLE IF NOT EXISTS teste_ab_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id UUID NOT NULL REFERENCES teste_ab_propostas(id) ON DELETE CASCADE,
  marca TEXT NOT NULL CHECK (marca = ANY (ARRAY['Apice','Barbours','Rituaria','Lescent','Kokeshi','Gocase'])),
  insider_campaign_id TEXT NOT NULL,
  variante_a_gif_url TEXT,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proposta_id, marca)
);

ALTER TABLE teste_ab_envios ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all_teste_ab_envios ON teste_ab_envios FOR ALL TO public USING (true) WITH CHECK (true);

-- Preserva os envios já feitos (colunas singulares antigas) como a primeira linha de cada uma.
INSERT INTO teste_ab_envios (proposta_id, marca, insider_campaign_id, variante_a_gif_url, enviado_em)
SELECT id, insider_destino_marca, insider_campaign_id, variante_a_gif_url, enviado_insider_em
FROM teste_ab_propostas
WHERE insider_campaign_id IS NOT NULL AND insider_destino_marca IS NOT NULL
ON CONFLICT (proposta_id, marca) DO NOTHING;
