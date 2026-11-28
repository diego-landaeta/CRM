import { AppError } from '../../shared/utils/AppError.js';

/**
 * Cuándo se puede borrar un cobro. UNA sola regla para «Eliminar pago»
 * (`deletePayment`) y «Deshacer el pago» de una cuota (`unpay`), y la misma que
 * enseña la pantalla antes de pulsar (CRM#1228 + CRM#1230, gemelas
 * CRM-ISEIE#856 + #858; se unificaron por chocar).
 *
 * Las claves ajenas de la factura y de la cuota hacia el cobro son ON DELETE
 * SET NULL: al borrar el cobro la factura se quedaba huérfana, y el CRM la
 * volvía a enganchar sola al cobro del mismo importe más cercano. Por eso:
 *
 *   · Sin factura, con proforma o con la factura cancelada → se puede.
 *   · Con la factura ANULADA y sus abonos vivos dejándola a cero → se puede.
 *     «Anular» (CRM#793) no la pasa a cancelada: le pone `anulada_at` y emite un
 *     abono por lo que quede. Ese cobro ya no tiene factura que lo respalde. La
 *     factura y el abono no se tocan (son documentos emitidos): solo se suelta
 *     su enlace al cobro.
 *   · Con una factura vigente → 409: se anula antes.
 *   · Anulada sin llegar a cero → 409 con lo que falta.
 *   · En borrador → 409: un borrador no se anula, se edita o se cancela.
 *   · Con una comisión de tutor ya pagada → 409: la clave ajena es ON DELETE
 *     CASCADE (migración 124) y se llevaría por delante una liquidación hecha.
 */

/** Cada factura con lo que le queda tras sus abonos vivos (cobro y venta). */
const FACTURA_CON_SALDO = `
  SELECT i.id, i.codigo, i.tipo, i.estado, i.numero,
         i.anulada_at IS NOT NULL AS anulada,
         ROUND(i.total + COALESCE((SELECT SUM(r.total) FROM invoices r
                                    WHERE r.rectifica_id = i.id AND r.tipo = 'rectificativa'
                                      AND r.estado <> 'cancelada'), 0), 2)::float8 AS saldo
    FROM invoices i`;

/** SQL de las facturas del cobro que cuentan, con lo que les queda tras sus abonos. */
export const FACTURAS_DEL_COBRO = (pago) => `${FACTURA_CON_SALDO}
   WHERE i.payment_id = ${pago} AND i.tipo <> 'proforma' AND i.estado <> 'cancelada'`;

/** ¿Tiene el cobro una comisión de tutor ya liquidada? */
export const COMISION_TUTOR_PAGADA = (pago) =>
  `EXISTS (SELECT 1 FROM tutor_commissions tc WHERE tc.payment_id = ${pago} AND tc.estado = 'pagada')`;

/**
 * Las dos columnas que necesita la pantalla para decir lo mismo que el
 * servidor (`conBloqueoDelCobro` las convierte). `pago` es la columna del cobro.
 */
export const COLUMNAS_DEL_BLOQUEO = (pago) => `
  (SELECT json_agg(fc) FROM (${FACTURAS_DEL_COBRO(pago)}) fc) AS cobro_facturas,
  ${COMISION_TUTOR_PAGADA(pago)} AS cobro_tutor_pagada`;

/** Anulada y a cero: ya no respalda el cobro. Un abono nunca cuenta como tal. */
export function anuladaACero(f) {
  return !!f && !!f.anulada && f.tipo !== 'rectificativa' && Math.abs(Number(f.saldo) || 0) < 0.005;
}

export const MOTIVO_COMISION_TUTOR =
  'Ese cobro tiene una comisión de tutor ya pagada. Revierte la comisión antes de borrar el cobro.';

/**
 * Por qué no se puede borrar un cobro con estas facturas, o null si se puede.
 * El texto es el que sale en el 409 y en la pantalla.
 */
export function motivoParaNoBorrar(facturas, { comisionTutorPagada = false } = {}) {
  const f = (facturas || []).find((x) => !anuladaACero(x));
  if (f) {
    if (f.estado === 'borrador' || f.numero == null) {
      return `Ese cobro tiene una factura en borrador${f.codigo ? ` (${f.codigo})` : ''}. Edítala o cancélala antes de borrar el cobro.`;
    }
    if (f.tipo === 'rectificativa') {
      return `Ese cobro está enlazado al abono ${f.codigo || ''}, y un abono no se anula: no se puede borrar el cobro.`;
    }
    if (f.anulada) {
      return `La factura ${f.codigo || ''} de ese cobro está anulada, pero sus abonos no la dejan a cero `
        + `(quedan ${Number(f.saldo).toFixed(2)}). Emite el abono que falta antes de borrar el cobro.`;
    }
    return `Ese cobro tiene la factura ${f.codigo || ''}. Anúlala antes de borrar el cobro.`;
  }
  if (comisionTutorPagada) return MOTIVO_COMISION_TUTOR;
  return null;
}

/**
 * Convierte las columnas de COLUMNAS_DEL_BLOQUEO en lo que lee la pantalla:
 * `cobro_bloqueo` (el mismo texto del 409, o null si se puede borrar) y
 * `factura_anulada_a_cero` (todas sus facturas están anuladas y a cero).
 */
export function conBloqueoDelCobro(row) {
  const { cobro_facturas: facturas, cobro_tutor_pagada: tutor, ...resto } = row;
  const lista = Array.isArray(facturas) ? facturas : [];
  return {
    ...resto,
    factura_anulada_a_cero: lista.length > 0 && lista.every(anuladaACero),
    cobro_bloqueo: motivoParaNoBorrar(lista, { comisionTutorPagada: !!tutor }),
  };
}

/**
 * La regla, dentro de la transacción del borrado. Bloquea antes la fila del
 * cobro (FOR UPDATE): una factura que se emite a la vez para este cobro tiene
 * que comprobar su clave ajena contra esa fila, así que o espera a que se borre
 * (y falla) o ya está y se ve aquí. Devuelve las facturas (anuladas a cero)
 * que se quedan sin cobro, para el rastro.
 */
export async function negarSiTieneFactura(client, paymentId) {
  if (!paymentId) return [];
  await client.query('SELECT 1 FROM conversion_payments WHERE id = $1 FOR UPDATE', [paymentId]);
  const { rows } = await client.query(`${FACTURAS_DEL_COBRO('$1')} ORDER BY i.id FOR UPDATE OF i`, [paymentId]);
  const { rows: [t] } = await client.query(`SELECT ${COMISION_TUTOR_PAGADA('$1')} AS pagada`, [paymentId]);
  const motivo = motivoParaNoBorrar(rows, { comisionTutorPagada: !!t?.pagada });
  if (motivo) {
    const porFactura = rows.some((f) => !anuladaACero(f));
    throw new AppError(motivo, 409, porFactura ? 'PAYMENT_HAS_INVOICE' : 'PAYMENT_HAS_PAID_COMMISSION');
  }
  return rows;
}

/**
 * La comisión de la gestora ya pagada NO se rebaja al borrar un cobro: ese
 * dinero ya salió. Se deja como está y se avisa para que se regularice a mano.
 * Devuelve la comisión pagada (o null), con la fila bloqueada.
 */
export async function comisionGestoraPagada(client, conversionId) {
  const { rows: [c] } = await client.query(
    `SELECT id, importe_comision::float8 AS importe, fecha_pago::text AS fecha_pago
       FROM commissions WHERE conversion_id = $1 AND estado = 'pagado' FOR UPDATE`,
    [conversionId]);
  return c || null;
}

export function avisoComisionPagada(c) {
  if (!c) return null;
  return `La comisión de la gestora de esta venta ya está pagada (${Number(c.importe).toFixed(2)} €`
    + `${c.fecha_pago ? `, el ${c.fecha_pago}` : ''}): no se ha rebajado. Regularízala a mano si hace falta.`;
}

/**
 * Rastro del borrado, en la misma transacción: qué cobro era, de cuánto, de
 * qué día, por qué medio, su cargo de Stripe si lo tenía, las facturas que
 * se quedan sin él y quién lo hizo. Sin usuario (un proceso) no se apunta:
 * `user_activity_log.user_id` es obligatorio.
 *
 * Lleva el campus de la venta en `details.project_id`: el Registro recorta
 * por él (registro.model.js, `deUsuarios`). Sin campus, la fila contaba como
 * «de la persona» y la veía un admin de otro campus en el que estuviera quien
 * borró, con el importe, las notas, la referencia y el cargo de Stripe.
 */
export async function apuntarCobroBorrado(client, { paymentId, accion, userId, ip = null, facturas = [], comisionPagada = null }) {
  if (!userId || !paymentId) return;
  const { rows: [p] } = await client.query(
    `SELECT cp.id, cp.conversion_id, cv.project_id, cp.importe::float8 AS importe, cp.fecha::text AS fecha,
            cp.metodo, cp.referencia, cp.notas, cp.origen, cp.origen_ref,
            (SELECT string_agg(ci.numero::text, ', ' ORDER BY ci.numero)
               FROM conversion_installments ci WHERE ci.payment_id = cp.id) AS cuotas,
            COALESCE((SELECT json_agg(json_build_object('stripe_id', sp.stripe_id, 'tipo', sp.type, 'estado', sp.status) ORDER BY sp.id)
                        FROM stripe_payments sp WHERE sp.conversion_payment_id = cp.id), '[]'::json) AS stripe
       FROM conversion_payments cp
       JOIN conversions cv ON cv.id = cp.conversion_id
      WHERE cp.id = $1`,
    [paymentId]);
  if (!p) return;
  const details = {
    accion,
    payment_id: p.id,
    conversion_id: p.conversion_id,
    project_id: p.project_id,
    importe: p.importe,
    fecha: p.fecha,
    metodo: p.metodo,
    referencia: p.referencia,
    notas: p.notas,
    origen: p.origen,
    origen_ref: p.origen_ref,
    stripe: p.stripe,
    facturas: facturas.map((f) => f.codigo).filter(Boolean),
    cuotas: p.cuotas,
    comision_gestora_pagada: comisionPagada ? { id: comisionPagada.id, importe: comisionPagada.importe } : null,
  };
  await client.query(
    `INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES ($1, 'cobro_borrado', $2::jsonb, $3)`,
    [userId, JSON.stringify(details), ip]);
}

/**
 * Todo lo que va antes de borrar un cobro, en su transacción: la regla, la
 * comisión de la gestora pagada y el rastro. Lo llaman los dos caminos.
 */
export async function antesDeBorrarCobro(client, { paymentId, conversionId, accion, userId = null, ip = null }) {
  const facturas = await negarSiTieneFactura(client, paymentId);
  // Sin cobro que borrar, lo cobrado no cambia y la comisión tampoco.
  const comisionPagada = paymentId ? await comisionGestoraPagada(client, conversionId) : null;
  await apuntarCobroBorrado(client, { paymentId, accion, userId, ip, facturas, comisionPagada });
  return { facturas, comisionPagada };
}

/*
  BORRAR LA VENTA ENTERA (CRM#1234, gemela CRM-ISEIE#862).

  `conversion_payments.conversion_id` es ON DELETE CASCADE y en `invoices`
  `payment_id` y `conversion_id` son SET NULL: borrar la venta se llevaba sus
  cobros sin pasar por la regla de arriba y dejaba la factura emitida sin cobro
  y sin venta. Misma regla que para un cobro, pero con todas las facturas de la
  venta (las suyas por `conversion_id` y las de cualquiera de sus cobros):

    · Proformas, canceladas y anuladas a cero no cuentan: se borra como hoy.
    · Una vigente, un borrador o una anulada sin llegar a cero → 409 que dice
      cuáles y qué hacer con cada una.
    · Los abonos (rectificativas) emitidos no deciden: deciden sus facturas.
      Un abono en borrador sí: se quedaría sin venta a medio hacer.

  Y las comisiones ya pagadas, que se irían con la venta por cascada: la del
  tutor (desde el cobro, migración 124) y la de la gestora (desde la venta,
  migración 011). Las dos → 409. La de la gestora no se puede «dejar como
  está» como al borrar un cobro (CRM#1230): con la venta desaparece la fila.
*/

/** SQL de las facturas de la venta que cuentan, con lo que les queda tras sus abonos. */
export const FACTURAS_DE_LA_VENTA = (venta) => `${FACTURA_CON_SALDO}
   WHERE (i.conversion_id = ${venta}
          OR i.payment_id IN (SELECT cp.id FROM conversion_payments cp WHERE cp.conversion_id = ${venta}))
     AND i.tipo <> 'proforma' AND i.estado <> 'cancelada'`;

const enBorrador = (f) => f.estado === 'borrador' || f.numero == null;
const nombreDe = (f) => f.codigo || `en borrador n.º ${f.id}`;
const yLista = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

/** Las facturas que impiden borrar la venta: ni anuladas a cero ni abonos emitidos. */
export function facturasQueImpidenBorrarLaVenta(facturas) {
  return (facturas || []).filter((f) => !anuladaACero(f) && !(f.tipo === 'rectificativa' && !enBorrador(f)));
}

/**
 * Por qué no se puede borrar la venta con estas facturas, o null si se puede.
 * Dice qué facturas son y qué hacer con cada una antes.
 */
export function motivoParaNoBorrarLaVenta(facturas) {
  const pegas = facturasQueImpidenBorrarLaVenta(facturas);
  if (!pegas.length) return null;
  const borradores = pegas.filter(enBorrador);
  const sinCero = pegas.filter((f) => !enBorrador(f) && f.anulada);
  const vigentes = pegas.filter((f) => !enBorrador(f) && !f.anulada);
  const pasos = [];
  if (vigentes.length) pasos.push(`anular ${vigentes.length === 1 ? 'la factura' : 'las facturas'} ${yLista(vigentes.map(nombreDe))}`);
  if (sinCero.length) {
    pasos.push(`emitir el abono que falta de ${yLista(sinCero.map((f) => `${nombreDe(f)} (quedan ${Number(f.saldo).toFixed(2)} €)`))}`);
  }
  if (borradores.length) {
    pasos.push(`cancelar o emitir ${borradores.length === 1 ? 'el borrador' : 'los borradores'} ${yLista(borradores.map(nombreDe))}`);
  }
  const n = pegas.length;
  return `Esta venta tiene ${n === 1 ? 'una factura' : `${n} facturas`} sin anular. `
    + `Antes de borrarla hay que ${yLista(pasos)}.`;
}

/** Comisiones ya pagadas que se irían con la venta, o null. */
export function motivoComisionesDeLaVenta({ tutor = null, gestora = null } = {}) {
  const frases = [];
  if (tutor && tutor.n > 0) {
    const una = tutor.n === 1;
    frases.push(`Esta venta tiene ${una ? 'una comisión de tutor ya pagada' : `${tutor.n} comisiones de tutor ya pagadas`} `
      + `(${Number(tutor.importe).toFixed(2)} €). ${una ? 'Reviértela' : 'Reviértelas'} en Tutores antes de borrar la venta.`);
  }
  if (gestora) {
    frases.push(`La comisión de la gestora de esta venta ya está pagada (${Number(gestora.importe).toFixed(2)} €`
      + `${gestora.fecha_pago ? `, el ${gestora.fecha_pago}` : ''}) y se borraría con ella: `
      + 'no se puede borrar una venta con la comisión ya pagada.');
  }
  return frases.length ? frases.join(' ') : null;
}

/**
 * La regla de la venta. Con `bloquear` (dentro de la transacción del borrado)
 * bloquea antes la venta y sus cobros: una factura o un cobro que se crean a la
 * vez tienen que comprobar su clave ajena contra esas filas y esperan.
 * Sin `bloquear` sirve de comprobación previa, antes de cancelar nada en
 * Stripe o en Moodle y de apuntar la nota en el historial.
 */
export async function negarSiLaVentaNoSeBorra(client, conversionId, { bloquear = false } = {}) {
  if (bloquear) {
    await client.query('SELECT 1 FROM conversions WHERE id = $1 FOR UPDATE', [conversionId]);
    await client.query('SELECT 1 FROM conversion_payments WHERE conversion_id = $1 ORDER BY id FOR UPDATE', [conversionId]);
  }
  const { rows: facturas } = await client.query(
    `${FACTURAS_DE_LA_VENTA('$1')} ORDER BY i.id${bloquear ? ' FOR UPDATE OF i' : ''}`, [conversionId]);
  const motivo = motivoParaNoBorrarLaVenta(facturas);
  if (motivo) throw new AppError(motivo, 409, 'SALE_HAS_INVOICE');

  const { rows: [tutor] } = await client.query(
    `SELECT COUNT(*)::int AS n, COALESCE(SUM(tc.importe), 0)::float8 AS importe
       FROM tutor_commissions tc JOIN conversion_payments cp ON cp.id = tc.payment_id
      WHERE cp.conversion_id = $1 AND tc.estado = 'pagada'`, [conversionId]);
  const { rows: [gestora] } = await client.query(
    `SELECT importe_comision::float8 AS importe, fecha_pago::text AS fecha_pago
       FROM commissions WHERE conversion_id = $1 AND estado = 'pagado'`, [conversionId]);
  const motivoComision = motivoComisionesDeLaVenta({ tutor, gestora });
  if (motivoComision) throw new AppError(motivoComision, 409, 'SALE_HAS_PAID_COMMISSION');
}
