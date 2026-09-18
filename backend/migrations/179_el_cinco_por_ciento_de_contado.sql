-- 179 · El 5 % de contado, marcado en el paso (#91)
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LA REGLA DEL DOCUMENTO
--
-- «El 5 % solo aplica en máster y diplomado, y se ofrece aquí, no antes» —el
-- «aquí» es el paso 3, el de última plaza y facilidades de pago.
--
-- Hoy eso depende de que cada asesora sepa de qué tipo es cada formación. Son
-- dos errores distintos y los dos cuestan dinero: ofrecerlo en un curso —se
-- regala un 5 % que no tocaba— o no ofrecerlo en un máster, que es peor
-- porque no se nota nunca.
--
-- El CRM sabe de qué tipo es: está en la categoría del catálogo y casi siempre
-- en el propio nombre de la formación.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ UNA MARCA EN EL PASO Y NO UN «IF» EN LA PANTALLA
--
-- Mismo motivo que `avisa_plazas`, y se hace igual: el proceso se edita desde
-- la pantalla, así que la pantalla no puede llevar dentro qué paso es cuál. Si
-- mañana el 5 % se mueve al paso 4 —o ISEIE lo pone en otro sitio— se cambia
-- la marca, no el código.
--
-- Lo que NO va en la base es a qué formaciones aplica: eso se mira del
-- catálogo en el momento (`proceso/reglasDelProceso.js`), porque el catálogo
-- cambia cada semana y una lista guardada aquí quedaría vieja.
--
-- Idempotente.

BEGIN;

ALTER TABLE commercial_steps
  ADD COLUMN IF NOT EXISTS ofrece_descuento BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN commercial_steps.ofrece_descuento IS
  'Este paso es donde se ofrece el 5 % de contado. La pantalla dice si la formación del prospecto lo lleva.';

-- El paso 3 de cada marca, que es donde lo pone el documento. Se busca por
-- clave y no por el nombre, que es editable.
UPDATE commercial_steps
   SET ofrece_descuento = true, updated_at = NOW()
 WHERE clave = 'paso_3' AND ofrece_descuento = false;

COMMIT;

-- Comprobar:
--
--   SELECT project_id, clave, nombre, ofrece_descuento
--     FROM commercial_steps WHERE ofrece_descuento ORDER BY project_id;
--
-- Para deshacerlo: UPDATE commercial_steps SET ofrece_descuento = false;
