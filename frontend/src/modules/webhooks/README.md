# Módulo `webhooks`

Webhooks entrantes que reciben datos de sistemas externos (Make, Zapier, n8n,
forms HTTP custom) y crean leads o matrículas según el mapeo configurado.

## Arquitectura

El backend **reusa la tabla `forms`** con `kind='webhook'` para evitar duplicar
schema. Por eso muchos endpoints son `/api/forms/:id` y compartimos shape con
el módulo `forms/`.

- `lib/types.ts` — contratos TS: `Webhook`, `WebhookDestination`, `WebhookFieldMapping`, `WebhookTarget`
- `pages/WebhooksPage.tsx` — listado, crear/borrar/toggle activo
- `pages/WebhookDetailPage.tsx` — editor: nombre, destination, listen mode, payload mapper
- `components/ListenModePanel.tsx` — pulsa "Esperar payload", el backend lo captura, polling cada 2s
- `components/PayloadMapper.tsx` — árbol JSON del payload capturado, click en valor → mapear a campo CRM
- `components/WebhookCard.tsx` — card en el listado con toggle activo/listen

## Flujo Listen Mode

1. Usuario crea webhook → se asigna `embed_id` único
2. Pulsa "Esperar payload" → `POST /api/forms/:id/listen` marca `awaiting_sample = true`
3. El sistema externo envía un POST de prueba a `/api/webhook-tokens/receive/:embed_id` con cualquier shape
4. Backend guarda el body en `sample_payload` y baja `awaiting_sample`
5. Frontend hace polling y, al detectar `sample_payload`, lo muestra en árbol
6. Usuario hace click en cada valor que quiere mapear → modal con select de targets CRM
7. Mapping guardado como `field_mapping: { "nombre_campo_CRM": "ruta.del.json" }`
8. Activar webhook → futuras peticiones aplican el mapping automáticamente

## Targets CRM

Definidos en `components/PayloadMapper.tsx`:
- **Lead**: `nombre*`, `email*`, `telefono`, `notas`, `producto_interes_id`, `utm_source`, `utm_campaign`
- **Matrícula**: `dni*`, `titulo`, `email`, `notas`

`*` = requerido por backend para crear el registro.

## Límites de seguridad (PayloadMapper)

Para evitar freeze del browser con payloads adversariales:
- `MAX_DEPTH = 6` (no recursa más niveles)
- `MAX_OBJECT_KEYS = 50` (corta y muestra "+N keys más")
- `MAX_ARRAY_ITEMS = 5` (corta y muestra "+N más")

## Endpoints backend

| Endpoint | Método | Notas |
|---|---|---|
| `/api/forms?kind=webhook&projectId=X` | GET | Listado |
| `/api/forms` | POST | Crear (con `kind: 'webhook'`) |
| `/api/forms/:id` | GET / PATCH / DELETE | Detalle / actualizar / borrar |
| `/api/forms/:id/listen` | POST | Activar listen mode |
| `/api/forms/:id/listen/stop` | POST | Cancelar listen |
| `/api/forms/:id/status` | GET | Polling: devuelve sample_payload si llegó |
| `/api/webhook-tokens/receive/:embed_id` | POST público | Recibe el payload externo |
