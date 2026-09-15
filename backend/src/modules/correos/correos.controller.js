import * as model from './correos.model.js';
import { proyectosDelAmbito } from '../../shared/utils/ambito.js';

const fecha = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);

export async function listar(req, res, next) {
  try {
    const { projectIds } = await proyectosDelAmbito(req);
    res.json({ success: true, data: await model.listar({
      estado: req.query.estado || null,
      busca: (req.query.busca || '').trim() || null,
      desde: fecha(req.query.desde),
      hasta: fecha(req.query.hasta),
      projectIds,
      limite: req.query.limite,
      pagina: req.query.pagina,
    }) });
  } catch (e) { next(e); }
}

/** Uno con su cuerpo. Es la unica ruta que devuelve el texto del correo. */
export async function uno(req, res, next) {
  try {
    const c = await model.uno(req.params.id);
    if (!c) return res.status(404).json({ success: false, error: 'Ese correo no está' });
    res.json({ success: true, data: c });
  } catch (e) { next(e); }
}

export async function recuento(req, res, next) {
  try { res.json({ success: true, data: await model.recuento() }); }
  catch (e) { next(e); }
}
