-- ============================================================
-- Migracion 140: los tipos de proyecto que faltaban (#15)
--
-- `project_type` solo tenia 'crm' e 'ia'. El tipo decide que se le ensena a
-- cada marca —un centro de formacion quiere las matriculas delante, una tienda
-- quiere WooCommerce— y hoy las dos ven lo mismo.
--
-- ADD VALUE es idempotente con IF NOT EXISTS (PG 9.6+), asi que se puede
-- repetir sin miedo.
--
-- OJO: ADD VALUE no se puede ejecutar dentro de una transaccion en PostgreSQL
-- anterior a la 12. En la 12+ si, pero el valor nuevo no se puede USAR hasta que
-- la transaccion termina. Por eso este fichero NO lleva BEGIN/COMMIT.
--
-- Mientras no este aplicada, el CRM NO se rompe: `GET /api/projects/types`
-- devuelve cada tipo con `disponible: false`, y crear un proyecto con uno de
-- ellos contesta 409 diciendo que falta esta migracion — en vez del
-- «error del sistema» que salia al chocar con el enum.
-- ============================================================

ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'educacion';
ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'ecommerce';
ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'servicios';
ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'inmobiliaria';
