-- Suspensao administrativa, separada da situacao da assinatura.
--
-- Reaproveitar subscription_status para suspender seria enganoso: o webhook
-- da Cakto sobrescreve aquele campo a cada evento, entao a suspensao sumiria
-- sozinha na renovacao seguinte. Um campo proprio sobrevive a isso.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS suspended_reason text;

CREATE INDEX IF NOT EXISTS companies_suspended_idx
  ON companies(suspended_at)
  WHERE suspended_at IS NOT NULL;
