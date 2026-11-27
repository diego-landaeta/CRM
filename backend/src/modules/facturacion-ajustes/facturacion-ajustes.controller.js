import { AppError } from '../../shared/utils/AppError.js';
import * as service from './facturacion-ajustes.service.js';
import * as registro from './facturacion-ajustes.registro.js';
import { ajustesGlobalesSchema, campusSchema } from './facturacion-ajustes.validation.js';
import { proyectosDelAmbito } from '../../shared/utils/ambito.js';

function parsear(schema, datos) {
  const r = schema.safeParse(datos);
  if (!r.success) throw new AppError(r.error.errors[0].message, 400, 'VALIDATION_ERROR');
  return r.data;
}

function idProyecto(valor) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1) throw new AppError('Campus no válido', 400, 'BAD_ID');
  return n;
}

// GET /api/facturacion-ajustes
export async function ver(req, res, next) {
  try {
    const { projectIds } = await proyectosDelAmbito(req);
    const [global, campus] = await Promise.all([service.verGlobal(), service.verCampus(projectIds)]);
    res.json({ success: true, data: { global, campus } });
  } catch (err) { next(err); }
}

// PUT /api/facturacion-ajustes
export async function guardarGlobal(req, res, next) {
  try {
    const d = parsear(ajustesGlobalesSchema, req.body);
    await service.guardarGlobal(d, req.user.userId);
    await registro.anotar(req, registro.ACCIONES.GLOBAL, { campos: Object.keys(d) });
    res.json({ success: true, data: await service.verGlobal() });
  } catch (err) { next(err); }
}

// PATCH /api/facturacion-ajustes/campus/:projectId
export async function guardarCampus(req, res, next) {
  try {
    const projectId = idProyecto(req.params.projectId);
    const { activo } = parsear(campusSchema, req.body);
    await service.guardarCampus(projectId, activo, req.user.userId);
    await registro.anotar(req, registro.ACCIONES.CAMPUS, { campos: ['activo'], projectId });
    const { projectIds } = await proyectosDelAmbito(req);
    const campus = await service.verCampus(projectIds);
    res.json({ success: true, data: campus.find((c) => c.project_id === projectId) || null });
  } catch (err) { next(err); }
}

// GET /api/facturacion-ajustes/registro
export async function verRegistro(req, res, next) {
  try {
    res.json({ success: true, data: await registro.historial({ limite: Number(req.query.limite) || 100 }) });
  } catch (err) { next(err); }
}


