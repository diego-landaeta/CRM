CREATE INDEX IF NOT EXISTS idx_products_list
  ON products (project_id, active, created_at DESC)
  WHERE active = true;

ANALYZE products;
