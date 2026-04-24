-- ============================================================
-- Migracion 011: Panel de comisiones por gestora (CRM-129)
-- - commission_rules: regla "este gestor cobra X% por este producto"
-- - commissions: registro de comision generada por cada conversion
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS commission_rules (
  id          SERIAL          PRIMARY KEY,
  project_id  INTEGER         NOT NULL,
  user_id     INTEGER         NOT NULL,
  product_id  INTEGER         NOT NULL,
  pct         DECIMAL(5,2)    NOT NULL CHECK (pct >= 0 AND pct <= 100),
  active      BOOLEAN         NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cr_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_cr_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_cr_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT uq_cr_user_product UNIQUE (user_id, product_id)
);

CREATE INDEX idx_cr_project_user ON commission_rules (project_id, user_id, active);

CREATE TABLE IF NOT EXISTS commissions (
  id              SERIAL          PRIMARY KEY,
  conversion_id   INTEGER         NOT NULL,
  rule_id         INTEGER,
  user_id         INTEGER         NOT NULL,
  product_id      INTEGER,
  importe_base    DECIMAL(12,2)   NOT NULL,
  pct             DECIMAL(5,2)    NOT NULL,
  importe_comision DECIMAL(12,2)  NOT NULL,
  estado          VARCHAR(20)     NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado', 'cancelado')),
  fecha_pago      DATE,
  notas           TEXT,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_co_conversion FOREIGN KEY (conversion_id) REFERENCES conversions(id) ON DELETE CASCADE,
  CONSTRAINT fk_co_rule       FOREIGN KEY (rule_id)       REFERENCES commission_rules(id) ON DELETE SET NULL,
  CONSTRAINT fk_co_user       FOREIGN KEY (user_id)       REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_co_product    FOREIGN KEY (product_id)    REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT uq_co_conversion UNIQUE (conversion_id)
);

CREATE INDEX idx_co_user_estado ON commissions (user_id, estado);
CREATE INDEX idx_co_created ON commissions (created_at);

COMMENT ON TABLE commission_rules IS 'Reglas: gestor X cobra Y% por producto Z. Lo define superadmin.';
COMMENT ON TABLE commissions IS 'Comisiones generadas automaticamente al crear/pagar una conversion.';

COMMIT;
