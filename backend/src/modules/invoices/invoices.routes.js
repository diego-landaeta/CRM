import { Router } from 'express';
import { verifyToken, roleGuard } from '../../shared/middleware/auth.js';
import { uploadImage } from '../../shared/middleware/upload.js';
import * as ctrl from './invoices.controller.js';
import { facturaDeSuCampus, campusDelCuerpo } from './invoices.acceso.js';
import { ventaPorId, prospectoPorId } from '../conversions/conversion.acceso.js';

const router = Router();

// Público (sin auth) para que el logo cargue en <img src> y en el PDF.
router.get('/issuers/:id/logo',       ctrl.getIssuerLogo);

router.use(verifyToken);

// Corte de facturacion: hasta que dia esta al dia. Consultarlo lo puede
// cualquiera; moverlo solo quien gestiona la facturacion (se comprueba dentro).
router.get('/facturacion-al-dia',     ctrl.facturacionAlDia);
router.put('/facturacion-al-dia',     ctrl.setFacturacionAlDia);
router.post('/cola/generar',          campusDelCuerpo, ctrl.generarDeCola);
router.post('/cola/emitir-hasta',     campusDelCuerpo, ctrl.emitirColaHasta);
router.get('/',                       ctrl.list);
router.get('/stats',                  ctrl.stats);
// Que numero tocaria ahora. Va ANTES de '/:id' para que «siguiente-numero» no
// se lea como el id de una factura.
router.get('/siguiente-numero',       ctrl.siguienteNumero);
router.get('/ventas-sin-factura',     ctrl.ventasSinFactura);
router.get('/regimenes',              ctrl.listRegimenes);
router.get('/resolve-regimen',        ctrl.resolveRegimen);
router.post('/regimenes',             ctrl.createRegimen);
router.patch('/regimenes/:id',        ctrl.updateRegimen);
router.delete('/regimenes/:id',       ctrl.deleteRegimen);
router.get('/templates',              ctrl.listTemplates);
router.post('/templates',             ctrl.createTemplate);
router.get('/templates/:id',          ctrl.getTemplate);
router.patch('/templates/:id',        ctrl.updateTemplate);
router.delete('/templates/:id',       ctrl.deleteTemplate);
router.get('/issuers',                ctrl.listIssuers);
router.post('/issuers',               ctrl.createIssuer);
router.patch('/issuers/:id',          ctrl.updateIssuer);
router.delete('/issuers/:id',         ctrl.deleteIssuer);
router.post('/issuers/:id/logo',      uploadImage, ctrl.uploadIssuerLogo);
router.delete('/issuers/:id/logo',    ctrl.deleteIssuerLogo);
router.get('/config',                 ctrl.getConfig);
router.patch('/config',               ctrl.updateConfig);
router.get('/sequences',              ctrl.listSequences);
router.post('/sequences',             ctrl.setSequence);
router.get('/lead-fiscal/:leadId',    (req, res, next) => prospectoPorId(req, res, next, req.params.leadId), ctrl.leadFiscalData);
router.get('/by-conversion/:conversionId', (req, res, next) => ventaPorId(req, res, next, req.params.conversionId), ctrl.byConversion);
router.get('/:id',                    facturaDeSuCampus, ctrl.getOne);
router.post('/',                      campusDelCuerpo, ctrl.create);
// Editar una factura en borrador: SOLO admin/superadmin.
router.patch('/:id',                  facturaDeSuCampus, roleGuard('admin', 'superadmin'), ctrl.update);
// Corregir una factura YA emitida/pagada (IVA, datos, concepto): admin/superadmin
// o gestora con permiso factura_manager (el controller valida que sea suya).
router.patch('/:id/corregir',         facturaDeSuCampus, roleGuard('admin', 'superadmin', 'gestor'), ctrl.corregir);
// Cambiar solo fechas (emisión/pago). Sin roleGuard: el controller valida el permiso
// editar_fechas_factura (admins y usuarios acotados a "solo fechas").
router.patch('/:id/fechas',           facturaDeSuCampus, ctrl.updateFechas);
// Apuntar que una factura ya se le paso al cliente. NO manda correo: es una
// marca, y las facturas salen por donde cada uno las mande.
router.patch('/:id/entregada',        facturaDeSuCampus, ctrl.marcarEntregada);
// Opción B: asociar una factura existente a una venta del cliente.
router.patch('/:id/asociar',          facturaDeSuCampus, roleGuard('admin', 'superadmin', 'gestor'), ctrl.asociarVenta);
router.get('/:id/pdf',                facturaDeSuCampus, ctrl.pdf);
router.post('/:id/send',              facturaDeSuCampus, ctrl.send);
router.post('/:id/mark-paid',         facturaDeSuCampus, ctrl.markPaid);
// «Cobrada» en una proforma: apunta el cobro y la pasa a factura. El servicio
// deja solo a quien lleva la facturacion, y a una gestora, con las suyas.
router.post('/:id/cobrar-proforma',   facturaDeSuCampus, roleGuard('admin', 'superadmin', 'gestor'), ctrl.cobrarProforma);
router.post('/:id/cancel',            facturaDeSuCampus, ctrl.cancel);
// Eliminar factura + liberar número: admin/superadmin o gestora factura_manager
// (el controller valida que la factura sea suya).
router.delete('/:id',                 facturaDeSuCampus, roleGuard('admin', 'superadmin', 'gestor'), ctrl.destroy);
// Emitir factura de abono (rectificativa): admin/superadmin o gestora factura_manager
// (el controller valida que la base sea suya).
router.post('/:id/rectificar',        facturaDeSuCampus, roleGuard('admin', 'superadmin', 'gestor'), ctrl.rectificar);
router.post('/:id/emitir',            facturaDeSuCampus, ctrl.emitir);
router.post('/:id/completar-datos',   facturaDeSuCampus, ctrl.completarDatos);

export default router;
