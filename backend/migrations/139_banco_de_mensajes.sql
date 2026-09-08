-- El banco de mensajes necesita mirar la tabla de otra manera (#101).
--
-- Los indices que hay estan pensados para el CHAT: `(conversacion_id, ts DESC)`
-- sirve para pintar un hilo, que es abrir una conversacion y leer sus ultimos
-- mensajes. El banco hace justo lo contrario: recorre TODOS los mensajes de
-- todas las conversaciones ordenados por fecha, sin fijar ninguna.
--
-- Sin un indice por `ts`, esa consulta es un recorrido completo de la tabla mas
-- una ordenacion en memoria. Con 1.957 mensajes de una sola gestora en
-- produccion hoy, y creciendo cada dia, eso deja de ser gratis pronto.
--
-- No se toca nada de lo que ya existe: solo se anade.

CREATE INDEX IF NOT EXISTS idx_wa_mensajes_ts
  ON wa_mensajes (ts DESC);

-- Para el resumen por numero: agrupa por conversacion contando mensajes.
-- `(conversacion_id, ts DESC)` ya cubre el filtro por conversacion, pero el
-- resumen ordena por el ultimo mensaje de cada una y ahi ayuda tener la fecha
-- a mano sin ir a la fila.
CREATE INDEX IF NOT EXISTS idx_wa_mensajes_conv_ts_asc
  ON wa_mensajes (conversacion_id, ts);

-- Buscar por texto va con ILIKE '%algo%', que ningun indice normal acelera.
-- Lo suyo seria `pg_trgm`, pero eso es una extension: instalarla es una
-- decision de servidor y no de una migracion que va a correr en dos maquinas
-- distintas. Se deja apuntado aqui y se decide con Diego:
--
--   CREATE EXTENSION IF NOT EXISTS pg_trgm;
--   CREATE INDEX idx_wa_mensajes_texto ON wa_mensajes USING gin (texto gin_trgm_ops);
--
-- Mientras tanto la busqueda por texto se apoya en el filtro de fechas y de
-- numero, que si van indexados.
