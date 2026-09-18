-- A central de avisos passa a guardar o que hoje só chegava como push:
-- orçamento novo/respondido e pedido novo/atualizado, dos dois lados.
-- A categoria (precisa de você / dinheiro na mesa / só para saber) é
-- derivada do tipo em src/lib/avisos.ts, então não ganha coluna.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'supplier_opportunity', 'stock_alert', 'system',
  'orcamento_novo', 'orcamento_respondido', 'pedido_novo', 'pedido_atualizado', 'proposta_aceita'
));
