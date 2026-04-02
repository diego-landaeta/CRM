import { z } from 'zod';

export const leadSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email no valido'),
  telefono: z.string().optional(),
  origen: z.enum(['meta_ads', 'google_ads', 'organico', 'referido', 'directo'], {
    required_error: 'Selecciona un origen',
  }),
  estado: z.enum(['nuevo', 'por_contactar', 'contactado', 'en_seguimiento', 'convertido', 'no_interesado']).optional(),
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

export const ESTADO_OPTIONS = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'por_contactar', label: 'Por contactar' },
  { value: 'contactado', label: 'Contactado' },
  { value: 'en_seguimiento', label: 'En seguimiento' },
  { value: 'convertido', label: 'Convertido' },
  { value: 'no_interesado', label: 'No interesado' },
];
