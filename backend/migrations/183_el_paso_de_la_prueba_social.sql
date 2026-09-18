-- 183 · Qué paso es el de la prueba social (#91)
--
-- La marca en el paso, como `avisa_plazas` y `ofrece_descuento`. El proceso se
-- edita desde la pantalla, así que la pantalla no puede llevar dentro qué paso
-- es cuál: si mañana la prueba social se mueve al 3, se cambia la marca.
--
-- Con ella, la ficha y la cola pueden avisar de que la formación de ESE
-- prospecto no tiene opiniones publicadas, que es lo que el documento pide no
-- dejar pasar.
--
-- Idempotente.

BEGIN;

ALTER TABLE commercial_steps
  ADD COLUMN IF NOT EXISTS pide_opiniones BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN commercial_steps.pide_opiniones IS
  'Este paso manda las opiniones de la formacion. La pantalla avisa si el curso no tiene.';

UPDATE commercial_steps
   SET pide_opiniones = true, updated_at = NOW()
 WHERE clave = 'paso_2' AND pide_opiniones = false;

COMMIT;
