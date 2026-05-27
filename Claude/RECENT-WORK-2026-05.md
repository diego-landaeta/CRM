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
