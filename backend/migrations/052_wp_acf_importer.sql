-- ============================================================
-- Migración 052: importer multi-fuente WP REST + ACF
-- ============================================================
-- Permite que cada proyecto WooCommerce defina:
--   - credenciales WP REST (wp_user + wp_app_password cifrado)
--   - estrategia de import: "wc_only" o "wc_plus_cpt"
--   - lista de CPTs a sincronizar (cursos, masters, diplomados, ...)
--
-- Y guarda los ACF ricos en columnas específicas + tablas auxiliares.
-- ============================================================

BEGIN;

-- ─── wc_credentials: nuevos campos ───────────────────────────
ALTER TABLE wc_credentials
  ADD COLUMN IF NOT EXISTS wp_user           VARCHAR(100),
  ADD COLUMN IF NOT EXISTS wp_app_password   VARCHAR(500),   -- cifrado AES-256
  ADD COLUMN IF NOT EXISTS source_strategy   VARCHAR(20) NOT NULL DEFAULT 'wc_only',
  ADD COLUMN IF NOT EXISTS cpt_endpoints     JSONB           DEFAULT '[]'::jsonb;

ALTER TABLE wc_credentials
  DROP CONSTRAINT IF EXISTS chk_wc_source_strategy;
ALTER TABLE wc_credentials
  ADD CONSTRAINT chk_wc_source_strategy
  CHECK (source_strategy IN ('wc_only', 'wc_plus_cpt'));

COMMENT ON COLUMN wc_credentials.wp_user IS 'Usuario WP-admin para llamar la WP REST API (acceso ACF)';
COMMENT ON COLUMN wc_credentials.wp_app_password IS 'Application Password o clave mu-plugin, cifrada AES-256';
COMMENT ON COLUMN wc_credentials.source_strategy IS 'wc_only: solo /wc/v3/products | wc_plus_cpt: además /wp/v2/{cpt}';
COMMENT ON COLUMN wc_credentials.cpt_endpoints IS 'Lista de slugs de CPT en /wp/v2/{slug}, ej ["cursos","masters","diplomados"]';

-- ─── products: nuevos campos ricos del ACF ──────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS source_type        VARCHAR(40),                 -- "product" | "cursos" | "masters" | "diplomados"
  ADD COLUMN IF NOT EXISTS source_id          INTEGER,                     -- id en el sitio WP origen
  ADD COLUMN IF NOT EXISTS descripcion_larga  TEXT,                        -- HTML completo
  ADD COLUMN IF NOT EXISTS horas              VARCHAR(50),                 -- "1500 horas" / "120 h"
  ADD COLUMN IF NOT EXISTS num_modulos        INTEGER,                     -- 12
  ADD COLUMN IF NOT EXISTS fecha_inicio_texto VARCHAR(200),                -- "marzo 2026" / shortcode
  ADD COLUMN IF NOT EXISTS imagen_secundaria_1 VARCHAR(500),
  ADD COLUMN IF NOT EXISTS imagen_secundaria_2 VARCHAR(500),
  ADD COLUMN IF NOT EXISTS video_presentacion VARCHAR(500),
  ADD COLUMN IF NOT EXISTS video_opiniones_1  VARCHAR(500),
  ADD COLUMN IF NOT EXISTS video_opiniones_2  VARCHAR(500),
  ADD COLUMN IF NOT EXISTS h2_presentacion        VARCHAR(300),
  ADD COLUMN IF NOT EXISTS h2_a_quien_dirigido    VARCHAR(300),
  ADD COLUMN IF NOT EXISTS h2_objetivos           VARCHAR(300),
  ADD COLUMN IF NOT EXISTS h2_beneficios          VARCHAR(300),
  ADD COLUMN IF NOT EXISTS h2_por_que_estudiar    VARCHAR(300),
  ADD COLUMN IF NOT EXISTS h2_temarios            VARCHAR(300),
  ADD COLUMN IF NOT EXISTS texto_por_que_estudiar TEXT,
  ADD COLUMN IF NOT EXISTS raw_acf            JSONB;                        -- backup del ACF crudo

CREATE INDEX IF NOT EXISTS idx_products_source ON products(project_id, source_type, source_id);

COMMENT ON COLUMN products.source_type IS 'De qué endpoint vino: product (WC) | cursos | masters | diplomados | other CPT';
COMMENT ON COLUMN products.source_id IS 'ID del item en el sitio WP origen (para idempotencia + re-sync)';
COMMENT ON COLUMN products.raw_acf IS 'Snapshot completo del ACF al hacer el último import — útil para campos que no se mapearon';

-- ─── product_benefits: lista de beneficios ──────────────────
CREATE TABLE IF NOT EXISTS product_benefits (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  orden       INTEGER NOT NULL DEFAULT 0,
  texto       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_benefits_product ON product_benefits(product_id, orden);

-- ─── product_objectives: lista de objetivos ─────────────────
CREATE TABLE IF NOT EXISTS product_objectives (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  orden       INTEGER NOT NULL DEFAULT 0,
  texto       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_objectives_product ON product_objectives(product_id, orden);

-- ─── product_faqs: preguntas frecuentes ─────────────────────
CREATE TABLE IF NOT EXISTS product_faqs (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  orden       INTEGER NOT NULL DEFAULT 0,
  pregunta    TEXT NOT NULL,
  respuesta   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_faqs_product ON product_faqs(product_id, orden);

-- ─── product_targets: a quién va dirigido ───────────────────
CREATE TABLE IF NOT EXISTS product_targets (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  orden       INTEGER NOT NULL DEFAULT 0,
  encabezado  VARCHAR(300),
  texto       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_targets_product ON product_targets(product_id, orden);

-- Otorgar permisos al user del CRM en las nuevas tablas
GRANT ALL PRIVILEGES ON product_benefits, product_objectives, product_faqs, product_targets TO crm_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO crm_user;

COMMIT;
