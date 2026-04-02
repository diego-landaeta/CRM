# Agentes listos para Fase 2 — Instrucciones de ejecucion

> Cada seccion es un prompt auto-contenido para iniciar un agente Claude Code.
> Copiar el bloque completo y ejecutar en una sesion nueva.
> Prerequisito: backend auth funcionando (Diego) o decidir hacerlo Angel.

---

## AGENTE 1: Backend Auth Completo

```
Implementa el modulo de autenticacion completo para el CRM MultiProyecto.

Proyecto: c:\Users\molin\Downloads\Proyectos T\CRM
Lee CLAUDE.md y docs/01-esquema-base-datos.md primero.

Backend: Node.js + Express, ES modules, PostgreSQL 16, pg pool (NO ORM), Zod validacion.
Patron modular: backend/src/modules/auth/ con index.js, auth.routes.js, auth.controller.js, auth.service.js, auth.model.js, auth.validation.js

Implementar:
1. POST /api/auth/login — email+password, bcrypt compare (cost 12), devuelve accessToken (JWT 15min) en body + refreshToken (30 dias) en httpOnly cookie
2. POST /api/auth/logout — limpia cookie + invalida refresh en DB
3. POST /api/auth/refresh — genera nuevo accessToken si refreshToken valido
4. POST /api/auth/set-password — con token unico (24h expiry), hashea con bcrypt cost 12
5. Middleware verifyToken en shared/middleware/auth.js
6. Middleware roleGuard(roles[]) — 403 si rol no permitido
7. Actualizar projectAccess.js — verificar user_projects
8. Payload JWT: { userId, email, role }
9. Refresh token hasheado en DB (columna en users o tabla aparte)

Tablas ya existen en 001_initial_schema.sql: users (con set_password_token, set_password_expires, last_login_at)

Tests: crear backend/tests/auth.test.js con Vitest
```

---

## AGENTE 2: Backend CRUD Usuarios

```
Implementa el modulo de usuarios para el CRM MultiProyecto.

Proyecto: c:\Users\molin\Downloads\Proyectos T\CRM
Depende de: AGENTE 1 (auth middleware)

Patron modular: backend/src/modules/users/
Tablas: users, user_projects, projects

Implementar:
1. GET /api/users — lista usuarios con filtros (activo/inactivo, rol, proyecto). Solo Admin/Superadmin.
2. POST /api/users — crea usuario, envia email bienvenida via Brevo con link set-password (token 24h). Solo Superadmin.
3. PATCH /api/users/:id — editar nombre, rol, proyectos asignados
4. DELETE /api/users/:id — soft delete (active=false). No permite desactivar superadmin.
5. GET /api/users/:id — detalle con proyectos asignados
6. POST /api/users/:id/projects — asignar proyectos (array de project_ids)

El frontend ya tiene la UI completa en SettingsPage.jsx — solo hay que conectar los hooks.
Brevo: usar API v3, template de bienvenida con variables {{nombre}}, {{link_set_password}}.
```

---

## AGENTE 3: Backend Webhook Leads + Round-Robin

```
Implementa el webhook de leads y el motor de asignacion round-robin.

Proyecto: c:\Users\molin\Downloads\Proyectos T\CRM
Depende de: AGENTE 1 (auth), tablas leads, lead_utms, project_queue_state

Patron modular: backend/src/modules/leads/

Implementar:
1. POST /api/webhooks/leads/:slug — publico (sin auth, con API key en header X-API-Key)
   - Validar API key contra projects.webhook_api_key
   - Capturar: nombre, email, telefono, producto_interes, pais, landing_url
   - Parsear UTMs de landing_url (utm_source, utm_medium, utm_campaign, utm_content, utm_term)
   - Capturar fbclid/gclid de la URL
   - Detectar canal automaticamente (facebook→meta_ads, google+cpc→google_ads, etc.)
   - Insertar en leads + lead_utms
   - Detectar duplicados por email en mismo proyecto
   - Round-robin: SELECT FOR UPDATE en project_queue_state, asignar al siguiente gestor activo
   - TODO en una transaccion BEGIN/COMMIT
   - Respuesta < 500ms
   - Email Brevo async (setImmediate)

2. GET /api/leads — lista con filtros (project_id, status, responsable, canal, fecha, pais, busqueda). Paginacion server-side.
3. GET /api/leads/:id — detalle completo + UTMs + interacciones + reminders
4. PATCH /api/leads/:id — actualizar campos
5. PATCH /api/leads/:id/status — cambiar estado + registrar en lead_status_history. Si "no_interesado" requiere motivo_perdida.
6. POST /api/leads/:id/interactions — crear interaccion (llamada/email/whatsapp/nota/reunion)
7. POST /api/leads/:id/reminders — crear recordatorio
8. PATCH /api/leads/:id/reassign — reasignar a otro gestor (solo Admin/SA)

El frontend ya tiene: LeadsPage, LeadDetailPage, LeadsPipelinePage, LeadFormDialog.
Solo hay que cambiar useLeads.js de mock a API calls.

CORS: configurar por dominio del proyecto (projects.allowed_origins o similar).
Indices ya creados en 001_initial_schema.sql.
```

---

## AGENTE 4: Backend Conversiones + Pagos

```
Implementa el modulo de conversiones y pagos parciales.

Proyecto: c:\Users\molin\Downloads\Proyectos T\CRM
Depende de: AGENTE 3 (leads)
Tablas: conversions, conversion_payments

Implementar:
1. POST /api/conversions — registrar conversion vinculada a lead. Auto-cambia lead.status a 'convertido'. Transaccion.
2. GET /api/conversions — lista por proyecto con filtros (mes, responsable). Incluir importe_pendiente calculado.
3. GET /api/conversions/:id — detalle + historial de pagos
4. POST /api/conversions/:id/payments — agregar abono parcial. Actualizar importe_pagado. No permitir exceder pendiente.
5. Cron daily-payment-alerts.js (9:00 AM) — detectar conversiones con fecha_compromiso_pago < hoy y pendiente > 0. Enviar email Brevo.

Frontend: ConversionDialog.jsx + RevenuePage.jsx ya estan listos.
```

---

## AGENTE 5: Backend Dashboard Queries

```
Implementa los endpoints de dashboard con queries PostgreSQL optimizadas.

Proyecto: c:\Users\molin\Downloads\Proyectos T\CRM
Depende de: AGENTE 3 + AGENTE 4

Implementar:
1. GET /api/dashboard/summary?project_id=X&month=YYYY-MM — KPIs: leads nuevos, conversiones, ingresos, tasa abandono
2. GET /api/dashboard/leads-by-week?project_id=X — leads por semana (bar chart)
3. GET /api/dashboard/conversion-by-project — tasa conversion por proyecto (donut chart)
4. GET /api/dashboard/recent-leads?project_id=X — ultimos 5 leads
5. GET /api/dashboard/revenue?project_id=X&months=6 — ingresos mensuales (area chart)

Usar CTEs para queries complejas. Verificar con EXPLAIN ANALYZE que < 100ms.
Indices ya existen en schema.

Frontend: DashboardPage.jsx + useDashboard.js — cambiar mock por API calls.
```

---

## AGENTE 6: Frontend → Conectar a API Real

```
Reemplaza todos los hooks mock por llamadas API reales en el frontend.

Proyecto: c:\Users\molin\Downloads\Proyectos T\CRM\frontend
Prerequisito: backend AGENTES 1-5 funcionando.

Archivos a modificar:
1. src/contexts/AuthContext.jsx — login/logout reales via /api/auth/login, /api/auth/logout
2. src/contexts/ProjectContext.jsx — cargar proyectos del usuario via /api/users/me/projects
3. src/modules/leads/hooks/useLeads.js — reemplazar LEADS mock por GET /api/leads + GET /api/leads/:id
4. src/modules/products/hooks/useProducts.js — reemplazar PRODUCTS mock por GET /api/products
5. src/shared/hooks/useDashboard.js — reemplazar por GET /api/dashboard/*
6. src/shared/data/mock.js — ELIMINAR este archivo cuando todo este conectado

El client.js (shared/api/client.js) ya tiene:
- fetch nativo con refresh token automatico
- Metodos: get, post, patch, put, delete, upload
- Clase ApiError

Patron para cada hook:
- Cambiar useState con mock data → useState + useEffect con fetch
- Mantener la misma interfaz que el hook actual (returns)
- Agregar loading y error states reales
```

---

## AGENTE 7: Gastos + Dashboard Financiero (Fase 2)

```
Implementa el modulo de gastos y el dashboard financiero.

Proyecto: c:\Users\molin\Downloads\Proyectos T\CRM
Tabla: expenses (ya en schema 01-esquema-base-datos.md seccion 4.7)

Backend:
1. POST /api/expenses — crear gasto (project_id, category, descripcion, importe, fecha, recurrente, campaign_id)
2. GET /api/expenses?project_id=X&month=YYYY-MM — lista por proyecto/mes
3. PATCH /api/expenses/:id — editar
4. DELETE /api/expenses/:id — eliminar
5. GET /api/dashboard/financial?project_id=X&months=6 — ingresos vs gastos por mes, beneficio neto, margen

Frontend:
- Crear modulo frontend/src/modules/expenses/ con ExpensesPage.jsx
- Formulario crear gasto con categorias (expense_category enum)
- Dashboard financiero: grafica ingresos vs gastos (BarChart apilado Recharts), beneficio neto, margen por producto
- Agregar ruta /expenses al sidebar y App.jsx
```

---

## AGENTE 8: Actividad Interna del Equipo (Fase 2)

```
Implementa el modulo de actividad interna del equipo.

Proyecto: c:\Users\molin\Downloads\Proyectos T\CRM
Tablas: team_activities, team_tasks, team_task_comments (ya en schema)

Backend:
1. POST /api/team/activities — registrar "en que estoy trabajando" (category, descripcion)
2. PATCH /api/team/activities/:id/end — marcar fin de actividad
3. GET /api/team/activities/current — actividad actual de cada miembro (vista direccion)
4. GET /api/team/activities?user_id=X&date=YYYY-MM-DD — historico por persona/dia
5. CRUD /api/team/tasks — crear, listar, completar tareas
6. POST /api/team/tasks/:id/comments — agregar comentario

Frontend:
- Crear modulo frontend/src/modules/team/ con ActivityPage.jsx
- Boton "En que estas trabajando?" con categorias predefinidas (activity_category enum)
- Vista "Mi dia" para rol operativo
- Vista direccion: tabla tiempo real con nombre, actividad, duracion
- Tareas con fecha limite y comentarios
- Agregar ruta /team al sidebar y App.jsx
- Solo visible para roles: superadmin, admin, operativo, direccion
```

---

## AGENTE 9: Meta Ads + Google Ads API (Fase 2)

```
Implementa la integracion con Meta Marketing API y Google Ads API.

Proyecto: c:\Users\molin\Downloads\Proyectos T\CRM
Tablas: meta_campaign_metrics, google_campaign_metrics, api_credentials, ad_conversions_sent

Backend:
1. Job cron daily-meta-sync.js (6:00 AM) — pull metricas de campanas activas via Marketing API v19+
   - Nivel campana: spend, impressions, clicks, cpm, cpc, cpl, conversions
   - Upsert en meta_campaign_metrics
   - Retry exponencial para error 17 (rate limit)
2. Job cron daily-google-sync.js (6:30 AM) — pull metricas via Google Ads API v16+ GAQL
   - Mismas metricas + keyword_data JSONB
   - Upsert en google_campaign_metrics
3. GET /api/campaigns?project_id=X&platform=meta|google&date_from=X&date_to=Y
4. POST /api/conversions/:id/send-to-platform — enviar conversion a Meta Conversions API o Google offline conversions
   - Registrar en ad_conversions_sent con payload, response, success

Credenciales: leer de api_credentials (encriptadas AES-256-GCM)
Frontend: CampaignsPage.jsx ya tiene UI con tabs Meta/Google — cambiar mock por API.
```

---

## AGENTE 10: Reportes Claude AI (Fase 2)

```
Implementa la generacion de reportes con Claude AI.

Proyecto: c:\Users\molin\Downloads\Proyectos T\CRM
Tabla: ai_reports

Backend:
1. Job cron monthly-report.js (1ro de cada mes, 7:00 AM) — genera reporte del mes anterior por proyecto
   - Recopila: leads, conversiones, ingresos, gasto campanas, trafico organico
   - Envia JSON estructurado a Claude API (claude-sonnet-4-5)
   - Prompt: "Genera reporte ejecutivo en markdown con resumen, rendimiento por canal, mejor/peor campana, recomendaciones"
   - Guarda en ai_reports (report_markdown, input_json)
2. POST /api/reports/generate — generar reporte bajo demanda (solo Admin/SA)
3. GET /api/reports?project_id=X — lista de reportes por proyecto
4. GET /api/reports/:id — detalle (markdown renderizado)

Frontend: ReportsPage.jsx ya tiene UI — conectar a API + renderizar markdown con react-markdown.
Instalar: npm install react-markdown remark-gfm
```

---

## Orden de ejecucion recomendado

```
AGENTE 1 (Auth) → AGENTE 2 (Users) → AGENTE 3 (Leads) → AGENTE 4 (Conversiones)
    ↓
AGENTE 5 (Dashboard) → AGENTE 6 (Conectar frontend)
    ↓
AGENTE 7 (Gastos) + AGENTE 8 (Equipo) [paralelos]
    ↓
AGENTE 9 (Ads APIs) → AGENTE 10 (Reportes IA)
```

Los agentes 1-6 completan Fase 1. Los 7-10 son Fase 2.
Fase 3 (Score IA, anomalias, chat SSE) se define despues de validar Fase 2.
