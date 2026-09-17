-- 173 · Las ventas que guardaron el nombre del cliente como producto (#160)
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ PASÓ
--
-- `createSale` mandaba el NOMBRE DEL CLIENTE como `producto_contratado`
-- —«override por service si tiene lookup», decía su comentario— contando con
-- que el servicio lo corrigiera. Pero aquel lookup solo iba de texto a id, y
-- cuando el id ya venía puesto no se ejecutaba: el texto se quedaba tal cual.
--
-- Resultado: toda venta registrada desde el formulario guardó al cliente como
-- programa, y la lista de Ventas enseñaba «Pedro Sanchez» en esa columna.
--
-- El alta ya está arreglada (6bda49c1): con id del catálogo, el nombre sale
-- del catálogo. Esto repara las que quedaron mal.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ SE PUEDE REPARAR, Y HASTA DÓNDE
--
-- Porque `producto_contratado_id` SÍ se guardó bien: es lo que se eligió en el
-- desplegable. El texto es lo que se rompió. Así que el nombre se repone desde
-- el catálogo, por el id, que es la fuente buena.
--
-- Las que NO tienen `producto_contratado_id` no se tocan: ahí el texto es lo
-- único que hay, y aunque sea el nombre de un cliente, borrarlo dejaría la
-- venta sin ninguna pista de qué se vendió. Peor el remedio.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ANTES DE APLICARLA: MIRAR A CUÁNTAS AFECTA
--
--   SELECT c.id, c.producto_contratado AS dice_ahora, p.nombre AS deberia_decir
--     FROM conversions c
--     JOIN products p ON p.id = c.producto_contratado_id
--    WHERE TRIM(c.producto_contratado) <> TRIM(p.nombre)
--    ORDER BY c.fecha_conversion DESC;
--
-- Si ahí sale algo que NO es un nombre de persona —un curso escrito a mano que
-- difiere del catálogo por una tilde, por ejemplo—, esta migración también lo
-- cambiaría. Es lo correcto: manda el catálogo. Pero conviene haberlo visto.

BEGIN;

-- El antes y el después quedan apuntados, que es dinero y conviene poder
-- deshacerlo sin adivinar. La tabla se queda: ocupa poco y es el único rastro.
CREATE TABLE IF NOT EXISTS conversions_producto_reparado (
  conversion_id  INTEGER PRIMARY KEY REFERENCES conversions(id) ON DELETE CASCADE,
  decia          VARCHAR(255),
  pasa_a_decir   VARCHAR(255),
  reparado_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO conversions_producto_reparado (conversion_id, decia, pasa_a_decir)
SELECT c.id, c.producto_contratado, p.nombre
  FROM conversions c
  JOIN products p ON p.id = c.producto_contratado_id
 WHERE TRIM(c.producto_contratado) IS DISTINCT FROM TRIM(p.nombre)
ON CONFLICT (conversion_id) DO NOTHING;

UPDATE conversions c
   SET producto_contratado = p.nombre,
       updated_at = NOW()
  FROM products p
 WHERE p.id = c.producto_contratado_id
   AND TRIM(c.producto_contratado) IS DISTINCT FROM TRIM(p.nombre);

COMMIT;

-- Para deshacerlo, si hiciera falta:
--
--   UPDATE conversions c SET producto_contratado = r.decia
--     FROM conversions_producto_reparado r WHERE r.conversion_id = c.id;
