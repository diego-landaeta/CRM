-- ============================================================
-- Migración 039: árbol N niveles para product_categories
-- ============================================================

-- URL externa (para categorías importadas que apuntan a una landing del WP/WC origen)
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS external_url TEXT;

-- Origen: wc (categoría WC), wp_menu (item del menú WP), manual (creada en CRM)
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';

-- ID externo (slug de WP, ID de WC, etc.) para idempotencia en re-syncs
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_product_categories_external
  ON product_categories(project_id, source, external_id);
