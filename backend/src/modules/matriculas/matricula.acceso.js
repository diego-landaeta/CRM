import { query } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/AppError.js';
import { campusDeLaPersona, veTodoElCrm } from '../../shared/utils/ambito.js';

/**
 * Una matrícula, solo para quien trabaja en su campus.
 *
 * Las rutas `/:id` (ver, editar, borrar, cambiar de estado, subir un documento)
 * trabajaban con el id de la URL sin mirar de qué campus era: cualquier sesión
 * con rol de gestora o admin podía leer o cambiar la matrícula de otro campus,
 * con su DNI y sus datos, probando ids. Lo mismo que se cerró en ventas
 * (`conversion.acceso.js`).
 *
 * Regla, con la sesión: super admin y soporte, todo; el resto, solo sus campus
 * (`user_projects`). Se engancha con `router.param`, así que cubre también las
 * rutas que se añadan. La descarga firmada (`GET /:id/doc/:tipo`) va antes de
 * `verifyToken` y se protege con su firma: aquí, sin sesión, se deja pasar.
 */

const PROHIBIDO = () => new AppError('No tienes acceso a esa matrícula', 403, 'FORBIDDEN');

export async function puedeEnCampus(user, projectId) {
  if (veTodoElCrm(user)) return true;
  const mios = await campusDeLaPersona(user?.userId);
  return mios.includes(Number(projectId));
}

export async function matriculaPorId(req, res, next, valor) {
  try {
    if (!req.user) return next();   // la descarga firmada: la protege su firma
    const id = Number(valor);
    if (!Number.isInteger(id) || id <= 0) return next();   // el controlador responde
    const { rows: [m] } = await query('SELECT project_id FROM matriculas WHERE id = $1', [id]);
    if (!m) throw new AppError('Matricula no encontrada', 404, 'NOT_FOUND');
    if (!(await puedeEnCampus(req.user, m.project_id))) throw PROHIBIDO();
    next();
  } catch (err) { next(err); }
}

/** El campus pedido (listado) o con el que se crea, siempre dentro de los suyos. */
export async function exigirCampus(user, projectId) {
  if (!(await puedeEnCampus(user, projectId))) throw PROHIBIDO();
}
