-- Orcamento, proposta e contraproposta.
--
-- Ate aqui o comerciante so conseguia comprar pelo preco de tabela. No
-- comercio entre empresas o normal e o contrario: pede-se cotacao, o
-- fornecedor propoe condicao, negocia-se, e so entao vira pedido. E tambem o
-- unico caminho para os itens marcados como "sob consulta".
CREATE TABLE IF NOT EXISTS quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'aberto',
  note text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quote_requests
  ADD CONSTRAINT quote_requests_status_check
  CHECK (status IN ('aberto', 'respondido', 'negociando', 'aceito', 'recusado', 'cancelado'));

CREATE INDEX IF NOT EXISTS quote_requests_merchant_idx
  ON quote_requests(merchant_company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS quote_requests_supplier_idx
  ON quote_requests(supplier_company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS quote_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id uuid NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  offering_id uuid REFERENCES supplier_offerings(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  brand text,
  base_unit text NOT NULL,
  pack_size numeric(12,3),
  quantity numeric(12,3) NOT NULL
);

ALTER TABLE quote_request_items
  ADD CONSTRAINT quote_request_items_quantity_check CHECK (quantity > 0);

CREATE INDEX IF NOT EXISTS quote_request_items_request_idx
  ON quote_request_items(quote_request_id);

-- Cada rodada da negociacao vira uma linha. O historico completo fica
-- preservado: quem propos o que, quando, e por qual valor.
CREATE TABLE IF NOT EXISTS quote_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id uuid NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  from_company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind text NOT NULL,
  total numeric(12,2) NOT NULL DEFAULT 0,
  delivery_days integer,
  payment_terms text,
  note text,
  status text NOT NULL DEFAULT 'enviada',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quote_proposals
  ADD CONSTRAINT quote_proposals_kind_check CHECK (kind IN ('proposta', 'contraproposta'));

ALTER TABLE quote_proposals
  ADD CONSTRAINT quote_proposals_status_check
  CHECK (status IN ('enviada', 'aceita', 'recusada', 'superada'));

CREATE INDEX IF NOT EXISTS quote_proposals_request_idx
  ON quote_proposals(quote_request_id, created_at);

CREATE TABLE IF NOT EXISTS quote_proposal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES quote_proposals(id) ON DELETE CASCADE,
  request_item_id uuid REFERENCES quote_request_items(id) ON DELETE SET NULL,
  offering_id uuid REFERENCES supplier_offerings(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  base_unit text NOT NULL,
  pack_size numeric(12,3) NOT NULL,
  quantity numeric(12,3) NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  subtotal numeric(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS quote_proposal_items_proposal_idx
  ON quote_proposal_items(proposal_id);

-- Liga o pedido a proposta que o originou, para o historico completo da
-- negociacao continuar acessivel depois de fechado.
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS quote_proposal_id uuid REFERENCES quote_proposals(id) ON DELETE SET NULL;
