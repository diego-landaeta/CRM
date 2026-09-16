import { z } from 'zod';

const PAYMENT_METHODS = ['transferencia', 'tarjeta', 'tarjeta_stripe', 'efectivo', 'bizum', 'paypal', 'fraccionado', 'otro'];

const conversionItemSchema = z.object({
  product_id: z.number().int().positive().optional().nullable(),
  descripcion: z.string().min(1).max(500),
  cantidad: z.number().int().positive().default(1),
  precio_unitario: z.number().nonnegative(),
});

export const createConversionSchema = z.object({
  lead_id: z.number().int().positive('lead_id requerido'),
  project_id: z.number().int().positive('project_id requerido'),
  producto_contratado: z.string().min(1, 'Producto requerido').max(255),
  producto_contratado_id: z.number().int().positive().nullable().optional(),
  importe_total: z.number().positive('Importe debe ser positivo'),
  importe_pagado: z.number().min(0).default(0),
  metodo_pago: z.enum(PAYMENT_METHODS).optional().nullable(),
  // Método real del pago inicial (cuando el plan es fraccionado). Para la factura.
  metodo_pago_inicial: z.enum(PAYMENT_METHODS).optional().nullable(),
  fecha_compromiso_pago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato fecha: YYYY-MM-DD').optional().nullable(),
  fecha_conversion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato fecha: YYYY-MM-DD').optional(),
  notas_pago: z.string().max(2000).optional().nullable(),
  // Multi-item + IVA + descuento
  items: z.array(conversionItemSchema).optional(),
  iva_pct: z.number().min(0).max(100).optional(),
  iva_incluido: z.boolean().optional(),
  iva_exento: z.boolean().optional(),
  descuento_tipo: z.enum(['none', 'pct', 'monto']).optional(),
  descuento_valor: z.number().min(0).optional(),
  subtotal_bruto: z.number().min(0).optional(),
  /*
    Esta ficha NO es una venta nueva: es una cuota de una venta anterior (#100).

    La columna existe desde el principio y hay una veintena de consultas que la
    filtran --el ranking, el recuento de ventas, las plazas, los informes--,
    pero hasta ahora NADIE PODIA MARCARLA: no habia forma de ponerla a true
    desde ningun sitio, asi que estaba a false en las 491 fichas y todos esos
    filtros no filtraban nada.

    Importa cuando la cuota se registra como ficha aparte. Si se apunta como un
    cobro mas de la venta original, la regla del primer cobro
    --`ES_MATRICULA`-- ya la reconoce sola y esto no hace falta. Pero una ficha
    nueva SI cuenta como venta, porque su unico cobro es el primero de esa
    ficha, y ahi solo lo sabe quien la esta creando.
  */
  es_mensualidad: z.boolean().optional(),
}).refine((d) => d.importe_pagado <= d.importe_total + 0.01, {
  message: 'importe_pagado no puede ser mayor que importe_total',
  path: ['importe_pagado'],
});

export const updateConversionSchema = z.object({
  producto_contratado: z.string().min(1).max(255).optional(),
  producto_contratado_id: z.number().int().positive().nullable().optional(),
  importe_total: z.number().positive().optional(),
  metodo_pago: z.enum(PAYMENT_METHODS).nullable().optional(),
  fecha_compromiso_pago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  fecha_conversion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notas_pago: z.string().max(2000).nullable().optional(),
  // Tambien al editar: una ficha mal clasificada se arregla sin borrarla y
  // volver a crearla, que es como se pierden los cobros y las facturas.
  es_mensualidad: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Al menos un campo requerido' });

export const createPaymentSchema = z.object({
  importe: z.number().positive('Importe debe ser positivo'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato fecha: YYYY-MM-DD').optional(),
  notas: z.string().max(500).optional().nullable(),
  metodo: z.enum(PAYMENT_METHODS).optional().nullable(),
  // Confirmacion explicita cuando de verdad son dos cobros iguales seguidos.
  permitir_duplicado: z.boolean().optional(),
});

export const listConversionsSchema = z.object({
  projectId: z.coerce.number().int().positive().optional(),
  // Una sociedad entera: el controlador la traduce a sus campus.
  issuerId: z.coerce.number().int().positive().optional(),
  leadId: z.coerce.number().int().positive().optional(),
  responsableId: z.coerce.number().int().positive().optional(),
  pendiente: z.enum(['true', 'false']).optional(),
  vencido: z.enum(['true', 'false']).optional(),
  // Conversions sin importe (importe_total = 0) — generalmente backfill que las
  // gestoras deben completar con el importe real de la venta.
  pendingBilling: z.enum(['true', 'false']).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Filtro por producto: hasta ahora se hacia en el navegador sobre las filas
  // cargadas, asi que con paginacion dejaba fuera el resto.
  producto: z.string().max(255).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
