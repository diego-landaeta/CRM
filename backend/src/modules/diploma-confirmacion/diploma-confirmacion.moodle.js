import { z } from 'zod';
import { query } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/AppError.js';
import { logger } from '../../shared/utils/logger.js';
import * as cfg from './diploma-confirmacion.config.js';
import * as model from './diploma-confirmacion.model.js';
import { pedir, DESDE_MOODLE } from './diploma-confirmacion.service.js';
import { recorrer } from '../certifex/certifex.cliente.js';
import { proyectosDeCentro } from '../certifex/certifex.programa.js';

/*
  PASO 1 DE LA #768: «Moodle detecta que el alumno tiene todas las actividades al
  100 % y todas corregidas, y lo comunica al CRM». Hasta ahora la confirmación de
  datos del diploma se pedía a mano (POST /api/diploma-confirmacion/pedir).

  El plugin local_crm 1.14.0 manda, por la misma puerta firmada que los mensajes
  (/api/moodle-avisos/:projectId), un aviso `evento: 'curso_completado'` UNA vez por
  alumno y curso, cuando el curso está completado Y no le queda ninguna entrega sin
  calificar (classes/curso_completado.php). Aquí:

    1. el alumno: su ficha del CRM en ESTE campus, por el correo de Moodle (la que
       está en el campus o tiene una venta en él);
    2. el producto del curso: `moodle_cursos_producto` (#767), el mismo enlace que usa
       la matrícula automática; y su venta, si la hay (solo se informa);
    3. su matrícula en Certifex: la de ese curso de Moodle (`curso.ref` es el id del
       curso), ese correo y un campus de Certifex que sea este proyecto;
    4. si ya pidió el diploma en Certifex y no hay confirmación viva, la de siempre:
       `pedir()` del servicio, la misma que el botón. Si ya la hay, nada (idempotente).

  Lo que no se puede resolver solo (sin ficha, curso sin producto, sin matrícula en
  Certifex, sin pedir el diploma, `pedir` que falla) no es un error para Moodle: se
  avisa a administración del campus por la campana y se contesta 200. Una campana por
  `cambio_id`, aunque el aviso llegue dos veces. Certifex caído sí es un 503: el plugin
  lo reintenta más tarde.

  INTERRUPTOR: DIPLOMA_CONFIRMACION_AUTO (apagado de serie), además de
  DIPLOMA_CONFIRMACION_ACTIVA y de que el campus esté en DIPLOMA_CONFIRMACION_CENTROS.
  Apagado, el aviso se contesta 200 «ignorado» y no se toca nada.
*/

const idMoodle = z.coerce.number().int().positive();
const texto = (max) => z.string().max(max).nullish();

/** Lo que manda el plugin (local_crm 1.14.0, classes/curso_completado.php, `aviso`). */
export const cursoCompletadoSchema = z.object({
  evento: z.literal('curso_completado'),
  sitio: texto(500),
  completado: z.object({
    cambio_id: z.string().trim().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/, 'cambio_id no válido'),
    fecha: z.coerce.number().int().positive(),
    porcentaje: z.coerce.number().min(0).max(100).nullish(),
    notas_pendientes: z.coerce.number().int().min(0),
  }).passthrough(),
  alumno: z.object({
    id: idMoodle,
    nombre: texto(500),
    email: texto(320),
    personal: z.boolean().optional(),
  }).passthrough(),
  curso: z.object({ id: idMoodle, nombre: texto(500) }).passthrough(),
}).passthrough();

const TIPO = 'diploma_confirmacion';

/** La ficha del alumno en ESTE campus: la que tiene una venta en él, luego la del campus, la más reciente. */
export async function leadDelAlumno(projectId, email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return null;
  const { rows } = await query(
    `SELECT l.id, l.nombre
       FROM leads l
      WHERE l.deleted_at IS NULL AND lower(btrim(l.email)) = $2
        AND (l.project_id = $1 OR EXISTS (SELECT 1 FROM conversions c WHERE c.lead_id = l.id AND c.project_id = $1))
      ORDER BY EXISTS (SELECT 1 FROM conversions c WHERE c.lead_id = l.id AND c.project_id = $1) DESC,
               (l.project_id = $1) DESC, l.id DESC
      LIMIT 1`,
    [projectId, e]);
  return rows[0] ? { id: Number(rows[0].id), nombre: rows[0].nombre } : null;
}

/**
 * Los productos de ese curso de Moodle en este campus (`moodle_cursos_producto`) y, de
 * ellos, la venta más reciente del alumno (producto principal o línea de la venta).
 * Sin la migración 289 no hay enlace posible: lo mismo que «sin producto».
 */
export async function productoYVenta(projectId, cursoMoodleId, leadId) {
  let productos;
  try {
    const { rows } = await query(
      `SELECT mc.product_id, p.nombre
         FROM moodle_cursos_producto mc JOIN products p ON p.id = mc.product_id
        WHERE mc.project_id = $1 AND mc.curso_moodle_id = $2
        ORDER BY mc.product_id`,
      [projectId, cursoMoodleId]);
    productos = rows.map((r) => ({ id: Number(r.product_id), nombre: r.nombre }));
  } catch (err) {
    if (err.code === '42P01') return { productos: [], venta: null };
    throw err;
  }
  if (!productos.length || !leadId) return { productos, venta: null };
  const { rows } = await query(
    `SELECT c.id, c.fecha_conversion
       FROM conversions c
      WHERE c.lead_id = $1 AND c.project_id = $2
        AND (c.producto_contratado_id = ANY($3::int[])
             OR EXISTS (SELECT 1 FROM conversion_items ci WHERE ci.conversion_id = c.id AND ci.product_id = ANY($3::int[])))
      ORDER BY c.fecha_conversion DESC NULLS LAST, c.id DESC
      LIMIT 1`,
    [leadId, projectId, productos.map((p) => p.id)]);
  return { productos, venta: rows[0] ? { id: Number(rows[0].id) } : null };
}

/** Su matrícula de Certifex en ese curso de Moodle de este campus (null si Certifex no la tiene). */
async function matriculaEnCertifex(projectId, cursoMoodleId, email) {
  const proyectos = await model.proyectos();
  const deEsteCampus = (centro) => proyectosDeCentro(centro, proyectos).some((p) => Number(p.id) === Number(projectId));
  const correo = String(email).trim().toLowerCase();
  const r = await recorrer('/candidatos', { estado: 'todas', curso: cursoMoodleId, q: correo }, {
    filtro: (c) => Number(c.curso?.ref) === Number(cursoMoodleId)
      && String(c.titular?.email || '').trim().toLowerCase() === correo
      && deEsteCampus(c.centro),
  });
  // Si hay varias (rara vez: dos matrículas del mismo curso), la que ya pidió el diploma.
  return r.filas.find((c) => c.solicitud) ?? r.filas[0] ?? null;
}

/** Administración del campus: los super admin y los admin con el campus asignado. */
async function administracionDelCampus(projectId) {
  const { rows } = await query(
    `SELECT u.id FROM users u WHERE u.active AND (u.role = 'superadmin' OR u.roles_extra && ARRAY['superadmin']::user_role[])
     UNION
     SELECT u.id FROM users u
       JOIN user_projects up ON up.user_id = u.id AND up.active AND up.project_id = $1
      WHERE u.active AND (u.role = 'admin' OR u.roles_extra && ARRAY['admin']::user_role[])`,
    [projectId]);
  return rows.map((r) => Number(r.id));
}

/** Campana a administración, una sola por aviso de Moodle (`cambio_id`) aunque llegue dos veces. */
async function avisarAdministracion(projectId, aviso, title, message, extra = {}) {
  try {
    const cambioId = aviso.completado.cambio_id;
    const ya = await query(
      `SELECT 1 FROM admin_notifications WHERE type = $1 AND metadata->>'cambio_id' = $2 LIMIT 1`, [TIPO, cambioId]);
    if (ya.rows.length) return false;
    const ids = await administracionDelCampus(projectId);
    if (!ids.length) return false;
    const { notifyUsers } = await import('../notifications/notifications.service.js');
    await notifyUsers({
      targetUserIds: ids,
      type: TIPO,
      title: String(title).slice(0, 200),
      message: String(message).slice(0, 300),
      link_path: '/clientes/matriculas/diplomas',
      metadata: {
        cambio_id: cambioId, project_id: Number(projectId), origen: 'moodle_curso_completado',
        moodle_user_id: aviso.alumno.id, curso_moodle_id: aviso.curso.id, ...extra,
      },
    });
    return true;
  } catch (err) {
    logger.warn({ err: err.message, projectId }, 'Diploma: no se pudo avisar a administración del curso terminado');
    return false;
  }
}

const quien = (a) => a.alumno.nombre || a.alumno.email || `usuario ${a.alumno.id} de Moodle`;
const cursoTxt = (a) => a.curso.nombre ? `«${a.curso.nombre}»` : `el curso ${a.curso.id} de Moodle`;

/**
 * El aviso `curso_completado` de un campus. Devuelve `{ resultado, ... }` (va en la
 * respuesta al plugin, que no la usa más que para su registro). Nunca devuelve el enlace.
 */
export async function recibirCursoCompletado(projectId, avisoRecibido) {
  const valido = cursoCompletadoSchema.safeParse(avisoRecibido);
  if (!valido.success) {
    const fallo = valido.error.issues[0];
    const donde = fallo?.path?.length ? ` (${fallo.path.join('.')})` : '';
    throw new AppError(`Aviso incompleto o no válido${donde}: ${fallo?.message || 'formato'}`, 400, 'VALIDATION_ERROR');
  }
  const a = valido.data;
  const pid = Number(projectId);
  if (!cfg.automatica()) return { resultado: 'ignorado', motivo: 'DIPLOMA_CONFIRMACION_AUTO apagado' };
  // El plugin ya filtra al personal y lo que tiene entregas sin calificar; si llega, no se pide.
  if (a.alumno.personal) return { resultado: 'ignorado', motivo: 'personal del campus' };
  if (a.completado.notas_pendientes > 0) return { resultado: 'ignorado', motivo: 'quedan entregas sin calificar' };

  const lead = await leadDelAlumno(pid, a.alumno.email);
  if (!lead) {
    await avisarAdministracion(pid, a, 'Curso terminado: no se encuentra al alumno en el CRM',
      `${quien(a)} ha terminado ${cursoTxt(a)} con todo corregido, pero no hay ficha con su correo en este campus. Pide los datos del diploma a mano.`);
    return { resultado: 'sin_alumno' };
  }
  const { productos, venta } = await productoYVenta(pid, a.curso.id, lead.id);
  if (!productos.length) {
    await avisarAdministracion(pid, a, 'Curso terminado: el curso no tiene producto',
      `${quien(a)} ha terminado ${cursoTxt(a)} con todo corregido, pero ese curso no está unido a ningún producto del catálogo. Pide los datos del diploma a mano.`,
      { lead_id: lead.id });
    return { resultado: 'sin_producto', leadId: lead.id };
  }
  const base = { leadId: lead.id, productoId: productos[0].id, conversionId: venta?.id ?? null };

  let c;
  try {
    c = await matriculaEnCertifex(pid, a.curso.id, a.alumno.email);
  } catch (err) {
    if (err.code === 'CERTIFEX_SIN_CONFIGURAR') {
      await avisarAdministracion(pid, a, 'Curso terminado: Certifex no está conectado',
        `${quien(a)} ha terminado ${cursoTxt(a)} con todo corregido. Este CRM no tiene Certifex conectado: no se han podido pedir los datos del diploma.`, base);
      return { resultado: 'sin_certifex', ...base };
    }
    // Certifex caído o lento: que el plugin lo reintente.
    logger.warn({ err: err.message, projectId: pid }, 'Diploma: Certifex no contesta al aviso de curso terminado');
    throw new AppError('Certifex no responde: prueba más tarde', 503, 'CERTIFEX_NO_RESPONDE');
  }
  if (!c) {
    await avisarAdministracion(pid, a, 'Curso terminado: sin matrícula en Certifex',
      `${quien(a)} ha terminado ${cursoTxt(a)} con todo corregido, pero Certifex no tiene esa matrícula. Revisa Diplomas.`, base);
    return { resultado: 'sin_matricula_certifex', ...base };
  }
  const matriculaId = Number(c.matriculaId);
  if (c.nexpediente) return { resultado: 'ya_emitido', matriculaId, ...base };
  const viva = await model.deLaMatricula(matriculaId);
  if (viva) return { resultado: 'repetido', matriculaId, estado: viva.estado, ...base };
  if (!c.solicitud) {
    // Pedir la confirmación exige la solicitud del diploma en Certifex (la que crea el
    // alumno con «Solicitar mi diploma» o el «Pasar a pendientes» del panel).
    await avisarAdministracion(pid, a, 'Curso terminado: aún no ha pedido el diploma',
      `${quien(a)} ha terminado ${cursoTxt(a)} con todo corregido y aún no ha pedido el diploma. Pásalo a pendientes en Diplomas y pide sus datos.`,
      { ...base, matriculaId });
    return { resultado: 'sin_solicitud', matriculaId, ...base };
  }

  const [r] = await pedir(DESDE_MOODLE, [matriculaId]);
  if (!r?.ok) {
    await avisarAdministracion(pid, a, 'Curso terminado: no se pudieron pedir los datos del diploma',
      `${quien(a)} · ${cursoTxt(a)}: ${r?.error || 'error'}`, { ...base, matriculaId });
    return { resultado: 'no_pedida', matriculaId, codigo: r?.codigo ?? 'ERROR', ...base };
  }
  logger.info({ projectId: pid, matriculaId, leadId: lead.id }, 'Diploma: confirmación de datos pedida por el aviso de curso terminado');
  return { resultado: 'pedida', matriculaId, enviado: !!r.enviado, simulado: !!r.simulado, ...base };
}
