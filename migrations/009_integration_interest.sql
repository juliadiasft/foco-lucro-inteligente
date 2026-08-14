CREATE TABLE IF NOT EXISTS integration_interest (
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider text NOT NULL,
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, provider)
);

-- Permite medir a demanda por integração antes de escolher qual construir.
CREATE INDEX IF NOT EXISTS integration_interest_provider_idx
  ON integration_interest(provider, created_at DESC);
