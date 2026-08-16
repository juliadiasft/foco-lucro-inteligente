-- Quando o comerciante busca e nao encontra fornecedor, ele conta de quem
-- compra hoje. Isso tira o beco sem saida da tela e, do outro lado, vira a
-- lista de fornecedores que ja tem demanda comprovada na plataforma.
CREATE TABLE IF NOT EXISTS supplier_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_name text NOT NULL,
  -- Nome normalizado, para agrupar "Atacadao Pet" e "atacadão pet" no mesmo
  -- fornecedor na hora de contar a demanda.
  supplier_key text NOT NULL,
  city text,
  uf text,
  products text,
  -- O que o comerciante procurava quando nao achou nada.
  search_term text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Uma indicacao por fornecedor por empresa: contamos comerciantes
  -- distintos, nao quantas vezes a mesma pessoa insistiu.
  UNIQUE (company_id, supplier_key)
);

CREATE INDEX IF NOT EXISTS supplier_leads_key_idx ON supplier_leads(supplier_key);
CREATE INDEX IF NOT EXISTS supplier_leads_created_idx ON supplier_leads(created_at DESC);
