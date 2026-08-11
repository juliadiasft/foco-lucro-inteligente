ALTER TABLE subscriptions
  ALTER COLUMN provider SET DEFAULT 'cakto';

UPDATE subscriptions
SET provider = 'cakto', updated_at = now()
WHERE status = 'trialing' AND subscription_id IS NULL;

CREATE TABLE IF NOT EXISTS checkout_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  plan text NOT NULL CHECK (plan IN ('essencial', 'profissional', 'premium')),
  offer_id text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  event_key text PRIMARY KEY,
  provider text NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checkout_intents_company_idx
  ON checkout_intents(company_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS checkout_intents_expiry_idx
  ON checkout_intents(expires_at);

CREATE INDEX IF NOT EXISTS billing_webhook_events_date_idx
  ON billing_webhook_events(processed_at DESC);
