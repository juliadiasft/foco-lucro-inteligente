-- Foto diária do índice de saúde do lucro (M01). Serve só para dizer "+6 no
-- mês": o número de hoje sempre é recalculado; a foto é o de antes.
-- Gravada quando a pessoa abre o Painel (no máximo uma por dia), não por job.
CREATE TABLE IF NOT EXISTS indice_saude (
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  data date NOT NULL,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  comp_margem numeric(5,4),
  comp_custo numeric(5,4),
  comp_giro numeric(5,4),
  PRIMARY KEY (company_id, data)
);
