-- A Central passa a ter dois lados: quem compra (comerciante) e quem fornece
-- (fornecedor). O nicho é o que aproxima os dois. Os dois tipos assinam,
-- fazem o teste de 7 dias e respondem à mesma trava de CPF/CNPJ.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'comerciante';

ALTER TABLE companies ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS uf text;

-- Sem blocos DO $$ ... $$: o executor de múltiplas instruções do banco
-- embutido usado em desenvolvimento quebra o bloco nos pontos-e-vírgulas
-- internos. Cada migração roda uma única vez, controlada por app_migrations,
-- então ALTER TABLE direto é seguro.
ALTER TABLE companies
  ADD CONSTRAINT companies_account_type_check
  CHECK (account_type IN ('comerciante', 'fornecedor'));

ALTER TABLE companies
  ADD CONSTRAINT companies_uf_check
  CHECK (uf IS NULL OR char_length(uf) = 2);

CREATE INDEX IF NOT EXISTS companies_account_type_idx ON companies(account_type);

-- Cidade e estado servem para ORDENAR e FILTRAR a busca, nunca para excluir
-- um fornecedor. Quem estiver longe continua aparecendo; o comerciante decide
-- se a distância compensa.
CREATE INDEX IF NOT EXISTS companies_location_idx ON companies(uf, city);

-- Lista controlada. O campo business_type era texto livre: "pet shop",
-- "petshop" e "Pet Shop" viravam três coisas diferentes e nada casava.
CREATE TABLE IF NOT EXISTS segments (
  id text PRIMARY KEY,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

INSERT INTO segments (id, name, sort_order) VALUES
  ('mercearia', 'Mercearia e mercadinho', 10),
  ('mercado', 'Supermercado', 20),
  ('hortifruti', 'Hortifruti', 30),
  ('acougue', 'Açougue', 40),
  ('padaria', 'Padaria e confeitaria', 50),
  ('lanchonete', 'Lanchonete e restaurante', 60),
  ('bar', 'Bar e conveniência', 70),
  ('distribuidora', 'Distribuidora de bebidas', 80),
  ('pet', 'Pet shop', 90),
  ('farmacia', 'Farmácia e drogaria', 100),
  ('cosmeticos', 'Cosméticos e perfumaria', 110),
  ('roupas', 'Loja de roupas', 120),
  ('calcados', 'Calçados', 130),
  ('papelaria', 'Papelaria', 140),
  ('utilidades', 'Utilidades e bazar', 150),
  ('construcao', 'Material de construção', 160),
  ('autopecas', 'Autopeças', 170),
  ('eletronicos', 'Eletrônicos e celulares', 180),
  ('outro', 'Outro', 999)
ON CONFLICT (id) DO NOTHING;

-- Serve aos dois lados: o comerciante marca o nicho em que atua, o fornecedor
-- marca os nichos que atende.
CREATE TABLE IF NOT EXISTS company_segments (
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  segment_id text NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, segment_id)
);

CREATE INDEX IF NOT EXISTS company_segments_segment_idx
  ON company_segments(segment_id, company_id);
