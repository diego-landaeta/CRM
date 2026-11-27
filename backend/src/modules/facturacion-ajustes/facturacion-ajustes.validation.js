import { z } from 'zod';

/*
  Lo que se puede guardar desde la pantalla de Ajustes (#1202). `null` en
  cualquier campo quiere decir «sin ajustar desde aquí»: vuelve a mandar el
  .env o, si tampoco está, el valor de serie.
*/

export const ajustesGlobalesSchema = z.object({
  dias: z.coerce.number().int().min(1).max(30).nullable(),
  enviarPdf: z.boolean().nullable(),
  revisionAdmin: z.boolean().nullable(),
  auditoriaEstado: z.enum(['apagada', 'aviso', 'pausa']).nullable(),
  auditoriaCorreos: z.array(z.string().trim().toLowerCase().email()).max(20),
  auditoriaDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida').nullable(),
}).strict();

export const campusSchema = z.object({
  activo: z.boolean(),
}).strict();

