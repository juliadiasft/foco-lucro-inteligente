-- Filtros dos orçamentos que chegam ao fornecedor (S06). Uma linha por
-- fornecedor. O filtro esconde o pedido da lista e do aviso, mas ele continua
-- contando na taxa de resposta.
CREATE TABLE IF NOT EXISTS filtros_de_orcamento (
  company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  valor_minimo numeric(12,2),
  alcance text NOT NULL DEFAULT 'todos' CHECK (alcance IN ('todos', 'uf', 'cidade')),
  segmentos text[] NOT NULL DEFAULT '{}',
  so_com_estoque boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
