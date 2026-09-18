-- 178 · La agenda de los prospectos que ya estaban (#89 · #90)
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ ARREGLA
--
-- `lead_steps` —qué le toca a quién y cuándo— se escribe AL ENTRAR la persona.
-- Quien entró antes de que existiera el proceso no tiene ninguna, y sin agenda
-- no sale en «la cola del día» ni enseña sus pasos en su ficha. O sea: las tres
-- pantallas del proceso comercial existen y están vacías para la base que ya
-- había.
--
-- No es un fallo del código: es que no había de qué colgarla. Los pasos se
-- sembraban solo para los proyectos que existían el día de la migración 143, y
-- eso se arregló en la 175.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- A QUIÉN SE LE PONE, Y A QUIÉN NO
--
-- Solo a los ABIERTOS. Quien ya compró o dijo que no sale igualmente de la
-- cola —seguir el proceso con alguien que ya cerró es hacerle perder el tiempo
-- a las dos—, así que escribirle la agenda sería llenar la tabla sin efecto.
--
-- Y solo a los de los ÚLTIMOS 90 DÍAS. El proceso comercial dura ocho días:
-- pasados tres meses la persona ya no está en él, está en el seguimiento de
-- fin de mes, que es de toda la base y no va por agenda. Meter la base
-- histórica entera haría aparecer mañana cientos de pasos «atrasados desde
-- hace dos años» y la cola del día dejaría de poder mirarse, que es la única
-- forma de que una cola deje de usarse.
--
-- PARA CAMBIAR LA VENTANA: el `- 90` de abajo. Con toda la base, quitar esa
-- línea entera. Se puede volver a pasar: `ON CONFLICT (lead_id, clave)`.
--
-- El seguimiento mensual NO entra, igual que al planificar un lead nuevo: no es
-- del recorrido de una persona, y metido aquí llenaría la cola con toda la base.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- VER A CUÁNTOS AFECTA, ANTES DE APLICARLO
--
--   SELECT count(*) AS sin_agenda
--     FROM leads l
--    WHERE l.deleted_at IS NULL
--      AND l.status NOT IN ('convertido', 'no_interesado')
--      AND COALESCE(l.fecha_solicitud, l.created_at) >= CURRENT_DATE - 90
--      AND NOT EXISTS (SELECT 1 FROM lead_steps s WHERE s.lead_id = l.id);
--
-- Un paso YA HECHO no se marca aquí y no hace falta: se deduce de los
-- contactos reales —el contacto n.º N cierra el paso n.º N—, que es la misma
-- regla del embudo de Reportes. Así que a quien ya se trabajó le saldrán sus
-- pasos hechos solos, sin que esta migración toque nada.

BEGIN;

INSERT INTO lead_steps (lead_id, project_id, step_id, clave, orden, fecha_prevista)
SELECT l.id, l.project_id, s.id, s.clave, s.orden,
       (COALESCE(l.fecha_solicitud, l.created_at)::date + COALESCE(s.dia_desde, 0))
  FROM leads l
  JOIN commercial_steps s ON s.project_id = l.project_id
 WHERE l.deleted_at IS NULL
   AND l.status NOT IN ('convertido', 'no_interesado')
   AND COALESCE(l.fecha_solicitud, l.created_at) >= CURRENT_DATE - 90
   AND s.activo = true
   AND s.es_seguimiento = false
ON CONFLICT (lead_id, clave) DO NOTHING;

COMMIT;

-- Cómo quedó:
--
--   SELECT count(DISTINCT lead_id) AS con_agenda, count(*) AS apuntes
--     FROM lead_steps;
--
-- Para deshacerlo, si la cola sale demasiado llena:
--
--   DELETE FROM lead_steps ls
--    WHERE ls.estado = 'pendiente'
--      AND ls.created_at::date = CURRENT_DATE;   -- solo lo escrito hoy
--
-- Se borra solo lo pendiente: un paso que alguien ya movió de fecha o saltó a
-- mano lleva su cambio, y ese no se tira.
