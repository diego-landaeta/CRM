# Webhook de leads — contrato (para Make / integraciones)

## Endpoint

```
POST https://crm.iseih.com/api/leads/webhooks/{project_slug}
Authorization: Bearer {WEBHOOK_API_KEY}
Content-Type: application/json
```

- `project_slug`: slug del proyecto (ej. `psiko-aprende`, `iseih`, `fono-aprende`). Se ve en Configuración → Proyectos.
- `WEBHOOK_API_KEY`: key del proyecto. Se obtiene en Configuración → Proyecto → Webhook.
- Acepta también el header `X-API-Key` para compatibilidad.

## Body JSON

| Campo               | Tipo     | Req.  | Notas                                                                 |
| ------------------- | -------- | ----- | --------------------------------------------------------------------- |
| `nombre`            | string   | sí    | Nombre del lead.                                                      |
| `email`             | string   | *     | Email. Opcional si hay teléfono.                                      |
| `telefono`          | string   | *     | Teléfono. Opcional si hay email. Debes mandar al menos uno.           |
| `producto_interes`  | string   | no    | Nombre del producto. Se busca por nombre dentro del proyecto.         |
| `producto_interes_id`| number  | no    | Id del producto (si lo conoces, más fiable que por nombre).           |
| `notas`             | string   | no    | Texto libre, máx 2000.                                                |
| `canal`             | enum     | no    | `meta_ads` / `google_ads` / `tiktok_ads` / `organico` / `chatgpt_ia` / `whatsapp` / `directo` / `referido`. Si no viene, se detecta por UTMs. |
| `responsable_email` | string   | no    | Email del gestor al que asignar el lead. Saltea round-robin.          |
| `responsable_id`    | number   | no    | Id del gestor (alternativa al email). Si vienen los dos, prioriza id. |
| `idempotency_key`   | string   | no    | Clave única para que reintentos de Make no dupliquen. Recomendado.    |
| `custom_fields`     | object   | no    | Campos extras libres `{ "preferencia_horario": "tardes", ... }`.      |
| `landing_url`       | string   | no    | URL de la landing.                                                    |
| `utm_source`        | string   | no    |                                                                       |
| `utm_medium`        | string   | no    |                                                                       |
| `utm_campaign`      | string   | no    |                                                                       |
| `utm_content`       | string   | no    |                                                                       |
| `utm_term`          | string   | no    |                                                                       |

\* Se requiere al menos uno de `email` o `telefono`.

## Reglas de asignación

1. Si `responsable_id` viene y el usuario existe + tiene acceso al proyecto → se asigna directo.
2. Si no, `responsable_email` se resuelve a id y se hace lo mismo.
3. Si ninguno viene (o el resuelto no tiene acceso) → round-robin tradicional sobre gestores activos y disponibles.

**Disponibilidad**: el round-robin salta gestores marcados como "no disponibles" o con bloques de ausencia activos hoy (Configuración → Disponibilidad). La asignación forzada por Make **no** respeta `is_available` — se asume que Make sabe lo que hace.

## Idempotency

Si Make reintenta con el mismo `idempotency_key` dentro de 24h, el CRM **no** crea otro lead: devuelve el original con `idempotent_replay: true`.

Sugerencia: usa el `message-id` del email original o `{project}-{email}-{timestamp_día}` como key.

## Respuesta (201 Created)

```json
{
  "success": true,
  "data": {
    "lead_id": 1234,
    "responsable_id": 12,
    "assignment_source": "webhook",   // o "round_robin"
    "duplicado": false,
    "duplicado_de": null,
    "reincidente": false,
    "canal": "whatsapp"
  }
}
```

Si fue replay idempotente:

```json
{
  "success": true,
  "data": {
    "lead_id": 1234,
    "responsable_id": 12,
    "idempotent_replay": true
  }
}
```

## Errores comunes

| Código | Mensaje                                          | Causa                                       |
| ------ | ------------------------------------------------ | ------------------------------------------- |
| 401    | API key requerida / API key invalida             | Header `Authorization: Bearer` faltante o key mal. |
| 404    | Proyecto no encontrado                           | `project_slug` mal escrito.                 |
| 400    | Debes proporcionar al menos email o teléfono     | No mandaste ninguno de los dos.             |
| 400    | VALIDATION_ERROR                                 | Algún campo fuera de tipo/tamaño esperado.  |

## Ejemplo para Make (HTTP module)

```json
{
  "nombre": "{{json.nombre}}",
  "email": "{{json.email}}",
  "telefono": "{{json.telefono}}",
  "producto_interes": "{{json.producto}}",
  "canal": "whatsapp",
  "responsable_email": "{{json.gestor_asignado}}",
  "notas": "{{json.mensaje_original}}",
  "idempotency_key": "{{message-id}}",
  "custom_fields": {
    "spam_score": "{{json.spam_score}}",
    "make_scenario": "Psiko Contestacion Auto"
  }
}
```
