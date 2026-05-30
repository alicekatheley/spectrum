ALTER TABLE pautas_geradas
  ADD COLUMN IF NOT EXISTS tipo_geracao text NOT NULL DEFAULT 'texto_imagem'
  CHECK (tipo_geracao IN ('texto', 'imagem', 'texto_imagem'));
