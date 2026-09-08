-- ============================================================
-- Migracion 141: columnas configurables tambien de clientes y productos (#8)
--
-- `projects.lead_columns` guarda que columnas se ven en el listado de leads y
-- en que orden. Clientes y Productos no tenian equivalente, asi que su listado
-- salia fijo y la pestaña «Columnas» de Configuracion solo servia para leads.
--
-- La FORMA no se inventa aqui: `user_views` ya tiene `lead_columns_override` y
-- `client_columns_override` —una columna por entidad, no un JSON con todo
-- dentro— asi que se sigue ese mismo camino. Cambiarlo ahora obligaria a migrar
-- tambien las de usuario.
--
-- Sin aplicar no se rompe nada: la pestaña sigue enseñando leads y las otras
-- dos entidades salen deshabilitadas, diciendo que falta esta migracion.
-- ============================================================

BEGIN;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_columns  JSONB;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS product_columns JSONB;

COMMENT ON COLUMN projects.client_columns  IS 'Columnas visibles del listado de clientes, en orden. Misma forma que lead_columns.';
COMMENT ON COLUMN projects.product_columns IS 'Columnas visibles del listado de productos, en orden. Misma forma que lead_columns.';

COMMIT;
