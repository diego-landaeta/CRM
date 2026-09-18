-- 182 · Si la formación tiene opiniones publicadas (#91)
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LA REGLA DEL DOCUMENTO
--
-- El paso 2 es la prueba social: se le mandan las opiniones de su formación.
-- Y trae un aviso en recuadro: «si no tiene opiniones, enviar la captura de la
-- vista general de Opynio y pedir internamente que se cree la opinión de ese
-- curso — NO LO DEJES PASAR».
--
-- Hoy eso depende de que la gestora se acuerde de mirarlo, curso por curso,
-- justo el día que le toca escribir. Y de que se acuerde de pedir que la
-- creen, que es la parte que de verdad se pierde: el prospecto de la semana
-- que viene se encuentra el mismo curso sin opiniones.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ UN CAMPO Y NO UNA CONSULTA A OPYNIO
--
-- Las opiniones viven en Opynio, fuera del CRM. Traerlas sería una integración
-- —con su clave, su sincronización y sus fallos— para contestar una pregunta
-- de sí o no que cambia una vez al año por curso.
--
-- El campo se marca a mano desde el catálogo. NULL es «no consta», y no es lo
-- mismo que «no tiene»: sin saberlo, la pantalla pide comprobarlo en vez de
-- afirmar que no hay.

BEGIN;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS opiniones_publicadas BOOLEAN;

COMMENT ON COLUMN products.opiniones_publicadas IS
  'Si esta formacion tiene opiniones publicadas en Opynio. NULL = no consta, que no es lo mismo que no tener.';

COMMIT;

-- A cuántas formaciones les falta saberlo:
--
--   SELECT opiniones_publicadas, count(*) FROM products WHERE active
--    GROUP BY 1 ORDER BY 1 NULLS FIRST;
