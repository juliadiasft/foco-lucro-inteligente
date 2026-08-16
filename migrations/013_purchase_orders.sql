-- Pedido feito dentro da Central, depois de comparar e conversar.
-- O pagamento acontece fora da plataforma: processar dinheiro entre
-- comerciante e fornecedor transformaria a Central em marketplace
-- financeiro, outra categoria regulatoria, e a Cakto esta configurada para
-- assinatura e nao para repasse entre terceiros.
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'enviado',
  total numeric(12,2) NOT NULL DEFAULT 0,
  note text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_status_check
  CHECK (status IN ('enviado', 'aceito', 'recusado', 'concluido', 'cancelado'));

CREATE INDEX IF NOT EXISTS purchase_orders_merchant_idx
  ON purchase_orders(merchant_company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS purchase_orders_supplier_idx
  ON purchase_orders(supplier_company_id, created_at DESC);

-- Os dados do item sao copiados no momento do pedido. Se o fornecedor mudar
-- o preco ou o nome depois, o pedido continua registrando o que foi
-- combinado.
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  offering_id uuid REFERENCES supplier_offerings(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  brand text,
  base_unit text NOT NULL,
  pack_size numeric(12,3) NOT NULL,
  quantity numeric(12,3) NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  subtotal numeric(12,2) NOT NULL
);

ALTER TABLE purchase_order_items
  ADD CONSTRAINT purchase_order_items_quantity_check CHECK (quantity > 0);

CREATE INDEX IF NOT EXISTS purchase_order_items_order_idx
  ON purchase_order_items(order_id);
