# Trabajo reciente en CRM hermano (Mayo 2026)

Resumen del trabajo hecho en sesiones recientes con Claude. Para detalles ver commits del repo `esos2dev-oss/CRM`.

## Make webhook entrante (sesion 2026-05)

Nuevo modulo `backend/src/modules/make/` para recibir leads desde Make.com.

- Tabla `make_webhooks` + `make_webhook_deliveries` (migration 063)
- Soporte de overrides via headers HTTP (sin tocar el JSON):
  - `X-Asesora-Email` / `X-Asesora-Nombre` → fija el responsable del lead
  - `X-Canal` → canal del lead
  - `X-Make-Secret` → autenticacion
- Modo TEST (solo guarda payload para inspeccion) vs ACTIVE (crea lead real)
- Panel UI: `/make-webhooks` con field_mapping configurable, historial de deliveries, copy-paste de URL+secret
- Reutiliza `processWebhook` existente — toda la logica de duplicados, round-robin, spam, idempotency aplica igual

**Recomendacion para Make**: usar headers en vez de modificar el JSON. Mas robusto que reconstruir el body.

## Conversiones — features y fixes

### Cuotas (installments)
- CRUD completo: pagar/editar pago/anular pago — `installments.model.js:editPaid, unpay`
- Mini-modal `InstallmentsDialog.tsx` pide importe + fecha (no asume hoy)
- **No redondear nunca**: `precio_total` se ajusta automaticamente a la suma exacta de cuotas

### Editar conversion completa
- Nuevo `EditConversionDialog.tsx` para corregir importe/fechas/metodo de una conversion ya cargada
- Boton "Editar" agregado a `ConversionsTab.tsx`

### Eliminar conversion con motivo obligatorio
- Cuando una gestora elimina una compra, exige `motivo` (duplicada / error_carga / anulacion_cliente / otro)
- Se loggea en `lead_interactions` antes del soft-delete
- DELETE_REASONS validados en `conversion.controller.js:remove`

### Permisos gestora
- Gestor ahora PUEDE eliminar pagos propios (era solo superadmin)
- `removePayment` con ownership check via `getPaymentOwnership`
- Bug `canManage`: era `user.userId` (no existe) → cambiado a `user.id` en `ClientDetailPage.tsx` y `LeadDetailPage.tsx`

## Fusion de leads duplicados

Cuando una gestora reporta clientes duplicados (caso Sofia Vazquez x3):
- Nuevo `MergeLeadDialog.tsx` para elegir el "ganador"
- `lead.model.mergeLeads`: en transaccion mueve interactions, reminders, conversions, installments del perdedor al ganador
- Soft-delete del perdedor con `deleted_reason='merged_into_X'`

## Fixes de fecha (timezone Venezuela GMT-4)

Problema: pg DATE columns volvian como JS Date en UTC → frontend mostraba -1 dia.

- **Backend**: `pg.types.setTypeParser(1082)` en `shared/config/db.js` devuelve DATE como string YYYY-MM-DD
- **Frontend**: helper `toLocalDate()` en `shared/lib/format.js` + `leads/lib/leadFormat.ts` parsea como local
- Aplicado en TODOS los sitios donde se renderizan fechas (`revisa todos los sitios` pidio el user)

## Round-robin asigna solo gestores

Bug: la query `AND u.role IN ('admin', 'gestor')` incluia admins. Cambiado a `AND u.role = 'gestor'`.

## Infraestructura

### Dominio 360crm.tech con HTTPS
- DNS A → `187.124.128.126`
- Nginx config + Let's Encrypt + renovacion auto via `certbot.timer`
- Landing page + sitemap + robots.txt
- `https://360crm.tech/crm/` (prod) y `https://360crm.tech/testeo/` (staging)

### Estrategia de ramas
- `main` = produccion
- `staging` = QA/testeo
- Push directo a `main` permitido para fixes y cambios chicos (es el flujo habitual del owner)
- Cambios riesgosos (pagos, auth, migraciones) → primero `staging`
- Doc completo: `docs/09-deploy-y-ramas.md`

### Service Worker selfDestroying
- Cambiado `vite-plugin-pwa` a `selfDestroying: true`
- Killswitch `sw.js` deployado para limpiar cache de usuarios con SW viejo
- Pantalla "Sin conexion" post-domain-change resuelta

## Import Excel masivo

- Psiko: 1664 leads importados
- ICTESS: 118 leads importados (con scraper de WP usando "Plan de Estudios" como keyword adicional)
- Scripts en `c:/tmp/` o `scripts/excel_import/`

## Componente Select<T> compartido

Migracion progresiva de `<select native>` a componente custom shadcn-style. Ver `frontend/src/shared/components/ui/select.tsx`.

## Pendientes detectados (no bloqueantes)

Ver tambien [project_pendientes_post_beta.md](./project_pendientes_post_beta.md):

- Forms en iframe (mas seguro que script)
- Triggers email auto al cambiar lead state
- UI de mapeo WC mas amigable (currently funciona pero requiere conocer paths)
- Firma canvas en matriculas
- HTTPS para algunos panels externos
- Certificados PDF usando campos `_texto` de products (modulos, profesores, horas) — ver [project_pending_diplomados_recibos.md](./project_pending_diplomados_recibos.md)

## Cosas que viven SOLO en CRM hermano (no portar a ISEIE)

- `audiences/` modulo (Meta CSV upload)
- `campaigns/` modulo (Meta Ads + Google Ads)
- `ai-chat`, `reports-ia` (requieren Anthropic API)
- `commissions` CRUD completo
- `payroll` modulo
- `accounting` separado en sub-paginas (Ingresos/CxC/CxP/Stripe)
- Sidebar override labels via DB (`projects.sidebar_labels`)
- 10 tabs en `ProjectSettingsDialog`
- PWA + CommandPalette + FloatingDock + KeyboardShortcuts

ISEIE actualmente muestra esos items como "Proximamente" via `betaConfig.ts` allowlist. Se irian activando si se portan los modulos.

---

# Parte 2 — Fixes post-27/may

## 2026-05-28 — Bugs Dayana + deploy producción

### Bug 1: Leads se guardaban sin programa
**Causa:** `ProductCombobox` pasa el NOMBRE del producto al form state (string), pero el backend `createLeadManualSchema` sólo acepta `producto_interes_id` (number). Zod descartaba `producto_interes` text → lead se creaba sin product link.

**Fix:** `LeadFormDialog.handleFormSubmit` resuelve nombre → ID buscando en el array `products` antes de enviar al backend. Commit `2bcdcad`.

### Bug 2: Recordatorios no se guardaban (3 dialogs)
**Causa:** El backend `createReminderSchema` valida `fecha_recordatorio` con regex estricto `^\d{4}-\d{2}-\d{2}$`. Tres dialogs distintos enviaban formatos mal:

1. **`ReminderQuickDialog`**: enviaba `{fecha: <ISO timestamp>}` con la key mal y formato datetime ISO completo
2. **`LeadDrawer.add()`**: `<input type="datetime-local">` devuelve `YYYY-MM-DDTHH:MM` directo al endpoint
3. (ContactedDialog ya estaba bien)

**Fix:** Los 3 dialogs ahora hacen `fecha.slice(0,10)` para el campo fecha + meten la hora en la nota (`"Llamar al cliente · 14:30"`). Commits `2bcdcad` + `23b20af`.

### Fix: `/prospectos` en modo "Todos los proyectos"
**Causa:** `ALL_PROJECTS_OK` en `AppLayout.jsx` tenía regex en inglés (`/^\/leads$/`, `/^\/clients$/`) pero las rutas reales del CRM están traducidas (`/prospectos`, `/clientes`). El `AllProjectsGuard` bloqueaba todas las rutas con banner "Selecciona un proyecto".

**Fix:** Agregado al allowlist:
- `/^\/prospectos$/`, `/^\/prospectos\/pipeline$/`, `/^\/prospectos\/audiencias$/`, `/^\/prospectos\/\d+$/`
- `/^\/clientes$/`, `/^\/clientes\/matriculas$/`, `/^\/clientes\/\d+$/`
- Mantengo `/leads` y `/clients` legacy

Commit `d34aebc`.

### Deploy a producción
- Bundle nuevo `index-D6hX6GuZ.js` deployado a `/var/www/crm/production/frontend/`
- Backend sin restart (sólo cambios FE)
- Atomic swap con `.new` → `.old` → swap

## 2026-05-28 — Import ICTESS

### Importación SOLICITUDES Contactos
- **Fuente:** `SOLICITUDES - Contactos.csv` (154 filas)
- **Destino:** project_id=4 (ICTESS) en `crm_prod_db`
- **Distribución de Origen respetada:**
  - WhatsApp → `whatsapp` (105)
  - Web → `organico` inicialmente, después cambiado a `directo` por pedido del owner (49)
  - vacío → `directo` (3)
- **Asesoras matched:** Antonio → Tony (id 9), Samantha → Samantha Ictess (id 8)
- **Resultado:** 26 nuevos + 128 actualizados (los CETLAT previos se mergearon por email) + 14 conversions creadas
- **Scripts en repo:** `import_ictess.mjs` + `fix_ictess.mjs`

Commit `1fc3caa`.

### Detalle: 1 lead Venta sin conversion creada
Carlos Alonso Azuara (id 2060) está marcado `convertido` pero la conversion NO se creó porque su fila CSV no tenía `Fecha venta` ni `Precio` (solo "Pagado" en notas). Samantha debe registrar la conversion manualmente desde el CRM.

## Notas para el próximo dev/IA

- **Verifica el bundle live** con `curl -s https://360crm.tech/crm/ | grep -oE 'index-[A-Za-z0-9_-]+\.js'`
- **Si Dayana reporta otro bug**, primer paso: leer este archivo + `CHANGELOG.md` para ver si ya está fixed
- **Para deploys FE**: el atomic swap está en `HANDOFF.md` sección 6
- **No hay git en `/opt/crm/production/`** — recordar siempre que el deploy es por tarball
