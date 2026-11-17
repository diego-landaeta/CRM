import { z } from 'zod';

// POST /api/zadarma/llamar. Solo el prospecto: la extensión y el campus salen
// de la sesión y de la ficha, nunca de la petición.
export const llamarSchema = z.object({
  lead_id: z.coerce.number().int().positive(),
});

// Una extensión interna de la centralita: solo cifras (100, 101…).
const extension = z.string().trim().regex(/^\d{2,8}$/, 'La extensión son de 2 a 8 cifras (por ejemplo, 100).');

// PUT /api/zadarma/extensiones
export const extensionesSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  extensiones: z.array(z.object({
    user_id: z.coerce.number().int().positive(),
    // Vacío o null: se le quita.
    extension: z.union([extension, z.literal(''), z.null()]).transform((v) => v || null),
  })).min(1).max(200),
}).superRefine((d, ctx) => {
  const vistas = new Map();
  d.extensiones.forEach((x, i) => {
    if (!x.extension) return;
    if (vistas.has(x.extension)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['extensiones', i, 'extension'], message: `La extensión ${x.extension} está repetida.` });
    }
    vistas.set(x.extension, i);
  });
});

// El aviso de Zadarma. Llega como formulario: todo son cadenas. Solo se exige
// lo que hace falta para decidir; el resto se lee con cuidado en el servicio.
export const avisoSchema = z.object({
  event: z.string().max(40),
}).passthrough();
