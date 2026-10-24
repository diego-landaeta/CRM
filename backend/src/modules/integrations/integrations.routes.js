import { Router } from 'express';
import { verifyToken } from '../../shared/middleware/auth.js';
import { puede } from '../../shared/middleware/permissions.js';
import { projectAccess } from '../../shared/middleware/projectAccess.js';
import { AppError } from '../../shared/utils/AppError.js';
import * as ctrl from './integrations.controller.js';

const router = Router();

router.use(verifyToken);
// Y solo en SUS campus (QA de Diego, 22/10). Tener el permiso no basta: un admin de
// otra empresa cambiaba el projectId y veÃ­a, guardaba o borraba la integraciÃ³n
// de un campus ajeno â€”con Moodle, la URL y el token de administrador del campusâ€”.
// Cada ruta: primero el permiso (#423) y despuÃ©s `projectAccess`. El controlador
// usa `req.projectId`, el campus que se ha comprobado ahÃ­.
//
// Antes, un projectId que no es un nÃºmero daba 400 aquÃ­. `projectAccess` lo
// manda tal cual a la base, que falla, y la peticiÃ³n se queda sin respuesta:
// se comprueba antes, el mismo campo que mira Ã©l. Solo mira el formato, no
// quiÃ©n entra: en el inventario de permisos (#423) va con los tÃ©cnicos.
router.use(function projectIdConFormato(req, _res, next) {
  const pedido = req.params.projectId || req.body?.projectId || req.query.projectId;
  if (pedido !== undefined && !(/^\d{1,9}$/.test(String(pedido)) && Number(pedido) > 0)) {
    return next(new AppError('projectId requerido', 400, 'PROJECT_REQUIRED'));
  }
  next();
});

router.get('/',                puede('integrations.view'), projectAccess, ctrl.list);
// Antes de `/:provider`, que si no se la come. Sin `projectAccess`: no es de un
// campus, y el controlador recorta por el Ã¡mbito de quien pide (#218).
router.get('/estado',          puede('integrations.view'), ctrl.estado);
router.get('/:provider',       puede('integrations.view'), projectAccess, ctrl.getOne);
router.put('/',                puede('integrations.edit'), projectAccess, ctrl.upsert);
router.post('/:provider/test', puede('integrations.edit'), projectAccess, ctrl.test);
router.delete('/:provider',    puede('integrations.edit'), projectAccess, ctrl.remove);

export default router;
