import { Router } from 'express';
import { verifyToken, roleGuard } from '../../shared/middleware/auth.js';
import { projectAccess } from '../../shared/middleware/projectAccess.js';
import { uploadImage } from '../../shared/middleware/upload.js';
import * as ProductController from './product.controller.js';
import * as ModulesController from './product-modules.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/', projectAccess, ProductController.list);
router.get('/:id', projectAccess, ProductController.getById);
router.get('/:id/image-url', projectAccess, ProductController.getImageUrl);
router.post('/', roleGuard('admin', 'superadmin'), projectAccess, ProductController.create);
router.patch('/:id', roleGuard('admin', 'superadmin'), projectAccess, ProductController.update);
router.delete('/:id', roleGuard('admin', 'superadmin'), projectAccess, ProductController.deactivate);

// Imagen de producto. Acepta PNG/JPG/WEBP/SVG, max 5MB (definido en uploadImage).
// Almacena en R2 con clave `products/<projectId>/<productId>/<ts>.<ext>`.
router.post('/:id/image',
  roleGuard('admin', 'superadmin'),
  projectAccess,
  uploadImage,
  ProductController.uploadImage,
);
router.delete('/:id/image',
  roleGuard('admin', 'superadmin'),
  projectAccess,
  ProductController.removeImage,
);

// Módulos / temario del producto (CRUD manual desde CRM, también lo leen documentos/certificados)
router.get('/:id/modules', projectAccess, ModulesController.listModules);
router.post('/:id/modules', roleGuard('admin', 'superadmin'), projectAccess, ModulesController.createModule);
router.patch('/:id/modules/:moduleId', roleGuard('admin', 'superadmin'), projectAccess, ModulesController.updateModule);
router.delete('/:id/modules/:moduleId', roleGuard('admin', 'superadmin'), projectAccess, ModulesController.deleteModule);
router.post('/:id/modules/reorder', roleGuard('admin', 'superadmin'), projectAccess, ModulesController.reorderModules);

export default router;
