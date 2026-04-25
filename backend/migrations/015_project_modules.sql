-- ============================================================
-- Migracion 015: Modulos configurables por proyecto (CRM-178)
-- Cada proyecto activa/desactiva modulos individualmente
-- ============================================================

BEGIN;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS modules JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Default: todos los proyectos CRM tienen todo activo, los IA tienen subset
UPDATE projects SET modules = '{
  "leads": true,
  "clients": true,
  "products": true,
  "conversions": true,
  "commissions": true,
  "matriculas": false,
  "forms": true,
  "woocommerce": false,
  "platform_users": false,
  "accounting_income": true,
  "accounting_expenses": true,
  "accounting_receivable": true,
  "accounting_payable": true,
  "payroll": false,
  "reports": true
}'::jsonb
WHERE type = 'crm' AND (modules IS NULL OR modules = '{}'::jsonb);

UPDATE projects SET modules = '{
  "leads": false,
  "clients": false,
  "products": true,
  "conversions": true,
  "commissions": false,
  "matriculas": false,
  "forms": false,
  "woocommerce": false,
  "platform_users": true,
  "accounting_income": true,
  "accounting_expenses": true,
  "accounting_receivable": false,
  "accounting_payable": false,
  "payroll": false,
  "reports": true
}'::jsonb
WHERE type = 'ia' AND (modules IS NULL OR modules = '{}'::jsonb);

COMMENT ON COLUMN projects.modules IS 'Toggles JSONB de modulos activos. Sidebar y endpoints respetan esto.';

COMMIT;
