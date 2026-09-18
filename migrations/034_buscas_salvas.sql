-- "Avisar se aparecer um fornecedor dentro dos filtros" (X04).
-- Uma busca que voltou vazia pode ser guardada; quando um fornecedor publica
-- ou mexe na tabela e passa a caber nela, o comerciante recebe um aviso.
-- fornecedores_vistos evita avisar duas vezes do mesmo fornecedor.
CREATE TABLE IF NOT EXISTS buscas_salvas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  chave text NOT NULL,
  term text,
  only_my_segments boolean NOT NULL DEFAULT true,
  uf text,
  city text,
  max_delivery_days integer,
  category_id text,
  only_available boolean NOT NULL DEFAULT false,
  fornecedores_vistos uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, chave)
);

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'supplier_opportunity', 'stock_alert', 'system',
  'orcamento_novo', 'orcamento_respondido', 'pedido_novo', 'pedido_atualizado', 'proposta_aceita',
  'fornecedor_na_busca'
));
