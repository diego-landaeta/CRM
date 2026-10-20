import * as model from './soporte.model.js';
import {
  crearTicketSchema, cambiarEstadoSchema, responderSchema, listarSchema,
} from './soporte.validation.js';
import { AppError } from '../../shared/utils/AppError.js';
import { logger } from '../../shared/utils/logger.js';
import { saveLocal, getLocal } from '../../shared/services/localStorage.service.js';
import { sendTicketNuevoEmail } from '../../shared/services/brevo.service.js';
import { notifyAdmins } from '../notifications/notifications.service.js';
import { veTodoElCrm, campusDeLaPersona } from '../../shared/utils/ambito.js';

/** Quien administra puede responder, cambiar el estado y ver las notas internas. */
function administra(req) {
  return req.user?.role === 'admin' || req.user?.role === 'superadmin' || req.user?.role === 'soporte';
}

/**
 * HASTA DONDE LLEGA CADA UNO (#245).
 *
 *   superadmin y soporte  todos los tickets: son quienes atienden el CRM.
 *   admin                 los de SUS campus y los que abrio el mismo.
 *   el resto              solo los suyos.
 *
 * Antes cualquier admin veia todos. Un ticket lleva pasos, una URL y a menudo
 * una captura con datos de un cliente: que el admin de una empresa pudiera
 * leer los de otra es la misma fuga de la que ya se cerro en Tutores, donde un
 * admin de CEDIA veia a un profesor de ICTESS con su IBAN.
 */
async function alcanceDe(req) {
  if (!administra(req)) return { tipo: 'propios', projectIds: [] };
  if (veTodoElCrm(req.user)) return { tipo: 'todo', projectIds: [] };
  return { tipo: 'campus', projectIds: await campusDeLaPersona(req.user.userId) };
}

/** ¿Alcanza este ticket quien pregunta, dado su alcance? */
function alcanza(alcance, req, { autorId, projectId }) {
  if (alcance.tipo === 'todo') return true;
  if (autorId != null && autorId === req.user.userId) return true;
  if (alcance.tipo === 'campus') {
    return projectId != null && alcance.projectIds.includes(Number(projectId));
  }
  return false;
}

/**
 * ¿Este ticket es alcanzable por quien lo pide?
 *
 * Un ticket lleva dentro pasos para reproducir, una URL del CRM y a menudo una
 * captura, que puede tener datos de un cliente. No es una lista publica.
 *
 * Devuelve el ticket ya cargado para no consultarlo dos veces.
 */
async function exigirAcceso(req, id) {
  const t = await model.porId(id);
  if (!t) throw new AppError('Ticket no encontrado', 404, 'NOT_FOUND');
  if (!alcanza(await alcanceDe(req), req, { autorId: t.autorId, projectId: t.projectId })) {
    throw new AppError('Ese ticket no es tuyo', 403, 'NO_ES_TUYO');
  }
  return t;
}

function parsear(schema, datos) {
  const r = schema.safeParse(datos);
  if (!r.success) throw new AppError(r.error.errors[0].message, 400, 'VALIDATION_ERROR');
  return r.data;
}

export async function listar(req, res, next) {
  try {
    const f = parsear(listarSchema, req.query);
    const alcance = await alcanceDe(req);
    const data = await model.listar({
      ...f,
      // El recorte lo decide el servidor, no la pantalla: esconder el filtro y
      // fiarse seria dejar la puerta abierta a quien escriba la direccion.
      // `null` = sin recorte (superadmin y soporte); si no, los suyos y los de
      // sus campus.
      alcance: alcance.tipo === 'todo'
        ? null
        : { userId: req.user.userId, projectIds: alcance.projectIds },
    });
    res.json({
      success: true,
      data: data.tickets,
      pagination: { total: data.total, page: data.page, limit: data.limit, totalPages: data.totalPages },
    });
  } catch (err) { next(err); }
}

export async function porId(req, res, next) {
  try {
    const id = Number(req.params.id);
    const t = await exigirAcceso(req, id);
    // Las notas internas no las ve quien abrio el ticket. Es lo que permite
    // discutir una averia sin que el comentario salga hacia fuera.
    t.comments = await model.mensajesDe(id, { incluirInternas: administra(req) });
    t.attachments = await model.adjuntosDe(id);
    res.json({ success: true, data: t });
  } catch (err) { next(err); }
}

export async function crear(req, res, next) {
  try {
    const d = parsear(crearTicketSchema, req.body);
    const t = await model.crear({ ...d, abiertoPor: req.user.userId });

    // EL AVISO VA POR LA CAMPANA, NO POR CORREO.
    //
    // Angel: «no hay correo de soporte para el CRM, nosotros somos el
    // soporte». Con eso, mandar un correo a una direccion inventada seria dar
    // el aviso por hecho sin que llegue a nadie — y ya hay un sitio donde el
    // equipo mira todos los dias.
    //
    // Entra como ACCION, asi que cuenta para el globo y sale en «lo que toca»
    // del dashboard. Es exactamente lo que es: algo que alguien tiene que
    // atender.
    notifyAdmins({
      type: 'ticket_nuevo',
      title: t.title,
      message: `${req.user?.nombre || 'Alguien del equipo'} ha abierto un ticket`,
      link_path: '/soporte',
      metadata: { ticketId: t.id, kind: t.kind, severity: t.severity, url: t.url },
      triggered_by_user_id: req.user.userId,
    }).catch((e) => logger.error({ err: e.message, ticketId: t.id }, 'Aviso de ticket: error'));

    // Y ADEMAS por correo, SOLO si alguien ha puesto `SOPORTE_EMAIL`. Vacia
    // —que es el caso hoy— no manda nada y no falla. Se deja montado porque el
    // dia que haya un buzon de soporte es una linea de `.env`, no un cambio.
    //
    // Va sin esperar: abrir un ticket no puede tardar lo que tarde Brevo, y si
    // el correo falla el ticket ya esta guardado — que es lo que de verdad
    // importaba, porque antes no se guardaba en ningun sitio.
    sendTicketNuevoEmail({ ticket: t, autor: req.user })
      .then((r) => {
        if (r?.sent) logger.info({ ticketId: t.id }, 'Correo de ticket enviado');
        else logger.debug({ ticketId: t.id, reason: r?.reason }, 'Correo de ticket no enviado');
      })
      .catch((e) => logger.error({ err: e.message, ticketId: t.id }, 'Correo de ticket: error'));

    res.status(201).json({ success: true, data: t });
  } catch (err) { next(err); }
}

export async function responder(req, res, next) {
  try {
    const id = Number(req.params.id);
    await exigirAcceso(req, id);
    const { body, interna } = parsear(responderSchema, req.body);
    // Solo quien administra puede dejar notas internas: si quien abrio el
    // ticket pudiera marcarlas, escribiria algo que el equipo no lee.
    const esInterna = interna && administra(req);
    await model.responder(id, req.user.userId, body, esInterna);
    const t = await model.porId(id);
    t.comments = await model.mensajesDe(id, { incluirInternas: administra(req) });
    res.status(201).json({ success: true, data: t });
  } catch (err) { next(err); }
}

export async function cambiarEstado(req, res, next) {
  try {
    const id = Number(req.params.id);
    await exigirAcceso(req, id);
    const { status } = parsear(cambiarEstadoSchema, req.body);
    res.json({ success: true, data: await model.cambiarEstado(id, status) });
  } catch (err) { next(err); }
}

export async function subirAdjunto(req, res, next) {
  try {
    const id = Number(req.params.id);
    await exigirAcceso(req, id);
    if (!req.file) throw new AppError('Archivo requerido', 400, 'FILE_REQUIRED');

    const ext = (req.file.originalname.split('.').pop() || 'bin')
      .toLowerCase().replace(/[^a-z0-9]/g, '');
    const azar = Math.random().toString(36).slice(2, 10);
    const clave = `tickets/${id}/a-${Date.now()}-${azar}.${ext}`;
    await saveLocal(clave, req.file.buffer);

    const a = await model.guardarAdjunto({
      ticketId: id, mensajeId: null, nombre: req.file.originalname,
      clave, mime: req.file.mimetype, bytes: req.file.size, subidoPor: req.user.userId,
    });
    res.status(201).json({ success: true, data: a });
  } catch (err) { next(err); }
}

/**
 * Descargar un adjunto.
 *
 * PIDE SESION Y COMPRUEBA DE QUIEN ES EL TICKET. Suena obvio y no lo es: en
 * Matriculas la ruta equivalente quedo publica «porque la URL ya es
 * no-guessable», y la URL era un entero correlativo — hoy se descargan DNI
 * escaneados sin credencial. Aqui la ruta va detras de `verifyToken` desde el
 * primer commit y ademas se comprueba el dueño.
 */
export async function descargarAdjunto(req, res, next) {
  try {
    const a = await model.adjuntoPorId(Number(req.params.adjuntoId));
    if (!a) throw new AppError('Adjunto no encontrado', 404, 'NOT_FOUND');
    if (!alcanza(await alcanceDe(req), req, { autorId: a.abierto_por, projectId: a.ticket_project_id })) {
      throw new AppError('Ese adjunto no es tuyo', 403, 'NO_ES_TUYO');
    }
    const { buffer } = await getLocal(a.clave);
    res.setHeader('Content-Type', a.mime || 'application/octet-stream');
    // Que el navegador respete el tipo declarado y no se ponga a adivinarlo.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(a.nombre)}"`);
    res.send(buffer);
  } catch (err) { next(err); }
}

/**
 * Borrar. Solo quien lo abrio o quien administra.
 *
 * `exigirAcceso` ya aplica esa regla, asi que no se repite aqui: una segunda
 * comprobacion escrita a mano es una que se olvida de actualizar.
 */
export async function borrar(req, res, next) {
  try {
    const id = Number(req.params.id);
    await exigirAcceso(req, id);
    await model.borrar(id);
    res.json({ success: true, data: { id } });
  } catch (err) { next(err); }
}

/** Cuanto se tarda en responder y en cerrar. Solo para quien administra. */
export async function tiempos(req, res, next) {
  try {
    if (!administra(req)) throw new AppError('No autorizado', 403, 'FORBIDDEN');
    const projectId = req.query.projectId ? Number(req.query.projectId) : null;
    const alcance = await alcanceDe(req);
    // Un admin mide SUS campus; pedir uno ajeno es un 403, no unos numeros.
    if (alcance.tipo === 'campus' && projectId && !alcance.projectIds.includes(projectId)) {
      throw new AppError('Ese proyecto no es tuyo', 403, 'NO_ES_TUYO');
    }
    res.json({
      success: true,
      data: await model.tiempos({
        projectId,
        projectIds: alcance.tipo === 'campus' ? alcance.projectIds : null,
      }),
    });
  } catch (err) { next(err); }
}
