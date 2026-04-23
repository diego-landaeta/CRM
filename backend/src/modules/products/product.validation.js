import { z } from 'zod';

const pricingFields = {
  precio: z.number().nonnegative().nullable().optional(),
  moneda: z.string().max(10).optional(),
  stripe_link: z.string().url().max(500).nullable().optional().or(z.literal('')),
  sku: z.string().max(100).nullable().optional().or(z.literal('')),
  duracion: z.string().max(100).nullable().optional().or(z.literal('')),
  url_info: z.string().url().max(500).nullable().optional().or(z.literal('')),
};

export const createProductSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  nombre: z.string().min(1).max(200),
  descripcion: z.string().max(2000).optional(),
  categoria_id: z.number().int().positive().nullable().optional(),
  subcategoria_id: z.number().int().positive().nullable().optional(),
  ...pricingFields,
});

export const updateProductSchema = z.object({
  nombre: z.string().min(1).max(200).optional(),
  descripcion: z.string().max(2000).optional(),
  categoria_id: z.number().int().positive().nullable().optional(),
  subcategoria_id: z.number().int().positive().nullable().optional(),
  ...pricingFields,
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Al menos un campo debe ser proporcionado',
});

export const projectIdParamSchema = z.object({
  projectId: z.coerce.number().int().positive(),
});
