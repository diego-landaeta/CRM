import { AppError } from '../../shared/utils/AppError.js';
import { logger } from '../../shared/utils/logger.js';
import { certifex, conLoDelCrm } from './certifex.emisiones.js';
import * as model from './certifex.model.js';
import { programasPara, datosDeCandidato } from './certifex.programa.js';
import {
  listarSolicitudesSchema, listarDiplomasSchema, porAvisarSchema, aprobarEmitirSchema, rechazarSchema, emitirDiplomasSchema,
  avisosSchema, avisosRechazoSchema, revocarSchema, corregirSchema,
} from './certifex.validation.js';

/**
 * Certifex · Diplomas (#272): las solicitudes que los alumnos hacen desde Moodle y
 * los diplomas ya emitidos, desde el CRM.
 *
 * Decisiones del usuario (08/10) que mandan aqui:
 *  · SIN DNI: el alumno solo escribe su nombre, y es el que se imprime. El panel lo
 *    ensena destacado junto al de Moodle para revisarlo antes de aprobar.
 *  · Emitir NO avisa. El correo al alumno sale solo cuando una persona del CRM lo
 *    aprueba, en un paso aparte (`avisos`), despues de ver el PDF.
 *  · Un nombre mal escrito se CORRIGE (mismo numero, auditado), no se revoca y reemite.
 *
 * Quien actua ante Certifex (decididoPor, emitidaPor, aprobadoPor, revocadaPor,
 * corregidoPor) es SIEMPRE el usuario con sesion; lo que diga el cuerpo se ignora.
 * Todo esto es solo de administracion (ver certifex.routes.js).
 */

function parsear(schema, datos) {
  const r = schema.safeParse(datos);
  if (!r.success) throw new AppError(r.error.errors[0].message, 400, 'VALIDATION_ERROR');
  return r.data;
}

const quien = (req) => req.user.email;

// ─────────────────────────────────────────────── recorrer paginas de Certifex

/** Lo mas grande que da Certifex por pagina, y hasta donde se recorre (10 000 filas). */
const TAM_CERTIFEX = 200;
const MAX_PAGINAS = 50;

/** El dia (AAAA-MM-DD) de una fecha, en hora de Madrid: «hoy» es el de la oficina. */
export function diaDe(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}

/**
 * Recorre un listado de Certifex pagina a pagina, quedandose con lo que pasa `filtro`.
 *
 * Certifex no filtra por fechas ni (en diplomas) por curso, pero ordena lo mas
 * reciente primero —solicitudes por fecha de solicitud, diplomas por fecha de
 * emision—: con un `desde`, en cuanto aparece algo anterior se deja de pedir.
 */
async function recorrer(ruta, params, { filtro = () => true, parar = () => false } = {}) {
  const filas = [];
  for (let p = 1; p <= MAX_PAGINAS; p++) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    qs.set('pagina', String(p));
    qs.set('tam', String(TAM_CERTIFEX));
    const d = await certifex('GET', `${ruta}?${qs.toString()}`);
    const lote = Array.isArray(d?.filas) ? d.filas : [];
    for (const f of lote) {
      if (parar(f, filas)) return { filas, truncado: false };
      if (filtro(f)) filas.push(f);
    }
    if (lote.length < TAM_CERTIFEX || p * TAM_CERTIFEX >= Number(d?.total ?? 0)) return { filas, truncado: false };
  }
  return { filas, truncado: true };
}

/**
 * Un listado del panel. Sin filtros propios del CRM se pide la pagina tal cual; con
 * fechas, curso (en diplomas), estado del aviso o `todo=1` (exportar) se recorre y se
 * pagina aqui.
 */
async function listado(ruta, params, f, { fecha, extra = null }) {
  const pagina = f.pagina ?? 1;
  const tam = f.tam ?? 50;
  const conFechas = !!(f.desde || f.hasta);
  if (!conFechas && !extra && f.todo !== '1') {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    qs.set('pagina', String(pagina));
    qs.set('tam', String(tam));
    const d = await certifex('GET', `${ruta}?${qs.toString()}`);
    return { filas: Array.isArray(d?.filas) ? d.filas : [], total: Number(d?.total ?? 0), pagina, tam, truncado: false };
  }
  const enRango = (row) => {
    if (!conFechas) return true;
    const d = diaDe(fecha(row));
    if (!d) return false;
    return (!f.desde || d >= f.desde) && (!f.hasta || d <= f.hasta);
  };
  const r = await recorrer(ruta, params, {
    filtro: (row) => enRango(row) && (!extra || extra(row)),
    // Lo de antes de `desde` ya no puede entrar: lo que sigue es aun mas antiguo.
    parar: (row) => {
      if (!f.desde) return false;
      const d = diaDe(fecha(row));
      return !!d && d < f.desde;
    },
  });
  if (f.todo === '1') return { filas: r.filas, total: r.filas.length, pagina: 1, tam: r.filas.length, truncado: r.truncado };
  return { filas: r.filas.slice((pagina - 1) * tam, pagina * tam), total: r.filas.length, pagina, tam, truncado: r.truncado };
}

// ─────────────────────────────────────────────── solicitudes

/**
 * Las solicitudes de diploma (lo que el alumno pidio desde Moodle), por estado.
 * Cada fila trae lo que el CRM sabe de ese correo (`crm`) y, en las rechazadas, el
 * aviso de rechazo que ya se aprobo (`avisoRechazo`).
 */
export async function solicitudes(req, res, next) {
  try {
    const f = parsear(listarSolicitudesSchema, req.query);
    const data = await listado('/candidatos', {
      estado: f.estado ?? 'pendiente', solicitadas: '1', centro: f.centro?.toUpperCase(), curso: f.curso, q: f.q,
    }, f, { fecha: (c) => c?.solicitud?.en });
    await conLoDelCrm(data.filas, req.user);
    await conAvisoRechazo(data.filas);
    if ((f.estado ?? 'pendiente') !== 'rechazada') await conProgramaCrm(data.filas);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/**
 * El programa que se imprimiria si se emite ahora (`programaCrm`): el de la formacion
 * vendida, o null con el motivo. Es lo que se revisa antes de aprobar.
 */
async function conProgramaCrm(filas) {
  const sinTitulo = filas.filter((c) => !c.nexpediente);
  for (const c of filas) c.programaCrm = null;
  const m = await programasPara(sinTitulo.map(datosDeCandidato));
  for (const c of sinTitulo) c.programaCrm = m.get(c.matriculaId) ?? null;
}

async function conAvisoRechazo(filas) {
  const rechazadas = filas.filter((c) => c?.decision?.decision === 'rechazada').map((c) => c.matriculaId);
  for (const c of filas) c.avisoRechazo = null;
  if (!rechazadas.length) return;
  try {
    const m = await model.avisosRechazoDe(rechazadas);
    for (const c of filas) c.avisoRechazo = m.get(c.matriculaId) ?? null;
  } catch (e) {
    // El listado sale igual: no saber si se aviso no puede bloquear el panel.
    logger.warn({ err: e.message }, 'Certifex: no se pudo leer el aviso de rechazo');
  }
}

/**
 * Lo que espera a una persona DESPUES de aprobar, dentro de las solicitudes:
 *  · `porAvisar`: con diploma emitido y vigente, y ningun aviso aprobado todavia.
 *    Es el «pendiente de aviso»: ver el PDF y, si esta bien, enviarlo al alumno.
 *  · `sinEmitir`: aprobadas sin diploma (la emision fallo o se corto). Se reintenta.
 */
async function despuesDeAprobar({ centro, q }) {
  const aprobadas = await recorrer('/candidatos', { estado: 'aprobada', solicitadas: '1', centro, q });
  const conTitulo = aprobadas.filas.filter((c) => c.nexpediente);
  const sinEmitir = aprobadas.filas.filter((c) => !c.nexpediente);
  if (!conTitulo.length) return { porAvisar: [], sinEmitir, truncado: aprobadas.truncado };

  const buscados = new Set(conTitulo.map((c) => c.nexpediente));
  // Un diploma de una solicitud se emite despues de pedirlo: lo de antes de la
  // solicitud mas antigua (con un dia de margen) ya no puede ser de ninguna.
  const masAntigua = conTitulo.reduce((m, c) => (c.solicitud?.en && (!m || c.solicitud.en < m) ? c.solicitud.en : m), null);
  const limite = masAntigua ? new Date(new Date(masAntigua).getTime() - 86_400_000).toISOString() : null;
  const diplomas = await recorrer('/diplomas', { estado: 'vigentes', centro }, {
    filtro: (d) => buscados.has(d.nexpediente),
    parar: (d, hallados) => hallados.length >= buscados.size || (!!limite && !!d.emitidoEn && d.emitidoEn < limite),
  });
  const porExp = new Map(diplomas.filas.map((d) => [d.nexpediente, d]));
  const porAvisar = conTitulo
    .map((c) => ({ ...c, diploma: porExp.get(c.nexpediente) ?? null }))
    .filter((c) => c.diploma && !c.diploma.aviso);
  return { porAvisar, sinEmitir, truncado: aprobadas.truncado || diplomas.truncado };
}

export async function porAvisar(req, res, next) {
  try {
    const f = parsear(porAvisarSchema, req.query);
    const data = await despuesDeAprobar({ centro: f.centro?.toUpperCase(), q: f.q });
    await conLoDelCrm([...data.porAvisar, ...data.sinEmitir], req.user);
    await conProgramaCrm(data.sinEmitir);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** Los contadores de arriba del panel, de un campus o de todos. */
export async function resumen(req, res, next) {
  try {
    const centro = parsear(porAvisarSchema, req.query).centro?.toUpperCase();
    const total = async (ruta, params) => {
      const qs = new URLSearchParams({ ...params, pagina: '1', tam: '1' });
      if (centro) qs.set('centro', centro);
      const d = await certifex('GET', `${ruta}?${qs.toString()}`);
      return Number(d?.total ?? 0);
    };
    const [pendientes, rechazadas, vigentes, revocados, despues] = await Promise.all([
      total('/candidatos', { estado: 'pendiente', solicitadas: '1' }),
      total('/candidatos', { estado: 'rechazada', solicitadas: '1' }),
      total('/diplomas', { estado: 'vigentes' }),
      total('/diplomas', { estado: 'revocados' }),
      despuesDeAprobar({ centro }),
    ]);
    res.json({
      success: true,
      data: {
        pendientes, rechazadas, vigentes, revocados,
        porAvisar: despues.porAvisar.length,
        sinEmitir: despues.sinEmitir.length,
      },
    });
  } catch (err) { next(err); }
}

/**
 * Lo que hace falta para buscar el programa de cada matricula: primero lo que guardo el
 * CRM al recibir la solicitud; lo que falte, de Certifex (lo mas reciente primero).
 */
async function datosPara(ids) {
  const datos = await model.datosDeSolicitudes(ids).catch(() => new Map());
  const faltan = new Set(ids.filter((id) => !datos.has(id)));
  if (faltan.size) {
    const r = await recorrer('/candidatos', { estado: 'todas' }, {
      filtro: (c) => faltan.has(c.matriculaId),
      parar: (_c, hallados) => hallados.length >= faltan.size,
    });
    for (const c of r.filas) datos.set(c.matriculaId, datosDeCandidato(c));
  }
  return datos;
}

/**
 * Emite con el programa oficial de la formacion vendida, si se encuentra sin dudas. Lo
 * que no lo tiene se emite igual (con lo de Moodle) y se marca con `sinPrograma`.
 * Devuelve los resultados por matricula, o el error si la llamada entera fallo.
 */
async function emitirConPrograma(req, ids, datos) {
  const programas = await programasPara(ids.map((id) => datos.get(id)).filter(Boolean));
  const items = ids.map((matriculaId) => {
    const p = programas.get(matriculaId)?.programa;
    return p ? { matriculaId, programa: p } : { matriculaId };
  });
  const marca = (r) => {
    const p = programas.get(r.matriculaId);
    return p?.programa
      ? { programa: { horas: p.programa.horas ?? null, modulos: p.programa.modulos.length, formacion: p.formacion?.nombre ?? null } }
      : { sinPrograma: p?.motivo ?? 'No se encontró la matrícula para buscar su venta.' };
  };
  try {
    const em = await certifex('POST', '/emitir', { items, emitidaPor: quien(req) }, { timeoutMs: 180_000 });
    return { porId: new Map((em?.resultados ?? []).map((r) => [r.matriculaId, { ...r, ...marca(r) }])), error: null };
  } catch (e) {
    return { porId: new Map(), error: e.message };
  }
}

/**
 * «Aprobar y emitir», en un paso: el visto bueno y la emision, con el programa oficial de
 * la formacion vendida. NO avisa al alumno: el diploma queda «pendiente de aviso» hasta
 * que alguien lo vea y lo envie.
 *
 * Si la aprobacion sale y la emision falla, la matricula queda aprobada sin diploma
 * (sale en «Aprobados sin diploma» para reintentar) y se dice asi, no como un fallo
 * de todo.
 */
export async function aprobarEmitir(req, res, next) {
  try {
    const { matriculaIds } = parsear(aprobarEmitirSchema, req.body);
    // Antes de decidir: la busqueda en Certifex es la misma y no depende del estado.
    const datos = await datosPara(matriculaIds);
    const dec = await certifex('POST', '/decisiones', {
      decisiones: matriculaIds.map((matriculaId) => ({ matriculaId, decision: 'aprobada', decididoPor: quien(req) })),
    });
    const fallidas = new Map((dec?.resultados ?? []).filter((r) => !r.ok).map((r) => [r.matriculaId, r.error || 'No se pudo aprobar']));
    const aEmitir = matriculaIds.filter((id) => !fallidas.has(id));
    const { porId, error } = aEmitir.length ? await emitirConPrograma(req, aEmitir, datos) : { porId: new Map(), error: null };

    const resultados = matriculaIds.map((matriculaId) => {
      if (fallidas.has(matriculaId)) return { matriculaId, ok: false, fase: 'aprobar', error: fallidas.get(matriculaId) };
      const r = porId.get(matriculaId);
      if (r) return { ...r, matriculaId, fase: 'emitir', ...(r.ok ? {} : { error: `Aprobada, pero sin diploma: ${r.error || 'error al emitir'}` }) };
      return { matriculaId, ok: false, fase: 'emitir', error: `Aprobada, pero sin diploma: ${error || 'Certifex no contestó por esta matrícula'}` };
    });
    logger.info({ userId: req.user.userId, n: matriculaIds.length, ok: resultados.filter((r) => r.ok).length }, 'Certifex: aprobar y emitir');
    res.json({ success: true, data: { resultados } });
  } catch (err) { next(err); }
}

/** Emitir lo ya aprobado (reintento de «Aprobados sin diploma»), tambien con su programa. */
export async function emitir(req, res, next) {
  try {
    const { matriculaIds } = parsear(emitirDiplomasSchema, req.body);
    const datos = await datosPara(matriculaIds);
    const { porId, error } = await emitirConPrograma(req, matriculaIds, datos);
    if (error && porId.size === 0) throw new AppError(error, 502, 'CERTIFEX_ERROR');
    const resultados = matriculaIds.map((matriculaId) => porId.get(matriculaId) ?? { matriculaId, ok: false, error: 'Certifex no contestó por esta matrícula' });
    res.json({ success: true, data: { resultados } });
  } catch (err) { next(err); }
}

/** Rechazar con motivo (obligatorio). No avisa: el aviso de rechazo es otro paso. */
export async function rechazar(req, res, next) {
  try {
    const { matriculaIds, motivo } = parsear(rechazarSchema, req.body);
    const data = await certifex('POST', '/decisiones', {
      decisiones: matriculaIds.map((matriculaId) => ({ matriculaId, decision: 'rechazada', motivo, decididoPor: quien(req) })),
    });
    logger.info({ userId: req.user.userId, n: matriculaIds.length }, 'Certifex: solicitudes rechazadas');
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/**
 * «Enviar diploma al alumno»: aprueba el aviso por correo de diplomas ya emitidos.
 * Si el servidor de Certifex tiene el correo apagado, `correoActivo` llega a false y
 * el panel lo dice: queda aprobado, pero el correo no ha salido.
 */
export async function avisos(req, res, next) {
  try {
    const { nexpedientes } = parsear(avisosSchema, req.body);
    const data = await certifex('POST', '/avisos', { nexpedientes, aprobadoPor: quien(req) }, { timeoutMs: 120_000 });
    logger.info({ userId: req.user.userId, n: nexpedientes.length, correoActivo: data?.correoActivo }, 'Certifex: avisos de diploma aprobados');
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** «Enviar aviso de rechazo»: aprueba el correo con el motivo. Se apunta aqui quien y cuando. */
export async function avisosRechazo(req, res, next) {
  try {
    const { matriculaIds } = parsear(avisosRechazoSchema, req.body);
    const data = await certifex('POST', '/avisos-rechazo', { matriculaIds, aprobadoPor: quien(req) }, { timeoutMs: 120_000 });
    try {
      await model.registrarAvisosRechazo(data?.resultados ?? [], quien(req));
    } catch (e) {
      logger.warn({ err: e.message }, 'Certifex: no se pudo apuntar el aviso de rechazo');
    }
    logger.info({ userId: req.user.userId, n: matriculaIds.length, correoActivo: data?.correoActivo }, 'Certifex: avisos de rechazo aprobados');
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────── diplomas emitidos

const AVISO = {
  pendiente: (d) => !d.aviso,
  enviado: (d) => d.aviso?.resultado === 'enviado',
  no_salio: (d) => !!d.aviso && d.aviso.resultado !== 'enviado',
};

/** Los diplomas emitidos: vigentes (pestaña Enviados) o revocados, con su aviso. */
export async function diplomas(req, res, next) {
  try {
    const f = parsear(listarDiplomasSchema, req.query);
    const filtros = [];
    if (f.curso !== undefined) filtros.push((d) => Number(d.cursoRef) === f.curso);
    if (f.aviso) filtros.push(AVISO[f.aviso]);
    const data = await listado('/diplomas', {
      estado: f.estado ?? 'vigentes', centro: f.centro?.toUpperCase(), q: f.q,
    }, f, { fecha: (d) => d?.emitidoEn, extra: filtros.length ? (d) => filtros.every((fn) => fn(d)) : null });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** Revocar con motivo. La verificacion publica pasa a decir «revocado». No avisa a nadie. */
export async function revocar(req, res, next) {
  try {
    const d = parsear(revocarSchema, req.body);
    const data = await certifex('POST', '/revocar', { nexpediente: d.nexpediente, motivo: d.motivo, revocadaPor: quien(req) });
    logger.info({ userId: req.user.userId, nexpediente: d.nexpediente }, 'Certifex: diploma revocado');
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** Corregir el nombre (o la titulacion): mismo numero y mismo QR, queda quien y por que. */
export async function corregir(req, res, next) {
  try {
    const d = parsear(corregirSchema, req.body);
    const data = await certifex('POST', '/corregir', {
      nexpediente: d.nexpediente, campo: d.campo, valor: d.valor, motivo: d.motivo, corregidoPor: quien(req),
    });
    logger.info({ userId: req.user.userId, nexpediente: d.nexpediente, campo: d.campo }, 'Certifex: diploma corregido');
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
