import { z } from 'zod';

export const createProductSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  nombre: z.string().min(1).max(200),
  descripcion: z.string().max(2000).optional(),
});

export const updateProductSchema = z.object({
  nombre: z.string().min(1).max(200).optional(),
  descripcion: z.string().max(2000).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Al menos un campo debe ser proporcionado',
});

export const projectIdParamSchema = z.object({
  projectId: z.coerce.number().int().positive(),
});
