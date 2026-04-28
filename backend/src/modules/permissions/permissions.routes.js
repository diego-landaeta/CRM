import { Router } from 'express';
import { verifyToken, roleGuard } from '../../shared/middleware/auth.js';
import * as ctrl from './permissions.controller.js';

const router = Router();

router.use(verifyToken);

// Defaults del sistema — cualquier usuario autenticado puede ver
router.get('/system-defaults', ctrl.getSystemDefaults);

// Roles custom — solo admin/superadmin gestionan
router.get('/custom-roles', ctrl.listCustomRoles);
router.get('/custom-roles/:id', ctrl.getCustomRole);
router.post('/custom-roles', roleGuard('admin', 'superadmin'), ctrl.createCustomRole);
router.put('/custom-roles/:id', roleGuard('admin', 'superadmin'), ctrl.updateCustomRole);
router.delete('/custom-roles/:id', roleGuard('superadmin'), ctrl.deleteCustomRole);

// Permisos por usuario — admin ve/edita, superadmin todo
router.get('/users/:userId/permissions', roleGuard('admin', 'superadmin'), ctrl.getUserPermissions);
router.put('/users/:userId/permissions', roleGuard('admin', 'superadmin'), ctrl.saveUserPermissions);

export default router;
