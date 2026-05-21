-- ============================================================
-- Migración 049: producto por defecto + matching por URL en webhooks
-- ============================================================

ALTER TABLE form_templates
  ADD COLUMN IF NOT EXISTS default_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS url_match_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN form_templates.default_product_id IS
  'Producto a asignar cuando no hay match de URL. Típicamente "Contacto general".';
COMMENT ON COLUMN form_templates.url_match_enabled IS
  'Si true, intenta resolver producto_interes_id matcheando la URL del form contra products.url_info';

-- Índice para búsqueda rápida por url_info (matching de webhooks)
CREATE INDEX IF NOT EXISTS idx_products_url_info_lookup
  ON products (project_id, url_info) WHERE url_info IS NOT NULL;
