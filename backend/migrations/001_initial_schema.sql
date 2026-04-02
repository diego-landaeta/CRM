-- ============================================================
-- CRM MultiProyecto — Migracion 001: Schema inicial
-- Motor: PostgreSQL 15+
-- Ejecutar: psql -U crm_user -d crm_db -f 001_initial_schema.sql
-- ============================================================

BEGIN;

-- ============================================================
-- TIPOS ENUM
-- ============================================================

CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'gestor');
CREATE TYPE project_type AS ENUM ('crm', 'ia');
CREATE TYPE lead_status AS ENUM ('nuevo', 'por_contactar', 'contactado', 'en_seguimiento', 'convertido', 'no_interesado');
CREATE TYPE interaction_type AS ENUM ('llamada', 'email', 'whatsapp', 'nota');
CREATE TYPE payment_method AS ENUM ('transferencia', 'tarjeta', 'efectivo', 'fraccionado');
CREATE TYPE utm_channel AS ENUM ('meta_ads', 'google_ads', 'tiktok_ads', 'organico', 'chatgpt_ia', 'directo', 'referido');
CREATE TYPE api_service AS ENUM ('meta', 'google_ads', 'gsc', 'stripe', 'claude', 'brevo');

-- ============================================================
-- 1. USERS
-- ============================================================

CREATE TABLE users (
    id                    SERIAL        PRIMARY KEY,
    nombre                VARCHAR(200)  NOT NULL,
    email                 VARCHAR(255)  NOT NULL UNIQUE,
    password_hash         VARCHAR(255)  NOT NULL,
    role                  user_role     NOT NULL DEFAULT 'gestor',
    active                BOOLEAN       NOT NULL DEFAULT true,
    set_password_token    VARCHAR(255),
    set_password_expires  TIMESTAMPTZ,
    last_login_at         TIMESTAMPTZ,
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. PROJECTS
-- ============================================================

CREATE TABLE projects (
    id                       SERIAL         PRIMARY KEY,
    nombre                   VARCHAR(200)   NOT NULL,
    slug                     VARCHAR(100)   NOT NULL UNIQUE,
    type                     project_type   NOT NULL DEFAULT 'crm',
    emoji                    VARCHAR(10),
    meta_account_id          VARCHAR(100),
    google_account_id        VARCHAR(100),
    gsc_property             VARCHAR(255),
    webhook_api_key          VARCHAR(255)   NOT NULL,
    dias_alerta_inactividad  INTEGER        NOT NULL DEFAULT 3,
    active                   BOOLEAN        NOT NULL DEFAULT true,
    created_at               TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. USER_PROJECTS (relacion muchos-a-muchos + orden cola round-robin)
-- ============================================================

CREATE TABLE user_projects (
    id          SERIAL       PRIMARY KEY,
    user_id     INTEGER      NOT NULL,
    project_id  INTEGER      NOT NULL,
    orden_cola  INTEGER      NOT NULL DEFAULT 0,
    active      BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_user_projects_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_projects_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT uq_user_projects_user_project
        UNIQUE (user_id, project_id)
);

-- ============================================================
-- 4. PRODUCTS
-- ============================================================

CREATE TABLE products (
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

-- ============================================================
-- 5. DOSSIERS
-- ============================================================

CREATE TABLE dossiers (
    id                 SERIAL        PRIMARY KEY,
    product_id         INTEGER       NOT NULL,
    s3_key             VARCHAR(500)  NOT NULL,
    filename_original  VARCHAR(255)  NOT NULL,
    version            INTEGER       NOT NULL DEFAULT 1,
    active             BOOLEAN       NOT NULL DEFAULT true,
    size_bytes         BIGINT,
    subido_por         INTEGER       NOT NULL,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_dossiers_product
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_dossiers_subido_por
        FOREIGN KEY (subido_por) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- 6. LEADS
-- ============================================================

CREATE TABLE leads (
    id                   SERIAL         PRIMARY KEY,
    project_id           INTEGER        NOT NULL,
    nombre               VARCHAR(200)   NOT NULL,
    email                VARCHAR(255)   NOT NULL,
    telefono             VARCHAR(50),
    producto_interes_id  INTEGER,
    status               lead_status    NOT NULL DEFAULT 'nuevo',
    responsable_id       INTEGER,
    dossier_enviado      BOOLEAN        NOT NULL DEFAULT false,
    dossier_enviado_at   TIMESTAMPTZ,
    notas                TEXT,
    lead_duplicado_de    INTEGER,
    landing_url          TEXT,
    fecha_solicitud      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    created_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_leads_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_leads_producto_interes
        FOREIGN KEY (producto_interes_id) REFERENCES products(id) ON DELETE SET NULL,
    CONSTRAINT fk_leads_responsable
        FOREIGN KEY (responsable_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_leads_duplicado
        FOREIGN KEY (lead_duplicado_de) REFERENCES leads(id) ON DELETE SET NULL
);

CREATE INDEX idx_leads_email              ON leads (email);
CREATE INDEX idx_leads_project_id         ON leads (project_id);
CREATE INDEX idx_leads_responsable_status ON leads (responsable_id, status);
CREATE INDEX idx_leads_project_status     ON leads (project_id, status);
CREATE INDEX idx_leads_fecha_solicitud    ON leads (fecha_solicitud);

-- ============================================================
-- 7. LEAD_UTMS (1:1 con leads)
-- ============================================================

CREATE TABLE lead_utms (
    id               SERIAL         PRIMARY KEY,
    lead_id          INTEGER        NOT NULL UNIQUE,
    utm_source       VARCHAR(100),
    utm_medium       VARCHAR(100),
    utm_campaign     VARCHAR(255),
    utm_content      VARCHAR(255),
    utm_term         VARCHAR(255),
    landing_url      TEXT,
    canal_detectado  utm_channel,
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_lead_utms_lead
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- ============================================================
-- 8. LEAD_STATUS_HISTORY
-- ============================================================

CREATE TABLE lead_status_history (
    id               SERIAL       PRIMARY KEY,
    lead_id          INTEGER      NOT NULL,
    status_anterior  lead_status  NOT NULL,
    status_nuevo     lead_status  NOT NULL,
    changed_by       INTEGER      NOT NULL,
    changed_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_lead_status_history_lead
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    CONSTRAINT fk_lead_status_history_user
        FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_lead_status_history_lead_id ON lead_status_history (lead_id);

-- ============================================================
-- 9. LEAD_INTERACTIONS
-- ============================================================

CREATE TABLE lead_interactions (
    id          SERIAL            PRIMARY KEY,
    lead_id     INTEGER           NOT NULL,
    tipo        interaction_type  NOT NULL,
    nota        TEXT,
    fecha       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    created_by  INTEGER           NOT NULL,
    created_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_lead_interactions_lead
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    CONSTRAINT fk_lead_interactions_user
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_lead_interactions_lead_id ON lead_interactions (lead_id);

-- ============================================================
-- 10. LEAD_REMINDERS
-- ============================================================

CREATE TABLE lead_reminders (
    id                  SERIAL       PRIMARY KEY,
    lead_id             INTEGER      NOT NULL,
    fecha_recordatorio  DATE         NOT NULL,
    nota                TEXT,
    completado          BOOLEAN      NOT NULL DEFAULT false,
    created_by          INTEGER      NOT NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_lead_reminders_lead
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    CONSTRAINT fk_lead_reminders_user
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- 11. CONVERSIONS
-- ============================================================

CREATE TABLE conversions (
    id                     SERIAL          PRIMARY KEY,
    lead_id                INTEGER         NOT NULL,
    project_id             INTEGER         NOT NULL,
    producto_contratado    VARCHAR(255)    NOT NULL,
    importe_total          DECIMAL(10,2)   NOT NULL,
    importe_pagado         DECIMAL(10,2)   NOT NULL DEFAULT 0,
    fecha_compromiso_pago  DATE,
    metodo_pago            payment_method,
    notas_pago             TEXT,
    fecha_conversion       DATE            NOT NULL DEFAULT CURRENT_DATE,
    created_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_conversions_lead
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    CONSTRAINT fk_conversions_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_conversions_project_fecha ON conversions (project_id, fecha_conversion);

-- ============================================================
-- 12. CONVERSION_PAYMENTS
-- ============================================================

CREATE TABLE conversion_payments (
    id             SERIAL         PRIMARY KEY,
    conversion_id  INTEGER        NOT NULL,
    importe        DECIMAL(10,2)  NOT NULL,
    fecha          DATE           NOT NULL DEFAULT CURRENT_DATE,
    notas          TEXT,
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_conversion_payments_conversion
        FOREIGN KEY (conversion_id) REFERENCES conversions(id) ON DELETE CASCADE
);

-- ============================================================
-- 13. PROJECT_QUEUE_STATE (round-robin)
-- ============================================================

CREATE TABLE project_queue_state (
    id                     SERIAL       PRIMARY KEY,
    project_id             INTEGER      NOT NULL UNIQUE,
    last_assigned_user_id  INTEGER,
    last_assigned_index    INTEGER      NOT NULL DEFAULT 0,
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_project_queue_state_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_queue_state_user
        FOREIGN KEY (last_assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- 14. USER_ACTIVITY_LOG
-- ============================================================

CREATE TABLE user_activity_log (
    id          SERIAL        PRIMARY KEY,
    user_id     INTEGER       NOT NULL,
    action      VARCHAR(100)  NOT NULL,
    details     JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_user_activity_log_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_activity_log_user_created ON user_activity_log (user_id, created_at);

COMMIT;
