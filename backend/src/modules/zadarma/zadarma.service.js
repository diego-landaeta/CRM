import * as model from './zadarma.model.js';
import { pedirCallback, firmaDelAvisoValida } from './zadarma.client.js';
import { addInteraction } from '../leads/lead.service.js';
import { AppError } from '../../shared/utils/AppError.js';
import { logger } from '../../shared/utils/logger.js';
import { normalizePhone } from '../../shared/utils/normalizePhone.js';
import { alcanceComercial, enElAlcance } from '../../shared/utils/roles.js';
import { veTodoElCrm, campusDeLaPersona } from '../../shared/utils/ambito.js';

/*
  Zadarma en el CRM (#137), fase 1.

  · LLAMAR: la gestora pulsa «Llamar con Zadarma» en un prospecto suyo. El CRM
    pide a Zadarma un callback: Zadarma llama primero a SU extensión y, cuando
    descuelga, al prospecto. La llamada sale por la centralita, que es donde se
    graba y se cuenta.
  · REGISTRAR: al colgar, Zadarma avisa (NOTIFY_OUT_END / NOTIFY_END). Cada
    aviso entra una sola vez en `llamadas` y, si se sabe de qué prospecto y de
    qué gestora es, como un contacto «llamada» en su ficha: así cuenta solo en
    «Actividad por comercial» (#203) y en el proceso comercial, como las que se
    apuntan a mano.

  Todo apagado si el campus no tiene Zadarma conectado en Integraciones.
*/

/** El número del prospecto, solo dígitos y con prefijo de país, como lo quiere Zadarma. */
export function numeroParaZadarma(telefono) {
  const e164 = normalizePhone(telefono);
  return e164 ? e164.replace(/\D/g, '') : null;
}

/**
 * ¿Puede esta persona llamar a este prospecto? El mismo criterio que la ficha
 * (lead.controller.js · exigirQueSeaSuyo) y además el campus: con la sesión,
 * nunca con lo que llegue en la petición.
 */
async function exigirQueSeaSuyo(user, lead) {
  if (!veTodoElCrm(user)) {
    const mios = await campusDeLaPersona(user.userId);
    if (!mios.includes(Number(lead.project_id))) {
      throw new AppError('Contacto no encontrado', 404, 'NOT_FOUND');
    }
  }
  const alcance = await alcanceComercial(user);
  if (!enElAlcance(alcance, lead.responsable_id)) {
    throw new AppError('Ese contacto es de otra gestora', 403, 'NO_ES_TUYO');
  }
}

/** POST /api/zadarma/llamar */
export async function llamar(user, leadId) {
  const lead = await model.leadParaLlamar(leadId);
  if (!lead) throw new AppError('Contacto no encontrado', 404, 'NOT_FOUND');
  await exigirQueSeaSuyo(user, lead);

  const credenciales = await model.credencialesDelCampus(lead.project_id);
  if (!credenciales) {
    throw new AppError('Zadarma no está conectado en este campus. Lo conecta un admin en Integraciones.', 409, 'ZADARMA_NO_CONECTADO');
  }
  const extension = await model.extensionDe(user.userId, lead.project_id);
  if (!extension) {
    throw new AppError('No tienes extensión de Zadarma en este campus. Pídesela a un admin (Integraciones › Zadarma).', 409, 'SIN_EXTENSION');
  }
  const numero = numeroParaZadarma(lead.telefono);
  if (!numero) throw new AppError('Este contacto no tiene un teléfono al que se pueda llamar.', 400, 'SIN_TELEFONO');

  let respuesta;
  try {
    respuesta = await pedirCallback(credenciales, { desde: extension, hacia: numero });
  } catch (err) {
    logger.warn({ leadId, projectId: lead.project_id, err: err.message }, 'zadarma: el callback falló');
    throw new AppError(`Zadarma no ha podido llamar: ${err.message.replace(/^Zadarma:\s*/, '')}`, 502, 'ZADARMA_FALLO');
  }
  await model.apuntarPedida({ projectId: lead.project_id, leadId: lead.id, userId: user.userId, extension, numero });
  return { extension, numero: `+${numero}`, lead_id: lead.id, zadarma: { from: respuesta.from, to: respuesta.to, time: respuesta.time } };
}

/** GET /api/zadarma/estado: dónde puede llamar esta persona y con qué extensión. */
export async function estado(user) {
  const campus = veTodoElCrm(user) ? null : await campusDeLaPersona(user.userId);
  return model.estadoParaLaPersona(user.userId, campus);
}

// ─── El aviso de fin de llamada ─────────────────────────────────────────────

const AVISOS_DE_FIN = ['NOTIFY_END', 'NOTIFY_OUT_END'];

function duracionLegible(seg) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return m ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`;
}

export function notaDeLaLlamada({ direccion, duracion, contestada, estado, grabada }) {
  const partes = [
    `Llamada ${direccion} por Zadarma`,
    contestada ? duracionLegible(duracion) : null,
    contestada ? 'contestada' : `no contestada${estado ? ` (${estado})` : ''}`,
    grabada ? 'con grabación' : null,
  ];
  return partes.filter(Boolean).join(' · ');
}

/**
 * De qué cuenta es el aviso: los campus cuyo secreto firma igual. Varios campus
 * pueden compartir cuenta (y secreto): entonces son todos candidatos y lo
 * deciden la extensión y el teléfono. Ninguno: la firma no es nuestra.
 */
async function campusDelAviso(cuerpo, firma) {
  const todos = await model.credencialesDeTodos();
  return todos.filter((c) => firmaDelAvisoValida(cuerpo, firma, c.secreto));
}

/** Una fecha «AAAA-MM-DD HH:MM:SS» como la manda Zadarma (en la zona de la cuenta). */
const FECHA_ZADARMA = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/;

/**
 * Atiende un aviso. Devuelve qué se hizo, para el registro y las pruebas:
 *   { ignorado } · { duplicada } · { llamadaId, leadId, interaccionId }
 * Lanza 401 si la firma no es de ninguna cuenta conectada.
 */
export async function registrarAviso(cuerpo, firma) {
  if (!AVISOS_DE_FIN.includes(cuerpo?.event)) return { ignorado: true };

  const candidatos = await campusDelAviso(cuerpo, firma);
  if (!candidatos.length) throw new AppError('Firma no válida', 401, 'FIRMA_NO_VALIDA');

  const saliente = cuerpo.event === 'NOTIFY_OUT_END';
  const numeroCrudo = String((saliente ? cuerpo.destination : cuerpo.caller_id) || '');
  const extension = String(cuerpo.internal || '').trim() || null;
  const pbxCallId = String(cuerpo.pbx_call_id || '').trim();
  const inicio = String(cuerpo.call_start || '').trim();
  if (!pbxCallId || !FECHA_ZADARMA.test(inicio)) {
    throw new AppError('Aviso incompleto: falta pbx_call_id o call_start', 400, 'AVISO_INCOMPLETO');
  }
  const duracion = Math.max(0, Number.parseInt(cuerpo.duration, 10) || 0);
  const estado = String(cuerpo.disposition || '').slice(0, 40) || null;
  const contestada = estado === 'answered';
  const grabada = String(cuerpo.is_recorded) === '1';

  const projectIds = candidatos.map((c) => c.projectId);
  const zonaHoraria = candidatos[0].zonaHoraria;
  const gestora = await model.gestoraDeLaExtension(extension, projectIds);
  const cola9 = numeroCrudo.replace(/\D/g, '').slice(-9);
  const lead = cola9.length === 9
    ? await model.leadDeLaLlamada({ cola9, userId: gestora?.userId, projectIds, inicio, zonaHoraria })
    : null;
  const projectId = lead?.projectId || gestora?.projectId || projectIds[0];

  const direccion = saliente ? 'saliente' : 'entrante';
  const guardada = await model.guardarLlamada({
    projectId,
    leadId: lead?.leadId || null,
    userId: gestora?.userId || null,
    extension,
    numero: numeroCrudo.slice(0, 40) || '(oculto)',
    direccion,
    inicio,
    zonaHoraria,
    duracion,
    contestada,
    estado,
    grabada,
    callIdWithRec: cuerpo.call_id_with_rec ? String(cuerpo.call_id_with_rec).slice(0, 120) : null,
    pbxCallId: pbxCallId.slice(0, 120),
  });
  if (!guardada) return { duplicada: true };

  // El contacto en la ficha, como cualquier otro. Hace falta saber QUIÉN llamó:
  // una extensión sin dueña deja la llamada en el registro (cuenta en el
  // informe como «Sin asignar») pero no inventa un autor.
  let interaccionId = null;
  if (lead && gestora) {
    try {
      const i = await addInteraction(
        lead.leadId, 'llamada',
        notaDeLaLlamada({ direccion, duracion, contestada, estado, grabada }),
        gestora.userId, new Date(guardada.inicio).toISOString(),
      );
      interaccionId = i?.id || null;
      if (interaccionId) await model.enlazarInteraccion(guardada.id, interaccionId);
    } catch (err) {
      // La llamada ya está guardada; perder el contacto en la ficha no puede
      // hacer que Zadarma reintente y se cuente dos veces.
      logger.warn({ llamadaId: guardada.id, err: err.message }, 'zadarma: no se pudo apuntar la llamada en la ficha');
    }
  }
  return { llamadaId: guardada.id, leadId: lead?.leadId || null, userId: gestora?.userId || null, interaccionId };
}

// ─── Reporte ───────────────────────────────────────────────────────────────

export async function reporte({ projectIds, responsableId, desde, hasta }) {
  const conectado = await model.algunoConectado(projectIds);
  const crudas = await model.llamadasPorGestora({ projectIds, responsableId, desde, hasta });
  const filas = crudas.map((r) => ({
    user_id: r.user_id == null ? null : Number(r.user_id),
    comercial: r.comercial || 'Sin asignar',
    llamadas: r.llamadas,
    salientes: r.salientes,
    entrantes: r.entrantes,
    contestadas: r.contestadas,
    no_contestadas: r.no_contestadas,
    segundos: r.segundos,
    // La media, de las contestadas: una que no se coge dura 0 y hundiría la cifra.
    media_segundos: r.contestadas ? Math.round(r.segundos / r.contestadas) : 0,
    personas: r.personas,
  })).sort((a, b) => b.llamadas - a.llamadas || b.segundos - a.segundos
    || a.comercial.localeCompare(b.comercial, 'es'));
  const suma = (k) => filas.reduce((s, f) => s + f[k], 0);
  const contestadas = suma('contestadas');
  return {
    desde,
    hasta,
    conectado,
    filas,
    equipo: {
      llamadas: suma('llamadas'),
      salientes: suma('salientes'),
      entrantes: suma('entrantes'),
      contestadas,
      no_contestadas: suma('no_contestadas'),
      segundos: suma('segundos'),
      media_segundos: contestadas ? Math.round(suma('segundos') / contestadas) : 0,
    },
  };
}
