-- 175 · Las marcas que se quedaron sin los cinco pasos (#87)
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ ARREGLA
--
-- La migración 143 sembró los cinco pasos del proceso comercial con un
-- `CROSS JOIN projects`: para los proyectos que existían EL DÍA QUE SE APLICÓ.
-- Un proyecto creado después nace con la tabla vacía.
--
-- Y sin pasos no hay proceso comercial. No sale ningún error: «qué toca hoy»
-- aparece en blanco, la cola del día no tiene de qué tirar y las plantillas no
-- cuelgan de ningún sitio. Para quien lo mira, el módulo simplemente no va.
--
-- Comprobado de dos maneras: en una base recién preparada la tabla queda a
-- cero —las migraciones corren antes de que existan los proyectos—, y al crear
-- una marca por el panel nace con cero pasos.
--
-- El grifo ya está cerrado: `project.model.js` los siembra al dar de alta el
-- proyecto, con la lista de `modules/proceso/pasosPorDefecto.js`, que es la
-- misma de aquí. Esto repara las marcas que quedaron atrás.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LA REGLA
--
-- Solo los proyectos que NO TIENEN NINGÚN PASO. Y a propósito, no «los pasos
-- que le falten a cada uno»: los pasos se editan desde la pantalla, y si en
-- una marca han borrado `paso_4` porque no lo usan, devolvérselo sería
-- deshacerles el trabajo. Cero pasos solo puede significar que nunca se
-- sembraron.
--
-- Ver a quién afecta, ANTES:
--
--   SELECT p.id, p.nombre, COUNT(s.id) AS pasos
--     FROM projects p LEFT JOIN commercial_steps s ON s.project_id = p.id
--    GROUP BY p.id, p.nombre ORDER BY pasos, p.id;

BEGIN;

INSERT INTO commercial_steps
  (project_id, clave, nombre, orden, cuando, dia_desde, dia_hasta, canales, es_seguimiento, nota)
SELECT p.id, d.clave, d.nombre, d.orden, d.cuando, d.dia_desde, d.dia_hasta,
       d.canales, d.es_seguimiento, d.nota
  FROM projects p
 CROSS JOIN (VALUES
   ('paso_1', 'Primer contacto e información', 1, NULL,
    0, 1, ARRAY['whatsapp','email'], false,
    'Los pasos de admisión y el trámite: solo cuando confirme interés.'),

   ('paso_2', 'Prueba social · Opiniones', 2, NULL,
    2, 3, ARRAY['llamada','whatsapp'], false,
    'Si no tiene opiniones: enviar captura de la vista general de Opynio y pedir internamente que se cree la opinión de ese curso.'),

   ('paso_3', 'Última plaza y facilidades de pago', 3, NULL,
    4, 4, ARRAY['llamada','whatsapp','email'], false,
    'El 5 % solo aplica en máster y diplomado, y se ofrece aquí, no antes.'),

   ('paso_4', 'Descuento de última oportunidad', 4, NULL,
    7, 8, ARRAY['llamada','whatsapp','email'], false,
    'Interno, no se comparte: el descuento se decide en la venta. Formación nueva, máximo 40 %; formación ya habilitada, hasta 70 %, reservado para quien casi no ha respondido.'),

   ('seguimiento_mensual', 'Seguimiento de toda la base', 5, 'Final de mes',
    NULL, NULL, ARRAY['wasapi'], true,
    'Mantener el contacto vivo hasta la siguiente convocatoria. Sin presión de venta.')
 ) AS d(clave, nombre, orden, cuando, dia_desde, dia_hasta, canales, es_seguimiento, nota)
 WHERE NOT EXISTS (
   -- NINGÚN paso, ni activo ni desactivado. Ver «LA REGLA» arriba.
   SELECT 1 FROM commercial_steps s WHERE s.project_id = p.id
 );

COMMIT;

-- Para deshacerlo: no hay vuelta atrás automática y no hace falta. Un paso que
-- sobre se desactiva desde la pantalla, que es lo que hace el CRM con ellos
-- (`deactivate`, nunca DELETE: las interacciones viejas apuntan al paso).
