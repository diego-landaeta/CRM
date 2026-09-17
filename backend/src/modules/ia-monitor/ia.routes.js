import { Router } from 'express';
import { verifyToken } from '../../shared/middleware/auth.js';
import { soloRoles } from '../../shared/middleware/auth.js';
import * as ctrl from './ia.controller.js';

const router = Router();
router.use(verifyToken);
router.get('/metrics/:projectId', ctrl.getMetrics);
router.get('/gasto', ctrl.getGasto);

/*
  Lo que la app de IA guarda en su Supabase (#44).

  LAS DOS PIDEN LO MISMO, aunque una solo lea. `previo` no escribe nada, pero
  dice cuanto factura el proyecto y desde cuando: es la cifra de negocio de una
  marca entera, no un detalle tecnico. Dejarla detras de `verifyToken` a secas
  significaba que cualquier gestora podia pedirla por URL, mientras la
  credencial con la que se obtiene vive en un modulo que solo abren los
  administradores.

  Y `soloRoles` en vez de `roleGuard`: el segundo deja pasar a `superadmin` y a
  `soporte` ANTES de mirar la lista, asi que `roleGuard('admin')` admite
  ademas a soporte sin decirlo. Donde hay credenciales de por medio se declara
  quien entra y no entra nadie mas (#80).
*/
router.get('/supabase/previo/:projectId', soloRoles('admin', 'superadmin'), ctrl.previoSupabase);
router.post('/supabase/importar/:projectId', soloRoles('admin', 'superadmin'), ctrl.importarSupabase);
export default router;
