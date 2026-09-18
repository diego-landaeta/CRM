-- 180 · Los cobros repetidos del libro (#135)
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ ARREGLA
--
-- 83 filas repetidas en `conversion_payments`: misma venta, mismo importe,
-- misma fecha de cobro, creadas con semanas de diferencia. 22.972,54 € que no
-- entraron dos veces. 72 de las 83 se crearon el 18/06, o sea una carga que
-- volvió a meter cobros que ya estaban.
--
-- Toda pantalla que SUMA este libro está inflada: Ventas, la gráfica de
-- ingresos, el «dinero que entró» del resumen. Reportes se libra porque usa
-- `importe_pagado` de la venta, que está bien — y por eso las dos discrepaban.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LA TRAMPA QUE HAY QUE CONOCER ANTES DE APLICAR ESTO
--
-- Borrar un cobro NO es borrar una fila suelta. De `conversion_payments`
-- cuelgan cinco cosas, y una de ellas en CASCADA:
--
--     tutor_commissions.payment_id      ON DELETE CASCADE   ← se borra con él
--     invoices.payment_id               ON DELETE SET NULL
--     conversion_installments.payment_id ON DELETE SET NULL
--     conversion_refunds.payment_id     ON DELETE SET NULL
--     stripe_payments.conversion_payment_id ON DELETE SET NULL
--
-- Un `DELETE` a lo bruto se lleva por delante la comisión de un profesor sin
-- decir nada. Por eso aquí SOLO se borra lo que no tiene NADA colgando.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ SE BORRA Y QUÉ NO
--
-- Se borra: la fila repetida —la más nueva de cada grupo— cuando no tiene
-- factura, ni comisión, ni cuota de plan de pago, ni devolución, ni cobro de
-- Stripe apuntando a ella. Se conserva SIEMPRE la más antigua, que es la que
-- se creó cuando el dinero entró de verdad.
--
-- No se borra: nada que tenga algo colgando. Esas quedan listadas al final
-- para mirarlas a mano —el issue ya avisa de una con factura emitida—.
--
-- Y el respaldo se queda: `conversion_payments_repetidos` guarda la fila
-- entera antes de tocarla, así que esto se puede deshacer.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- VER LO QUE VA A PASAR, ANTES:
--
--   SELECT c.id AS venta, l.nombre AS cliente, p.importe, p.fecha,
--          count(*) OVER (PARTITION BY p.conversion_id, p.importe, p.fecha) AS veces
--     FROM conversion_payments p
--     JOIN conversions c ON c.id = p.conversion_id
--     JOIN leads l ON l.id = c.lead_id
--    ORDER BY veces DESC, p.conversion_id;

BEGIN;

CREATE TABLE IF NOT EXISTS conversion_payments_repetidos (
  id             INTEGER PRIMARY KEY,
  conversion_id  INTEGER,
  importe        NUMERIC(10,2),
  fecha          DATE,
  notas          TEXT,
  metodo         VARCHAR(30),
  created_at     TIMESTAMPTZ,
  borrado_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Los repetidos: mismo (venta, importe, fecha). Se marca para borrar todo
-- menos el primero que se creó.
CREATE TEMP TABLE repetidos ON COMMIT DROP AS
SELECT p.*
  FROM (
    SELECT cp.*,
           ROW_NUMBER() OVER (
             PARTITION BY cp.conversion_id, cp.importe, cp.fecha
             ORDER BY cp.created_at, cp.id
           ) AS puesto
      FROM conversion_payments cp
  ) p
 WHERE p.puesto > 1;

-- De esos, los que no tienen NADA colgando. El resto se quedan.
CREATE TEMP TABLE borrables ON COMMIT DROP AS
SELECT r.*
  FROM repetidos r
 WHERE NOT EXISTS (SELECT 1 FROM invoices                i WHERE i.payment_id = r.id)
   AND NOT EXISTS (SELECT 1 FROM tutor_commissions       t WHERE t.payment_id = r.id)
   AND NOT EXISTS (SELECT 1 FROM conversion_installments n WHERE n.payment_id = r.id)
   AND NOT EXISTS (SELECT 1 FROM conversion_refunds      d WHERE d.payment_id = r.id)
   AND NOT EXISTS (SELECT 1 FROM stripe_payments         s WHERE s.conversion_payment_id = r.id);

INSERT INTO conversion_payments_repetidos
  (id, conversion_id, importe, fecha, notas, metodo, created_at)
SELECT id, conversion_id, importe, fecha, notas, metodo, created_at FROM borrables
ON CONFLICT (id) DO NOTHING;

DELETE FROM conversion_payments p USING borrables b WHERE p.id = b.id;

-- Decir en voz alta qué ha pasado y qué queda. Una migración que arregla
-- dinero y no cuenta cuánto ha tocado obliga a fiarse de ella.
DO $$
DECLARE
  borrados INTEGER;
  quedan   INTEGER;
  euros    NUMERIC;
BEGIN
  SELECT count(*), COALESCE(sum(importe), 0) INTO borrados, euros
    FROM conversion_payments_repetidos WHERE borrado_at > NOW() - INTERVAL '1 minute';
  SELECT count(*) INTO quedan FROM repetidos r
   WHERE NOT EXISTS (SELECT 1 FROM borrables b WHERE b.id = r.id);

  RAISE NOTICE 'Cobros repetidos borrados: % (% EUR)', borrados, euros;
  IF quedan > 0 THEN
    RAISE NOTICE 'Quedan % repetidos SIN tocar: tienen factura, comision, cuota, devolucion o cobro de Stripe colgando. Se miran a mano.', quedan;
  END IF;
END $$;

-- Que no vuelva a pasar. Dos cuotas iguales en FECHAS distintas son un plan de
-- pago normal y se dejan pasar; dos idénticas el MISMO día, no.
--
-- Solo se crea si de verdad no quedan repetidos: si alguno se quedó fuera por
-- tener factura, el índice no se puede crear y no se debe hacer fallar la
-- migración por eso. Se avisa y se crea cuando se resuelva a mano.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM conversion_payments
     GROUP BY conversion_id, importe, fecha HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'No se crea el indice unico todavia: aun hay repetidos que se miran a mano.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_cobro_venta_importe_fecha
      ON conversion_payments (conversion_id, importe, fecha);
    RAISE NOTICE 'Indice unico creado: un mismo cobro no se puede repetir el mismo dia.';
  END IF;
END $$;

COMMIT;

-- Para deshacerlo:
--
--   INSERT INTO conversion_payments (id, conversion_id, importe, fecha, notas, metodo, created_at)
--   SELECT id, conversion_id, importe, fecha, notas, metodo, created_at
--     FROM conversion_payments_repetidos;
--   SELECT setval('conversion_payments_id_seq', (SELECT max(id) FROM conversion_payments));
--
-- (Y borrar antes el indice unico si se creó.)
