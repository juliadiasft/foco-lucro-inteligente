ALTER TABLE companies
  ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval '7 days');

UPDATE companies
SET trial_ends_at = LEAST(trial_ends_at, created_at + interval '7 days'),
    updated_at = now()
WHERE subscription_status = 'trialing'
  AND trial_ends_at > created_at + interval '7 days';

