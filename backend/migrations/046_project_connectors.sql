-- ============================================================
-- Migración 046: Conectores configurables por proyecto
-- Sistema flexible para conectar APIs externas (WC, ACF, WP REST, custom)
-- y mapear campos antes de importar (preview + mapping + import)
-- ============================================================

CREATE TABLE IF NOT EXISTS project_connectors (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type          VARCHAR(40) NOT NULL,
    -- 'woocommerce_products' | 'woocommerce_orders' | 'wp_rest' | 'acf' | 'custom_api'
  label         VARCHAR(150) NOT NULL,         -- "Productos Psiko WC" o "Cursos del blog"
  destination   VARCHAR(40) NOT NULL DEFAULT 'product',
    -- 'product' | 'lead' | 'matricula' | 'category'  (a qué tabla del CRM va)
  config        JSONB NOT NULL DEFAULT '{}',
    -- { base_url, consumer_key, consumer_secret, headers, query_params, auth_type, etc }
  field_mapping JSONB NOT NULL DEFAULT '{}',
    -- { crm_field: 'json.path.to.value' }  ej: { nombre: 'name', precio: 'price', sku: 'sku' }
  sample_payload JSONB,                         -- payload de un item descargado para hacer mapping visual
  sample_received_at TIMESTAMPTZ,
  active        BOOLEAN NOT NULL DEFAULT true,
  last_sync_at  TIMESTAMPTZ,
  last_sync_status VARCHAR(20),                 -- 'success' | 'error' | 'partial'
  last_sync_count INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connectors_project_active
  ON project_connectors(project_id, active);

ALTER TABLE project_connectors OWNER TO crm_user;
ALTER SEQUENCE project_connectors_id_seq OWNER TO crm_user;
