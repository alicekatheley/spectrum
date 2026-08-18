ALTER TABLE conteudos_links ADD COLUMN IF NOT EXISTS mecanica_texto TEXT;
ALTER TABLE conteudos_links ADD COLUMN IF NOT EXISTS frames JSONB DEFAULT '[]'::jsonb;
ALTER TABLE conteudos_links ADD COLUMN IF NOT EXISTS composicao_texto TEXT;
ALTER TABLE conteudos_links ADD COLUMN IF NOT EXISTS tipo_midia TEXT CHECK (tipo_midia = ANY (ARRAY['gif'::text, 'estatica'::text]));
ALTER TABLE conteudos_links ADD COLUMN IF NOT EXISTS status_analise TEXT DEFAULT 'pendente' CHECK (status_analise = ANY (ARRAY['pendente'::text, 'aprovado'::text, 'descartado'::text]));
ALTER TABLE conteudos_links ADD COLUMN IF NOT EXISTS analisado_em TIMESTAMPTZ;
