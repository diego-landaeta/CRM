import { logger } from '../shared/utils/logger.js';
import { query } from '../shared/config/db.js';
import { sendEmail } from '../shared/services/brevo.service.js';
import { notifyUsers } from '../modules/notifications/notifications.service.js';
import { correo, parrafo, boton, fichaProspecto, enlace } from '../shared/services/email-plantilla.service.js';
import { vigilar } from './latido.js';

/**
 * «Tienes un prospecto sin tocar desde hace media hora.»
 *
 * Primera subfase de la tarea #28, y la que define su criterio de terminado:
 * entra un lead, no se toca, y a la media hora llega el aviso a su gestora — UNA
 * sola vez.
 *
 * Un lead cuenta como sin tocar cuando se dan las DOS cosas:
 *
 *   · sigue en `nuevo` o `por_contactar`, y
 *   · no tiene ninguna interaccion apuntada.
 *
 * Las dos, no una. Alguien puede haberle escrito por WhatsApp sin cambiarle el
 * estado —pasa constantemente— y avisar ahi seria ruido. Y un aviso que es ruido
 * se deja de leer, con lo que tampoco se lee el que importa: es exactamente lo
 * que le paso al vigilante del catalogo con sus 382 avisos de los que 370
 * sobraban.
 */

const MINUTOS = parseInt(process.env.LEAD_SIN_TOCAR_MINUTOS || '30', 10);
const TICK_MS = parseInt(process.env.LEAD_SIN_TOCAR_TICK_MS || String(5 * 60 * 1000), 10);
const TOPE_POR_VUELTA = 50;

let corriendo = false;

/** Los que llevan mas de MINUTOS sin que nadie haga nada con ellos. */
async function sinTocar() {
  const { rows } = await query(
    `SELECT l.id, l.nombre, l.email, l.telefono, l.status, l.fecha_solicitud, l.created_at,
            l.responsable_id,
            u.nombre AS gestora, u.email AS gestora_email,
            -- La marca del proyecto va en la cabecera del correo (#83).
            p.nombre AS proyecto, p.logo_url AS proyecto_logo, p.emoji AS proyecto_emoji,
            p.slug AS proyecto_slug
       FROM leads l
       JOIN users u    ON u.id = l.responsable_id AND u.active
       LEFT JOIN projects p ON p.id = l.project_id
      WHERE l.deleted_at IS NULL
        AND l.status IN ('nuevo', 'por_contactar')
        AND COALESCE(l.fecha_solicitud, l.created_at) < NOW() - ($1 || ' minutes')::interval
        -- Y de los ultimos dos dias: si el CRM ha estado parado o el aviso se
        -- añade hoy, no se quiere una avalancha con todo el historico.
        AND COALESCE(l.fecha_solicitud, l.created_at) > NOW() - INTERVAL '2 days'
        AND NOT EXISTS (
          SELECT 1 FROM lead_interactions i WHERE i.lead_id = l.id
        )
        -- Quien lo haya apagado, no lo recibe.
        AND NOT EXISTS (
          SELECT 1 FROM avisos_apagados a
           WHERE a.user_id = u.id AND a.aviso = 'lead_sin_tocar'
        )
      ORDER BY COALESCE(l.fecha_solicitud, l.created_at)
      LIMIT ${TOPE_POR_VUELTA}`,
    [String(MINUTOS)]
  );
  return rows;
}

/** «Hace 45 minutos» dicho como lo diria una persona. */
function cuantoLleva(minutos) {
  if (minutos < 60) return `${minutos} minutos`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h < 24) return m ? `${h} h y ${m} min` : `${h} hora${h > 1 ? 's' : ''}`;
  const d = Math.floor(h / 24);
  return `${d} día${d > 1 ? 's' : ''}`;
}

function cuerpo(lead) {
  const entro = new Date(lead.fecha_solicitud || lead.created_at);
  const hace = Math.round((Date.now() - entro.getTime()) / 60000);
  const url = enlace(`prospectos/${lead.id}`);

  return correo({
    proyecto: {
      nombre: lead.proyecto,
      logo_url: lead.proyecto_logo,
      slug: lead.proyecto_slug,
      emoji: lead.proyecto_emoji,
    },
    titulo: 'Un prospecto lleva esperando',
    saludo: lead.gestora,
    resumen: `${lead.nombre} lleva ${cuantoLleva(hace)} sin contactar`,
    bloques: [
      // El tiempo va en la etiqueta de la ficha y no repetido aqui: el titular
      // ya dice que lleva esperando, y decirlo tres veces en cuatro lineas es
      // lo que hace que un aviso parezca escrito por una maquina.
      parrafo('Todavía no tiene ningún contacto apuntado.'),
      // La ficha y no una lista de <li>: es la misma pieza que la #81 va a
      // repetir catorce veces, y conviene que el aviso de uno solo y el resumen
      // de muchos se vean igual.
      // Sin `url` en la ficha: aqui es UN prospecto y el boton de abajo ya
      // lleva a el, asi que el enlace de dentro seria «Abrir la ficha» dos
      // veces seguidas. En la #81, que son catorce fichas y ningun boton, cada
      // una si lleva el suyo.
      fichaProspecto({
        nombre: lead.nombre,
        telefono: lead.telefono,
        correo: lead.email,
        estado: lead.status,
        esperando: cuantoLleva(hace),
      }),
      boton({ texto: 'Abrir la ficha', url }),
    ],
    apagar: { texto: 'Este aviso se manda una sola vez por prospecto.' },
  });
}

async function vuelta() {
  if (corriendo) return;
  corriendo = true;
  try {
    const leads = await sinTocar();
    if (!leads.length) return;

    for (const lead of leads) {
      // La campanita SIEMPRE, aunque no haya correo configurado: es el canal
      // que no depende de que Brevo conteste.
      await notifyUsers({
        targetUserIds: [lead.responsable_id],
        type: 'lead_sin_tocar',
        title: `Sin contactar: ${lead.nombre}`,
        // Con tildes: esto tambien lo lee una persona, no es un comentario.
        message: `Entró hace más de ${MINUTOS} minutos y no tiene ningún contacto apuntado.`,
        link_path: `/prospectos/${lead.id}`,
      }).catch(() => {});

      if (!lead.gestora_email) continue;

      const { htmlContent, textContent } = cuerpo(lead);
      await sendEmail({
        to: lead.gestora_email,
        subject: `[CRM] Sin contactar: ${lead.nombre}`,
        htmlContent,
        textContent,
        tags: ['recordatorio', 'lead-sin-tocar'],
        // UNA sola vez por prospecto, y esto es el criterio de terminado del
        // ticket. La clave lleva el id del lead y no la fecha: el aviso es «este
        // lead lleva sin tocar», no «hoy tienes leads sin tocar». Repetirlo cada
        // dia seria acosar a la gestora por el mismo prospecto.
        clave: `lead-sin-tocar-${lead.id}`,
      });
    }

    logger.info({ cuantos: leads.length, minutos: MINUTOS }, 'Avisos de leads sin tocar');
  } catch (err) {
    logger.error({ err: err.message }, 'Fallo avisando de leads sin tocar');
  } finally {
    corriendo = false;
  }
}

export function startLeadSinTocarScheduler() {
  if (process.env.LEAD_SIN_TOCAR_DISABLED === '1') {
    logger.info('Aviso de leads sin tocar desactivado (LEAD_SIN_TOCAR_DISABLED=1)');
    return;
  }
  // No se llama en el arranque: el primer tick espera un ciclo. Al levantar la
  // aplicacion la base puede no estar lista todavia, y ademas un reinicio no
  // deberia disparar correos — que es de lo que iba la tarea #27.
  vigilar('prospecto_sin_tocar', 'Aviso de prospecto sin contactar', vuelta, TICK_MS);
  logger.info({ tickMs: TICK_MS, minutos: MINUTOS }, 'Aviso de leads sin tocar iniciado');
}

// Para las pruebas, sin exponer nada que se use por accidente.
export const _internos = { sinTocar, vuelta, cuerpo };
