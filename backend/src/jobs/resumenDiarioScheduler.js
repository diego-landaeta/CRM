import { logger } from '../shared/utils/logger.js';
import { query } from '../shared/config/db.js';
import { sendEmail } from '../shared/services/brevo.service.js';
import { vigilar } from './latido.js';
import { contarFiltrosRapidos, comoVaLaRevision, sePuedeRevisar } from '../modules/leads/lead.model.js';

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
const DIA_VALIDACION = parseInt(process.env.VALIDACION_DIA || '25', 10);
const TICK_MS = parseInt(process.env.RESUMEN_TICK_MS || String(30 * 60 * 1000), 10);

let corriendo = false;

const hoy = () => new Date().toISOString().slice(0, 10);

/** A quien le toca este aviso: gestoras activas que no lo hayan apagado. */
async function destinatarios(aviso, roles) {
  const { rows } = await query(
    `SELECT u.id, u.nombre, u.email
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
 * Lo que le espera mañana, contado como lo cuenta la pantalla (#132).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE NO SE CUENTA AQUI
 *
 * Habia una consulta propia en este fichero, y contaba otra cosa:
 *
 *     fecha_recordatorio <= CURRENT_DATE + 1
 *
 * o sea atrasados, los de hoy y los de mañana JUNTOS, en un numero llamado
 * «recordatorios que vencen». No existe ninguna pantalla que enseñe eso, asi
 * que a esa linea no se le podia poner enlace ni aunque se quisiera.
 *
 * Era la cuarta definicion de los mismos criterios —la lista, los contadores de
 * las pestañas, el export y esto—. Ahora sale de `contarFiltrosRapidos`, que es
 * la misma que usa el listado. El ticket lo pide asi: «el numero del correo y el
 * numero de la lista tienen que ser el mismo».
 * ─────────────────────────────────────────────────────────────────────────────
 */
async function loDeManana(userId) {
  // Por proyecto, no en bloque.
  //
  // El listado del CRM SIEMPRE trabaja sobre un proyecto: si el correo sumara
  // los de todos, diria «7» y la pantalla que abre enseñaria los de uno solo.
  // Es exactamente el desajuste que el ticket prohibe, y no se ve hasta que
  // alguien lleva dos marcas.
  const { rows: suyos } = await query(
    `SELECT p.id, p.nombre
       FROM user_projects up JOIN projects p ON p.id = up.project_id
      WHERE up.user_id = $1 AND up.active AND p.active
      ORDER BY p.nombre`, [userId]);

  const bloques = [];
  for (const proyecto of suyos) {
    const c = await contarFiltrosRapidos({ projectId: proyecto.id, responsableId: userId });
    if (c.tomorrow || c.no_contact || c.overdue) bloques.push({ proyecto, ...c });
  }
  return { bloques, variosProyectos: suyos.length > 1 };
}

const fila = (etiqueta, valor) =>
  `<li><strong>${valor}</strong> ${etiqueta}</li>`;

function textoResumen(nombre, d) {
  // Si no ha pasado NADA, se dice y punto. Un resumen de ceros disfrazado de
  // informe es la forma mas rapida de que se deje de leer.
  const nada = !d.entraron && !d.contactos && !d.convertidos;
  return `
    <p>Hola ${nombre},</p>
    ${nada
      ? '<p>Hoy no ha entrado ningun prospecto nuevo ni se ha registrado actividad.</p>'
      : `<p>Como ha ido el dia:</p>
         <ul>
           ${d.entraron ? fila('prospectos nuevos', d.entraron) : ''}
           ${d.contactos ? fila('contactos apuntados', d.contactos) : ''}
           ${d.convertidos ? fila('convertidos', d.convertidos) : ''}
         </ul>`}
    ${d.sin_tocar
      ? `<p><strong>Te quedan ${d.sin_tocar} sin contactar.</strong></p>`
      : '<p>No te queda ninguno sin contactar. Bien.</p>'}
    <p style="font-size:12px;color:#666">Puedes apagar este aviso en <em>Mis preferencias</em>.</p>
  `;
}

/**
 * El plan de mañana, con enlaces que abren el CRM ya filtrado (#132).
 *
 * Es la frase que Diego subrayo del pedido:
 *
 *     «...y que sea un enlace, y cuando lo abra, el CRM con eso puesto.»
 *
 * Un correo que dice «tienes 12» y te deja buscandolos no sirve: la gestora
 * entra, no encuentra los doce, y a la semana deja de abrir el correo.
 *
 * Cada `qf` de aqui es el mismo que resuelve el servidor en el listado, asi que
 * el numero de la linea y el de la pantalla que abre son el mismo. Hasta hace
 * un rato no lo eran: el filtro se aplicaba sobre la pagina de 20.
 */
const BASE = () => (process.env.CRM_BASE_URL || 'http://localhost:5173/crm').replace(/\/+$/, '');

const lineaConEnlace = (etiqueta, valor, qf, projectId) => (valor
  ? `<li style="margin:6px 0">
       <strong>${valor}</strong> ${etiqueta}
       &nbsp;<a href="${BASE()}/prospectos?projectId=${projectId}&qf=${qf}"
               style="color:#4f4fcc;font-weight:600;text-decoration:none">abrir &rarr;</a>
     </li>`
  : '');

function textoPlan(nombre, d) {
  const bloques = d?.bloques || [];
  if (!bloques.length) {
    return `
      <p>Hola ${nombre},</p>
      <p>Mañana no tienes nada pendiente. Descansa.</p>
      <p style="font-size:12px;color:#666">Puedes apagar este aviso en <em>Mis preferencias</em>.</p>
    `;
  }
  const trozo = (b) => `
    ${d.variosProyectos ? `<p style="margin:14px 0 4px"><strong>${b.proyecto.nombre}</strong></p>` : ''}
    <ul style="padding-left:18px;margin:4px 0">
      ${lineaConEnlace('con recordatorio para mañana', b.tomorrow, 'tomorrow', b.proyecto.id)}
      ${lineaConEnlace('sin contactar todavia', b.no_contact, 'no-contact', b.proyecto.id)}
      ${lineaConEnlace('con el recordatorio ya vencido', b.overdue, 'overdue', b.proyecto.id)}
    </ul>`;
  return `
    <p>Hola ${nombre},</p>
    <p>Lo que te espera mañana:</p>
    ${bloques.map(trozo).join('')}
    <p style="font-size:13px;color:#555">
      Cada «abrir» te deja en el listado con ese filtro puesto y en ese proyecto.
      El numero de aqui es el mismo que veras alli.
    </p>
    <p style="font-size:12px;color:#666">Puedes apagar este aviso en <em>Mis preferencias</em>.</p>
  `;
}

/**
 * `texto` y `periodo` llegan de fuera.
 *
 * Antes esto elegia el cuerpo con `aviso === 'resumen_del_dia' ? … : …`, un if
 * de dos ramas. Al llegar el tercer aviso —la validacion mensual— ese if habria
 * mandado el texto del plan de mañana con el asunto del repaso. Se parametriza
 * y deja de haber una rama que adivinar.
 *
 * `periodo` es lo que hace que la clave de idempotencia signifique lo correcto:
 * los diarios llevan el dia y tienen que llegar cada dia; el mensual lleva el
 * mes, o llegaria treinta veces.
 */
/**
 * El repaso de fin de mes: su base entera, para validarla (#132).
 *
 * Diego: «solamente el seguimiento de toda la base, que se puede enviar por
 * correo a cada gestora esa base y que la validen».
 *
 * No lleva la lista de fichas dentro. Una base son cientos: un correo con
 * cientos de nombres no se lee, y ademas quedaria congelado el dia que se
 * mando. Lleva el numero y el enlace, que es donde se puede trabajar.
 */
async function loDeLaBase(userId) {
  const { rows: suyos } = await query(
    `SELECT p.id, p.nombre
       FROM user_projects up JOIN projects p ON p.id = up.project_id
      WHERE up.user_id = $1 AND up.active AND p.active
      ORDER BY p.nombre`, [userId]);

  const bloques = [];
  for (const proyecto of suyos) {
    const c = await comoVaLaRevision({ projectId: proyecto.id, responsableId: userId });
    if (c.total) bloques.push({ proyecto, ...c });
  }
  return { bloques, variosProyectos: suyos.length > 1 };
}

function textoValidacion(nombre, d) {
  const bloques = (d?.bloques || []).filter((b) => b.pendientes > 0);
  if (!bloques.length) {
    return `
      <p>Hola ${nombre},</p>
      <p>Tienes la base entera repasada este mes. No queda ninguna ficha por validar.</p>
      <p style="font-size:12px;color:#666">Puedes apagar este aviso en <em>Mis preferencias</em>.</p>
    `;
  }
  const trozo = (b) => {
    const hechas = b.total - b.pendientes;
    const pct = b.total ? Math.round((hechas / b.total) * 100) : 0;
    return `
      ${d.variosProyectos ? `<p style="margin:14px 0 4px"><strong>${b.proyecto.nombre}</strong></p>` : ''}
      <ul style="padding-left:18px;margin:4px 0">
        ${lineaConEnlace('por validar', b.pendientes, 'sin-revisar', b.proyecto.id)}
      </ul>
      <p style="font-size:12px;color:#666;margin:2px 0 0">
        Llevas ${hechas} de ${b.total} (${pct} %).
      </p>`;
  };
  return `
    <p>Hola ${nombre},</p>
    <p>Toca el repaso de la base: mirar quien sigue vivo, quien ya no y quien cambio de idea.</p>
    ${bloques.map(trozo).join('')}
    <p style="font-size:13px;color:#555">
      El enlace abre tu lista con lo que te falta. Cada ficha se marca desde ahi,
      y el numero baja segun avanzas — no hace falta terminarlo de una sentada.
    </p>
    <p style="font-size:12px;color:#666">Puedes apagar este aviso en <em>Mis preferencias</em>.</p>
  `;
}

async function mandar(aviso, roles, asunto, arma, texto, periodo = hoy()) {
  const gente = await destinatarios(aviso, roles);
  let mandados = 0;
  for (const persona of gente) {
    try {
      const datos = await arma(persona.id);
      const r = await sendEmail({
        to: persona.email,
        subject: asunto,
        htmlContent: texto(persona.nombre, datos),
        tags: ['recordatorio', aviso.replace(/_/g, '-')],
        clave: `${aviso}-${persona.id}-${periodo}`,
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
      const r = await mandar(
        'resumen_del_dia',
        ['gestor', 'admin', 'superadmin'],
        '[CRM] Resumen del dia',
        loDeHoy, textoResumen
      );
      logger.info({ ...r, aviso: 'resumen_del_dia' }, 'Resumen del dia');
    }

    // El repaso mensual. `DIA_VALIDACION` por defecto el 25: con margen para
    // que dé tiempo antes de fin de mes, que es cuando toca el quinto paso.
    if (hora === HORA_PLAN && new Date().getDate() === DIA_VALIDACION) {
      // Si la migracion 149 no esta, NO se manda. Un correo que dice «valida tu
      // base» y lleva a una pantalla donde no se puede marcar es peor que no
      // mandarlo: se abre, no se puede hacer nada, y el mes siguiente ya no se
      // abre.
      if (await sePuedeRevisar()) {
        const r = await mandar(
          'validacion_mensual',
          ['gestor'],
          '[CRM] Toca repasar tu base',
          loDeLaBase, textoValidacion,
          hoy().slice(0, 7),
        );
        logger.info({ ...r, aviso: 'validacion_mensual' }, 'Validacion mensual');
      } else {
        logger.warn('Falta la migracion 149 (lead_revisiones): no se manda la validacion mensual');
      }
    }

    if (hora === HORA_PLAN) {
      const r = await mandar(
        'plan_de_manana',
        ['gestor'],
        '[CRM] Lo que te espera mañana',
        loDeManana, textoPlan
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

export const _internos = { destinatarios, loDeHoy, loDeManana, loDeLaBase, textoResumen, textoPlan, textoValidacion, mandar, vuelta };
