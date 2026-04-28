import { Router } from 'express';
import { verifyToken, roleGuard } from '../../shared/middleware/auth.js';
import * as ctrl from './documents.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/',             ctrl.list);
router.post('/generate',    roleGuard('superadmin', 'admin'), ctrl.generate);
router.post('/preview',     roleGuard('superadmin', 'admin'), ctrl.preview);
router.get('/:id/download', ctrl.download);
router.delete('/:id',       roleGuard('superadmin', 'admin'), ctrl.remove);

export default router;
