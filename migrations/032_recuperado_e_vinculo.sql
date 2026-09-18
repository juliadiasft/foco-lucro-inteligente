-- "Já recuperado" e "esse é o mesmo produto?".
--
-- economias_recuperadas: cada linha é uma compra concluída na Central em que o
-- comerciante pagou menos que o custo que tinha (digitado ou de compra
-- anterior) — valor = diferença por unidade x quantidade comprada. Estimativa
-- nunca entra como custo anterior: economia sobre número que a Central mesma
-- estimou seria inventar dinheiro. A chave (item do pedido, produto) impede
-- contar duas vezes se o pedido for concluído de novo.
--
-- vinculo_recusado: itens do catálogo que a pessoa disse "não é este" para o
-- produto, para a Central não perguntar a mesma coisa de novo.

CREATE TABLE IF NOT EXISTS economias_recuperadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
  quantidade_base numeric(14,3) NOT NULL,
  custo_anterior numeric(12,4) NOT NULL,
  custo_pago numeric(12,4) NOT NULL,
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_item_id, product_id)
);

CREATE INDEX IF NOT EXISTS economias_recuperadas_empresa_idx
  ON economias_recuperadas (company_id, criado_em DESC);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS vinculo_recusado uuid[] NOT NULL DEFAULT '{}';
