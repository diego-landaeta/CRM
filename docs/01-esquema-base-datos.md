# Esquema de Base de Datos -- CRM MultiProyecto

> **Motor:** PostgreSQL 15+
> **Ultima actualizacion:** 2026-04-01

---

## 1. Convenciones

| Convencion | Detalle |
|---|---|
| Naming | `snake_case` para tablas, columnas, indices y enums |
| Primary Key | `id SERIAL` (autoincremental) en todas las tablas |
| Timestamps | `TIMESTAMPTZ` con `DEFAULT NOW()` para `created_at` / `updated_at` |
| Soft delete | Campo `active BOOLEAN DEFAULT true` donde aplica. No se eliminan filas fisicamente |
| Foreign Keys | Nombradas como `fk_<tabla>_<columna>` |
| Indices | Nombrados como `idx_<tabla>_<columnas>` |
| Importe pendiente | `importe_total - importe_pagado` se calcula a nivel de aplicacion, **NO** es columna almacenada |

---

## 2. Tipos ENUM

```sql
-- ============================================================
-- TIPOS ENUM
-- ============================================================

CREATE TYPE user_role AS ENUM (
    'superadmin',
    'admin',
    'gestor'
);

CREATE TYPE project_type AS ENUM (
    'crm',
    'ia'
);

CREATE TYPE lead_status AS ENUM (
    'nuevo',
    'por_contactar',
    'contactado',
    'en_seguimiento',
    'convertido',
    'no_interesado'
);

CREATE TYPE interaction_type AS ENUM (
    'llamada',
    'email',
    'whatsapp',
    'nota'
);

CREATE TYPE payment_method AS ENUM (
    'transferencia',
    'tarjeta',
    'efectivo',
    'fraccionado'
);

CREATE TYPE utm_channel AS ENUM (
    'meta_ads',
    'google_ads',
    'tiktok_ads',
    'organico',
    'chatgpt_ia',
    'directo',
    'referido'
);

CREATE TYPE api_service AS ENUM (
    'meta',
    'google_ads',
    'gsc',
    'stripe',
    'claude',
    'brevo'
);
```

---

## 3. Tablas -- Fase 1 (MVP)

### 3.1 `users`

Usuarios del sistema (superadmin, admin, gestores).

| Columna | Tipo | Restricciones |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| nombre | VARCHAR(200) | NOT NULL |
| email | VARCHAR(255) | NOT NULL, UNIQUE |
| password_hash | VARCHAR(255) | NOT NULL |
| role | user_role | NOT NULL, DEFAULT 'gestor' |
| active | BOOLEAN | NOT NULL, DEFAULT true |
| set_password_token | VARCHAR(255) | NULLABLE |
| set_password_expires | TIMESTAMPTZ | NULLABLE |
| last_login_at | TIMESTAMPTZ | NULLABLE |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

```sql
-- ============================================================
-- 3.1  USERS
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
```

---

### 3.2 `projects`

Proyectos gestionados en la plataforma (tipo CRM o IA).

| Columna | Tipo | Restricciones |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| nombre | VARCHAR(200) | NOT NULL |
| slug | VARCHAR(100) | NOT NULL, UNIQUE |
| type | project_type | NOT NULL, DEFAULT 'crm' |
| emoji | VARCHAR(10) | NULLABLE |
| meta_account_id | VARCHAR(100) | NULLABLE |
| google_account_id | VARCHAR(100) | NULLABLE |
| gsc_property | VARCHAR(255) | NULLABLE |
| webhook_api_key | VARCHAR(255) | NOT NULL |
| dias_alerta_inactividad | INTEGER | NOT NULL, DEFAULT 3 |
| active | BOOLEAN | NOT NULL, DEFAULT true |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

```sql
-- ============================================================
-- 3.2  PROJECTS
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
```

---

### 3.3 `user_projects`

Relacion muchos-a-muchos entre usuarios y proyectos. Define a que proyectos tiene acceso cada gestor y su posicion en la cola de asignacion.

| Columna | Tipo | Restricciones |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| user_id | INTEGER | NOT NULL, FK -> users(id) |
| project_id | INTEGER | NOT NULL, FK -> projects(id) |
| orden_cola | INTEGER | NOT NULL, DEFAULT 0 |
| active | BOOLEAN | NOT NULL, DEFAULT true |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

```sql
-- ============================================================
-- 3.3  USER_PROJECTS
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
```

---

### 3.4 `products`

Productos o servicios que ofrece cada proyecto.

| Columna | Tipo | Restricciones |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| project_id | INTEGER | NOT NULL, FK -> projects(id) |
| nombre | VARCHAR(200) | NOT NULL |
| descripcion | TEXT | NULLABLE |
| active | BOOLEAN | NOT NULL, DEFAULT true |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

```sql
-- ============================================================
-- 3.4  PRODUCTS
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
```

---

### 3.5 `dossiers`

Archivos PDF / documentos subidos a S3 vinculados a un producto.

| Columna | Tipo | Restricciones |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| product_id | INTEGER | NOT NULL, FK -> products(id) |
| s3_key | VARCHAR(500) | NOT NULL |
| filename_original | VARCHAR(255) | NOT NULL |
| version | INTEGER | NOT NULL, DEFAULT 1 |
| active | BOOLEAN | NOT NULL, DEFAULT true |
| subido_por | INTEGER | NOT NULL, FK -> users(id) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

```sql
-- ============================================================
-- 3.5  DOSSIERS
-- ============================================================
CREATE TABLE dossiers (
    id                 SERIAL        PRIMARY KEY,
    product_id         INTEGER       NOT NULL,
    s3_key             VARCHAR(500)  NOT NULL,
    filename_original  VARCHAR(255)  NOT NULL,
    version            INTEGER       NOT NULL DEFAULT 1,
    active             BOOLEAN       NOT NULL DEFAULT true,
    subido_por         INTEGER       NOT NULL,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_dossiers_product
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_dossiers_subido_por
        FOREIGN KEY (subido_por) REFERENCES users(id) ON DELETE SET NULL
);
```

---

### 3.6 `leads`

Tabla principal de leads. Cada lead pertenece a un proyecto.

| Columna | Tipo | Restricciones |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| project_id | INTEGER | NOT NULL, FK -> projects(id) |
| nombre | VARCHAR(200) | NOT NULL |
| email | VARCHAR(255) | NOT NULL |
| telefono | VARCHAR(50) | NULLABLE |
| producto_interes_id | INTEGER | NULLABLE, FK -> products(id) |
| status | lead_status | NOT NULL, DEFAULT 'nuevo' |
| responsable_id | INTEGER | NULLABLE, FK -> users(id) |
| dossier_enviado | BOOLEAN | NOT NULL, DEFAULT false |
| dossier_enviado_at | TIMESTAMPTZ | NULLABLE |
| notas | TEXT | NULLABLE |
| lead_duplicado_de | INTEGER | NULLABLE, FK -> leads(id) |
| landing_url | TEXT | NULLABLE |
| fecha_solicitud | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indices:** `email`, `project_id`, `(responsable_id, status)`, `(project_id, status)`, `fecha_solicitud`

```sql
-- ============================================================
-- 3.6  LEADS
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
```

---

### 3.7 `lead_utms`

Parametros UTM capturados en la landing de origen de cada lead (relacion 1:1).

| Columna | Tipo | Restricciones |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| lead_id | INTEGER | NOT NULL, UNIQUE, FK -> leads(id) |
| utm_source | VARCHAR(100) | NULLABLE |
| utm_medium | VARCHAR(100) | NULLABLE |
| utm_campaign | VARCHAR(255) | NULLABLE |
| utm_content | VARCHAR(255) | NULLABLE |
| utm_term | VARCHAR(255) | NULLABLE |
| landing_url | TEXT | NULLABLE |
| canal_detectado | utm_channel | NULLABLE |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

```sql
-- ============================================================
-- 3.7  LEAD_UTMS
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
```

---

### 3.8 `lead_status_history`

Historial de cambios de estado de un lead.

| Columna | Tipo | Restricciones |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| lead_id | INTEGER | NOT NULL, FK -> leads(id) |
| status_anterior | lead_status | NOT NULL |
| status_nuevo | lead_status | NOT NULL |
| changed_by | INTEGER | NOT NULL, FK -> users(id) |
| changed_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

```sql
-- ============================================================
-- 3.8  LEAD_STATUS_HISTORY
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
```

---

### 3.9 `lead_interactions`

Registro de interacciones (llamadas, emails, WhatsApp, notas) con cada lead.

| Columna | Tipo | Restricciones |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| lead_id | INTEGER | NOT NULL, FK -> leads(id) |
| tipo | interaction_type | NOT NULL |
| nota | TEXT | NULLABLE |
| fecha | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| created_by | INTEGER | NOT NULL, FK -> users(id) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

```sql
-- ============================================================
-- 3.9  LEAD_INTERACTIONS
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
```

---

### 3.10 `lead_reminders`

Recordatorios programados sobre un lead.

| Columna | Tipo | Restricciones |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| lead_id | INTEGER | NOT NULL, FK -> leads(id) |
| fecha_recordatorio | DATE | NOT NULL |
| nota | TEXT | NULLABLE |
| completado | BOOLEAN | NOT NULL, DEFAULT false |
| created_by | INTEGER | NOT NULL, FK -> users(id) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

```sql
-- ============================================================
-- 3.10  LEAD_REMINDERS
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
```

---

### 3.11 `conversions`

Conversiones: cuando un lead contrata un producto/servicio.

| Columna | Tipo | Restricciones |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| lead_id | INTEGER | NOT NULL, FK -> leads(id) |
| project_id | INTEGER | NOT NULL, FK -> projects(id) |
| producto_contratado | VARCHAR(255) | NOT NULL |
| importe_total | DECIMAL(10,2) | NOT NULL |
| importe_pagado | DECIMAL(10,2) | NOT NULL, DEFAULT 0 |
| fecha_compromiso_pago | DATE | NULLABLE |
| metodo_pago | payment_method | NULLABLE |
| notas_pago | TEXT | NULLABLE |
| fecha_conversion | DATE | NOT NULL, DEFAULT CURRENT_DATE |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

> **Nota:** `importe_pendiente` se calcula a nivel de aplicacion como `importe_total - importe_pagado`. **NO** es una columna almacenada en la base de datos.

```sql
-- ============================================================
-- 3.11  CONVERSIONS
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
```

---

### 3.12 `conversion_payments`

Pagos parciales o fraccionados vinculados a una conversion.

| Columna | Tipo | Restricciones |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| conversion_id | INTEGER | NOT NULL, FK -> conversions(id) |
| importe | DECIMAL(10,2) | NOT NULL |
| fecha | DATE | NOT NULL, DEFAULT CURRENT_DATE |
| notas | TEXT | NULLABLE |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

```sql
-- ============================================================
-- 3.12  CONVERSION_PAYMENTS
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
```

---

### 3.13 `project_queue_state`

Estado de la cola de asignacion round-robin para cada proyecto CRM.

| Columna | Tipo | Restricciones |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| project_id | INTEGER | NOT NULL, UNIQUE, FK -> projects(id) |
| last_assigned_user_id | INTEGER | NULLABLE, FK -> users(id) |
| last_assigned_index | INTEGER | NOT NULL, DEFAULT 0 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

```sql
-- ============================================================
-- 3.13  PROJECT_QUEUE_STATE
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
```

---

### 3.14 `user_activity_log`

Log de actividad de usuarios para auditoria.

| Columna | Tipo | Restricciones |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| user_id | INTEGER | NOT NULL, FK -> users(id) |
| action | VARCHAR(100) | NOT NULL |
| details | JSONB | NULLABLE |
| ip_address | INET | NULLABLE |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

```sql
-- ============================================================
-- 3.14  USER_ACTIVITY_LOG
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
```

---

## 4. Tablas -- Fase 2

### 4.1 `api_credentials`

Credenciales de APIs externas cifradas. `project_id` NULL indica credencial global.

| Columna | Tipo | Restricciones |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| project_id | INTEGER | NULLABLE, FK -> projects(id) |
| service | api_service | NOT NULL |
| key_name | VARCHAR(100) | NOT NULL |
| encrypted_value | TEXT | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

```sql
-- ============================================================
-- 4.1  API_CREDENTIALS
-- ============================================================
CREATE TABLE api_credentials (
    id               SERIAL        PRIMARY KEY,
    project_id       INTEGER,
    service          api_service   NOT NULL,
    key_name         VARCHAR(100)  NOT NULL,
    encrypted_value  TEXT          NOT NULL,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_api_credentials_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT uq_api_credentials_project_service_key
        UNIQUE (project_id, service, key_name)
);
```

---

### 4.2 `meta_campaign_metrics`

Metricas diarias de campanas de Meta Ads.

| Columna | Tipo | Restricciones |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| project_id | INTEGER | NOT NULL, FK -> projects(id) |
| campaign_id | VARCHAR(100) | NOT NULL |
| campaign_name | VARCHAR(255) | NOT NULL |
| ad_account_id | VARCHAR(100) | NOT NULL |
| date | DATE | NOT NULL |
| spend | DECIMAL(10,2) | NOT NULL |
| impressions | INTEGER | NOT NULL, DEFAULT 0 |
| clicks | INTEGER | NOT NULL, DEFAULT 0 |
| cpm | DECIMAL(10,4) | NOT NULL, DEFAULT 0 |
| cpc | DECIMAL(10,4) | NOT NULL, DEFAULT 0 |
| cpl | DECIMAL(10,4) | NOT NULL, DEFAULT 0 |
| conversions_meta | INTEGER | NOT NULL, DEFAULT 0 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

```sql
-- ============================================================
-- 4.2  META_CAMPAIGN_METRICS
-- ============================================================
CREATE TABLE meta_campaign_metrics (
    id                SERIAL          PRIMARY KEY,
    project_id        INTEGER         NOT NULL,
    campaign_id       VARCHAR(100)    NOT NULL,
    campaign_name     VARCHAR(255)    NOT NULL,
    ad_account_id     VARCHAR(100)    NOT NULL,
    date              DATE            NOT NULL,
    spend             DECIMAL(10,2)   NOT NULL,
    impressions       INTEGER         NOT NULL DEFAULT 0,
    clicks            INTEGER         NOT NULL DEFAULT 0,
    cpm               DECIMAL(10,4)   NOT NULL DEFAULT 0,
    cpc               DECIMAL(10,4)   NOT NULL DEFAULT 0,
    cpl               DECIMAL(10,4)   NOT NULL DEFAULT 0,
    conversions_meta  INTEGER         NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_meta_campaign_metrics_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT uq_meta_campaign_metrics_project_campaign_date
        UNIQUE (project_id, campaign_id, date)
);
```

---

### 4.3 `google_campaign_metrics`

Metricas diarias de campanas de Google Ads.

| Columna | Tipo | Restricciones |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| project_id | INTEGER | NOT NULL, FK -> projects(id) |
| campaign_id | VARCHAR(100) | NOT NULL |
| campaign_name | VARCHAR(255) | NOT NULL |
| ad_account_id | VARCHAR(100) | NOT NULL |
| date | DATE | NOT NULL |
| spend | DECIMAL(10,2) | NOT NULL |
| impressions | INTEGER | NOT NULL, DEFAULT 0 |
| clicks | INTEGER | NOT NULL, DEFAULT 0 |
| cpm | DECIMAL(10,4) | NOT NULL, DEFAULT 0 |
| cpc | DECIMAL(10,4) | NOT NULL, DEFAULT 0 |
| cpl | DECIMAL(10,4) | NOT NULL, DEFAULT 0 |
| conversions_meta | INTEGER | NOT NULL, DEFAULT 0 |
| keyword_data | JSONB | NULLABLE |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

```sql
-- ============================================================
-- 4.3  GOOGLE_CAMPAIGN_METRICS
-- ============================================================
CREATE TABLE google_campaign_metrics (
    id                SERIAL          PRIMARY KEY,
    project_id        INTEGER         NOT NULL,
    campaign_id       VARCHAR(100)    NOT NULL,
    campaign_name     VARCHAR(255)    NOT NULL,
    ad_account_id     VARCHAR(100)    NOT NULL,
    date              DATE            NOT NULL,
    spend             DECIMAL(10,2)   NOT NULL,
    impressions       INTEGER         NOT NULL DEFAULT 0,
    clicks            INTEGER         NOT NULL DEFAULT 0,
    cpm               DECIMAL(10,4)   NOT NULL DEFAULT 0,
    cpc               DECIMAL(10,4)   NOT NULL DEFAULT 0,
    cpl               DECIMAL(10,4)   NOT NULL DEFAULT 0,
    conversions_meta  INTEGER         NOT NULL DEFAULT 0,
    keyword_data      JSONB,
    created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_google_campaign_metrics_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT uq_google_campaign_metrics_project_campaign_date
        UNIQUE (project_id, campaign_id, date)
);
```

---

### 4.4 `gsc_metrics`

Metricas de Google Search Console.

| Columna | Tipo | Restricciones |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| project_id | INTEGER | NOT NULL, FK -> projects(id) |
| date | DATE | NOT NULL |
| clicks | INTEGER | NOT NULL, DEFAULT 0 |
| impressions | INTEGER | NOT NULL, DEFAULT 0 |
| ctr | DECIMAL(6,4) | NOT NULL, DEFAULT 0 |
| position | DECIMAL(6,2) | NOT NULL, DEFAULT 0 |
| query | TEXT | NULLABLE |
| page | TEXT | NULLABLE |
| device | VARCHAR(20) | NULLABLE |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

```sql
-- ============================================================
-- 4.4  GSC_METRICS
-- ============================================================
CREATE TABLE gsc_metrics (
    id           SERIAL         PRIMARY KEY,
    project_id   INTEGER        NOT NULL,
    date         DATE           NOT NULL,
    clicks       INTEGER        NOT NULL DEFAULT 0,
    impressions  INTEGER        NOT NULL DEFAULT 0,
    ctr          DECIMAL(6,4)   NOT NULL DEFAULT 0,
    position     DECIMAL(6,2)   NOT NULL DEFAULT 0,
    query        TEXT,
    page         TEXT,
    device       VARCHAR(20),
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_gsc_metrics_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT uq_gsc_metrics_project_date_query_page_device
        UNIQUE (project_id, date, COALESCE(query, ''), COALESCE(page, ''), COALESCE(device, ''))
);
```

---

### 4.5 `ia_monthly_metrics`

Metricas mensuales para proyectos de tipo IA (suscripciones SaaS).

| Columna | Tipo | Restricciones |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| project_id | INTEGER | NOT NULL, FK -> projects(id) |
| month | DATE | NOT NULL (primer dia del mes) |
| mrr | DECIMAL(10,2) | NOT NULL, DEFAULT 0 |
| active_subs | INTEGER | NOT NULL, DEFAULT 0 |
| new_subs | INTEGER | NOT NULL, DEFAULT 0 |
| cancelled_subs | INTEGER | NOT NULL, DEFAULT 0 |
| failed_payments | INTEGER | NOT NULL, DEFAULT 0 |
| churn_rate | DECIMAL(5,2) | NOT NULL, DEFAULT 0 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

```sql
-- ============================================================
-- 4.5  IA_MONTHLY_METRICS
-- ============================================================
CREATE TABLE ia_monthly_metrics (
    id               SERIAL         PRIMARY KEY,
    project_id       INTEGER        NOT NULL,
    month            DATE           NOT NULL,
    mrr              DECIMAL(10,2)  NOT NULL DEFAULT 0,
    active_subs      INTEGER        NOT NULL DEFAULT 0,
    new_subs         INTEGER        NOT NULL DEFAULT 0,
    cancelled_subs   INTEGER        NOT NULL DEFAULT 0,
    failed_payments  INTEGER        NOT NULL DEFAULT 0,
    churn_rate       DECIMAL(5,2)   NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_ia_monthly_metrics_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT uq_ia_monthly_metrics_project_month
        UNIQUE (project_id, month)
);
```

---

### 4.6 `ai_reports`

Reportes generados por IA (Claude) para cada proyecto y periodo.

| Columna | Tipo | Restricciones |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| project_id | INTEGER | NOT NULL, FK -> projects(id) |
| periodo | VARCHAR(7) | NOT NULL (formato 'YYYY-MM', ej. '2026-03') |
| report_markdown | TEXT | NOT NULL |
| input_json | JSONB | NOT NULL |
| generated_by | INTEGER | NULLABLE, FK -> users(id) |
| generated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

```sql
-- ============================================================
-- 4.6  AI_REPORTS
-- ============================================================
CREATE TABLE ai_reports (
    id               SERIAL       PRIMARY KEY,
    project_id       INTEGER      NOT NULL,
    periodo          VARCHAR(7)   NOT NULL,
    report_markdown  TEXT         NOT NULL,
    input_json       JSONB        NOT NULL,
    generated_by     INTEGER,
    generated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_ai_reports_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_ai_reports_generated_by
        FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
);
```

---

## 5. Resumen de indices

| Tabla | Indice | Columnas |
|---|---|---|
| users | `users_email_key` (UNIQUE) | `email` |
| projects | `projects_slug_key` (UNIQUE) | `slug` |
| user_projects | `uq_user_projects_user_project` (UNIQUE) | `(user_id, project_id)` |
| leads | `idx_leads_email` | `email` |
| leads | `idx_leads_project_id` | `project_id` |
| leads | `idx_leads_responsable_status` | `(responsable_id, status)` |
| leads | `idx_leads_project_status` | `(project_id, status)` |
| leads | `idx_leads_fecha_solicitud` | `fecha_solicitud` |
| lead_utms | `lead_utms_lead_id_key` (UNIQUE) | `lead_id` |
| lead_status_history | `idx_lead_status_history_lead_id` | `lead_id` |
| lead_interactions | `idx_lead_interactions_lead_id` | `lead_id` |
| conversions | `idx_conversions_project_fecha` | `(project_id, fecha_conversion)` |
| project_queue_state | `project_queue_state_project_id_key` (UNIQUE) | `project_id` |
| user_activity_log | `idx_user_activity_log_user_created` | `(user_id, created_at)` |
| api_credentials | `uq_api_credentials_project_service_key` (UNIQUE) | `(project_id, service, key_name)` |
| meta_campaign_metrics | `uq_meta_campaign_metrics_project_campaign_date` (UNIQUE) | `(project_id, campaign_id, date)` |
| google_campaign_metrics | `uq_google_campaign_metrics_project_campaign_date` (UNIQUE) | `(project_id, campaign_id, date)` |
| gsc_metrics | `uq_gsc_metrics_project_date_query_page_device` (UNIQUE) | `(project_id, date, COALESCE(query,''), COALESCE(page,''), COALESCE(device,''))` |
| ia_monthly_metrics | `uq_ia_monthly_metrics_project_month` (UNIQUE) | `(project_id, month)` |

---

## 6. Diagrama ER (relaciones)

```
users
  |
  |--- 1:N --- user_projects --- N:1 --- projects
  |                                         |
  |--- 1:N --- user_activity_log            |--- 1:N --- products
  |                                         |               |
  |--- 1:N --- dossiers (subido_por)        |               |--- 1:N --- dossiers
  |                                         |
  |--- 1:N --- leads (responsable_id)       |--- 1:N --- leads
  |               |                         |
  |               |--- 1:1 --- lead_utms    |--- 1:N --- conversions
  |               |                         |               |
  |               |--- 1:N --- lead_status_history          |--- 1:N --- conversion_payments
  |               |
  |               |--- 1:N --- lead_interactions
  |               |
  |               |--- 1:N --- lead_reminders
  |               |
  |               |--- 1:N --- conversions
  |               |
  |               |--- self-ref (lead_duplicado_de)
  |
  |--- 1:N --- lead_status_history (changed_by)
  |--- 1:N --- lead_interactions (created_by)
  |--- 1:N --- lead_reminders (created_by)
  |--- 1:1 --- project_queue_state (last_assigned_user_id)

projects
  |--- 1:N --- api_credentials (project_id nullable = global)
  |--- 1:N --- meta_campaign_metrics
  |--- 1:N --- google_campaign_metrics
  |--- 1:N --- gsc_metrics
  |--- 1:N --- ia_monthly_metrics
  |--- 1:N --- ai_reports
  |--- 1:1 --- project_queue_state

products
  |--- 1:N --- leads (producto_interes_id)
```

---

## 7. Seed Data

```sql
-- ============================================================
-- SEED DATA
-- ============================================================

-- 7.1 Superadmin (password hash es un placeholder, cambiar en produccion)
INSERT INTO users (nombre, email, password_hash, role, active)
VALUES (
    'Manuel Casas',
    'manuel@crm-multiproyecto.com',
    '$2b$12$placeholder.hash.cambiar.en.produccion.000000000000000000',
    'superadmin',
    true
);

-- 7.2 Proyectos CRM
INSERT INTO projects (nombre, slug, type, emoji, webhook_api_key, dias_alerta_inactividad)
VALUES
    ('Psiko Aprende',  'psiko-aprende',  'crm', NULL, 'whk_psiko_' || gen_random_uuid()::TEXT,  3),
    ('ISEIH',          'iseih',          'crm', NULL, 'whk_iseih_' || gen_random_uuid()::TEXT,  3),
    ('Fono Aprende',   'fono-aprende',   'crm', NULL, 'whk_fono_'  || gen_random_uuid()::TEXT,  3);

-- 7.3 Proyectos IA
INSERT INTO projects (nombre, slug, type, emoji, webhook_api_key, dias_alerta_inactividad)
VALUES
    ('Psicologo IA',    'psicologo-ia',    'ia', NULL, 'whk_psicoia_'  || gen_random_uuid()::TEXT, 3),
    ('Nutricionista IA','nutricionista-ia', 'ia', NULL, 'whk_nutriia_'  || gen_random_uuid()::TEXT, 3),
    ('Tarot IA',        'tarot-ia',        'ia', NULL, 'whk_tarotia_'  || gen_random_uuid()::TEXT, 3);

-- 7.4 Estado de cola para cada proyecto CRM
INSERT INTO project_queue_state (project_id, last_assigned_user_id, last_assigned_index)
SELECT id, NULL, 0
FROM projects
WHERE type = 'crm';
```

---

## 8. Notas importantes

1. **`importe_pendiente` no es columna:** Se calcula a nivel de aplicacion como `importe_total - importe_pagado`. Esto evita inconsistencias y simplifica las actualizaciones de pagos parciales.

2. **Soft delete:** Las tablas con campo `active` no eliminan registros fisicamente. Las queries de la aplicacion deben filtrar `WHERE active = true` por defecto.

3. **Timestamps:** Todas las columnas temporales usan `TIMESTAMPTZ` para manejar correctamente zonas horarias.

4. **Cifrado de credenciales:** La columna `encrypted_value` en `api_credentials` almacena valores cifrados con AES-256 a nivel de aplicacion. La base de datos no descifra estos valores.

5. **Cola round-robin:** La tabla `project_queue_state` mantiene el estado de asignacion automatica de leads a gestores. El campo `last_assigned_index` se incrementa circularmente sobre los `user_projects` activos del proyecto.

6. **UUID para webhook keys:** Los seeds usan `gen_random_uuid()` de PostgreSQL 13+ (extension `pgcrypto` o funcion nativa en PG 13+).

---

## 9. Script completo ejecutable

A continuacion, el script completo para ejecutar en orden en una base de datos PostgreSQL limpia:

```sql
-- ============================================================
-- CRM MULTIPROYECTO - SCHEMA COMPLETO
-- PostgreSQL 15+
-- ============================================================

BEGIN;

-- ============================================================
-- 1. TIPOS ENUM
-- ============================================================

CREATE TYPE user_role AS ENUM (
    'superadmin',
    'admin',
    'gestor'
);

CREATE TYPE project_type AS ENUM (
    'crm',
    'ia'
);

CREATE TYPE lead_status AS ENUM (
    'nuevo',
    'por_contactar',
    'contactado',
    'en_seguimiento',
    'convertido',
    'no_interesado'
);

CREATE TYPE interaction_type AS ENUM (
    'llamada',
    'email',
    'whatsapp',
    'nota'
);

CREATE TYPE payment_method AS ENUM (
    'transferencia',
    'tarjeta',
    'efectivo',
    'fraccionado'
);

CREATE TYPE utm_channel AS ENUM (
    'meta_ads',
    'google_ads',
    'tiktok_ads',
    'organico',
    'chatgpt_ia',
    'directo',
    'referido'
);

CREATE TYPE api_service AS ENUM (
    'meta',
    'google_ads',
    'gsc',
    'stripe',
    'claude',
    'brevo'
);

-- ============================================================
-- 2. TABLAS FASE 1 (MVP)
-- ============================================================

-- 2.1 USERS
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

-- 2.2 PROJECTS
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

-- 2.3 USER_PROJECTS
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

-- 2.4 PRODUCTS
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

-- 2.5 DOSSIERS
CREATE TABLE dossiers (
    id                 SERIAL        PRIMARY KEY,
    product_id         INTEGER       NOT NULL,
    s3_key             VARCHAR(500)  NOT NULL,
    filename_original  VARCHAR(255)  NOT NULL,
    version            INTEGER       NOT NULL DEFAULT 1,
    active             BOOLEAN       NOT NULL DEFAULT true,
    subido_por         INTEGER       NOT NULL,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_dossiers_product
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_dossiers_subido_por
        FOREIGN KEY (subido_por) REFERENCES users(id) ON DELETE SET NULL
);

-- 2.6 LEADS
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

-- 2.7 LEAD_UTMS
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

-- 2.8 LEAD_STATUS_HISTORY
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

-- 2.9 LEAD_INTERACTIONS
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

-- 2.10 LEAD_REMINDERS
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

-- 2.11 CONVERSIONS
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

-- 2.12 CONVERSION_PAYMENTS
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

-- 2.13 PROJECT_QUEUE_STATE
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

-- 2.14 USER_ACTIVITY_LOG
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

-- ============================================================
-- 3. TABLAS FASE 2
-- ============================================================

-- 3.1 API_CREDENTIALS
CREATE TABLE api_credentials (
    id               SERIAL        PRIMARY KEY,
    project_id       INTEGER,
    service          api_service   NOT NULL,
    key_name         VARCHAR(100)  NOT NULL,
    encrypted_value  TEXT          NOT NULL,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_api_credentials_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT uq_api_credentials_project_service_key
        UNIQUE (project_id, service, key_name)
);

-- 3.2 META_CAMPAIGN_METRICS
CREATE TABLE meta_campaign_metrics (
    id                SERIAL          PRIMARY KEY,
    project_id        INTEGER         NOT NULL,
    campaign_id       VARCHAR(100)    NOT NULL,
    campaign_name     VARCHAR(255)    NOT NULL,
    ad_account_id     VARCHAR(100)    NOT NULL,
    date              DATE            NOT NULL,
    spend             DECIMAL(10,2)   NOT NULL,
    impressions       INTEGER         NOT NULL DEFAULT 0,
    clicks            INTEGER         NOT NULL DEFAULT 0,
    cpm               DECIMAL(10,4)   NOT NULL DEFAULT 0,
    cpc               DECIMAL(10,4)   NOT NULL DEFAULT 0,
    cpl               DECIMAL(10,4)   NOT NULL DEFAULT 0,
    conversions_meta  INTEGER         NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_meta_campaign_metrics_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT uq_meta_campaign_metrics_project_campaign_date
        UNIQUE (project_id, campaign_id, date)
);

-- 3.3 GOOGLE_CAMPAIGN_METRICS
CREATE TABLE google_campaign_metrics (
    id                SERIAL          PRIMARY KEY,
    project_id        INTEGER         NOT NULL,
    campaign_id       VARCHAR(100)    NOT NULL,
    campaign_name     VARCHAR(255)    NOT NULL,
    ad_account_id     VARCHAR(100)    NOT NULL,
    date              DATE            NOT NULL,
    spend             DECIMAL(10,2)   NOT NULL,
    impressions       INTEGER         NOT NULL DEFAULT 0,
    clicks            INTEGER         NOT NULL DEFAULT 0,
    cpm               DECIMAL(10,4)   NOT NULL DEFAULT 0,
    cpc               DECIMAL(10,4)   NOT NULL DEFAULT 0,
    cpl               DECIMAL(10,4)   NOT NULL DEFAULT 0,
    conversions_meta  INTEGER         NOT NULL DEFAULT 0,
    keyword_data      JSONB,
    created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_google_campaign_metrics_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT uq_google_campaign_metrics_project_campaign_date
        UNIQUE (project_id, campaign_id, date)
);

-- 3.4 GSC_METRICS
CREATE TABLE gsc_metrics (
    id           SERIAL         PRIMARY KEY,
    project_id   INTEGER        NOT NULL,
    date         DATE           NOT NULL,
    clicks       INTEGER        NOT NULL DEFAULT 0,
    impressions  INTEGER        NOT NULL DEFAULT 0,
    ctr          DECIMAL(6,4)   NOT NULL DEFAULT 0,
    position     DECIMAL(6,2)   NOT NULL DEFAULT 0,
    query        TEXT,
    page         TEXT,
    device       VARCHAR(20),
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_gsc_metrics_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT uq_gsc_metrics_project_date_query_page_device
        UNIQUE (project_id, date, COALESCE(query, ''), COALESCE(page, ''), COALESCE(device, ''))
);

-- 3.5 IA_MONTHLY_METRICS
CREATE TABLE ia_monthly_metrics (
    id               SERIAL         PRIMARY KEY,
    project_id       INTEGER        NOT NULL,
    month            DATE           NOT NULL,
    mrr              DECIMAL(10,2)  NOT NULL DEFAULT 0,
    active_subs      INTEGER        NOT NULL DEFAULT 0,
    new_subs         INTEGER        NOT NULL DEFAULT 0,
    cancelled_subs   INTEGER        NOT NULL DEFAULT 0,
    failed_payments  INTEGER        NOT NULL DEFAULT 0,
    churn_rate       DECIMAL(5,2)   NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_ia_monthly_metrics_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT uq_ia_monthly_metrics_project_month
        UNIQUE (project_id, month)
);

-- 3.6 AI_REPORTS
CREATE TABLE ai_reports (
    id               SERIAL       PRIMARY KEY,
    project_id       INTEGER      NOT NULL,
    periodo          VARCHAR(7)   NOT NULL,
    report_markdown  TEXT         NOT NULL,
    input_json       JSONB        NOT NULL,
    generated_by     INTEGER,
    generated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_ai_reports_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_ai_reports_generated_by
        FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- 4. SEED DATA
-- ============================================================

-- Superadmin
INSERT INTO users (nombre, email, password_hash, role, active)
VALUES (
    'Manuel Casas',
    'manuel@crm-multiproyecto.com',
    '$2b$12$placeholder.hash.cambiar.en.produccion.000000000000000000',
    'superadmin',
    true
);

-- Proyectos CRM
INSERT INTO projects (nombre, slug, type, emoji, webhook_api_key, dias_alerta_inactividad)
VALUES
    ('Psiko Aprende',  'psiko-aprende',  'crm', NULL, 'whk_psiko_' || gen_random_uuid()::TEXT,  3),
    ('ISEIH',          'iseih',          'crm', NULL, 'whk_iseih_' || gen_random_uuid()::TEXT,  3),
    ('Fono Aprende',   'fono-aprende',   'crm', NULL, 'whk_fono_'  || gen_random_uuid()::TEXT,  3);

-- Proyectos IA
INSERT INTO projects (nombre, slug, type, emoji, webhook_api_key, dias_alerta_inactividad)
VALUES
    ('Psicologo IA',     'psicologo-ia',     'ia', NULL, 'whk_psicoia_'  || gen_random_uuid()::TEXT, 3),
    ('Nutricionista IA', 'nutricionista-ia',  'ia', NULL, 'whk_nutriia_'  || gen_random_uuid()::TEXT, 3),
    ('Tarot IA',         'tarot-ia',          'ia', NULL, 'whk_tarotia_'  || gen_random_uuid()::TEXT, 3);

-- Estado de cola para proyectos CRM
INSERT INTO project_queue_state (project_id, last_assigned_user_id, last_assigned_index)
SELECT id, NULL, 0
FROM projects
WHERE type = 'crm';

COMMIT;
```
