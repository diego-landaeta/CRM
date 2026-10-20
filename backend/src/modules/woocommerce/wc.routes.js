import { Router } from 'express';
import { verifyToken, roleGuard } from '../../shared/middleware/auth.js';
import * as ctrl from './wc.controller.js';
import * as pedidos from './wc.pedidos.controller.js';

const router = Router();
router.use(verifyToken);
router.use(roleGuard('admin', 'superadmin'));

router.get('/credentials', ctrl.getCreds);
router.put('/credentials', ctrl.upsertCreds);
router.delete('/credentials', ctrl.deleteCreds);

router.get('/mappings', ctrl.listMappings);
router.put('/mappings', ctrl.setMappings);

router.get('/runs', ctrl.listRuns);
router.get('/runs/current', ctrl.getCurrentRun);
router.post('/runs/start', ctrl.importNow);
router.post('/auto-discover-cpts', ctrl.autoDiscoverCpts);
router.get('/preview', ctrl.previewWc);
router.put('/mapping', ctrl.saveMapping);
router.post('/scrape-preview', ctrl.scrapePreview);

// Pedidos (#14). El aviso de WooCommerce entra por wc.webhook.js (sin sesión, con firma).
router.get('/orders', pedidos.listar);
router.post('/sync/orders', pedidos.sincronizar);
router.put('/orders-config', pedidos.configurar);
router.post('/webhook-secret', pedidos.secretoDelAviso);

export default router;
