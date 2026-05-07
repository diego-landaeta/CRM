-- ============================================================
-- Migración 045: color primario por proyecto (CRM-191)
-- Permite a admin/superadmin definir el color de marca del proyecto.
-- ProjectContext en el frontend lo aplica a las CSS vars --primary y --ring
-- al activarse el proyecto.
-- ============================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS theme_color VARCHAR(7);

-- Forma esperada: hex de 7 chars (ej. "#3b82f6"). NULL = usa el default de
-- index.css. Frontend convierte hex → HSL en runtime para inyectar la var.
