import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email invalido').transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, 'Password requerido'),
});

export const setPasswordSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  password: z
    .string()
    .min(8, 'Minimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayuscula')
    .regex(/[0-9]/, 'Debe contener al menos un numero'),
  confirmPassword: z.string().min(1, 'Confirmacion requerida'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contrasenas no coinciden',
  path: ['confirmPassword'],
});

/**
 * Lo unico que se pide para recuperar: el correo (#37).
 *
 * Que el formato sea invalido SI se contesta con un 400 — eso no delata a
 * nadie, porque «pepe@» no es la direccion de ningun empleado. Lo que no se
 * puede contestar distinto es un correo bien formado que no existe.
 */
export const olvidoSchema = z.object({
  email: z.string().email('Email invalido').transform((v) => v.toLowerCase().trim()),
});
