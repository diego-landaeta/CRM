-- ============================================================
-- Migracion 010: Logo empresa + campos comerciales de productos
-- - projects.logo_url: URL del logo subido (R2), remplaza al emoji
-- - products.precio / moneda / stripe_link / sku / duracion / url_info
-- ============================================================

BEGIN;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS logo_key VARCHAR(500);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS precio DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS moneda VARCHAR(10) NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS stripe_link VARCHAR(500),
  ADD COLUMN IF NOT EXISTS sku VARCHAR(100),
  ADD COLUMN IF NOT EXISTS duracion VARCHAR(100),
  ADD COLUMN IF NOT EXISTS url_info VARCHAR(500);

COMMENT ON COLUMN projects.logo_url IS 'URL publica del logo del proyecto/empresa (R2)';
COMMENT ON COLUMN projects.logo_key IS 'Key interno en R2 para delete/reemplazo';
COMMENT ON COLUMN products.precio IS 'Precio del producto (sin IVA)';
COMMENT ON COLUMN products.stripe_link IS 'URL de Stripe Payment Link o Checkout';
COMMENT ON COLUMN products.url_info IS 'URL con mas info del producto (landing, web)';

COMMIT;
