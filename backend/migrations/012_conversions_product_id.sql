-- ============================================================
-- Migracion 012: Vincular conversion a producto (FK)
-- Necesario para resolver comisiones por producto.
-- ============================================================

BEGIN;

ALTER TABLE conversions
  ADD COLUMN IF NOT EXISTS producto_contratado_id INTEGER;

ALTER TABLE conversions
  ADD CONSTRAINT fk_conv_product FOREIGN KEY (producto_contratado_id) REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conv_product ON conversions (producto_contratado_id);

COMMIT;
