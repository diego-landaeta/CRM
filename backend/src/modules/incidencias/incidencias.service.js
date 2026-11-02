import * as model from './incidencias.model.js';
import { AppError } from '../../shared/utils/AppError.js';
import { veTodoElCrm, campusDeLaPersona } from '../../shared/utils/ambito.js';
import { tienePermiso } from '../../shared/middleware/permissions.js';

/**
 * HASTA DONDE LLEGA CADA UNO (#253).
 *
 * Diego: «la crean y la ven super admin y admin; una gestora ve solo las
 * suyas». Y la issue: «se registra para corregir, no para señalar» — una
 * gestora no puede leer las de una compañera.
 *
 *   superadmin y soporte     todas: llevan el CRM entero (`veTodoElCrm`).
 *   quien apunta o edita     las de sus campus y sus empresas, las de «todo
 *                            el CRM» (sin campus) y las suyas.
 *   el resto (la gestora)    las suyas: las que causo o apunto.
 *
 * Lo segundo va por el PERMISO y no por el rol (#423): si mañana se le da
 * «Editar incidencias» a otra persona, ve lo de sus campus sin tocar codigo.
 * Lo de «sus campus» es el mismo criterio que el resto del CRM (#245): un
 * admin de CEDIA no ve las de ICTESS. Las de «todo el CRM» las ve cualquier
 * admin (la issue: «la ve el resto de admin»): no llevan datos de ningun
 * campus.
 *
 * A la gestora NO le salen las que solo detecto: la causo una compañera, y
 * verla —con su nombre en las cifras— es justo «señalar».
 */
export async function alcanceDe(req) {
  if (veTodoElCrm(req.user)) return null;
  const userId = req.user.userId;
  if (await tienePermiso(req, 'incidencias.edit', 'incidencias.create')) {
    const projectIds = await campusDeLaPersona(userId);
    return {
      tipo: 'campus',
      userId,
      projectIds,
      sociedadIds: await model.sociedadesDeLosCampus(projectIds),
    };
  }
  return { tipo: 'propias', userId };
}

/** ¿Alcanza esta incidencia quien tiene ese alcance? Lo mismo que el WHERE del modelo. */
export function alcanza(alcance, inc) {
  if (alcance === null) return true;
  const yo = alcance.userId;
  if ([inc.causadaPor, inc.creadaPor].includes(yo)) return true;
  if (alcance.tipo !== 'campus') return false;
  // Quien administra sí ve las que detectó él: no es señalar a nadie.
  if (inc.detectadaPor === yo) return true;
  if (inc.projectId == null && inc.sociedadId == null) return true;
  if (inc.projectId != null && alcance.projectIds.includes(Number(inc.projectId))) return true;
  return inc.sociedadId != null && alcance.sociedadIds.includes(Number(inc.sociedadId));
}

/**
 * La incidencia, si quien pregunta la alcanza.
 *
 * Una que no existe y una que existe pero no es suya dan EL MISMO 404: con un
 * 403 para la segunda, probando numeros se sabria cuales existen.
 */
export async function exigirAcceso(req, id) {
  const inc = await model.porId(id);
  if (!inc || !alcanza(await alcanceDe(req), inc)) {
    throw new AppError('Incidencia no encontrada', 404, 'NOT_FOUND');
  }
  return inc;
}

/**
 * Lo que se va a guardar apunta a cosas que existen y que son de quien la
 * apunta.
 *
 * - El campus o la empresa, dentro de su alcance: si no, un admin podria
 *   colgar una incidencia en el campus de otra empresa (y su admin la leeria).
 *   Fuera de su alcance es el mismo 403 exista o no, como en Soporte.
 * - Las personas (causo, detecto, arreglo), que existan: una clave foranea
 *   rota saldria como un 500.
 */
export async function comprobarReferencias(req, datos) {
  const alcance = await alcanceDe(req);

  if (datos.projectId) {
    if (alcance === null) {
      if (!(await model.existe('projects', datos.projectId))) {
        throw new AppError('Ese campus no existe', 400, 'VALIDATION_ERROR');
      }
    } else if (!(alcance.projectIds || []).includes(Number(datos.projectId))) {
      throw new AppError('Ese campus no es tuyo', 403, 'NO_ES_TUYO');
    }
  }
  if (datos.sociedadId) {
    if (alcance === null) {
      if (!(await model.existe('invoice_issuers', datos.sociedadId))) {
        throw new AppError('Esa empresa no existe', 400, 'VALIDATION_ERROR');
      }
    } else if (!(alcance.sociedadIds || []).includes(Number(datos.sociedadId))) {
      throw new AppError('Esa empresa no es tuya', 403, 'NO_ES_TUYO');
    }
  }
  // Las personas, que existan y —para quien no ve todo el CRM— que sean de sus
  // campus: apuntar como causante a una gestora de otra empresa le abriría la
  // incidencia entera (la ve quien la causó). Fuera de su alcance, el mismo 400
  // que si no existiera: así no se averigua quién hay en otra empresa.
  for (const campo of ['causadaPor', 'detectadaPor', 'arregladaPor']) {
    const id = datos[campo];
    if (!id) continue;
    const vale = alcance === null
      ? await model.existe('users', id)
      : id === alcance.userId || await model.personaDeLosCampus(id, alcance.projectIds || []);
    if (!vale) throw new AppError('Esa persona no existe o no es de tus campus', 400, 'VALIDATION_ERROR');
  }
  return alcance;
}
