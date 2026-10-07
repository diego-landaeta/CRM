import crypto from 'node:crypto';
import pool, { getClient } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/AppError.js';
import { uploadToR2 } from '../../shared/services/r2.service.js';
import { generatePresignedUrl } from '../../shared/utils/presignedUrl.js';
import * as model from './facturas.model.js';
import { anotar } from './facturas-colaborador.model.js';
import { ambitoDe } from './facturas-colaborador.service.js';
import { logger } from '../../shared/utils/logger.js';
import { enviarCorreoDelMes, enviarAcuse, urlDelEnlace } from './facturas.emails.js';
import { notifyUsers } from '../notifications/notifications.service.js';

/*
  Facturas de colaboradores (#202) · el mes, el enlace y la subida.

  El enlace (Definición acordada, 01/10):
    - token aleatorio de 32 bytes; en la base solo su sha256, como los del MCP;
    - vale para un colaborador, una empresa y un mes, y no abre nada más;
    - caduca a los 60 días, y en cuanto se sube la factura ya no admite otra;
    - administración puede mandar uno nuevo (el viejo deja de valer).
*/

export const DIAS_DE_ENLACE = 60;
export const TOPE_BYTES = 10 * 1024 * 1024;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** «2026-09-01» → «septiembre de 2026». */
export function nombreDelMes(periodo) {
  const [a, m] = periodo.split('-').map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

export const huella = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

/**
 * El enlace de una semilla: 32 bytes, firmados con la clave del servidor. Como
 * las firmas de los documentos de matrícula (`firmaDeDocumento.js`), se lee la
 * clave en cada llamada.
 */
export function enlaceDeLaSemilla(semilla) {
  const clave = process.env.JWT_SECRET;
  if (!clave) throw new Error('Falta JWT_SECRET: no se pueden hacer los enlaces de las facturas');
  return crypto.createHmac('sha256', clave).update(`facturas-colaborador:${semilla}`).digest('base64url');
}

/**
 * Un enlace nuevo. En la base quedan la semilla (al azar) y la huella del
 * enlace; el enlace en sí, no. Así se cumplen las dos cosas de la definición:
 * «solo se guarda su sha256» y el recordatorio «con el mismo enlace».
 */
function tokenNuevo() {
  const semilla = crypto.randomBytes(32).toString('hex');
  const token = enlaceDeLaSemilla(semilla);
  return { token, hash: huella(token), semilla };
}

const caducidad = (ahora = Date.now()) => new Date(ahora + DIAS_DE_ENLACE * 24 * 3600 * 1000);

async function enTransaccion(fn) {
  const db = await getClient();
  try {
    await db.query('BEGIN');
    const r = await fn(db);
    await db.query('COMMIT');
    return r;
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }
}

/**
 * Prepara el mes: una fila y un enlace por cada colaborador activo y empresa.
 * Devuelve los enlaces EN CLARO solo aquí, en memoria, para quien los vaya a
 * mandar por correo: en la base no quedan.
 */
export async function prepararMes(periodo) {
  const pendientes = await model.pendientesDePreparar(periodo);
  const preparados = [];
  for (const p of pendientes) {
    const { token, hash, semilla } = tokenNuevo();
    // Una por una, fuera de una transacción común: si una falla, las demás siguen.
    const id = await model.crearDelMes(pool, {
      colaboradorId: p.colaborador_id,
      issuerId: p.issuer_id,
      periodo,
      importeEsperado: p.importe_acordado,
      tokenHash: hash,
      semilla,
      caducaAt: caducidad(),
    });
    if (id) preparados.push({ facturaId: id, colaboradorId: p.colaborador_id, issuerId: p.issuer_id, token });
  }
  return preparados;
}

/**
 * Manda el enlace de una fila por correo y lo apunta: `enviado` (o
 * `recordatorio`) si Brevo lo acepta, `no_enviado` si falla. Con los correos
 * apagados solo queda en el log (lo hace `despachar`) y la fila sigue «sin enviar».
 */
export async function mandarEnlace(facturaId, token, { recordatorio = false, nuevo = false, clave }) {
  const f = await model.porId(facturaId, null);
  if (!f) return { sent: false };
  try {
    const r = await enviarCorreoDelMes({ f, token, recordatorio, nuevo, clave });
    if (r?.sent) {
      await model.marcarEnviado(facturaId);
      await anotar(pool, {
        facturaId, evento: recordatorio ? 'recordatorio' : 'enviado', detalle: { para: f.colaborador_email },
      });
    }
    return r;
  } catch (err) {
    logger.error({ err: err.message, facturaId }, 'No se pudo mandar el enlace de la factura de colaborador');
    await anotar(pool, { facturaId, evento: 'no_enviado', detalle: { motivo: err.message } });
    return { sent: false, error: err.message };
  }
}

/** El aviso en la campana a administración. `notifyUsers` no falla nunca. */
async function avisarDeLaFactura(f) {
  const importe = f.importe === null ? '' : ` · ${Number(f.importe).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`;
  await notifyUsers({
    targetUserIds: await model.avisarA(f.issuer_id),
    type: 'factura_colaborador',
    title: `Factura recibida: ${f.colaborador_nombre}`,
    message: `${nombreDelMes(f.periodo)} · ${f.razon_social}${importe} · ${f.numero_recepcion}`,
    link_path: `/finanzas/facturas-colaboradores?periodo=${f.periodo.slice(0, 7)}`,
    metadata: { factura_id: f.id, issuer_id: f.issuer_id },
  });
}

/** El acuse con la copia. Si falla, la factura ya está guardada: solo se apunta en el log. */
async function mandarAcuse(f, archivo) {
  try {
    const r = await enviarAcuse({ f, archivo });
    if (r?.sent) await anotar(pool, { facturaId: f.id, evento: 'acuse', detalle: { para: f.colaborador_email } });
  } catch (err) {
    logger.error({ err: err.message, facturaId: f.id }, 'No se pudo mandar el acuse de la factura de colaborador');
  }
}

/* ─────────────────────────── el enlace (sin usuario) ─────────────────────────── */

const ENLACE_NO_VALE = () => new AppError('Este enlace no existe o ya no es válido', 404, 'NOT_FOUND');

/** Lo que ve el colaborador: nada de huellas, claves de archivo ni correos. */
function paraElColaborador(f) {
  return {
    estado: f.estado,
    periodo: f.periodo.slice(0, 7),
    mes: nombreDelMes(f.periodo),
    colaborador: f.colaborador_nombre,
    empresa: {
      razon_social: f.razon_social,
      nif: f.empresa_nif,
      direccion: f.direccion,
      cp: f.cp,
      ciudad: f.ciudad,
      pais: f.pais,
      logo_url: f.logo_url,
    },
    importe_acordado: f.importe_esperado === null ? null : Number(f.importe_esperado),
    caduca_at: f.caduca_at,
    recibida: f.subida_at ? {
      subida_at: f.subida_at,
      numero_recepcion: f.numero_recepcion,
      importe: f.importe === null ? null : Number(f.importe),
      numero_factura: f.numero_factura,
      archivo: f.nombre_original,
    } : null,
  };
}

export async function verEnlace(token, ip) {
  const f = await model.porTokenHash(huella(token));
  if (!f) throw ENLACE_NO_VALE();
  if (['enviado', 'sin_enviar', 'no_enviado'].includes(f.estado) && await model.marcarAbierto(f.id)) {
    await anotar(pool, { facturaId: f.id, evento: 'abierto', ip });
    f.estado = 'abierto';
  }
  return paraElColaborador(f);
}

const FIRMAS = [
  { mime: 'application/pdf', ext: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'image/png', ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/jpeg', ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },
];

/** El tipo de verdad, por los primeros bytes; lo que diga el navegador no cuenta. */
export function tipoReal(buffer) {
  return FIRMAS.find((f) => f.bytes.every((b, i) => buffer[i] === b)) || null;
}

/** «2026-09_CEDIA_Laura-Perez_F-2026-09.pdf» (Definición acordada, «Archivos y descargas»). */
export function nombreDelArchivo({ periodo, empresa, colaborador, numeroFactura, ext }) {
  const limpio = (t) => String(t || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 40);
  const corta = limpio(String(empresa).split(/\s+/)[0]) || 'empresa';
  return [periodo.slice(0, 7), corta, limpio(colaborador), limpio(numeroFactura)].filter(Boolean).join('_') + `.${ext}`;
}

export async function subir(token, datos, ip) {
  const f = await model.porTokenHash(huella(token));
  if (!f) throw ENLACE_NO_VALE();
  const nombre = await guardarFactura(f, datos, { ip });
  // Ya guardada: se lee fuera de la transacción, con lo que ve todo el mundo.
  const subida = await model.porTokenHash(huella(token));
  await mandarAcuse(subida, { nombre, buffer: datos.archivo.buffer });
  await avisarDeLaFactura(subida);
  return paraElColaborador(subida);
}

/**
 * Subir la factura de una fila del mes. Lo mismo por el enlace del correo que
 * desde «Mi factura»: una por empresa y mes, PDF o foto, 10 MB.
 */
async function guardarFactura(f, { archivo, importe, numeroFactura }, { ip = null, userId = null }) {
  const delMes = `${nombreDelMes(f.periodo)} para ${f.razon_social}`;
  if (f.estado === 'anulada') {
    throw new AppError('Esta factura se anuló: te llegará un enlace nuevo', 409, 'ANULADA');
  }
  if (f.estado === 'recibida') {
    throw new AppError(`Ya subiste la factura de ${delMes}`, 409, 'YA_SUBIDA');
  }
  if (f.estado === 'caducado') {
    throw new AppError('Este enlace ha caducado: pide uno nuevo a administración', 410, 'CADUCADO');
  }

  if (!archivo) throw new AppError('Falta el archivo de la factura', 400, 'FILE_REQUIRED');
  if (archivo.size > TOPE_BYTES) throw new AppError('El archivo pasa de 10 MB', 400, 'FILE_TOO_LARGE');
  const tipo = tipoReal(archivo.buffer);
  if (!tipo) throw new AppError('El archivo tiene que ser un PDF o una foto JPG o PNG', 400, 'INVALID_FILE_TYPE');

  const sha256 = crypto.createHash('sha256').update(archivo.buffer).digest('hex');
  const nombre = nombreDelArchivo({
    periodo: f.periodo, empresa: f.razon_social, colaborador: f.colaborador_nombre, numeroFactura, ext: tipo.ext,
  });

  await enTransaccion(async (db) => {
    // Con la fila bloqueada: dos envíos a la vez no pueden subir los dos.
    const fila = await model.bloquear(db, f.id);
    if (fila.anulada_at) throw new AppError('Esta factura se anuló: te llegará un enlace nuevo', 409, 'ANULADA');
    if (fila.subida_at) throw new AppError(`Ya subiste la factura de ${delMes}`, 409, 'YA_SUBIDA');

    const numeroRecepcion = await model.siguienteRecepcion(db, f.periodo);
    const archivoKey = `facturas-colaborador/${f.periodo.slice(0, 7)}/${f.id}-${sha256.slice(0, 8)}/${nombre}`;
    await uploadToR2(archivoKey, archivo.buffer, tipo.mime);

    await model.guardarSubida(db, f.id, {
      numeroRecepcion, importe, numeroFactura, archivoKey,
      nombreOriginal: String(archivo.originalname || nombre).slice(0, 255),
      mime: tipo.mime, tamano: archivo.size, sha256,
    });
    await anotar(db, {
      facturaId: f.id, evento: 'recibida', ip, userId,
      detalle: {
        archivo: archivo.originalname, tamano: archivo.size, importe,
        numero_factura: numeroFactura, numero_recepcion: numeroRecepcion,
      },
    });
  });
  return nombre;
}

/* ─────────────────────────── «Mi factura» (colaborador con usuario) ─────────────────────────── */

const NO_ES_TUYA = () => new AppError('Factura no encontrada', 404, 'NOT_FOUND');

/** Sus meses: los de los colaboradores de la lista que llevan su usuario. */
export async function mias(user) {
  const filas = await model.delUsuario(user.userId);
  return filas.map((f) => ({
    id: f.id,
    ...paraElColaborador(f),
    // Su enlace, rehecho con la semilla; solo mientras sirve para subirla.
    enlace: f.token_semilla && !['recibida', 'anulada', 'caducado'].includes(f.estado)
      ? urlDelEnlace(enlaceDeLaSemilla(f.token_semilla)) : null,
  }));
}

export async function subirMia(user, id, datos, ip) {
  const f = await model.delUsuarioPorId(user.userId, id);
  if (!f) throw NO_ES_TUYA();
  const nombre = await guardarFactura(f, datos, { ip, userId: user.userId });
  const subida = await model.delUsuarioPorId(user.userId, id);
  await mandarAcuse(subida, { nombre, buffer: datos.archivo.buffer });
  await avisarDeLaFactura(subida);
  return { id, ...paraElColaborador(subida) };
}

export async function archivoMio(user, id) {
  const f = await model.delUsuarioPorId(user.userId, id);
  if (!f) throw NO_ES_TUYA();
  if (!f.archivo_key) throw new AppError('Esta factura todavía no tiene archivo', 404, 'NOT_FOUND');
  return { url: await generatePresignedUrl(f.archivo_key), nombre: f.nombre_original, caduca_en_segundos: 15 * 60 };
}

/* ─────────────────────────── administración ─────────────────────────── */

const NO_ESTA = () => new AppError('Factura no encontrada', 404, 'NOT_FOUND');

export async function delMes(user, filtros) {
  const ambito = await ambitoDe(user);
  if (filtros.issuerId && ambito && !ambito.includes(filtros.issuerId)) {
    throw new AppError('Esa empresa no es de tus campus', 403, 'FORBIDDEN');
  }
  const filas = await model.delMes({ ...filtros, issuerIds: ambito });
  const vivas = filas.filter((f) => f.estado !== 'anulada');
  const suma = (k) => vivas.reduce((s, f) => s + (f[k] === null ? 0 : Number(f[k])), 0);
  return {
    periodo: filtros.periodo.slice(0, 7),
    mes: nombreDelMes(filtros.periodo),
    resumen: {
      total: vivas.length,
      recibidas: vivas.filter((f) => f.estado === 'recibida').length,
      importe_recibido: Math.round(suma('importe') * 100) / 100,
      importe_acordado: Math.round(suma('importe_esperado') * 100) / 100,
    },
    facturas: filas,
  };
}

/** El archivo, con un enlace firmado de 15 minutos. */
export async function urlDelArchivo(user, id) {
  const f = await model.porId(id, await ambitoDe(user));
  if (!f) throw NO_ESTA();
  if (!f.archivo_key) throw new AppError('Esta factura todavía no tiene archivo', 404, 'NOT_FOUND');
  return { url: await generatePresignedUrl(f.archivo_key), nombre: f.nombre_original, caduca_en_segundos: 15 * 60 };
}

/**
 * Anular: la factura se queda (con su archivo) marcada como anulada, y nace
 * otra fila del mismo mes con un enlace nuevo para que la vuelva a subir.
 */
export async function anular(user, id, motivo, ip) {
  const f = await model.porId(id, await ambitoDe(user));
  if (!f) throw NO_ESTA();
  if (f.anulada_at) throw new AppError('Esta factura ya está anulada', 409, 'CONFLICT');

  const { token, hash, semilla } = tokenNuevo();
  const nuevaId = await enTransaccion(async (db) => {
    await model.anular(db, id, user.userId, motivo);
    await anotar(db, { facturaId: id, evento: 'anulada', userId: user.userId, ip, detalle: { motivo } });
    const nueva = await model.crearDelMes(db, {
      colaboradorId: f.colaborador_id, issuerId: f.issuer_id, periodo: f.periodo,
      importeEsperado: f.importe_esperado, tokenHash: hash, semilla, caducaAt: caducidad(),
    });
    await anotar(db, { facturaId: nueva, evento: 'reenviado', userId: user.userId, ip, detalle: { sustituye_a: id } });
    return nueva;
  });
  await mandarEnlace(nuevaId, token, { nuevo: true, clave: `facturas-colaborador-reenvio-${nuevaId}-${Date.now()}` });
  return { anulada: id, nueva: nuevaId, token };
}

/** Un enlace nuevo para quien todavía no la ha subido. El viejo deja de valer. */
export async function reenviar(user, id, ip) {
  const f = await model.porId(id, await ambitoDe(user));
  if (!f) throw NO_ESTA();
  if (f.anulada_at) throw new AppError('Esta factura está anulada', 409, 'CONFLICT');
  if (f.subida_at) throw new AppError('Esta factura ya está recibida', 409, 'CONFLICT');

  const { token, hash, semilla } = tokenNuevo();
  await enTransaccion(async (db) => {
    await model.cambiarEnlace(db, id, hash, semilla, caducidad());
    await anotar(db, { facturaId: id, evento: 'reenviado', userId: user.userId, ip });
  });
  await mandarEnlace(id, token, { nuevo: true, clave: `facturas-colaborador-reenvio-${id}-${Date.now()}` });
  return { id, token };
}

export async function registroDeFactura(user, id) {
  if (!(await model.porId(id, await ambitoDe(user)))) throw NO_ESTA();
  return model.registroDeFactura(id);
}

/* ─────────────────────────── la tarea del mes ─────────────────────────── */

/**
 * El día 5: a quien todavía no ha subido la del mes anterior, el recordatorio,
 * con el mismo enlace (Definición acordada, «Cómo funciona», 6). Se rehace con
 * su semilla y se comprueba contra la huella: si no cuadra (la clave del
 * servidor cambió), no se manda un enlace que no funcionaría.
 */
export async function recordar(periodo) {
  let recordados = 0;
  for (const { id, token_semilla: semilla, token_hash: hash } of await model.sinSubir(periodo)) {
    if (!semilla || await model.tieneEvento(id, 'recordatorio')) continue;
    const token = enlaceDeLaSemilla(semilla);
    if (huella(token) !== hash) {
      logger.warn({ facturaId: id }, 'El enlace de la factura no cuadra con su huella: no se manda el recordatorio');
      continue;
    }
    const r = await mandarEnlace(id, token, { recordatorio: true, clave: `facturas-colaborador-recordatorio-${id}` });
    if (r?.sent) recordados++;
  }
  return { recordados };
}

/** El último día del mes: prepara el mes y manda a cada uno su enlace. */
export async function prepararYMandar(periodo) {
  const preparados = await prepararMes(periodo);
  let mandados = 0;
  for (const p of preparados) {
    const r = await mandarEnlace(p.facturaId, p.token, { clave: `facturas-colaborador-mes-${p.facturaId}` });
    if (r?.sent) mandados++;
  }
  return { preparados: preparados.length, mandados };
}
