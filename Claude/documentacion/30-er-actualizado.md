# Diagrama Entidad-Relacion (actualizado 2026-04-23)

23 tablas en produccion. Marco cada bloque por dominio.

```mermaid
erDiagram
    %% ===== USUARIOS Y PROYECTOS =====
    users ||--o{ user_projects : "asignado a"
    users ||--o{ user_refresh_tokens : "tiene"
    users ||--o{ user_activity_log : "genera"
    projects ||--o{ user_projects : "tiene"
    projects ||--|| project_queue_state : "tiene cola"

    %% ===== LEADS =====
    projects ||--o{ leads : "contiene"
    users ||--o{ leads : "responsable"
    leads ||--o{ lead_interactions : "tiene"
    leads ||--o{ lead_reminders : "tiene"
    leads ||--o{ lead_status_history : "tiene"
    leads ||--|| lead_utms : "tiene"
    leads }o--|| leads : "duplicado_de"

    %% ===== PRODUCTOS =====
    projects ||--o{ products : "ofrece"
    projects ||--o{ product_categories : "define"
    product_categories ||--o{ product_categories : "subcategoria de"
    products }o--|| product_categories : "categoria"
    products }o--|| product_categories : "subcategoria"
    products ||--o{ dossiers : "tiene"
    products ||--o{ leads : "interes en"

    %% ===== CONVERSIONES Y PAGOS =====
    leads ||--o{ conversions : "convierte a"
    products ||--o{ conversions : "vende"
    conversions ||--o{ conversion_payments : "tiene pagos"

    %% ===== CONTABILIDAD =====
    projects ||--o{ expenses : "registra"
    projects ||--o{ accounts_payable : "debe"
    accounts_payable ||--o{ accounts_payable_payments : "paga"
    users ||--o{ expenses : "registrado_por"
    users ||--o{ accounts_payable : "registrado_por"

    %% ===== COMISIONES =====
    users ||--o{ commission_rules : "tiene reglas"
    products ||--o{ commission_rules : "aplica"
    projects ||--o{ commission_rules : "scope"
    commission_rules ||--o{ commissions : "genera"
    conversions ||--|| commissions : "tiene"
    users ||--o{ commissions : "cobra"

    %% ===== CONFIG / META =====
    projects ||--o{ project_field_definitions : "campos custom"
    api_credentials }o--|| projects : "scope (opcional)"
    leads ||--o{ project_field_definitions : "valores custom_fields JSONB"

    users {
        int id PK
        varchar email UK
        varchar nombre
        varchar password_hash
        enum role "superadmin/admin/gestor"
        bool active
        timestamp created_at
    }

    projects {
        int id PK
        varchar nombre
        varchar slug UK
        enum type "crm/ia"
        varchar emoji
        varchar logo_url
        varchar logo_key "R2"
        varchar producto_label "ej Formacion"
        varchar producto_label_plural
        int dias_alerta_inactividad
        varchar webhook_api_key
        bool active
    }

    leads {
        int id PK
        int project_id FK
        int responsable_id FK "user"
        int producto_interes_id FK
        int lead_duplicado_de FK "self"
        varchar nombre
        varchar email
        varchar telefono
        enum status
        enum canal
        bool reincidente
        jsonb custom_fields
        timestamp created_at
    }

    products {
        int id PK
        int project_id FK
        int categoria_id FK
        int subcategoria_id FK
        varchar nombre
        text descripcion
        decimal precio
        varchar moneda
        varchar stripe_link
        varchar sku
        varchar duracion
        varchar url_info
        bool active
    }

    product_categories {
        int id PK
        int project_id FK
        int parent_id FK "self - subcat"
        varchar nombre
        int orden
        bool active
    }

    conversions {
        int id PK
        int lead_id FK
        int project_id FK
        int producto_contratado_id FK
        varchar producto_contratado
        decimal importe_total
        decimal importe_pagado
        date fecha_compromiso_pago
        date fecha_conversion
        enum metodo_pago
    }

    conversion_payments {
        int id PK
        int conversion_id FK
        decimal importe
        date fecha
        text notas
    }

    commission_rules {
        int id PK
        int project_id FK
        int user_id FK "gestor"
        int product_id FK
        decimal pct "0-100"
        bool active
    }

    commissions {
        int id PK
        int conversion_id FK UK
        int rule_id FK
        int user_id FK
        int product_id FK
        decimal importe_base
        decimal pct
        decimal importe_comision
        enum estado "pendiente/pagado/cancelado"
        date fecha_pago
    }

    expenses {
        int id PK
        int project_id FK
        varchar concepto
        decimal importe
        date fecha
        enum categoria
        int registrado_por FK
    }

    accounts_payable {
        int id PK
        int project_id FK
        varchar proveedor
        varchar concepto
        enum categoria
        decimal importe_total
        decimal importe_pagado
        date fecha_factura
        date fecha_compromiso_pago
        enum estado "pendiente/parcial/pagado/cancelado"
    }

    accounts_payable_payments {
        int id PK
        int payable_id FK
        decimal importe
        date fecha_pago
        varchar metodo
    }

    project_field_definitions {
        int id PK
        int project_id FK
        varchar field_key
        varchar label
        enum type "text/textarea/number/date/select/boolean"
        bool required
        varchar grupo
        int orden
        jsonb options
    }

    api_credentials {
        int id PK
        int project_id FK "NULL=global"
        varchar service
        bytea encrypted_value
        bytea iv
        bytea auth_tag
        jsonb metadata
        bool active
    }

    dossiers {
        int id PK
        int product_id FK
        varchar key "R2"
        varchar filename_original
        int version
        bool active
        int subido_por FK
    }

    lead_interactions {
        int id PK
        int lead_id FK
        enum tipo "llamada/email/whatsapp/nota"
        text nota
        int created_by FK
        timestamp created_at
    }

    lead_reminders {
        int id PK
        int lead_id FK
        timestamp fecha_recordatorio
        text nota
        bool completado
    }

    lead_status_history {
        int id PK
        int lead_id FK
        enum status_anterior
        enum status_nuevo
        text motivo
        int changed_by FK
    }

    lead_utms {
        int id PK
        int lead_id FK
        varchar utm_source
        varchar utm_medium
        varchar utm_campaign
        varchar canal_detectado
    }

    user_projects {
        int user_id FK
        int project_id FK
    }

    user_refresh_tokens {
        int id PK
        int user_id FK
        varchar token_hash
        timestamp expires_at
    }

    project_queue_state {
        int project_id PK_FK
        int next_index
        int responsable_id FK
    }
```

## Tablas por dominio

| Dominio | Tablas |
|---|---|
| **Usuarios + auth** | users, user_projects, user_refresh_tokens, user_activity_log |
| **Proyectos + cola** | projects, project_queue_state, project_field_definitions, api_credentials |
| **Leads** | leads, lead_interactions, lead_reminders, lead_status_history, lead_utms |
| **Productos + dossiers** | products, product_categories, dossiers |
| **Conversiones + pagos** | conversions, conversion_payments |
| **Contabilidad** | expenses, accounts_payable, accounts_payable_payments |
| **Comisiones** | commission_rules, commissions |
