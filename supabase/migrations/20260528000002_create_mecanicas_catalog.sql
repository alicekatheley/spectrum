CREATE TABLE mecanicas_catalog (
  id SERIAL PRIMARY KEY,
  nome TEXT UNIQUE NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'manipulacao',
  criado_por TEXT NOT NULL DEFAULT 'sistema',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mecanicas_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_read_mecanicas"  ON mecanicas_catalog FOR SELECT USING (true);
CREATE POLICY "allow_insert_mecanicas" ON mecanicas_catalog FOR INSERT WITH CHECK (true);

-- Seed: mecânicas clássicas das duas marcas
INSERT INTO mecanicas_catalog (nome, categoria, criado_por) VALUES
  ('Abra o presente',  'abertura',     'sistema'),
  ('Abra a caixa',     'abertura',     'sistema'),
  ('Abra a carta',     'abertura',     'sistema'),
  ('Puxe o Adesivo',   'manipulacao',  'sistema'),
  ('Corte o fio',      'manipulacao',  'sistema'),
  ('Jogo da Velha',    'interativo',   'sistema'),
  ('Rasgue o papel',   'manipulacao',  'sistema'),
  ('Puxe o post-it',   'manipulacao',  'sistema'),
  ('Estoure o balão',  'interativo',   'sistema'),
  ('Puxe o cupom',     'manipulacao',  'sistema')
ON CONFLICT (nome) DO NOTHING;
