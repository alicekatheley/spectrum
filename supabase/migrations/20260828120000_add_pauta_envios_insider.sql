-- Enviar uma pauta (GIF do card no histórico) direto pra Insider como campanha única — sem
-- comparação A/B, é só o conteúdo dessa pauta. Diferente de teste_ab_envios (que amarra o
-- envio a uma proposta de teste A/B), aqui o envio é amarrado à própria pauta. Uma linha por
-- (pauta, marca de destino) — a mesma pauta pode virar campanha em quantas contas Insider
-- fizer sentido, já que o conteúdo do agente não é preso a uma marca específica.
CREATE TABLE IF NOT EXISTS pauta_envios_insider (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pauta_id TEXT NOT NULL REFERENCES pautas_geradas(id) ON DELETE CASCADE,
  marca TEXT NOT NULL CHECK (marca = ANY (ARRAY['Apice','Barbours','Rituaria','Lescent','Kokeshi','Gocase'])),
  insider_campaign_id TEXT NOT NULL,
  gif_url TEXT,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pauta_id, marca)
);

ALTER TABLE pauta_envios_insider ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all_pauta_envios_insider ON pauta_envios_insider FOR ALL TO public USING (true) WITH CHECK (true);
