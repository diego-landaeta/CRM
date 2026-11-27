import { Router } from 'express';
import { verifyToken } from '../../shared/middleware/auth.js';
import { puede } from '../../shared/middleware/permissions.js';
import * as ctrl from './facturacion-ajustes.controller.js';

// Ajustes de facturación automática desde la pantalla (#1202): antes solo por
// SSH + .env + reinicio de la API. Todo detrás de facturas.automatica_configurar.
const router = Router();
router.use(verifyToken);

router.get('/', puede('facturas.automatica_configurar'), ctrl.ver);
router.put('/', puede('facturas.automatica_configurar'), ctrl.guardarGlobal);
router.patch('/campus/:projectId', puede('facturas.automatica_configurar'), ctrl.guardarCampus);
router.get('/registro', puede('facturas.automatica_configurar'), ctrl.verRegistro);

export default router;

