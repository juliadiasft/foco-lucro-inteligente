CREATE TABLE IF NOT EXISTS trial_identity_claims (
  document_hash text PRIMARY KEY,
  document_type text NOT NULL CHECK (document_type IN ('cpf', 'cnpj')),
  document_last4 text NOT NULL CHECK (char_length(document_last4) = 4),
  company_id uuid UNIQUE REFERENCES companies(id) ON DELETE SET NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trial_identity_claims_company_idx
  ON trial_identity_claims(company_id);
