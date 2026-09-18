import { z } from 'zod';
import * as Servicio from './documentos-marca.service.js';
import { AppError } from '../../shared/utils/AppError.js';

const TIPOS = ['guia_campus', 'homologaciones', 'otro'];

const subirSchema = z.object({
  tipo: z.enum(TIPOS),
  nombre_visible: z.string().max(160).optional(),
});

export async function listar(req, res, next) {
  try {
    res.json({ success: true, data: await Servicio.listar(req.projectId) });
  } catch (err) { next(err); }
}

export async function subir(req, res, next) {
  try {
    const { tipo, nombre_visible } = subirSchema.parse(req.body);
    const doc = await Servicio.subir({
      projectId: req.projectId,
      tipo,
      file: req.file,
      userId: req.user.userId,
      nombreVisible: nombre_visible,
    });
    res.status(201).json({ success: true, data: doc });
  } catch (err) { next(err); }
}

export async function enlace(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('Id no valido', 400, 'BAD_ID');
    res.json({ success: true, data: await Servicio.enlace(id, req.projectId) });
  } catch (err) { next(err); }
}

/** Qué falta para poder mandar el correo del día 1. */
export async function estadoDelDiaUno(req, res, next) {
  try {
    const conDossier = req.query.dossier === 'true' || req.query.dossier === '1';
    res.json({
      success: true,
      data: await Servicio.loQueFaltaParaElDiaUno(req.projectId, conDossier),
    });
  } catch (err) { next(err); }
}
