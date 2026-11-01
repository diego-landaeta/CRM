import { Router } from 'express';
import { verifyToken } from '../../shared/middleware/auth.js';
import { puede } from '../../shared/middleware/permissions.js';
import * as ctrl from './ia.controller.js';

const router = Router();
router.use(verifyToken);
router.get('/metrics/:projectId', puede('ia.view'), ctrl.getMetrics);
router.get('/gasto', puede('ia.view'), ctrl.getGasto);
router.get('/cobros/:projectId', puede('ia.view'), ctrl.cobros);

/*
  Lo que la app de IA guarda en su Supabase (#44).

  LAS TRES PIDEN LO MISMO, aunque una solo lea. `previo` no escribe nada, pero
  dice cuanto factura el proyecto y desde cuando: es la cifra de negocio de una
  marca entera, no un detalle tecnico. Dejarla detras de `verifyToken` a secas
  significaba que cualquier gestora podia pedirla por URL, mientras la
  credencial con la que se obtiene vive en un modulo que solo abren los
  administradores.

  Las tres piden `ia.importar` (solo administracion, #423): el catalogo dice quien
  entra y no entra nadie mas (#80).
*/
router.get('/supabase/previo/:projectId', puede('ia.importar'), ctrl.previoSupabase);
router.post('/supabase/importar/:projectId', puede('ia.importar'), ctrl.importarSupabase);
// Quitar las que eran pruebas. Borra ventas, asi que solo admin/superadmin
// y con `?soloProbar=true` para verlo antes.
router.post('/supabase/quitar-pruebas/:projectId', puede('ia.importar'), ctrl.quitarPruebasSupabase);
export default router;
