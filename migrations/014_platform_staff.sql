-- Back office da plataforma.
--
-- Contas de equipe vivem numa tabela propria, com sessao propria, e NAO em
-- users. Um cargo novo dentro de users daria a qualquer cliente um caminho
-- possivel para virar administrador da plataforma. Separando as duas coisas,
-- esse caminho simplesmente nao existe.
CREATE TABLE IF NOT EXISTS staff_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'suporte',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE staff_users
  ADD CONSTRAINT staff_users_role_check
  CHECK (role IN ('admin', 'financeiro', 'suporte'));

CREATE TABLE IF NOT EXISTS staff_sessions (
  token_hash text PRIMARY KEY,
  staff_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

CREATE INDEX IF NOT EXISTS staff_sessions_staff_idx
  ON staff_sessions(staff_id, expires_at DESC);

-- Todo acesso a dado de cliente fica registrado: protege voce perante a LGPD
-- e protege voce em relacao a propria equipe.
CREATE TABLE IF NOT EXISTS staff_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  staff_email text,
  action text NOT NULL,
  target_company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_audit_log_date_idx
  ON staff_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS staff_audit_log_company_idx
  ON staff_audit_log(target_company_id, created_at DESC);
