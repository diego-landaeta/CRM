-- ============================================================
-- 086 — project_integrations: credenciales por proyecto para Stripe / Brevo / etc.
--       Permite configurarlas desde el panel admin en lugar de .env, y guardar
--       el status del último test de conexión.
-- ============================================================
-- Secretos cifrados con AES-256-GCM (encrypted_value/iv/auth_tag).
-- Idempotente.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS project_integrations (
  id                  SERIAL PRIMARY KEY,
  project_id          INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider            VARCHAR(40) NOT NULL,                  -- 'stripe' | 'brevo' | ...
  active              BOOLEAN NOT NULL DEFAULT false,
  encrypted_value     TEXT,                                   -- cifrado AES-GCM hex
  iv                  TEXT,                                   -- IV AES-GCM hex
  auth_tag            TEXT,                                   -- tag AES-GCM hex
  config_public       JSONB NOT NULL DEFAULT '{}'::jsonb,     -- ajustes NO sensibles (from_email, etc)
  last_test_status    VARCHAR(20),                            -- 'success' | 'error' | NULL
  last_test_message   TEXT,
  last_test_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_proj_integrations_project ON project_integrations(project_id);

COMMENT ON TABLE project_integrations IS
  'Credenciales de integraciones externas (Stripe/Brevo/etc) por proyecto. Secretos cifrados AES-256-GCM.';
COMMENT ON COLUMN project_integrations.encrypted_value IS
  'Secreto principal cifrado (ej. API key Stripe, API key Brevo).';
COMMENT ON COLUMN project_integrations.config_public IS
  'Ajustes no sensibles: { from_email, from_name, webhook_url, test_mode, ... }';

GRANT ALL PRIVILEGES ON project_integrations TO crm_user;
GRANT USAGE, SELECT ON SEQUENCE project_integrations_id_seq TO crm_user;

COMMIT;
