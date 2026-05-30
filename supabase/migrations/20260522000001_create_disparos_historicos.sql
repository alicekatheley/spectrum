CREATE TABLE disparos_historicos (
  id text PRIMARY KEY,
  marca text NOT NULL CHECK (marca IN ('Apice', 'Barbours')),
  mecanica text NOT NULL,
  disparos integer NOT NULL DEFAULT 0,
  receita_media numeric NOT NULL DEFAULT 0,
  performance text NOT NULL,
  contextos_recomendados text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE disparos_historicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_read_disparos" ON disparos_historicos FOR SELECT USING (true);
