-- ============================================================
-- Migración 044: etiquetas custom del sidebar por proyecto (CRM-217)
-- Permite a superadmin renombrar items del sidebar para un proyecto
-- (ej. "Prospectos" -> "Estudiantes" en Psiko Aprende). Si no hay
-- override la UI usa el label por defecto del NAV_SECTIONS.
-- ============================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS sidebar_labels JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Forma del JSON: { "<label_original>": "<label_override>", ... }
-- Ejemplo: { "Prospectos": "Estudiantes", "Clientes": "Alumnos" }
