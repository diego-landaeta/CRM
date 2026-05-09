-- ============================================================
-- 039: Documents — almacenamiento en R2 + auto-email
-- ============================================================

-- F4-003: R2 storage. r2_key es la ruta del PDF dentro del bucket
-- (e.g. "documents/1/FAC-2026-0193.pdf"). Cuando se llena, el download
-- devuelve URL pre-firmada en lugar de servir el archivo desde FS.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS r2_key VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_documents_r2_key ON documents(r2_key) WHERE r2_key IS NOT NULL;

-- F4-009: Auto-email. Por proyecto se decide si al generar factura/cert
-- se envia automaticamente al cliente/alumno (con el PDF adjunto).
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS auto_email_documents BOOLEAN NOT NULL DEFAULT false;
