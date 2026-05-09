-- ============================================================
-- Migración 051: divisa por defecto del WC import (no por producto)
-- ============================================================

ALTER TABLE wc_credentials
  ADD COLUMN IF NOT EXISTS default_currency VARCHAR(10) NOT NULL DEFAULT 'EUR';

COMMENT ON COLUMN wc_credentials.default_currency IS
  'Moneda aplicada a todos los productos importados de esta tienda (EUR/USD/MXN/...)';
