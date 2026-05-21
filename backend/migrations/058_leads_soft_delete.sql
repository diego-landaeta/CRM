-- ============================================================
-- Migración 058: soft delete de leads + auditoría
-- ============================================================
-- Superadmin puede marcar leads como eliminados con motivo (spam, test, otro).
-- Si el mismo email vuelve a escribir, el webhook detecta que ya fue marcado
-- como spam y crea el nuevo lead ya con flag spam (para que se filtre directo).
-- Los leads eliminados quedan en DB para auditoría — no se purgan.
-- ============================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_reason VARCHAR(50);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_motivo TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN leads.deleted_at IS 'Fecha de soft-delete. NULL = lead activo. Set => se excluye de listas/stats.';
COMMENT ON COLUMN leads.deleted_reason IS 'Categoria del borrado: spam, test, duplicado_manual, otro.';
COMMENT ON COLUMN leads.deleted_motivo IS 'Motivo libre escrito por el superadmin.';
COMMENT ON COLUMN leads.deleted_by IS 'Quien lo marco como eliminado.';

-- Index parcial: la mayoria de consultas piden los activos
CREATE INDEX IF NOT EXISTS idx_leads_active
  ON leads(project_id, created_at DESC) WHERE deleted_at IS NULL;

-- Para deteccion rapida de spam recurrente por email
CREATE INDEX IF NOT EXISTS idx_leads_deleted_email
  ON leads(project_id, email) WHERE deleted_at IS NOT NULL AND deleted_reason = 'spam';
