-- 174 · Las ventas viejas que no dicen de qué formación son (#41)
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ ARREGLA
--
-- Una venta con VARIOS ARTÍCULOS nacía siempre sin curso: el diálogo de
-- conversión manda `producto_contratado_id: null` a propósito —son varias
-- líneas, no cabe una sola FK— y el texto quedaba como «1x Curso A + 2x Curso
-- B», que no cruza con nada del catálogo.
--
-- Sin curso, NINGÚN PROFESOR COBRA COMISIÓN por esa venta, y en los informes
-- sale bajo «servicio académico».
--
-- El grifo ya está cerrado (`c1ec37fd`): desde ahora el curso sale de las
-- líneas al crear la venta. Esto repara las que quedaron atrás.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LA REGLA, QUE ES LA MISMA QUE LA DEL GRIFO
--
-- Las líneas SÍ guardan su `product_id`. Si TODAS las que lo tienen apuntan al
-- MISMO curso, ese es el curso de la venta. Es el caso normal: una venta de un
-- curso partida en dos líneas, o con cantidad.
--
-- Si apuntan a cursos DISTINTOS **no se toca nada**. Ahí de verdad no hay un
-- curso único, y elegir uno sería mandarle la comisión a un profesor en vez de
-- a otro. Esas se quedan en la pantalla «Sin formación» para mirarlas a mano,
-- que es donde tienen que estar.
--
-- Tampoco se tocan las que no tienen líneas, ni las que ya tienen curso.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ESTO MUEVE DINERO. LEER ANTES DE APLICAR
--
-- Atar una venta a su curso NO genera la comisión hacia atrás por sí solo: eso
-- es una decisión aparte (subfase 4 del #41). Lo que sí hace es que la venta
-- deje de estar huérfana y que a partir de ahí se pueda calcular.
--
-- Ver a cuántas afecta y a quién, ANTES:
--
--   SELECT c.id, c.fecha_conversion, l.nombre AS alumno, c.importe_total,
--          c.producto_contratado AS dice_ahora, p.nombre AS pasaria_a_ser
--     FROM conversions c
--     JOIN leads l ON l.id = c.lead_id
--     JOIN LATERAL (
--       SELECT MIN(i.product_id) AS pid
--         FROM conversion_items i
--        WHERE i.conversion_id = c.id AND i.product_id IS NOT NULL
--       HAVING COUNT(DISTINCT i.product_id) = 1
--     ) u ON TRUE
--     JOIN products p ON p.id = u.pid
--    WHERE c.producto_contratado_id IS NULL
--    ORDER BY c.fecha_conversion DESC;

BEGIN;

-- El antes y el después, para poder deshacerlo sin adivinar. La tabla se
-- queda: ocupa poco y es el único rastro de que esto pasó.
CREATE TABLE IF NOT EXISTS conversions_curso_reparado (
  conversion_id  INTEGER PRIMARY KEY REFERENCES conversions(id) ON DELETE CASCADE,
  decia          VARCHAR(255),
  curso_puesto   INTEGER REFERENCES products(id),
  reparado_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Las candidatas: sin curso, con líneas, y todas sus líneas del mismo curso.
CREATE TEMP TABLE reparables ON COMMIT DROP AS
SELECT c.id AS conversion_id,
       c.producto_contratado AS decia,
       u.pid AS curso
  FROM conversions c
  JOIN LATERAL (
    SELECT MIN(i.product_id) AS pid
      FROM conversion_items i
     WHERE i.conversion_id = c.id AND i.product_id IS NOT NULL
    HAVING COUNT(DISTINCT i.product_id) = 1
  ) u ON TRUE
 WHERE c.producto_contratado_id IS NULL;

INSERT INTO conversions_curso_reparado (conversion_id, decia, curso_puesto)
SELECT conversion_id, decia, curso FROM reparables
ON CONFLICT (conversion_id) DO NOTHING;

-- El curso, y de paso el TEXTO: «1x Curso A + 1x Curso A» no le dice nada a
-- nadie, y el nombre del catálogo sí. El texto viejo queda guardado arriba.
UPDATE conversions c
   SET producto_contratado_id = r.curso,
       producto_contratado    = p.nombre,
       updated_at             = NOW()
  FROM reparables r
  JOIN products p ON p.id = r.curso
 WHERE c.id = r.conversion_id;

COMMIT;

-- Para deshacerlo, si hiciera falta:
--
--   UPDATE conversions c
--      SET producto_contratado_id = NULL,
--          producto_contratado    = r.decia
--     FROM conversions_curso_reparado r
--    WHERE r.conversion_id = c.id;
