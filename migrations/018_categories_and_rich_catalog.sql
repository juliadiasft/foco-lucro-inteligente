-- Categorias de produto, compartilhadas por toda a Central.
--
-- Nao sao por empresa de proposito: se cada fornecedor criasse as suas, o
-- filtro por categoria da busca nao casaria nada, que foi exatamente o
-- problema que o campo business_type de texto livre criou antes.
CREATE TABLE IF NOT EXISTS product_categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

INSERT INTO product_categories (id, name, sort_order) VALUES
  ('mercearia-seca', 'Mercearia seca', 10),
  ('bebidas', 'Bebidas', 20),
  ('carnes-frios', 'Carnes e frios', 30),
  ('hortifruti', 'Hortifruti', 40),
  ('padaria-confeitaria', 'Padaria e confeitaria', 50),
  ('congelados', 'Congelados', 60),
  ('limpeza', 'Limpeza', 70),
  ('higiene-beleza', 'Higiene e beleza', 80),
  ('pet', 'Produtos para pet', 90),
  ('medicamentos', 'Medicamentos e saúde', 100),
  ('papelaria', 'Papelaria', 110),
  ('utilidades', 'Utilidades domésticas', 120),
  ('embalagens', 'Embalagens e descartáveis', 130),
  ('construcao', 'Material de construção', 140),
  ('autopecas', 'Autopeças', 150),
  ('eletronicos', 'Eletrônicos', 160),
  ('vestuario', 'Vestuário e calçados', 170),
  ('outros', 'Outros', 999)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS category_id text REFERENCES product_categories(id) ON DELETE SET NULL;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_id text REFERENCES product_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS catalog_items_category_idx ON catalog_items(category_id);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(company_id, category_id);

-- Catalogo mais completo do fornecedor.
ALTER TABLE supplier_offerings ADD COLUMN IF NOT EXISTS sku text;
ALTER TABLE supplier_offerings ADD COLUMN IF NOT EXISTS promo_price numeric(12,2);
ALTER TABLE supplier_offerings ADD COLUMN IF NOT EXISTS promo_until date;
ALTER TABLE supplier_offerings ADD COLUMN IF NOT EXISTS stock numeric(12,3);
ALTER TABLE supplier_offerings
  ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'disponivel';

ALTER TABLE supplier_offerings
  ADD CONSTRAINT supplier_offerings_availability_check
  CHECK (availability IN ('disponivel', 'sob_encomenda', 'esgotado'));

ALTER TABLE supplier_offerings
  ADD CONSTRAINT supplier_offerings_promo_check
  CHECK (promo_price IS NULL OR promo_price >= 0);

-- Preco por faixa de quantidade: quanto mais o comerciante compra, menor o
-- preco unitario. E como o atacado realmente funciona.
CREATE TABLE IF NOT EXISTS offering_price_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL REFERENCES supplier_offerings(id) ON DELETE CASCADE,
  min_quantity numeric(12,3) NOT NULL,
  price numeric(12,2) NOT NULL,
  UNIQUE (offering_id, min_quantity)
);

ALTER TABLE offering_price_tiers
  ADD CONSTRAINT offering_price_tiers_values_check
  CHECK (min_quantity > 0 AND price >= 0);

CREATE INDEX IF NOT EXISTS offering_price_tiers_offering_idx
  ON offering_price_tiers(offering_id, min_quantity);

-- Condicoes comerciais da vitrine.
ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS payment_terms text;
ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS commercial_terms text;
