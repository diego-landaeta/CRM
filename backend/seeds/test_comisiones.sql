-- ============================================================
-- Seed de prueba para comisiones (ejecutar en crm_test_db)
-- Precios a productos + commission_rules + user_projects + leads + conversions
-- ============================================================

BEGIN;

-- 1) Precios a productos que no tienen
UPDATE products SET precio = 299.00 WHERE id = 1;  -- Psico Infantil
UPDATE products SET precio = 1200.00 WHERE id = 2; -- Master Neuroeducacion
UPDATE products SET precio = 89.00 WHERE id = 3;   -- Mindfulness
UPDATE products SET precio = 2500.00 WHERE id = 4; -- Grado Superior
UPDATE products SET precio = 450.00 WHERE id = 5;  -- Atencion Temprana
UPDATE products SET precio = 180.00 WHERE id = 6;  -- Logopedia
UPDATE products SET precio = 395.00 WHERE id = 7;  -- Dislexia
UPDATE products SET precio = 1800.00 WHERE id = 8; -- Terapia Miofuncional
UPDATE products SET precio = 29.90 WHERE id = 9;   -- Plan Basico IA
UPDATE products SET precio = 49.90 WHERE id = 10;  -- Plan Premium IA

-- 2) Asignar gestoras a proyectos CRM (si no estan ya)
INSERT INTO user_projects (user_id, project_id)
  VALUES (8, 1), (8, 2), (8, 3), (9, 1), (9, 2), (9, 3)
  ON CONFLICT DO NOTHING;

-- 3) Commission rules: Laura y Carlos cobran distinto por producto
INSERT INTO commission_rules (project_id, user_id, product_id, pct) VALUES
  (1, 8, 1, 15.00),   -- Laura en Curso Psico Infantil 15%
  (1, 8, 2, 10.00),   -- Laura en Master Neuroeducacion 10%
  (1, 9, 1, 12.00),   -- Carlos en Curso Psico Infantil 12%
  (1, 9, 3, 20.00),   -- Carlos en Mindfulness 20%
  (2, 8, 4, 8.00),    -- Laura en Grado Superior 8%
  (2, 9, 5, 15.00),   -- Carlos en Atencion Temprana 15%
  (3, 8, 6, 18.00),   -- Laura en Logopedia 18%
  (3, 8, 7, 15.00),   -- Laura en Dislexia 15%
  (3, 9, 8, 10.00)    -- Carlos en Terapia Miofuncional 10%
ON CONFLICT (user_id, product_id) DO UPDATE SET pct = EXCLUDED.pct;

-- 4) Actualizar algunos leads existentes para que tengan responsable y producto
-- Para generar conversiones de prueba, tomaremos leads random y los asignaremos
WITH candidates AS (
  SELECT id, project_id FROM leads
  WHERE status IN ('nuevo', 'por_contactar', 'contactado', 'en_seguimiento')
  ORDER BY created_at DESC LIMIT 8
)
UPDATE leads l SET
  responsable_id = CASE WHEN (l.id % 2) = 0 THEN 8 ELSE 9 END,
  producto_interes_id = CASE l.project_id
    WHEN 1 THEN 1
    WHEN 2 THEN 4
    WHEN 3 THEN 6
    ELSE NULL
  END
FROM candidates c
WHERE l.id = c.id;

-- 5) Crear conversiones de prueba para los primeros 5 leads asignados
--    (varia entre Laura y Carlos, pago completo y parcial)
INSERT INTO conversions (lead_id, project_id, producto_contratado, producto_contratado_id, importe_total, importe_pagado, metodo_pago, fecha_conversion)
SELECT l.id, l.project_id, p.nombre, p.id,
       p.precio,
       CASE WHEN (l.id % 3) = 0 THEN p.precio ELSE p.precio * 0.5 END,
       CASE WHEN (l.id % 2) = 0 THEN 'tarjeta'::payment_method ELSE 'transferencia'::payment_method END,
       CURRENT_DATE - ((l.id % 30) || ' days')::interval
FROM leads l
JOIN products p ON p.id = l.producto_interes_id
WHERE l.responsable_id IN (8, 9)
  AND l.producto_interes_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM conversions c WHERE c.lead_id = l.id)
ORDER BY l.id
LIMIT 6;

-- 6) Cambiar status de esos leads a convertido
UPDATE leads SET status = 'convertido'
WHERE id IN (SELECT lead_id FROM conversions);

-- 7) Crear conversion_payments (el pago inicial)
INSERT INTO conversion_payments (conversion_id, importe, fecha, notas)
SELECT c.id, c.importe_pagado, c.fecha_conversion, 'Pago inicial (seed)'
FROM conversions c
WHERE c.importe_pagado > 0
  AND NOT EXISTS (SELECT 1 FROM conversion_payments p WHERE p.conversion_id = c.id);

-- 8) Crear las comisiones manualmente (el hook auto solo dispara en CREATE via API)
INSERT INTO commissions (conversion_id, rule_id, user_id, product_id, importe_base, pct, importe_comision)
SELECT
  cv.id,
  cr.id,
  l.responsable_id,
  cv.producto_contratado_id,
  cv.importe_pagado,
  cr.pct,
  ROUND(cv.importe_pagado * cr.pct / 100, 2)
FROM conversions cv
JOIN leads l ON l.id = cv.lead_id
JOIN commission_rules cr
  ON cr.user_id = l.responsable_id
  AND cr.product_id = cv.producto_contratado_id
  AND cr.active = true
ON CONFLICT (conversion_id) DO UPDATE
  SET importe_base = EXCLUDED.importe_base,
      importe_comision = EXCLUDED.importe_comision,
      pct = EXCLUDED.pct,
      updated_at = NOW();

-- 9) Marcar una comision como pagada para probar estado
UPDATE commissions SET estado = 'pagado', fecha_pago = CURRENT_DATE - INTERVAL '5 days'
WHERE id = (SELECT id FROM commissions ORDER BY id LIMIT 1);

COMMIT;
