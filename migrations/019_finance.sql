-- Contas a pagar e a receber.
--
-- Uma tabela so, com a direcao indicada. Quando um pedido e aceito, sao
-- criadas DUAS linhas: uma a pagar para o comerciante e uma a receber para o
-- fornecedor. Cada lado controla a sua, porque na pratica os dois nem sempre
-- concordam sobre o que ja foi pago e quando.
CREATE TABLE IF NOT EXISTS finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  counterparty_company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  counterparty_name text,
  order_id uuid REFERENCES purchase_orders(id) ON DELETE SET NULL,
  direction text NOT NULL,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL,
  due_date date,
  paid_at timestamptz,
  paid_amount numeric(12,2),
  note text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE finance_entries
  ADD CONSTRAINT finance_entries_direction_check CHECK (direction IN ('pagar', 'receber'));

ALTER TABLE finance_entries
  ADD CONSTRAINT finance_entries_amount_check CHECK (amount >= 0);

-- Evita duplicar a conta se o mesmo pedido passar por aceito mais de uma vez.
CREATE UNIQUE INDEX IF NOT EXISTS finance_entries_order_idx
  ON finance_entries(order_id, company_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS finance_entries_company_idx
  ON finance_entries(company_id, direction, due_date);

CREATE INDEX IF NOT EXISTS finance_entries_abertas_idx
  ON finance_entries(company_id, due_date)
  WHERE paid_at IS NULL;
