import crypto from 'node:crypto';
import { AppError } from '../../shared/utils/AppError.js';
import { logger } from '../../shared/utils/logger.js';
import { acotarProyectos } from './mcp.acceso.js';
import { enteroEnv } from './mcp.config.js';
import { credencialesMoodle, llamarMoodle, ErrorMoodle } from './mcp.moodle.cliente.js';
import {
  comprobarEnlace, extraerUrls, limiteEnlaces, mapConLimite, tipoDeEnlace,
} from './mcp.moodle.enlaces.js';

/**
 * Lo que Claude puede preguntarle al Moodle de cada campus (#335).
 *
 * Solo lectura (ver `mcp.moodle.cliente.js`), y con las mismas reglas que el
 * resto del MCP:
 *
 *   · `acotarProyectos`: el campus lo marca la persona; uno ajeno es un 403.
 *   · NUNCA un cero que sea en realidad «no he podido mirar». Un campus sin
 *     Moodle configurado, con el token caducado o que no responde se DICE, por
 *     campus, en `campus_con_error`. Si piden varios y falla uno, el resto
 *     contesta. Si fallan todos, es un error de la herramienta.
 *   · Alumnos: por defecto solo RECUENTOS. Nombre y correo, solo con
 *     `datos_completos` y solo super admin y admin (queda en la auditoria).
 *
 * Sin un Moodle real delante: ver la cabecera de `mcp.moodle.cliente.js`.
 */

const MAX_CAMPUS_A_LA_VEZ = 3;
const MAX_CURSOS_A_LA_VEZ = 3;
const POR_PAGINA_MOODLE = 500;
const SEGUNDOS_DIA = 86400;

/** Hasta cuantos alumnos de UN curso se leen (MCP_MOODLE_MAX_ALUMNOS, 5000). */
const maxAlumnos = () => enteroEnv('MCP_MOODLE_MAX_ALUMNOS', 5000);

// ─── Cache de la lista de cursos ──────────────────────────────────────────
//
// Pedir los cursos de un Moodle son un par de segundos y casi nunca cambian:
// se guardan en memoria unos minutos (MCP_MOODLE_CACHE_MIN, 5; 0 = sin cache).
// Con tope de entradas (MCP_MOODLE_CACHE_MAX, 50): al pasarse se tira la mas
// antigua. La clave lleva una huella de URL+token: si se cambia la credencial,
// la cache vieja deja de valer sola. Solo se guardan cursos y categorias, nada
// de personas. `refrescar: true` se la salta.

const cache = new Map();
const ttlMs = () => enteroEnv('MCP_MOODLE_CACHE_MIN', 5, { cero: true }) * 60_000;
const maxEntradasCache = () => enteroEnv('MCP_MOODLE_CACHE_MAX', 50);

export const vaciarCacheMoodle = () => cache.clear();
export const entradasEnCacheMoodle = () => cache.size;

const huellaDeCredencial = (cred) => crypto.createHash('sha256').update(`${cred.url}\0${cred.token}`).digest('hex').slice(0, 16);

async function conCache(clave, refrescar, cargar) {
  const ttl = ttlMs();
  const ahora = Date.now();
  if (ttl > 0 && !refrescar) {
    const e = cache.get(clave);
    if (e && ahora - e.en < ttl) return { datos: e.datos, deCache: true, hace_s: Math.round((ahora - e.en) / 1000) };
    if (e) cache.delete(clave);
  }
  const datos = await cargar();
  if (ttl > 0) {
    cache.delete(clave);
    cache.set(clave, { en: ahora, datos });
    while (cache.size > maxEntradasCache()) cache.delete(cache.keys().next().value);
  }
  return { datos, deCache: false, hace_s: 0 };
}

// ─── Cursos y categorias de un Moodle ─────────────────────────────────────

const fechaIso = (seg) => (Number(seg) > 0 ? new Date(Number(seg) * 1000).toISOString().slice(0, 10) : null);

/**
 * Los cursos del Moodle, ya normalizados (solo lo que hace falta; el resumen y
 * la descripcion de cada curso no se guardan). Los que ve el TOKEN: si no tiene
 * permiso para ver los ocultos, no salen.
 */
async function cargarCursos(cred, signal) {
  const r = await llamarMoodle(cred, 'core_course_get_courses_by_field', {}, { signal });
  if (!r || !Array.isArray(r.courses)) {
    throw new ErrorMoodle('respuesta_no_valida', 'Moodle no devolvió la lista de cursos con el formato esperado');
  }
  return r.courses
    .filter((c) => c && Number.isInteger(Number(c.id)) && c.format !== 'site')
    .map((c) => ({
      id: Number(c.id),
      nombre: String(c.displayname || c.fullname || c.shortname || `Curso ${c.id}`),
      nombre_corto: c.shortname ? String(c.shortname) : null,
      categoria_id: c.categoryid != null ? Number(c.categoryid) : null,
      categoria: c.categoryname ? String(c.categoryname) : null,
      inicio_s: Number(c.startdate) || 0,
      fin_s: Number(c.enddate) || 0,
      visible: c.visible === undefined ? true : Number(c.visible) === 1 || c.visible === true,
      finalizacion: Number(c.enablecompletion) === 1 || c.enablecompletion === true,
    }));
}

/** activo · proximo (aun no empieza) · terminado · oculto. */
export function estadoDelCurso(c, ahoraS = Math.floor(Date.now() / 1000)) {
  if (!c.visible) return 'oculto';
  if (c.fin_s && c.fin_s <= ahoraS) return 'terminado';
  if (c.inicio_s && c.inicio_s > ahoraS) return 'proximo';
  return 'activo';
}

const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const ESTADOS = { activos: 'activo', proximos: 'proximo', terminados: 'terminado', ocultos: 'oculto' };

function filtrarCursos(cursos, { estado = 'activos', texto, categoria_id, curso_id } = {}, ahoraS) {
  if (curso_id != null) return cursos.filter((c) => c.id === Number(curso_id));
  const buscado = texto ? sinTildes(texto) : null;
  return cursos.filter((c) => {
    if (estado !== 'todos' && estadoDelCurso(c, ahoraS) !== ESTADOS[estado]) return false;
    if (categoria_id != null && c.categoria_id !== Number(categoria_id)) return false;
    if (buscado && !sinTildes(`${c.nombre} ${c.nombre_corto || ''}`).includes(buscado)) return false;
    return true;
  });
}

const filaDeCurso = (c, campus, ahoraS) => ({
  campus_id: campus.id,
  campus: campus.nombre,
  curso_id: c.id,
  nombre: c.nombre,
  nombre_corto: c.nombre_corto,
  categoria: c.categoria,
  estado: estadoDelCurso(c, ahoraS),
  inicio: fechaIso(c.inicio_s),
  fin: fechaIso(c.fin_s),
  finalizacion_activada: c.finalizacion,
});

async function cursosDelCampus(campus, refrescar, signal) {
  return conCache(`cursos:${campus.id}:${huellaDeCredencial(campus.cred)}`, refrescar, () => cargarCursos(campus.cred, signal));
}

// ─── Campus: credenciales y errores por campus ────────────────────────────

/** El mensaje de un campus que falla: siempre empieza por el nombre del campus. */
function errorDelCampus(err, campus) {
  if (err instanceof ErrorMoodle) {
    return { campus_id: campus.id, campus: campus.nombre, codigo: err.codigo, error: `${campus.nombre}: ${err.message}` };
  }
  // Algo nuestro (no de Moodle). Al log solo el nombre y el codigo: nada de
  // mensajes de la libreria de red, que pueden traer la URL.
  logger.error({ tipo: err?.name, code: err?.code, campusId: campus.id }, 'MCP Moodle: fallo inesperado');
  return { campus_id: campus.id, campus: campus.nombre, codigo: 'inesperado', error: `${campus.nombre}: error inesperado al consultar Moodle` };
}

/** Si TODOS los campus pedidos fallan, es un error de la herramienta, no un resultado. */
function todosFallaron(errores) {
  const sinConfigurar = errores.every((e) => e.codigo === 'sin_configurar');
  return new AppError(
    `No se pudo consultar Moodle. ${errores.map((e) => e.error).join('; ')}.`
    + (sinConfigurar ? ' (La credencial «moodle» de cada campus se configura en Configuración → Claves.)' : ''),
    sinConfigurar ? 409 : 502,
    'MOODLE_NO_DISPONIBLE'
  );
}

/**
 * Corre `trabajo` en cada campus pedido, de a pocos, y separa lo que sale bien
 * de lo que falla. `trabajo({id, nombre, cred})` devuelve los datos del campus.
 */
async function porCampus(ambito, projectIds, trabajo) {
  const nombres = new Map(ambito.proyectos.map((p) => [Number(p.id), p.nombre]));
  const creds = await credencialesMoodle(projectIds);
  const salidas = await mapConLimite(projectIds, MAX_CAMPUS_A_LA_VEZ, async (id) => {
    const campus = { id, nombre: nombres.get(id) || `campus ${id}`, cred: creds.get(id) };
    try {
      if (!campus.cred) throw new ErrorMoodle('sin_configurar', 'sin Moodle configurado');
      if (campus.cred instanceof ErrorMoodle) throw campus.cred;
      return { campus, datos: await trabajo(campus) };
    } catch (err) {
      return { campus, error: errorDelCampus(err, campus) };
    }
  });
  const bien = salidas.filter((s) => !s.error);
  const errores = salidas.filter((s) => s.error).map((s) => s.error);
  if (!bien.length) throw todosFallaron(errores);
  return { bien, errores };
}

/**
 * El paso comun de alumnos y recursos: en cada campus, los cursos que encajan
 * con el filtro. Devuelve la lista PLANA de {campus, curso}, recortada a
 * `limite_cursos` entre todos los campus, y cuantos se quedaron fuera.
 */
async function elegirCursos(ambito, projectIds, a, signal) {
  if (a.curso_id != null && projectIds.length > 1) {
    throw new AppError(
      'Un curso es de un Moodle concreto: indica el campus con proyecto_id (los ids de curso se repiten entre campus).',
      400, 'MCP_FALTA_CAMPUS'
    );
  }
  const ahoraS = Math.floor(Date.now() / 1000);
  const { bien, errores } = await porCampus(ambito, projectIds, async (campus) => {
    const { datos } = await cursosDelCampus(campus, a.refrescar === true, signal);
    const elegidos = filtrarCursos(datos, a, ahoraS);
    if (a.curso_id != null && !elegidos.length) {
      throw new ErrorMoodle('curso_no_encontrado',
        `el curso ${a.curso_id} no existe en ese Moodle o el token no lo ve (si es nuevo, prueba con refrescar: true)`);
    }
    return elegidos;
  });
  const todos = bien.flatMap((b) => b.datos.map((curso) => ({ campus: b.campus, curso })))
    .sort((x, y) => x.campus.nombre.localeCompare(y.campus.nombre) || x.curso.nombre.localeCompare(y.curso.nombre));
  const limite = a.limite_cursos ?? 10;
  return {
    cursos: todos.slice(0, limite),
    sinConsultar: Math.max(0, todos.length - limite),
    coincidentes: todos.length,
    errores,
  };
}

const AVISO_LIMITE = (n, limite) => `Hay ${n} cursos más que encajan y no se han consultado (el tope es ${limite} por petición): acota con texto, categoria_id o curso_id, o sube limite_cursos.`;

function avisoSinCursos(a) {
  const estado = a.estado ?? 'activos';
  return `Ningún curso encaja con el filtro${a.texto ? ` «${a.texto}»` : ''} (estado: ${estado}). Esto NO significa que no haya alumnos o recursos: no hay curso que mirar.`
    + (estado !== 'todos' ? ' Prueba con estado: "todos" (por defecto solo se miran los activos).' : '');
}

// ─── moodle_cursos ────────────────────────────────────────────────────────

export async function moodleCursos(ambito, a, { signal } = {}) {
  const projectIds = acotarProyectos(ambito, a);
  const ahoraS = Math.floor(Date.now() / 1000);
  const { bien, errores } = await porCampus(ambito, projectIds, async (campus) => {
    const { datos, deCache, hace_s: haceS } = await cursosDelCampus(campus, a.refrescar === true, signal);
    const cuenta = { activos: 0, proximos: 0, terminados: 0, ocultos: 0 };
    for (const c of datos) cuenta[`${estadoDelCurso(c, ahoraS)}s`] += 1;
    const filtrados = filtrarCursos(datos, a, ahoraS);
    return { cuenta, total: datos.length, filtrados, deCache, haceS };
  });

  const filas = bien
    .flatMap((b) => b.datos.filtrados.map((c) => filaDeCurso(c, b.campus, ahoraS)))
    .sort((x, y) => x.campus.localeCompare(y.campus) || x.nombre.localeCompare(y.nombre));
  const pagina = a.pagina ?? 1;
  const limite = a.limite ?? 25;
  return {
    filtro: { estado: a.estado ?? 'activos', texto: a.texto ?? null, categoria_id: a.categoria_id ?? null },
    por_campus: bien.map((b) => ({
      campus_id: b.campus.id,
      campus: b.campus.nombre,
      cursos_en_moodle: b.datos.total,
      ...b.datos.cuenta,
      coincidentes: b.datos.filtrados.length,
      de_cache: b.datos.deCache,
      actualizado_hace_s: b.datos.haceS,
    })),
    total: filas.length,
    pagina,
    limite,
    cursos: filas.slice((pagina - 1) * limite, pagina * limite),
    campus_con_error: errores,
    nota: 'Son los cursos que ve el token de Moodle de cada campus. «activo» = visible y sin fecha de fin pasada; '
      + 'un curso sin fecha de fin cuenta como activo mientras esté visible. Los datos pueden tener hasta unos minutos (refrescar: true los pide de nuevo).',
  };
}

// ─── moodle_alumnos ───────────────────────────────────────────────────────

/** Todos los matriculados de un curso, de 500 en 500, hasta el tope. */
async function leerMatriculados(cred, cursoId, { campos, soloActivos = false, signal }) {
  const lista = [];
  let truncado = false;
  for (let desde = 0; ; desde += POR_PAGINA_MOODLE) {
    const opciones = [
      { name: 'userfields', value: campos },
      { name: 'limitfrom', value: desde },
      { name: 'limitnumber', value: POR_PAGINA_MOODLE },
      ...(soloActivos ? [{ name: 'onlyactive', value: 1 }] : []),
    ];
    const r = await llamarMoodle(cred, 'core_enrol_get_enrolled_users', { courseid: cursoId, options: opciones }, { signal });
    if (!Array.isArray(r)) {
      throw new ErrorMoodle('respuesta_no_valida', 'Moodle no devolvió la lista de matriculados con el formato esperado');
    }
    lista.push(...r);
    if (r.length < POR_PAGINA_MOODLE) break;
    if (lista.length >= maxAlumnos()) {
      truncado = true;
      break;
    }
  }
  return { lista, truncado };
}

const esAlumno = (u) => {
  // Sin roles en la respuesta no se puede distinguir: cuenta como alumno.
  if (!Array.isArray(u.roles) || !u.roles.length) return true;
  return u.roles.some((r) => r?.shortname === 'student');
};

/**
 * Los numeros de UN curso. Las cifras que no se han podido saber van a `null`
 * con su motivo en `avisos`: nunca un 0 que parezca un dato.
 */
export async function recuentoDeAlumnos(cred, curso, { completos = false, dias = 30, signal } = {}) {
  const campos = ['id', 'lastaccess', 'lastcourseaccess', 'roles', ...(completos ? ['fullname', 'email'] : [])].join(',');
  const { lista, truncado } = await leerMatriculados(cred, curso.id, { campos, signal });

  // Con matricula activa (no suspendida ni fuera de plazo) = los que devuelve
  // «onlyactive». Pide el permiso de revisar matriculas; si no lo tiene el
  // token, los suspendidos se quedan sin saber.
  let activas = null;
  const avisos = [];
  try {
    const r = await leerMatriculados(cred, curso.id, { campos: 'id', soloActivos: true, signal });
    activas = new Set(r.lista.map((u) => u.id));
  } catch (err) {
    if (!(err instanceof ErrorMoodle) || !['sin_permiso', 'moodle'].includes(err.codigo)) throw err;
    avisos.push('No se pudo saber qué matrículas están suspendidas (el token no tiene permiso para revisarlas).');
  }

  const desdeS = Math.floor(Date.now() / 1000) - dias * SEGUNDOS_DIA;
  const alumnos = lista.filter(esAlumno);
  const ultimoAcceso = (u) => Number(u.lastcourseaccess !== undefined ? u.lastcourseaccess : u.lastaccess) || 0;
  const hayAcceso = alumnos.some((u) => u.lastcourseaccess !== undefined || u.lastaccess !== undefined);
  if (alumnos.length && !hayAcceso) avisos.push('Moodle no devolvió la fecha de último acceso: no se pueden contar los activos.');

  let suspendidos = 0;
  let activosRecientes = 0;
  let nuncaEntraron = 0;
  const detalle = [];
  for (const u of alumnos) {
    const matricula = activas ? (activas.has(u.id) ? 'activa' : 'suspendida') : 'desconocida';
    if (matricula === 'suspendida') suspendidos += 1;
    const ult = ultimoAcceso(u);
    if (hayAcceso && !ult) nuncaEntraron += 1;
    if (hayAcceso && ult >= desdeS && matricula !== 'suspendida') activosRecientes += 1;
    if (completos) {
      detalle.push({
        id_moodle: u.id,
        nombre: u.fullname ?? null,
        email: u.email ?? null,
        ultimo_acceso: ult ? new Date(ult * 1000).toISOString().slice(0, 10) : null,
        matricula,
      });
    }
  }
  if (truncado) avisos.push(`Hay más de ${maxAlumnos()} matriculados: el recuento está incompleto.`);

  return {
    matriculados: alumnos.length,
    matricula_activa: activas ? alumnos.length - suspendidos : null,
    suspendidos: activas ? suspendidos : null,
    [`activos_ultimos_${dias}_dias`]: hayAcceso ? activosRecientes : null,
    nunca_han_entrado: hayAcceso ? nuncaEntraron : null,
    // Moodle no da quién ha terminado con las funciones de solo lectura
    // autorizadas (haría falta preguntar alumno por alumno).
    terminados: null,
    finalizacion_activada: curso.finalizacion,
    otros_roles: lista.length - alumnos.length,
    ...(avisos.length ? { avisos } : {}),
    ...(completos ? { alumnos: detalle } : {}),
  };
}

const SUMAS = ['matriculados', 'matricula_activa', 'suspendidos', 'nunca_han_entrado'];

export async function moodleAlumnos(ambito, a, { signal } = {}) {
  const projectIds = acotarProyectos(ambito, a);
  const completos = a.datos_completos === true;
  if (completos && ambito.soloLoSuyo) {
    throw new AppError(
      'Los nombres y correos de los alumnos de Moodle solo los ve super admin o admin. Los recuentos, sí (sin datos_completos).',
      403, 'MCP_SOLO_ADMIN'
    );
  }
  const dias = a.dias_actividad ?? 30;
  const { cursos, sinConsultar, coincidentes, errores } = await elegirCursos(ambito, projectIds, a, signal);

  const filas = await mapConLimite(cursos, MAX_CURSOS_A_LA_VEZ, async ({ campus, curso }) => {
    const base = { campus_id: campus.id, campus: campus.nombre, curso_id: curso.id, curso: curso.nombre, estado: estadoDelCurso(curso) };
    try {
      return { ...base, ...(await recuentoDeAlumnos(campus.cred, curso, { completos, dias, signal })) };
    } catch (err) {
      if (signal?.aborted) throw err;
      return { ...base, error: errorDelCampus(err, campus).error };
    }
  });

  const buenas = filas.filter((f) => !f.error);
  const totales = Object.fromEntries(SUMAS.map((k) => [k, buenas.some((f) => f[k] === null) ? null : buenas.reduce((s, f) => s + f[k], 0)]));
  const clave = `activos_ultimos_${dias}_dias`;
  totales[clave] = buenas.some((f) => f[clave] === null) ? null : buenas.reduce((s, f) => s + f[clave], 0);

  return {
    cursos_consultados: filas.length,
    cursos_que_encajan: coincidentes,
    cursos_sin_consultar: sinConsultar,
    ...(sinConsultar ? { aviso: AVISO_LIMITE(sinConsultar, a.limite_cursos ?? 10) } : {}),
    ...(!coincidentes && !errores.length ? { aviso: avisoSinCursos(a) } : {}),
    cursos: filas,
    cursos_con_error: filas.filter((f) => f.error).length,
    totales_suma_de_matriculas: totales,
    campus_con_error: errores,
    nota: `«Activos» = matrícula activa y acceso al curso en los últimos ${dias} días. Un alumno matriculado en dos cursos cuenta en cada uno. `
      + '«Terminados» no se puede dar: Moodle solo lo informa alumno por alumno y esta herramienta no lo hace; finalizacion_activada dice si el curso tiene finalización.',
  };
}

// ─── moodle_recursos_externos ─────────────────────────────────────────────

const TIPOS_RECURSO = ['youtube', 'vimeo', 'drive', 'lti', 'enlace'];

/**
 * Los recursos externos de UN curso, a partir de lo que dijo Moodle:
 * `contenidos` (core_course_get_contents) y `urlsDelCurso` (los modulos «URL»
 * de mod_url_get_urls_by_courses, por id de modulo).
 */
export function recursosDelCurso(contenidos, urlsPorModulo, hostMoodle = null) {
  const recursos = [];
  let sinUrl = 0;
  for (const seccion of Array.isArray(contenidos) ? contenidos : []) {
    for (const m of Array.isArray(seccion?.modules) ? seccion.modules : []) {
      const base = {
        nombre: String(m.name ?? ''),
        seccion: seccion.name ? String(seccion.name) : null,
        visible: m.visible === undefined ? true : Number(m.visible) === 1 || m.visible === true,
      };
      if (m.modname === 'url') {
        const fallback = Array.isArray(m.contents) ? m.contents.find((c) => c?.type === 'url')?.fileurl : null;
        const url = urlsPorModulo.get(Number(m.id)) || fallback || null;
        if (!url) { sinUrl += 1; continue; }
        recursos.push({ ...base, tipo: tipoDeEnlace(url), url, origen: 'modulo_url' });
      } else if (m.modname === 'lti') {
        recursos.push({ ...base, tipo: 'lti', url: null, origen: 'herramienta_externa' });
      }
      // Enlaces escritos en la descripcion de CUALQUIER modulo (una etiqueta
      // con un video incrustado, por ejemplo).
      for (const url of extraerUrls(m.description)) {
        if (hostMoodle && new URL(url).host === hostMoodle) continue; // interno de Moodle
        recursos.push({ ...base, tipo: tipoDeEnlace(url), url, origen: 'descripcion' });
      }
    }
  }
  return { recursos, sinUrl };
}

const ROTOS = ['roto', 'no_responde', 'error_servidor'];

export async function moodleRecursosExternos(ambito, a, { signal } = {}) {
  const projectIds = acotarProyectos(ambito, a);
  const comprobar = a.comprobar_enlaces === true;
  if (comprobar && ambito.soloLoSuyo) {
    throw new AppError(
      'Comprobar si los enlaces responden lo hace super admin o admin. Puedes ver los recursos sin comprobar_enlaces.',
      403, 'MCP_SOLO_ADMIN'
    );
  }
  const { cursos, sinConsultar, coincidentes, errores } = await elegirCursos(ambito, projectIds, a, signal);

  // Los modulos «URL» de todos los cursos de un campus, en UNA llamada.
  const urlsPorCampus = new Map();
  const falloPorCampus = new Map();
  const campus = [...new Map(cursos.map((c) => [c.campus.id, c.campus])).values()];
  await mapConLimite(campus, MAX_CAMPUS_A_LA_VEZ, async (c) => {
    const ids = cursos.filter((x) => x.campus.id === c.id).map((x) => x.curso.id);
    try {
      const r = await llamarMoodle(c.cred, 'mod_url_get_urls_by_courses', { courseids: ids }, { signal });
      const mapa = new Map();
      for (const u of Array.isArray(r?.urls) ? r.urls : []) {
        if (u?.externalurl) mapa.set(Number(u.coursemodule), String(u.externalurl));
      }
      urlsPorCampus.set(c.id, mapa);
    } catch (err) {
      if (signal?.aborted) throw err;
      // Un permiso que falta no tumba el resto: la direccion de los modulos
      // «URL» tambien viene en los contenidos del curso.
      if (err instanceof ErrorMoodle && ['sin_permiso', 'moodle'].includes(err.codigo)) urlsPorCampus.set(c.id, new Map());
      else falloPorCampus.set(c.id, err);
    }
  });

  const filas = await mapConLimite(cursos, MAX_CURSOS_A_LA_VEZ, async ({ campus: c, curso }) => {
    const base = { campus_id: c.id, campus: c.nombre, curso_id: curso.id, curso: curso.nombre, estado: estadoDelCurso(curso) };
    try {
      if (falloPorCampus.has(c.id)) throw falloPorCampus.get(c.id);
      const contenidos = await llamarMoodle(c.cred, 'core_course_get_contents', { courseid: curso.id }, { signal });
      if (!Array.isArray(contenidos)) {
        throw new ErrorMoodle('respuesta_no_valida', 'Moodle no devolvió el contenido del curso con el formato esperado');
      }
      const { recursos, sinUrl } = recursosDelCurso(contenidos, urlsPorCampus.get(c.id) || new Map(), new URL(c.cred.url).host);
      return { ...base, recursos, sin_url: sinUrl };
    } catch (err) {
      if (signal?.aborted) throw err;
      return { ...base, error: errorDelCampus(err, c).error };
    }
  });

  // Comprobar enlaces: los distintos, hasta el tope, de pocos en pocos.
  let comprobados = 0;
  let sinComprobar = 0;
  if (comprobar) {
    const distintos = [...new Set(filas.flatMap((f) => (f.recursos || []).map((r) => r.url).filter(Boolean)))];
    const aMirar = distintos.slice(0, limiteEnlaces());
    sinComprobar = distintos.length - aMirar.length;
    const tipoDe = new Map(filas.flatMap((f) => (f.recursos || []).filter((r) => r.url).map((r) => [r.url, r.tipo])));
    const resultados = new Map();
    await mapConLimite(aMirar, 4, async (url) => {
      resultados.set(url, await comprobarEnlace(url, tipoDe.get(url)));
    });
    comprobados = aMirar.length;
    for (const f of filas) {
      for (const r of f.recursos || []) {
        if (!r.url) continue;
        const res = resultados.get(r.url);
        Object.assign(r, res ? { estado: res.estado, ...(res.http ? { http: res.http } : {}), ...(res.detalle ? { detalle: res.detalle } : {}) } : { estado: 'sin_comprobar' });
      }
    }
  }

  // Resumen por curso y global; los cursos con error no cuentan como «sin recursos».
  const porTipoGlobal = Object.fromEntries(TIPOS_RECURSO.map((t) => [t, 0]));
  let conRecursos = 0;
  let sinRecursos = 0;
  let rotos = 0;
  const salida = filas.map((f) => {
    if (f.error) return f;
    const porTipo = Object.fromEntries(TIPOS_RECURSO.map((t) => [t, f.recursos.filter((r) => r.tipo === t).length]));
    for (const t of TIPOS_RECURSO) porTipoGlobal[t] += porTipo[t];
    if (f.recursos.length) conRecursos += 1; else sinRecursos += 1;
    const rotosDelCurso = f.recursos.filter((r) => ROTOS.includes(r.estado)).length;
    rotos += rotosDelCurso;
    const lista = (a.tipo ? f.recursos.filter((r) => r.tipo === a.tipo) : f.recursos)
      .filter((r) => !a.solo_rotos || ROTOS.includes(r.estado));
    return {
      campus_id: f.campus_id, campus: f.campus, curso_id: f.curso_id, curso: f.curso, estado: f.estado,
      total_recursos_externos: f.recursos.length,
      por_tipo: porTipo,
      ...(comprobar ? { enlaces_rotos: rotosDelCurso } : {}),
      ...(f.sin_url ? { modulos_url_sin_direccion: f.sin_url } : {}),
      recursos: lista,
    };
  });

  const avisos = [];
  if (sinConsultar) avisos.push(AVISO_LIMITE(sinConsultar, a.limite_cursos ?? 10));
  if (!coincidentes && !errores.length) avisos.push(avisoSinCursos(a));
  if (sinComprobar) avisos.push(`Solo se han comprobado ${comprobados} enlaces (tope por petición); ${sinComprobar} quedan con estado «sin_comprobar».`);

  return {
    cursos_consultados: salida.length,
    cursos_que_encajan: coincidentes,
    cursos_sin_consultar: sinConsultar,
    resumen: {
      cursos_con_recursos_externos: conRecursos,
      cursos_sin_recursos_externos: sinRecursos,
      cursos_con_error: salida.filter((f) => f.error).length,
      por_tipo: porTipoGlobal,
      ...(comprobar ? { enlaces_comprobados: comprobados, enlaces_sin_comprobar: sinComprobar, enlaces_rotos: rotos } : {}),
    },
    ...(avisos.length ? { avisos } : {}),
    cursos: salida,
    campus_con_error: errores,
    nota: 'Recursos externos = módulos «URL» y enlaces o videos escritos en la descripción de las actividades; las herramientas externas (LTI) se listan pero su dirección no se puede ver ni comprobar. '
      + (comprobar
        ? 'Estados: ok · roto (404/410 o dominio inexistente) · restringido (401/403/429: existe pero pide acceso o no deja mirar; NO es lo mismo que roto) · error_servidor · no_responde · bloqueado (dirección interna, no se comprueba).'
        : 'No se ha comprobado si los enlaces responden (comprobar_enlaces: true, solo super admin y admin).'),
  };
}

// ─── moodle_estructura ────────────────────────────────────────────────────

async function cargarCategorias(cred, signal) {
  const r = await llamarMoodle(cred, 'core_course_get_categories', {}, { signal });
  if (!Array.isArray(r)) {
    throw new ErrorMoodle('respuesta_no_valida', 'Moodle no devolvió las categorías con el formato esperado');
  }
  const porId = new Map(r.map((c) => [Number(c.id), c]));
  const ruta = (c) => {
    const partes = [];
    for (let x = c, n = 0; x && n < 20; x = porId.get(Number(x.parent)), n += 1) partes.unshift(String(x.name));
    return partes.join(' > ');
  };
  return r.map((c) => ({
    id: Number(c.id),
    nombre: String(c.name),
    ruta: ruta(c),
    padre_id: Number(c.parent) || null,
    profundidad: Number(c.depth) || 1,
    cursos: Number(c.coursecount) || 0,
    visible: c.visible === undefined ? true : Number(c.visible) === 1 || c.visible === true,
  })).sort((x, y) => x.ruta.localeCompare(y.ruta));
}

export async function moodleEstructura(ambito, a, { signal } = {}) {
  const projectIds = acotarProyectos(ambito, a);
  const { bien, errores } = await porCampus(ambito, projectIds, async (campus) => {
    const r = await conCache(`categorias:${campus.id}:${huellaDeCredencial(campus.cred)}`, a.refrescar === true,
      () => cargarCategorias(campus.cred, signal));
    return r;
  });
  return {
    campus: bien.map((b) => ({
      campus_id: b.campus.id,
      campus: b.campus.nombre,
      total_categorias: b.datos.datos.length,
      categorias: b.datos.datos,
      de_cache: b.datos.deCache,
      actualizado_hace_s: b.datos.hace_s,
    })),
    campus_con_error: errores,
    nota: 'Las categorías de cursos de cada Moodle, con cuántos cursos tiene cada una (los que cuenta Moodle, incluidos los ocultos que el token pueda ver).',
  };
}
