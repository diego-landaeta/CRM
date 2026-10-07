import { Router } from 'express';
import { verifyToken } from '../../shared/middleware/auth.js';
import { checkPermission } from '../../shared/middleware/permissions.js';
import * as ctrl from './facturas-colaborador.controller.js';

const router = Router();

// Administración: la lista de colaboradores (#202). El permiso se mira en el
// servidor; qué empresas ve cada uno lo acota el servicio.
const gestiona = [verifyToken, checkPermission('facturas_colaborador', 'gestionar')];

router.get('/empresas', gestiona, ctrl.empresas);
router.get('/colaboradores', gestiona, ctrl.listar);
router.post('/colaboradores', gestiona, ctrl.crear);
router.get('/colaboradores/:id', gestiona, ctrl.ver);
router.patch('/colaboradores/:id', gestiona, ctrl.editar);
router.post('/colaboradores/:id/baja', gestiona, ctrl.darDeBaja);
router.get('/colaboradores/:id/registro', gestiona, ctrl.registro);

export default router;
