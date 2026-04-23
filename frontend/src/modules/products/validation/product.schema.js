import { z } from 'zod';

export const productSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  descripcion: z.string().optional().or(z.literal('')),
  precio: z.coerce.number().nonnegative('Precio debe ser >= 0').optional().or(z.nan()),
  moneda: z.string().optional().or(z.literal('')),
  stripe_link: z.string().url('URL invalida').optional().or(z.literal('')),
  sku: z.string().optional().or(z.literal('')),
  duracion: z.string().optional().or(z.literal('')),
  url_info: z.string().url('URL invalida').optional().or(z.literal('')),
  categoria_id: z.union([z.number(), z.string()]).optional().or(z.literal('')),
  subcategoria_id: z.union([z.number(), z.string()]).optional().or(z.literal('')),
});
