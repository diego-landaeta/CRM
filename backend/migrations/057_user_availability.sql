-- ============================================================
-- Migración 057: disponibilidad de gestores
-- ============================================================
-- Toggle inmediato (is_available) + bloques programados (vacaciones, ausencias)
-- Round-robin salta gestores no disponibles y los que tengan bloque activo hoy.
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS unavailable_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS unavailable_since TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN users.is_available IS 'Toggle on/off para round-robin. false = no recibe nuevos leads aunque siga activo.';
COMMENT ON COLUMN users.unavailable_reason IS 'Motivo libre (ej: "enfermo", "vacaciones", "formación").';
COMMENT ON COLUMN users.unavailable_since IS 'Cuándo se marcó como no disponible (para auditoría).';

CREATE TABLE IF NOT EXISTS user_availability_blocks (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE NOT NULL,
  motivo          TEXT,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_user_availability_blocks_user_dates
  ON user_availability_blocks(user_id, fecha_inicio, fecha_fin);

COMMENT ON TABLE user_availability_blocks IS 'Bloques programados de ausencia (vacaciones, formación, baja). El round-robin los salta cuando CURRENT_DATE está dentro del rango.';

-- Idempotency para webhook: si Make reintenta, no duplicamos.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(200);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_idempotency_key
  ON leads(project_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
COMMENT ON COLUMN leads.idempotency_key IS 'Clave única por proyecto que Make/integraciones envían para evitar duplicados en reintentos.';
