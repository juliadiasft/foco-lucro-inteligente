import { createHash } from "node:crypto";

import { query } from "./db.server";

function keyHash(scope: string, value: string) {
  return createHash("sha256").update(`${scope}:${value}`).digest("hex");
}

export async function consumeRateLimit(
  scope: string,
  value: string,
  limit: number,
  windowSeconds: number,
) {
  const hash = keyHash(scope, value);
  const result = await query<{ attempts: number }>(
    `INSERT INTO request_rate_limits (key_hash,attempts,window_started_at)
     VALUES ($1,1,now())
     ON CONFLICT (key_hash) DO UPDATE SET
       attempts = CASE
         WHEN request_rate_limits.window_started_at < now() - make_interval(secs => $2::int)
           THEN 1
         ELSE request_rate_limits.attempts + 1
       END,
       window_started_at = CASE
         WHEN request_rate_limits.window_started_at < now() - make_interval(secs => $2::int)
           THEN now()
         ELSE request_rate_limits.window_started_at
       END
     RETURNING attempts`,
    [hash, windowSeconds],
  );
  return result.rows[0].attempts <= limit;
}

export async function clearRateLimit(scope: string, value: string) {
  await query("DELETE FROM request_rate_limits WHERE key_hash=$1", [keyHash(scope, value)]);
}
