-- Custo do produto que vem sozinho, com a origem dita.
--
-- Ate aqui o custo era so o que a pessoa digitava (`cost_price`), e o Painel
-- so comparava com a Central quando esse campo estava preenchido. Agora o
-- custo pode vir de duas fontes automaticas:
--   'real'     = preco pago numa compra concluida dentro da Central
--   'estimado' = mediana das tabelas publicadas pelos fornecedores
-- e a origem fica gravada, para a tela nunca mostrar estimativa como fato.
--
-- `catalog_item_id` e o vinculo produto -> item do catalogo. Ele ja existia
-- na pratica (o Painel casava pelo nome normalizado a cada consulta); agora
-- fica gravado, para uma compra saber qual produto do comerciante atualizar.
--
-- `cost_suggested` guarda o custo automatico que divergiu mais de 5% do que a
-- pessoa digitou. Automatico nunca sobrescreve digitado em silencio: fica
-- esperando um toque. `cost_dismissed` lembra o valor recusado para nao
-- perguntar a mesma coisa de novo.
--
-- Produtos que ja existem ficam 'digitado', que e o que de fato sao.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES catalog_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_source text NOT NULL DEFAULT 'digitado',
  ADD COLUMN IF NOT EXISTS cost_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS cost_suggested numeric(12,2),
  ADD COLUMN IF NOT EXISTS cost_suggested_source text,
  ADD COLUMN IF NOT EXISTS cost_dismissed numeric(12,2);

ALTER TABLE products
  ADD CONSTRAINT products_cost_source_check
  CHECK (cost_source IN ('digitado', 'estimado', 'real'));

ALTER TABLE products
  ADD CONSTRAINT products_cost_suggested_source_check
  CHECK (cost_suggested_source IS NULL OR cost_suggested_source IN ('estimado', 'real'));

CREATE INDEX IF NOT EXISTS products_catalog_item_idx
  ON products(catalog_item_id) WHERE catalog_item_id IS NOT NULL;
