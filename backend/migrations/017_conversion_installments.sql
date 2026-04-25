-- ============================================================
-- Migracion 017: Cuotas en cuentas por cobrar (CRM-183)
-- Cada conversion fraccionada puede tener N cuotas con fechas
-- de vencimiento y cobro reales separadas.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS conversion_installments (
  id                 SERIAL          PRIMARY KEY,
  conversion_id      INTEGER         NOT NULL,
  numero             INTEGER         NOT NULL,
  importe_previsto   DECIMAL(12,2)   NOT NULL CHECK (importe_previsto > 0),
  fecha_vencimiento  DATE            NOT NULL,
  fecha_cobro        DATE,
  importe_cobrado    DECIMAL(12,2),
  metodo             VARCHAR(50),
  enviar_email       BOOLEAN         NOT NULL DEFAULT false,
  email_enviado_at   TIMESTAMPTZ,
  payment_id         INTEGER,
  notas              TEXT,
  created_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_inst_conversion FOREIGN KEY (conversion_id) REFERENCES conversions(id) ON DELETE CASCADE,
  CONSTRAINT fk_inst_payment    FOREIGN KEY (payment_id) REFERENCES conversion_payments(id) ON DELETE SET NULL,
  CONSTRAINT uq_inst_conversion_numero UNIQUE (conversion_id, numero)
);

CREATE INDEX idx_inst_vencimiento ON conversion_installments (fecha_vencimiento) WHERE fecha_cobro IS NULL;
CREATE INDEX idx_inst_conversion ON conversion_installments (conversion_id);

COMMENT ON TABLE conversion_installments IS 'Cuotas previstas de una conversion fraccionada. fecha_cobro NULL = pendiente.';

COMMIT;
