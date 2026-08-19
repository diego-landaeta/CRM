import * as model from './chat.model.js';
import * as servicio from './chat.service.js';
import * as evolution from './evolution.client.js';
import * as media from './media.service.js';
import { AppError } from '../../shared/utils/AppError.js';
import { logger } from '../../shared/utils/logger.js';

const esAdmin = (req) => ['admin', 'superadmin', 'soporte'].includes(req.user.role);

// GET /api/whatsapp/chats?projectId=N
export async function chats(req, res, next) {
  try {
    res.json({ success: true, data: await model.listar({
      instancia: evolution.INSTANCIA,
      projectId: req.query.projectId ? parseInt(req.query.projectId) : null,
      limite: parseInt(req.query.limite) || 50,
    })});
  } catch (err) { next(err); }
}

// GET /api/whatsapp/chats/:id
export async function chat(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const conv = await model.porId(id);
    if (!conv) throw new AppError('Conversacion no encontrada', 404, 'NOT_FOUND');
    const msgs = await model.mensajes(id, parseInt(req.query.limite) || 100);
    // Marca leido tambien EN WhatsApp: al otro lado le sale el doble tic azul.
    await servicio.marcarLeida(id).catch(() => {});
    res.json({ success: true, data: { conversacion: conv, mensajes: msgs } });
  } catch (err) { next(err); }
}

// POST /api/whatsapp/chats/:id/enviar  { texto }
export async function enviar(req, res, next) {
  try {
    const texto = String(req.body?.texto || '').trim();
    if (!texto) throw new AppError('El mensaje esta vacio', 400, 'VACIO');
    if (texto.length > 4000) throw new AppError('El mensaje es demasiado largo', 400, 'MUY_LARGO');
    const fila = await servicio.enviar({
      conversacionId: parseInt(req.params.id), texto, usuarioId: req.user.userId,
    });
    res.status(201).json({ success: true, data: fila });
  } catch (err) { next(err); }
}

/**
 * POST /api/whatsapp/chats  { leadId } o { telefono }
 *
 * Abrir un chat nuevo. Se parte de un PROSPECTO, no de un numero suelto a
 * mano: quien esta en la base dejo su telefono en un formulario nuestro, y esa
 * es la diferencia entre escribir a alguien que lo pidio y escribir en frio,
 * que es lo que hace que suspendan el numero.
 */
export async function abrirChat(req, res, next) {
  try {
    const { leadId, telefono } = req.body || {};
    let tel = telefono;
    if (leadId) {
      const l = await model.leadPorId(parseInt(leadId));
      if (!l) throw new AppError('Prospecto no encontrado', 404, 'NOT_FOUND');
      if (!l.telefono) throw new AppError('Ese prospecto no tiene telefono', 400, 'SIN_TELEFONO');
      tel = l.telefono;
    }
    if (!tel) throw new AppError('Hace falta un prospecto o un telefono', 400, 'FALTA_DESTINO');

    const digitos = String(tel).replace(/[^0-9]/g, '');
    if (digitos.length < 9) throw new AppError('Ese telefono no es valido', 400, 'TELEFONO_INVALIDO');

    const conv = await model.conversacionDe({
      instancia: evolution.INSTANCIA,
      jid: `${digitos}@s.whatsapp.net`,
      nombrePush: null,
    });
    res.status(201).json({ success: true, data: conv });
  } catch (err) { next(err); }
}

// POST /api/whatsapp/chats/:id/adjunto  (multipart: archivo, pie)
export async function adjunto(req, res, next) {
  try {
    if (!req.file) throw new AppError('No llego ningun archivo', 400, 'SIN_ARCHIVO');
    const fila = await servicio.enviarAdjunto({
      conversacionId: parseInt(req.params.id),
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      nombreArchivo: req.file.originalname,
      pie: req.body?.pie || null,
      usuarioId: req.user.userId,
    });
    res.status(201).json({ success: true, data: fila });
  } catch (err) { next(err); }
}

// GET /api/whatsapp/media/:mensajeId — sirve el adjunto ya descargado.
//
// Va por endpoint con sesion y no por carpeta publica: son conversaciones de
// clientes, y una carpeta servida por Nginx la lee cualquiera que adivine la
// ruta.
export async function verMedia(req, res, next) {
  try {
    const m = await model.mensajeConAdjunto(parseInt(req.params.mensajeId));
    if (!m) throw new AppError('Adjunto no encontrado', 404, 'NOT_FOUND');
    const { buffer } = await media.leer(m.media_url);
    res.setHeader('Content-Type', m.media_mime || 'application/octet-stream');
    // inline: las notas de voz y las fotos se ven en el chat, no se descargan.
    res.setHeader('Content-Disposition', `inline; filename="${(m.nombre_archivo || 'archivo').replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(buffer);
  } catch (err) { next(err); }
}

// POST /api/whatsapp/chats/:id/no-escribir  { motivo }
export async function noEscribir(req, res, next) {
  try {
    await model.noEscribir(parseInt(req.params.id), req.body?.motivo);
    res.json({ success: true });
  } catch (err) { next(err); }
}

// GET /api/whatsapp/conexion — ¿esta emparejado el numero?
export async function conexion(req, res, next) {
  try {
    if (!esAdmin(req)) throw new AppError('Solo un administrador', 403, 'FORBIDDEN');
    if (!evolution.configurado()) {
      return res.json({ success: true, data: { configurado: false, motivo: 'Falta EVOLUTION_URL o EVOLUTION_API_KEY' } });
    }
    const [est, inst] = await Promise.all([evolution.estado(), evolution.instancias()]);
    const lista = Array.isArray(inst.datos) ? inst.datos : (inst.datos?.instances || []);
    const mia = lista.find((i) => (i?.name || i?.instance?.instanceName) === evolution.INSTANCIA) || lista[0] || null;
    const crudo = est.datos?.instance?.state || est.datos?.state || null;
    res.json({ success: true, data: {
      configurado: true,
      instancia: evolution.INSTANCIA,
      // El numero con el que se emparejo. Sin esto una gestora no sabe desde
      // que linea esta escribiendo, que es justo lo que se pregunta al entrar.
      numero: mia?.ownerJid?.split('@')[0] || mia?.number || mia?.owner || null,
      nombre: mia?.profileName || mia?.profileName || null,
      conectado: crudo === 'open',
      estado: crudo,
    }});
  } catch (err) { next(err); }
}

// POST /api/whatsapp/emparejar — devuelve el QR para escanear una vez.
export async function emparejar(req, res, next) {
  try {
    if (!esAdmin(req)) throw new AppError('Solo un administrador empareja el numero', 403, 'FORBIDDEN');
    let r = await evolution.crearInstancia();
    // Si ya existia, se pide el QR de la que hay en vez de fallar.
    if (!r.ok) r = await evolution.qr();
    if (!r.ok) throw new AppError('No se pudo obtener el codigo QR', 502, 'SIN_QR');
    const d = r.datos || {};
    res.json({ success: true, data: {
      qr: d.qrcode?.base64 || d.base64 || null,
      estado: d.instance?.status || null,
    }});
  } catch (err) { next(err); }
}

/**
 * POST /api/whatsapp/webhook — lo llama Evolution, NO el navegador.
 *
 * Va sin verifyToken a proposito: quien llama es el contenedor, no un usuario.
 * Se protege con un secreto compartido y porque Evolution solo escucha en
 * 127.0.0.1. Siempre responde 200: si contestara error, Evolution reintentaria
 * en bucle.
 */
export async function webhook(req, res) {
  try {
    const secreto = process.env.EVOLUTION_WEBHOOK_SECRET;
    if (secreto && req.get('x-webhook-secret') !== secreto) {
      logger.warn({ ip: req.ip }, 'WhatsApp: webhook con secreto incorrecto');
      return res.status(401).json({ success: false });
    }
    const r = await servicio.recibir(req.body);
    return res.json({ success: true, data: r });
  } catch (err) {
    logger.error({ err: err.message }, 'WhatsApp: fallo procesando el webhook');
    return res.json({ success: true, data: { error: true } });
  }
}
