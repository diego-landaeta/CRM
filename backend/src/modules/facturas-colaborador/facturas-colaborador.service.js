import { getClient } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/AppError.js';
import * as model from './facturas-colaborador.model.js';

/*
  Facturas de colaboradores (#202) · la lista de colaboradores.

  Quién ve qué (Diego, 07/10): el super admin, todo; un admin, solo los
  colaboradores que facturan a su empresa, y de ellos solo lo de su empresa.
  «Su empresa» son las empresas de sus campus, el mismo criterio que la #245
  (`ambito.js`). Se comprueba aquí, en el servidor, no en la pantalla.
*/

/** Las empresas que ve esta persona: `null` = todas. */
export async function ambitoDe(user) {
  if (user?.role === 'superadmin') return null;
  return model.empresasDeLosCampus(user.userId);
}

const NO_ESTA = () => new AppError('Colaborador no encontrado', 404, 'NOT_FOUND');

function comprobarEmpresas(empresas, ambito) {
  const repetidas = new Set();
  for (const e of empresas) {
    if (repetidas.has(e.issuer_id)) {
      throw new AppError('Has elegido la misma empresa dos veces', 400, 'VALIDATION_ERROR');
    }
    repetidas.add(e.issuer_id);
    if (ambito && !ambito.includes(e.issuer_id)) {
      throw new AppError('Solo puedes elegir empresas de tus campus', 403, 'FORBIDDEN');
    }
  }
}

async function comprobarUsuario(userId) {
  if (userId && !(await model.existeUsuario(userId))) {
    throw new AppError('El usuario del CRM elegido no existe', 400, 'VALIDATION_ERROR');
  }
}

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

export async function empresas(user) {
  return model.empresas(await ambitoDe(user));
}

export async function listar(user, filtros) {
  const ambito = await ambitoDe(user);
  if (filtros.issuerId && ambito && !ambito.includes(filtros.issuerId)) {
    throw new AppError('Esa empresa no es de tus campus', 403, 'FORBIDDEN');
  }
  return model.listar({ issuerIds: ambito, ...filtros });
}

export async function ver(user, id) {
  const c = await model.porId(id, await ambitoDe(user));
  if (!c) throw NO_ESTA();
  return c;
}

export async function crear(user, datos, ip) {
  const ambito = await ambitoDe(user);
  comprobarEmpresas(datos.empresas, ambito);
  await comprobarUsuario(datos.user_id);

  const id = await enTransaccion(async (db) => {
    const nuevo = await model.insertar(db, datos, user.userId);
    for (const e of datos.empresas) await model.ponerEmpresa(db, nuevo, e.issuer_id, e.importe_acordado);
    await model.anotar(db, {
      colaboradorId: nuevo, evento: 'alta', userId: user.userId, ip,
      detalle: {
        nombre: datos.nombre, email: datos.email, area: datos.area,
        empresas: datos.empresas, alta_desde: datos.alta_desde ?? null,
      },
    });
    return nuevo;
  });
  return model.porId(id, ambito);
}

/** Lo que cambia en un campo, para el registro: antes y después. */
function diferencias(antes, cambios) {
  const salida = {};
  for (const [k, v] of Object.entries(cambios)) {
    if (k === 'empresas') continue;
    const viejo = antes[k] ?? null;
    if (String(viejo) !== String(v ?? null)) salida[k] = { antes: viejo, despues: v ?? null };
  }
  return salida;
}

export async function editar(user, id, cambios, ip) {
  const ambito = await ambitoDe(user);
  const antes = await model.porId(id, ambito);
  if (!antes) throw NO_ESTA();
  if (cambios.empresas) comprobarEmpresas(cambios.empresas, ambito);
  if ('user_id' in cambios) await comprobarUsuario(cambios.user_id);

  // `alta_desde` llega como «2026-09-01» y se guarda así; en la ficha sale «2026-09».
  const comparables = { ...antes, alta_desde: antes.alta_desde ? `${antes.alta_desde}-01` : null };
  const detalle = diferencias(comparables, cambios);

  await enTransaccion(async (db) => {
    await model.actualizar(db, id, cambios);

    if (cambios.empresas) {
      // Un admin solo toca las empresas de sus campus: las demás se quedan
      // como estaban, aunque no las vea.
      const todas = await model.empresasDe(id, db);
      const mias = ambito ? todas.filter((e) => ambito.includes(e.issuer_id)) : todas;
      const nuevas = new Map(cambios.empresas.map((e) => [e.issuer_id, e.importe_acordado ?? null]));

      for (const e of mias) {
        if (!nuevas.has(e.issuer_id)) await model.quitarEmpresa(db, id, e.issuer_id);
      }
      for (const [issuerId, importe] of nuevas) await model.ponerEmpresa(db, id, issuerId, importe);

      const despues = await model.empresasDe(id, db);
      if (!despues.length) {
        throw new AppError('Elige al menos una empresa a la que factura', 400, 'VALIDATION_ERROR');
      }
      const clave = (l) => JSON.stringify(l.filter((e) => !ambito || ambito.includes(e.issuer_id)));
      if (clave(todas) !== clave(despues)) {
        detalle.empresas = { antes: JSON.parse(clave(todas)), despues: JSON.parse(clave(despues)) };
      }
    }

    if (Object.keys(detalle).length) {
      await model.anotar(db, { colaboradorId: id, evento: 'cambio', userId: user.userId, ip, detalle });
    }
  });
  return model.porId(id, ambito);
}

export async function darDeBaja(user, id, desde, ip) {
  const ambito = await ambitoDe(user);
  const c = await model.porId(id, ambito);
  if (!c) throw NO_ESTA();
  if (!c.activo) throw new AppError('Este colaborador ya está de baja', 409, 'CONFLICT');

  await enTransaccion(async (db) => {
    await model.darDeBaja(db, id, desde);
    await model.anotar(db, { colaboradorId: id, evento: 'baja', userId: user.userId, ip, detalle: { desde } });
  });
  return model.porId(id, ambito);
}

export async function registro(user, id) {
  const ambito = await ambitoDe(user);
  if (!(await model.porId(id, ambito))) throw NO_ESTA();
  return model.registroDe(id, ambito);
}
