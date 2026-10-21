import { z } from 'zod';
import { AppError } from '../../shared/utils/AppError.js';
import * as reportes from '../reports/report.model.js';
import * as model from './mcp.model.js';
import { acotarProyectos, responsableImpuesto } from './mcp.acceso.js';
import { enteroEnv } from './mcp.config.js';
import * as moodle from './mcp.moodle.js';

/**
 * Las herramientas que ve Claude. TODAS son de lectura: no hay ni una que
 * cree, cambie o borre nada, y la prueba `mcpSoloLectura` lo vigila.
 *
 * Cada herramienta recibe el `ambito` de la persona (lo calcula el servidor a
 * partir del token, no lo manda Claude) y los argumentos ya validados con Zod.
 * El `proyecto_id`/`sociedad_id` que mande Claude solo sirve para ESTRECHAR
 * dentro de lo suyo: `acotarProyectos` rechaza lo que no le pertenece.
 */

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato AAAA-MM-DD');

const AMBITO = {
  proyecto_id: z.number().int().positive().optional()
    .describe('Un campus concreto (id de «mis_proyectos»). Sin él: todos los tuyos.'),
  sociedad_id: z.number().int().positive().optional()
    .describe('Una empresa/sociedad (id de «mis_proyectos»): sus campus que sean tuyos.'),
};
const PERIODO = {
  desde: fecha.optional().describe('Fecha inicial, AAAA-MM-DD'),
  hasta: fecha.optional().describe('Fecha final, AAAA-MM-DD'),
};
/**
 * Datos personales (#196): correos y teléfonos salen enmascarados y, en los
 * listados, los clientes como «Pedro S.». Esto los da enteros. Queda en la
 * auditoría (Conexión → MCP → Actividad).
 */
const DATOS_COMPLETOS = {
  datos_completos: z.boolean().optional()
    .describe('true SOLO si la persona necesita el correo, el teléfono o el nombre completo (por ejemplo, para contactar a alguien). Queda registrado.'),
};

const PAGINA = {
  pagina: z.number().int().min(1).max(1000).default(1),
  limite: z.number().int().min(1).max(100).default(25),
};

/** Lo comun a todas: los campus sobre los que se consulta y el dueño impuesto. */
const acotar = (ambito, args) => ({
  projectIds: acotarProyectos(ambito, args),
  responsableId: responsableImpuesto(ambito),
});

/** Ningun informe puede tener la base ocupada mas de esto. */
export const TOPE_INFORME_MS = 8000;

/**
 * Los informes: las MISMAS funciones que Reportes, para que Claude dé el mismo
 * numero que la pantalla. Todas aceptan `projectIds` y `asesoraId`.
 */
export const INFORMES = {
  resumen_general: {
    descripcion: 'Leads por estado y canal, conversiones y dinero cobrado del periodo (solo super admin y admin).',
    ejecutar: reportes.overview,
    // `overview` no aplicaba `asesoraId` hasta el 19/10/2026 (ver su
    // comentario: «Tu semana» de las gestoras). Ya lo aplica, pero esto sigue
    // siendo solo para admin, como la pantalla (`roleGuard` en /overview): la
    // gestora tiene su propio resumen. Lo vigila `mcpAmbito.test.js`.
    soloAdmin: true,
  },
  resumen_mensual: {
    descripcion: 'Lo mismo desglosado mes a mes.',
    ejecutar: reportes.resumenMensual,
  },
  ventas_por_asesora: {
    descripcion: 'Cada venta con su asesora, fecha e importe.',
    ejecutar: reportes.ventasPorAsesoraReport,
  },
  tasa_de_cierre: {
    descripcion: 'Porcentaje de prospectos que acaban comprando.',
    ejecutar: reportes.tasaDeCierre,
  },
  seguimiento: {
    descripcion: 'Tiempos de primer contacto y seguimiento de los prospectos.',
    ejecutar: reportes.seguimientoYTiempos,
  },
  cobros_mensuales: {
    descripcion: 'Dinero cobrado mes a mes.',
    ejecutar: reportes.cobrosMensuales,
  },
  paises: {
    descripcion: 'Países que más compran.',
    ejecutar: reportes.paisesMasVendidos,
  },
  formaciones: {
    descripcion: 'Formaciones (productos) más vendidas.',
    ejecutar: reportes.formacionesMasVendidas,
  },
  // Diego, 08/10: «en los reportes el ranking de gestora es por lo cobrado» (antes, del 30/09 al 08/10, por lo facturado).
  // El mismo calculo que «Cómo voy» (`miPuesto`), para que
  // Claude no conteste «la mejor comercial» con otra medida.
  //
  // Solo super admin y admin: el puesto se calcula con los numeros de TODO el
  // equipo, y por Claude una gestora no saca cifras de nadie mas (lo vigila
  // `mcpAmbito.test.js`). Su puesto lo ve en «Cómo voy».
  ranking_gestoras: {
    descripcion: 'El ranking de gestoras, que se mide por lo COBRADO: los pagos registrados en el periodo, por su fecha de cobro. '
      + 'Es la respuesta a «quién es la mejor comercial» (solo super admin y admin).',
    ejecutar: ({ projectIds, from, to }) => reportes.miPuesto({ userId: 0, projectIds, from, to, esJefe: true }),
    soloAdmin: true,
  },
};

/**
 * Lo de tutores es de administracion: lo que se le paga a cada profesor no lo
 * ve una gestora, igual que en la pantalla (Tutores pide admin, superadmin o
 * quien lleva las colaboraciones). Se llama DESPUES de acotar, para que un
 * campus ajeno se rechace por ajeno y no por esto.
 */
function soloAdministracion(ambito, herramienta) {
  if (ambito.soloLoSuyo) {
    throw new AppError(`«${herramienta}» es de administración: solo la ven super admin y admin.`, 403, 'MCP_SOLO_ADMIN');
  }
}

async function conTope(promesa, ms, nombre, { sujeto = 'El informe', sugerencia = 'Prueba con un periodo más corto.' } = {}) {
  let reloj;
  const tope = new Promise((_, rechazar) => {
    reloj = setTimeout(() => rechazar(new AppError(`${sujeto} «${nombre}» tardó más de ${ms / 1000} s y se cortó. ${sugerencia}`, 504, 'MCP_LENTO')), ms);
  });
  try {
    return await Promise.race([promesa, tope]);
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Ninguna consulta a Moodle puede tener la herramienta ocupada mas de esto
 * (MCP_MOODLE_TOPE_MS, 25 s): son varias llamadas por red a un servidor ajeno.
 * Al cortar se cancelan tambien las peticiones que sigan en vuelo.
 */
export const topeMoodleMs = () => enteroEnv('MCP_MOODLE_TOPE_MS', 25000);

async function moodleConTope(nombre, trabajo) {
  const control = new AbortController();
  try {
    return await conTope(trabajo(control.signal), topeMoodleMs(), nombre, {
      sujeto: 'La consulta',
      sugerencia: 'Acota con texto, categoria_id o curso_id, o pide menos cursos.',
    });
  } catch (err) {
    control.abort();
    throw err;
  }
}

export const HERRAMIENTAS = [
  {
    nombre: 'mis_proyectos',
    titulo: 'Mis campus y empresas',
    descripcion: 'Lista los campus (proyectos) y empresas (sociedades) del CRM a los que tienes acceso, y si ves todo el campus o solo tus propios registros. Úsala primero para conocer los ids.',
    entrada: {},
    ejecutar: async (ambito) => ({
      persona: ambito.nombre,
      rol: ambito.role,
      alcance: ambito.soloLoSuyo
        ? 'Solo tus propios prospectos, ventas y facturas dentro de tus campus.'
        : 'Todos los datos de tus campus.',
      proyectos: ambito.proyectos,
      // Con un solo campus no hay nada que elegir (#220): se dice para que
      // Claude no pregunte «¿de qué campus?» ni pase ids en cada consulta.
      ...(ambito.proyectos.length === 1 ? {
        campus_unico: `Solo tienes un campus, ${ambito.proyectos[0].nombre}: todas las consultas van sobre él sin indicar proyecto_id ni sociedad_id.`,
      } : {}),
    }),
  },
  {
    nombre: 'buscar_prospectos',
    // En esta lista, «nombre» es el de un cliente: sale abreviado (#196).
    listasDeClientes: ['prospectos'],
    titulo: 'Buscar prospectos',
    descripcion: 'Busca prospectos (leads) por estado, canal, texto (nombre, email o teléfono) y fechas de solicitud. Devuelve una página de resultados y el total.',
    entrada: { ...DATOS_COMPLETOS,
      ...AMBITO,
      estado: z.string().max(40).optional().describe('nuevo, por_contactar, contactado, en_seguimiento, convertido, no_interesado…'),
      canal: z.string().max(40).optional().describe('Canal de captación (meta, google, organico…)'),
      texto: z.string().max(100).optional().describe('Busca en nombre, email o teléfono'),
      ...PERIODO,
      ...PAGINA,
    },
    ejecutar: (ambito, a) => model.buscarProspectos({ ...a, ...acotar(ambito, a) }),
  },
  {
    nombre: 'ver_prospecto',
    titulo: 'Ver un prospecto',
    descripcion: 'Ficha de un prospecto: datos de contacto, origen, últimas interacciones y sus ventas.',
    entrada: { ...DATOS_COMPLETOS, id: z.number().int().positive().describe('Id del prospecto') },
    ejecutar: async (ambito, a) => {
      const r = await model.verProspecto({ id: a.id, ...acotar(ambito, {}) });
      if (!r) throw new AppError(`El prospecto ${a.id} no existe o no tienes acceso a él.`, 404, 'MCP_NO_ENCONTRADO');
      return r;
    },
  },
  {
    nombre: 'resumen_prospectos',
    titulo: 'Resumen de prospectos',
    descripcion: 'Cuántos prospectos hay por estado, por canal y por campus en un periodo.',
    entrada: { ...AMBITO, ...PERIODO },
    ejecutar: (ambito, a) => model.resumenProspectos({ ...a, ...acotar(ambito, a) }),
  },
  {
    nombre: 'listar_ventas',
    titulo: 'Listar ventas',
    descripcion: 'Ventas (conversiones) con importe, lo cobrado y lo pendiente. Filtra por fechas, texto (producto o cliente) y si están pendientes de cobro. '
      + 'Lo cobrado son los PAGOS REGISTRADOS de cada venta; puede no cuadrar con «cobros_pendientes», que usa el campo de importe pagado de la venta.',
    entrada: { ...DATOS_COMPLETOS,
      ...AMBITO,
      ...PERIODO,
      texto: z.string().max(100).optional().describe('Busca en producto o nombre del cliente'),
      pendiente: z.boolean().optional().describe('true: solo con cobro pendiente; false: solo cobradas'),
      ...PAGINA,
    },
    ejecutar: (ambito, a) => model.listarVentas({ ...a, ...acotar(ambito, a) }),
  },
  {
    nombre: 'resumen_ventas',
    titulo: 'Resumen de ventas',
    descripcion: 'Número de ventas, importe vendido, cobrado y pendiente en un periodo, desglosado por campus. '
      + 'Para comparar gestoras no uses esto: se miden por lo cobrado, con el informe «ranking_gestoras».',
    entrada: { ...AMBITO, ...PERIODO },
    ejecutar: (ambito, a) => model.resumenVentas({ ...a, ...acotar(ambito, a) }),
  },
  {
    nombre: 'listar_facturas',
    titulo: 'Listar facturas',
    descripcion: 'Facturas con código, estado, cliente, total y empresa emisora. Filtra por estado, tipo, texto y fecha de emisión.',
    entrada: { ...DATOS_COMPLETOS,
      ...AMBITO,
      estado: z.enum(['borrador', 'emitida', 'enviada', 'pagada', 'cancelada']).optional(),
      tipo: z.enum(['normal', 'proforma', 'rectificativa']).optional(),
      texto: z.string().max(100).optional().describe('Busca en nombre del cliente o código de factura'),
      ...PERIODO,
      ...PAGINA,
    },
    ejecutar: (ambito, a) => model.listarFacturas({ ...a, ...acotar(ambito, a) }),
  },
  {
    nombre: 'resumen_facturas',
    titulo: 'Resumen de facturas',
    descripcion: 'Total facturado y cobrado, y facturas por estado, en un periodo de emisión.',
    entrada: { ...AMBITO, ...PERIODO },
    ejecutar: (ambito, a) => model.resumenFacturas({ ...a, ...acotar(ambito, a) }),
  },
  {
    nombre: 'cobros_pendientes',
    titulo: 'Cobros pendientes',
    descripcion: 'Cuentas por cobrar: cuotas y ventas pendientes con su vencimiento, y cuánto está vencido. Las fechas filtran por vencimiento. '
      + 'Da lo mismo que la pantalla «Cuentas por cobrar» del CRM, que se fía del campo de importe pagado de la venta: si una venta está marcada como pagada '
      + 'pero no tiene pagos registrados, aquí no sale como pendiente y en «listar_ventas» sí. Si las cifras no cuadran, dilo y explica esta diferencia.',
    entrada: { ...DATOS_COMPLETOS,
      ...AMBITO,
      ...PERIODO,
      // 100 como máximo: es el tope de filas de cualquier respuesta (#196).
      limite: z.number().int().min(1).max(100).default(50).describe('Máximo de filas de detalle (hasta 100)'),
    },
    ejecutar: (ambito, a) => model.cobrosPendientes({ ...a, ...acotar(ambito, a) }),
  },
  {
    nombre: 'listar_tutores',
    titulo: 'Tutores y sus cursos',
    descripcion: 'Los tutores (profesores colaboradores) de tus campus: en qué campus están, qué cursos dan, con qué porcentaje de comisión '
      + 'y desde cuándo. «rige_hoy» dice si ese curso le genera comisión hoy. De cada curso, lo entregado (foto corporativa, vídeo y módulos '
      + 'al 25, 50 o 100 %): «entregado» es el mismo texto que la columna Entregado de la pantalla y «falta», lo que queda. '
      + 'No incluye DNI, IBAN ni teléfono (solo super admin y admin).',
    entrada: { ...DATOS_COMPLETOS,
      ...AMBITO,
      texto: z.string().max(100).optional().describe('Busca en nombre, email o nombre del curso'),
      incluir_retirados: z.boolean().default(false).describe('true: también los tutores dados de baja'),
      solo_entregas_pendientes: z.boolean().default(false)
        .describe('true: solo los tutores a los que les falta foto, vídeo o módulos al 100 % en un curso que siguen dando, y solo esos cursos'),
    },
    ejecutar: async (ambito, a) => {
      const { projectIds } = acotar(ambito, a);
      soloAdministracion(ambito, 'listar_tutores');
      return model.tutoresConCursos({ ...a, projectIds });
    },
  },
  {
    nombre: 'comisiones_tutores',
    titulo: 'Comisiones de tutores',
    descripcion: 'Lo que se le debe y lo ya pagado a cada tutor, mes a mes: base de cálculo, generado, por pagar, pagado, revertido '
      + 'y cuándo se le avisó. Un mes o un tramo de meses. Los mismos números que la pantalla Comisiones de tutores. '
      + 'Cada fila trae, curso a curso, lo entregado (como la columna Entregado) y «se_puede_pagar»: queda algo por pagar y lo ha entregado todo. '
      + 'Sirve para contestar «¿a quién se le puede pagar ya?» (solo super admin y admin).',
    entrada: {
      ...AMBITO,
      periodo: z.string().regex(/^\d{4}-\d{2}$/, 'Formato AAAA-MM').optional().describe('Un mes, AAAA-MM'),
      desde: z.string().regex(/^\d{4}-\d{2}$/, 'Formato AAAA-MM').optional().describe('Primer mes del tramo, AAAA-MM'),
      hasta: z.string().regex(/^\d{4}-\d{2}$/, 'Formato AAAA-MM').optional().describe('Último mes del tramo, AAAA-MM'),
      tutor_id: z.number().int().positive().optional().describe('Un tutor concreto (id de «listar_tutores»)'),
      solo_entregas_pendientes: z.boolean().default(false)
        .describe('true: solo las filas con algún curso sin foto, sin vídeo o con los módulos por debajo del 100 %; los totales, de esas filas'),
    },
    ejecutar: async (ambito, a) => {
      const { projectIds } = acotar(ambito, a);
      soloAdministracion(ambito, 'comisiones_tutores');
      return model.comisionesDeTutores({ ...a, projectIds });
    },
  },
  {
    nombre: 'formaciones_sin_tutor',
    titulo: 'Formaciones sin tutor',
    descripcion: 'Formaciones que se han vendido y cobrado y que hoy no tiene ningún tutor: lo mismo que la pantalla «Cursos sin tutor». '
      + 'Por defecto, solo las vendidas desde el arranque de las comisiones (solo super admin y admin).',
    entrada: {
      ...AMBITO,
      incluir_anteriores_al_corte: z.boolean().default(false).describe('true: también las vendidas antes del arranque de las comisiones'),
    },
    ejecutar: async (ambito, a) => {
      const { projectIds } = acotar(ambito, a);
      soloAdministracion(ambito, 'formaciones_sin_tutor');
      return model.formacionesSinTutorDe({ ...a, projectIds });
    },
  },
  // El catálogo de cada campus (#215, ficha de Diego del 05/10). Lo usan todos
  // los roles con MCP, también las gestoras: lo necesitan para vender y no es
  // información sensible. Nada de ventas ni de `stripe_link`; del tutor, solo
  // el nombre.
  {
    nombre: 'listar_formaciones',
    titulo: 'Formaciones y precios',
    descripcion: 'El catálogo de tus campus: cada formación activa con su precio, moneda, campus y enlace a la web, como la pantalla de Productos. '
      + 'Busca por nombre sin distinguir mayúsculas ni tildes. Devuelve una página y el total: con muchas, pide un nombre o usa «resumen_catalogo». '
      + 'Si una formación no tiene precio, contesta que en el CRM no consta; no lo deduzcas ni lo inventes. No da ventas.',
    entrada: {
      ...AMBITO,
      texto: z.string().max(100).optional().describe('Parte del nombre de la formación, por ejemplo «psicología clínica»'),
      ...PAGINA,
    },
    ejecutar: (ambito, a) => model.listarFormaciones({ ...a, projectIds: acotar(ambito, a).projectIds }),
  },
  {
    nombre: 'resumen_catalogo',
    titulo: 'Resumen del catálogo',
    descripcion: 'Por campus: cuántas formaciones activas hay, el precio mínimo, el máximo y el más habitual (el que más se repite; vacío si ninguno se repite: entonces no lo hay), '
      + 'las monedas, y cuántas no tienen precio o enlace. '
      + 'Úsala para «¿cuánto cuestan los cursos de X?» sin listar cientos de formaciones.',
    entrada: { ...AMBITO },
    ejecutar: (ambito, a) => model.resumenCatalogo({ projectIds: acotar(ambito, a).projectIds }),
  },
  {
    nombre: 'ver_formacion',
    titulo: 'Ficha de una formación',
    descripcion: 'La ficha de una formación (id de «listar_formaciones»): precio, moneda, enlace, categoría, duración, plazas totales y libres, '
      + 'cierre de convocatoria, dossier y el nombre del tutor que la da hoy. Plazas, cierre de convocatoria y dossier están vacíos en casi todo el catálogo: '
      + 'si vienen vacíos, contesta que en el CRM no consta; no lo deduzcas.',
    entrada: { id: z.number().int().positive().describe('Id de la formación') },
    ejecutar: async (ambito, a) => {
      const permitidos = acotar(ambito, {}).projectIds;
      const r = await model.verFormacion(a.id);
      if (!r) throw new AppError(`La formación ${a.id} no existe.`, 404, 'MCP_NO_ENCONTRADO');
      // El mismo 403 que dan las demás herramientas con un campus ajeno.
      if (!permitidos.includes(Number(r.campus_id))) {
        throw new AppError(`No tienes acceso al campus ${r.campus_id}. Usa «mis_proyectos» para ver los tuyos.`, 403, 'MCP_FUERA_DE_AMBITO');
      }
      return r;
    },
  },
  // El Moodle de cada campus (#335). Solo lectura contra la API de servicios web
  // de Moodle; el token de cada campus vive cifrado en las credenciales del CRM
  // (servicio «moodle») y no sale NUNCA. Un campus sin Moodle, con el token
  // caducado o que no responde se dice en «campus_con_error»: jamás es un cero.
  {
    nombre: 'moodle_cursos',
    titulo: 'Cursos del Moodle de cada campus',
    descripcion: 'Los cursos que hay en el Moodle de tus campus (no son las formaciones del catálogo del CRM: es lo que hay montado en la plataforma). '
      + 'Por defecto solo los ACTIVOS (visibles y sin fecha de fin pasada); con estado puedes pedir proximos, terminados, ocultos o todos. '
      + 'Filtra por texto (nombre, sin distinguir tildes) o categoria_id (de «moodle_estructura»; incluye sus subcategorías). Devuelve cuántos cursos tiene cada campus y una página de cursos, cada uno con su categoría, fechas de inicio y fin, si está visible y el número de alumnos. '
      + 'El número de alumnos cuesta una lectura por curso de la página: con_alumnos: false la evita si solo quieres la lista. '
      + 'Si un campus no tiene Moodle configurado, el token no vale o no responde, sale en «campus_con_error» con el motivo: díselo a la persona, no lo des por «cero cursos». '
      + 'La lista puede tener unos minutos; refrescar: true la pide de nuevo.',
    entrada: {
      ...AMBITO,
      estado: z.enum(['activos', 'proximos', 'terminados', 'ocultos', 'todos']).default('activos'),
      texto: z.string().max(100).optional().describe('Parte del nombre del curso'),
      categoria_id: z.number().int().positive().optional().describe('Una categoría de Moodle (id de «moodle_estructura»)'),
      con_alumnos: z.boolean().default(true).describe('false: no cuenta los alumnos de cada curso (más rápido)'),
      refrescar: z.boolean().optional().describe('true: salta la caché y pregunta a Moodle ahora'),
      ...PAGINA,
    },
    ejecutar: (ambito, a) => moodleConTope('moodle_cursos', (signal) => moodle.moodleCursos(ambito, a, { signal })),
  },
  {
    nombre: 'moodle_alumnos',
    titulo: 'Alumnos por curso en Moodle',
    descripcion: 'Cuántos alumnos hay en los cursos de Moodle de tus campus: matriculados, con matrícula activa, suspendidos, activos (accedieron al curso en los últimos N días, 30 por defecto) y los que nunca han entrado. '
      + 'Elige los cursos con curso_id (de «moodle_cursos»; con él, indica proyecto_id), con categoria_id (de «moodle_estructura»; incluye sus subcategorías) o con texto; sin ninguno, los de todo el campus. Se miran como mucho limite_cursos (10 por defecto) y se dice cuántos quedan fuera. '
      + 'Por defecto solo cifras. «terminados» solo tiene dato si el curso tiene finalización activada Y criterios definidos (criterios_de_finalizacion); si no, viene a null con el motivo en «avisos», no a 0. Cuesta una lectura por alumno: terminados: false la evita. '
      + 'datos_completos: true añade nombre y correo de cada alumno (solo super admin y admin; queda registrado). '
      + 'Si un campus no responde, el token no vale o no tiene Moodle, sale en «campus_con_error»: no es «cero alumnos».',
    entrada: { ...DATOS_COMPLETOS,
      ...AMBITO,
      curso_id: z.number().int().positive().optional().describe('Id del curso en el Moodle del campus (de «moodle_cursos»); exige proyecto_id si tienes varios campus'),
      texto: z.string().max(100).optional().describe('Parte del nombre del curso'),
      categoria_id: z.number().int().positive().optional().describe('Una categoría de Moodle (id de «moodle_estructura»): sus cursos y los de sus subcategorías'),
      estado: z.enum(['activos', 'proximos', 'terminados', 'ocultos', 'todos']).default('activos').describe('Qué cursos mirar; con curso_id se ignora'),
      limite_cursos: z.number().int().min(1).max(25).default(10).describe('Máximo de cursos a consultar en esta petición'),
      terminados: z.boolean().default(true).describe('false: no cuenta quién ha terminado el curso (una lectura por alumno)'),
      dias_actividad: z.number().int().min(1).max(365).default(30).describe('Un alumno es «activo» si accedió al curso en estos días'),
      refrescar: z.boolean().optional().describe('true: salta la caché de la lista de cursos'),
    },
    ejecutar: async (ambito, a) => {
      // El campus ajeno es un 403 antes de tocar nada; luego, los datos
      // personales solo para administración (dentro de moodleAlumnos).
      acotar(ambito, a);
      return moodleConTope('moodle_alumnos', (signal) => moodle.moodleAlumnos(ambito, a, { signal }));
    },
  },
  {
    nombre: 'moodle_recursos_externos',
    titulo: 'Recursos externos de los cursos de Moodle',
    descripcion: 'Los recursos externos de los cursos de Moodle: enlaces (módulos URL y los escritos en las descripciones), YouTube, Vimeo, Google Drive y herramientas externas (LTI), con su tipo y en qué sección están, y un resumen de qué cursos tienen y cuáles no. '
      + 'Elige cursos con curso_id (con proyecto_id), categoria_id (de «moodle_estructura»; incluye sus subcategorías) o texto; se miran como mucho limite_cursos (10 por defecto) y se avisa de los que quedan fuera. '
      + 'comprobar_enlaces: true (solo super admin y admin) comprueba si cada enlace responde (ok, roto, restringido, no_responde…; hasta un tope de enlaces por petición); '
      + 'las direcciones internas o privadas no se comprueban. Los LTI no tienen dirección visible. '
      + 'Un curso sin recursos sale con total 0 SOLO si se ha podido leer; si falla, trae «error». Un campus caído sale en «campus_con_error».',
    entrada: {
      ...AMBITO,
      curso_id: z.number().int().positive().optional().describe('Id del curso en el Moodle del campus (de «moodle_cursos»); exige proyecto_id si tienes varios campus'),
      texto: z.string().max(100).optional().describe('Parte del nombre del curso'),
      categoria_id: z.number().int().positive().optional().describe('Una categoría de Moodle (id de «moodle_estructura»): sus cursos y los de sus subcategorías'),
      estado: z.enum(['activos', 'proximos', 'terminados', 'ocultos', 'todos']).default('activos').describe('Qué cursos mirar; con curso_id se ignora'),
      tipo: z.enum(['youtube', 'vimeo', 'drive', 'lti', 'enlace']).optional().describe('Solo recursos de este tipo (los recuentos siguen siendo del curso entero)'),
      comprobar_enlaces: z.boolean().default(false).describe('true: comprueba si los enlaces responden (solo super admin y admin)'),
      solo_rotos: z.boolean().default(false).describe('true (con comprobar_enlaces): solo los que no responden o están rotos'),
      limite_cursos: z.number().int().min(1).max(25).default(10).describe('Máximo de cursos a leer en esta petición'),
      refrescar: z.boolean().optional().describe('true: salta la caché de la lista de cursos'),
    },
    ejecutar: async (ambito, a) => {
      acotar(ambito, a);
      return moodleConTope('moodle_recursos_externos', (signal) => moodle.moodleRecursosExternos(ambito, a, { signal }));
    },
  },
  {
    nombre: 'moodle_estructura',
    titulo: 'Estructura de Moodle: categorías y contenido de un curso',
    descripcion: 'Sin curso_id: las categorías de cursos del Moodle de tus campus (con su ruta, por ejemplo «Másteres > Psicología») y cuántos cursos tiene cada una; sirve para conocer el categoria_id y filtrar los demás. '
      + 'Con curso_id (de «moodle_cursos»; con él, indica proyecto_id): las secciones del curso y las actividades de cada una (nombre, tipo y si están visibles), para preguntas como «¿qué tiene el módulo 3 de X?». '
      + 'Un campus sin Moodle o caído sale en «campus_con_error».',
    entrada: {
      ...AMBITO,
      curso_id: z.number().int().positive().optional().describe('Id del curso en el Moodle del campus (de «moodle_cursos»): devuelve sus secciones y actividades; exige proyecto_id si tienes varios campus'),
      refrescar: z.boolean().optional().describe('true: salta la caché'),
    },
    ejecutar: (ambito, a) => moodleConTope('moodle_estructura', (signal) => moodle.moodleEstructura(ambito, a, { signal })),
  },
  {
    nombre: 'informe',
    titulo: 'Informe del CRM',
    descripcion: 'Ejecuta uno de los informes de Reportes del CRM (mismos números que la pantalla). Tipos: '
      + Object.entries(INFORMES).map(([k, v]) => `${k} (${v.descripcion})`).join('; '),
    entrada: { ...DATOS_COMPLETOS,
      tipo: z.enum(Object.keys(INFORMES)),
      ...AMBITO,
      ...PERIODO,
    },
    ejecutar: async (ambito, a) => {
      if (INFORMES[a.tipo].soloAdmin && ambito.soloLoSuyo) {
        throw new AppError(`El informe «${a.tipo}» es de todo el campus y solo lo ven super admin y admin. Prueba con «resumen_mensual».`, 403, 'MCP_INFORME_SOLO_ADMIN');
      }
      const { projectIds, responsableId } = acotar(ambito, a);
      const params = { projectIds, from: a.desde, to: a.hasta, asesoraId: responsableId || undefined };
      const datos = await conTope(INFORMES[a.tipo].ejecutar(params), TOPE_INFORME_MS, a.tipo);
      return { informe: a.tipo, campus: projectIds, desde: a.desde || null, hasta: a.hasta || null, datos };
    },
  },
];
