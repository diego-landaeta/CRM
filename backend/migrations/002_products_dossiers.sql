-- ============================================================
-- Migración 002: Tablas products y dossiers
-- Ticket: CRM-44 / F1-020
-- Depende de: 001 (users, projects)
-- ============================================================

BEGIN;

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    id           SERIAL        PRIMARY KEY,
    project_id   INTEGER       NOT NULL,
    nombre       VARCHAR(200)  NOT NULL,
    descripcion  TEXT,
    active       BOOLEAN       NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_products_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- UNIQUE: un proyecto no puede tener dos productos con el mismo nombre
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_project_nombre
    ON products (project_id, nombre)
    WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_products_project_id
    ON products (project_id);

-- ============================================================
-- DOSSIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS dossiers (
    id                 SERIAL        PRIMARY KEY,
    product_id         INTEGER       NOT NULL,
    s3_key             VARCHAR(500)  NOT NULL,
    filename_original  VARCHAR(255)  NOT NULL,
    size_bytes         BIGINT,
    version            INTEGER       NOT NULL DEFAULT 1,
    active             BOOLEAN       NOT NULL DEFAULT true,
    subido_por         INTEGER       NOT NULL,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_dossiers_product
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_dossiers_subido_por
        FOREIGN KEY (subido_por) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_dossiers_product_id
    ON dossiers (product_id);

CREATE INDEX IF NOT EXISTS idx_dossiers_product_active
    ON dossiers (product_id, active);

COMMIT;
