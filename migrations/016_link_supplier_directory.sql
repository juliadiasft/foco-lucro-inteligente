-- Ponte entre a agenda particular do comerciante e a conta do fornecedor na
-- Central.
--
-- A tabela suppliers sempre foi a agenda do comerciante: ele digitava nome,
-- contato e cotacoes de quem quisesse. Agora existem fornecedores com conta
-- propria na plataforma, e o comerciante nao deveria precisar redigitar nada
-- para trabalhar com eles. Este vinculo permite trazer o fornecedor da Central
-- para a agenda sem duplicar cadastro, mantendo intacto todo o recurso de
-- cotacao e comparacao que ja existia.
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS supplier_company_id uuid REFERENCES companies(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_company_link_idx
  ON suppliers(company_id, supplier_company_id)
  WHERE supplier_company_id IS NOT NULL;
