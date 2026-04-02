import { z } from 'zod';

export const leadSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email no valido'),
  telefono: z.string().optional(),
  origen: z.enum(['meta_ads', 'google_ads', 'organico', 'referido', 'directo'], {
    required_error: 'Selecciona un origen',
  }),
  producto_interes: z.string().optional(),
  notas: z.string().optional(),
});

export const ORIGEN_OPTIONS = [
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'organico', label: 'Organico' },
  { value: 'referido', label: 'Referido' },
  { value: 'directo', label: 'Directo' },
];
