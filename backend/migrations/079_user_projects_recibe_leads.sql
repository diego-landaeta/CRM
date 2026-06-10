-- Opt-in per-project para que admins reciban leads del round-robin.
-- Antes los admins recibían leads en TODOS los proyectos a los que pertenecían
-- (cambio de la sesión previa), pero eso es demasiado agresivo: en ICTESS/ISEIE
-- no queremos que el admin entre al reparto. Ahora es opt-in.
--
-- Reglas de negocio:
--   gestor → siempre entra al round-robin (no depende de esta flag)
--   admin / superadmin → solo si user_projects.recibe_leads = TRUE para ESE proyecto
ALTER TABLE user_projects
  ADD COLUMN IF NOT EXISTS recibe_leads BOOLEAN NOT NULL DEFAULT FALSE;

-- Caso especial: Eugenia (admisiones@academiaia.ai) en AcademiaIA debe recibir leads.
UPDATE user_projects up
SET recibe_leads = TRUE
FROM users u, projects p
WHERE up.user_id = u.id
  AND up.project_id = p.id
  AND u.email = 'admisiones@academiaia.ai'
  AND p.slug = 'academia-ia';
