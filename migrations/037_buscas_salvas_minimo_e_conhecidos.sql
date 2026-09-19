-- Dois filtros novos do Onde comprar (N08) também valem para o "avisar":
-- pedido mínimo máximo do fornecedor e "só quem já comprei".
ALTER TABLE buscas_salvas ADD COLUMN IF NOT EXISTS max_minimum_order numeric(12,2);
ALTER TABLE buscas_salvas ADD COLUMN IF NOT EXISTS only_known boolean NOT NULL DEFAULT false;
