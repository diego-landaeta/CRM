# 03 - Especificacion de Endpoints REST API

> CRM MultiProyecto -- Referencia completa de la API REST

---

## Tabla de contenidos

1. [Convenciones generales](#convenciones-generales)
2. [Health](#health)
3. [Auth (Fase 1 -- Subfase 1.2)](#auth)
4. [Users (Fase 1 -- Subfase 1.2)](#users)
5. [Projects (Fase 1 -- Subfase 1.3)](#projects)
6. [Products y Dossiers (Fase 1 -- Subfase 1.3)](#products-y-dossiers)
7. [Webhooks -- Captura de Leads (Fase 1 -- Subfase 1.4)](#webhooks--captura-de-leads)
8. [Leads (Fase 1 -- Subfases 1.4, 1.5)](#leads)
9. [Conversions y Payments (Fase 1 -- Subfase 1.6)](#conversions-y-payments)
10. [Dashboard (Fase 1 -- Subfase 1.7)](#dashboard)
11. [Meta Ads (Fase 2 -- Subfase 2.2)](#meta-ads)
12. [Google Ads (Fase 2 -- Subfase 2.3)](#google-ads)
13. [Google Search Console (Fase 2 -- Subfase 2.4)](#google-search-console)
14. [Stripe Monitor (Fase 2 -- Subfase 2.5)](#stripe-monitor)
15. [Audiences (Fase 2 -- Subfase 2.6)](#audiences)
16. [Reports (Fase 2 -- Subfase 2.6)](#reports)
17. [Chat Claude AI (Fase 3 -- Subfase 3.3)](#chat-claude-ai)
18. [Meta Lead Ads Webhook (Fase 3 -- Subfase 3.2)](#meta-lead-ads-webhook)
19. [Export PDF (Fase 3 -- Subfase 3.4)](#export-pdf)
20. [Admin (Fase 2+)](#admin)

---

## Convenciones generales

### Base URL

```
/crm/api
```

El proxy Nginx redirige todas las peticiones con prefijo `/crm/api` al servidor Node.js escuchando en el puerto **3001**.

### Formato de respuesta estandar

Todas las respuestas siguen esta estructura:

```jsonc
{
  "success": true,          // boolean -- indica si la operacion fue exitosa
  "data": { ... },          // any -- payload de la respuesta (presente si success=true)
  "error": "Mensaje",       // string -- descripcion del error (presente si success=false)
  "code": "VALIDATION_ERR", // string -- codigo de error maquina (presente si success=false)
  "pagination": {           // solo en listados paginados
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

### Autenticacion

| Mecanismo | Detalle |
|-----------|---------|
| **Access Token** | Header `Authorization: Bearer <access_token>`. JWT con expiracion corta (15 min). |
| **Refresh Token** | Cookie `httpOnly`, `Secure`, `SameSite=Strict`. JWT con expiracion larga (7 dias). |
| **Webhook API Key** | Header `Authorization: Bearer <project_webhook_api_key>`. Exclusivo para endpoints de webhook. |

### Formato de fechas

Todas las fechas se envian y reciben en formato **ISO 8601**:

```
YYYY-MM-DDTHH:mm:ssZ
```

Ejemplo: `2026-04-01T14:30:00Z`

### Paginacion

Los endpoints de listado aceptan parametros de query para paginacion:

| Parametro | Tipo | Default | Descripcion |
|-----------|------|---------|-------------|
| `page` | number | `1` | Numero de pagina (base 1) |
| `limit` | number | `20` | Elementos por pagina (max 100) |

### Codigos de estado HTTP

| Codigo | Significado | Uso |
|--------|-------------|-----|
| `200` | OK | Operacion exitosa |
| `201` | Created | Recurso creado exitosamente |
| `400` | Bad Request | Datos de entrada invalidos o faltantes |
| `401` | Unauthorized | Token ausente, expirado o invalido |
| `403` | Forbidden | Rol insuficiente para la operacion |
| `404` | Not Found | Recurso no encontrado |
| `409` | Conflict | Conflicto de datos (ej. email duplicado) |
| `429` | Rate Limited | Limite de peticiones excedido |
| `500` | Internal Server Error | Error interno del servidor |

### Roles y notacion de permisos

| Abreviatura | Rol | Descripcion |
|-------------|-----|-------------|
| **SA** | Superadmin | Acceso total al sistema |
| **A** | Admin | Administracion de proyectos asignados |
| **G** | Gestor | Gestion de leads en proyectos asignados |

La notacion `[SA,A]` indica que **solo** los roles Superadmin y Admin pueden acceder al endpoint. La notacion `Auth` indica que cualquier usuario autenticado (SA, A o G) puede acceder. La notacion `Public` indica que no requiere autenticacion.

---

## Health

### `GET /api/health`

Endpoint de verificacion del estado del servidor.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Public |
| **Roles** | Ninguno requerido |

**Respuesta exitosa (200):**

```json
{
  "status": "ok",
  "timestamp": "2026-04-01T12:00:00Z",
  "version": "1.0.0"
}
```

**Notas:**
- Utilizado por el balanceador de carga y sistemas de monitorizacion.
- No incluye el wrapper estandar `{ success, data }` por compatibilidad con health checks convencionales.

---

## Auth

> Fase 1 -- Subfase 1.2

### `POST /api/auth/login`

Inicia sesion con credenciales de email y contrasena.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Public |
| **Roles** | Ninguno requerido |

**Request body:**

```json
{
  "email": "usuario@ejemplo.com",
  "password": "contrasenya123"
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `email` | string | Si | Email del usuario |
| `password` | string | Si | Contrasena del usuario |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "nombre": "Juan Garcia",
      "email": "juan@ejemplo.com",
      "role": "admin",
      "projects": [
        { "id": "uuid", "nombre": "Proyecto Alpha", "slug": "proyecto-alpha" }
      ]
    }
  }
}
```

**Cookies establecidas:**
- `refresh_token`: httpOnly, Secure, SameSite=Strict. Contiene el JWT de refresco.

**Errores posibles:**

| Codigo | code | Descripcion |
|--------|------|-------------|
| 400 | `INVALID_CREDENTIALS` | Email o contrasena incorrectos |
| 400 | `ACCOUNT_DISABLED` | La cuenta esta desactivada |
| 429 | `RATE_LIMITED` | Demasiados intentos de login |

---

### `POST /api/auth/logout`

Cierra la sesion del usuario actual.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] |

**Request body:** Ninguno.

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": null
}
```

**Comportamiento:**
- Elimina la cookie `refresh_token`.
- Invalida la sesion activa en la base de datos.

---

### `POST /api/auth/refresh`

Renueva el access token utilizando el refresh token almacenado en cookie.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Cookie only (refresh_token) |
| **Roles** | Ninguno (basado en cookie) |

**Request body:** Ninguno. El refresh token se lee automaticamente de la cookie httpOnly.

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Errores posibles:**

| Codigo | code | Descripcion |
|--------|------|-------------|
| 401 | `REFRESH_TOKEN_EXPIRED` | El refresh token ha expirado |
| 401 | `REFRESH_TOKEN_INVALID` | Token invalido o revocado |

---

### `POST /api/auth/set-password`

Establece la contrasena de un usuario nuevo mediante un token de invitacion.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Public (autenticacion basada en token de invitacion) |
| **Roles** | Ninguno requerido |

**Request body:**

```json
{
  "token": "abc123def456...",
  "password": "NuevaContrasena!Segura1"
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `token` | string | Si | Token de invitacion recibido por email |
| `password` | string | Si | Nueva contrasena (min 8 chars, 1 mayuscula, 1 numero) |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": null
}
```

**Errores posibles:**

| Codigo | code | Descripcion |
|--------|------|-------------|
| 400 | `INVALID_TOKEN` | Token expirado o invalido |
| 400 | `WEAK_PASSWORD` | La contrasena no cumple los requisitos |

---

## Users

> Fase 1 -- Subfase 1.2

### `GET /api/users`

Lista todos los usuarios del sistema con filtros opcionales.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A] |

**Query parameters:**

| Parametro | Tipo | Default | Descripcion |
|-----------|------|---------|-------------|
| `search` | string | -- | Busqueda por nombre o email |
| `role` | string | -- | Filtrar por rol: `superadmin`, `admin`, `gestor` |
| `active` | boolean | -- | Filtrar por estado activo/inactivo |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "nombre": "Juan Garcia",
      "email": "juan@ejemplo.com",
      "role": "admin",
      "projects": [
        { "id": "uuid", "nombre": "Proyecto Alpha" }
      ],
      "lastLoginAt": "2026-03-28T10:15:00Z",
      "active": true
    }
  ]
}
```

---

### `POST /api/users`

Crea un nuevo usuario en el sistema.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA] |

**Request body:**

```json
{
  "nombre": "Maria Lopez",
  "email": "maria@ejemplo.com",
  "role": "gestor"
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `nombre` | string | Si | Nombre completo del usuario |
| `email` | string | Si | Email unico del usuario |
| `role` | string | Si | Rol: `superadmin`, `admin` o `gestor` |

**Respuesta exitosa (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nombre": "Maria Lopez",
    "email": "maria@ejemplo.com",
    "role": "gestor",
    "active": true,
    "createdAt": "2026-04-01T12:00:00Z"
  }
}
```

**Comportamiento:**
- Envia automaticamente un email de bienvenida via **Brevo** con un enlace para establecer contrasena (`/set-password?token=...`).
- El token de invitacion expira en 48 horas.

**Errores posibles:**

| Codigo | code | Descripcion |
|--------|------|-------------|
| 409 | `EMAIL_EXISTS` | Ya existe un usuario con ese email |
| 400 | `VALIDATION_ERROR` | Datos de entrada invalidos |

---

### `GET /api/users/:id`

Obtiene el detalle completo de un usuario.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del usuario |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nombre": "Juan Garcia",
    "email": "juan@ejemplo.com",
    "role": "admin",
    "active": true,
    "lastLoginAt": "2026-03-28T10:15:00Z",
    "createdAt": "2026-01-15T08:00:00Z",
    "projects": [
      {
        "id": "uuid",
        "nombre": "Proyecto Alpha",
        "slug": "proyecto-alpha",
        "ordenCola": 2
      }
    ]
  }
}
```

**Notas:**
- El campo `ordenCola` indica la posicion del usuario en la cola round-robin de cada proyecto asignado.

---

### `PATCH /api/users/:id`

Actualiza parcialmente los datos de un usuario.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del usuario |

**Request body:**

```json
{
  "nombre": "Juan Garcia Actualizado",
  "role": "admin",
  "active": false
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `nombre` | string | No | Nuevo nombre del usuario |
| `role` | string | No | Nuevo rol |
| `active` | boolean | No | Activar/desactivar usuario |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nombre": "Juan Garcia Actualizado",
    "role": "admin",
    "active": false,
    "updatedAt": "2026-04-01T12:30:00Z"
  }
}
```

**Comportamiento al desactivar (`active: false`):**
- Invalida todas las sesiones activas del usuario.
- Elimina al usuario de todas las colas round-robin de los proyectos asignados.
- Los leads asignados al usuario permanecen asignados (no se reasignan automaticamente).

---

### `PUT /api/users/:id/projects`

Reemplaza todas las asignaciones de proyectos de un usuario.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del usuario |

**Request body:**

```json
{
  "projects": [
    { "projectId": "uuid-proyecto-1", "ordenCola": 1 },
    { "projectId": "uuid-proyecto-2", "ordenCola": 3 }
  ]
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `projects` | array | Si | Lista de asignaciones de proyecto |
| `projects[].projectId` | UUID | Si | ID del proyecto |
| `projects[].ordenCola` | number | Si | Posicion en la cola round-robin del proyecto |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "projects": [
      { "projectId": "uuid-proyecto-1", "nombre": "Proyecto Alpha", "ordenCola": 1 },
      { "projectId": "uuid-proyecto-2", "nombre": "Proyecto Beta", "ordenCola": 3 }
    ]
  }
}
```

**Notas:**
- Esta operacion es un reemplazo total (PUT): los proyectos no incluidos en el array seran desasignados.
- Si el array esta vacio, el usuario quedara sin proyectos asignados.

---

### `GET /api/users/me`

Obtiene el perfil del usuario autenticado actualmente.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nombre": "Juan Garcia",
    "email": "juan@ejemplo.com",
    "role": "admin",
    "projects": [
      { "id": "uuid", "nombre": "Proyecto Alpha", "slug": "proyecto-alpha" }
    ],
    "lastLoginAt": "2026-03-28T10:15:00Z"
  }
}
```

---

## Projects

> Fase 1 -- Subfase 1.3

### `GET /api/projects`

Lista los proyectos accesibles por el usuario autenticado.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "nombre": "Proyecto Alpha",
      "slug": "proyecto-alpha",
      "type": "servicios",
      "emoji": "rocket",
      "active": true,
      "productCount": 5,
      "createdAt": "2026-01-10T08:00:00Z"
    }
  ]
}
```

**Notas:**
- **SA** ve todos los proyectos.
- **A** y **G** solo ven los proyectos que tienen asignados.
- Incluye `productCount` con el numero de productos activos del proyecto.

---

### `POST /api/projects`

Crea un nuevo proyecto.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA] |

**Request body:**

```json
{
  "nombre": "Proyecto Gamma",
  "slug": "proyecto-gamma",
  "type": "ecommerce",
  "emoji": "shopping_cart"
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `nombre` | string | Si | Nombre del proyecto |
| `slug` | string | Si | Slug unico (URL-safe, lowercase) |
| `type` | string | Si | Tipo de proyecto |
| `emoji` | string | No | Emoji identificador (nombre sin `:`) |

**Respuesta exitosa (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nombre": "Proyecto Gamma",
    "slug": "proyecto-gamma",
    "type": "ecommerce",
    "emoji": "shopping_cart",
    "webhookApiKey": "pk_live_abc123...",
    "active": true,
    "createdAt": "2026-04-01T12:00:00Z"
  }
}
```

**Comportamiento:**
- Genera automaticamente una `webhook_api_key` unica para la recepcion de leads via webhook.
- El slug debe ser unico en el sistema.

**Errores posibles:**

| Codigo | code | Descripcion |
|--------|------|-------------|
| 409 | `SLUG_EXISTS` | Ya existe un proyecto con ese slug |

---

### `GET /api/projects/:id`

Obtiene el detalle completo de un proyecto.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) + projectAccess |
| **Roles** | [SA, A, G] (con acceso al proyecto) |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del proyecto |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nombre": "Proyecto Alpha",
    "slug": "proyecto-alpha",
    "type": "servicios",
    "emoji": "rocket",
    "webhookApiKey": "pk_live_abc123...",
    "diasAlertaInactividad": 3,
    "active": true,
    "productCount": 5,
    "gestorCount": 3,
    "createdAt": "2026-01-10T08:00:00Z",
    "queue": [
      { "userId": "uuid", "nombre": "Gestor 1", "orden": 1, "leadCount": 45 },
      { "userId": "uuid", "nombre": "Gestor 2", "orden": 2, "leadCount": 42 }
    ]
  }
}
```

**Notas:**
- `webhookApiKey` solo visible para roles SA y A.
- `queue` muestra la configuracion actual de la cola round-robin.

---

### `PATCH /api/projects/:id`

Actualiza parcialmente un proyecto.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del proyecto |

**Request body:**

```json
{
  "nombre": "Proyecto Alpha v2",
  "emoji": "star",
  "diasAlertaInactividad": 5,
  "active": false
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `nombre` | string | No | Nuevo nombre del proyecto |
| `emoji` | string | No | Nuevo emoji identificador |
| `diasAlertaInactividad` | number | No | Dias sin actividad para alertar (default: 3) |
| `active` | boolean | No | Activar/desactivar proyecto |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nombre": "Proyecto Alpha v2",
    "emoji": "star",
    "diasAlertaInactividad": 5,
    "active": false,
    "updatedAt": "2026-04-01T13:00:00Z"
  }
}
```

---

### `GET /api/projects/:id/queue`

Obtiene la cola round-robin de gestores de un proyecto.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del proyecto |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": [
    {
      "userId": "uuid",
      "nombre": "Maria Lopez",
      "email": "maria@ejemplo.com",
      "orden": 1,
      "leadCount": 45,
      "active": true
    },
    {
      "userId": "uuid",
      "nombre": "Carlos Ruiz",
      "email": "carlos@ejemplo.com",
      "orden": 2,
      "leadCount": 42,
      "active": true
    }
  ]
}
```

**Notas:**
- `leadCount` refleja el numero total de leads asignados al gestor dentro de este proyecto.
- Solo se muestran gestores activos.

---

### `PUT /api/projects/:id/queue`

Reordena la cola round-robin de un proyecto.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del proyecto |

**Request body:**

```json
{
  "gestores": [
    { "userId": "uuid-gestor-1", "orden": 1 },
    { "userId": "uuid-gestor-2", "orden": 2 },
    { "userId": "uuid-gestor-3", "orden": 3 }
  ]
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `gestores` | array | Si | Lista ordenada de gestores |
| `gestores[].userId` | UUID | Si | ID del gestor |
| `gestores[].orden` | number | Si | Nueva posicion en la cola |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "projectId": "uuid",
    "gestores": [
      { "userId": "uuid-gestor-1", "nombre": "Maria Lopez", "orden": 1 },
      { "userId": "uuid-gestor-2", "nombre": "Carlos Ruiz", "orden": 2 },
      { "userId": "uuid-gestor-3", "nombre": "Ana Diaz", "orden": 3 }
    ]
  }
}
```

**Notas:**
- Todos los gestores del proyecto deben estar incluidos en el array.
- El orden determina quien recibe el siguiente lead entrante.

---

## Products y Dossiers

> Fase 1 -- Subfase 1.3

### `GET /api/projects/:projectId/products`

Lista los productos de un proyecto.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] (con acceso al proyecto) |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `projectId` | UUID | ID del proyecto |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "nombre": "Curso Avanzado de Marketing",
      "descripcion": "Curso intensivo de 12 semanas...",
      "active": true,
      "dossierCount": 3,
      "createdAt": "2026-02-01T10:00:00Z"
    }
  ]
}
```

---

### `POST /api/projects/:projectId/products`

Crea un nuevo producto dentro de un proyecto.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `projectId` | UUID | ID del proyecto |

**Request body:**

```json
{
  "nombre": "Consultoria Premium",
  "descripcion": "Paquete de consultoria personalizada de 3 meses"
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `nombre` | string | Si | Nombre del producto |
| `descripcion` | string | No | Descripcion del producto |

**Respuesta exitosa (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nombre": "Consultoria Premium",
    "descripcion": "Paquete de consultoria personalizada de 3 meses",
    "projectId": "uuid",
    "active": true,
    "createdAt": "2026-04-01T12:00:00Z"
  }
}
```

---

### `PATCH /api/products/:id`

Actualiza parcialmente un producto.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del producto |

**Request body:**

```json
{
  "nombre": "Consultoria Premium v2",
  "descripcion": "Paquete actualizado de consultoria",
  "active": false
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `nombre` | string | No | Nuevo nombre |
| `descripcion` | string | No | Nueva descripcion |
| `active` | boolean | No | Activar/desactivar producto |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nombre": "Consultoria Premium v2",
    "descripcion": "Paquete actualizado de consultoria",
    "active": false,
    "updatedAt": "2026-04-01T13:00:00Z"
  }
}
```

---

### `POST /api/products/:id/dossiers`

Sube un nuevo dossier (PDF) para un producto. Crea una nueva version.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del producto |

**Request body:** `multipart/form-data`

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `file` | File (PDF) | Si | Archivo PDF del dossier |

**Respuesta exitosa (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "productId": "uuid",
    "filename": "dossier-consultoria-v3.pdf",
    "version": 3,
    "subidoPor": {
      "id": "uuid",
      "nombre": "Juan Garcia"
    },
    "active": true,
    "createdAt": "2026-04-01T14:00:00Z"
  }
}
```

**Comportamiento:**
- El archivo PDF se sube a **Cloudflare R2**.
- Se crea automaticamente una nueva version (incrementando `version`).
- La version anterior se marca como `active: false`.
- Limite de tamano: 10 MB por archivo.

**Errores posibles:**

| Codigo | code | Descripcion |
|--------|------|-------------|
| 400 | `INVALID_FILE_TYPE` | Solo se aceptan archivos PDF |
| 400 | `FILE_TOO_LARGE` | El archivo excede el limite de 10 MB |

---

### `GET /api/products/:id/dossiers`

Obtiene el historial de versiones de dossiers de un producto.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] (con acceso al proyecto) |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del producto |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "filename": "dossier-consultoria-v3.pdf",
      "version": 3,
      "subidoPor": {
        "id": "uuid",
        "nombre": "Juan Garcia"
      },
      "active": true,
      "createdAt": "2026-04-01T14:00:00Z"
    },
    {
      "id": "uuid",
      "filename": "dossier-consultoria-v2.pdf",
      "version": 2,
      "subidoPor": {
        "id": "uuid",
        "nombre": "Maria Lopez"
      },
      "active": false,
      "createdAt": "2026-03-15T10:00:00Z"
    }
  ]
}
```

---

### `GET /api/dossiers/:id/download`

Genera una URL pre-firmada para descargar un dossier.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] (con acceso al proyecto) |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del dossier |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "url": "https://r2.example.com/dossiers/abc123...?X-Amz-Signature=...",
    "expiresIn": 900
  }
}
```

**Notas:**
- La URL pre-firmada expira en **15 minutos** (900 segundos).
- La URL es de un solo uso y esta ligada al dossier especifico en Cloudflare R2.

---

## Webhooks -- Captura de Leads

> Fase 1 -- Subfase 1.4

### `POST /api/webhooks/leads/:slug`

Recibe leads desde fuentes externas (formularios web, landings, etc.).

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Webhook auth (Bearer API key del proyecto) |
| **Roles** | Ninguno (autenticacion por API key) |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `slug` | string | Slug del proyecto destino |

**Headers requeridos:**

```
Authorization: Bearer <project_webhook_api_key>
Content-Type: application/json
```

**Request body:**

```json
{
  "nombre": "Pedro Martinez",
  "email": "pedro@ejemplo.com",
  "telefono": "+34612345678",
  "producto_interes": "Consultoria Premium",
  "landing_url": "https://ejemplo.com/landing-consultoria"
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `nombre` | string | Si | Nombre del lead |
| `email` | string | Si | Email del lead |
| `telefono` | string | No | Telefono del lead |
| `producto_interes` | string | No | Nombre del producto de interes |
| `landing_url` | string | Si | URL de la landing de origen |

**Respuesta exitosa (201):**

```json
{
  "success": true,
  "leadId": "uuid"
}
```

**Comportamiento:**
- El lead se asigna automaticamente al siguiente gestor en la cola round-robin del proyecto.
- Se detectan automaticamente parametros UTM de la `landing_url`.
- Se ejecuta deteccion de duplicados por email/telefono dentro del mismo proyecto.
- **Tiempo de respuesta objetivo:** < 500 ms.
- **CORS:** configurado por dominio del proyecto.

**Errores posibles:**

| Codigo | code | Descripcion |
|--------|------|-------------|
| 401 | `INVALID_API_KEY` | API key invalida o no corresponde al proyecto |
| 404 | `PROJECT_NOT_FOUND` | No existe un proyecto con ese slug |
| 400 | `VALIDATION_ERROR` | Campos obligatorios faltantes |

---

## Leads

> Fase 1 -- Subfases 1.4, 1.5

### `GET /api/leads`

Lista leads con filtros avanzados y paginacion.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] |

**Query parameters:**

| Parametro | Tipo | Default | Descripcion |
|-----------|------|---------|-------------|
| `projectId` | UUID | -- | Filtrar por proyecto |
| `status` | string | -- | Filtrar por estado: `nuevo`, `contactado`, `en_seguimiento`, `convertido`, `descartado` |
| `responsableId` | UUID | -- | Filtrar por gestor responsable |
| `canal` | string | -- | Filtrar por canal de origen |
| `fechaDesde` | ISO 8601 | -- | Fecha minima de creacion |
| `fechaHasta` | ISO 8601 | -- | Fecha maxima de creacion |
| `search` | string | -- | Busqueda por nombre, email o telefono |
| `duplicados` | boolean | -- | Mostrar solo leads marcados como duplicados |
| `page` | number | `1` | Pagina |
| `limit` | number | `20` | Elementos por pagina |
| `sort` | string | `createdAt` | Campo de ordenacion: `createdAt`, `nombre`, `status`, `updatedAt` |
| `order` | string | `desc` | Direccion: `asc` o `desc` |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "nombre": "Pedro Martinez",
      "email": "pedro@ejemplo.com",
      "telefono": "+34612345678",
      "status": "en_seguimiento",
      "canal": "landing-consultoria",
      "projectId": "uuid",
      "projectNombre": "Proyecto Alpha",
      "responsable": {
        "id": "uuid",
        "nombre": "Maria Lopez"
      },
      "productoInteres": "Consultoria Premium",
      "dossierEnviado": true,
      "esDuplicado": false,
      "createdAt": "2026-03-20T09:00:00Z",
      "updatedAt": "2026-03-25T16:00:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

**Notas:**
- Los gestores (G) solo ven leads de los proyectos que tienen asignados.
- Los admin (A) ven leads de sus proyectos asignados.
- Los superadmin (SA) ven todos los leads.

---

### `GET /api/leads/:id`

Obtiene el detalle completo de un lead.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) + projectAccess |
| **Roles** | [SA, A, G] (con acceso al proyecto del lead) |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del lead |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nombre": "Pedro Martinez",
    "email": "pedro@ejemplo.com",
    "telefono": "+34612345678",
    "status": "en_seguimiento",
    "canal": "landing-consultoria",
    "landingUrl": "https://ejemplo.com/landing-consultoria",
    "notas": "Interesado en empezar en mayo",
    "projectId": "uuid",
    "projectNombre": "Proyecto Alpha",
    "responsable": {
      "id": "uuid",
      "nombre": "Maria Lopez"
    },
    "productoInteres": {
      "id": "uuid",
      "nombre": "Consultoria Premium"
    },
    "dossierEnviado": true,
    "dossierEnviadoAt": "2026-03-22T11:00:00Z",
    "esDuplicado": false,
    "utms": {
      "utmSource": "google",
      "utmMedium": "cpc",
      "utmCampaign": "spring-2026",
      "utmTerm": "consultoria marketing",
      "utmContent": "ad-variant-a"
    },
    "interactions": [
      {
        "id": "uuid",
        "tipo": "llamada",
        "nota": "Llamada de seguimiento, interesado",
        "fecha": "2026-03-22T10:00:00Z",
        "creadoPor": { "id": "uuid", "nombre": "Maria Lopez" }
      }
    ],
    "reminders": [
      {
        "id": "uuid",
        "fechaRecordatorio": "2026-04-05T09:00:00Z",
        "nota": "Llamar para confirmar inscripcion",
        "completado": false
      }
    ],
    "statusHistory": [
      {
        "id": "uuid",
        "statusAnterior": "nuevo",
        "statusNuevo": "contactado",
        "cambiadoPor": { "id": "uuid", "nombre": "Maria Lopez" },
        "createdAt": "2026-03-21T14:00:00Z"
      }
    ],
    "duplicateInfo": {
      "isDuplicate": false,
      "duplicateOf": null,
      "duplicateCount": 0
    },
    "dossierInfo": {
      "currentVersion": {
        "id": "uuid",
        "filename": "dossier-consultoria-v3.pdf",
        "version": 3
      }
    },
    "createdAt": "2026-03-20T09:00:00Z",
    "updatedAt": "2026-03-25T16:00:00Z"
  }
}
```

---

### `PATCH /api/leads/:id`

Actualiza parcialmente un lead.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) + projectAccess |
| **Roles** | [SA, A, G] (con acceso al proyecto del lead) |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del lead |

**Request body:**

```json
{
  "notas": "Confirma interes para mayo 2026",
  "productoInteresId": "uuid-producto",
  "dossierEnviado": true
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `notas` | string | No | Notas libres sobre el lead |
| `productoInteresId` | UUID | No | ID del producto de interes |
| `dossierEnviado` | boolean | No | Marcar si se envio el dossier |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "notas": "Confirma interes para mayo 2026",
    "productoInteresId": "uuid-producto",
    "dossierEnviado": true,
    "dossierEnviadoAt": "2026-04-01T15:00:00Z",
    "updatedAt": "2026-04-01T15:00:00Z"
  }
}
```

**Comportamiento:**
- Cuando se marca `dossierEnviado: true`, se establece automaticamente `dossierEnviadoAt` con la fecha/hora actual.

---

### `PATCH /api/leads/:id/status`

Cambia el estado de un lead.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) + projectAccess |
| **Roles** | [SA, A, G] (con acceso al proyecto del lead) |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del lead |

**Request body:**

```json
{
  "status": "convertido"
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `status` | string | Si | Nuevo estado: `nuevo`, `contactado`, `en_seguimiento`, `convertido`, `descartado` |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "convertido",
    "conversionRequired": true,
    "updatedAt": "2026-04-01T15:30:00Z"
  }
}
```

**Comportamiento:**
- Se registra automaticamente en `lead_status_history` con el usuario que realizo el cambio y timestamp.
- Si el nuevo estado es `convertido`, la respuesta incluye `conversionRequired: true` para indicar al frontend que debe abrir el formulario de conversion.

---

### `PATCH /api/leads/:id/reassign`

Reasigna un lead a otro gestor.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del lead |

**Request body:**

```json
{
  "responsableId": "uuid-nuevo-gestor"
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `responsableId` | UUID | Si | ID del nuevo gestor responsable |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "responsableAnterior": { "id": "uuid", "nombre": "Maria Lopez" },
    "responsableNuevo": { "id": "uuid", "nombre": "Carlos Ruiz" },
    "updatedAt": "2026-04-01T16:00:00Z"
  }
}
```

**Errores posibles:**

| Codigo | code | Descripcion |
|--------|------|-------------|
| 400 | `GESTOR_NOT_IN_PROJECT` | El gestor destino no esta asignado al proyecto del lead |
| 404 | `USER_NOT_FOUND` | El gestor destino no existe |

---

### `GET /api/leads/:id/history`

Obtiene el historial de cambios de estado de un lead.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) + projectAccess |
| **Roles** | [SA, A, G] (con acceso al proyecto del lead) |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del lead |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "statusAnterior": "contactado",
      "statusNuevo": "en_seguimiento",
      "cambiadoPor": {
        "id": "uuid",
        "nombre": "Maria Lopez"
      },
      "createdAt": "2026-03-25T16:00:00Z"
    },
    {
      "id": "uuid",
      "statusAnterior": "nuevo",
      "statusNuevo": "contactado",
      "cambiadoPor": {
        "id": "uuid",
        "nombre": "Maria Lopez"
      },
      "createdAt": "2026-03-21T14:00:00Z"
    }
  ]
}
```

---

### `POST /api/leads/:id/interactions`

Registra una nueva interaccion con un lead.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) + projectAccess |
| **Roles** | [SA, A, G] (con acceso al proyecto del lead) |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del lead |

**Request body:**

```json
{
  "tipo": "llamada",
  "nota": "Llamada de seguimiento. El cliente confirma interes.",
  "fecha": "2026-04-01T10:30:00Z"
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `tipo` | string | Si | Tipo de interaccion: `llamada`, `email`, `whatsapp`, `reunion`, `nota` |
| `nota` | string | No | Descripcion de la interaccion |
| `fecha` | ISO 8601 | No | Fecha de la interaccion (default: ahora) |

**Respuesta exitosa (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "leadId": "uuid",
    "tipo": "llamada",
    "nota": "Llamada de seguimiento. El cliente confirma interes.",
    "fecha": "2026-04-01T10:30:00Z",
    "creadoPor": {
      "id": "uuid",
      "nombre": "Maria Lopez"
    },
    "createdAt": "2026-04-01T15:00:00Z"
  }
}
```

---

### `GET /api/leads/:id/interactions`

Lista las interacciones de un lead.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) + projectAccess |
| **Roles** | [SA, A, G] (con acceso al proyecto del lead) |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del lead |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "tipo": "llamada",
      "nota": "Llamada de seguimiento. El cliente confirma interes.",
      "fecha": "2026-04-01T10:30:00Z",
      "creadoPor": {
        "id": "uuid",
        "nombre": "Maria Lopez"
      }
    },
    {
      "id": "uuid",
      "tipo": "email",
      "nota": "Enviado dossier comercial",
      "fecha": "2026-03-22T11:00:00Z",
      "creadoPor": {
        "id": "uuid",
        "nombre": "Maria Lopez"
      }
    }
  ]
}
```

**Notas:**
- Las interacciones se ordenan por `fecha` descendente (mas reciente primero).

---

### `POST /api/leads/:id/reminders`

Crea un recordatorio asociado a un lead.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) + projectAccess |
| **Roles** | [SA, A, G] (con acceso al proyecto del lead) |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del lead |

**Request body:**

```json
{
  "fechaRecordatorio": "2026-04-05T09:00:00Z",
  "nota": "Llamar para confirmar inscripcion al curso"
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `fechaRecordatorio` | ISO 8601 | Si | Fecha y hora del recordatorio |
| `nota` | string | No | Descripcion del recordatorio |

**Respuesta exitosa (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "leadId": "uuid",
    "fechaRecordatorio": "2026-04-05T09:00:00Z",
    "nota": "Llamar para confirmar inscripcion al curso",
    "completado": false,
    "creadoPor": {
      "id": "uuid",
      "nombre": "Maria Lopez"
    },
    "createdAt": "2026-04-01T15:00:00Z"
  }
}
```

---

### `GET /api/leads/:id/reminders`

Lista los recordatorios de un lead.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) + projectAccess |
| **Roles** | [SA, A, G] (con acceso al proyecto del lead) |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del lead |

**Query parameters:**

| Parametro | Tipo | Default | Descripcion |
|-----------|------|---------|-------------|
| `completado` | boolean | -- | Filtrar por estado de completitud |
| `upcoming` | boolean | -- | Si `true`, solo devuelve recordatorios futuros no completados |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "fechaRecordatorio": "2026-04-05T09:00:00Z",
      "nota": "Llamar para confirmar inscripcion al curso",
      "completado": false,
      "creadoPor": {
        "id": "uuid",
        "nombre": "Maria Lopez"
      },
      "createdAt": "2026-04-01T15:00:00Z"
    }
  ]
}
```

---

### `PATCH /api/reminders/:id/complete`

Marca un recordatorio como completado.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del recordatorio |

**Request body:** Ninguno.

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "completado": true,
    "completadoAt": "2026-04-01T16:00:00Z",
    "updatedAt": "2026-04-01T16:00:00Z"
  }
}
```

---

## Conversions y Payments

> Fase 1 -- Subfase 1.6

### `POST /api/leads/:id/conversion`

Registra la conversion de un lead a cliente.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) + projectAccess |
| **Roles** | [SA, A, G] (con acceso al proyecto del lead) |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del lead |

**Request body:**

```json
{
  "productoContratado": "Consultoria Premium",
  "importeTotal": 2500.00,
  "importePagado": 500.00,
  "fechaCompromisoPago": "2026-05-01T00:00:00Z",
  "metodoPago": "transferencia",
  "notasPago": "Primer pago recibido. Resto en 2 cuotas."
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `productoContratado` | string | Si | Nombre o descripcion del producto contratado |
| `importeTotal` | number | Si | Importe total de la conversion (EUR) |
| `importePagado` | number | No | Importe ya pagado (default: 0) |
| `fechaCompromisoPago` | ISO 8601 | No | Fecha limite para completar el pago |
| `metodoPago` | string | No | Metodo de pago: `transferencia`, `tarjeta`, `efectivo`, `stripe`, `otro` |
| `notasPago` | string | No | Notas adicionales sobre el pago |

**Respuesta exitosa (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "leadId": "uuid",
    "productoContratado": "Consultoria Premium",
    "importeTotal": 2500.00,
    "importePagado": 500.00,
    "importePendiente": 2000.00,
    "fechaCompromisoPago": "2026-05-01T00:00:00Z",
    "metodoPago": "transferencia",
    "notasPago": "Primer pago recibido. Resto en 2 cuotas.",
    "createdAt": "2026-04-01T16:00:00Z"
  }
}
```

**Comportamiento:**
- Cambia automaticamente el estado del lead a `convertido`.
- Registra el cambio en `lead_status_history`.
- Calcula automaticamente `importePendiente = importeTotal - importePagado`.

---

### `GET /api/conversions`

Lista conversiones con filtros y paginacion.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] |

**Query parameters:**

| Parametro | Tipo | Default | Descripcion |
|-----------|------|---------|-------------|
| `projectId` | UUID | -- | Filtrar por proyecto |
| `mes` | string | -- | Filtrar por mes (formato: `YYYY-MM`) |
| `page` | number | `1` | Pagina |
| `limit` | number | `20` | Elementos por pagina |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "lead": {
        "id": "uuid",
        "nombre": "Pedro Martinez",
        "email": "pedro@ejemplo.com"
      },
      "project": {
        "id": "uuid",
        "nombre": "Proyecto Alpha"
      },
      "productoContratado": "Consultoria Premium",
      "importeTotal": 2500.00,
      "importePagado": 500.00,
      "importePendiente": 2000.00,
      "fechaCompromisoPago": "2026-05-01T00:00:00Z",
      "metodoPago": "transferencia",
      "createdAt": "2026-04-01T16:00:00Z"
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 20,
    "totalPages": 2
  }
}
```

**Notas:**
- `importePendiente` se calcula en el servidor: `importeTotal - importePagado`.

---

### `GET /api/conversions/:id`

Obtiene el detalle completo de una conversion.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID de la conversion |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "lead": {
      "id": "uuid",
      "nombre": "Pedro Martinez",
      "email": "pedro@ejemplo.com",
      "telefono": "+34612345678"
    },
    "project": {
      "id": "uuid",
      "nombre": "Proyecto Alpha"
    },
    "productoContratado": "Consultoria Premium",
    "importeTotal": 2500.00,
    "importePagado": 1500.00,
    "importePendiente": 1000.00,
    "fechaCompromisoPago": "2026-05-01T00:00:00Z",
    "metodoPago": "transferencia",
    "notasPago": "Primer pago recibido. Resto en 2 cuotas.",
    "payments": [
      {
        "id": "uuid",
        "importe": 500.00,
        "fecha": "2026-04-01T16:00:00Z",
        "notas": "Pago inicial",
        "registradoPor": { "id": "uuid", "nombre": "Maria Lopez" }
      },
      {
        "id": "uuid",
        "importe": 1000.00,
        "fecha": "2026-04-15T10:00:00Z",
        "notas": "Segunda cuota",
        "registradoPor": { "id": "uuid", "nombre": "Maria Lopez" }
      }
    ],
    "createdAt": "2026-04-01T16:00:00Z",
    "updatedAt": "2026-04-15T10:00:00Z"
  }
}
```

---

### `PATCH /api/conversions/:id`

Actualiza parcialmente una conversion.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID de la conversion |

**Request body:**

```json
{
  "importeTotal": 3000.00,
  "fechaCompromisoPago": "2026-06-01T00:00:00Z",
  "metodoPago": "tarjeta",
  "notasPago": "Actualizado: nuevo importe acordado"
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `importeTotal` | number | No | Nuevo importe total |
| `fechaCompromisoPago` | ISO 8601 | No | Nueva fecha de compromiso de pago |
| `metodoPago` | string | No | Nuevo metodo de pago |
| `notasPago` | string | No | Nuevas notas de pago |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "importeTotal": 3000.00,
    "importePagado": 1500.00,
    "importePendiente": 1500.00,
    "fechaCompromisoPago": "2026-06-01T00:00:00Z",
    "metodoPago": "tarjeta",
    "notasPago": "Actualizado: nuevo importe acordado",
    "updatedAt": "2026-04-01T17:00:00Z"
  }
}
```

---

### `POST /api/conversions/:id/payments`

Registra un nuevo pago en una conversion.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID de la conversion |

**Request body:**

```json
{
  "importe": 1000.00,
  "fecha": "2026-04-15T10:00:00Z",
  "notas": "Segunda cuota recibida por transferencia"
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `importe` | number | Si | Importe del pago (EUR) |
| `fecha` | ISO 8601 | No | Fecha del pago (default: ahora) |
| `notas` | string | No | Notas sobre el pago |

**Respuesta exitosa (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "conversionId": "uuid",
    "importe": 1000.00,
    "fecha": "2026-04-15T10:00:00Z",
    "notas": "Segunda cuota recibida por transferencia",
    "registradoPor": {
      "id": "uuid",
      "nombre": "Maria Lopez"
    },
    "createdAt": "2026-04-15T10:00:00Z"
  }
}
```

**Comportamiento:**
- Actualiza automaticamente el campo `importe_pagado` en la conversion sumando el nuevo pago.
- Recalcula `importePendiente`.

---

### `GET /api/conversions/:id/payments`

Lista el historial de pagos de una conversion.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID de la conversion |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "importe": 1000.00,
      "fecha": "2026-04-15T10:00:00Z",
      "notas": "Segunda cuota recibida por transferencia",
      "registradoPor": {
        "id": "uuid",
        "nombre": "Maria Lopez"
      }
    },
    {
      "id": "uuid",
      "importe": 500.00,
      "fecha": "2026-04-01T16:00:00Z",
      "notas": "Pago inicial",
      "registradoPor": {
        "id": "uuid",
        "nombre": "Maria Lopez"
      }
    }
  ]
}
```

---

## Dashboard

> Fase 1 -- Subfase 1.7

### `GET /api/dashboard/leads`

Obtiene metricas agregadas de leads para el dashboard.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] |

**Query parameters:**

| Parametro | Tipo | Default | Descripcion |
|-----------|------|---------|-------------|
| `projectId` | UUID | -- | Filtrar por proyecto (si no se especifica, agrega todos los accesibles) |
| `fechaDesde` | ISO 8601 | -- | Fecha inicial del rango |
| `fechaHasta` | ISO 8601 | -- | Fecha final del rango |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "totalsByProject": [
      { "projectId": "uuid", "nombre": "Proyecto Alpha", "total": 120 },
      { "projectId": "uuid", "nombre": "Proyecto Beta", "total": 85 }
    ],
    "totalsByStatus": {
      "nuevo": 45,
      "contactado": 60,
      "en_seguimiento": 55,
      "convertido": 30,
      "descartado": 15
    },
    "totalsByChannel": [
      { "canal": "google-ads", "total": 80 },
      { "canal": "meta-ads", "total": 65 },
      { "canal": "organico", "total": 40 },
      { "canal": "directo", "total": 20 }
    ],
    "temporalEvolution": {
      "granularity": "daily",
      "data": [
        { "fecha": "2026-03-25", "total": 12, "convertidos": 3 },
        { "fecha": "2026-03-26", "total": 15, "convertidos": 2 },
        { "fecha": "2026-03-27", "total": 8, "convertidos": 4 }
      ]
    }
  }
}
```

**Notas:**
- La granularidad de `temporalEvolution` se ajusta automaticamente segun el rango de fechas:
  - Hasta 30 dias: `daily`
  - 31-90 dias: `weekly`
  - Mas de 90 dias: `monthly`

---

### `GET /api/dashboard/revenue`

Obtiene metricas de facturacion y cobros.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] |

**Query parameters:**

| Parametro | Tipo | Default | Descripcion |
|-----------|------|---------|-------------|
| `projectId` | UUID | -- | Filtrar por proyecto |
| `mes` | string | mes actual | Mes a consultar (formato: `YYYY-MM`) |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "global": {
      "facturado": 45000.00,
      "cobrado": 32000.00,
      "pendiente": 13000.00
    },
    "porProyecto": [
      {
        "projectId": "uuid",
        "nombre": "Proyecto Alpha",
        "facturado": 30000.00,
        "cobrado": 22000.00,
        "pendiente": 8000.00
      },
      {
        "projectId": "uuid",
        "nombre": "Proyecto Beta",
        "facturado": 15000.00,
        "cobrado": 10000.00,
        "pendiente": 5000.00
      }
    ]
  }
}
```

**Notas:**
- `facturado`: suma de `importeTotal` de todas las conversiones del mes.
- `cobrado`: suma de `importePagado` de todas las conversiones del mes.
- `pendiente`: `facturado - cobrado`.

---

### `GET /api/dashboard/payments-due`

Obtiene pagos vencidos y proximos a vencer.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "overdue": [
      {
        "conversionId": "uuid",
        "lead": { "id": "uuid", "nombre": "Pedro Martinez" },
        "project": { "id": "uuid", "nombre": "Proyecto Alpha" },
        "importePendiente": 2000.00,
        "fechaCompromisoPago": "2026-03-28T00:00:00Z",
        "diasVencido": 4
      }
    ],
    "upcoming": [
      {
        "conversionId": "uuid",
        "lead": { "id": "uuid", "nombre": "Laura Sanchez" },
        "project": { "id": "uuid", "nombre": "Proyecto Beta" },
        "importePendiente": 1500.00,
        "fechaCompromisoPago": "2026-04-03T00:00:00Z",
        "diasRestantes": 2
      }
    ]
  }
}
```

**Notas:**
- `overdue`: conversiones con `fechaCompromisoPago` pasada y `importePendiente > 0`.
- `upcoming`: conversiones con `fechaCompromisoPago` dentro de los proximos **3 dias** y `importePendiente > 0`.

---

## Meta Ads

> Fase 2 -- Subfase 2.2

### `GET /api/meta/campaigns/:projectId`

Obtiene metricas de campanas de Meta Ads (Facebook/Instagram) vinculadas a un proyecto.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `projectId` | UUID | ID del proyecto |

**Query parameters:**

| Parametro | Tipo | Default | Descripcion |
|-----------|------|---------|-------------|
| `fechaDesde` | ISO 8601 | 30 dias atras | Fecha inicial del rango |
| `fechaHasta` | ISO 8601 | hoy | Fecha final del rango |
| `level` | string | `campaign` | Nivel de desglose: `campaign`, `adset`, `ad` |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": [
    {
      "campaignId": "123456789",
      "campaignName": "Spring Campaign 2026",
      "status": "ACTIVE",
      "objective": "LEAD_GENERATION",
      "metrics": {
        "impressions": 150000,
        "clicks": 4500,
        "spend": 1200.50,
        "ctr": 3.0,
        "cpc": 0.27,
        "cpm": 8.00
      },
      "crmLeadCount": 85,
      "crmConversionCount": 12,
      "costPerCrmLead": 14.12,
      "costPerCrmConversion": 100.04
    }
  ]
}
```

**Notas:**
- Los datos provienen de la API de Marketing de Meta, cruzados con los leads del CRM mediante UTM matching.
- `crmLeadCount` y `crmConversionCount` son conteos reales del CRM, no de Meta.
- Los importes de `spend` estan en EUR.

---

## Google Ads

> Fase 2 -- Subfase 2.3

### `GET /api/google/campaigns/:projectId`

Obtiene metricas de campanas de Google Ads vinculadas a un proyecto.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `projectId` | UUID | ID del proyecto |

**Query parameters:**

| Parametro | Tipo | Default | Descripcion |
|-----------|------|---------|-------------|
| `fechaDesde` | ISO 8601 | 30 dias atras | Fecha inicial del rango |
| `fechaHasta` | ISO 8601 | hoy | Fecha final del rango |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "campaignId": "987654321",
        "campaignName": "Search - Consultoria",
        "status": "ENABLED",
        "type": "SEARCH",
        "metrics": {
          "impressions": 80000,
          "clicks": 3200,
          "spend": 950.00,
          "ctr": 4.0,
          "cpc": 0.30,
          "conversions": 45,
          "conversionRate": 1.41
        }
      }
    ],
    "keywords": [
      {
        "keyword": "consultoria marketing digital",
        "matchType": "PHRASE",
        "impressions": 5000,
        "clicks": 200,
        "spend": 80.00,
        "ctr": 4.0,
        "cpc": 0.40,
        "qualityScore": 8
      }
    ]
  }
}
```

**Notas:**
- Los importes de `spend` ya estan convertidos a **EUR** (la API de Google devuelve valores en micros que se convierten automaticamente).
- El `qualityScore` de keywords se obtiene de la API de Google Ads.

---

## Google Search Console

> Fase 2 -- Subfase 2.4

### `GET /api/gsc/metrics/:projectId`

Obtiene metricas de rendimiento de busqueda organica de Google Search Console.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `projectId` | UUID | ID del proyecto |

**Query parameters:**

| Parametro | Tipo | Default | Descripcion |
|-----------|------|---------|-------------|
| `fechaDesde` | ISO 8601 | 28 dias atras | Fecha inicial del rango |
| `fechaHasta` | ISO 8601 | 3 dias atras | Fecha final (GSC tiene ~3 dias de delay) |
| `dimension` | string | `query` | Dimension de agrupacion: `query`, `page`, `device` |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "totals": {
      "clicks": 12500,
      "impressions": 350000,
      "ctr": 3.57,
      "position": 12.4
    },
    "rows": [
      {
        "key": "consultoria marketing digital",
        "clicks": 450,
        "impressions": 8000,
        "ctr": 5.63,
        "position": 4.2
      },
      {
        "key": "agencia marketing barcelona",
        "clicks": 320,
        "impressions": 6500,
        "ctr": 4.92,
        "position": 6.8
      }
    ]
  }
}
```

**Notas:**
- La dimension `query` muestra consultas de busqueda.
- La dimension `page` muestra paginas individuales.
- La dimension `device` muestra desglose por `DESKTOP`, `MOBILE`, `TABLET`.
- Google Search Console tiene un retraso de aproximadamente 3 dias en los datos.

---

### `GET /api/gsc/consolidated/:projectId`

Obtiene datos consolidados mensuales de trafico organico, pagado y leads totales.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `projectId` | UUID | ID del proyecto |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "months": [
      {
        "mes": "2026-01",
        "organicTraffic": 8500,
        "paidTraffic": 4200,
        "totalLeads": 45
      },
      {
        "mes": "2026-02",
        "organicTraffic": 9200,
        "paidTraffic": 3800,
        "totalLeads": 52
      },
      {
        "mes": "2026-03",
        "organicTraffic": 10100,
        "paidTraffic": 5100,
        "totalLeads": 68
      }
    ]
  }
}
```

**Notas:**
- `organicTraffic`: clicks totales de Google Search Console.
- `paidTraffic`: clicks totales de Meta Ads + Google Ads.
- `totalLeads`: leads creados en el CRM para ese proyecto y mes.
- Datos ideales para graficas de evolucion mensual.

---

## Stripe Monitor

> Fase 2 -- Subfase 2.5

### `GET /api/ia/metrics/:projectId`

Obtiene metricas de Stripe (suscripciones SaaS) para un proyecto.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `projectId` | UUID | ID del proyecto |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "mrr": 15400.00,
    "activeSubs": 128,
    "newSubs": 12,
    "cancelledSubs": 3,
    "failedPayments": 5,
    "churnRate": 2.34,
    "evolution12Months": [
      {
        "mes": "2025-05",
        "mrr": 8200.00,
        "activeSubs": 72,
        "newSubs": 8,
        "cancelledSubs": 2,
        "churnRate": 2.78
      },
      {
        "mes": "2025-06",
        "mrr": 8900.00,
        "activeSubs": 78,
        "newSubs": 10,
        "cancelledSubs": 4,
        "churnRate": 5.13
      }
    ]
  }
}
```

**Notas:**
- `mrr`: Monthly Recurring Revenue (ingresos recurrentes mensuales) en EUR.
- `churnRate`: porcentaje de cancelaciones respecto a suscripciones activas del mes anterior.
- `evolution12Months`: array con los ultimos 12 meses de datos para graficas de tendencia.
- `failedPayments`: cobros fallidos en el mes actual.

---

## Audiences

> Fase 2 -- Subfase 2.6

### `POST /api/audiences/export`

Exporta una audiencia como archivo CSV con datos hasheados.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A] |

**Request body:**

```json
{
  "projectId": "uuid",
  "filters": {
    "status": "convertido",
    "canal": "google-ads",
    "fechaDesde": "2026-01-01T00:00:00Z",
    "fechaHasta": "2026-03-31T23:59:59Z",
    "importeMinimo": 500.00
  }
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `projectId` | UUID | Si | ID del proyecto |
| `filters` | object | Si | Criterios de filtrado |
| `filters.status` | string | No | Estado del lead |
| `filters.canal` | string | No | Canal de origen |
| `filters.fechaDesde` | ISO 8601 | No | Fecha minima de creacion |
| `filters.fechaHasta` | ISO 8601 | No | Fecha maxima de creacion |
| `filters.importeMinimo` | number | No | Importe minimo de conversion (solo leads convertidos) |

**Respuesta exitosa (200):**

La respuesta es un archivo CSV descargable con headers:

```
Content-Type: text/csv
Content-Disposition: attachment; filename="audience-proyecto-alpha-2026-04-01.csv"
```

**Formato del CSV:**

```csv
email_hash,phone_hash,nombre,ciudad
a1b2c3d4e5...sha256...,f6g7h8i9...sha256...,Pedro,Madrid
```

**Notas:**
- Los campos `email` y `telefono` se hashean con **SHA256** para privacidad, compatible con Meta Custom Audiences y Google Customer Match.
- El `nombre` se incluye en texto plano para referencia.

---

### `POST /api/audiences/upload-meta`

Sube una audiencia directamente a Meta Custom Audiences.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA] |
| **Fase** | Fase 3 |

**Request body:**

```json
{
  "projectId": "uuid",
  "audienceId": "meta-audience-id-existente",
  "filters": {
    "status": "convertido",
    "fechaDesde": "2026-01-01T00:00:00Z",
    "fechaHasta": "2026-03-31T23:59:59Z"
  }
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `projectId` | UUID | Si | ID del proyecto |
| `audienceId` | string | No | ID de audiencia Meta existente (si se omite, crea una nueva) |
| `filters` | object | Si | Mismos filtros que en `/audiences/export` |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "audienceId": "meta-audience-id",
    "audienceName": "CRM - Proyecto Alpha - Convertidos Q1 2026",
    "recordsUploaded": 245,
    "matchRate": null,
    "status": "processing"
  }
}
```

**Notas:**
- La subida se realiza a traves de la API de Custom Audiences de Meta.
- El `matchRate` estara disponible posteriormente (Meta lo procesa de forma asincrona).
- Si no se especifica `audienceId`, se crea una nueva audiencia con nombre auto-generado.

---

### `GET /api/audiences/preview`

Previsualiza el tamano y composicion de una audiencia antes de exportar.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A] |

**Request body:**

```json
{
  "projectId": "uuid",
  "filters": {
    "status": "convertido",
    "canal": "meta-ads"
  }
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `projectId` | UUID | Si | ID del proyecto |
| `filters` | object | Si | Mismos filtros que en `/audiences/export` |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "count": 245,
    "sample": [
      { "nombre": "Pedro M.", "status": "convertido", "canal": "meta-ads" },
      { "nombre": "Laura S.", "status": "convertido", "canal": "meta-ads" },
      { "nombre": "Carlos R.", "status": "convertido", "canal": "meta-ads" }
    ]
  }
}
```

**Notas:**
- El `sample` incluye hasta 5 nombres abreviados (solo inicial del apellido) para verificacion visual.
- Util para confirmar la audiencia antes de proceder a la exportacion o subida.

---

## Reports

> Fase 2 -- Subfase 2.6

### `GET /api/reports/:projectId`

Lista reportes generados para un proyecto.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `projectId` | UUID | ID del proyecto |

**Query parameters:**

| Parametro | Tipo | Default | Descripcion |
|-----------|------|---------|-------------|
| `periodo` | string | -- | Filtrar por periodo (formato: `YYYY-MM`) |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "projectId": "uuid",
      "periodo": "2026-03",
      "generadoPor": { "id": "uuid", "nombre": "Juan Garcia" },
      "createdAt": "2026-04-01T08:00:00Z",
      "pdfUrl": "https://r2.example.com/reports/...",
      "pdfGeneratedAt": "2026-04-01T08:05:00Z"
    }
  ]
}
```

---

### `POST /api/reports/:projectId/generate`

Genera un nuevo reporte mediante Claude AI.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `projectId` | UUID | ID del proyecto |

**Request body:**

```json
{
  "periodo": "2026-03"
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `periodo` | string | No | Mes del reporte (formato: `YYYY-MM`, default: mes anterior) |

**Respuesta exitosa (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "projectId": "uuid",
    "periodo": "2026-03",
    "content": "# Reporte Mensual - Proyecto Alpha\n\n## Resumen Ejecutivo\n\nDurante marzo 2026...",
    "metadata": {
      "leadsAnalizados": 68,
      "conversionesAnalizadas": 12,
      "facturacionTotal": 30000.00,
      "fuentesDatos": ["crm", "meta_ads", "google_ads", "gsc"]
    },
    "generadoPor": { "id": "uuid", "nombre": "Juan Garcia" },
    "createdAt": "2026-04-01T08:00:00Z"
  }
}
```

**Comportamiento:**
- El reporte se genera utilizando **Claude AI**, que analiza los datos del CRM, campanas publicitarias y metricas organicas del periodo indicado.
- El contenido se devuelve en formato **Markdown**.
- El tiempo de generacion puede ser de 10-30 segundos.

---

### `GET /api/reports/detail/:id`

Obtiene el detalle completo de un reporte individual.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del reporte |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "projectId": "uuid",
    "projectNombre": "Proyecto Alpha",
    "periodo": "2026-03",
    "content": "# Reporte Mensual - Proyecto Alpha\n\n## Resumen Ejecutivo\n\n...",
    "metadata": {
      "leadsAnalizados": 68,
      "conversionesAnalizadas": 12,
      "facturacionTotal": 30000.00,
      "fuentesDatos": ["crm", "meta_ads", "google_ads", "gsc"]
    },
    "generadoPor": { "id": "uuid", "nombre": "Juan Garcia" },
    "pdfUrl": "https://r2.example.com/reports/...",
    "pdfGeneratedAt": "2026-04-01T08:05:00Z",
    "createdAt": "2026-04-01T08:00:00Z"
  }
}
```

---

## Chat Claude AI

> Fase 3 -- Subfase 3.3

### `POST /api/claude/chat`

Envia un mensaje al asistente Claude AI en el contexto de un proyecto.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] |
| **Rate limit** | 20 mensajes/hora/usuario |

**Request body:**

```json
{
  "message": "Cuantos leads convertimos en marzo y cual fue el canal mas efectivo?",
  "projectId": "uuid"
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `message` | string | Si | Mensaje del usuario |
| `projectId` | UUID | Si | Contexto del proyecto para la consulta |

**Respuesta:** Server-Sent Events (SSE)

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

```
data: {"type": "start", "messageId": "uuid"}

data: {"type": "delta", "content": "En marzo "}
data: {"type": "delta", "content": "2026, el proyecto "}
data: {"type": "delta", "content": "Alpha convirtio "}
data: {"type": "delta", "content": "12 leads..."}

data: {"type": "done", "messageId": "uuid", "usage": {"promptTokens": 1500, "completionTokens": 250}}
```

**Tipos de eventos SSE:**

| Tipo | Descripcion |
|------|-------------|
| `start` | Inicio de la respuesta. Incluye `messageId`. |
| `delta` | Fragmento incremental del texto de respuesta. |
| `done` | Fin de la respuesta. Incluye `messageId` y `usage`. |
| `error` | Error durante la generacion. Incluye `error` y `code`. |

**Errores posibles:**

| Codigo | code | Descripcion |
|--------|------|-------------|
| 429 | `RATE_LIMITED` | Se excedio el limite de 20 mensajes por hora |
| 400 | `MESSAGE_TOO_LONG` | El mensaje excede el limite permitido |

**Notas:**
- Claude AI tiene acceso a los datos del proyecto especificado: leads, conversiones, campanas, metricas.
- La respuesta se transmite via SSE (Server-Sent Events) para una experiencia de streaming en tiempo real.
- Rate limit: **20 mensajes por hora por usuario**. Se devuelve 429 cuando se excede.

---

## Meta Lead Ads Webhook

> Fase 3 -- Subfase 3.2

### `GET /api/webhooks/meta/leadgen`

Handshake de verificacion de Meta para webhooks.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Public |
| **Roles** | Ninguno requerido |

**Query parameters (enviados por Meta):**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `hub.mode` | string | Siempre `subscribe` |
| `hub.verify_token` | string | Token de verificacion configurado en la app de Meta |
| `hub.challenge` | string | Challenge que debe devolverse como respuesta |

**Respuesta exitosa (200):**

```
<hub.challenge value>
```

**Notas:**
- Este endpoint es llamado por Meta durante la configuracion del webhook.
- Debe devolver el valor de `hub.challenge` como texto plano si `hub.verify_token` coincide con el configurado.

---

### `POST /api/webhooks/meta/leadgen`

Recibe notificaciones de leads de Meta Lead Ads.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Public (firmado por Meta con X-Hub-Signature-256) |
| **Roles** | Ninguno requerido |

**Headers:**

```
X-Hub-Signature-256: sha256=abc123...
Content-Type: application/json
```

**Request body (enviado por Meta):**

```json
{
  "object": "page",
  "entry": [
    {
      "id": "page-id",
      "time": 1711929600,
      "changes": [
        {
          "field": "leadgen",
          "value": {
            "form_id": "form-123",
            "leadgen_id": "lead-456",
            "page_id": "page-id",
            "created_time": 1711929600
          }
        }
      ]
    }
  ]
}
```

**Respuesta exitosa (200):**

```json
{
  "success": true
}
```

**Comportamiento:**
1. Verifica la firma `X-Hub-Signature-256` del payload con el App Secret de Meta.
2. Extrae el `leadgen_id` de la notificacion.
3. Llama a la **Graph API de Meta** para obtener los datos completos del lead (nombre, email, telefono, respuestas del formulario).
4. Identifica el proyecto correspondiente por el `page_id` o `form_id`.
5. Procesa el lead a traves del pipeline de round-robin (misma logica que el webhook estandar).
6. Responde siempre 200 a Meta para evitar reintentos.

---

## Export PDF

> Fase 3 -- Subfase 3.4

### `POST /api/reports/:id/export-pdf`

Genera un PDF a partir de un reporte existente.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA, A, G] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID del reporte |

**Request body:** Ninguno.

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": {
    "reportId": "uuid",
    "pdfUrl": "https://r2.example.com/reports/reporte-alpha-2026-03.pdf?X-Amz-Signature=...",
    "expiresIn": 3600,
    "generatedAt": "2026-04-01T08:05:00Z"
  }
}
```

**Comportamiento:**
1. Toma el contenido Markdown del reporte.
2. Renderiza a HTML con estilos corporativos.
3. Convierte HTML a PDF utilizando **Puppeteer**.
4. Sube el PDF a **Cloudflare R2**.
5. Devuelve una URL pre-firmada con **1 hora** de validez.

**Notas:**
- El PDF se almacena permanentemente en R2; la URL pre-firmada se puede regenerar.
- El tiempo de generacion tipico es de 5-15 segundos.

---

## Admin

> Fase 2+

### `GET /api/admin/credentials/:projectId`

Lista las credenciales API configuradas para un proyecto.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `projectId` | UUID | ID del proyecto |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "projectId": "uuid",
      "service": "meta_ads",
      "keyName": "access_token",
      "valueMasked": "EAABs...****...xyz",
      "createdAt": "2026-02-15T10:00:00Z",
      "updatedAt": "2026-03-01T12:00:00Z"
    },
    {
      "id": "uuid",
      "projectId": "uuid",
      "service": "google_ads",
      "keyName": "refresh_token",
      "valueMasked": "1//0g...****...abc",
      "createdAt": "2026-02-15T10:00:00Z",
      "updatedAt": "2026-02-15T10:00:00Z"
    }
  ]
}
```

**Notas:**
- Los valores de las credenciales **siempre** se devuelven enmascarados (`valueMasked`).
- Nunca se expone el valor completo a traves de la API.

---

### `POST /api/admin/credentials`

Almacena una nueva credencial API encriptada.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA] |

**Request body:**

```json
{
  "projectId": "uuid",
  "service": "meta_ads",
  "keyName": "access_token",
  "value": "EAABsbCS1ZAZA..."
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `projectId` | UUID | No | ID del proyecto (null para credenciales globales) |
| `service` | string | Si | Servicio: `meta_ads`, `google_ads`, `google_search_console`, `stripe`, `brevo`, `claude` |
| `keyName` | string | Si | Nombre de la clave: `access_token`, `refresh_token`, `api_key`, `client_id`, `client_secret`, etc. |
| `value` | string | Si | Valor de la credencial (se encripta antes de almacenar) |

**Respuesta exitosa (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "projectId": "uuid",
    "service": "meta_ads",
    "keyName": "access_token",
    "valueMasked": "EAABs...****...ZA",
    "createdAt": "2026-04-01T12:00:00Z"
  }
}
```

**Comportamiento:**
- El valor se encripta con **AES-256-GCM** antes de almacenarse en la base de datos.
- Si ya existe una credencial con el mismo `projectId` + `service` + `keyName`, se actualiza (upsert).

---

### `DELETE /api/admin/credentials/:id`

Elimina una credencial API.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA] |

**Path parameters:**

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | UUID | ID de la credencial |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": null
}
```

---

### `GET /api/admin/activity-log`

Consulta el registro de actividad del sistema.

| Campo | Valor |
|-------|-------|
| **Autenticacion** | Auth (Bearer token) |
| **Roles** | [SA] |

**Query parameters:**

| Parametro | Tipo | Default | Descripcion |
|-----------|------|---------|-------------|
| `userId` | UUID | -- | Filtrar por usuario |
| `action` | string | -- | Filtrar por tipo de accion: `login`, `create_lead`, `update_lead`, `change_status`, `create_conversion`, `register_payment`, `export_audience`, `generate_report`, etc. |
| `fechaDesde` | ISO 8601 | -- | Fecha inicial del rango |
| `fechaHasta` | ISO 8601 | -- | Fecha final del rango |
| `page` | number | `1` | Pagina |
| `limit` | number | `50` | Elementos por pagina |

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user": {
        "id": "uuid",
        "nombre": "Maria Lopez",
        "email": "maria@ejemplo.com"
      },
      "action": "change_status",
      "entity": "lead",
      "entityId": "uuid",
      "details": {
        "statusAnterior": "contactado",
        "statusNuevo": "en_seguimiento",
        "leadNombre": "Pedro Martinez"
      },
      "ip": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2026-04-01T15:30:00Z"
    }
  ],
  "pagination": {
    "total": 1500,
    "page": 1,
    "limit": 50,
    "totalPages": 30
  }
}
```

**Notas:**
- Registra todas las acciones significativas realizadas por los usuarios.
- Incluye la IP y User Agent del cliente para auditoria.
- Los registros se mantienen indefinidamente.

---

## Resumen de endpoints

| Seccion | Metodo | Ruta | Auth | Roles |
|---------|--------|------|------|-------|
| **Health** | GET | `/api/health` | Public | -- |
| **Auth** | POST | `/api/auth/login` | Public | -- |
| | POST | `/api/auth/logout` | Auth | SA,A,G |
| | POST | `/api/auth/refresh` | Cookie | -- |
| | POST | `/api/auth/set-password` | Public (token) | -- |
| **Users** | GET | `/api/users` | Auth | SA,A |
| | POST | `/api/users` | Auth | SA |
| | GET | `/api/users/:id` | Auth | SA,A |
| | PATCH | `/api/users/:id` | Auth | SA |
| | PUT | `/api/users/:id/projects` | Auth | SA |
| | GET | `/api/users/me` | Auth | SA,A,G |
| **Projects** | GET | `/api/projects` | Auth | SA,A,G |
| | POST | `/api/projects` | Auth | SA |
| | GET | `/api/projects/:id` | Auth | SA,A,G |
| | PATCH | `/api/projects/:id` | Auth | SA,A |
| | GET | `/api/projects/:id/queue` | Auth | SA,A |
| | PUT | `/api/projects/:id/queue` | Auth | SA |
| **Products** | GET | `/api/projects/:projectId/products` | Auth | SA,A,G |
| | POST | `/api/projects/:projectId/products` | Auth | SA,A,G |
| | PATCH | `/api/products/:id` | Auth | SA,A,G |
| **Dossiers** | POST | `/api/products/:id/dossiers` | Auth | SA,A,G |
| | GET | `/api/products/:id/dossiers` | Auth | SA,A,G |
| | GET | `/api/dossiers/:id/download` | Auth | SA,A,G |
| **Webhooks** | POST | `/api/webhooks/leads/:slug` | API Key | -- |
| **Leads** | GET | `/api/leads` | Auth | SA,A,G |
| | GET | `/api/leads/:id` | Auth | SA,A,G |
| | PATCH | `/api/leads/:id` | Auth | SA,A,G |
| | PATCH | `/api/leads/:id/status` | Auth | SA,A,G |
| | PATCH | `/api/leads/:id/reassign` | Auth | SA,A |
| | GET | `/api/leads/:id/history` | Auth | SA,A,G |
| | POST | `/api/leads/:id/interactions` | Auth | SA,A,G |
| | GET | `/api/leads/:id/interactions` | Auth | SA,A,G |
| | POST | `/api/leads/:id/reminders` | Auth | SA,A,G |
| | GET | `/api/leads/:id/reminders` | Auth | SA,A,G |
| | PATCH | `/api/reminders/:id/complete` | Auth | SA,A,G |
| **Conversions** | POST | `/api/leads/:id/conversion` | Auth | SA,A,G |
| | GET | `/api/conversions` | Auth | SA,A,G |
| | GET | `/api/conversions/:id` | Auth | SA,A,G |
| | PATCH | `/api/conversions/:id` | Auth | SA,A,G |
| | POST | `/api/conversions/:id/payments` | Auth | SA,A,G |
| | GET | `/api/conversions/:id/payments` | Auth | SA,A,G |
| **Dashboard** | GET | `/api/dashboard/leads` | Auth | SA,A,G |
| | GET | `/api/dashboard/revenue` | Auth | SA,A,G |
| | GET | `/api/dashboard/payments-due` | Auth | SA,A,G |
| **Meta Ads** | GET | `/api/meta/campaigns/:projectId` | Auth | SA,A |
| **Google Ads** | GET | `/api/google/campaigns/:projectId` | Auth | SA,A |
| **GSC** | GET | `/api/gsc/metrics/:projectId` | Auth | SA,A |
| | GET | `/api/gsc/consolidated/:projectId` | Auth | SA,A |
| **Stripe** | GET | `/api/ia/metrics/:projectId` | Auth | SA,A |
| **Audiences** | POST | `/api/audiences/export` | Auth | SA,A |
| | POST | `/api/audiences/upload-meta` | Auth | SA |
| | GET | `/api/audiences/preview` | Auth | SA,A |
| **Reports** | GET | `/api/reports/:projectId` | Auth | SA,A,G |
| | POST | `/api/reports/:projectId/generate` | Auth | SA,A |
| | GET | `/api/reports/detail/:id` | Auth | SA,A,G |
| **Chat AI** | POST | `/api/claude/chat` | Auth | SA,A,G |
| **Meta Webhook** | GET | `/api/webhooks/meta/leadgen` | Public | -- |
| | POST | `/api/webhooks/meta/leadgen` | Public (signed) | -- |
| **Export PDF** | POST | `/api/reports/:id/export-pdf` | Auth | SA,A,G |
| **Admin** | GET | `/api/admin/credentials/:projectId` | Auth | SA |
| | POST | `/api/admin/credentials` | Auth | SA |
| | DELETE | `/api/admin/credentials/:id` | Auth | SA |
| | GET | `/api/admin/activity-log` | Auth | SA |

---

> **Total: 53 endpoints** | Documento generado para CRM MultiProyecto
