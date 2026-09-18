-- 177 · Los huecos de la ficha de la formación, que el CRM ya sabe (#88)
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ CAMBIA
--
-- La plantilla «Día 1 · Ficha de la formación» pide a mano seis datos que el
-- catálogo ya tiene guardados de cada curso:
--
--     Inicio: [fecha de inicio]                 → {inicio}
--     Duración: [nº meses] · [nº] horas         → {duracion} · {horas}
--     Titulación: Diploma de [nº] horas         → Diploma de {horas} horas
--     Inversión total: [importe]                → {inversion}
--     Cierre de convocatoria: [fecha]           → {cierre}
--
-- Escribirlos a mano en cada mensaje es donde se cuelan los errores: la
-- gestora copia la ficha del curso anterior y le manda al cliente la duración
-- de otro. Y son datos que están en `products`, no una suposición.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LAS PLAZAS SE QUEDAN ENTRE CORCHETES, Y NO ES UN OLVIDO
--
-- «Plazas disponibles: [nº]» no se toca. El CRM no las lleva: las lleva
-- admisiones, y de dos contabilidades de las mismas plazas solo una puede
-- tener razón. Un número nuestro que no cuadre con el suyo termina dentro de
-- un mensaje que ya salió. El paso marca `avisa_plazas` y la pantalla recuerda
-- comprobarlas antes de cada envío.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- SI EL CURSO NO TIENE EL DATO, VUELVE EL CORCHETE
--
-- Lo hace el que rellena (`proceso/plantillasDelPaso.js`), no esta migración:
-- un curso sin precio escribe «[importe]» otra vez, no un blanco. Un hueco
-- vacío en un mensaje pasa desapercibido; un corchete, no.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- SOLO SE TOCA EL TROZO EXACTO
--
-- `replace()` sobre la frase concreta, no un texto nuevo encima: si alguien ha
-- editado su plantilla desde la pantalla —que para eso está— se le respeta
-- todo lo demás. Y donde ya esté cambiado, `replace` no encuentra nada y no
-- hace nada: se puede volver a pasar.

BEGIN;

UPDATE whatsapp_templates
   SET body = replace(
         replace(
           replace(
             replace(
               replace(body,
                 'Inicio: [fecha de inicio]', 'Inicio: {inicio}'),
               'Duración: [nº meses] · [nº] horas lectivas',
               'Duración: {duracion} · {horas} horas lectivas'),
             'Diploma de [nº] horas', 'Diploma de {horas} horas'),
           'Inversión total: [importe]', 'Inversión total: {inversion}'),
         'Cierre de convocatoria: [fecha]', 'Cierre de convocatoria: {cierre}'),
       updated_at = NOW()
 WHERE active
   AND paso_clave IS NOT NULL
   AND body LIKE '%[%';

COMMIT;

-- Ver cómo quedó, y que no queda ningún corchete que el CRM pudiera rellenar:
--
--   SELECT label, body FROM whatsapp_templates
--    WHERE label LIKE '%Ficha de la formación%' LIMIT 1;
--
-- Para deshacerlo, los mismos `replace` al revés. No hace falta guardar el
-- texto viejo: está escrito arriba y en la migración 151.
