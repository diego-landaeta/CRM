import { Router } from 'express';
import { verifyToken } from '../../shared/middleware/auth.js';
import { puede } from '../../shared/middleware/permissions.js';
import { uploadDoc } from '../../shared/middleware/upload.js';
import * as ctrl from './incidencias.controller.js';

const router = Router();

// Todo detras de la sesion, incluidos los adjuntos (ver la nota de Soporte:
// en Matriculas una ruta de documentos quedo publica y se descargaban DNI).
router.use(verifyToken);

// Ver: admin y gestora. Que la gestora vea SOLO LAS SUYAS lo recorta el
// controlador (`incidencias.service.js · alcanceDe`), no la ruta.
router.get('/', puede('incidencias.view'), ctrl.listar);

// LAS RUTAS DE PALABRA FIJA VAN ANTES QUE `/:id`: con `/:id` delante,
// `/metricas` se leeria como la incidencia «metricas».
router.get('/metricas', puede('incidencias.view'), ctrl.metricas);
router.get('/adjuntos/:adjuntoId', puede('incidencias.view'), ctrl.descargarAdjunto);

router.post('/', puede('incidencias.create'), ctrl.crear);
router.get('/:id', puede('incidencias.view'), ctrl.porId);
router.patch('/:id', puede('incidencias.edit'), ctrl.editar);
// Capturas, como en Soporte (`uploadDoc`: PNG, JPG, WEBP o PDF; sin SVG, que
// servido en linea puede llevar codigo). Las sube quien la apunta o la edita.
router.post('/:id/adjuntos', puede('incidencias.create', 'incidencias.edit'), uploadDoc, ctrl.subirAdjunto);

export default router;
