import { z } from 'zod';

// Tipos de enlace de pago (CRM-140) — coinciden con el enum del backend
export const PAYMENT_LINK_TYPES = [
  { value: 'completo', label: 'Pago completo' },
  { value: 'dos_cuotas', label: '2 cuotas' },
  { value: 'tres_cuotas', label: '3 cuotas' },
  { value: 'personalizado', label: 'Personalizado' },
] as const;

export type PaymentLinkType = typeof PAYMENT_LINK_TYPES[number]['value'];

export const paymentLinkSchema = z.object({
  label: z.string().min(1, 'Etiqueta requerida'),
  url: z.string().url('URL invalida'),
  tipo: z.enum(['completo', 'dos_cuotas', 'tres_cuotas', 'personalizado']),
});

export type PaymentLink = z.infer<typeof paymentLinkSchema>;

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

export type ProductFormData = z.infer<typeof productSchema>;
