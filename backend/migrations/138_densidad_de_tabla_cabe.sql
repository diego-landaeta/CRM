-- Preferencias personales: que la densidad quepa en su columna.
--
-- `029_user_views.sql` creo la tabla con:
--
--     table_density VARCHAR(10) DEFAULT 'comfortable'
--
-- y 'comfortable' son once caracteres. El valor por defecto no cabe en su
-- propia columna, asi que CUALQUIER insercion que no diga explicitamente la
-- densidad se cae con 22001 (value too long). Como el endpoint solo manda los
-- campos que cambian, nunca la dice: la tabla lleva vacia desde que existe y
-- nadie ha podido guardar una sola preferencia. Ni siquiera el superadmin.
--
-- No se veia porque el frontal se tragaba el error y pintaba el cambio igual;
-- solo volvia atras al recargar.
--
-- `theme_preference` es VARCHAR(10) tambien. Ahi los valores son 'light' y
-- 'dark', que caben, pero se amplia por el mismo motivo: no merece la pena
-- afinar diez caracteres en una columna que guarda una palabra.

ALTER TABLE user_views
  ALTER COLUMN table_density    TYPE VARCHAR(20),
  ALTER COLUMN theme_preference TYPE VARCHAR(20);

-- El defecto se vuelve a declarar sobre el tipo nuevo, por si acaso.
ALTER TABLE user_views
  ALTER COLUMN table_density SET DEFAULT 'comfortable';
