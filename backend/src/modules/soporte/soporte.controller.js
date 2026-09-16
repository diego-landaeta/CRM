import * as model from './soporte.model.js';
import {
  crearTicketSchema, cambiarEstadoSchema, responderSchema, listarSchema,
} from './soporte.validation.js';
import { AppError } from '../../shared/utils/AppError.js';
import { logger } from '../../shared/utils/logger.js';
import { saveLocal, getLocal } from '../../shared/services/localStorage.service.js';
import { sendTicketNuevoEmail } from '../../shared/services/brevo.service.js';

/** Quien administra ve todos los tickets; el resto, los suyos. */
function administra(req) {
  return req.user?.role === 'admin' || req.user?.role === 'superadmin' || req.user?.role === 'soporte';
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
  if (!administra(req) && t.autorId !== req.user.userId) {
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
    const data = await model.listar({
      ...f,
      // El recorte lo decide el servidor, no la pantalla: esconder el filtro y
      // fiarse seria dejar la puerta abierta a quien escriba la direccion.
      soloDe: administra(req) ? null : req.user.userId,
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

    // El aviso va SIN esperar: abrir un ticket no puede tardar lo que tarde
    // Brevo, y si el correo falla el ticket ya esta guardado — que es lo que
    // de verdad importaba. Antes de esto no se guardaba en ningun sitio.
    sendTicketNuevoEmail({ ticket: t, autor: req.user })
      .then((r) => {
        if (r?.sent) logger.info({ ticketId: t.id }, 'Aviso de ticket enviado');
        else logger.warn({ ticketId: t.id, reason: r?.reason }, 'Aviso de ticket NO enviado');
      })
      .catch((e) => logger.error({ err: e.message, ticketId: t.id }, 'Aviso de ticket: error'));

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
    if (!administra(req) && a.abierto_por !== req.user.userId) {
      throw new AppError('Ese adjunto no es tuyo', 403, 'NO_ES_TUYO');
    }
    const { buffer } = await getLocal(a.clave);
    res.setHeader('Content-Type', a.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(a.nombre)}"`);
    res.send(buffer);
  } catch (err) { next(err); }
}

/** Cuanto se tarda en responder y en cerrar. Solo para quien administra. */
export async function tiempos(req, res, next) {
  try {
    if (!administra(req)) throw new AppError('No autorizado', 403, 'FORBIDDEN');
    const projectId = req.query.projectId ? Number(req.query.projectId) : null;
    res.json({ success: true, data: await model.tiempos({ projectId }) });
  } catch (err) { next(err); }
}
