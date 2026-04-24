import { z } from 'zod';

export const ruleSchema = z.object({
  project_id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  product_id: z.number().int().positive(),
  pct: z.number().min(0).max(100),
});

export const ruleUpdateSchema = z.object({
  pct: z.number().min(0).max(100).optional(),
  active: z.boolean().optional(),
});

export const paySchema = z.object({
  fecha_pago: z.string().optional(),
  notas: z.string().optional(),
});
