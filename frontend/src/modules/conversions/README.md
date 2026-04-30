# Módulo `conversions`

Conversiones (ventas) registradas sobre leads. Una conversión puede tener
múltiples pagos parciales (`Payment[]`) — la lógica de "pago completo vs
fraccionado" vive aquí, no en el backend.

## Archivos

- `api/conversions.api.ts` — `Conversion`, `Payment`, `MetodoPago`,
  `CreateConversionInput`, `AddPaymentInput`
- `components/ConversionDialog.tsx` — crear conversión nueva (con selector de payment link Stripe)
- `components/PaymentDialog.tsx` — registrar abono parcial sobre conversión existente
- `components/ConversionsTab.tsx` — tab dentro de LeadDetailPage / ClientDetailPage

## Conceptos clave

### Métodos de pago

- `tarjeta`, `transferencia`, `efectivo` — pago completo (single payment)
- `fraccionado` — habilita campo extra `fecha_compromiso_pago` (cuándo se espera el resto)

### Importes

- `importe_total` — total acordado de la venta
- `importe_pagado` — suma de `Payment[].importe`
- `pendiente = importe_total - importe_pagado` (calculado en frontend)
- Validación: `importe_pagado` no puede superar `importe_total`

### Payment links Stripe (CRM-140)

El selector de enlace en `ConversionDialog` deriva el array `productLinks`:

1. Si `selectedProduct.payment_links` es array no vacío → usa esos (cada uno con `label`, `url`, `tipo`)
2. Si solo existe `selectedProduct.stripe_link` (legacy) → fallback a `[{ label: 'Pago completo', url, tipo: 'completo' }]`
3. Sin nada → mensaje "no tiene enlaces configurados"

El usuario puede:
- Seleccionar uno de los links del producto
- Escribir `customLink` (modo `selectedLinkIdx === 'custom'`)
- No seleccionar nada (`selectedLinkIdx === '-1'`)

Tras seleccionar, el botón "Copiar" copia el `activeLink` derivado al portapapeles
para pegarlo en WhatsApp/email del cliente.

## Endpoints backend

| Endpoint | Método | Devuelve |
|---|---|---|
| `/api/conversions?projectId=X` | GET | `Conversion[]` paginado |
| `/api/conversions/by-lead/:leadId` | GET | `Conversion[]` del lead |
| `/api/conversions/:id` | GET | `Conversion` con `payments` poblados |
| `/api/conversions` | POST | Crear conversión |
| `/api/conversions/:id` | PATCH / DELETE | Editar / borrar |
| `/api/conversions/:id/payments` | POST | Registrar abono `{ importe, fecha, notas? }` |
| `/api/conversions/payments/:paymentId` | DELETE | Borrar pago (recalcula `importe_pagado`) |

## Tests

- `test/PaymentDialog.test.jsx` (12) — validaciones de importe (≤ 0, > pendiente, caso borde =)
- `test/ConversionDialog.test.jsx` (13) — validaciones, payment links derivados, métodos
