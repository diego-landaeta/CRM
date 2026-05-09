-- 041_product_image.sql
-- CRM-149: imagen de producto
-- Añade columna image_url a products. Soporta tanto path absoluto como r2_key
-- (la app diferencia con prefijo "r2://" o por presencia de protocolo http).

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN products.image_url IS 'URL/clave R2 de la imagen del producto. Vacio = sin imagen.';
