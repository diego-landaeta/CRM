import { Router } from 'express';
import { verifyToken, roleGuard } from '../../shared/middleware/auth.js';
import { uploadDoc as uploadDocMiddleware } from '../../shared/middleware/upload.js';
import * as ctrl from './matricula.controller.js';

const router = Router();

// Doc download es publico (la URL ya es no-guessable)
router.get('/:id/doc/:tipo', ctrl.getDoc);

router.use(verifyToken);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', roleGuard('admin', 'superadmin', 'gestor'), ctrl.create);
router.patch('/:id', roleGuard('admin', 'superadmin', 'gestor'), ctrl.update);
router.delete('/:id', roleGuard('admin', 'superadmin'), ctrl.remove);
router.post('/:id/estado', roleGuard('admin', 'superadmin'), ctrl.setEstado);
router.post('/:id/doc/:tipo', roleGuard('admin', 'superadmin', 'gestor'), uploadDocMiddleware, ctrl.uploadDoc);

export default router;
