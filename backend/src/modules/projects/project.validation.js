import { z } from 'zod';

export const createProjectSchema = z.object({
  nombre: z.string().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug solo minusculas, numeros y guiones').min(1).max(100),
  type: z.enum(['crm', 'ia']).default('crm'),
  emoji: z.string().max(10).optional().nullable(),
  meta_account_id: z.string().max(100).optional().nullable(),
  google_account_id: z.string().max(100).optional().nullable(),
  gsc_property: z.string().max(255).optional().nullable(),
  dias_alerta_inactividad: z.number().int().min(1).max(365).default(3),
  producto_label: z.string().max(50).optional(),
  producto_label_plural: z.string().max(50).optional(),
});

export const updateProjectSchema = z.object({
  nombre: z.string().min(1).max(200).optional(),
  type: z.enum(['crm', 'ia']).optional(),
  emoji: z.string().max(10).nullable().optional(),
  meta_account_id: z.string().max(100).nullable().optional(),
  google_account_id: z.string().max(100).nullable().optional(),
  gsc_property: z.string().max(255).nullable().optional(),
  dias_alerta_inactividad: z.number().int().min(1).max(365).optional(),
  active: z.boolean().optional(),
  producto_label: z.string().max(50).optional(),
  producto_label_plural: z.string().max(50).optional(),
  modules: z.record(z.string(), z.boolean()).optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'Al menos un campo' });
