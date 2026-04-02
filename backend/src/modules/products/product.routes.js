import { Router } from 'express';
import { verifyToken, roleGuard } from '../../shared/middleware/auth.js';
import { projectAccess } from '../../shared/middleware/projectAccess.js';
import * as ProductController from './product.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/', projectAccess, ProductController.list);
router.get('/:id', projectAccess, ProductController.getById);
router.post('/', roleGuard('admin', 'superadmin'), projectAccess, ProductController.create);
router.patch('/:id', roleGuard('admin', 'superadmin'), projectAccess, ProductController.update);
router.delete('/:id', roleGuard('admin', 'superadmin'), projectAccess, ProductController.deactivate);

export default router;
