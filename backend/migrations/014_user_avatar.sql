-- ============================================================
-- Migracion 014: Avatar de usuario (CRM-186)
-- Reusa el patron de logo de proyecto: disco local en /var/crm-uploads
-- ============================================================

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS avatar_key VARCHAR(500);

COMMENT ON COLUMN users.avatar_url IS 'Path publico del avatar (ej /api/users/:id/avatar?v=...)';
COMMENT ON COLUMN users.avatar_key IS 'Key interno en disco/R2 para servir/borrar';

COMMIT;
