-- 176 · Atar cada plantilla a su paso del proceso (#88)
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ FALTA HOY
--
-- Las plantillas del documento comercial ya están cargadas (151, 152, 153) y
-- los cinco pasos también (143, 175). Lo que no existe es la unión: nada dice
-- que «Día 2 · Opiniones · 1 de 3» es del paso `paso_2`.
--
-- Sin esa unión, abrir la ficha de un prospecto y ver «ahora le toca: Prueba
-- social» no lleva a ninguna parte: la gestora tiene que acordarse de cuál de
-- las diez plantillas era, irse a otra pantalla y buscarla por el nombre. Que
-- es justo lo que hacía antes de que existiera nada de esto.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ UNA CLAVE Y NO UNA FK AL PASO
--
-- `commercial_steps` tiene una fila POR PROYECTO: el `paso_2` de Psiko y el de
-- ISEIH son dos ids distintos. Una FK obligaría a repetir la plantilla por
-- proyecto o a elegir el paso de una marca para las demás.
--
-- La `clave` es estable —no se puede editar desde la pantalla, justamente por
-- esto— y vale igual en todas las marcas. Y una plantilla suelta, sin paso,
-- sigue valiendo: `paso_clave` es NULL y se comporta como hasta hoy.
--
-- Idempotente: se puede volver a pasar.

BEGIN;

ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS paso_clave TEXT;
ALTER TABLE email_templates    ADD COLUMN IF NOT EXISTS paso_clave TEXT;

COMMENT ON COLUMN whatsapp_templates.paso_clave IS
  'Paso del proceso comercial al que pertenece (commercial_steps.clave). NULL = suelta.';
COMMENT ON COLUMN email_templates.paso_clave IS
  'Paso del proceso comercial al que pertenece (commercial_steps.clave). NULL = suelta.';

CREATE INDEX IF NOT EXISTS idx_wa_templates_paso
  ON whatsapp_templates (project_id, paso_clave) WHERE paso_clave IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_templates_paso
  ON email_templates (project_id, paso_clave) WHERE paso_clave IS NOT NULL;

-- ── Atar las que ya están, por su nombre ────────────────────────────────────
--
-- Las cargó la 151 con el nombre puesto por delante: «Día 1 · Saludo», «Día 2 ·
-- Opiniones · 1 de 3»… El número del nombre es el número del PASO, no el día
-- del calendario: el paso 3 se hace el día 4. Por eso el mapa es literal y no
-- una cuenta sobre `dia_desde`.
--
-- Solo se tocan las que aún no tienen paso: si alguien lo cambió a mano desde
-- la pantalla, manda lo suyo.

UPDATE whatsapp_templates SET paso_clave = 'paso_1', updated_at = NOW()
 WHERE paso_clave IS NULL AND label LIKE 'Día 1 ·%';
UPDATE whatsapp_templates SET paso_clave = 'paso_2', updated_at = NOW()
 WHERE paso_clave IS NULL AND label LIKE 'Día 2 ·%';
UPDATE whatsapp_templates SET paso_clave = 'paso_3', updated_at = NOW()
 WHERE paso_clave IS NULL AND label LIKE 'Día 3 ·%';
UPDATE whatsapp_templates SET paso_clave = 'paso_4', updated_at = NOW()
 WHERE paso_clave IS NULL AND label LIKE 'Día 4 ·%';
UPDATE whatsapp_templates SET paso_clave = 'seguimiento_mensual', updated_at = NOW()
 WHERE paso_clave IS NULL AND label LIKE 'Día X ·%';

UPDATE email_templates SET paso_clave = 'paso_1', updated_at = NOW()
 WHERE paso_clave IS NULL AND name LIKE 'Día 1 ·%';
UPDATE email_templates SET paso_clave = 'paso_2', updated_at = NOW()
 WHERE paso_clave IS NULL AND name LIKE 'Día 2 ·%';
UPDATE email_templates SET paso_clave = 'paso_3', updated_at = NOW()
 WHERE paso_clave IS NULL AND name LIKE 'Día 3 ·%';
UPDATE email_templates SET paso_clave = 'paso_4', updated_at = NOW()
 WHERE paso_clave IS NULL AND name LIKE 'Día 4 ·%';

COMMIT;

-- Comprobar cómo quedó:
--
--   SELECT paso_clave, count(*) FROM whatsapp_templates WHERE active
--    GROUP BY 1 ORDER BY 1;
--
-- Para deshacerlo: UPDATE whatsapp_templates SET paso_clave = NULL; y lo mismo
-- en email_templates. No se pierde nada: la columna es información añadida.
