-- Vitrine pública do fornecedor. Só aparece na busca quando ele publicar.
CREATE TABLE IF NOT EXISTS supplier_profiles (
  company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  description text,
  delivery_days integer CHECK (delivery_days IS NULL OR delivery_days >= 0),
  minimum_order numeric(12,2) CHECK (minimum_order IS NULL OR minimum_order >= 0),
  public_phone text,
  public_email text,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplier_profiles_published_idx
  ON supplier_profiles(published);

-- Identidade canônica do produto. Sem ela não existe comparação honesta:
-- "Ração Golden 15kg por R$ 180" e "Ração Golden 3kg por R$ 42" só podem ser
-- comparados depois de reduzir os dois ao preço por quilo.
--
-- O catálogo se constrói sozinho: quando um fornecedor cadastra um item que
-- ainda não existe, ele entra aqui e passa a servir de referência para os
-- próximos. A chave de busca é o nome sem acento, sem pontuação e em
-- minúsculas, para que grafias diferentes caiam no mesmo item.
CREATE TABLE IF NOT EXISTS catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text,
  base_unit text NOT NULL,
  search_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE catalog_items
  ADD CONSTRAINT catalog_items_base_unit_check
  CHECK (base_unit IN ('kg', 'l', 'un'));

CREATE UNIQUE INDEX IF NOT EXISTS catalog_items_key_idx
  ON catalog_items(search_key, base_unit);

-- O que cada fornecedor oferece. O preço é opcional: muitos fornecedores não
-- publicam tabela, e nesse caso o item aparece como "sob consulta".
CREATE TABLE IF NOT EXISTS supplier_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL REFERENCES catalog_items(id) ON DELETE RESTRICT,
  description text,
  pack_size numeric(12,3) NOT NULL,
  price numeric(12,2),
  minimum_quantity numeric(12,3) NOT NULL DEFAULT 1,
  delivery_days integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE supplier_offerings
  ADD CONSTRAINT supplier_offerings_pack_size_check CHECK (pack_size > 0);

ALTER TABLE supplier_offerings
  ADD CONSTRAINT supplier_offerings_price_check CHECK (price IS NULL OR price >= 0);

ALTER TABLE supplier_offerings
  ADD CONSTRAINT supplier_offerings_minimum_check CHECK (minimum_quantity > 0);

ALTER TABLE supplier_offerings
  ADD CONSTRAINT supplier_offerings_unique_item UNIQUE (company_id, catalog_item_id, pack_size);

CREATE INDEX IF NOT EXISTS supplier_offerings_company_idx
  ON supplier_offerings(company_id, active);

-- Índice da comparação: por item, ordenado pelo preço por unidade base.
CREATE INDEX IF NOT EXISTS supplier_offerings_item_price_idx
  ON supplier_offerings(catalog_item_id, active, price);
