# MODULES — CRM hermano

Mapa de cada módulo del repo. Para cada uno: **qué hace**, **archivos clave**, **endpoints** (si aplica), **gotchas** conocidos.

---

## BACKEND — `backend/src/modules/`

### 🔑 auth
**Qué:** login, logout, refresh JWT, set-password, recuperación.
**Files:** `auth.controller.js`, `auth.service.js`, `auth.routes.js`, `auth.validation.js`
**Endpoints:** `POST /api/auth/login`, `/logout`, `/refresh`, `/forgot-password`, `/reset-password`, `/set-password`
**Gotchas:** access token 15min, refresh 30 días en cookie httpOnly. bcrypt cost factor 12.

### 👥 leads
**Qué:** núcleo del CRM. Webhook entrante, round-robin de asignación, CRUD, status changes, soft-delete, merge.
**Files:** `lead.controller.js`, `lead.service.js`, `lead.model.js` (queries SQL crudas), `lead.validation.js`, `lead.routes.js`
**Endpoints:** `GET /api/leads`, `POST /api/leads` (manual), `POST /api/leads/webhooks/:slug` (público), `PATCH /api/leads/:id`, `POST /api/leads/:id/merge`, `/interactions`, `/reminders`, `/status`
**Gotchas:**
- Round-robin solo asigna a `gestor` (no admin) — query `AND u.role = 'gestor'`
- `createManualLead` fuerza `responsable_id` al creador si es gestor/admin
- Dedupe rápido: si dup +mismo nombre en <10s → devuelve mismo lead
- `producto_interes_id` debe venir resuelto (no string nombre)

### 💰 conversions
**Qué:** ventas con pagos, cuotas (installments), refunds, edit/delete con motivo.
**Files:** `conversion.controller.js`, `conversion.service.js`, `conversion.model.js`, `installments.model.js`, `installments.routes.js`
**Endpoints:** `POST /api/conversions`, `PATCH /:id`, `DELETE /:id` (con motivo obligatorio), `POST /:id/payments`, `/installments` CRUD, `POST /:id/refund`
**Gotchas:**
- **No redondear nunca** — `importe_total` se auto-ajusta a suma de cuotas
- DELETE_REASONS = `['duplicada','error_carga','anulacion_cliente','otro']`
- Gestor puede borrar pagos propios via `getPaymentOwnership`
- Cobrar cuota pide importe + fecha (no usa NOW())

### 📦 products
**Qué:** catálogo de productos por proyecto. Imagen, precio, _texto fields (scraper-fed).
**Files:** `product.controller.js`, `product.service.js`, `product.model.js`, `product.validation.js`
**Endpoints:** `GET /api/products`, `POST/PATCH /:id`, `POST /:id/image`, `GET /:id/leads-stats`
**Gotchas:** `findProductByName` con unaccent + prefijo strip. Storage local por defecto (R2 si configurado).

### 🏷️ product-categories
**Qué:** árbol jerárquico de categorías por proyecto.
**Files:** `category.controller.js`, `category.model.js`
**Endpoints:** `GET /api/product-categories?projectId=X&tree=true`

### 🎓 matriculas
**Qué:** matrículas de cursos asociadas a conversions.
**Files:** `matricula.controller.js`, `matricula.model.js`
**Endpoints:** `GET /api/matriculas`, `POST /:conversionId/matricula`
**Gotchas:** firma canvas pendiente de implementar (post-BETA)

### 📄 dossiers
**Qué:** PDFs versionados subidos a R2 con pre-signed URLs.
**Files:** `dossier.controller.js`, `dossier.service.js`, `dossier.model.js`
**Endpoints:** `POST /api/products/:id/dossier`, `GET /:id/dossier-url` (presigned 15min)
**Gotchas:** versionados — la versión anterior se marca inactiva, nunca se borra

### 💼 commissions
**Qué:** reglas de comisión por gestor + cálculos automáticos por conversión.
**Files:** `commission.controller.js`, `commission.service.js`, `commission-rule.model.js`
**Endpoints:** `GET /api/commissions`, `POST /rules`, `GET /summary?period=YYYY-MM`

### 💵 payroll
**Qué:** nóminas mensuales — incluye salario base + comisiones.
**Files:** `payroll.controller.js`, `payroll.service.js`
**Endpoints:** `GET /api/payroll?period=YYYY-MM`, `POST /generate`, `POST /:id/pay`

### 📊 accounting
**Qué:** dashboard contable + ingresos consolidados.
**Files:** `accounting.controller.js`
**Endpoints:** `GET /api/accounting/dashboard`, `/income`, `/conversions`

### 💸 accounts-payable
**Qué:** cuentas por pagar (proveedores, suscripciones).
**Files:** `payable.controller.js`, `payment.controller.js`
**Endpoints:** `GET /api/accounts-payable`, `POST /:id/payment`

### 🧾 expenses
**Qué:** gastos operativos por proyecto.
**Files:** `expense.controller.js`
**Endpoints:** `GET /api/expenses`, `POST`, `PATCH /:id`

### 📨 forms
**Qué:** formularios embebibles (`<iframe>`) por proyecto. Capturan leads vía webhook interno.
**Files:** `form.controller.js`, `form.service.js`
**Endpoints:** `GET /api/forms`, `POST`, `GET /embed/form/:embedId` (público sin auth)
**Gotchas:** fallback nombre `(sin nombre)` si form trae solo email/teléfono

### 🔗 make
**Qué:** webhooks entrantes desde Make.com con mapping configurable.
**Files:** `make.controller.js`, `make.service.js`, `make.model.js`, `make.validation.js`
**Endpoints:** `POST /api/webhooks/make/:slug` (público, valida `X-Make-Secret`), `GET/POST/PATCH /api/make` (admin)
**Headers de override:** `X-Asesora-Email`, `X-Asesora-Nombre`, `X-Canal`, `X-Make-Secret`
**Gotchas:**
- Modo TEST = solo guarda payload, no crea lead. Modo ACTIVE = crea.
- Sample payload incluye `_received_overrides` para debug visible
- Reutiliza `processWebhook` así dedupe/spam/RR aplica igual

### 🪝 connectors (genérico)
**Qué:** framework de mappings genérico (usado por make, forms). `connectors.targets.js` = catálogo de campos destino.
**Files:** `connectors.service.js`, `connectors.adapters.js`, `connectors.targets.js`

### 🛒 woocommerce (import desde WP)
**Qué:** importa productos desde tiendas WooCommerce o páginas WP. Incluye HTML scraper.
**Files:** `wc.controller.js`, `wc.model.js`, `wp-rest.js`, `html-scraper.js`
**Endpoints:** `GET /api/woocommerce/preview`, `POST /runs/start`, `GET /runs/current` (polling)
**Gotchas:**
- 3 estrategias: `wc_only`, `wc_plus_cpt`, `wp_pages`
- `cpt_endpoints` se reusa como parent IDs cuando `source_strategy='wp_pages'`
- Scraper extrae `meta_box.precio.value` (number) NO `.text` (string)
- `sanitizePrecio()` defensivo en upsert por si mapping queda mal

### ✉️ email-templates + email-sequences
**Qué:** plantillas reutilizables + secuencias automáticas (drip campaigns).
**Files:** `template.controller.js`, `sequence.controller.js`, `sequence.service.js`, `triggerSequences()`
**Endpoints:** `GET /api/email-templates`, `POST`, `GET /api/email-sequences`, `POST /:id/enroll`
**Triggers:** `lead_created`, `status_changed`, `conversion_created`, manual

### 💬 messages (interna)
**Qué:** mensajería interna entre usuarios del CRM. Hilos por lead/conversión.
**Files:** `message.controller.js`, `message.model.js`
**Endpoints:** `GET /api/messages?leadId=X`, `POST`
**Notas:** agregado 2026-05 por Manuel (commit 03a46fe)

### 🤖 claude-chat (AI Chat)
**Qué:** chat con Claude AI con contexto del CRM (leads, campañas, métricas).
**Files:** `claude-chat.controller.js`, `claude-chat.service.js`
**Endpoints:** `POST /api/claude/chat` (SSE streaming)
**Gotchas:**
- Requiere `ANTHROPIC_API_KEY` en `.env`
- Frontend tiene flag `USE_MOCKS` en `frontend/src/modules/ai-chat/api/claude-chat.api.ts` para fallback con respuestas hardcoded de demo
- Stream con `data: {json}\n\n` SSE format
- Eventos: `start | delta | done | error`
- Modelo recomendado: claude-sonnet-4-6 o superior (NO Opus por cost)

### 🧠 ia-monitor
**Qué:** dashboard de Stripe + métricas IA (suscripciones, MRR).
**Files:** `ia-monitor.controller.js`
**Endpoints:** `GET /api/ia-monitor/stripe`, `/subscriptions`

### 🎯 audiences
**Qué:** exportar leads como audiencias custom para Meta Ads (CSV con email/phone hasheado).
**Files:** `audience.controller.js`, `audience.service.js`
**Endpoints:** `POST /api/audiences/export` (CSV), `POST /meta-upload` (API Meta directa)

### 🔌 external-panels
**Qué:** registro de paneles externos (sitios) por proyecto.
**Files:** `panel.controller.js`
**Endpoints:** `GET /api/external-panels`, `POST`, `PATCH /:id`

### 🔐 permissions + credentials
**Qué:** custom_roles + permisos granulares por usuario + credenciales encriptadas (AES-256) de servicios externos.
**Files:** `permission.controller.js`, `credentials.controller.js`, `credentials.service.js`
**Endpoints:** `GET /api/permissions`, `GET /api/credentials/:service`
**Gotchas:** credentials siempre encriptados en DB. Decryption sólo al usar.

### 📌 field-definitions
**Qué:** custom fields por proyecto (form dinámico). Tabla `project_field_definitions`.
**Files:** `field-def.controller.js`
**Endpoints:** `GET /api/field-definitions?projectId=X&entity=lead`
**Gotchas:** `entity` puede ser `lead | client | product`. Tipo: text/number/date/select/boolean/textarea.

### 🛠️ installation
**Qué:** wizard de setup inicial (primer superadmin, proyecto seed).
**Endpoints:** `GET /api/installation/status`, `POST /api/installation/bootstrap`

---

## FRONTEND — `frontend/src/modules/`

### Páginas principales

| Módulo | Páginas clave | Ruta | Notas |
|---|---|---|---|
| `leads` | `LeadsPage`, `LeadsPipelinePage`, `LeadDetailPage`, `AudienceExportPage` | `/prospectos`, `/pipeline`, `/audiencias` | 1101 líneas LeadsPage con filtros avanzados, bulk actions, exports, quick actions |
| `clients` | `ClientsPage`, `ClientDetailPage` | `/clientes` | Igual estructura que leads pero status=convertido |
| `matriculas` | `MatriculasPage` | `/clientes/matriculas` | Lista de matrículas con cert PDF |
| `products` | `ProductsPage`, `ProductDetailPage`, `PendingProductsPage` | `/productos` | Grid + detail con `_texto` fields del scraper |
| `product-categories` | `CategoryTreePage` | `/configuracion/categorias-arbol` | Drag-and-drop árbol |
| `conversions` | (componentes solo, no page propia) | dentro de `/clientes/:id` | `ConversionsTab`, `EditConversionDialog`, `InstallmentsDialog`, `RefundDialog` |
| `accounting` | `AccountingDashboard`, `IncomePage`, `ReceivablePage` | `/accounting/*` | Split de Contabilidad |
| `accounts-payable` | `AccountsPayablePage` | `/accounting/cxp` | |
| `commissions` | `CommissionsPage` | `/comisiones` | Reglas + cálculo mensual |
| `payroll` | `PayrollPage` | `/nominas` | Generación mensual |
| `forms` | `FormsPage`, `FormDetailPage`, `EmbedFormPage` | `/captacion/forms` | El embed es público (sin auth) |
| `make-webhooks` | `MakeWebhooksPage`, `MakeWebhookDetailPage` | `/captacion/make` | Panel para configurar mapping + ver payloads |
| `webhooks` | `WebhooksPage`, `WebhookDetailPage` | `/webhooks` | Distinto de make: webhooks genéricos |
| `email-sequences` + `email-templates` | varias pages | `/configuracion/email-*` | Editor + listado |
| `documents` | `DocumentsPage` | `/documentos` | PDFs (dossiers + certificados) |
| `campaigns` | `CampaignsPage`, `MetaCampaignsPage`, `GoogleCampaignsPage`, `SeoPage` | `/campanas/*` | Vista consolidada Meta + Google + SEO |
| `audiences` | dentro de `/prospectos/audiencias` | — | Wizard CSV upload para Meta |
| `ai-chat` | `AIChatPage` | `/ai-chat` | SSE streaming, ver gotchas abajo |
| `ia-dashboard` | `IADashboardPage` | `/ia-dashboard` | Stripe + MRR de proyectos IA |
| `messages` | `MessagesPage` | `/mensajes` | Mensajería interna |
| `external-panels` | `ExternalPanelPage` | `/external/:panelId` | Iframe a sitio externo |

### Componentes shared importantes

`frontend/src/shared/`:

| Dir | Qué hay |
|---|---|
| `api/client.js` | Axios instance con interceptors (auth, refresh, 401) |
| `components/layout/` | AppLayout, Sidebar, CommandPalette, FloatingDock, NotificationsBell, ProtectedRoute |
| `components/ui/` | shadcn-style primitivas: Button, Input, Dialog, Table, Select, Badge, MultiProjectPicker, StatusBadge, ChannelBadge, SearchableSelect, EmptyState, ProductCombobox |
| `contexts/` | AuthContext, ProjectContext, ThemeContext |
| `hooks/` | useToast, useUrlFilters, usePermission |
| `lib/format.js` | `formatDate`, `formatDateShort`, `toLocalDate` (importante: parsea YYYY-MM-DD como LOCAL, no UTC) |
| `config/betaConfig.ts` | (existe en CRM-ISEIE, no en hermano) — allowlist para mostrar "Próximamente" |

### Gotchas por módulo

**`leads/LeadFormDialog`:** `ProductCombobox` guarda `nombre` (string) no `id`. Resolver en `handleFormSubmit` buscando en `products` array.

**`leads/ReminderQuickDialog` y `LeadDrawer.add()`:** input `<datetime-local>` devuelve `YYYY-MM-DDTHH:MM` pero endpoint espera `YYYY-MM-DD`. Hacer `.slice(0,10)` + meter hora en nota.

**`ai-chat/api/claude-chat.api.ts`:** flag `USE_MOCKS = false`. Si backend no tiene `ANTHROPIC_API_KEY`, devuelve `code: 'NO_API_KEY'` y el frontend muestra error. Si querés probar sin key, poner `USE_MOCKS = true`.

**`shared/components/layout/AppLayout.jsx` → `AllProjectsGuard`:** array `ALL_PROJECTS_OK` con regex de rutas permitidas en modo "Todos los proyectos". Las rutas FE están en español (`/prospectos`) — si agregás ruta nueva que debe funcionar en ALL mode, incluila acá.

**`shared/api/client.js`:** todas las requests pasan por aquí. Maneja refresh automático en 401.

---

## Backend modules NO existentes que IA puede confundir

A veces uno asume que existen estos modules. **NO existen en este repo**:
- `notifications` (no hay módulo dedicado — usa `lead_reminders` para alertas)
- `tasks` (no implementado)
- `tickets` (no implementado, soporte va por external link)
- `analytics` (las queries están dentro de `accounting`)

---

## Cómo agregar un módulo nuevo (backend)

1. `mkdir backend/src/modules/<nombre>/`
2. Crear: `<nombre>.routes.js`, `.controller.js`, `.service.js`, `.model.js`, `.validation.js`
3. Crear `index.js` que exporte `{ prefix: '/api/<nombre>', router }`
4. Importar en `app.js` y agregar al array `modules`
5. Migration SQL si necesita tabla nueva en `backend/migrations/0NN_<nombre>.sql`

## Cómo agregar un módulo nuevo (frontend)

1. `mkdir frontend/src/modules/<nombre>/{api,components,hooks,pages}`
2. Crear `api/<nombre>.api.ts` con funciones que usen `client` de `shared/api/`
3. Crear `pages/<Nombre>Page.tsx`
4. En `App.jsx`: importar con `lazy()` y agregar `<Route path="/<nombre>" element={<Page />} />`
5. En `Sidebar.jsx`: agregar item al `NAV_SECTIONS`
