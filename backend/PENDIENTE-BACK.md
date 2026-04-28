# Cambios realizados en Frontend + Pendientes de Backend

> Fecha: 2026-04-27 | Rama: feat/sesion-completa

---

## ✅ Cambios realizados en Frontend

### 1. Ruta `/revenue` visible en UI
- **Archivos:** `Sidebar.jsx` + `CommandPalette.jsx`
- **Cambio:** Añadida entrada "Conversiones" (Contabilidad → `/revenue`) y en el buscador rápido.
- **Motivo:** La ruta existía pero era inaccesible desde la UI.

### 2. PWA — Instalable como app (CRM-209)
- **Archivos:** `frontend/public/manifest.webmanifest` *(nuevo)*, `frontend/index.html`
- **Cambios:** `manifest.webmanifest` con `display: standalone`, `start_url: /crm/`, `scope: /crm/`, `theme_color: #3b82f6`. Meta tags para iOS (`apple-mobile-web-app-*`) y Android (`theme-color`). `<link rel="manifest">` en index.html.
- **Resultado:** App instalable desde Chrome/Safari. Pendiente backend (ver Sección C).

### 3. Panel de canales embebidos (CRM-208)
- **Archivos:** `frontend/src/shared/components/layout/ChannelPanel.jsx` *(nuevo)*, `AppLayout.jsx`
- **Funcionalidad:** Botón flotante bottom-right. Panel con tabs: WhatsApp Web, Correo (mail.hostinger.com), URL personalizada. Detecta bloqueo iframe (X-Frame-Options) y muestra fallback "Abrir en nueva pestaña". Estado persistido en `localStorage`.
- **Pendiente backend:** Cuando Diego cree el módulo `project-channels`, el panel debe cargarse desde API en lugar de presets hardcodeados (ver Sección D).

### 4. Scroll del Sidebar reparado
- **Archivo:** `frontend/src/shared/components/layout/Sidebar.jsx`
- **Cambio:** Añadido `overflow-y-auto min-h-0` al `<nav>`. Sin `min-h-0`, flex ignora el overflow y el nav crece sin límite.

### 5. XSS corregido en ProjectSettingsDialog (sesión anterior)
- **Archivo:** `frontend/src/modules/settings/components/ProjectSettingsDialog.jsx`
- `dangerouslySetInnerHTML={{ __html: subtitle }}` → texto plano React.

### 6. RevenuePage conectada a API real (sesión anterior)
- **Archivo:** `frontend/src/modules/revenue/pages/RevenuePage.jsx`
- Eliminado mock data. Usa `GET /api/conversions?projectId=X&limit=100`.

### 7. CommandPalette conectada a API real (sesión anterior)
- **Archivo:** `frontend/src/shared/components/layout/CommandPalette.jsx`
- Busca leads vía `GET /api/leads?projectId=X&search=q&limit=5` con debounce 300ms.

### 8. WhatsApp Templates integrado en LeadsPage (sesión anterior)
- **Archivo:** `frontend/src/modules/leads/pages/LeadsPage.jsx`
- Hook `useWhatsappTemplates` integrado. Plantillas editables por proyecto, persistidas en `localStorage`.

---

## 🔴 Pendientes Críticos de Backend

### A. Rate limiting en `/api/auth/login`
- **Problema:** Sin protección contra fuerza bruta.
- **Solución:**
  ```bash
  cd backend && npm install express-rate-limit
  ```
  ```js
  // backend/src/modules/auth/auth.routes.js
  import rateLimit from 'express-rate-limit';
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true,
    message: { success: false, error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
  });
  router.post('/login', loginLimiter, authController.login);
  ```

### B. Módulo Meta Ads (`/api/meta/campaigns/:projectId`)
- **Frontend:** `campaigns/api/meta.api.js` — `USE_MOCKS = true` (cambiar a `false` al terminar)
- **Endpoint esperado:** `GET /api/meta/campaigns/:projectId?fechaDesde=&fechaHasta=&level=campaign`
- **Respuesta:**
  ```json
  { "success": true, "data": [{ "campaignId": "...", "campaignName": "...", "status": "ACTIVE", "objective": "LEAD_GENERATION", "metrics": { "impressions": 0, "clicks": 0, "spend": 0, "ctr": 0, "cpc": 0, "cpm": 0 }, "crmLeadCount": 0, "costPerCrmLead": 0 }] }
  ```
- **Credenciales:** tabla `credentials` → `meta_access_token`, `meta_account_id`
- **Librería:** fetch directo a `https://graph.facebook.com/v19.0/act_{account_id}/campaigns`
- **Sin credenciales configuradas:** devolver `{ success: false, error: "Credenciales no configuradas", code: "NO_CREDENTIALS" }` con 422

### C. Módulo Google Ads (`/api/google/campaigns/:projectId`)
- **Frontend:** `campaigns/api/google.api.js` — `USE_MOCKS = true`
- **Endpoint esperado:** `GET /api/google/campaigns/:projectId?fechaDesde=&fechaHasta=`
- **Respuesta incluye:** `campaigns[]` + `keywords[]` (con `qualityScore`)
- **Credenciales:** `google_ads_customer_id`, `google_ads_refresh_token` en tabla `credentials`
- **Librería:** `google-ads-api` (npm) o `googleapis`

### D. Módulo GSC (`/api/gsc/metrics/:projectId`, `/api/gsc/consolidated/:projectId`)
- **Frontend:** `seo/api/gsc.api.js` — `USE_MOCKS = true`
- **Endpoints esperados:**
  - `GET /api/gsc/metrics/:projectId?fechaDesde=&fechaHasta=&dimension=query|page|device`
  - `GET /api/gsc/consolidated/:projectId` → datos mensuales `{ mes, organicClicks, paidClicks, leads }[]`
- **Credenciales:** `gsc_property` ya está en tabla `projects`. Necesita Google OAuth service account.
- **Librería:** `googleapis` → `searchconsole.searchAnalytics.query`
- **Importante:** GSC tiene 2-3 días de retraso inherente. Recomendado: cron diario que persiste métricas en BD.

### E. Índices FK faltantes en PostgreSQL
- Verificado contra la BD en Docker (`crm-postgres`). Solo faltan 2 de los 5 sugeridos:

| Índice | Estado |
|--------|--------|
| `idx_lead_interactions_lead_id` | ✅ Ya existe |
| `idx_leads_project_status` | ✅ Ya existe (columna es `status`, no `estado`) |
| `idx_conversions_lead_id` | ❌ Falta |
| `idx_lead_reminders_lead_id` | ❌ Falta — `lead_reminders` solo tiene PK |

- **Crear en nueva migración** `029_performance_indexes.sql`:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_conversions_lead_id    ON conversions(lead_id);
  CREATE INDEX IF NOT EXISTS idx_lead_reminders_lead_id ON lead_reminders(lead_id);
  ```

---

## 🟠 Pendientes Medios de Backend

### F. Cron: notificaciones de recordatorios vencidos ⚠️ Gap real
- **Situación:** El CRUD de `lead_reminders` existe (rutas `POST /leads/:id/reminders`, `PATCH /reminders/:remId/complete`). El frontend muestra `next_reminder_at`. **Pero no hay ningún job** que envíe email al responsable cuando `fecha_recordatorio` llega.
- **Solución:** Crear `backend/src/jobs/reminderScheduler.js` siguiendo el patrón de `emailSequenceScheduler.js`:
  ```js
  // Cron cada 15 min: buscar reminders no completados con fecha_recordatorio <= NOW()
  // Enviar email via brevo.service.js al responsable del lead
  // Marcar como notificado (añadir columna notificado_at a lead_reminders si no existe)
  ```

### G. Módulo `project-channels` para ChannelPanel
- **Situación:** El `ChannelPanel.jsx` actualmente tiene presets hardcodeados (WhatsApp Web, Hostinger). Necesita poder configurarse por proyecto desde Settings.
- **Migración:**
  ```sql
  CREATE TABLE project_channels (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    icon VARCHAR(50) DEFAULT 'Globe',
    position INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX idx_project_channels_project ON project_channels(project_id);
  ```
- **Endpoints CRUD:**
  ```
  GET    /api/project-channels?projectId=X
  POST   /api/project-channels     (admin/superadmin)
  PATCH  /api/project-channels/:id (admin/superadmin)
  DELETE /api/project-channels/:id (admin/superadmin)
  ```
- **Respuesta esperada por el frontend:**
  ```json
  { "success": true, "data": [{ "id": 1, "label": "WhatsApp", "url": "https://web.whatsapp.com", "icon": "WhatsappLogo" }] }
  ```

### H. Nginx: headers para PWA (Service Worker + manifest)
- **Sin esto:** el SW no se actualiza correctamente en producción y el manifest no tiene Content-Type correcto.
  ```nginx
  # Dentro del bloque server en la config del CRM
  location = /crm/sw.js {
      add_header Cache-Control "no-cache, no-store, must-revalidate";
      add_header Pragma "no-cache";
      expires 0;
  }
  location = /crm/manifest.webmanifest {
      add_header Cache-Control "no-cache";
      add_header Content-Type "application/manifest+json";
  }
  ```

### I. Iconos PNG para PWA (192×512)
- **Situación:** El `manifest.webmanifest` apunta al `favicon.jpeg` existente. Para Lighthouse PWA score ≥ 90 se necesitan PNG reales.
- **Crear:** `frontend/public/icons/icon-192.png` (192×192) y `frontend/public/icons/icon-512.png` (512×512).
- **Herramienta:** https://maskable.app/editor — idealmente versión `maskable` con safe zone del 10%.
- **Actualizar** el `manifest.webmanifest` para apuntar a estos archivos una vez creados.

### J. Cron: alertas por email de leads sin actividad
- **Situación:** El badge visual de inactividad funciona (se calcula en SQL `dias_inactivo > dias_alerta_inactividad`). Pero la especificación menciona **alertas por email** al gestor responsable cuando un lead supera el umbral sin actividad.
- **Solución:** Ampliar `reminderScheduler.js` (o crear job separado) para enviar email diario con los leads inactivos del gestor.

---

## 🟡 Mejoras Opcionales

### K. Service Worker completo con Workbox (PWA offline)
- Instalar: `npm install -D vite-plugin-pwa`
- Configurar en `vite.config.js` con `VitePWA({ registerType: 'autoUpdate', workbox: { globPatterns: ['**/*.{js,css,html,ico,png,svg}'], navigateFallback: '/crm/index.html', navigateFallbackDenylist: [/^\/crm\/api\//] } })`
- **Importante:** NO cachear `/crm/api/*`.
- Añadir toast "Nueva versión disponible — Recargar" cuando el SW detecte actualización.

### L. Subida directa a Meta Custom Audiences
- El frontend (`audiences.api.js`) ya tiene `uploadAudienceToMeta` y `getMetaUploadStatus`.
- El backend (`audiences/audience.routes.js`) ya tiene las rutas `POST /upload-meta` y `GET /upload-meta/:id/status`.
- **Pendiente:** implementar la lógica real en `audience.controller.js::uploadMeta` usando Meta Marketing API (actualmente puede ser un stub).

### M. Nginx: `frame-src` CSP para canales embebidos
- Cuando se implemente `project_channels`, ajustar el CSP de Nginx:
  ```nginx
  add_header Content-Security-Policy "frame-src 'self' https://web.whatsapp.com https://mail.hostinger.com https://*.hostinger.com;";
  ```

### N. Webhook para Meta Lead Ads (captura directa)
- Nuevo endpoint: `POST /api/webhooks/meta-leads/:projectId`
- Verificación HMAC con `APP_SECRET` de Meta
- Parseo del payload de Lead Ads → crear lead en CRM con UTMs automáticos

---

## ✅ Items verificados como YA implementados (no acción necesaria)

| Item | Estado |
|------|--------|
| `POST /api/audiences/preview` | ✅ Existe en `audience.routes.js` + `audience.controller.js` |
| `GET /api/audiences/upload-meta/history` | ✅ Existe en `audience.routes.js` |
| `GET /api/audiences/upload-meta/:id/status` | ✅ Existe en `audience.routes.js` |
| Campo `type` en tabla `projects` | ✅ En SELECT, INSERT y UPDATE de `project.model.js` |
| Badge inactividad leads | ✅ Calculado en SQL (`dias_inactivo`), no requiere cron |
| Notificación email lead nuevo al gestor | ✅ `sendLeadAssignedEmail` en `lead.service.js` |
| `idx_lead_interactions_lead_id` | ✅ Verificado en BD Docker |
| `idx_leads_project_status` | ✅ Verificado en BD Docker |

---

*Última actualización: 2026-04-27*
