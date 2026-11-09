import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../../shared/middleware/auth.js';
import { puede } from '../../shared/middleware/permissions.js';
import { projectAccess } from '../../shared/middleware/projectAccess.js';
import { AppError } from '../../shared/utils/AppError.js';
import * as ctrl from './zadarma.controller.js';

const router = Router();

// ── Público: los avisos de Zadarma (#137) ──────────────────────────────────
// ANTES del `verifyToken`: no traen sesión del CRM. Los autentica la firma
// (`Signature`) con el secreto de un campus conectado; sin firma buena, 401.
// Con tope por IP: es una puerta abierta y cada aviso descifra secretos.
const limiteAvisos = rateLimit({ windowMs: 60_000, max: 600, standardHeaders: true, legacyHeaders: false });
router.get('/webhook', limiteAvisos, ctrl.eco);
router.post('/webhook', limiteAvisos, ctrl.aviso);

// ── Con sesión ──────────────────────────────────────────────────────────────
router.use(verifyToken);

// El projectId de las extensiones, que sea un número (como en Integraciones).
router.use(function projectIdConFormato(req, _res, next) {
  const pedido = req.body?.projectId ?? req.query.projectId;
  if (pedido !== undefined && !(/^\d{1,9}$/.test(String(pedido)) && Number(pedido) > 0)) {
    return next(new AppError('projectId requerido', 400, 'PROJECT_REQUIRED'));
  }
  next();
});

// Llamar a un prospecto suyo. Qué prospecto es suyo lo decide el servicio con la sesión.
router.post('/llamar', puede('zadarma.llamar'), ctrl.llamar);
// Dónde puede llamar quien pregunta y con qué extensión (para enseñar o no el botón).
router.get('/estado', puede('zadarma.llamar'), ctrl.estado);
// Llamadas por gestora y periodo, con el ámbito de «Actividad por comercial» (#203).
router.get('/reporte', puede('reports.mis_informes'), ctrl.reporte);
// La extensión de cada persona del campus: se configura con la integración.
router.get('/extensiones', puede('integrations.view'), projectAccess, ctrl.extensiones);
router.put('/extensiones', puede('integrations.edit'), projectAccess, ctrl.guardarExtensiones);

export default router;
