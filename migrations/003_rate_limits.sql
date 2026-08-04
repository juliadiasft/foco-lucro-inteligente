CREATE TABLE IF NOT EXISTS request_rate_limits (
  key_hash text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS request_rate_limits_window_idx
  ON request_rate_limits(window_started_at);
