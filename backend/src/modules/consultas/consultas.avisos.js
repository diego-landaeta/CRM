/*
  LO QUE AVISA EL PLUGIN DEL CAMPUS (#679): cada mensaje privado, al momento.

  Con el plugin, al CRM le llegan TODOS los mensajes privados del campus, no solo
  los de las tutoras que tiene dadas de alta (la lectura cada 5 minutos solo mira
  esas). Qué se hace con cada uno:

    · lo escribe una tutora del CRM      → su respuesta, en la consulta de ese alumno;
    · lo escribe un alumno a personal     → consulta (nueva o la suya). Si el
      del campus o a una tutora del CRM     destinatario es tutora del CRM, para ella;
                                            si no (coordinación, un profesor sin
                                            ficha), al reparto de siempre;
    · lo escribe personal sin ficha       → no es del CRM: se ignora;
    · entre alumnos                       → no es una consulta: se ignora.

  Lo repetido (el aviso de un mensaje que ya se leyó, o el de una respuesta que
  salió del propio CRM) lo descarta su id de Moodle, como en la lectura.
*/
import { AppError } from '../../shared/utils/AppError.js';
import { logger } from '../../shared/utils/logger.js';
import { textoDeMoodle } from '../../shared/services/moodle.client.js';
import * as model from './consultas.model.js';
import { entraMensajeDelAlumno, tutoresDelCampus, siYaEstaRepetido, campusConConsultas } from './consultas.service.js';
import { claveDelCampus, firmaValida, apuntarAviso } from './consultas.plugin.js';

const NO_VALE = () => new AppError('Firma no válida', 401, 'INVALID_SIGNATURE');

const entero = (v) => Number.isInteger(Number(v)) && Number(v) > 0;

/** Comprueba la firma y procesa el aviso. */
export async function recibirAviso(projectId, cuerpo, cabecera, { ahoraMs = Date.now() } = {}) {
  const clave = await claveDelCampus(projectId);
  if (!clave || !firmaValida(cabecera, cuerpo, clave, ahoraMs)) throw NO_VALE();
  let aviso;
  try {
    aviso = JSON.parse(cuerpo.toString('utf8'));
  } catch {
    throw new AppError('El aviso no es JSON', 400, 'VALIDATION_ERROR');
  }
  await apuntarAviso(projectId);
  return procesarAviso(projectId, aviso);
}

export async function procesarAviso(projectId, aviso) {
  const m = aviso?.mensaje;
  const de = aviso?.de;
  const para = Array.isArray(aviso?.para) ? aviso.para[0] : null;
  if (aviso?.evento !== 'mensaje' || !m || !entero(m.id) || !entero(m.conversacion_id) || !entero(de?.id) || !entero(para?.id)) {
    throw new AppError('Aviso incompleto', 400, 'VALIDATION_ERROR');
  }
  // «Leer las consultas» apagado en Integraciones: el campus no entra en el CRM, ni por
  // la lectura ni por el plugin. Y lo de antes de encenderlo, tampoco (como la lectura).
  const campus = (await campusConConsultas()).find((x) => x.projectId === Number(projectId));
  if (!campus) return { resultado: 'ignorado', motivo: 'consultas apagadas en este campus' };
  if (entero(m.fecha) && Number(m.fecha) * 1000 < campus.desde.getTime()) {
    return { resultado: 'ignorado', motivo: 'anterior a «Leer las consultas»' };
  }
  const externoId = Number(m.id);
  if (await model.existeMensajeExterno(projectId, externoId)) return { resultado: 'repetido' };

  const tutores = new Map((await tutoresDelCampus(projectId)).map((t) => [t.moodleId, t.tutorId]));
  const texto = textoDeMoodle(m.html);
  const escritoAt = entero(m.fecha) ? new Date(Number(m.fecha) * 1000) : new Date();
  const conversacionId = Number(m.conversacion_id);

  const tutorQueEscribe = tutores.get(Number(de.id));
  if (tutorQueEscribe) {
    const r = await siYaEstaRepetido(() => model.guardarRespuestaDesdeElCampus({
      projectId, conversacionId, alumnoMoodleId: Number(para.id),
      tutorId: tutorQueEscribe, texto, externoId, escritoAt,
    }));
    if (r.duplicado) return { resultado: 'repetido' };
    if (r.sinConsulta) return { resultado: 'ignorado', motivo: 'respuesta sin consulta' };
    return { resultado: 'respuesta', consultaId: r.consulta.id };
  }
  if (de.personal) return { resultado: 'ignorado', motivo: 'personal sin ficha en el CRM' };

  const tutorDestino = tutores.get(Number(para.id)) ?? null;
  if (!tutorDestino && !para.personal) return { resultado: 'ignorado', motivo: 'entre alumnos' };

  const r = await siYaEstaRepetido(() => entraMensajeDelAlumno({
    projectId, conversacionId,
    alumno: { moodleId: Number(de.id), nombre: de.nombre || null, email: de.email || null },
    // El curso, si el alumno entró por «Entrar al chat» de un curso (plugin 1.6.0).
    curso: entero(m.curso_id) ? { moodleId: Number(m.curso_id), nombre: null } : null,
    texto, externoId, escritoAt,
  }, { tutorPreferido: tutorDestino }));
  if (r.duplicado) return { resultado: 'repetido' };
  logger.info({ projectId, consultaId: r.consulta?.id, nueva: r.nueva }, 'consultas: mensaje del campus por el plugin');
  return { resultado: r.nueva ? 'consulta_nueva' : 'mensaje', consultaId: r.consulta?.id ?? null };
}
