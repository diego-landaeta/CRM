import { Router } from 'express';
import { verifyToken, roleGuard } from '../../shared/middleware/auth.js';
import { projectAccess } from '../../shared/middleware/projectAccess.js';
import { AppError } from '../../shared/utils/AppError.js';
import * as ctrl from './integrations.controller.js';

const router = Router();

router.use(verifyToken);
router.use(roleGuard('superadmin', 'admin'));
// Y solo en SUS campus (QA de Diego, 22/10). Ser admin no bastaba: un admin de
// otra empresa cambiaba el projectId y veía, guardaba o borraba la integración
// de un campus ajeno —con Moodle, la URL y el token de administrador del campus—.
// El controlador usa `req.projectId`, el campus que se ha comprobado aquí.
//
// Antes, un projectId que no es un número daba 400 aquí. `projectAccess` lo
// manda tal cual a la base, que falla, y la petición se queda sin respuesta:
// se comprueba antes, el mismo campo que mira él.
router.use((req, _res, next) => {
  const pedido = req.params.projectId || req.body?.projectId || req.query.projectId;
  if (pedido !== undefined && !(/^\d{1,9}$/.test(String(pedido)) && Number(pedido) > 0)) {
    return next(new AppError('projectId requerido', 400, 'PROJECT_REQUIRED'));
  }
  next();
});
router.use(projectAccess);

router.get('/',                ctrl.list);
router.get('/:provider',       ctrl.getOne);
router.put('/',                ctrl.upsert);
router.post('/:provider/test', ctrl.test);
router.delete('/:provider',    ctrl.remove);

export default router;
