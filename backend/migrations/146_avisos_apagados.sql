-- 146 · Apagar avisos por tipo y por persona (#111)
--
-- Diego, 07/09: «que se puedan apagar por tipo, por persona. Hoy o los
-- recibes todos o ninguno».
--
-- Hoy hay una pantalla de preferencias que guarda en `localStorage` del
-- navegador y encima con nombres de tipo que no existen —`lead_assigned`,
-- `reminder_due`— cuando el backend emite `lead_asignado` y `lead_reminder`.
-- O sea que apagar un aviso ahi no apagaba nada, y ademas se perdia al
-- cambiar de ordenador.
--
-- Una fila = «esta persona no quiere este tipo». Sin fila, lo recibe. Asi lo
-- normal —quererlo todo— no ocupa nada, y un tipo nuevo llega encendido a
-- todo el mundo sin tener que sembrar filas.
--
-- SIN ESTA MIGRACION EL CRM FUNCIONA IGUAL: se mira `information_schema` una
-- vez y, si la tabla no esta, no se apaga nada y la pantalla de preferencias
-- lo dice en vez de fingir que guarda.

CREATE TABLE IF NOT EXISTS notification_mutes (
  user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50)  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, type)
);

-- El filtro siempre es «los tipos que ESTA persona tiene apagados», asi que
-- la clave primaria por (user_id, type) ya da el indice que hace falta.

COMMENT ON TABLE notification_mutes IS
  'Avisos que un usuario NO quiere recibir. Sin fila = los recibe (#111).';
