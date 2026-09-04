-- Pasa la propiedad de todo el esquema `public` al usuario del CRM. Tarea #71.
--
-- EL PROBLEMA
--   Parte de las tablas son del rol `postgres` y no de `crm_user`. Postgres exige
--   ser DUENYO para un ALTER TABLE, asi que el CRM no puede aplicar sus propias
--   migraciones: fallan con «debe ser dueño de la tabla users». Medido en local:
--   45 tablas de `postgres` y 51 de `crm_user` en la misma base.
--
--   Se nota tarde y mal. El login contesta «Error del sistema» porque la consulta
--   pide una columna que la migracion no pudo crear, y nada en esa pantalla
--   sugiere que el problema sea de permisos.
--
-- COMO EJECUTARLO (hace falta ser superusuario; pedira la contrasena de postgres)
--   psql -U postgres -h 127.0.0.1 -d crm_test_db -f scripts/dar-propiedad-a-crm-user.sql
--
--   En el VPS, lo mismo cambiando la base: crm_prod_db o crm_test_db.
--
-- NO BORRA NI MODIFICA DATOS: solo cambia quien figura como dueño.
DO $$
DECLARE
  destino CONSTANT TEXT := 'crm_user';
  r RECORD;
  n INT := 0;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables
            WHERE schemaname = 'public' AND tableowner <> destino LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO %I', r.tablename, destino);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'Tablas cambiadas: %', n;

  -- Las secuencias van aparte: un SERIAL crea la suya y hereda el dueño de quien
  -- la creo, no el de la tabla. Sin esto, insertar seguiria fallando.
  n := 0;
  FOR r IN SELECT c.relname FROM pg_class c
             JOIN pg_namespace ns ON ns.oid = c.relnamespace
            WHERE ns.nspname = 'public' AND c.relkind = 'S'
              AND pg_get_userbyid(c.relowner) <> destino LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO %I', r.relname, destino);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'Secuencias cambiadas: %', n;

  -- Y los TIPOS. Se olvidan siempre porque no salen en `\dt`, pero un ENUM es
  -- suyo igual: sin esto, seis migraciones siguen fallando con «debe ser dueño
  -- del tipo user_role» aunque todas las tablas ya esten bien.
  n := 0;
  FOR r IN SELECT t.typname FROM pg_type t
             JOIN pg_namespace ns ON ns.oid = t.typnamespace
            WHERE ns.nspname = 'public' AND t.typtype = 'e'
              AND pg_get_userbyid(t.typowner) <> destino LOOP
    EXECUTE format('ALTER TYPE public.%I OWNER TO %I', r.typname, destino);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'Tipos cambiados: %', n;

  n := 0;
  FOR r IN SELECT viewname FROM pg_views
            WHERE schemaname = 'public' AND viewowner <> destino LOOP
    EXECUTE format('ALTER VIEW public.%I OWNER TO %I', r.viewname, destino);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'Vistas cambiadas: %', n;
END $$;

-- Comprobacion: despues de esto no debe quedar ninguna fila con otro dueño.
SELECT tableowner AS dueno, COUNT(*) AS tablas
  FROM pg_tables WHERE schemaname = 'public'
 GROUP BY 1 ORDER BY 2 DESC;
