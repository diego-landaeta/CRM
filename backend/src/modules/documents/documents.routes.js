import { Router } from 'express';
import { verifyToken, roleGuard } from '../../shared/middleware/auth.js';
import * as ctrl from './documents.controller.js';

const router = Router();

router.use(verifyToken);

// Lecturas (cualquier usuario autenticado puede ver y descargar documentos
// existentes; el guard de proyecto se hace dentro del controller via projectId).
router.get('/',             ctrl.list);
router.get('/:id/download', ctrl.download);

// Operaciones de creacion/modificacion — solo superadmin y admin. El peek del
// numero esta detras del mismo guard porque solo se usa al editar/generar
// documentos, accion exclusiva de admins.
router.get('/next-number',  roleGuard('superadmin', 'admin'), ctrl.peekNumber);
router.post('/set-number',  roleGuard('superadmin', 'admin'), ctrl.setNumber);
router.post('/preview',     roleGuard('superadmin', 'admin'), ctrl.preview);
router.post('/generate',    roleGuard('superadmin', 'admin'), ctrl.generate);
router.delete('/:id',       roleGuard('superadmin', 'admin'), ctrl.remove);

export default router;
