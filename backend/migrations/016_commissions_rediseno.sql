-- ============================================================
-- Migracion 016: Rediseño comisiones (CRM-180)
-- - product_id pasa a NULL-able (regla generica por gestor)
-- - base_calc ENUM (sobre cobrado o vendido)
-- - condicion JSONB (regla con condicion simple opcional)
-- - UNIQUE actualizada con NULLS NOT DISTINCT
-- ============================================================

BEGIN;

-- 1) Permitir product_id NULL
ALTER TABLE commission_rules ALTER COLUMN product_id DROP NOT NULL;

-- 2) Nuevas columnas
ALTER TABLE commission_rules
  ADD COLUMN IF NOT EXISTS base_calc VARCHAR(20) NOT NULL DEFAULT 'cobrado'
    CHECK (base_calc IN ('cobrado', 'vendido')),
  ADD COLUMN IF NOT EXISTS condicion JSONB;

-- 3) UNIQUE: cada gestor solo 1 regla por (project, producto). Producto NULL = generica.
ALTER TABLE commission_rules DROP CONSTRAINT IF EXISTS uq_cr_user_product;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cr_project_user_product_v2
  ON commission_rules (project_id, user_id, COALESCE(product_id, 0));

-- Tambien añadir base_calc a commissions (para auditar como se calculo)
ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS base_calc VARCHAR(20) NOT NULL DEFAULT 'cobrado'
    CHECK (base_calc IN ('cobrado', 'vendido'));

COMMENT ON COLUMN commission_rules.base_calc IS 'Sobre que se calcula: cobrado (importe pagado) o vendido (importe total)';
COMMENT ON COLUMN commission_rules.condicion IS 'Condicion JSONB opcional: { field, op, value } o { op:AND/OR, rules:[...] }';
COMMENT ON COLUMN commission_rules.product_id IS 'NULL = aplica a todas las ventas del gestor; NOT NULL = override por producto';

COMMIT;
