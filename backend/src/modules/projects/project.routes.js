import { Router } from 'express';
import { verifyToken, roleGuard } from '../../shared/middleware/auth.js';
import * as ctrl from './project.controller.js';

const router = Router();
router.use(verifyToken);

// Lectura: cualquier user autenticado
router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);

// Escritura: solo superadmin
router.post('/', roleGuard('superadmin'), ctrl.create);
router.patch('/:id', roleGuard('superadmin'), ctrl.update);
router.post('/:id/regenerate-webhook-key', roleGuard('superadmin'), ctrl.regenerateKey);

export default router;
