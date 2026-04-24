# Flujo principal: Lead → Conversion → Comision → Factura

## Flujo macro

```mermaid
flowchart LR
    A[Lead entra] --> B{Origen}
    B -->|Webhook| C[POST /api/leads/webhooks/:slug]
    B -->|Manual| D[POST /api/leads]
    B -->|WhatsApp/Make<br/>backlog| E[Webhook generico<br/>CRM-133]

    C --> F[Round-robin<br/>asigna gestor]
    D --> F
    E --> F

    F --> G[Lead en 'nuevo']
    G --> H[Gestor contacta<br/>+ interacciones]
    H --> I{Resultado}
    I -->|Interesado| J[Cambia status:<br/>por_contactar<br/>→contactado<br/>→en_seguimiento]
    I -->|No interesado| K[status: no_interesado]
    J --> L{Compra?}
    L -->|Si| M[Crear conversion]
    L -->|Aun no| H

    M --> N[POST /api/conversions]
    N --> O[Lead status = convertido<br/>= CLIENTE]
    N --> P[Hook: busca regla<br/>de comision del gestor<br/>para ese producto]
    P --> Q{Regla existe?}
    Q -->|Si| R[Crea commission<br/>importe_base = pagado<br/>comision = base x pct]
    Q -->|No| S[Fin]

    N --> T{Importe pagado?}
    T -->|Total| U[estado_pago = pagado]
    T -->|Parcial| V[estado_pago = parcial<br/>→ cuentas por cobrar]
    T -->|Cero| V

    V --> W[addPayment]
    W --> X[Recalcula commission<br/>importe_base = pagado nuevo]
    W --> Y{Llega al total?}
    Y -->|Si| U
    Y -->|No| V

    U --> Z[Factura PDF<br/>CRM-132<br/>backlog]
    R --> ZA[Admin paga commission<br/>→ estado = pagado]
```

## Flujo de datos entre tablas

```mermaid
sequenceDiagram
    participant W as Webhook
    participant L as leads
    participant Q as project_queue_state
    participant U as users
    participant C as conversions
    participant CP as conversion_payments
    participant CR as commission_rules
    participant CM as commissions

    W->>L: INSERT lead (email, producto_interes_id)
    W->>Q: SELECT next_index FOR UPDATE
    Q->>U: encuentra proximo gestor activo
    W->>L: UPDATE responsable_id
    W->>Q: UPDATE next_index
    W-->>W: detecta duplicado por email<br/>marca reincidente si mismo producto
    W-->>Brevo: email async a gestor

    Note over L,C: ... tiempo pasa, gestor contacta...

    L->>C: INSERT conversion (lead_id, producto_contratado_id, importe_total)
    C->>CP: INSERT conversion_payment (si importe_pagado > 0)
    C->>L: UPDATE leads.status = 'convertido'
    C->>CR: SELECT regla WHERE user_id=responsable AND product_id=producto
    alt regla existe
        C->>CM: INSERT commission (base=pagado, pct, importe=base*pct/100)
    end

    Note over C,CM: ... cliente paga otra cuota ...

    C->>CP: INSERT conversion_payment
    C->>CM: UPDATE importe_base = nuevo pagado<br/>UPDATE importe_comision recalculado
```

## Ciclo de vida del lead

```mermaid
stateDiagram-v2
    [*] --> nuevo: webhook / manual
    nuevo --> por_contactar: gestor ve el lead
    por_contactar --> contactado: llamada/email hecha
    contactado --> en_seguimiento: respuesta del lead
    en_seguimiento --> convertido: compra (conversion creada)
    en_seguimiento --> no_interesado: rechaza
    contactado --> no_interesado: silencio prolongado
    convertido --> [*]: es cliente
    no_interesado --> [*]

    note right of convertido: Aparece en /clients<br/>Genera comision si hay regla
```

## Ciclo de vida de la conversion/pago

```mermaid
stateDiagram-v2
    [*] --> pendiente: conversion creada<br/>importe_pagado = 0
    pendiente --> parcial: primer pago < total
    parcial --> parcial: pago intermedio
    parcial --> pagado: ultimo pago = total
    pendiente --> pagado: pago completo de golpe
    pagado --> [*]

    note right of parcial: Aparece en<br/>cuentas por cobrar<br/>Se actualiza commission
    note right of pagado: Dispara factura<br/>(backlog CRM-132)
```

## Flujo de comision

```mermaid
flowchart TD
    A[Superadmin define regla] --> B[commission_rules<br/>user_id + product_id + pct]
    B --> C[UNIQUE user_id + product_id]

    D[Gestor cierra venta] --> E[conversion.create hook]
    E --> F{Regla existe<br/>user responsable + producto?}
    F -->|No| G[Sin comision]
    F -->|Si| H[INSERT commission<br/>base = importe_pagado actual<br/>importe = base * pct / 100<br/>estado = pendiente]

    I[Cliente paga cuota] --> J[conversion.addPayment hook]
    J --> K[recalculateCommission<br/>importe_base = nuevo pagado<br/>UPDATE importe_comision]

    L[Admin marca como pagada] --> M[PATCH /api/commissions/:id/pay<br/>estado = pagado<br/>fecha_pago = hoy]

    H -.->|vista gestor| N[/commissions/me]
    H -.->|vista admin| O[/commissions]
    K -.->|vista ambas| N
    K -.->|vista ambas| O
    M --> O
```

## Webhook → Lead: detalle

```mermaid
sequenceDiagram
    participant Ext as Formulario externo
    participant N as Nginx
    participant API as Backend
    participant DB as PostgreSQL
    participant BR as Brevo

    Ext->>N: POST /testeo_crm/api/leads/webhooks/psiko-aprende<br/>X-API-Key: whk_psiko_...
    N->>API: Proxy a localhost:3002
    API->>API: valida api_key del proyecto
    API->>DB: BEGIN transaction
    API->>DB: SELECT project_queue_state FOR UPDATE
    API->>DB: SELECT gestores activos del proyecto<br/>ORDER BY array position, active
    API->>DB: INSERT leads (responsable_id = gestor[next_index])
    API->>DB: UPDATE queue_state.next_index = (next+1) % count
    API->>DB: INSERT lead_utms
    API->>DB: SELECT leads WHERE email=? duplicate<br/>si mismo producto → reincidente = true
    API->>DB: COMMIT
    API-->>Ext: 200 {success, lead_id} &lt;500ms
    API-)BR: async: sendLeadAssignedEmail a gestor
```
