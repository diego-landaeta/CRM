# Tickets — Módulo Documents (Facturas + Certificados Psiko Aprende)

> **Contexto:** Trabajo extra al plan original (07-tareas-jira.md). El módulo
> de documents nace de la necesidad de Psiko Aprende de emitir facturas y
> certificados pixel-perfect equivalentes a sus templates de Canva, sin
> depender de Canva como dependencia externa para cada emisión.
>
> **Asignacion principal:** Angel
> **Estado actual:** v1 funcional commiteado en `95d64df`. Lista de mejoras
> pendientes documentada abajo.

---

## Parte A — Auditoría de tickets existentes de Angel

Mapeo de los ~39 tickets asignados a Angel en `07-tareas-jira.md`, agrupados
por épic, con estado estimado a partir de la estructura del repo.

### EPIC F1.3 — Productos + Dossiers PDF

| Ticket | Tipo | Pts | Estado |
|---|---|---|---|
| F1-020 Schema products + dossiers | BE | 1 | ✅ done (tablas existen) |
| F1-021 CRUD productos por proyecto | BE | 3 | ✅ done (`modules/products/` activo) |
| F1-022 Upload PDF a R2 con uuid+timestamp | BE | 5 | ⚠️ verificar — puede estar pendiente o usando FS local |
| F1-023 Endpoint pre-signed URL 15min | BE | 3 | ⚠️ verificar |
| F1-024 Historial de versiones de dossier | BE | 2 | ⚠️ verificar (status active/inactive) |
| F1-025 Frontend panel gestión productos | FE | 3 | ✅ done (módulo TS-pilot ya commiteado) |
| F1-026 Frontend upload dossier drag&drop | FE | 3 | ⚠️ verificar |

**Acción:** Verificar manualmente que F1-022/023/024/026 estén live en prod
con R2 real (no fallback a FS). Si están con FS local, abrir tickets de
migración antes de la siguiente release.

---

### EPIC F1.5 — Ficha Lead + Historial + Seguimiento (parte de Angel)

| Ticket | Tipo | Pts | Estado |
|---|---|---|---|
| F1-038 Schema lead_status_history + interactions + reminders | BE | 1 | ✅ done |
| F1-039 PATCH /leads/:id/status con historial | BE | 3 | ✅ done |
| F1-040 POST /leads/:id/interactions | BE | 2 | ✅ done |
| F1-041 POST /leads/:id/reminders + cron diario | BE | 5 | ✅ done (cron mencionado en CLAUDE.md) |
| F1-042 Reasignación manual (admin only) | BE | 2 | ✅ done |
| F1-043 Frontend ficha lead completa | FE | 5 | ✅ done (TS pilot CRM-207 cerrado) |
| F1-044 Selector status con confirmación | FE | 3 | ✅ done |
| F1-045 Timeline interacciones | FE | 5 | ✅ done |
| F1-046 Botón dossier preview/copiar enlace | FE | 3 | ⚠️ verificar (depende de F1-023) |
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
| F1-064 QA seguridad — endpoints no filtran datos | QA | 3 | ⚠️ pendiente — sigue habiendo rutas sin `projectAccess` (ver F4-002) |
| F1-065 QA responsive tablet/móvil | QA | 2 | ⚠️ verificar — varios módulos nuevos no han pasado este check |

---

### EPIC F2 — APIs externas (Angel ones)

| Ticket | Tipo | Pts | Estado |
|---|---|---|---|
| F2-005 Google Cloud OAuth2 + Ads API | Config | 5 | ⚠️ verificar app review status |
| F2-006 GSC: verificar 3 dominios | Config | 2 | ⚠️ verificar |
| F2-007 Stripe Restricted Key | Config | 1 | ⚠️ verificar |
| F2-008 Claude API key + billing limit | Config | 1 | ✅ probable done (claude-chat.api.ts existe) |
| F2-013 Google Ads: GAQL + cron + cost_micros | BE | 5 | ⚠️ verificar |
| F2-014 Refresh token Google + alerta expira | BE | 3 | ⚠️ verificar |
| F2-015 Frontend campañas Google + consolidado | FE | 5 | ⚠️ verificar |
| F2-016 GSC schema + job 7 días + upsert | BE | 3 | ⚠️ verificar |
| F2-017 Frontend tráfico orgánico + top KW | FE | 5 | ⚠️ verificar |
| F2-018 Stripe schema + MRR + churn | BE | 5 | ⚠️ verificar |
| F2-019 Frontend dashboard MRR/churn/subs | FE | 5 | ⚠️ verificar |

---

### EPIC F3 — Funcionalidades avanzadas (Angel ones)

| Ticket | Tipo | Pts | Estado |
|---|---|---|---|
| F3-005 Chat Claude AI — backend | BE | ? | ⚠️ verificar (ai-chat existe) |
| F3-006 Chat Claude AI — frontend | FE | ? | ⚠️ verificar |
| F3-007 Puppeteer template + render PDF + R2 | BE | 5 | 🟡 partial — puppeteer SÍ funciona pero PDFs van a FS local, no R2 |
| F3-008 Frontend botón Exportar PDF reporte | FE | 1 | ⚠️ verificar |

**Conclusiones de la auditoría:**
1. La columna lead/conversiones/dashboard está sólida; no hay tickets críticos abiertos en F1.5-F1.7 más allá de QA.
2. F1-022/023/024 (R2) y F3-007 (Puppeteer→R2) parecen estar a medias — los PDFs se están guardando en filesystem local en lugar de R2. Esto bloquea producción multi-instance.
3. Los tickets F2 de Angel (Google Ads, GSC, Stripe) requieren verificación in situ.
4. El **módulo `documents/` es nuevo** y no estaba en el plan — necesita su propio set de tickets (Parte B).

---

## Parte B — Nuevo EPIC: Documents (Facturas + Certificados Psiko Aprende)

**Asignación principal:** Angel
**Dependencias:** F1.7 done, F3-007 (Puppeteer base)
**Semana:** post-F3 (semana 10+)

**Contexto del producto:** Psiko Aprende emite ~50-100 facturas/mes y
certificados al cierre de cada diplomado. El template Canva (numbered FAC-{año}-{NNNN}
y CERT-{año}-{NNNN}) se replica pixel-perfect en HTML/CSS y se renderiza
con Puppeteer. La v1 está commiteada (`95d64df`); las stories abajo cierran
los gaps para producción.

---

### [F4-001] Migración schema `document_counters` + `documents` + verificación

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 2
- **Estado:** ✅ **DONE** — `migrations/029_documents.sql` ya tiene todo
- **Criterios de aceptación:**
  - [x] Tabla `document_counters` con PRIMARY KEY `(project_id, type)` (equivale a UNIQUE) y campo `last_number INTEGER NOT NULL DEFAULT 0`
  - [x] Tabla `documents` con todos los campos requeridos (id, project_id, type, number, client_*, data jsonb, file_path, created_by, created_at)
  - [x] Migración SQL con `IF NOT EXISTS` (idempotente)
  - [x] Constraint UNIQUE en `(project_id, type, number)` via `idx_documents_number` UNIQUE INDEX
  - [x] Índice en `documents(project_id, created_at DESC)` ya creado
- **Notas técnicas:** Verificado contra `backend/migrations/029_documents.sql`. Sin trabajo pendiente.

---

### [F4-002] ProjectAccess middleware + Zod en rutas `/documents/*`

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 3
- **Estado:** 🔴 **PENDING** — rutas solo tienen `verifyToken + roleGuard`; no existe `documents.validation.js`. Pero `shared/middleware/projectAccess.js` y el package `zod` ya están disponibles (no hay que instalar nada).
- **Criterios de aceptación:**
  - [ ] Middleware `projectAccess` aplicado a `GET /`, `POST /generate`, `POST /preview`, `GET /:id/download`, `DELETE /:id`, `GET /next-number`, `POST /set-number`
  - [ ] Gestor accediendo a un `projectId` no asignado → 403
  - [ ] Validación Zod en `generate`, `preview`, `set-number`, `peek-number` reemplazando los `if (!x) throw new AppError(...)` actuales
  - [ ] Schemas: `generateSchema`, `previewSchema`, `setNumberSchema` exportados desde `documents.validation.js`
- **Notas técnicas:** El middleware ya existe en `shared/middleware/projectAccess.js`. Zod schemas siguen el patrón de los demás módulos (e.g. `leads/leads.validation.js`).

---

### [F4-003] Storage en R2 — subida tras generar PDF + URL pre-firmada en download

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 5
- **Estado:** 🔴 **PENDING** — actualmente PDFs van a `backend/uploads/documents/` (FS local). Pero `shared/services/r2.service.js` y `shared/services/localStorage.service.js` ya existen — la integración debe seguir el patrón de dossiers (F1-022/023).
- **Criterios de aceptación:**
  - [ ] Tras `generateInvoicePdf`/`generateCertificatePdf`, el PDF se sube a R2 bajo `documents/{projectId}/{filename}.pdf`
  - [ ] Campo `documents.r2_key` añadido (varchar, nullable para retrocompat)
  - [ ] Endpoint `GET /:id/download` devuelve URL pre-firmada R2 (15min) en lugar de servir el archivo desde FS
  - [ ] PDF local se elimina tras subida exitosa a R2 (limpieza inmediata)
  - [ ] Fallback: si la subida a R2 falla, el PDF queda en FS local con log de warning + alerta a SA
  - [ ] Documentos legacy (con file_path local) siguen descargables vía controller existente
- **Notas técnicas:** Reutilizar `shared/services/r2.service.js`. Bucket separado o subcarpeta `documents/` dentro del existing dossier bucket. Mirar cómo `dossiers` integra R2 para copiar el patrón.

---

### [F4-004] Cron de limpieza de PDFs huérfanos en FS local

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 2
- **Estado:** 🔴 **PENDING** — no hay cron implementado. `node-cron` package ya disponible. Solo aplicable después de F4-003 (sin R2 los PDFs locales no son huérfanos, son la fuente de verdad).
- **Criterios de aceptación:**
  - [ ] Cron diario (3:00 AM) escanea `UPLOAD_DIR` y borra archivos cuyo nombre no coincida con ningún `documents.file_path` en DB
  - [ ] Mantiene un grace period de 24h para archivos recientes (evita borrar PDFs en proceso de subida a R2)
  - [ ] Log resumen: N archivos huérfanos eliminados, espacio liberado
- **Notas técnicas:** node-cron pattern `0 3 * * *`. Bloqueado por F4-003.

---

### [F4-005] Multi-página real para facturas/certificados con muchos items

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 5
- **Estado:** 🟡 **PARTIAL** — el layout actual usa absolute positioning + modos de densidad (compact/dense) que mitigan parcial: ~22 items caben en 1 página. Multi-página real con `puppeteer.headerTemplate/footerTemplate` aún no está; experimento previo se revirtió por overlap (commit `95d64df` mantiene single-page).
- **Criterios de aceptación:**
  - [ ] Factura con 30+ líneas se renderiza en N páginas correctamente (sin solape de header/items/sello)
  - [ ] Cada página repite el header de la tabla (`thead { display: table-header-group }`)
  - [ ] Sello/Firma + Totals box aparecen solo en la **última** página
  - [ ] Footer rosa-palo + LOPD aparece en **cada** página vía `puppeteer.pdf({ headerTemplate, footerTemplate })`
  - [ ] Certificado con 30+ módulos en P2 se pagina natural sin perder el título del curso ni los logos del fondo
- **Notas técnicas:** Refactor del layout actual (absolute positioning) a
  flujo natural CSS. Header/footer templates van en HTML separado, los
  inyecta puppeteer en cada página vía `displayHeaderFooter: true`.

---

### [F4-006] Audit log de generación + descarga de documentos

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 3
- **Estado:** 🔴 **PENDING** — no existe tabla `document_audit_log` en migraciones. Es requisito fiscal (Hacienda). Prioridad alta.
- **Criterios de aceptación:**
  - [ ] Tabla `document_audit_log` (id, document_id, action enum, user_id, ip, user_agent, created_at)
  - [ ] Acciones registradas: `generated`, `downloaded`, `regenerated`, `deleted`, `number_overridden`
  - [ ] Cada hit a `/generate`, `/download`, `/set-number`, `DELETE /:id` inserta una fila
  - [ ] Endpoint `GET /:id/audit` solo SA — devuelve el historial completo del documento
- **Notas técnicas:** Útil para trazabilidad fiscal (Hacienda puede auditar
  quién emitió qué factura y cuándo). Insert async, no bloquear el response.

---

### [F4-007] Rate limiting + cola para `/generate` (Puppeteer es heavy)

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 3
- **Estado:** 🔴 **PENDING** — no hay rate limit en `/generate`. Pero `express-rate-limit ^8.4.1` ya está en `package.json` (se usa en otros endpoints), lista la dependencia.
- **Criterios de aceptación:**
  - [ ] Máximo 3 generaciones concurrentes por proyecto (más allá responde 429 con `Retry-After`)
  - [ ] Máximo 10 generaciones/minuto por usuario (anti-abuse)
  - [ ] Si 5 requests en cola superan 30s de espera, error explícito al usuario en frontend
  - [ ] Métrica/log de tiempo medio de generación, p99
- **Notas técnicas:** `express-rate-limit` para el rate limit por usuario.
  Para concurrencia por proyecto basta un `Map<projectId, count>` in-memory
  con `Promise.all` semáforo (no necesita Redis para este volumen).

---

### [F4-008] Endpoint regenerar PDF desde `documents.data`

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 2
- **Estado:** 🟡 **PARTIAL** — la lógica de regenerar SÍ existe ya en `download` controller (commit `95d64df`): si el `file_path` no existe en disk, regenera desde `doc.data` y reescribe vía `model.updateFilePath()`. Falta exponerlo como endpoint dedicado `POST /:id/regenerate` para uso explícito (no solo lazy en download).
- **Criterios de aceptación:**
  - [ ] `POST /:id/regenerate` re-genera el PDF desde `documents.data` con el template actual
  - [ ] Útil cuando el template cambia (e.g. nueva versión visual del Canva) y queremos refrescar PDFs viejos sin re-introducir datos
  - [ ] Mantiene el mismo `number` y `document_counters` no se incrementa
  - [ ] Solo SA y admin
  - [ ] Audit log: action = `regenerated`
- **Notas técnicas:** Reusa la misma función `generateInvoicePdf`/`generateCertificatePdf`.
  Puede usarse también desde el flow de download cuando el archivo no existe
  en disk (lazy regen — ya implementado en `95d64df`).

---

### [F4-009] Email automático de factura/certificado al cliente

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 5
- **Estado:** 🔴 **PENDING** — no hay envío automático en el flujo de generate. `shared/services/brevo.service.js` ya existe (se usa en leads/users), solo falta integrar y crear los templates Brevo.
- **Criterios de aceptación:**
  - [ ] Al generar factura, opción `send_email` en payload — si true, envía email Brevo al `cliente_email` con el PDF adjunto
  - [ ] Igual para certificado al `alumno_email`
  - [ ] Templates Brevo: `invoice_emitted_es` y `certificate_emitted_es`
  - [ ] Configurable por proyecto: campo `projects.auto_email_documents` (boolean default false)
  - [ ] Email no se envía si el cliente/alumno no tiene email
  - [ ] Log del envío en `document_audit_log` con action = `emailed`
- **Notas técnicas:** El PDF adjunto va base64 en el payload Brevo. Tamaño
  típico < 1MB, no problema. Async — no bloquea el response del generate.

---

### [F4-010] Tests Vitest del módulo

- **Asignado a:** Diego
- **Tipo:** Backend
- **Story points:** 3
- **Estado:** 🔴 **PENDING** — no hay `tests/documents.test.js`. El resto de módulos (leads, conversions, accounting, auth, projects, users, credentials) sí tienen tests, así que el patrón de test setup existe.
- **Criterios de aceptación:**
  - [ ] `nextNumber()` concurrente (10 paralelos) genera 10 números distintos secuenciales
  - [ ] `peekNextNumber()` devuelve mismo valor que `nextNumber()` lo haría sin incrementar
  - [ ] `setNextNumber(v)` deja el contador tal que la siguiente llamada devuelve `v`
  - [ ] `formatDate(123, 'FAC')` devuelve `FAC-{año}-0123` con padding correcto
  - [ ] `buildInvoiceHtml`/`buildCertP1Html`/`buildCertP2Html` no tiran con datos vacíos
  - [ ] Snapshot test del HTML generado (regression visual del template)
- **Notas técnicas:** Mock de `pool.query` para los counters. Para puppeteer
  un mock que devuelva un Buffer dummy (no necesitamos validar el PDF real).

---

### [F4-011] Frontend: panel admin "Configuración de numeración"

- **Asignado a:** Angel
- **Tipo:** Frontend
- **Story points:** 3
- **Estado:** 🔴 **PENDING** — no existe la página `/crm/configuracion/documentos`. El input de override en el form de factura ya está commiteado (`95d64df`); falta el panel cross-proyecto.
- **Criterios de aceptación:**
  - [ ] Página `/crm/configuracion/documentos` (solo SA/admin)
  - [ ] Lista los counters por proyecto+tipo: `Psiko Aprende · invoice · próximo: 194`
  - [ ] Permite editar el next-number con confirmación (llama a `POST /set-number`)
  - [ ] Histograma de últimos 12 meses: cuántas facturas/certificados emitidos por mes
  - [ ] Indicador visual de configuración Brevo auto-email (on/off por proyecto)
- **Notas técnicas:** Reutilizar `documentsApi.setNumber` y `nextNumber`. La
  edición del number también está disponible inline desde el form de factura
  pero este panel da visibilidad cross-proyecto.

---

## Resumen de Story Points — Nuevo EPIC F4

División real del equipo: **Angel solo frontend, Diego todo el backend** (no
sigue la asignación nominal del plan original 07-tareas-jira.md).

| Story | Asignado | Tipo | Pts | Estado |
| --- | --- | --- | --- | --- |
| F4-001 Migración schema | Diego | BE | 2 | ✅ DONE |
| F4-002 projectAccess + Zod | Diego | BE | 3 | 🔴 PENDING |
| F4-003 Storage R2 | Diego | BE | 5 | 🔴 PENDING |
| F4-004 Cron limpieza huérfanos | Diego | BE | 2 | 🔴 PENDING (bloqueado por F4-003) |
| F4-005 Multi-página real | Diego | BE | 5 | 🟡 PARTIAL (density mode mitiga) |
| F4-006 Audit log | Diego | BE | 3 | 🔴 PENDING |
| F4-007 Rate limit + cola | Diego | BE | 3 | 🔴 PENDING |
| F4-008 Regenerar PDF | Diego | BE | 2 | 🟡 PARTIAL (lazy regen ya existe) |
| F4-009 Email automático | Diego | BE | 5 | 🔴 PENDING |
| F4-010 Tests Vitest | Diego | BE | 3 | 🔴 PENDING |
| F4-011 Panel admin numeración | Angel | FE | 3 | 🔴 PENDING |
| **Total F4** | | | **36 pts** | 1✅ · 2🟡 · 8🔴 |

**Pts por desarrollador en F4:**

- Diego (backend): 33 pts — 2 done, 8 pending (1 partial), 23 pts efectivos
- Angel (frontend): 3 pts — 1 pending

**Prioridad sugerida (orden de ejecución para Diego):**

1. **F4-002** (projectAccess + Zod) — bloquea pasar a prod por seguridad. Quick win, deps ya disponibles.
2. **F4-003** (R2) — bloquea multi-instance / scaling.
3. **F4-006** (audit log) — requisito fiscal Hacienda.
4. **F4-005** (multi-página real) — bloquea facturas con 25+ items.
5. **F4-009** (email automático) — feature visible al cliente final.
6. **F4-010** (tests) — protege contra regresiones tras tantos cambios.
7. **F4-007**, **F4-008**, **F4-004** — mejoras incrementales (último porque depende de F4-003).

Para Angel (frontend) en paralelo a F4-002/003 de Diego: **F4-011** una vez que `setNumber` esté seguro detrás de `projectAccess`.

---

> **Nota:** Cuando estos tickets se trasladen a Jira (proyecto CRM), usar el
> mismo formato de IDs (CRM-XXX). Los `[F4-NNN]` aquí son provisionales para
> no chocar con la numeración existente del plan original.
