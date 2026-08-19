-- Cobranca anual, alem da mensal. O preco anual equivale a dez meses: dois
-- meses de bonus para quem paga a frente.
--
-- Guardar o ciclo e necessario porque o mesmo plano passa a ter duas ofertas
-- na Cakto, e sem isso o webhook nao consegue distinguir uma renovacao mensal
-- de uma anual — nem a tela sabe quando avisar o cliente do proximo débito.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'mensal';

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_billing_cycle_check
  CHECK (billing_cycle IN ('mensal', 'anual'));

ALTER TABLE checkout_intents
  ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'mensal';

ALTER TABLE checkout_intents
  ADD CONSTRAINT checkout_intents_billing_cycle_check
  CHECK (billing_cycle IN ('mensal', 'anual'));
