CREATE TABLE pautas_geradas (
  id text PRIMARY KEY,
  marca text NOT NULL CHECK (marca IN ('Apice', 'Barbours')),
  modo text NOT NULL CHECK (modo IN ('A', 'B')),
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'aprovado', 'descartado')),
  data_criacao timestamptz NOT NULL,
  copy jsonb NOT NULL DEFAULT '{}',
  visual jsonb NOT NULL DEFAULT '{}',
  operacional jsonb NOT NULL DEFAULT '{}',
  previsao jsonb NOT NULL DEFAULT '{}',
  riscos jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pautas_geradas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_pautas" ON pautas_geradas USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER pautas_geradas_updated_at
  BEFORE UPDATE ON pautas_geradas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
