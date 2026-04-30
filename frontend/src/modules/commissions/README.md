# Módulo `commissions`

Comisiones de venta para gestores: el sistema calcula automáticamente
`% × importe_cobrado` cuando se registra una conversión, según las reglas
configuradas por (proyecto, gestor, producto).

## Archivos

- `api/commissions.api.ts` — `CommissionStats`, `CommissionRule`, métodos CRUD
- `lib/period.ts` — `monthLabel`, `isInMonth`, `buildCommissionsCsv` (helpers puros, testeables sin React)
- `pages/CommissionsPage.tsx` — listado con filtros, dialog de reglas, bulk pay, cierre mensual

## Reglas de comisión

| Campo | Significado |
|---|---|
| `project_id` + `user_id` + `product_id` | Triple key. Si `product_id = null` → aplica a TODOS los productos del proyecto para ese gestor (regla genérica) |
| `pct` | Porcentaje (0-100, decimales permitidos) |
| `base_calc` | `'cobrado'` (por defecto) calcula sobre `importe_pagado` cuando llega cada abono. `'vendido'` calcula sobre `importe_total` al firmar la venta |

**Override:** si existe regla específica de producto + regla genérica para el mismo gestor, gana la específica.

## Filtro por mes (CRM-138)

`isInMonth(dateStr, year, month)` parsea **solo la parte de fecha** (`YYYY-MM-DD`)
para evitar que `2026-01-31T23:30:00Z` se desplace a febrero por timezone local
(Spain UTC+1). Si el formato no es ISO con T, hace fallback a `new Date()`.

El filtro de mes se aplica en cliente porque el backend aún no soporta el query
param. Cuando lo soporte, mover a server-side y simplificar.

## Cierre mensual

Botón "Cerrar mes" (admin) marca el snapshot inmutable: ya no se pueden
crear/editar/borrar comisiones del periodo. El endpoint `POST /commissions/close-month`
está pendiente en backend (CRM-138) — el frontend ya está preparado y muestra
toast informativo si recibe 404/405.

## Bulk pay

Selector múltiple en la tabla → "Marcar pagadas" itera con `commissionsApi.pay(id, { fecha_pago })`.
Cada pago es independiente; si N falla, los demás siguen y el toast resume `ok / fail`.

## Endpoints backend

| Endpoint | Método | Roles |
|---|---|---|
| `/api/commissions` | GET | admin/superadmin |
| `/api/commissions/stats` | GET | admin/superadmin |
| `/api/commissions/me` | GET | gestor (solo las suyas) |
| `/api/commissions/me/stats` | GET | gestor |
| `/api/commissions/:id/pay` | PATCH | admin/superadmin (`{ fecha_pago }`) |
| `/api/commissions/recalculate/:conversionId` | POST | superadmin |
| `/api/commissions/rules` | GET / POST | admin/superadmin |
| `/api/commissions/rules/:id` | PATCH / DELETE | admin/superadmin |
| `/api/commissions/close-month` | POST | superadmin (pendiente) |

## Tests

- `test/commissions-period.test.js` (16) — `monthLabel`, `isInMonth` (incluye cruce UTC↔local), `buildCommissionsCsv` (escape, slug)
