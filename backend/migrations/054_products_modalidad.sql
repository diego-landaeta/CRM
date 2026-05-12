-- Añadir columna modalidad que el scraper rellena ("Online", "Presencial", etc.)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS modalidad VARCHAR(80);
COMMENT ON COLUMN products.modalidad IS 'Modalidad de impartición: Online / Presencial / Mixto / Híbrido, extraído por el scraper o ACF.';
