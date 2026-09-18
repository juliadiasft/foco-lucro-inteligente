-- Stripe ao lado da Cakto, e a moeda da assinatura.
--
-- `provider` ja existia em subscriptions ('cakto' por padrao). Quem assina pela
-- Stripe passa a ter 'stripe' ali, e a Cakto continua valendo para quem ja paga
-- por ela: nao ha migracao de cliente, so de quem assina daqui em diante.
--
-- A moeda fica na assinatura porque o mesmo plano custa valores diferentes em
-- cada uma, e a tela precisa dizer o que de fato sera cobrado.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL';
