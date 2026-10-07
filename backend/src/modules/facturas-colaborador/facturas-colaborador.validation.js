import { z } from 'zod';

// Facturas de colaboradores (#202). Lo que llega de la pantalla de
// administración, comprobado aquí y no como 500 en la base.

export const AREAS = ['soporte', 'desarrollo', 'wordpress', 'seo', 'contenido', 'otra'];

const id = z.number().int().positive().max(2147483647);

// El primer día de un mes: «2026-09-01». Se acepta «2026-09» y se completa.
const mes = z.string().trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])(-01)?$/, 'Mes inválido: usa AAAA-MM')
  .transform((v) => (v.length === 7 ? `${v}-01` : v));

const importe = z.number().nonnegative('El importe no puede ser negativo').max(9999999999.99).nullable();

const empresa = z.object({
  issuer_id: id,
  importe_acordado: importe.optional(),
});

const base = {
  nombre: z.string().trim().min(2, 'El nombre es obligatorio').max(200),
  email: z.string().trim().toLowerCase().email('Correo inválido').max(255),
  nif: z.string().trim().max(30).optional().nullable().transform((v) => v || null),
  area: z.enum(AREAS, { message: `Área inválida: ${AREAS.join(', ')}` }),
  notas: z.string().trim().max(5000).optional().nullable().transform((v) => v || null),
  user_id: id.optional().nullable(),
  alta_desde: mes.optional().nullable(),
};

export const crearColaboradorSchema = z.object({
  ...base,
  area: base.area.default('otra'),
  empresas: z.array(empresa).min(1, 'Elige al menos una empresa a la que factura'),
});

export const editarColaboradorSchema = z.object({
  nombre: base.nombre.optional(),
  email: base.email.optional(),
  nif: base.nif,
  area: base.area.optional(),
  notas: base.notas,
  user_id: base.user_id,
  alta_desde: base.alta_desde,
  empresas: z.array(empresa).min(1, 'Elige al menos una empresa a la que factura').optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'No se envió ningún campo para cambiar' });

export const bajaSchema = z.object({
  desde: mes,
});

export const listarColaboradoresSchema = z.object({
  issuerId: z.coerce.number().int().positive().optional(),
  estado: z.enum(['activos', 'de_baja', 'todos']).default('activos'),
  q: z.string().trim().max(100).optional(),
});

// ─── Las facturas del mes ───

// Lo que manda el colaborador con el archivo. Llega por multipart: todo texto.
export const subidaSchema = z.object({
  importe: z.string().trim().min(1, 'Escribe el importe de tu factura')
    .transform((v) => Number(v.replace(',', '.')))
    .refine((n) => Number.isFinite(n) && n >= 0 && n <= 9999999999.99, 'Importe inválido'),
  numero_factura: z.string().trim().min(1, 'Escribe el número de tu factura').max(60),
});

export const delMesSchema = z.object({
  periodo: mes,
  issuerId: z.coerce.number().int().positive().optional(),
  estado: z.enum(['sin_enviar', 'enviado', 'abierto', 'recibida', 'anulada', 'no_enviado', 'caducado']).optional(),
  area: z.enum(AREAS).optional(),
});

export const anularSchema = z.object({
  motivo: z.string().trim().min(3, 'Escribe el motivo de la anulación').max(1000),
});
