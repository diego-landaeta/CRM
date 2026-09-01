import { logger } from '../shared/utils/logger.js';
import { query } from '../shared/config/db.js';
import { sendEmail } from '../shared/services/brevo.service.js';
import {
  correo, parrafo, seccion, boton, tarjetas, barras, nota, enlace, esc,
  fichaProspecto, comparar, COLORES_CANAL, T,
} from '../shared/services/email-plantilla.service.js';
import { normalizePhone, phoneCanonical } from '../shared/utils/normalizePhone.js';
import { vigilar } from './latido.js';

/**
 * Los dos avisos de final y principio de jornada, de la tarea #28.
 *
 *   · **Resumen del dia** al cerrar — a la gestora y a administracion.
 *   · **Plan de mañana** por la noche — a la gestora.
 *
 * Van juntos porque comparten todo menos el texto: la misma consulta de a quien
 * avisar, el mismo respeto por quien lo apago y la misma clave de idempotencia.
 * Separarlos habria sido escribir dos veces lo mismo para que se separaran solos
 * el dia que alguien tocara uno.
 *
 * La clave lleva el DIA, al reves que el aviso de prospecto sin contactar. Ahi
 * el aviso es «este lead concreto» y repetirlo seria acosar; aqui es «lo de
 * hoy», y tiene que llegar cada dia. Un reinicio no lo repite, y eso es lo que
 * se quiere.
 */

const HORA_RESUMEN = parseInt(process.env.RESUMEN_HORA || '19', 10);
const HORA_PLAN = parseInt(process.env.PLAN_HORA || '21', 10);
const TICK_MS = parseInt(process.env.RESUMEN_TICK_MS || String(30 * 60 * 1000), 10);

let corriendo = false;

const hoy = () => new Date().toISOString().slice(0, 10);

/** A quien le toca este aviso: gestoras activas que no lo hayan apagado. */
async function destinatarios(aviso, roles) {
  const { rows } = await query(
    // El rol viene porque desde la #81 decide QUE correo se manda: la gestora
    // recibe su lista de trabajo y administracion el estado del equipo.
    `SELECT u.id, u.nombre, u.email, u.role
       FROM users u
      WHERE u.active
        AND u.email IS NOT NULL
        AND u.role = ANY($1)
        AND NOT COALESCE(u.gestor_colaboraciones, false)
        AND NOT EXISTS (
          SELECT 1 FROM avisos_apagados a
           WHERE a.user_id = u.id AND a.aviso = $2
        )
      ORDER BY u.nombre`,
    [roles, aviso]
  );
  return rows;
}

/** Lo que ha pasado hoy con los prospectos de esa persona. */
async function loDeHoy(userId) {
  const { rows } = await query(
    `SELECT
       (SELECT count(*)::int FROM leads
         WHERE responsable_id = $1 AND deleted_at IS NULL
           AND COALESCE(fecha_solicitud, created_at)::date = CURRENT_DATE) AS entraron,
       (SELECT count(*)::int FROM lead_interactions i
          JOIN leads l ON l.id = i.lead_id
         WHERE l.responsable_id = $1 AND i.fecha::date = CURRENT_DATE) AS contactos,
       (SELECT count(*)::int FROM leads
         WHERE responsable_id = $1 AND deleted_at IS NULL
           AND status = 'convertido' AND updated_at::date = CURRENT_DATE) AS convertidos,
       (SELECT count(*)::int FROM leads l
         WHERE l.responsable_id = $1 AND l.deleted_at IS NULL
           AND l.status IN ('nuevo','por_contactar')
           AND NOT EXISTS (SELECT 1 FROM lead_interactions i WHERE i.lead_id = l.id)) AS sin_tocar`,
    [userId]
  );
  return rows[0];
}

/**
 * Los que estan sin contactar, UNO A UNO. Tarea #81.
 *
 * El aviso decia «te quedan 14 sin contactar» y ahi se acababa: para saber
 * cuales habia que abrir el CRM, ir a Prospectos, poner el filtro y buscarlos.
 * O sea que el correo no ahorraba ni un paso, solo avisaba de que habia
 * trabajo — que ya se sabia.
 *
 * Se traen los datos con los que se decide A QUIEN LLAMAR PRIMERO: que pidio,
 * de donde vino y cuanto lleva esperando. El tope existe porque un correo con
 * ochenta fichas no lo lee nadie; el resto se cuenta y se enlaza.
 */
const TOPE_LISTA = 12;

async function sinContactarDetalle(userId, limite = TOPE_LISTA) {
  const { rows } = await query(
    `SELECT l.id, l.nombre, l.telefono, l.email, l.producto_interes, l.status,
            COALESCE(NULLIF(l.canal_detectado, ''), NULLIF(l.utm_source, '')) AS origen,
            COALESCE(l.fecha_solicitud, l.created_at) AS entro,
            p.nombre AS proyecto
       FROM leads l
       LEFT JOIN projects p ON p.id = l.project_id
      WHERE l.responsable_id = $1 AND l.deleted_at IS NULL
        AND l.status IN ('nuevo','por_contactar')
        AND NOT EXISTS (SELECT 1 FROM lead_interactions i WHERE i.lead_id = l.id)
      -- El que mas lleva esperando, primero: es el que mas riesgo tiene de
      -- haberse ido ya a otro sitio.
      ORDER BY COALESCE(l.fecha_solicitud, l.created_at)
      LIMIT $2`,
    [userId, limite]
  );
  return rows;
}

/** Lo mismo de ayer, para poder comparar. Un numero solo no dice nada. */
async function loDeAyer(userId) {
  const { rows } = await query(
    `SELECT
       (SELECT count(*)::int FROM leads
         WHERE responsable_id = $1 AND deleted_at IS NULL
           AND COALESCE(fecha_solicitud, created_at)::date = CURRENT_DATE - 1) AS entraron,
       (SELECT count(*)::int FROM lead_interactions i
          JOIN leads l ON l.id = i.lead_id
         WHERE l.responsable_id = $1 AND i.fecha::date = CURRENT_DATE - 1) AS contactos,
       (SELECT count(*)::int FROM leads
         WHERE responsable_id = $1 AND deleted_at IS NULL
           AND status = 'convertido' AND updated_at::date = CURRENT_DATE - 1) AS convertidos`,
    [userId]
  );
  return rows[0];
}

/** La entrada de los ultimos 7 dias, para el grafico de la #81. */
async function ultimos7Dias(userId) {
  const { rows } = await query(
    `SELECT d::date AS dia,
            (SELECT count(*)::int FROM leads
              WHERE responsable_id = $1 AND deleted_at IS NULL
                AND COALESCE(fecha_solicitud, created_at)::date = d::date) AS entraron
       FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, INTERVAL '1 day') d
      ORDER BY d`,
    [userId]
  );
  return rows;
}

/** De donde vienen los suyos esta semana. El otro grafico de la #81. */
async function porCanal(userId) {
  const { rows } = await query(
    `SELECT COALESCE(NULLIF(canal_detectado, ''), NULLIF(utm_source, ''), 'Sin identificar') AS canal,
            count(*)::int AS total
       FROM leads
      WHERE responsable_id = $1 AND deleted_at IS NULL
        AND COALESCE(fecha_solicitud, created_at) >= CURRENT_DATE - 6
      GROUP BY 1
      ORDER BY total DESC
      LIMIT 6`,
    [userId]
  );
  return rows;
}

/**
 * El estado del EQUIPO, para el correo de administracion. Tarea #81.
 *
 * El ticket lo dice claro: «el del administrador es otro correo». Hoy los dos
 * dicen lo mismo, y al administrador le llega «no te queda ninguno sin
 * contactar», que ni siquiera es asunto suyo — el no lleva prospectos.
 */
async function estadoDelEquipo() {
  const { rows } = await query(
    `SELECT u.id, u.nombre,
            (SELECT count(*)::int FROM leads
              WHERE responsable_id = u.id AND deleted_at IS NULL
                AND COALESCE(fecha_solicitud, created_at)::date = CURRENT_DATE) AS entraron,
            (SELECT count(*)::int FROM lead_interactions i
               JOIN leads l ON l.id = i.lead_id
              WHERE l.responsable_id = u.id AND i.fecha::date = CURRENT_DATE) AS contactos,
            (SELECT count(*)::int FROM leads
              WHERE responsable_id = u.id AND deleted_at IS NULL
                AND status = 'convertido' AND updated_at::date = CURRENT_DATE) AS convertidos,
            (SELECT count(*)::int FROM leads l
              WHERE l.responsable_id = u.id AND l.deleted_at IS NULL
                AND l.status IN ('nuevo','por_contactar')
                AND NOT EXISTS (SELECT 1 FROM lead_interactions i WHERE i.lead_id = l.id)) AS sin_tocar
       FROM users u
      WHERE u.active AND u.role = 'gestor'
        AND NOT COALESCE(u.gestor_colaboraciones, false)
      ORDER BY sin_tocar DESC, u.nombre`
  );
  return rows;
}

/** Lo que le espera mañana: lo pendiente de hoy mas sus recordatorios. */
async function loDeManana(userId) {
  const { rows } = await query(
    `SELECT
       (SELECT count(*)::int FROM leads l
         WHERE l.responsable_id = $1 AND l.deleted_at IS NULL
           AND l.status IN ('nuevo','por_contactar')
           AND NOT EXISTS (SELECT 1 FROM lead_interactions i WHERE i.lead_id = l.id)) AS sin_tocar,
       (SELECT count(*)::int FROM leads
         WHERE responsable_id = $1 AND deleted_at IS NULL
           AND status = 'en_seguimiento') AS en_seguimiento,
       (SELECT count(*)::int FROM lead_reminders r
          JOIN leads l ON l.id = r.lead_id
         WHERE l.responsable_id = $1 AND r.completado = false
           AND r.fecha_recordatorio <= CURRENT_DATE + 1) AS recordatorios`,
    [userId]
  );
  return rows[0];
}

/**
 * El aviso de cierre de jornada.
 *
 * Las cifras van como tarjetas y no como una lista de viñetas: son numeros que
 * se comparan de un vistazo, y una lista obliga a leerlos de uno en uno. La
 * plantilla comun (#83) es la que pone la cabecera, el pie y el enlace de
 * verdad para apagarlo.
 */
/** Cuantos minutos lleva esperando. */
const minutosDesde = (desde) =>
  Math.max(0, Math.round((Date.now() - new Date(desde).getTime()) / 60000));

/** «45 min», «3 h», «2 días» — dicho como lo diria una persona. */
function espera(desde) {
  const min = minutosDesde(desde);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const dias = Math.floor(h / 24);
  return `${dias} día${dias > 1 ? 's' : ''}`;
}

/**
 * Como de mal esta que este lleve esperando lo que lleva.
 *
 * Un dia entero y cuarenta minutos no son lo mismo y salian con la misma
 * pildora gris. Los cortes: pasado un dia esta perdido —lo normal es que ya
 * haya escrito a otro sitio—, y pasadas cuatro horas ya no es «acaba de
 * entrar».
 */
function urgenciaDe(desde) {
  const min = minutosDesde(desde);
  if (min >= 24 * 60) return 'urgente';
  if (min >= 4 * 60) return 'aviso';
  return 'neutro';
}

/**
 * El resumen de la GESTORA: su lista de trabajo, no un contador.
 *
 * Tarea #81. Antes decia «te quedan 14 sin contactar» y se acababa ahi. Ahora
 * van los 14 con lo que hace falta para decidir a quien llamar primero, y cada
 * uno con sus tres atajos: abrir la ficha, escribirle por WhatsApp y llamarle.
 */
function textoResumen(persona, d) {
  const nada = !d.entraron && !d.contactos && !d.convertidos;
  const ayer = d.ayer || {};
  const lista = d.lista || [];

  const fichas = lista.map((l, i) => {
    const tel = normalizePhone(l.telefono);
    const wa = phoneCanonical(l.telefono);
    return fichaProspecto({
      // El orden importa y por eso se numera: la lista ya viene ordenada por
      // lo que llevan esperando, pero sin el numero eso no se ve.
      orden: i + 1,
      nombre: l.nombre,
      programa: l.producto_interes,
      telefono: tel || l.telefono,
      origen: l.origen,
      estado: l.status,
      esperando: espera(l.entro),
      urgencia: urgenciaDe(l.entro),
      acciones: [
        { texto: 'Abrir la ficha', url: enlace(`prospectos/${l.id}`) },
        // El telefono normalizado, que es lo que pide el ticket: `wa.me` no
        // admite ni el `+` ni espacios, y `phoneCanonical` ya quita el 1 de
        // Mexico y el 9 de Argentina, que es lo que rompia estos enlaces.
        wa ? { texto: 'WhatsApp', url: `https://wa.me/${wa.replace(/\D/g, '')}` } : null,
        tel ? { texto: 'Llamar', url: `tel:${tel}` } : null,
      ].filter(Boolean),
    });
  }).join('');

  const restantes = (d.sin_tocar || 0) - lista.length;

  return correo({
    titulo: 'Cómo ha ido el día',
    saludo: persona.nombre,
    // Lo que se lee en la bandeja SIN abrir el correo. Antes salia «Hola Ana,».
    resumen: lista.length
      ? `${d.sin_tocar} sin contactar · el primero lleva ${espera(lista[0].entro)} esperando`
      : `${d.entraron || 0} nuevos, ${d.contactos || 0} contactados, ${d.convertidos || 0} convertidos`,
    bloques: [
      // Las cifras SIEMPRE, aunque sean ceros: con la comparacion al lado, un
      // cero deja de ser un correo vacio y pasa a ser un dato.
      tarjetas([
        { etiqueta: 'Prospectos nuevos', valor: d.entraron || 0, comparacion: comparar(d.entraron, ayer.entraron) },
        { etiqueta: 'Contactos apuntados', valor: d.contactos || 0, comparacion: comparar(d.contactos, ayer.contactos) },
        { etiqueta: 'Convertidos', valor: d.convertidos || 0, comparacion: comparar(d.convertidos, ayer.convertidos) },
        { etiqueta: 'Sin contactar', valor: d.sin_tocar || 0 },
      ]),

      // «Hoy no ha entrado ninguno» es correcto, pero solo no parece un correo
      // roto si va acompañado de lo que SI hay pendiente. Por eso la frase va
      // aqui y la lista justo debajo.
      nada ? parrafo('Hoy no ha entrado ningún prospecto nuevo ni se ha registrado actividad.') : '',

      lista.length ? seccion('A quién llamar primero') : '',
      lista.length
        ? parrafo('Ordenados por lo que llevan esperando. El primero es el que más riesgo tiene de haberse ido ya.')
        : '',
      fichas,
      restantes > 0
        ? nota(`Y <strong>${restantes}</strong> más sin contactar que no caben en el correo.`)
        : '',
      lista.length
        ? boton({ texto: 'Ver todos en el CRM', url: enlace('prospectos') })
        : parrafo('No te queda ninguno sin contactar. Bien.'),

      // Los dos graficos del ticket. Van al final: son contexto, no trabajo.
      (d.dias7 || []).some((x) => x.entraron)
        ? seccion('Entrada de los últimos 7 días') + barras(
            d.dias7.map((x) => ({
              etiqueta: new Date(x.dia).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
              valor: x.entraron,
            })))
        : '',
      (d.canales || []).length
        ? seccion('De dónde vinieron esta semana') + barras(
            d.canales.map((c) => ({ etiqueta: c.canal, valor: c.total })),
            // Cada canal con su color, como las graficas del CRM (§1.4).
            { paleta: COLORES_CANAL })
        : '',
    ],
    apagar: { texto: 'Recibes este resumen al cerrar la jornada.' },
  });
}

/**
 * El resumen de ADMINISTRACION: el estado del equipo.
 *
 * «El del administrador es otro correo», dice la #81 — y tiene razon: hoy le
 * llegaba «no te queda ninguno sin contactar», que ni siquiera es asunto suyo
 * porque el no lleva prospectos. Lo que le importa es quien va con retraso.
 */
function textoResumenAdmin(persona, d) {
  const equipo = d.equipo || [];
  const suma = (k) => equipo.reduce((t, g) => t + (Number(g[k]) || 0), 0);
  const conRetraso = equipo.filter((g) => g.sin_tocar > 0);

  const filas = equipo.map((g) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid ${T.borde};font-family:${T.fuente};
                 font-size:14px;color:${T.texto}">${esc(g.nombre)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid ${T.borde};font-family:${T.fuente};
                 font-size:14px;color:${T.texto};text-align:right">${g.entraron}</td>
      <td style="padding:8px 10px;border-bottom:1px solid ${T.borde};font-family:${T.fuente};
                 font-size:14px;color:${T.texto};text-align:right">${g.contactos}</td>
      <td style="padding:8px 10px;border-bottom:1px solid ${T.borde};font-family:${T.fuente};
                 font-size:14px;font-weight:${g.sin_tocar > 0 ? '700' : '400'};
                 color:${g.sin_tocar > 0 ? T.destructivo : T.tenue};text-align:right">${g.sin_tocar}</td>
    </tr>`).join('');

  const cab = (t, a = 'left') =>
    `<th style="text-align:${a};font-family:${T.fuente};font-size:12px;font-weight:600;
                color:${T.tenue};padding:0 10px 6px">${t}</th>`;

  return correo({
    titulo: 'El equipo, hoy',
    saludo: persona.nombre,
    resumen: conRetraso.length
      ? `${suma('sin_tocar')} sin contactar en ${conRetraso.length} ${conRetraso.length === 1 ? 'gestora' : 'gestoras'}`
      : `${suma('contactos')} contactados hoy · nadie con retraso`,
    bloques: [
      tarjetas([
        { etiqueta: 'Prospectos nuevos', valor: suma('entraron') },
        { etiqueta: 'Contactados', valor: suma('contactos') },
        { etiqueta: 'Convertidos', valor: suma('convertidos') },
        { etiqueta: 'Sin contactar', valor: suma('sin_tocar') },
      ]),
      conRetraso.length
        ? nota(`<strong>${conRetraso.length}</strong> ${conRetraso.length === 1 ? 'gestora tiene' : 'gestoras tienen'} prospectos sin contactar.`)
        : parrafo('Ninguna gestora tiene prospectos sin contactar. Buen día.'),
      equipo.length ? seccion('Por gestora') : '',
      equipo.length ? `
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse">
          <tr>${cab('Gestora')}${cab('Nuevos', 'right')}${cab('Contactó', 'right')}${cab('Sin tocar', 'right')}</tr>
          ${filas}
        </table>` : parrafo('No hay ninguna gestora activa.'),
      equipo.length
        ? barras(equipo.map((g) => ({ etiqueta: g.nombre, valor: g.contactos })))
        : '',
      boton({ texto: 'Abrir el CRM', url: enlace('prospectos') }),
    ],
    apagar: { texto: 'Recibes este resumen al cerrar la jornada.' },
  });
}

function textoPlan(persona, d) {
  const nada = !d.sin_tocar && !d.en_seguimiento && !d.recordatorios;
  const cifras = [
    d.sin_tocar && { etiqueta: 'Sin contactar todavía', valor: d.sin_tocar },
    d.en_seguimiento && { etiqueta: 'En seguimiento', valor: d.en_seguimiento },
    d.recordatorios && { etiqueta: 'Recordatorios que vencen', valor: d.recordatorios },
  ].filter(Boolean);

  return correo({
    titulo: 'Lo que te espera mañana',
    saludo: persona.nombre,
    resumen: nada
      ? 'Mañana no tienes nada pendiente'
      : `${d.sin_tocar || 0} sin contactar · ${d.recordatorios || 0} recordatorios vencen`,
    bloques: [
      nada
        ? parrafo('Mañana no tienes nada pendiente. Descansa.')
        : tarjetas(cifras),
      nada ? '' : boton({ texto: 'Abrir mi panel', url: enlace('prospectos') }),
    ],
    apagar: { texto: 'Recibes este plan la noche antes.' },
  });
}

/** ¿Esta persona lleva prospectos, o mira los de los demas? */
const llevaProspectos = (persona) => persona.role === 'gestor';

/**
 * Junta lo que necesita el correo de esta persona.
 *
 * Se pide en paralelo: son cinco consultas por gestora y en serie el aviso
 * tardaria cinco veces mas por cada una.
 */
async function datosDe(aviso, persona) {
  if (aviso === 'plan_de_manana') return loDeManana(persona.id);

  if (!llevaProspectos(persona)) return { equipo: await estadoDelEquipo() };

  const [hoy_, ayer, lista, dias7, canales] = await Promise.all([
    loDeHoy(persona.id),
    loDeAyer(persona.id),
    sinContactarDetalle(persona.id),
    ultimos7Dias(persona.id),
    porCanal(persona.id),
  ]);
  return { ...hoy_, ayer, lista, dias7, canales };
}

/** Que correo le toca a esta persona. */
function cuerpoPara(aviso, persona, datos) {
  if (aviso === 'plan_de_manana') return textoPlan(persona, datos);
  return llevaProspectos(persona)
    ? textoResumen(persona, datos)
    : textoResumenAdmin(persona, datos);
}

async function mandar(aviso, roles, asunto, arma) {
  const gente = await destinatarios(aviso, roles);
  let mandados = 0;
  for (const persona of gente) {
    try {
      // `arma` se respeta si viene: es lo que usan las pruebas para no tocar
      // la base. Sin el, cada persona recibe lo suyo segun su rol.
      const datos = arma ? await arma(persona.id) : await datosDe(aviso, persona);
      // Sin proyecto en la cabecera a proposito: estos avisos cruzan todos los
      // proyectos de la persona, asi que poner la marca de uno seria decir que
      // las cifras son solo de ese.
      const { htmlContent, textContent } = cuerpoPara(aviso, persona, datos);
      const r = await sendEmail({
        to: persona.email,
        // El asunto tambien cambia: «El equipo, hoy» no es «Resumen del dia».
        subject: aviso === 'resumen_del_dia' && !llevaProspectos(persona)
          ? '[CRM] El equipo, hoy'
          : asunto,
        htmlContent,
        textContent,
        tags: ['recordatorio', aviso.replace(/_/g, '-')],
        // Con el DIA: este aviso tiene que llegar cada dia, pero una sola vez.
        clave: `${aviso}-${persona.id}-${hoy()}`,
      });
      if (r?.sent) mandados++;
    } catch (err) {
      // Que falle el de una persona no puede dejar sin aviso a las demas.
      logger.error({ err: err.message, userId: persona.id, aviso }, 'Fallo mandando el aviso diario');
    }
  }
  return { destinatarios: gente.length, mandados };
}

async function vuelta() {
  if (corriendo) return;
  corriendo = true;
  try {
    const hora = new Date().getHours();

    // Se comprueba la hora en cada vuelta en vez de programar a una hora exacta:
    // asi un reinicio a las 19:05 no se salta el aviso del dia. La clave impide
    // que se mande dos veces.
    if (hora === HORA_RESUMEN) {
      // Sin `arma`: desde la #81 cada persona recibe lo suyo segun su rol, y
      // eso lo decide `datosDe`. La gestora, su lista de trabajo del dia;
      // administracion, el estado del equipo.
      const r = await mandar(
        'resumen_del_dia',
        ['gestor', 'admin', 'superadmin'],
        '[CRM] Resumen del día'
      );
      logger.info({ ...r, aviso: 'resumen_del_dia' }, 'Resumen del dia');
    }

    if (hora === HORA_PLAN) {
      const r = await mandar(
        'plan_de_manana',
        ['gestor'],
        '[CRM] Lo que te espera mañana'
      );
      logger.info({ ...r, aviso: 'plan_de_manana' }, 'Plan de mañana');
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Fallo en los avisos diarios');
  } finally {
    corriendo = false;
  }
}

export function startResumenDiarioScheduler() {
  if (process.env.RESUMEN_DISABLED === '1') {
    logger.info('Avisos diarios desactivados (RESUMEN_DISABLED=1)');
    return;
  }
  vigilar('resumen_diario', 'Resumen del día y plan de mañana', vuelta, TICK_MS);
  logger.info({ tickMs: TICK_MS, horaResumen: HORA_RESUMEN, horaPlan: HORA_PLAN },
    'Avisos diarios iniciados');
}

export const _internos = {
  destinatarios, loDeHoy, loDeAyer, loDeManana, sinContactarDetalle,
  ultimos7Dias, porCanal, estadoDelEquipo, datosDe,
  textoResumen, textoResumenAdmin, textoPlan, mandar, vuelta,
};
