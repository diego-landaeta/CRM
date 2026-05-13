-- ============================================================
-- Migración 055: email del lead pasa a ser NULLABLE
-- ============================================================
-- Caso de uso: lead que llega por WhatsApp con teléfono pero sin email.
-- El registro manual ya no obliga a poner email si hay teléfono (y viceversa).
-- ============================================================

ALTER TABLE leads ALTER COLUMN email DROP NOT NULL;
COMMENT ON COLUMN leads.email IS 'Email del lead. Puede ser NULL si el lead solo dejó teléfono.';
