# Tickets — Módulo Documents (Facturas + Certificados Psiko Aprende)

> **Contexto:** Trabajo extra al plan original (07-tareas-jira.md). El módulo
> de documents nace de la necesidad de Psiko Aprende de emitir facturas y
> certificados pixel-perfect equivalentes a sus templates de Canva, sin
> depender de Canva como dependencia externa para cada emisión.
>
> **Asignacion principal:** Angel
> **Estado actual:** EPIC F4 prácticamente cerrado. Solo F4-005 (multi-página
> real) sigue pendiente; el resto está commiteado y en producción.
> **Última auditoría:** 2026-05-07 (verificada contra el código).

---

## Parte A — Auditoría de tickets existentes de Angel

Mapeo de los ~39 tickets asignados a Angel en `07-tareas-jira.md`, agrupados
por épic, con estado verificado contra el repo.

### EPIC F1.3 — Productos + Dossiers PDF

| Ticket | Tipo | Pts | Estado |
|---|---|---|---|
| F1-020 Schema products + dossiers | BE | 1 | ✅ done |
| F1-021 CRUD productos por proyecto | BE | 3 | ✅ done (`modules/products/` activo) |
| F1-022 Upload PDF a R2 con uuid+timestamp | BE | 5 | ✅ done (`dossier.service.js` usa `uploadToR2`) |
| F1-023 Endpoint pre-signed URL 15min | BE | 3 | ✅ done (`generatePresignedUrl` en `shared/utils/`) |
| F1-024 Historial de versiones de dossier | BE | 2 | ✅ done |
| F1-025 Frontend panel gestión productos | FE | 3 | ✅ done |
| F1-026 Frontend upload dossier drag&drop | FE | 3 | ✅ done (`DossierPanel.tsx`) |

---

### EPIC F1.5 — Ficha Lead + Historial + Seguimiento (parte de Angel)

| Ticket | Tipo | Pts | Estado |
|---|---|---|---|
| F1-038 Schema lead_status_history + interactions + reminders | BE | 1 | ✅ done |
| F1-039 PATCH /leads/:id/status con historial | BE | 3 | ✅ done |
| F1-040 POST /leads/:id/interactions | BE | 2 | ✅ done |
| F1-041 POST /leads/:id/reminders + cron diario | BE | 5 | ✅ done (`reminderScheduler.js`) |
| F1-042 Reasignación manual (admin only) | BE | 2 | ✅ done |
| F1-043 Frontend ficha lead completa | FE | 5 | ✅ done (TS pilot CRM-207) |
| F1-044 Selector status con confirmación | FE | 3 | ✅ done |
| F1-045 Timeline interacciones | FE | 5 | ✅ done |
| F1-046 Botón dossier preview/copiar enlace | FE | 3 | ✅ done (cerrado en `dc74457` — CRM-149) |
| F1-047 Formulario recordatorio | FE | 2 | ✅ done |
| F1-048 Historial de duplicado | FE | 2 | ✅ done |

---

### EPIC F1.6 — Conversiones y Pagos

| Ticket | Tipo | Pts | Estado |
|---|---|---|---|
| F1-049 Schema conversions + payments | BE | 1 | ✅ done |
| F1-050 Registrar conversion (auto status) | BE | 3 | ✅ done |
| F1-051 Abono parcial + recálculo pendiente | BE | 3 | ✅ done |
| F1-052 Cron pagos vencidos | BE | 3 | ✅ done |
| F1-053 Frontend formulario conversion | FE | 5 | ✅ done |
| F1-054 Frontend dashboard pagos pendientes | FE | 5 | ✅ done |
| F1-055 Frontend ingresos por proyecto | FE | 3 | ✅ done |

---

### EPIC F1.7 — QA Integral (parte de Angel)

| Ticket | Tipo | Pts | Estado |
|---|---|---|---|
| F1-064 QA seguridad — endpoints no filtran datos | QA | 3 | ✅ done (todas las rutas con `projectAccess`, ver F4-002) |
| F1-065 QA responsive tablet/móvil | QA | 2 | 🟡 partial — `7f0dc69` cubre dialogs y KPIs; trabajo continuo |

---

### EPIC F2 — APIs externas (Angel ones)

| Ticket | Tipo | Pts | Estado |
|---|---|---|---|
| F2-005 Google Cloud OAuth2 + Ads API | Config | 5 | ⚠️ verificar app review status (config externa) |
| F2-006 GSC: verificar 3 dominios | Config | 2 | ⚠️ verificar (config externa) |
| F2-007 Stripe Restricted Key | Config | 1 | ⚠️ verificar (config externa) |
| F2-008 Claude API key + billing limit | Config | 1 | ✅ done (claude-chat funcional) |
| F2-013 Google Ads: GAQL + cron + cost_micros | BE | 5 | ✅ done (módulo `campaigns/` activo) |
| F2-014 Refresh token Google + alerta expira | BE | 3 | ✅ done (`googleAdsTokenScheduler.js` + `googleAds.service.js`, alerta Brevo, endpoint test real) |
| F2-015 Frontend campañas Google + consolidado | FE | 5 | ✅ done (`GoogleCampaignsPage.tsx`) |
| F2-016 GSC schema + job 7 días + upsert | BE | 3 | ✅ done |
| F2-017 Frontend tráfico orgánico + top KW | FE | 5 | ✅ done (`SeoPage.tsx`) |
| F2-018 Stripe schema + MRR + churn | BE | 5 | ✅ done (módulo `ia-monitor`: cálculo MRR real contra `api.stripe.com`, snapshots en `ia_metrics_snapshots`) |
| F2-019 Frontend dashboard MRR/churn/subs | FE | 5 | ✅ done (`RevenuePage.tsx`) |

---

### EPIC F3 — Funcionalidades avanzadas (Angel ones)

| Ticket | Tipo | Pts | Estado |
|---|---|---|---|
| F3-005 Chat Claude AI — backend | BE | ? | ✅ done (`modules/claude-chat/`) |
| F3-006 Chat Claude AI — frontend | FE | ? | ✅ done (`AIChatPage.tsx`) |
| F3-007 Puppeteer template + render PDF + R2 | BE | 5 | ✅ done (resuelto vía F4-003 — PDFs van a R2) |
| F3-008 Frontend botón Exportar PDF reporte | FE | 1 | ✅ done (`reports/lib/exportPdf.ts` + botón en `ReportsPage.tsx`, jsPDF client-side) |

**Conclusiones de la auditoría (al 2026-05-07):**

1. F1.3 a F1.7 cerrados al 100% salvo F1-065 (responsive, mejora continua).
2. R2 está integrado en dossiers y documents — el bloqueante de multi-instance ya no existe.
3. F2: módulos backend y frontend cerrados (incluido F2-018 vía `ia-monitor` con cálculo real desde Stripe API). Únicos pendientes son la alerta de expira de refresh token Google (F2-014) y verificaciones de **configuración externa** que dependen de credenciales y no de código.
4. F3-008 cerrado el 2026-05-07 — botón "PDF" en `ReportsPage` con jsPDF client-side, reusa el patrón de `reports-ia.api.ts`.
5. EPIC F4 (Parte B) cerrado al 100% (36/36 pts) tras F4-005 (multi-page facturas). Ver tabla resumen al final.

---

## Parte B — EPIC Documents (Facturas + Certificados Psiko Aprende)

**Asignación principal:** Angel (frontend), Diego (backend)
**Dependencias:** F1.7 done, F3-007 (Puppeteer base) — todo done
**Estado del epic:** 10/11 tickets cerrados al 2026-05-07.

**Contexto del producto:** Psiko Aprende emite ~50-100 facturas/mes y
certificados al cierre de cada diplomado. El template Canva (numbered
FAC-{año}-{NNNN} y CERT-{año}-{NNNN}) se replica pixel-perfect en HTML/CSS y
se renderiza con Puppeteer. La v1 fue commiteada en `95d64df`; las stories
abajo cerraron los gaps para producción.

---

### [F4-001] Migración schema `document_counters` + `documents` + verificación

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 2
- **Estado:** ✅ **DONE** — `migrations/029_documents.sql`
- **Criterios de aceptación:**
  - [x] Tabla `document_counters` con PK `(project_id, type)` y `last_number INTEGER NOT NULL DEFAULT 0`
  - [x] Tabla `documents` con todos los campos requeridos
  - [x] Migración SQL idempotente (`IF NOT EXISTS`)
  - [x] Constraint UNIQUE en `(project_id, type, number)` via `idx_documents_number`
  - [x] Índice en `documents(project_id, created_at DESC)`

---

### [F4-002] ProjectAccess middleware + Zod en rutas `/documents/*`

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 3
- **Estado:** ✅ **DONE** — `documents.routes.js` aplica `verifyToken + roleGuard + projectAccess` en todas las rutas; `documents.validation.js` exporta los schemas Zod.
- **Criterios de aceptación:**
  - [x] `projectAccess` aplicado a `GET /`, `POST /generate`, `GET /:id/download`, `DELETE /:id`, `GET /next-number`, `POST /set-number`, `POST /:id/regenerate`, `POST /:id/resend-email`, `GET /:id/audit`
  - [x] Gestor accediendo a un `projectId` no asignado → 403
  - [x] Validación Zod en endpoints de mutación (`documents.validation.js`)
  - [x] Schemas exportados desde `documents.validation.js`
- **Nota:** `POST /preview` queda fuera de `projectAccess` por diseño (no toca DB, solo renderiza HTML; basta el `roleGuard`).

---

### [F4-003] Storage en R2 — subida tras generar PDF + URL pre-firmada en download

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 5
- **Estado:** ✅ **DONE** — migración `040_documents_r2_and_email.sql` añadió `r2_key`. `documents.controller.js` usa `uploadToR2`/`deleteFromR2`/`generatePresignedUrl`.
- **Criterios de aceptación:**
  - [x] Tras generar PDF, se sube a R2 bajo `documents/{projectId}/{filename}.pdf`
  - [x] Campo `documents.r2_key` añadido (varchar nullable para retrocompat)
  - [x] `GET /:id/download` devuelve URL pre-firmada R2 (15min) cuando `r2_key` existe
  - [x] Fallback al FS local cuando R2 falla (con log de warning)
  - [x] Documentos legacy (sin `r2_key`) siguen descargables vía controller existente
- **Nota:** El PDF local no se elimina en hot path; lo limpia F4-004 (cron orphans).

---

### [F4-004] Cron de limpieza de PDFs huérfanos en FS local

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 2
- **Estado:** ✅ **DONE** — `backend/src/jobs/documentOrphanScheduler.js`
- **Criterios de aceptación:**
  - [x] Cron diario que escanea `UPLOAD_DIR` y borra archivos sin match en DB
  - [x] Grace period para archivos recientes
  - [x] Log resumen de archivos eliminados

---

### [F4-005] Multi-página real para facturas/certificados con muchos items

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 5
- **Estado:** ✅ **DONE** (2026-05-07) — `generateInvoicePdf` decide single vs multi-page por umbral `MAX_SINGLE_PAGE = 22`. La nueva función `buildInvoiceHtmlMultiPage` reescribe el layout a flujo natural con `thead { display: table-header-group }` y `page-break-inside: avoid` en filas y bottom-row. El footer rosa-palo se inyecta vía `puppeteer.pdf({ displayHeaderFooter: true, footerTemplate: buildInvoiceFooterTemplate() })`. Single-page (≤22 items) sigue usando el layout absolute pixel-perfect del Canva original sin tocar.
- **Criterios de aceptación:**
  - [x] Factura con 30+ líneas se renderiza en N páginas correctamente (filas con `page-break-inside: avoid`)
  - [x] Cada página repite el header de la tabla (`thead { display: table-header-group }`)
  - [x] Sello/Firma + Totals box solo en la última página (`.bottom-row` con `page-break-inside: avoid`)
  - [x] Footer rosa-palo + LOPD en cada página vía `puppeteer.pdf({ footerTemplate })`
  - [⚠] Certificado con 30+ módulos en P2 — ya es multi-page real (mergea P1+P2 con `pdf-lib`), pero la P2 sigue layout absolute single-page. Si un curso supera ~30 módulos habrá que aplicar el mismo refactor a `buildCertP2Html`. Trasladado a F4-005b (no se ha dado el caso en producción).
- **Nota:** El umbral 22 preserva pixel-perfect en ~95% de facturas; >22 cambia a flujo natural sin compact/dense. Tests en `backend/tests/invoiceMultiPage.test.js` (10 cases). El preview en el form sigue usando `buildInvoiceHtml` single-page.

---

### [F4-006] Audit log de generación + descarga de documentos

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 3
- **Estado:** ✅ **DONE** — migración `039_document_audit_log.sql` + endpoint `GET /:id/audit` (solo SA) + `documents.model.js::logAudit()`. Frontend muestra el historial vía `AuditDrawer.tsx`.
- **Criterios de aceptación:**
  - [x] Tabla `document_audit_log` con (id, document_id, action, user_id, ip, user_agent, metadata, created_at)
  - [x] Acciones: `generated`, `downloaded`, `regenerated`, `deleted`, `number_overridden`, `emailed`
  - [x] Insert en cada hit relevante
  - [x] `GET /:id/audit` solo SA — devuelve historial completo

---

### [F4-007] Rate limiting + cola para `/generate` (Puppeteer es heavy)

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 3
- **Estado:** ✅ **DONE** — `documents.routes.js` aplica `heavyGenLimit` (express-rate-limit, 20 req / 5 min por usuario) a `/generate` y `/:id/regenerate`.
- **Criterios de aceptación:**
  - [x] Rate limit por usuario (20 req / 5 min) con respuesta 429 + `Retry-After`
  - [x] Headers estándar habilitados
  - [ ] ~~Concurrencia in-memory por proyecto~~ — descartado: el rate por usuario cubre el caso de abuso.

---

### [F4-008] Endpoint regenerar PDF desde `documents.data`

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 2
- **Estado:** ✅ **DONE** — `POST /:id/regenerate` (solo SA/admin, con rate limit) en `documents.routes.js`.
- **Criterios de aceptación:**
  - [x] Re-genera PDF desde `documents.data` con el template actual
  - [x] Mantiene el mismo `number` y no toca `document_counters`
  - [x] Solo SA/admin
  - [x] Audit log con action = `regenerated`

---

### [F4-009] Email automático de factura/certificado al cliente

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 5
- **Estado:** ✅ **DONE** — `documents.email.js` + columna `projects.auto_email_documents` (migración 040) + endpoint `POST /:id/resend-email` para reenvío manual.
- **Criterios de aceptación:**
  - [x] Auto-envío al generar si `projects.auto_email_documents = true`
  - [x] Templates Brevo (`invoice_emitted_es` / `certificate_emitted_es`)
  - [x] Configurable por proyecto (`auto_email_documents` boolean default false)
  - [x] No envía si el cliente/alumno no tiene email
  - [x] Audit log con action = `emailed`
  - [x] Reenvío manual vía `POST /:id/resend-email`

---

### [F4-010] Tests Vitest del módulo

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 3
- **Estado:** ✅ **DONE** — `backend/tests/documents.test.js`

---

### [F4-011] Frontend: panel admin "Configuración de numeración"

- **Asignado a:** Angel
- **Tipo:** Frontend
- **Story points:** 3
- **Estado:** ✅ **DONE** — `frontend/src/modules/documents/pages/DocumentsConfigPage.tsx` registrado en `App.jsx` bajo `/configuracion/documentos`. Entrada en sidebar de settings (`Numeración docs`). Cerrado completamente al 2026-05-07 con el toggle Brevo auto-email (commit pendiente).
- **Criterios de aceptación:**
  - [x] Página `/crm/configuracion/documentos`
  - [x] Lista counters por proyecto+tipo
  - [x] Edición de next-number con confirmación (llama a `documentsApi.setNumber`)
  - [x] Histograma de últimos 12 meses (línea 241 del componente)
  - [x] Toggle Brevo auto-email por proyecto (PATCH /projects/:id con `auto_email_documents`), con optimistic update y rollback en error

---

## Resumen de Story Points — EPIC F4

División real del equipo: **Angel solo frontend, Diego todo el backend** (no
sigue la asignación nominal del plan original 07-tareas-jira.md).

| Story | Asignado | Tipo | Pts | Estado |
| --- | --- | --- | --- | --- |
| F4-001 Migración schema | Diego | BE | 2 | ✅ DONE |
| F4-002 projectAccess + Zod | Diego | BE | 3 | ✅ DONE |
| F4-003 Storage R2 | Diego | BE | 5 | ✅ DONE |
| F4-004 Cron limpieza huérfanos | Diego | BE | 2 | ✅ DONE |
| F4-005 Multi-página real | Diego | BE | 5 | ✅ DONE |
| F4-006 Audit log | Diego | BE | 3 | ✅ DONE |
| F4-007 Rate limit + cola | Diego | BE | 3 | ✅ DONE |
| F4-008 Regenerar PDF | Diego | BE | 2 | ✅ DONE |
| F4-009 Email automático | Diego | BE | 5 | ✅ DONE |
| F4-010 Tests Vitest | Diego | BE | 3 | ✅ DONE |
| F4-011 Panel admin numeración | Angel | FE | 3 | ✅ DONE |
| **Total F4** | | | **36 pts** | 11✅ · 0🔴 |

**Pts cerrados:** 36 / 36 (100 %). Epic F4 completamente cerrado al 2026-05-07.

---

## Pendientes reales al 2026-05-07

Lista corta de lo único que sigue abierto, en orden de prioridad:

1. **[F1-065] QA responsive continuo** — Angel · QA · 2 pts.
   Trabajo iterativo, no bloquea releases. Último avance hoy en `7f0dc69`
   (grids 3-4 cols + KPIs grandes en dialogs). No tiene cierre formal.

2. **Verificaciones de configuración externa (F2-005, F2-006, F2-007)** —
   No son trabajo de código. Requieren login en consolas Google/Stripe para
   confirmar app review, dominios verificados y key restringida. **Acción:**
   sesión de 30 min de checks + screenshot, sin necesidad de PR.

3. **[F4-005b] Multi-página real para certificado P2** — Diego · BE · 3 pts.
   Si un curso supera ~30 módulos en `buildCertP2Html`, aplicar el mismo
   refactor que F4-005 hizo a la factura. **No bloqueante** — no se ha dado
   el caso en producción.

---

> **Nota:** Cuando estos tickets se trasladen a Jira (proyecto CRM), usar el
> mismo formato de IDs (CRM-XXX). Los `[F4-NNN]` aquí son provisionales.
> Jira está suspendido por pago al 2026-05-07; este doc es la fuente
> autoritativa hasta que se reactive.
