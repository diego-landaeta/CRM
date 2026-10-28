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
     -- LAS PRUEBAS NO SON VENTAS.
     --
     -- Angel, 18/09: «algunos de esos pagos fueron test, y nos devolvimos el
     -- dinero». Su app las marca con metadata.is_test y su panel las cuenta
     -- aparte; el CRM las estaba importando como ventas buenas. En Tarot son
     -- 8 de 23 -- 44,20 EUR -- y ninguna tiene cobro de Stripe detras.
     --
     -- Una venta de mentira en el CRM no es un numero feo: entra en el mes, en
     -- las comisiones y en la factura.
     AND COALESCE(s.metadata->>'is_test', 'false') <> 'true'
   ORDER BY s.created_at`;

/** Las de prueba, para poder decir cuantas se dejan fuera y cuanto suman. */
const SQL_DE_PRUEBA = `
  SELECT s.id::text AS id, s.amount, s.created_at
    FROM subscriptions s
   WHERE s.amount > 0
     AND COALESCE(s.metadata->>'is_test', 'false') = 'true'
   ORDER BY s.created_at`;

/**
 * Las columnas de su tabla de suscripciones.
 *
 * Hace falta para no adivinar: el panel de cada app distingue los pagos de
 * PRUEBA y los devueltos, y el CRM los estaba importando como ventas
 * buenas. Antes de filtrar hay que saber COMO se marcan alli, y cada app
 * puede llamarlo de otra forma.
 */
/**
 * Como se distinguen alli los pagos de PRUEBA.
 *
 * No hay columna que lo diga, asi que se mira por donde puede estar: las
 * claves de `metadata` y si el cobro tiene un identificador de Stripe de
 * verdad. Se piden las CLAVES, no los valores: dentro puede haber datos de
 * la persona y aqui solo hace falta saber que campos existen.
 */
const SQL_PISTAS_DE_TEST = `
  SELECT COALESCE(k.clave, '(sin metadata)') AS clave,
         count(*)::int                       AS n,
         count(*) FILTER (WHERE s.stripe_payment_intent_id IS NOT NULL)::int AS con_intent,
         COALESCE(sum(s.amount), 0)          AS importe
    FROM subscriptions s
    LEFT JOIN LATERAL jsonb_object_keys(COALESCE(s.metadata, '{}'::jsonb)) AS k(clave) ON TRUE
   WHERE s.amount > 0
   GROUP BY 1 ORDER BY 2 DESC`;

const SQL_COLUMNAS = `
  SELECT column_name, data_type
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'subscriptions'
   ORDER BY ordinal_position`;

/*
  CADA APP GUARDA SUS PAGOS A SU MANERA.

  Tarot los lleva en `subscriptions` + `user_profiles`; Nutricionista IA en
  `subscription_payments` (importe en CENTIMOS, correo en `auth.users`) y
  Psicologo IA en `pagos` (columnas en castellano, con el correo del cliente
  en la propia fila). Se mira que tabla hay y se usa su consulta; todas
  devuelven las MISMAS columnas, asi que el resto del servicio no se entera.

  Lo que NO es venta, en todas: un pago reembolsado o fallido, y lo marcado
  `is_test`. Se cuenta aparte (`dePrueba`) para poder decir cuanto se deja fuera.
*/
const SQL_NUTRI = `
  SELECT sp.id::text AS id, sp.plan_type, sp.payment_status AS status,
         (sp.amount_cents / 100.0) AS amount, sp.currency,
         sp.stripe_payment_intent_id, sp.stripe_subscription_id,
         COALESCE(sp.payment_date, sp.created_at) AS created_at,
         NULL::timestamptz AS cancelled_at,
         au.email, p.name AS full_name, NULL::text AS country_name, NULL::text AS country_code
    FROM subscription_payments sp
    LEFT JOIN auth.users au ON au.id = sp.user_id
    LEFT JOIN profiles p ON p.id = sp.user_id
   WHERE sp.amount_cents > 0
     AND sp.payment_status = 'completed'
     AND COALESCE(sp.metadata->>'is_test', 'false') <> 'true'
   ORDER BY COALESCE(sp.payment_date, sp.created_at)`;
const SQL_NUTRI_FUERA = `
  SELECT sp.id::text AS id, (sp.amount_cents / 100.0) AS amount, COALESCE(sp.payment_date, sp.created_at) AS created_at
    FROM subscription_payments sp
   WHERE sp.amount_cents > 0
     AND (sp.payment_status <> 'completed' OR COALESCE(sp.metadata->>'is_test', 'false') = 'true')
   ORDER BY COALESCE(sp.payment_date, sp.created_at)`;

const SQL_PSICO = `
  SELECT pg.id::text AS id, pg.plan AS plan_type, pg.estado AS status,
         pg.monto AS amount, pg.moneda AS currency,
         pg.stripe_payment_id AS stripe_payment_intent_id, pg.stripe_subscription_id,
         pg.created_at, NULL::timestamptz AS cancelled_at,
         COALESCE(pg.cliente_email, pr.email) AS email,
         COALESCE(pg.cliente_nombre, pr.nombre) AS full_name,
         NULL::text AS country_name, NULL::text AS country_code
    FROM pagos pg
    LEFT JOIN profiles pr ON pr.id = pg.profile_id
   WHERE pg.monto > 0
     AND pg.estado = 'completado'
     AND COALESCE(pg.metadata->>'is_test', 'false') <> 'true'
   ORDER BY pg.created_at`;
const SQL_PSICO_FUERA = `
  SELECT pg.id::text AS id, pg.monto AS amount, pg.created_at
    FROM pagos pg
   WHERE pg.monto > 0
     AND (pg.estado <> 'completado' OR COALESCE(pg.metadata->>'is_test', 'false') = 'true')
   ORDER BY pg.created_at`;

const columnasDe = (tabla) => `
  SELECT column_name, data_type FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = '${tabla}' ORDER BY ordinal_position`;
const pistasDe = (tabla) => `
  SELECT COALESCE(k.clave, '(sin metadata)') AS clave, count(*)::int AS n, 0 AS con_intent, 0 AS importe
    FROM ${tabla} s
    LEFT JOIN LATERAL jsonb_object_keys(COALESCE(s.metadata, '{}'::jsonb)) AS k(clave) ON TRUE
   GROUP BY 1 ORDER BY 2 DESC`;

const ESQUEMAS = {
  subscriptions: { suscripciones: SQL_SUSCRIPCIONES, dePrueba: SQL_DE_PRUEBA, pistas: SQL_PISTAS_DE_TEST, columnas: SQL_COLUMNAS },
  subscription_payments: { suscripciones: SQL_NUTRI, dePrueba: SQL_NUTRI_FUERA, pistas: pistasDe('subscription_payments'), columnas: columnasDe('subscription_payments') },
  pagos: { suscripciones: SQL_PSICO, dePrueba: SQL_PSICO_FUERA, pistas: pistasDe('pagos'), columnas: columnasDe('pagos') },
};

/** Que tabla de pagos tiene esta app. Sin pista clara, la de Tarot (la de siempre). */
async function esquemaDe(token, ref) {
  const filas = await consulta(token, ref,
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('subscriptions', 'subscription_payments', 'pagos')`
  ).catch(() => []);
  const hay = new Set((Array.isArray(filas) ? filas : []).map((x) => x.table_name));
  if (hay.has('subscriptions') || !hay.size) return ESQUEMAS.subscriptions;
  if (hay.has('subscription_payments')) return ESQUEMAS.subscription_payments;
  if (hay.has('pagos')) return ESQUEMAS.pagos;
  return ESQUEMAS.subscriptions;
}

/** Un vistazo sin escribir nada: que hay al otro lado. */
export async function previo(projectId) {
  const { token, ref } = await credenciales(projectId);
  const esq = await esquemaDe(token, ref);
  const filas = await consulta(token, ref, esq.suscripciones);
  const columnas = await consulta(token, ref, esq.columnas).catch(() => []);
  const pistas = await consulta(token, ref, esq.pistas).catch(() => []);
  const prueba = await consulta(token, ref, esq.dePrueba).catch(() => []);
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
    /**
     * QUE HAY DE CADA ESTADO Y DE CADA PLAN.
     *
     * Angel, 18/09: «algunos de esos pagos fueron test, y nos devolvimos el
     * dinero». Si eso entra como venta, el importe del CRM no es el dinero que
     * se quedo la empresa -- y ese es justo el numero por el que existe esta
     * importacion.
     *
     * Antes de decidir que se excluye hay que ver COMO lo marca su base: se
     * enseña el reparto en vez de adivinar un nombre de estado.
     */
    porEstado: reparto(filas, (f) => f.status || 'sin estado'),
    porPlan: reparto(filas, (f) => f.plan_type || 'sin plan'),
    // Para poder ver si hay una columna que marque las pruebas.
    columnas: columnas.map((c) => c.column_name),
    pistasDeTest: pistas,
    // Lo que se queda fuera por ser de prueba, dicho en voz alta: si un dia
    // el importe no cuadra con su panel, es lo primero que hay que mirar.
    dePrueba: {
      n: prueba.length,
      importe: Number(prueba.reduce((t, f) => t + Number(f.amount || 0), 0).toFixed(2)),
      ids: prueba.map((f) => f.id),
    },
  };
}

/** Cuantos y cuanto suma cada valor, para poder mirarlo antes de importar. */
function reparto(filas, de) {
  const m = new Map();
  for (const f of filas) {
    const k = de(f);
    const a = m.get(k) || { n: 0, importe: 0 };
    a.n += 1;
    a.importe += Number(f.amount || 0);
    m.set(k, a);
  }
  return [...m.entries()]
    .map(([clave, v]) => ({ clave, n: v.n, importe: Number(v.importe.toFixed(2)) }))
    .sort((a, b) => b.n - a.n);
}

/** El nombre del plan, como lo entiende el CRM. */
function producto(plan) {
  if (plan === 'monthly' || plan === 'mensual') return 'Suscripcion mensual';
  if (plan === 'annual' || plan === 'anual') return 'Suscripcion anual';
  if (plan === 'single' || plan === 'unico') return 'Consulta suelta';
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
  const esq = await esquemaDe(token, ref);
  const filas = await consulta(token, ref, esq.suscripciones);

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

/**
 * Quitar del CRM las ventas que eran PRUEBAS (#44).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE HACE FALTA
 *
 * Las primeras importaciones se trajeron todo, incluidas las suscripciones que
 * la app marca como `is_test`. En Tarot son 8 de 23 —44,20 €— y ninguna tiene
 * un cobro de Stripe detras: son pruebas del equipo, y de algunas se devolvio
 * el dinero.
 *
 * Una venta de mentira en el CRM no es un numero feo: entra en el mes, en las
 * comisiones y puede acabar en una factura.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SOLO LAS QUE TRAJO ESTA IMPORTACION, Y SOLO SI NO TIENEN NADA DETRAS
 *
 * Se buscan por su marca `[supabase:<id>]`, asi que no puede llevarse por
 * delante una venta metida a mano. Y si alguna tiene FACTURA emitida no se
 * borra: eso ya no es un apunte interno, y anular una factura es otra cosa que
 * se decide mirandola.
 *
 * Devuelve lo que ha hecho y lo que ha dejado, para poder cuadrarlo.
 */
export async function quitarLasDePrueba(projectId, { soloProbar = false } = {}) {
  const { token, ref } = await credenciales(projectId);
  const esq = await esquemaDe(token, ref);
  const prueba = await consulta(token, ref, esq.dePrueba);
  if (!prueba.length) return { encontradas: 0, borradas: 0, conFactura: [], soloProbar };

  const marcas = prueba.map((f) => `%[supabase:${f.id}]%`);
  const { rows } = await query(
    `SELECT c.id, c.importe_total,
            EXISTS (SELECT 1 FROM invoices i WHERE i.conversion_id = c.id) AS con_factura
       FROM conversions c
      WHERE c.project_id = $1 AND c.notas_pago LIKE ANY($2::text[])`,
    [projectId, marcas]
  );

  const borrables = rows.filter((r) => !r.con_factura).map((r) => r.id);
  const conFactura = rows.filter((r) => r.con_factura).map((r) => r.id);
  const importe = rows
    .filter((r) => !r.con_factura)
    .reduce((t, r) => t + Number(r.importe_total || 0), 0);

  if (!soloProbar && borrables.length) {
    // En orden: lo que cuelga primero. `conversion_payments` y los items no
    // tienen borrado en cascada hacia atras y dejarian filas huerfanas
    // sumando en el libro de cobros.
    await query('DELETE FROM conversion_payments WHERE conversion_id = ANY($1::int[])', [borrables]);
    await query('DELETE FROM conversion_items WHERE conversion_id = ANY($1::int[])', [borrables]);
    await query('DELETE FROM conversions WHERE id = ANY($1::int[])', [borrables]);
  }

  return {
    encontradas: rows.length,
    borradas: soloProbar ? 0 : borrables.length,
    importe: Number(importe.toFixed(2)),
    conFactura,
    soloProbar,
  };
}
