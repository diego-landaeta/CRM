-- ============================================================
-- Migracion 013: Usuarios de plataforma (modo IA)
-- Para proyectos con type='ia' (Psicologo IA, Nutricionista IA, Tarot IA)
-- no hay pipeline de leads; solo seguimiento de quien pago / usa la plataforma.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS platform_users (
  id                  SERIAL          PRIMARY KEY,
  project_id          INTEGER         NOT NULL,
  email               VARCHAR(255)    NOT NULL,
  nombre              VARCHAR(200),
  telefono            VARCHAR(50),
  externo_id          VARCHAR(100),                           -- id en la plataforma externa (Stripe customer, ref interna, etc)
  estado_suscripcion  VARCHAR(30)     NOT NULL DEFAULT 'activa' CHECK (estado_suscripcion IN ('activa', 'cancelada', 'pausada', 'trial', 'vencida')),
  plan                VARCHAR(100),                           -- ej "Basico", "Premium"
  importe_ultimo_pago DECIMAL(12,2),
  moneda              VARCHAR(10)     NOT NULL DEFAULT 'EUR',
  fecha_alta          DATE            NOT NULL DEFAULT CURRENT_DATE,
  fecha_ultimo_pago   DATE,
  fecha_proxima_renovacion DATE,
  fecha_cancelacion   DATE,
  pais                VARCHAR(100),
  notas               TEXT,
  custom_fields       JSONB,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_pu_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT uq_pu_project_email UNIQUE (project_id, email)
);

CREATE INDEX idx_pu_project_estado ON platform_users (project_id, estado_suscripcion);
CREATE INDEX idx_pu_proxima_renov ON platform_users (fecha_proxima_renovacion) WHERE estado_suscripcion IN ('activa', 'trial');

COMMENT ON TABLE platform_users IS 'Usuarios de plataformas IA (no hay pipeline, solo tracking de pagos/suscripciones)';

COMMIT;
