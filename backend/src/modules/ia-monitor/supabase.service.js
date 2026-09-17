import { query } from '../../shared/config/db.js';
import * as conversionModel from '../conversions/conversion.model.js';
import * as integrationsModel from '../integrations/integrations.model.js';
import { decrypt } from '../../shared/utils/crypto.js';
import { logger } from '../../shared/utils/logger.js';
import { AppError } from '../../shared/utils/AppError.js';

/*
  TRAER AL CRM LO QUE LA APP DE IA YA SABE (#44).

  El ticket preguntaba «¿que se trae: solo cobros, o tambien usuarios y
  consumo?». Esto trae LOS PAGOS Y QUIEN LOS HIZO, que es lo minimo para que
  un proyecto IA se comporte como cualquier otra marca: sus clientes en
  Clientes y su dinero en Ventas.

  POR QUE POR AQUI Y NO POR STRIPE

  Stripe sabe que entro un cobro; la app sabe ademas de quien, con que plan, en
  que pais y cuando se dio de baja. Y hoy la clave de Stripe no se puede
  recuperar --los secrets de Supabase vuelven como SHA-256-- mientras que el
  access token si abre la base.

  Cuando haya clave de Stripe, las dos fuentes conviven sin chocar: cada
  suscripcion trae su `stripe_payment_intent_id`, que es por donde se
  reconcilian.
*/

/** El token y la referencia del proyecto, de la integracion guardada. */
async function credenciales(projectId) {
  const row = await integrationsModel.get(projectId, 'supabase');
  if (!row?.encrypted_value) {
    throw new AppError('Este proyecto no tiene Supabase configurado', 400, 'SIN_CREDENCIAL');
  }
  const ref = row.config_public?.project_ref;
  if (!ref) throw new AppError('Falta la referencia del proyecto de Supabase', 400, 'SIN_REF');
  return { token: decrypt(row.encrypted_value, row.iv, row.auth_tag), ref };
}

/**
 * Una consulta contra la base del proyecto, por la Management API.
 *
 * SOLO LECTURA, y se comprueba aqui: por este camino no sale nada que no
 * empiece por SELECT o WITH. El token tiene permiso para mas, y precisamente
 * por eso la puerta se estrecha en el codigo y no en la confianza.
 */
async function consulta(token, ref, sql) {
  if (!/^\s*(select|with)\b/i.test(sql)) {
    throw new AppError('Solo lectura', 400, 'SOLO_LECTURA');
  }
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!r.ok) {
    const cuerpo = (await r.text()).replace(/sbp_[A-Za-z0-9]+/g, 'sbp_***').slice(0, 300);
    throw new AppError(`Supabase HTTP ${r.status}: ${cuerpo}`, 502, 'SUPABASE_ERROR');
  }
  return r.json();
}

/**
 * Lo que se trae: cada suscripcion con su comprador.
 *
 * Se piden las dos tablas juntas y no por separado a proposito: una
 * suscripcion sin email no se puede convertir en cliente, y hacer 23 consultas
 * --una por comprador-- para luego descartar la mitad es peor por los dos
 * lados.
 */
const SQL_SUSCRIPCIONES = `
  SELECT s.id::text          AS id,
         s.plan_type,
         s.status,
         s.amount,
         s.currency,
         s.stripe_payment_intent_id,
         s.stripe_subscription_id,
         s.created_at,
         s.cancelled_at,
         u.email,
         u.full_name,
         u.country_name,
         u.country_code
    FROM subscriptions s
    LEFT JOIN user_profiles u ON u.id = s.user_id
   WHERE s.amount > 0
   ORDER BY s.created_at`;

/** Un vistazo sin escribir nada: que hay al otro lado. */
export async function previo(projectId) {
  const { token, ref } = await credenciales(projectId);
  const filas = await consulta(token, ref, SQL_SUSCRIPCIONES);
  const conEmail = filas.filter((f) => f.email).length;
  // NO SE SUMAN MONEDAS DISTINTAS. Sumar dolares y euros en la misma cifra da
  // un numero que no es nada. Si aparece otra moneda se cuenta aparte y se
  // dice; hoy en Tarot son las 23 en EUR, pero eso no se puede dar por hecho.
  const enEuros = filas.filter((f) => String(f.currency || 'eur').toLowerCase() === 'eur');
  const otraMoneda = filas.length - enEuros.length;
  const total = enEuros.reduce((s, f) => s + Number(f.amount || 0), 0);
  return {
    suscripciones: filas.length,
    conEmail,
    sinEmail: filas.length - conEmail,
    importe: Number(total.toFixed(2)),
    otraMoneda,
    desde: filas[0]?.created_at || null,
    hasta: filas[filas.length - 1]?.created_at || null,
    // Cuantas traen referencia de Stripe: son las que se podran reconciliar el
    // dia que haya clave.
    conReferenciaStripe: filas.filter((f) => f.stripe_payment_intent_id || f.stripe_subscription_id).length,
  };
}

/** El nombre del plan, como lo entiende el CRM. */
function producto(plan) {
  if (plan === 'monthly') return 'Suscripcion mensual';
  if (plan === 'annual') return 'Suscripcion anual';
  if (plan === 'single') return 'Consulta suelta';
  return plan || 'Suscripcion';
}

/**
 * Traer las suscripciones al CRM: un cliente por comprador y una venta por
 * suscripcion.
 *
 * IDEMPOTENTE POR EL ID DE LA SUSCRIPCION. Se guarda en `notas_pago` con una
 * marca reconocible y se comprueba antes de crear: pulsar dos veces no duplica
 * nada. Sin eso, cada sincronizacion volveria a crear las 23 y el mes no
 * pararia de subir.
 */
export async function importar(projectId, { soloProbar = false, usuarioId = null } = {}) {
  const { token, ref } = await credenciales(projectId);
  const filas = await consulta(token, ref, SQL_SUSCRIPCIONES);

  let clientesNuevos = 0;
  let ventasNuevas = 0;
  let yaEstaban = 0;
  let sinEmail = 0;
  let otraMoneda = 0;

  for (const f of filas) {
    if (!f.email) { sinEmail++; continue; }
    const marca = `[supabase:${f.id}]`;

    const { rows: repetida } = await query(
      `SELECT id FROM conversions WHERE project_id = $1 AND notas_pago LIKE $2 LIMIT 1`,
      [projectId, `%${marca}%`]
    );
    if (repetida.length) { yaEstaban++; continue; }
    // Otra moneda: no se convierte a euros a ojo. Se cuenta y se deja fuera.
    if (String(f.currency || 'eur').toLowerCase() !== 'eur') { otraMoneda++; continue; }
    if (soloProbar) { ventasNuevas++; continue; }

    // El cliente: por email dentro del proyecto. Si ya existe, se reutiliza.
    const { rows: existente } = await query(
      `SELECT id FROM leads WHERE project_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1`,
      [projectId, f.email]
    );
    let leadId = existente[0]?.id;
    if (!leadId) {
      const { rows } = await query(
        // `pais_fiscal` y no `pais`: esa columna no existe en esta base. La
        // fecha de entrada se pone igual que la de la suscripcion --si no, el
        // CRM rechaza la venta por ser anterior al alta del prospecto--.
        `INSERT INTO leads (project_id, nombre, email, status, pais_fiscal, created_at, fecha_solicitud)
         VALUES ($1, $2, $3, 'nuevo', $4, $5, $5) RETURNING id`,
        [projectId, f.full_name || f.email.split('@')[0], f.email, f.country_name || null, f.created_at]
      );
      leadId = rows[0].id;
      clientesNuevos++;
    }

    /*
      LA VENTA SE CREA POR EL MODELO, NO A MANO.

      El primer intento escribia el INSERT aqui, y eso se lleva por delante
      tres cosas que el modelo hace y que no se ven:

        · EL IVA. `conversions.iva_incluido` tiene DEFAULT false, o sea «sumale
          el IVA al precio». El modelo pone true cuando nadie dice lo
          contrario, que es lo correcto --el precio de una suscripcion ya lo
          lleva-- y ademas calcula base e importe. Sin eso, una de 9,99 EUR se
          facturaba a 12,09: dinero inventado, en cada fila.
        · LA TRANSACCION. Venta y cobro son dos escrituras que tienen que
          cuadrar. Sueltas, si fallaba la segunda, la venta quedaba ya marcada
          como importada y su cobro no se creaba NUNCA --las siguientes vueltas
          la cuentan como «ya estaba»--.
        · EL LEAD. El modelo lo pasa a «convertido» y apunta el cambio en el
          historial. Escribiendo la venta a mano, un cliente que ya existia se
          quedaba en su estado viejo y la tasa de cierre dejaba de cuadrar con
          Ventas.
    */
    const importe = Number(f.amount || 0);
    await conversionModel.create({
      lead_id: leadId,
      project_id: projectId,
      producto_contratado: producto(f.plan_type),
      importe_total: importe,
      importe_pagado: importe,
      metodo_pago: 'tarjeta',
      metodo_pago_inicial: 'tarjeta',
      fecha_conversion: String(f.created_at).slice(0, 10),
      notas_pago: `Importado de Supabase ${marca}${f.stripe_payment_intent_id ? ` stripe:${f.stripe_payment_intent_id}` : ''}`,
      // QUIEN LO HIZO. El modelo apunta el cambio de estado del lead en
      // `lead_status_history`, y esa tabla exige `changed_by`: sin pasarlo, la
      // importacion entera se caia con un NOT NULL a la primera fila. Ademas
      // es lo correcto —el historial tiene que decir quien lo movio— y con un
      // importe de por medio, mas.
      changed_by: usuarioId,
    });
    ventasNuevas++;
  }

  logger.info({ projectId, ventasNuevas, clientesNuevos, yaEstaban, sinEmail, otraMoneda, soloProbar },
    'Supabase IA: importacion');
  return { suscripciones: filas.length, ventasNuevas, clientesNuevos, yaEstaban, sinEmail, otraMoneda, soloProbar };
}
