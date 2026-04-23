import { z } from 'zod';

export const webhookLeadSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(200),
  email: z.string().email('Email invalido').transform((v) => v.toLowerCase().trim()),
  telefono: z.string().max(50).optional(),
  producto_interes: z.string().max(255).optional(),
  notas: z.string().max(2000).optional(),
  landing_url: z.string().url().optional().or(z.literal('')),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(255).optional(),
  utm_content: z.string().max(255).optional(),
  utm_term: z.string().max(255).optional(),
});

export const listLeadsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  status: z.enum(['nuevo', 'por_contactar', 'contactado', 'en_seguimiento', 'convertido', 'no_interesado']).optional(),
  responsableId: z.coerce.number().int().positive().optional(),
  canal: z.enum(['meta_ads', 'google_ads', 'tiktok_ads', 'organico', 'chatgpt_ia', 'directo', 'referido']).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const updateStatusSchema = z.object({
  status: z.enum(['nuevo', 'por_contactar', 'contactado', 'en_seguimiento', 'convertido', 'no_interesado']),
  motivo: z.string().min(1, 'Motivo requerido').max(500),
});

export const createInteractionSchema = z.object({
  tipo: z.enum(['llamada', 'email', 'whatsapp', 'nota']),
  nota: z.string().max(2000).optional(),
});

export const createReminderSchema = z.object({
  fecha_recordatorio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato fecha: YYYY-MM-DD'),
  nota: z.string().max(500).optional(),
});

export const reassignSchema = z.object({
  responsable_id: z.number().int().positive('ID de responsable requerido'),
});

export const createLeadManualSchema = z.object({
  project_id: z.number().int().positive('project_id requerido'),
  nombre: z.string().min(1, 'Nombre requerido').max(200),
  email: z.string().email('Email invalido').transform((v) => v.toLowerCase().trim()),
  telefono: z.string().max(50).optional().or(z.literal('')),
  producto_interes_id: z.number().int().positive().optional().nullable(),
  canal: z.enum(['directo', 'referido', 'meta_ads', 'google_ads', 'tiktok_ads', 'organico', 'chatgpt_ia']).default('directo'),
  notas: z.string().max(2000).optional().or(z.literal('')),
});

export const updateLeadSchema = z.object({
  nombre: z.string().min(1, 'Nombre no puede estar vacio').max(200).optional(),
  telefono: z.string().max(50).nullable().optional(),
  notas: z.string().max(2000).nullable().optional(),
  producto_interes_id: z.number().int().positive().nullable().optional(),
  custom_fields: z.record(z.string(), z.any()).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Al menos un campo debe ser proporcionado',
});
