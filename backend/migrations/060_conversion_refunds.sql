-- ============================================================
-- Migración 060: devoluciones (refunds) por conversión
-- ============================================================
-- FASE DE PRUEBA — no usar todavía en operativa real.
-- Permite registrar devoluciones parciales o totales sobre una conversion
-- ya existente. NO reescribe importe_pagado para no romper contabilidad
-- legacy; el neto se calcula en la lectura (importe_pagado - SUM(refunds)).
-- ============================================================

CREATE TABLE IF NOT EXISTS conversion_refunds (
  id              SERIAL PRIMARY KEY,
  conversion_id   INTEGER NOT NULL REFERENCES conversions(id) ON DELETE CASCADE,
  importe         NUMERIC(12,2) NOT NULL CHECK (importe > 0),
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  motivo          TEXT,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversion_refunds_conversion
  ON conversion_refunds(conversion_id, fecha DESC);

COMMENT ON TABLE conversion_refunds IS 'Devoluciones registradas sobre conversiones. Fase de prueba. El importe se resta del neto al leer pero no modifica importe_pagado.';
