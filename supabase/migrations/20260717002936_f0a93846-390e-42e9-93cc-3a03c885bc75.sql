
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS meta_faturamento_mensal numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ticket_medio_esperado numeric(12,2) NOT NULL DEFAULT 0;
