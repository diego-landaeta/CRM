import { Router } from 'express';
import { verifyToken, roleGuard } from '../../shared/middleware/auth.js';
import { projectAccess } from '../../shared/middleware/projectAccess.js';
import { uploadPdf, validatePdfMagicBytes } from '../../shared/middleware/upload.js';
import * as ctrl from './documentos-marca.controller.js';

const router = Router();
router.use(verifyToken);

// LEER lo puede hacer cualquiera con acceso al proyecto: la gestora necesita
// saber si están los tres antes de escribir el correo.
router.get('/', projectAccess, ctrl.listar);
router.get('/dia-uno', projectAccess, ctrl.estadoDelDiaUno);
router.get('/:id/enlace', projectAccess, ctrl.enlace);

// SUBIRLOS no: son los documentos de la marca, los mismos para todo el equipo.
// Que cada gestora pudiera cambiar la guía del campus es justo lo que hace que
// acaben circulando tres versiones distintas.
router.post('/', roleGuard('admin', 'superadmin'), projectAccess,
  uploadPdf, validatePdfMagicBytes, ctrl.subir);

export default router;
