import { z } from 'zod';

export const createUserSchema = z.object({
  nombre: z.string().min(2, 'Nombre minimo 2 caracteres').max(200),
  email: z.string().email('Email invalido').transform((v) => v.toLowerCase().trim()),
  role: z.enum(['admin', 'gestor'], { message: 'Rol debe ser admin o gestor' }),
  projectIds: z.array(z.number().int().positive()).min(1, 'Debe asignar al menos un proyecto'),
});

export const updateUserSchema = z.object({
  nombre: z.string().min(2).max(200).optional(),
  role: z.enum(['admin', 'gestor']).optional(),
  projectIds: z.array(z.number().int().positive()).optional(),
});

export const listUsersSchema = z.object({
  active: z.enum(['true', 'false']).optional(),
  role: z.enum(['superadmin', 'admin', 'gestor']).optional(),
  projectId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
