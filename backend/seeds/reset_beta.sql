-- ============================================================
-- Reset DB para BETA (CRM-187)
-- Limpia toda la data transaccional y deja SOLO:
--   - Schema completo (sin cambios)
--   - Usuarios activos (manuel, diego, angel, laura, carlos)
--   - 1 proyecto formacion (Psiko Aprende, id 1)
--   - 1 proyecto IA (Psicologo IA, id 4)
--
-- NO ejecutar en produccion (crm_db)
-- ============================================================

BEGIN;

-- Comisiones
TRUNCATE TABLE commissions RESTART IDENTITY CASCADE;
TRUNCATE TABLE commission_rules RESTART IDENTITY CASCADE;

-- Conversiones + pagos
TRUNCATE TABLE conversion_payments RESTART IDENTITY CASCADE;
TRUNCATE TABLE conversions RESTART IDENTITY CASCADE;

-- Contabilidad
TRUNCATE TABLE accounts_payable_payments RESTART IDENTITY CASCADE;
TRUNCATE TABLE accounts_payable RESTART IDENTITY CASCADE;
TRUNCATE TABLE expenses RESTART IDENTITY CASCADE;

-- Leads + historial
TRUNCATE TABLE lead_interactions RESTART IDENTITY CASCADE;
TRUNCATE TABLE lead_reminders RESTART IDENTITY CASCADE;
TRUNCATE TABLE lead_status_history RESTART IDENTITY CASCADE;
TRUNCATE TABLE lead_utms RESTART IDENTITY CASCADE;
TRUNCATE TABLE leads RESTART IDENTITY CASCADE;

-- Productos + dossiers + categorias
TRUNCATE TABLE dossiers RESTART IDENTITY CASCADE;
TRUNCATE TABLE products RESTART IDENTITY CASCADE;
TRUNCATE TABLE product_categories RESTART IDENTITY CASCADE;

-- Campos custom + credenciales
TRUNCATE TABLE project_field_definitions RESTART IDENTITY CASCADE;
TRUNCATE TABLE api_credentials RESTART IDENTITY CASCADE;

-- Cola round-robin
TRUNCATE TABLE project_queue_state CASCADE;

-- Activity log
TRUNCATE TABLE user_activity_log RESTART IDENTITY CASCADE;

-- Proyectos: eliminar todos menos id=1 (Psiko) y id=4 (Psicologo IA)
-- user_projects tiene CASCADE, se limpia solo
DELETE FROM projects WHERE id NOT IN (1, 4);

-- Regenerar webhook_api_key y asegurar estado limpio en los 2 proyectos que quedan
UPDATE projects SET
  webhook_api_key = 'whk_psiko_' || lower(md5(random()::text || clock_timestamp()::text)),
  logo_url = NULL,
  logo_key = NULL,
  producto_label = 'Formacion',
  producto_label_plural = 'Formaciones',
  active = true
WHERE id = 1;

UPDATE projects SET
  webhook_api_key = 'whk_psicoia_' || lower(md5(random()::text || clock_timestamp()::text)),
  logo_url = NULL,
  logo_key = NULL,
  producto_label = 'Plan',
  producto_label_plural = 'Planes',
  active = true
WHERE id = 4;

-- Re-inicializar project_queue_state para Psiko (IA no usa round-robin)
INSERT INTO project_queue_state (project_id, last_assigned_index, last_assigned_user_id)
  VALUES (1, 0, NULL)
  ON CONFLICT (project_id) DO UPDATE SET last_assigned_index = 0, last_assigned_user_id = NULL;

-- Asegurar user_projects: Laura + Carlos asignadas a Psiko
INSERT INTO user_projects (user_id, project_id)
  VALUES (8, 1), (9, 1)
  ON CONFLICT DO NOTHING;

-- Limpiar refresh tokens (forzar re-login)
TRUNCATE TABLE user_refresh_tokens RESTART IDENTITY CASCADE;

COMMIT;

-- Verificar
SELECT 'projects' as tabla, COUNT(*) as n FROM projects
UNION ALL SELECT 'leads', COUNT(*) FROM leads
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'conversions', COUNT(*) FROM conversions
UNION ALL SELECT 'commissions', COUNT(*) FROM commissions
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'user_projects', COUNT(*) FROM user_projects;
