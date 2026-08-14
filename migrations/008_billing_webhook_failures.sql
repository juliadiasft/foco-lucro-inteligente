CREATE TABLE IF NOT EXISTS billing_webhook_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'cakto',
  event_type text NOT NULL,
  event_key text NOT NULL,
  reason text NOT NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  customer_email text,
  subscription_id text,
  offer_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_key, reason)
);

CREATE INDEX IF NOT EXISTS billing_webhook_failures_open_idx
  ON billing_webhook_failures(created_at DESC)
  WHERE resolved_at IS NULL;
