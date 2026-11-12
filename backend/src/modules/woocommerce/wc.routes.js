import { Router } from 'express';
import { verifyToken } from '../../shared/middleware/auth.js';
import { puede } from '../../shared/middleware/permissions.js';
import * as ctrl from './wc.controller.js';
import { projectAccess } from '../../shared/middleware/projectAccess.js';

const router = Router();
router.use(verifyToken);

// Las de credenciales, correspondencias e importación son de UN campus (`?projectId=`) y
// tiene que ser de quien pide: antes valía el de cualquiera, también para CAMBIAR las
// credenciales de WooCommerce de otra empresa. Las de pedidos lo comprueban dentro.
router.get('/credentials', puede('woocommerce.view'), projectAccess, ctrl.getCreds);
router.put('/credentials', puede('woocommerce.edit'), projectAccess, ctrl.upsertCreds);
router.delete('/credentials', puede('woocommerce.edit'), projectAccess, ctrl.deleteCreds);

router.get('/mappings', puede('woocommerce.view'), projectAccess, ctrl.listMappings);
router.put('/mappings', puede('woocommerce.edit'), projectAccess, ctrl.setMappings);

router.get('/runs', puede('woocommerce.view'), projectAccess, ctrl.listRuns);
router.get('/runs/current', puede('woocommerce.view'), projectAccess, ctrl.getCurrentRun);
router.post('/runs/start', puede('woocommerce.sync'), projectAccess, ctrl.importNow);
router.post('/auto-discover-cpts', puede('woocommerce.sync'), projectAccess, ctrl.autoDiscoverCpts);
router.get('/preview', puede('woocommerce.view'), projectAccess, ctrl.previewWc);
router.put('/mapping', puede('woocommerce.edit'), projectAccess, ctrl.saveMapping);
router.post('/scrape-preview', puede('woocommerce.sync'), projectAccess, ctrl.scrapePreview);

export default router;
