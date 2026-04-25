-- ============================================================
-- Seed extra para BETA: mas volumen y variedad temporal
-- Añade encima del beta_demo.sql, no trunca
-- ============================================================

BEGIN;

-- ============================================================
-- PSIKO APRENDE: mas leads, conversiones, comisiones distribuidas en 6 meses
-- ============================================================

-- 30 leads adicionales con fechas distribuidas
INSERT INTO leads (project_id, nombre, email, telefono, producto_interes_id, responsable_id, status, reincidente, notas, created_at) VALUES
  (1, 'Lucia Vargas Soto', 'lucia.v@gmail.com', '+34601111000', 1, 8, 'convertido', false, 'Conversion master neuro', NOW() - INTERVAL '180 days'),
  (1, 'Andres Pena Castro', 'andres.p@hotmail.com', '+34602222000', 2, 9, 'convertido', false, 'Pago tarjeta', NOW() - INTERVAL '170 days'),
  (1, 'Marta Diaz Lopez', 'marta.d@yahoo.es', '+34603333000', 4, 8, 'convertido', false, 'Coaching', NOW() - INTERVAL '160 days'),
  (1, 'Javier Martin Rios', 'javier.m@outlook.com', '+34604444000', 1, 9, 'convertido', true, 'Reincidente', NOW() - INTERVAL '150 days'),
  (1, 'Carmen Alonso Vega', 'carmen.a@gmail.com', '+34605555000', 3, 8, 'en_seguimiento', false, 'Pendiente decision', NOW() - INTERVAL '140 days'),
  (1, 'Roberto Crespo Gil', 'roberto.c@hotmail.com', '+34606666000', 5, 9, 'convertido', false, 'Taller fin de semana', NOW() - INTERVAL '120 days'),
  (1, 'Sara Moreno Ruiz', 'sara.m@gmail.com', '+34607777000', 1, 8, 'convertido', false, 'Master', NOW() - INTERVAL '110 days'),
  (1, 'Pedro Iglesias Soto', 'pedro.i@yahoo.es', '+34608888000', 2, 9, 'convertido', false, 'Curso completo', NOW() - INTERVAL '100 days'),
  (1, 'Rocio Navarro Diaz', 'rocio.n@outlook.com', '+34609999000', 6, 8, 'contactado', false, 'Llamada agendada', NOW() - INTERVAL '90 days'),
  (1, 'Daniel Romero Vega', 'daniel.r@gmail.com', '+34610000000', 4, 9, 'convertido', false, 'Coaching educativo', NOW() - INTERVAL '85 days'),
  (1, 'Beatriz Ortiz Crespo', 'beatriz.o@hotmail.com', '+34611111111', 1, 8, 'convertido', false, 'Master oct', NOW() - INTERVAL '75 days'),
  (1, 'Antonio Reyes Diaz', 'antonio.r@gmail.com', '+34612222222', 7, 9, 'convertido', false, 'Dislexia', NOW() - INTERVAL '70 days'),
  (1, 'Elena Castro Martinez', 'elena.c@yahoo.es', '+34613333333', 2, 8, 'convertido', false, 'Pago parcial', NOW() - INTERVAL '60 days'),
  (1, 'Manuel Fernandez Rios', 'manuel.f@outlook.com', '+34614444444', 3, 9, 'convertido', false, 'Mindfulness', NOW() - INTERVAL '55 days'),
  (1, 'Cristina Lopez Vega', 'cristina.l@gmail.com', '+34615555555', 1, 8, 'en_seguimiento', false, 'Quiere demo', NOW() - INTERVAL '50 days'),
  (1, 'Jorge Sanchez Pena', 'jorge.s@hotmail.com', '+34616666666', 5, 9, 'convertido', false, 'Neuro docentes', NOW() - INTERVAL '45 days'),
  (1, 'Patricia Vega Castro', 'patricia.v@yahoo.es', '+34617777777', 6, 8, 'convertido', false, 'Gestion aula', NOW() - INTERVAL '40 days'),
  (1, 'Fernando Crespo Gil', 'fernando.c@gmail.com', '+34618888888', 4, 9, 'no_interesado', false, 'Sin presupuesto', NOW() - INTERVAL '35 days'),
  (1, 'Marta Reyes Soto', 'marta.r@outlook.com', '+34619999999', 8, 8, 'convertido', false, 'Master miofuncional', NOW() - INTERVAL '30 days'),
  (1, 'Sergio Diaz Vega', 'sergio.d@gmail.com', '+34620000111', 1, 9, 'contactado', false, 'Esperando respuesta', NOW() - INTERVAL '25 days'),
  (1, 'Laura Pena Rios', 'laura.p@hotmail.com', '+34621000222', 2, 8, 'convertido', false, 'Pago completo', NOW() - INTERVAL '22 days'),
  (1, 'Raquel Soto Martinez', 'raquel.s@yahoo.es', '+34622000333', 3, 9, 'convertido', false, 'Mindfulness rapido', NOW() - INTERVAL '20 days'),
  (1, 'Victor Iglesias Castro', 'victor.i@gmail.com', '+34623000444', 4, 8, 'en_seguimiento', false, 'Comparando opciones', NOW() - INTERVAL '18 days'),
  (1, 'Ines Reyes Lopez', 'ines.r@outlook.com', '+34624000555', 7, 9, 'convertido', false, 'Curso dislexia', NOW() - INTERVAL '15 days'),
  (1, 'Tomas Vega Diaz', 'tomas.v@gmail.com', '+34625000666', 1, 8, 'por_contactar', false, 'Llego ayer', NOW() - INTERVAL '13 days'),
  (1, 'Helena Crespo Rios', 'helena.c@hotmail.com', '+34626000777', 5, 9, 'contactado', false, 'Llamada hoy', NOW() - INTERVAL '11 days'),
  (1, 'Gabriel Soto Vega', 'gabriel.s@yahoo.es', '+34627000888', 2, 8, 'nuevo', false, 'Lead nuevo', NOW() - INTERVAL '8 days'),
  (1, 'Natalia Diaz Castro', 'natalia.d@gmail.com', '+34628000999', 6, 9, 'nuevo', false, 'Lead nuevo', NOW() - INTERVAL '6 days'),
  (1, 'Ruben Reyes Pena', 'ruben.r@outlook.com', '+34629001000', 3, 8, 'nuevo', false, 'Sin contacto aun', NOW() - INTERVAL '4 days'),
  (1, 'Lorena Castro Lopez', 'lorena.c@gmail.com', '+34630001111', 4, 9, 'nuevo', false, 'Anoche', NOW() - INTERVAL '2 days');

-- UTMs varios para los nuevos leads (mezclando canales)
INSERT INTO lead_utms (lead_id, utm_source, utm_medium, utm_campaign, canal_detectado)
SELECT l.id,
       (ARRAY['google', 'facebook', 'instagram', 'tiktok', 'linkedin'])[1 + (l.id % 5)],
       (ARRAY['cpc', 'organic', 'cpc', 'cpc', 'organic'])[1 + (l.id % 5)],
       (ARRAY['master-2026', 'promo-otono', 'mindfulness-bf', 'coaching-q1', 'docentes-2026'])[1 + (l.id % 5)],
       (ARRAY['google_ads', 'meta_ads', 'organico', 'tiktok_ads', 'organico'])[1 + (l.id % 5)]::utm_channel
FROM leads l
WHERE l.project_id = 1
  AND l.email LIKE '%@%'
  AND NOT EXISTS (SELECT 1 FROM lead_utms WHERE lead_id = l.id);

-- Conversions para los nuevos leads convertidos (importes y fechas distribuidas)
INSERT INTO conversions (lead_id, project_id, producto_contratado, producto_contratado_id, importe_total, importe_pagado, metodo_pago, fecha_conversion, notas_pago)
SELECT l.id, 1, p.nombre, p.id,
       p.precio,
       CASE WHEN (l.id % 4) = 0 THEN p.precio * 0.5 ELSE p.precio END,
       (ARRAY['tarjeta', 'transferencia', 'fraccionado', 'tarjeta'])[1 + (l.id % 4)]::payment_method,
       l.created_at::date + INTERVAL '3 days',
       'Conversion del lead ' || l.id
FROM leads l
JOIN products p ON p.id = l.producto_interes_id
WHERE l.project_id = 1
  AND l.status = 'convertido'
  AND NOT EXISTS (SELECT 1 FROM conversions WHERE lead_id = l.id);

-- Conversion payments por cada conversion nueva (el inicial)
INSERT INTO conversion_payments (conversion_id, importe, fecha, notas)
SELECT c.id, c.importe_pagado, c.fecha_conversion, 'Pago inicial'
FROM conversions c
WHERE c.project_id = 1
  AND c.importe_pagado > 0
  AND NOT EXISTS (SELECT 1 FROM conversion_payments p WHERE p.conversion_id = c.id);

-- Commissions automaticas para esas conversions con regla de Laura/Carlos
INSERT INTO commissions (conversion_id, rule_id, user_id, product_id, importe_base, pct, importe_comision, estado, fecha_pago, base_calc)
SELECT cv.id, cr.id, l.responsable_id, cv.producto_contratado_id, cv.importe_pagado, cr.pct,
       ROUND(cv.importe_pagado * cr.pct / 100, 2),
       CASE WHEN cv.fecha_conversion < CURRENT_DATE - 30 THEN 'pagado' ELSE 'pendiente' END,
       CASE WHEN cv.fecha_conversion < CURRENT_DATE - 30 THEN cv.fecha_conversion + 15 ELSE NULL END,
       'cobrado'
FROM conversions cv
JOIN leads l ON l.id = cv.lead_id
JOIN commission_rules cr ON cr.user_id = l.responsable_id AND cr.product_id = cv.producto_contratado_id AND cr.active = true
WHERE cv.project_id = 1
  AND NOT EXISTS (SELECT 1 FROM commissions WHERE conversion_id = cv.id);

-- Mas egresos distribuidos en 6 meses
INSERT INTO expenses (project_id, concepto, importe, fecha, categoria, notas, registrado_por) VALUES
  (1, 'Alquiler oficina', 850.00, CURRENT_DATE - 180, 'alquiler', 'Mes', 1),
  (1, 'Alquiler oficina', 850.00, CURRENT_DATE - 150, 'alquiler', 'Mes', 1),
  (1, 'Alquiler oficina', 850.00, CURRENT_DATE - 120, 'alquiler', 'Mes', 1),
  (1, 'Alquiler oficina', 850.00, CURRENT_DATE - 90, 'alquiler', 'Mes', 1),
  (1, 'Alquiler oficina', 850.00, CURRENT_DATE - 60, 'alquiler', 'Mes', 1),
  (1, 'Alquiler oficina', 850.00, CURRENT_DATE - 30, 'alquiler', 'Mes', 1),
  (1, 'Google Ads campaña master', 1500.00, CURRENT_DATE - 175, 'publicidad', 'Q1', 1),
  (1, 'Google Ads campaña curso', 800.00, CURRENT_DATE - 145, 'publicidad', 'Q1', 1),
  (1, 'Facebook Ads', 950.00, CURRENT_DATE - 115, 'publicidad', 'Q1', 1),
  (1, 'Instagram Ads', 600.00, CURRENT_DATE - 80, 'publicidad', 'Q2', 1),
  (1, 'TikTok Ads piloto', 300.00, CURRENT_DATE - 55, 'publicidad', 'Q2', 1),
  (1, 'Brevo plan business', 65.00, CURRENT_DATE - 165, 'software', 'Email mensual', 1),
  (1, 'Brevo plan business', 65.00, CURRENT_DATE - 135, 'software', 'Email mensual', 1),
  (1, 'Brevo plan business', 65.00, CURRENT_DATE - 105, 'software', 'Email mensual', 1),
  (1, 'Brevo plan business', 65.00, CURRENT_DATE - 75, 'software', 'Email mensual', 1),
  (1, 'Brevo plan business', 65.00, CURRENT_DATE - 45, 'software', 'Email mensual', 1),
  (1, 'Brevo plan business', 65.00, CURRENT_DATE - 15, 'software', 'Email mensual', 1),
  (1, 'Honorarios diseñadora', 400.00, CURRENT_DATE - 100, 'servicios', 'Materiales master', 1),
  (1, 'IVA trimestral', 1200.00, CURRENT_DATE - 90, 'impuestos', 'Q1', 1),
  (1, 'Impresion certificados', 220.00, CURRENT_DATE - 50, 'proveedores', NULL, 1);

-- Algunas cuentas por pagar
INSERT INTO accounts_payable (project_id, proveedor, concepto, categoria, importe_total, importe_pagado, fecha_factura, fecha_compromiso_pago, estado, registrado_por) VALUES
  (1, 'Imprenta Diseño Pro', 'Material grafico Q2', 'proveedores', 800.00, 0, CURRENT_DATE - 5, CURRENT_DATE + 25, 'pendiente', 1),
  (1, 'Asesor fiscal', 'Servicios trimestrales', 'servicios', 350.00, 350.00, CURRENT_DATE - 30, CURRENT_DATE - 5, 'pagado', 1),
  (1, 'Cloudflare Pro', 'Suscripcion anual', 'software', 240.00, 0, CURRENT_DATE - 10, CURRENT_DATE + 20, 'pendiente', 1);

INSERT INTO accounts_payable_payments (payable_id, importe, fecha_pago, metodo, notas)
VALUES (4, 350.00, CURRENT_DATE - 5, 'transferencia', 'Pago completo');

-- ============================================================
-- PSICOLOGO IA: mas suscripciones simulando varios meses de churn
-- ============================================================

-- 15 leads/usuarios suscritos en distintos planes y fechas
INSERT INTO leads (project_id, nombre, email, telefono, producto_interes_id, status, created_at) VALUES
  (4, 'Ana Belen Cruz', 'ana.cruz@gmail.com', '+34631000111', 8, 'convertido', NOW() - INTERVAL '120 days'),
  (4, 'Pedro Vidal Moreno', 'pedro.v@hotmail.com', '+34632000222', 9, 'convertido', NOW() - INTERVAL '110 days'),
  (4, 'Lucia Marin Soto', 'lucia.m@yahoo.es', '+34633000333', 7, 'convertido', NOW() - INTERVAL '95 days'),
  (4, 'Alvaro Pena Diaz', 'alvaro.p@gmail.com', '+34634000444', 8, 'convertido', NOW() - INTERVAL '80 days'),
  (4, 'Gloria Lopez Vega', 'gloria.l@outlook.com', '+34635000555', 9, 'convertido', NOW() - INTERVAL '70 days'),
  (4, 'Hector Castro Rios', 'hector.c@gmail.com', '+34636000666', 7, 'convertido', NOW() - INTERVAL '60 days'),
  (4, 'Irene Vega Crespo', 'irene.v@hotmail.com', '+34637000777', 8, 'convertido', NOW() - INTERVAL '50 days'),
  (4, 'Joaquin Diaz Soto', 'joaquin.d@yahoo.es', '+34638000888', 8, 'convertido', NOW() - INTERVAL '45 days'),
  (4, 'Laura Reyes Pena', 'laura.r@gmail.com', '+34639000999', 7, 'convertido', NOW() - INTERVAL '40 days'),
  (4, 'Marcos Iglesias Lopez', 'marcos.i@outlook.com', '+34640001111', 9, 'convertido', NOW() - INTERVAL '35 days'),
  (4, 'Nuria Crespo Vega', 'nuria.c@gmail.com', '+34641002222', 8, 'convertido', NOW() - INTERVAL '28 days'),
  (4, 'Oscar Soto Martinez', 'oscar.s@hotmail.com', '+34642003333', 8, 'convertido', NOW() - INTERVAL '20 days'),
  (4, 'Paula Diaz Castro', 'paula.d@yahoo.es', '+34643004444', 7, 'convertido', NOW() - INTERVAL '15 days'),
  (4, 'Quim Vega Rios', 'quim.v@gmail.com', '+34644005555', 8, 'convertido', NOW() - INTERVAL '10 days'),
  (4, 'Raquel Castro Pena', 'raquel.c@outlook.com', '+34645006666', 9, 'convertido', NOW() - INTERVAL '5 days');

-- Conversions correspondientes
INSERT INTO conversions (lead_id, project_id, producto_contratado, producto_contratado_id, importe_total, importe_pagado, metodo_pago, fecha_conversion, notas_pago)
SELECT l.id, 4, p.nombre, p.id,
       p.precio, p.precio,
       'tarjeta'::payment_method,
       l.created_at::date + INTERVAL '1 day',
       'Suscripcion ' || p.nombre
FROM leads l
JOIN products p ON p.id = l.producto_interes_id
WHERE l.project_id = 4
  AND NOT EXISTS (SELECT 1 FROM conversions WHERE lead_id = l.id);

-- Conversion payments
INSERT INTO conversion_payments (conversion_id, importe, fecha, notas)
SELECT c.id, c.importe_pagado, c.fecha_conversion, 'Pago suscripcion'
FROM conversions c
WHERE c.project_id = 4
  AND NOT EXISTS (SELECT 1 FROM conversion_payments WHERE conversion_id = c.id);

-- Mas egresos IA distribuidos
INSERT INTO expenses (project_id, concepto, importe, fecha, categoria, notas, registrado_por) VALUES
  (4, 'OpenAI API', 180.00, CURRENT_DATE - 120, 'software', 'GPT-4 mensual', 1),
  (4, 'OpenAI API', 220.00, CURRENT_DATE - 90, 'software', 'GPT-4 mensual', 1),
  (4, 'OpenAI API', 280.00, CURRENT_DATE - 60, 'software', 'GPT-4 mensual', 1),
  (4, 'OpenAI API', 320.00, CURRENT_DATE - 30, 'software', 'GPT-4 mensual', 1),
  (4, 'Vercel Pro', 20.00, CURRENT_DATE - 100, 'software', 'Hosting', 1),
  (4, 'Vercel Pro', 20.00, CURRENT_DATE - 70, 'software', 'Hosting', 1),
  (4, 'Vercel Pro', 20.00, CURRENT_DATE - 40, 'software', 'Hosting', 1),
  (4, 'Vercel Pro', 20.00, CURRENT_DATE - 10, 'software', 'Hosting', 1),
  (4, 'Stripe fees Q1', 95.00, CURRENT_DATE - 80, 'servicios', '1.5% + fee fijo', 1),
  (4, 'Stripe fees Q2', 140.00, CURRENT_DATE - 20, 'servicios', '1.5% + fee fijo', 1);

COMMIT;

SELECT 'projects' as tabla, COUNT(*) FROM projects
UNION ALL SELECT 'leads', COUNT(*) FROM leads
UNION ALL SELECT 'leads_psiko', COUNT(*) FROM leads WHERE project_id = 1
UNION ALL SELECT 'leads_psicoia', COUNT(*) FROM leads WHERE project_id = 4
UNION ALL SELECT 'lead_utms', COUNT(*) FROM lead_utms
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'conversions', COUNT(*) FROM conversions
UNION ALL SELECT 'conversion_payments', COUNT(*) FROM conversion_payments
UNION ALL SELECT 'commissions', COUNT(*) FROM commissions
UNION ALL SELECT 'commissions_pagadas', COUNT(*) FROM commissions WHERE estado = 'pagado'
UNION ALL SELECT 'expenses', COUNT(*) FROM expenses
UNION ALL SELECT 'expenses_psiko', COUNT(*) FROM expenses WHERE project_id = 1
UNION ALL SELECT 'expenses_psicoia', COUNT(*) FROM expenses WHERE project_id = 4
UNION ALL SELECT 'accounts_payable', COUNT(*) FROM accounts_payable
UNION ALL SELECT 'commission_rules', COUNT(*) FROM commission_rules;
