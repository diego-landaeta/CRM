# Módulo `leads`

El corazón del CRM. Gestión de prospectos: captación, seguimiento, conversión.
Es el módulo más grande (~5500 LOC) con sub-features documentadas aquí.

## Estructura

- `api/` — `audiences.api.js` (CRM-110 wizard exportar audiencias Meta)
- `components/` — diálogos, drawer, pipeline, bulk actions, plantillas WhatsApp, lead-detail/
- `hooks/` — `useLeads`, `useLeadDetail`, `useAudienceWizard`, `useMetaUpload`, `useWhatsappTemplates`
- `lib/` — `leadFormat`, `leadPriority`
- `pages/` — `LeadsPage` (lista + filtros), `LeadsPipelinePage` (Kanban), `LeadDetailPage`, `AudienceExportPage`
- `validation/` — `lead.schema.ts` (Zod schemas)

## Concepto: prioridad visual

`lib/leadPriority.js` clasifica cada lead en una de 7 categorías que se renderizan
con color en filas/cards. Orden de precedencia (de mayor a menor):

1. **`overdue`** — `next_reminder_at < now` (recordatorio vencido)
2. **`won`** — `estado === 'convertido'`
3. **`lost`** — `estado === 'no_interesado'`
4. **`urgent`** — estado activo (`nuevo`/`por_contactar`/`en_seguimiento`) + `dias_inactivo ≥ 3`
5. **`fresh`** — `nuevo` o `por_contactar` (sin inactividad)
6. **`inProgress`** — `contactado` o `en_seguimiento`
7. **`normal`** — fallback (estados desconocidos, sin info)

Tests: `test/leadPriority.test.js` (13).

## Concepto: audiencias Meta (CRM-110)

`AudienceExportPage` + `useAudienceWizard` permiten:

1. **Filtrar leads** por status/canal/fechas/producto/importe
2. **Preview en tiempo real** con debounce 250ms y AbortController (cancela requests viejas si el user sigue cambiando filtros)
3. **Mínimo 20 leads** (`MIN_AUDIENCE_SIZE`) — Meta Custom Audiences exige ese mínimo
4. **Exportar CSV** con columnas hasheadas SHA-256: `email_hash`, `phone_hash`, `first_name`, `last_name`
5. **Subir a Meta** (CRM-115) directamente vía `/api/audiences/upload-meta` con polling de status

Hashing en formato Meta (lowercase + trim + SHA-256 en cada celda). Lo hace el backend
para garantizar SHA-256 real (frontend usa hash determinista mock para preview UX).

**Estado:** UX inicial rechazada (CRM-110 wizard "no convenció"). Pendiente sesión de rediseño.
Mantener funcional pero no añadir features nuevas hasta alinear UX.

## Concepto: plantillas WhatsApp por proyecto

**Ya no viven en localStorage.** Están en la tabla `whatsapp_templates` (migración
122) y se leen por API. Antes cada gestora tenía las suyas en su equipo: nadie
podía revisarlas, se perdían al cambiar de ordenador, y los dos CRMs las
guardaban con formatos distintos que ni coincidían entre sí.

`hooks/useWhatsappTemplates.ts` — **solo lee**:

```ts
const { templates } = useWhatsappTemplates(projectId);
// GET /api/whatsapp/templates?projectId=N
// [{ id, label, text, ambito: 'compartida' | 'personal' }]
```

En la base el campo se llama `body`; el hook lo devuelve como `text`, que es
como lo esperan estas pantallas.

Crear, editar y borrar viven en **`/whatsapp/plantillas`**, no aquí: dos sitios
para editar lo mismo es como se llega a dos formatos incompatibles. El
`WhatsappTemplatesDialog` que había aquí se retiró con el cambio.

Las `compartida` las ve todo el proyecto; las `personal`, solo quien las creó —
ni siquiera un administrador.

Variables soportadas en `text`: `{nombre}`, `{nombreCompleto}`, `{producto}`,
`{proyecto}`, `{email}`, `{telefono}`. `fillTemplate(text, { lead, projectName })`
hace el reemplazo case-insensitive.

`QuickActions` muestra el desplegable de plantillas + "Mensaje en blanco" +
"Editar plantillas" (lleva a `/whatsapp/plantillas`). Abre la conversación
**dentro del CRM** —no `wa.me` en otra pestaña— y registra
`onLogInteraction(lead, 'whatsapp')`. Si ese registro falla se dice en pantalla:
antes se callaba, y la gestora se quedaba creyendo que había quedado apuntado.

El teléfono se decide con `telefonoParaWhatsapp` de `@/shared/lib/telefono`, que
aplica el mismo criterio que el backend. **No uses `cleanPhone`** para esto: se
limita a tirar lo que no sea un dígito, y con eso un `0034…` y un `600123456.0`
de Excel pasaban el filtro y luego el chat no abría.

Tests: `test/whatsapp-templates.test.js` (9), `test/telefono.test.js` (9).

## AbortController en fetches

`useLeads.fetchLeads` y `useAudienceWizard.previewAudience` usan `AbortController`
para cancelar requests cuando los filtros cambian rápido (typing en search,
paginación rápida). Sin esto, una respuesta vieja podía pisar a una nueva.

## Endpoints backend principales

| Endpoint | Método | Notas |
|---|---|---|
| `/api/leads?projectId=X` | GET | Listado paginado con filtros |
| `/api/leads/stats` | GET | Conteos por estado |
| `/api/leads/:id` | GET / PATCH / DELETE | Detalle / editar / borrar |
| `/api/leads/:id/status` | PATCH | Cambio de estado (timeline auto) |
| `/api/leads/:id/interactions` | GET / POST | Timeline de contactos |
| `/api/leads/:id/reminders` | GET / POST | Recordatorios programados |
| `/api/leads/:id/sequences` | GET | Secuencias en las que está enrolado |
| `/api/leads/bulk` | POST | Importación CSV (CRM-119) |
| `/api/leads/today` | GET | Dashboard "hoy" — pendientes del día |
| `/api/audiences/preview` | POST | Preview wizard CRM-110 |
| `/api/audiences/export` | POST | CSV blob con SHA-256 |
| `/api/audiences/upload-meta` | POST | CRM-115 upload directo |
| `/api/audiences/upload-meta/:id/status` | GET | Polling status |
