-- ============================================================
-- Seed BETA demo (CRM-193)
-- Llena Psiko Aprende (id=1, CRM) y Psicologo IA (id=4, IA)
-- con datos realistas para probar todas las features.
--
-- Idempotente: se puede re-ejecutar sin duplicar (usa ON CONFLICT / DELETE previo selectivo)
-- No ejecutar en produccion (crm_db)
-- ============================================================

BEGIN;

-- ============================================================
-- LIMPIEZA (solo datos transaccionales, mantiene users + projects)
-- ============================================================
TRUNCATE TABLE commissions RESTART IDENTITY CASCADE;
TRUNCATE TABLE commission_rules RESTART IDENTITY CASCADE;
TRUNCATE TABLE conversion_payments RESTART IDENTITY CASCADE;
TRUNCATE TABLE conversions RESTART IDENTITY CASCADE;
TRUNCATE TABLE accounts_payable_payments RESTART IDENTITY CASCADE;
TRUNCATE TABLE accounts_payable RESTART IDENTITY CASCADE;
TRUNCATE TABLE expenses RESTART IDENTITY CASCADE;
TRUNCATE TABLE lead_interactions RESTART IDENTITY CASCADE;
TRUNCATE TABLE lead_reminders RESTART IDENTITY CASCADE;
TRUNCATE TABLE lead_status_history RESTART IDENTITY CASCADE;
TRUNCATE TABLE lead_utms RESTART IDENTITY CASCADE;
TRUNCATE TABLE leads RESTART IDENTITY CASCADE;
TRUNCATE TABLE dossiers RESTART IDENTITY CASCADE;
TRUNCATE TABLE products RESTART IDENTITY CASCADE;
TRUNCATE TABLE product_categories RESTART IDENTITY CASCADE;

-- ============================================================
-- PSIKO APRENDE (project_id=1, CRM)
-- ============================================================

-- Categorias (nivel 1 + 2)
INSERT INTO product_categories (project_id, parent_id, nombre, orden) VALUES
  (1, NULL, 'Formaciones Online', 1),
  (1, NULL, 'Talleres Presenciales', 2),
  (1, NULL, 'Masters', 3);

INSERT INTO product_categories (project_id, parent_id, nombre, orden) VALUES
  (1, 1, 'Cursos Cortos', 1),
  (1, 1, 'Programas Largos', 2),
  (1, 2, 'Fin de semana', 1),
  (1, 2, 'Intensivos', 2);

-- Productos (6 en Psiko)
INSERT INTO products (project_id, nombre, descripcion, precio, moneda, stripe_link, sku, duracion, url_info, categoria_id, subcategoria_id, active)
VALUES
  (1, 'Master Neuroeducacion', 'Formacion completa de 9 meses en neuroeducacion aplicada', 1200.00, 'EUR', 'https://buy.stripe.com/test_master_neuro', 'MN-2026', '9 meses', 'https://psikoaprende.com/master-neuroeducacion', 3, NULL, true),
  (1, 'Curso Psicologia Infantil', 'Curso online de 8 semanas en psicologia del desarrollo', 299.00, 'EUR', 'https://buy.stripe.com/test_psico_infantil', 'PI-2026', '8 semanas', 'https://psikoaprende.com/psicologia-infantil', 1, 4, true),
  (1, 'Taller Mindfulness Educativo', 'Taller intensivo de 2 dias para educadores', 89.00, 'EUR', 'https://buy.stripe.com/test_mindful', 'MFE-2026', '2 dias', 'https://psikoaprende.com/mindfulness', 2, 6, true),
  (1, 'Programa Coaching Educativo', 'Programa largo de 6 meses en coaching educativo', 850.00, 'EUR', 'https://buy.stripe.com/test_coaching', 'PCE-2026', '6 meses', 'https://psikoaprende.com/coaching', 1, 5, true),
  (1, 'Taller Neurociencia para Docentes', 'Fin de semana intensivo, 12 horas lectivas', 150.00, 'EUR', 'https://buy.stripe.com/test_neuro_docentes', 'TND-2026', '12 horas', 'https://psikoaprende.com/neuro-docentes', 2, 7, true),
  (1, 'Curso Gestion del Aula', 'Curso online de 4 semanas', 180.00, 'EUR', 'https://buy.stripe.com/test_gestion_aula', 'CGA-2026', '4 semanas', 'https://psikoaprende.com/gestion-aula', 1, 4, true);

-- Leads (12 en distintos estados, asignados entre Laura 8 y Carlos 9)
INSERT INTO leads (project_id, nombre, email, telefono, producto_interes_id, responsable_id, status, reincidente, notas, created_at) VALUES
  (1, 'Maria Garcia Lopez', 'maria.garcia@gmail.com', '+34600111222', 1, 8, 'convertido', false, 'Interesada desde hace 3 meses', NOW() - INTERVAL '25 days'),
  (1, 'Juan Perez Martinez', 'juan.perez@hotmail.com', '+34600333444', 2, 9, 'convertido', false, 'Pago inicial hecho', NOW() - INTERVAL '20 days'),
  (1, 'Ana Rodriguez Diaz', 'ana.rodriguez@yahoo.es', '+34611555666', 1, 8, 'convertido', false, 'Compra paraguas', NOW() - INTERVAL '18 days'),
  (1, 'Carlos Sanchez Ruiz', 'carlos.sanchez@gmail.com', '+34622777888', 3, 9, 'convertido', false, 'Taller presencial', NOW() - INTERVAL '15 days'),
  (1, 'Elena Martinez Gomez', 'elena.m@outlook.com', '+34633999000', 4, 8, 'convertido', false, 'Pago parcial', NOW() - INTERVAL '12 days'),
  (1, 'Pablo Fernandez Ortiz', 'pablo.f@gmail.com', '+34644111333', 1, 9, 'en_seguimiento', false, 'Pendiente de decision', NOW() - INTERVAL '8 days'),
  (1, 'Laura Gonzalez Vega', 'laura.g@gmail.com', '+34655222444', 2, 8, 'en_seguimiento', false, 'Quiere hablar con antiguos alumnos', NOW() - INTERVAL '7 days'),
  (1, 'David Lopez Moreno', 'david.l@hotmail.com', '+34666333555', 5, 9, 'contactado', false, 'Llamada prevista jueves', NOW() - INTERVAL '5 days'),
  (1, 'Sofia Jimenez Torres', 'sofia.j@gmail.com', '+34677444666', 3, 8, 'contactado', false, 'Interesada en fin de semana', NOW() - INTERVAL '4 days'),
  (1, 'Miguel Alvarez Cano', 'miguel.a@outlook.com', '+34688555777', 6, 9, 'por_contactar', false, 'Llego ayer', NOW() - INTERVAL '2 days'),
  (1, 'Isabel Romero Blanco', 'isabel.r@yahoo.es', '+34699666888', 1, 8, 'nuevo', false, 'Llego por instagram', NOW() - INTERVAL '1 day'),
  (1, 'Alberto Muñoz Gil', 'alberto.m@gmail.com', '+34600777999', NULL, NULL, 'no_interesado', false, 'No respondio tras 3 intentos', NOW() - INTERVAL '10 days');

-- UTMs de algunos leads
INSERT INTO lead_utms (lead_id, utm_source, utm_medium, utm_campaign, canal_detectado, landing_url) VALUES
  (1, 'google', 'cpc', 'master-neuro-oct', 'google_ads', 'https://psikoaprende.com/master-neuroeducacion'),
  (2, 'facebook', 'cpc', 'promo-otono', 'meta_ads', 'https://psikoaprende.com/psico-infantil'),
  (3, 'instagram', 'organic', 'organic-ig', 'organico', 'https://psikoaprende.com'),
  (4, 'google', 'organic', NULL, 'organico', 'https://psikoaprende.com/mindfulness'),
  (5, 'facebook', 'cpc', 'coaching-marzo', 'meta_ads', 'https://psikoaprende.com/coaching'),
  (11, 'instagram', 'cpc', 'promo-bf', 'meta_ads', 'https://psikoaprende.com');

-- Commission rules para Laura + Carlos (usa la tabla actual con UNIQUE user_id+product_id)
INSERT INTO commission_rules (project_id, user_id, product_id, pct) VALUES
  (1, 8, 1, 12.00),  -- Laura en Master Neuro 12%
  (1, 8, 2, 15.00),  -- Laura en Psico Infantil 15%
  (1, 8, 4, 10.00),  -- Laura en Coaching 10%
  (1, 9, 2, 15.00),  -- Carlos en Psico Infantil 15%
  (1, 9, 3, 20.00),  -- Carlos en Mindfulness 20%
  (1, 9, 5, 18.00);  -- Carlos en Neuro Docentes 18%

-- Conversions (5 en Psiko)
INSERT INTO conversions (lead_id, project_id, producto_contratado, producto_contratado_id, importe_total, importe_pagado, metodo_pago, fecha_conversion, notas_pago) VALUES
  (1, 1, 'Master Neuroeducacion', 1, 1200.00, 1200.00, 'tarjeta', CURRENT_DATE - 24, 'Pago completo Stripe'),
  (2, 1, 'Curso Psicologia Infantil', 2, 299.00, 299.00, 'transferencia', CURRENT_DATE - 19, 'Pago completo'),
  (3, 1, 'Master Neuroeducacion', 1, 1200.00, 600.00, 'fraccionado', CURRENT_DATE - 17, 'Pago inicial 50%, resta 2 cuotas de 300'),
  (4, 1, 'Taller Mindfulness Educativo', 3, 89.00, 89.00, 'tarjeta', CURRENT_DATE - 14, 'Pago tarjeta'),
  (5, 1, 'Programa Coaching Educativo', 4, 850.00, 425.00, 'fraccionado', CURRENT_DATE - 11, 'Pago inicial 50%, 1 cuota pendiente');

-- Conversion payments
INSERT INTO conversion_payments (conversion_id, importe, fecha, notas) VALUES
  (1, 1200.00, CURRENT_DATE - 24, 'Pago completo'),
  (2, 299.00, CURRENT_DATE - 19, 'Pago completo'),
  (3, 600.00, CURRENT_DATE - 17, 'Pago inicial 50%'),
  (4, 89.00, CURRENT_DATE - 14, 'Pago completo'),
  (5, 425.00, CURRENT_DATE - 11, 'Pago inicial 50%');

-- Commissions generadas (una por conversion con regla)
INSERT INTO commissions (conversion_id, rule_id, user_id, product_id, importe_base, pct, importe_comision, estado, fecha_pago)
SELECT cv.id, cr.id, l.responsable_id, cv.producto_contratado_id, cv.importe_pagado, cr.pct,
       ROUND(cv.importe_pagado * cr.pct / 100, 2),
       CASE WHEN cv.id <= 2 THEN 'pagado' ELSE 'pendiente' END,
       CASE WHEN cv.id <= 2 THEN CURRENT_DATE - 10 ELSE NULL END
FROM conversions cv
JOIN leads l ON l.id = cv.lead_id
JOIN commission_rules cr ON cr.user_id = l.responsable_id AND cr.product_id = cv.producto_contratado_id
WHERE cv.project_id = 1;

-- Egresos en Psiko
INSERT INTO expenses (project_id, concepto, importe, fecha, categoria, notas, registrado_por) VALUES
  (1, 'Alquiler oficina marzo', 850.00, CURRENT_DATE - 25, 'alquiler', 'Contrato anual', 1),
  (1, 'Suscripcion Notion Team', 40.00, CURRENT_DATE - 20, 'software', '4 usuarios', 1),
  (1, 'Campaña Google Ads febrero', 1200.00, CURRENT_DATE - 15, 'publicidad', 'CPC promedio 0.45€', 1),
  (1, 'Proveedor impresion brochures', 320.00, CURRENT_DATE - 10, 'proveedores', 'Factura 2026-0215', 2),
  (1, 'Servicio contable trimestral', 180.00, CURRENT_DATE - 5, 'servicios', NULL, 1);

-- Accounts payable
INSERT INTO accounts_payable (project_id, proveedor, concepto, categoria, importe_total, importe_pagado, fecha_factura, fecha_compromiso_pago, estado, registrado_por) VALUES
  (1, 'Mailchimp Inc', 'Suscripcion Email Marketing anual', 'software', 240.00, 0, CURRENT_DATE - 10, CURRENT_DATE + 20, 'pendiente', 1),
  (1, 'Imprenta Rapida SL', 'Brochures evento presencial', 'proveedores', 580.00, 300.00, CURRENT_DATE - 15, CURRENT_DATE + 5, 'parcial', 1);

INSERT INTO accounts_payable_payments (payable_id, importe, fecha_pago, metodo, notas) VALUES
  (2, 300.00, CURRENT_DATE - 7, 'transferencia', 'Primer pago parcial');

-- ============================================================
-- PSICOLOGO IA (project_id=4, IA)
-- ============================================================

-- Productos/Planes (3)
INSERT INTO products (project_id, nombre, descripcion, precio, moneda, stripe_link, sku, duracion, active) VALUES
  (4, 'Plan Basico', 'Acceso a 50 consultas IA mensuales', 9.90, 'EUR', 'https://buy.stripe.com/test_basico', 'PIA-B', 'Mensual', true),
  (4, 'Plan Premium', 'Consultas ilimitadas + historial', 29.90, 'EUR', 'https://buy.stripe.com/test_premium', 'PIA-P', 'Mensual', true),
  (4, 'Plan Anual', 'Premium con descuento anual', 299.00, 'EUR', 'https://buy.stripe.com/test_anual', 'PIA-A', 'Anual', true);

-- Leads convertidos (usuarios que se suscribieron)
INSERT INTO leads (project_id, nombre, email, telefono, producto_interes_id, status, created_at) VALUES
  (4, 'Patricia Herrera', 'patricia.h@gmail.com', '+34611000111', 7, 'convertido', NOW() - INTERVAL '30 days'),
  (4, 'Roberto Casas', 'roberto.c@outlook.com', '+34622000222', 8, 'convertido', NOW() - INTERVAL '25 days'),
  (4, 'Beatriz Nieto', 'beatriz.n@yahoo.es', '+34633000333', 9, 'convertido', NOW() - INTERVAL '20 days'),
  (4, 'Daniel Serrano', 'daniel.s@gmail.com', '+34644000444', 8, 'convertido', NOW() - INTERVAL '15 days'),
  (4, 'Cristina Molina', 'cristina.m@hotmail.com', '+34655000555', 7, 'convertido', NOW() - INTERVAL '10 days'),
  (4, 'Sergio Vazquez', 'sergio.v@gmail.com', '+34666000666', 8, 'convertido', NOW() - INTERVAL '5 days');

-- Conversiones de suscripcion
INSERT INTO conversions (lead_id, project_id, producto_contratado, producto_contratado_id, importe_total, importe_pagado, metodo_pago, fecha_conversion, notas_pago) VALUES
  ((SELECT id FROM leads WHERE email='patricia.h@gmail.com'), 4, 'Plan Basico', 7, 9.90, 9.90, 'tarjeta', CURRENT_DATE - 30, 'Auto-renovacion mensual'),
  ((SELECT id FROM leads WHERE email='roberto.c@outlook.com'), 4, 'Plan Premium', 8, 29.90, 29.90, 'tarjeta', CURRENT_DATE - 25, 'Stripe subscription'),
  ((SELECT id FROM leads WHERE email='beatriz.n@yahoo.es'), 4, 'Plan Anual', 9, 299.00, 299.00, 'tarjeta', CURRENT_DATE - 20, 'Pago unico anual'),
  ((SELECT id FROM leads WHERE email='daniel.s@gmail.com'), 4, 'Plan Premium', 8, 29.90, 29.90, 'tarjeta', CURRENT_DATE - 15, NULL),
  ((SELECT id FROM leads WHERE email='cristina.m@hotmail.com'), 4, 'Plan Basico', 7, 9.90, 9.90, 'tarjeta', CURRENT_DATE - 10, NULL),
  ((SELECT id FROM leads WHERE email='sergio.v@gmail.com'), 4, 'Plan Premium', 8, 29.90, 29.90, 'tarjeta', CURRENT_DATE - 5, NULL);

-- Conversion payments
INSERT INTO conversion_payments (conversion_id, importe, fecha, notas)
SELECT id, importe_pagado, fecha_conversion, 'Pago inicial' FROM conversions WHERE project_id = 4;

-- Egresos en Psicologo IA
INSERT INTO expenses (project_id, concepto, importe, fecha, categoria, notas, registrado_por) VALUES
  (4, 'OpenAI API mes marzo', 120.00, CURRENT_DATE - 20, 'software', 'Modelo GPT-4', 1),
  (4, 'Hosting Vercel Pro', 20.00, CURRENT_DATE - 15, 'software', NULL, 1),
  (4, 'Dominio anual', 12.00, CURRENT_DATE - 10, 'servicios', 'Renovacion psicologoia.com', 1);

COMMIT;

-- ============================================================
-- VERIFICAR TODO
-- ============================================================
SELECT 'projects' as tabla, COUNT(*) as n FROM projects
UNION ALL SELECT 'product_categories', COUNT(*) FROM product_categories
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'leads', COUNT(*) FROM leads
UNION ALL SELECT 'lead_utms', COUNT(*) FROM lead_utms
UNION ALL SELECT 'conversions', COUNT(*) FROM conversions
UNION ALL SELECT 'conversion_payments', COUNT(*) FROM conversion_payments
UNION ALL SELECT 'commission_rules', COUNT(*) FROM commission_rules
UNION ALL SELECT 'commissions', COUNT(*) FROM commissions
UNION ALL SELECT 'expenses', COUNT(*) FROM expenses
UNION ALL SELECT 'accounts_payable', COUNT(*) FROM accounts_payable
UNION ALL SELECT 'accounts_payable_payments', COUNT(*) FROM accounts_payable_payments;
