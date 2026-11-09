import * as service from './zadarma.service.js';
import * as model from './zadarma.model.js';
import { llamarSchema, extensionesSchema, avisoSchema } from './zadarma.validation.js';
import { AppError } from '../../shared/utils/AppError.js';
import { logger } from '../../shared/utils/logger.js';
import pool from '../../shared/config/db.js';
import { ambitoDeActividad, periodoDeActividad } from '../reports/report.controller.js';

function validar(schema, datos) {
  const r = schema.safeParse(datos);
  if (!r.success) throw new AppError(r.error.errors[0].message, 400, 'VALIDATION_ERROR');
  return r.data;
}

// POST /api/zadarma/llamar  { lead_id }
export async function llamar(req, res, next) {
  try {
    const { lead_id: leadId } = validar(llamarSchema, req.body);
    res.json({ success: true, data: await service.llamar(req.user, leadId) });
  } catch (err) { next(err); }
}

// GET /api/zadarma/estado
export async function estado(req, res, next) {
  try {
    res.json({ success: true, data: await service.estado(req.user) });
  } catch (err) { next(err); }
}

// GET /api/zadarma/reporte?desde&hasta&projectId|issuerId
// El mismo ámbito y el mismo periodo que «Actividad por comercial» (#203): una
// gestora recibe solo lo suyo, pida lo que pida.
export async function reporte(req, res, next) {
  try {
    const { projectIds, responsableId } = await ambitoDeActividad(req);
    const periodo = periodoDeActividad(req);
    res.json({ success: true, data: await service.reporte({ projectIds, responsableId, ...periodo }) });
  } catch (err) { next(err); }
}

// GET /api/zadarma/extensiones?projectId=N  (el campus ya comprobado por projectAccess)
export async function extensiones(req, res, next) {
  try {
    res.json({ success: true, data: await model.extensionesDelCampus(req.projectId) });
  } catch (err) { next(err); }
}

// PUT /api/zadarma/extensiones  { projectId, extensiones: [{ user_id, extension }] }
export async function guardarExtensiones(req, res, next) {
  const client = await pool.connect();
  try {
    const { extensiones: lista } = validar(extensionesSchema, req.body);
    await client.query('BEGIN');
    const fuera = await model.ponerExtensiones(client, req.projectId, lista);
    if (fuera.length) {
      await client.query('ROLLBACK');
      throw new AppError('Alguna de esas personas no está en este campus.', 400, 'FUERA_DEL_CAMPUS', { user_ids: fuera });
    }
    await client.query('COMMIT');
    res.json({ success: true, data: await model.extensionesDelCampus(req.projectId) });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') {
      return next(new AppError('Esa extensión ya es de otra persona en este campus.', 409, 'EXTENSION_OCUPADA'));
    }
    next(err);
  } finally { client.release(); }
}

// GET /api/zadarma/webhook?zd_echo=… — la comprobación de Zadarma al guardar la
// URL en su panel: hay que devolver el valor tal cual, sin nada más. Se limita a
// lo que manda Zadarma (letras y cifras) y como texto plano: una URL pública que
// repite lo que le llega no puede servir para inyectar HTML.
export function eco(req, res) {
  const v = String(req.query.zd_echo ?? '');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(v)) return res.status(400).type('text/plain').send('');
  res.status(200).type('text/plain').send(v);
}

// POST /api/zadarma/webhook — los avisos de fin de llamada. Sin sesión: lo
// autentica la firma (cabecera `Signature`) con el secreto de algún campus.
export async function aviso(req, res, next) {
  try {
    // El eco también puede llegar por POST (lo hace alguna versión del panel).
    if (req.query.zd_echo !== undefined) return eco(req, res);
    const cuerpo = validar(avisoSchema, req.body || {});
    const hecho = await service.registrarAviso(cuerpo, req.get('Signature'));
    if (!hecho.ignorado) logger.info({ event: cuerpo.event, ...hecho }, 'zadarma: aviso atendido');
    res.json({ success: true, data: hecho });
  } catch (err) { next(err); }
}
