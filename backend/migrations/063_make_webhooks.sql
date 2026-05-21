-- Make.com webhooks: cada proyecto puede tener N "conectores" hacia Make.
-- Make publica un payload via POST /api/webhooks/make/:slug con header X-Make-Secret.
-- El CRM puede operar en dos modos:
--   - test: guarda payload en sample_payload, NO crea lead
--   - active: aplica field_mapping → crea lead (con resolución de asesora)

CREATE TABLE IF NOT EXISTS make_webhooks (
  id                   SERIAL PRIMARY KEY,
  project_id           INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- Identificador en la URL pública. Único globalmente para que la URL sea opaca.
  slug                 VARCHAR(80) NOT NULL UNIQUE,
  -- Etiqueta humana (ej: "Form contacto Psiko - canal Instagram")
  label                VARCHAR(120) NOT NULL,
  -- Secret que Make debe enviar en header X-Make-Secret. Generado server-side.
  secret               VARCHAR(120) NOT NULL,
  -- 'test' = solo guarda payload (no crea leads). 'active' = procesa y crea.
  mode                 VARCHAR(10) NOT NULL DEFAULT 'test' CHECK (mode IN ('test','active')),
  -- Mapeo CRM_field → ruta dot-notation en el payload de Make.
  -- Ejemplo: { "nombre": "data.name", "email": "data.email",
  --            "responsable_email": "owner.email" }
  field_mapping        JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Último payload recibido (para inspección/mapping visual). Solo el más reciente.
  sample_payload       JSONB,
  sample_received_at   TIMESTAMP WITH TIME ZONE,
  -- Auditoría de uso
  total_received       INTEGER NOT NULL DEFAULT 0,
  total_created        INTEGER NOT NULL DEFAULT 0,
  total_errors         INTEGER NOT NULL DEFAULT 0,
  last_error           TEXT,
  last_received_at     TIMESTAMP WITH TIME ZONE,
  active               BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_make_webhooks_project ON make_webhooks(project_id);

-- Log de cada entrega de Make (para debug + auditoría)
CREATE TABLE IF NOT EXISTS make_webhook_deliveries (
  id                BIGSERIAL PRIMARY KEY,
  webhook_id        INTEGER NOT NULL REFERENCES make_webhooks(id) ON DELETE CASCADE,
  received_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  -- 'accepted' | 'rejected' | 'test_only'
  result            VARCHAR(20) NOT NULL,
  lead_id           INTEGER,  -- si se creó lead, su id
  error_message     TEXT,
  payload           JSONB,
  mapped            JSONB     -- resultado de aplicar field_mapping
);

CREATE INDEX IF NOT EXISTS idx_make_deliveries_webhook ON make_webhook_deliveries(webhook_id, received_at DESC);
