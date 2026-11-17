-- ============================================================
-- 287: las plantillas del proceso firman con quien escribe (#129)
-- ============================================================
-- Diego, 07/09: «que se pongan los datos automáticos según el gestor».
--
-- Las plantillas del proceso comercial (migraciones 151 y 152) llevan un
-- «[tu nombre]» —«Soy [tu nombre], de {proyecto}», «[tu nombre] · Asesora
-- comercial»— que cada gestora escribía a mano en cada mensaje. El CRM sabe
-- quién escribe, así que ahora es un hueco más: `{comercial}`, que la pantalla
-- rellena con el nombre de pila de la dueña del WhatsApp (o de quien copia, en
-- la ficha y en la cola). Si no lo sabe, el hueco se queda a la vista y el
-- aviso de «falta {comercial}» sale antes de copiar, como con los demás.
--
-- QUÉ SE TOCA Y QUÉ NO
--   · Solo las del PROCESO: compartidas y atadas a un paso (`paso_clave`). Las
--     personales son de cada gestora y no se reescriben por ella.
--   · Solo ese corchete. Lo demás que va [entre corchetes] —importes, plazos,
--     el enlace de opiniones— sigue siendo de la gestora: el CRM no lo sabe, y
--     rellenarlo con un dato inventado sería peor que dejarlo (lo mismo que dijo
--     la 151).
--   · Las plantillas que ya no usan el corchete —porque alguien las editó—
--     se quedan como están.
--
-- El seguimiento de los textos del proceso sigue siendo `docs/proceso-comercial`:
-- esta migración no cambia ninguna frase, solo quién la firma.
--
-- Número 287 en MultiCRM; en CRM-ISEIE comprobar el siguiente libre al portarla.
--
-- Se puede pasar dos veces: la segunda no encuentra ningún «[tu nombre]».

BEGIN;

UPDATE whatsapp_templates
   SET body = regexp_replace(body, '\[\s*tu nombre\s*\]', '{comercial}', 'gi'),
       updated_at = NOW()
 WHERE ambito = 'compartida'
   AND paso_clave IS NOT NULL
   AND body ~* '\[\s*tu nombre\s*\]';

COMMIT;
