import { z } from 'zod';
import { AppError } from '../../shared/utils/AppError.js';
import * as reportes from '../reports/report.model.js';
import { resumenDelDia } from '../reports/resumenDelDia.js';
import * as proceso from '../proceso/proceso.model.js';
import * as feedback from '../feedback/feedback.model.js';
import * as metas from '../sales/sales.goals.js';
import * as metaAds from '../meta-ads/meta-ads.service.js';
import * as egresos from '../expenses/expense.model.js';
import * as porPagar from '../accounts-payable/payable.model.js';
import * as stripe from '../stripe-payments/stripe-payments.model.js';
import * as comisiones from '../commissions/commission.model.js';
import * as duplicados from '../leads/dup-queue.service.js';
import * as model from './mcp.model.js';
import { acotarProyectos, responsableImpuesto } from './mcp.acceso.js';

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
    descripcion: 'Leads por estado y canal, y las ventas CERRADAS en el periodo (por fecha de venta) con lo que se declara pagado en ellas. No es el dinero que entró en el periodo: para eso, «cobros_mensuales» (solo super admin y admin).',
    ejecutar: reportes.overview,
    // `overview` no aplicaba `asesoraId` hasta el 19/10/2026 (ver su
    // comentario: «Tu semana» de las gestoras). Ya lo aplica, pero esto sigue
    // siendo solo para admin, como la pantalla (`roleGuard` en /overview): la
    // gestora tiene su propio resumen. Lo vigila `mcpAmbito.test.js`.
    soloAdmin: true,
  },
  resumen_mensual: {
    descripcion: 'Prospectos, ventas y dinero mes a mes, por mes de VENTA (no de cobro): «cobrado» es lo que se declara pagado en las ventas de ese mes, como en «resumen_general». Para el dinero que entró en cada mes, usa «cobros_mensuales».',
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
    descripcion: 'Dinero cobrado mes a mes: cada pago registrado, por su FECHA DE COBRO (la base de Finanzas). Es la respuesta a «cuánto dinero entró en tal mes».',
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
  // ── Lo comercial del día a día (#325) ─────────────────────────────────────
  // Las MISMAS funciones que las pantallas de origen, para que las cifras
  // cuadren. Todas devuelven números agregados: ningún nombre ni contacto de
  // cliente, salvo el `cliente` de «pendientes_de_facturar», que sale abreviado.
  dashboard_hoy: {
    descripcion: 'Ayer y hoy, como el Dashboard: prospectos que entraron, contactados, ventas y prospectos sin tocar.',
    ejecutar: ({ projectIds, asesoraId }) => resumenDelDia({ projectIds, asesoraId }),
  },
  cola_del_dia: {
    descripcion: 'La cola del proceso comercial en cifras, como «La cola del día»: atrasados, para hoy, para mañana y esta semana.',
    ejecutar: ({ projectIds, asesoraId }) => proceso.resumenDeLaCola({ projectIds, asesoraId }),
  },
  proceso_comercial: {
    descripcion: 'El proceso comercial en cifras: cuántos prospectos hay en cada paso (1–4 y los que se añaden a mano), cuántos van atrasados y la fecha del siguiente. '
      + 'Los mismos prospectos que «cola_del_dia», repartidos por paso.',
    ejecutar: ({ projectIds, asesoraId }) => proceso.resumenPorPaso({ projectIds, asesoraId }),
  },
  seguimiento_fin_de_mes: {
    descripcion: 'Prospectos por antigüedad (este mes, 1–3, 3–6 y más de 6 meses) y cuántos no se han contactado nunca, como «Seguimiento de fin de mes».',
    ejecutar: ({ projectIds, asesoraId }) => proceso.resumenDeSeguimiento({ projectIds, asesoraId }),
  },
  feedback: {
    descripcion: 'Encuestas de feedback de Reportes: enviadas y respondidas, motivos de no compra, por disparador, campus, gestora y mes. Acepta desde y hasta.',
    ejecutar: ({ projectIds, asesoraId, from, to }) => feedback.panel({ projectIds, gestoraId: asesoraId, desde: from, hasta: to }),
  },
  pendientes_de_facturar: {
    descripcion: 'Cobros que todavía no tienen factura (cliente abreviado, curso, último cobro e importe), como «Pendientes de facturar». Acepta desde y hasta (por fecha de cobro).',
    ejecutar: ({ projectIds, from, to }) => reportes.ventasSinFacturaEnRango({ projectIds, from, to }),
    // La pantalla es de administración: una gestora no la ve, y aquí tampoco.
    soloAdmin: true,
  },
  metas_gestoras: {
    descripcion: 'La meta de ventas y de facturación de cada gestora y su avance en el periodo (solo super admin y admin). Acepta desde y hasta.',
    ejecutar: ({ projectIds, from, to }) => metas.getGestoresStats({ projectIds, from: from || null, to: to || null }),
    soloAdmin: true,
  },
  // ── Administración y dinero (#325): solo super admin y admin ───────────────
  egresos: {
    descripcion: 'Los gastos por categoría y periodo, como «Egresos» (incluye los de la empresa y los generales). Acepta desde y hasta (solo super admin y admin).',
    ejecutar: ({ projectIds, from, to }) => egresos.resumenExpenses({ projectIds, from, to }),
    soloAdmin: true,
  },
  cuentas_por_pagar: {
    descripcion: 'Facturas de proveedores: total facturado, pagado, pendiente y vencidas, como «Cuentas por pagar». Acepta desde y hasta, por fecha de factura (solo super admin y admin).',
    ejecutar: ({ projectIds, from, to }) => porPagar.getStats({ projectIds, from, to }),
    soloAdmin: true,
  },
  pagos_stripe: {
    descripcion: 'Los cobros de Stripe del periodo: correctos y fallidos, disputados, reembolsados, cuántos no están asociados a un cliente y el total cobrado, como «Pagos Stripe». Acepta desde y hasta (solo super admin y admin).',
    ejecutar: ({ projectIds, from, to }) => stripe.getStats({ projectIds, from, to }),
    soloAdmin: true,
  },
  comisiones_gestoras: {
    descripcion: 'Las comisiones de las gestoras por ventas: total, pagadas y pendientes del periodo (solo super admin y admin). Las de los tutores van en «comisiones_tutores».',
    ejecutar: ({ projectIds, from, to }) => comisiones.getStats({ projectIds, from, to }),
    soloAdmin: true,
  },
  duplicados: {
    descripcion: 'La cola de prospectos duplicados: pendientes de revisar, aprobados, fusionados y descartados, de tus campus (solo super admin y admin).',
    ejecutar: async ({ projectIds }) => {
      const total = { pending: 0, approved: 0, merged: 0, rejected: 0 };
      for (const id of projectIds) {
        const c = await duplicados.counts(id);
        for (const k of Object.keys(total)) total[k] += Number(c[k] || 0);
      }
      return { pendientes: total.pending, aprobados: total.approved, fusionados: total.merged, descartados: total.rejected };
    },
    soloAdmin: true,
  },
  // ── Lo que faltaba, parte 2 (#325) ─────────────────────────────────────────
  // Todas devuelven cifras y listas cortas. Sin correos, teléfonos ni textos de
  // mensajes; los clientes que aparecen (solo en «whatsapp») salen abreviados.
  matriculas: {
    descripcion: 'La pantalla de Matrículas en cifras: cuántas hay por estado (pendientes, validadas, rechazadas…), por producto, por campus y por mes de alta. '
      + 'Acepta desde y hasta (por fecha de alta). Una gestora solo cuenta las de sus ventas.',
    ejecutar: ({ projectIds, asesoraId, from, to }) => model.resumenMatriculas({ projectIds, asesoraId, from, to }),
  },
  catalogo_completo: {
    descripcion: 'El catálogo por dentro, por campus: formaciones activas e inactivas, cuántas no tienen SKU o lo repiten o no tienen precio, el árbol de categorías '
      + 'con sus formaciones y las últimas importaciones de WooCommerce (solo super admin y admin). Para precios y fichas usa «listar_formaciones» y «resumen_catalogo».',
    ejecutar: ({ projectIds }) => model.catalogoCompleto({ projectIds }),
    soloAdmin: true,
  },
  correos: {
    descripcion: 'Los correos del CRM en cifras, como la pantalla Correos: enviados, recibidos, frenados (los que el freno de pruebas no dejó salir) y fallidos, '
      + 'por campus, tipo y mes, más las secuencias de correo y cómo van. No da asuntos, destinatarios ni textos. Acepta desde y hasta (solo super admin y admin).',
    ejecutar: ({ projectIds, from, to }) => model.resumenCorreos({ projectIds, from, to }),
    soloAdmin: true,
  },
  whatsapp: {
    descripcion: 'WhatsApp en cifras: mensajes enviados y recibidos por gestora, campus, tipo de mensaje, mes y prospecto, y cuántas conversaciones y números distintos hay. '
      + 'Nunca da el texto de los mensajes ni los números de teléfono; los grupos no cuentan. Acepta desde y hasta. Una gestora solo cuenta su sesión y sus prospectos.',
    ejecutar: ({ projectIds, asesoraId, from, to }) => model.resumenWhatsapp({ projectIds, asesoraId, from, to }),
  },
  solicitudes_y_avisos: {
    descripcion: 'Las solicitudes de cambio (RFC) por estado y campus con las últimas quince, y los avisos de la campana que TÚ tienes sin leer (los que piden hacer algo y los que solo informan). '
      + 'Acepta desde y hasta (por fecha de solicitud). Una gestora solo ve las solicitudes que ha pedido ella.',
    ejecutar: async ({ projectIds, asesoraId, from, to, quien }) => ({
      solicitudes: await model.resumenSolicitudes({ projectIds, asesoraId, from, to }),
      avisos_pendientes: await model.avisosPendientes(quien),
    }),
  },
  nominas: {
    descripcion: 'Las nóminas, como la pantalla de Nóminas: planes de cada persona, periodos mensuales con su total y estado, y horas trabajadas. '
      + 'Sin fechas, el último año. Acepta desde y hasta (solo super admin y admin).',
    ejecutar: ({ projectIds, from, to }) => model.nominasDe({ projectIds, from, to }),
    soloAdmin: true,
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

async function conTope(promesa, ms, nombre) {
  let reloj;
  const tope = new Promise((_, rechazar) => {
    reloj = setTimeout(() => rechazar(new AppError(`El informe «${nombre}» tardó más de ${ms / 1000} s y se cortó. Prueba con un periodo más corto.`, 504, 'MCP_LENTO')), ms);
  });
  try {
    return await Promise.race([promesa, tope]);
  } finally {
    clearTimeout(reloj);
  }
}

/** De una campaña de la pantalla de Meta, lo que le sirve a Claude (sin ids internos de la cuenta publicitaria). */
function resumirCampana(c) {
  return {
    campana_id: c.campaign_id, nombre: c.nombre, estado: c.effective_status || c.status || null,
    gasto: c.total_spend, impresiones: c.total_impressions, clics: c.total_clicks, ctr: c.ctr,
    leads_meta: c.total_leads, cpl_meta: c.cpl,
    prospectos_crm: c.leads_crm, ventas_crm: c.ventas_crm, cpl_crm: c.cpl_crm,
  };
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
    descripcion: 'Busca prospectos (leads) por estado, canal, texto (nombre, email o teléfono), gestora, programa de interés y fechas de solicitud. Cada fila trae el último contacto, el próximo (según el proceso comercial), el paso en el que va y lo vendido. Devuelve una página de resultados y el total.',
    entrada: { ...DATOS_COMPLETOS,
      ...AMBITO,
      estado: z.string().max(40).optional().describe('nuevo, por_contactar, contactado, en_seguimiento, convertido, no_interesado…'),
      canal: z.string().max(40).optional().describe('Canal de captación (meta, google, organico…)'),
      texto: z.string().max(100).optional().describe('Busca en nombre, email o teléfono'),
      gestora_id: z.number().int().positive().optional().describe('Solo los de una gestora (id de «ventas_por_asesora»). Quien ve solo lo suyo no puede pedir los de otra.'),
      programa: z.string().max(100).optional().describe('Parte del nombre del programa de interés, sin tildes ni mayúsculas (por ejemplo «coaching»)'),
      ...PERIODO,
      ...PAGINA,
    },
    ejecutar: async (ambito, a) => {
      const { gestora_id: gestoraId, ...resto } = a;
      if (gestoraId && ambito.soloLoSuyo && gestoraId !== ambito.userId) {
        throw new AppError('Solo ves tus propios prospectos: no puedes pedir los de otra gestora.', 403, 'MCP_FUERA_DE_AMBITO');
      }
      return model.buscarProspectos({ ...resto, gestoraId, ...acotar(ambito, a) });
    },
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
      facturada: z.boolean().optional().describe('true: solo con factura (ni proformas ni canceladas); false: solo sin facturar'),
      vendedora_id: z.number().int().positive().optional().describe('Solo las de una vendedora (su id sale del informe «ventas_por_asesora»). Quien ve solo lo suyo no puede pedir las de otra.'),
      ...PAGINA,
    },
    ejecutar: async (ambito, a) => {
      const { vendedora_id: vendedoraId, ...resto } = a;
      // Una gestora ve solo lo suyo: pedir otra vendedora no ensancha nada, y se le dice.
      if (vendedoraId && ambito.soloLoSuyo && vendedoraId !== ambito.userId) {
        throw new AppError('Solo ves tus propias ventas: no puedes pedir las de otra vendedora.', 403, 'MCP_FUERA_DE_AMBITO');
      }
      return model.listarVentas({ ...resto, vendedoraId, ...acotar(ambito, a) });
    },
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
      + 'Ojo: el Dashboard («cobros vencidos») cuenta solo VENTAS con saldo y fecha de pago pasada, y esto cuenta cuotas e importes: no es un error que no coincidan. '
      + 'Da lo mismo que la pantalla «Cuentas por cobrar» del CRM, que se fía del campo de importe pagado de la venta: si una venta está marcada como pagada '
      + 'pero no tiene pagos registrados, aquí no sale como pendiente y en «listar_ventas» sí. Si las cifras no cuadran, dilo y explica esta diferencia.',
    entrada: { ...DATOS_COMPLETOS,
      ...AMBITO,
      ...PERIODO,
      // 100 como máximo: es el tope de filas de cualquier respuesta (#196).
      limite: z.number().int().min(1).max(100).default(50).describe('Máximo de filas de detalle (hasta 100)'),
      gestora_id: z.number().int().positive().optional().describe('Solo los cobros de una gestora (id de «ventas_por_asesora»). Quien ve solo lo suyo no puede pedir los de otra.'),
    },
    ejecutar: async (ambito, a) => {
      const { gestora_id: gestoraId, ...resto } = a;
      if (gestoraId && ambito.soloLoSuyo && gestoraId !== ambito.userId) {
        throw new AppError('Solo ves tus propios cobros: no puedes pedir los de otra gestora.', 403, 'MCP_FUERA_DE_AMBITO');
      }
      const dondeVa = acotar(ambito, a);
      // A quien ve solo lo suyo se le impone ella misma; quien ve todo el campus puede acotar a una gestora.
      return model.cobrosPendientes({ ...resto, ...dondeVa, responsableId: dondeVa.responsableId || gestoraId || null });
    },
  },
  {
    nombre: 'clientes',
    titulo: 'Clientes',
    descripcion: 'La pantalla de Clientes: quien ha comprado (tiene al menos una venta), con sus productos, gestora, compras, facturado, cobrado, pendiente, cuotas, última compra, próximo vencimiento y último contacto. '
      + 'Arriba van las cuatro cifras de la pantalla (clientes, facturado, cobrado y pendiente de TODOS los que cumplen el filtro) y «cobro»: la salud de cobro y lo que vence hasta mañana, en 7 y en 30 días '
      + '(de todo el campus o de la gestora; no depende del texto ni de las fechas). Las fechas filtran por la última compra. '
      + 'Cobrado y pendiente se fían del campo de importe pagado de la venta, como «cobros_pendientes»: si una venta consta como pagada sin pagos registrados, aquí aparece cobrada. '
      + 'Sin correos ni teléfonos; el cliente sale con nombre abreviado salvo con datos_completos.',
    entrada: { ...DATOS_COMPLETOS,
      ...AMBITO,
      ...PERIODO,
      texto: z.string().max(100).optional().describe('Busca en nombre, correo o teléfono del cliente'),
      gestora_id: z.number().int().positive().optional().describe('Solo los clientes de una gestora (id de «ventas_por_asesora»). Quien ve solo lo suyo no puede pedir los de otra.'),
      ...PAGINA,
    },
    ejecutar: async (ambito, a) => {
      const { gestora_id: gestoraId, desde, hasta, ...resto } = a;
      if (gestoraId && ambito.soloLoSuyo && gestoraId !== ambito.userId) {
        throw new AppError('Solo ves tus propios clientes: no puedes pedir los de otra gestora.', 403, 'MCP_FUERA_DE_AMBITO');
      }
      return model.clientesDe({ ...resto, gestoraId, desde, hasta, ...acotar(ambito, a) });
    },
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
      + 'Por defecto, solo las vendidas desde el arranque de las comisiones. Cada una trae «meta», la columna META de la pantalla: '
      + 'no_se_busca, buscando (sin anuncio enganchado), anuncio_activo o anuncio_pausado (con el anuncio, su gasto y sus leads, tal como los dejó la última sincronización con Meta) '
      + 'o anuncio_desaparecido (se apuntó uno y ya no está en Meta). El enganche anuncio-formación lo hace una persona en la pantalla (solo super admin y admin).',
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
    descripcion: 'El catálogo de tus campus: cada formación activa (o también las inactivas con incluir_inactivas) con su SKU, precio, moneda, campus y enlace a la web, como la pantalla de Productos. '
      + 'Busca por nombre sin distinguir mayúsculas ni tildes. Devuelve una página y el total: con muchas, pide un nombre o usa «resumen_catalogo». '
      + 'Si una formación no tiene precio, contesta que en el CRM no consta; no lo deduzcas ni lo inventes. No da ventas.',
    entrada: {
      ...AMBITO,
      texto: z.string().max(100).optional().describe('Parte del nombre de la formación, por ejemplo «psicología clínica»'),
      incluir_inactivas: z.boolean().optional().describe('true: también las formaciones dadas de baja (cada fila dice si está «activa»). Por defecto, solo las activas.'),
      ...PAGINA,
    },
    ejecutar: (ambito, a) => {
      const { incluir_inactivas: incluirInactivas, ...resto } = a;
      return model.listarFormaciones({ ...resto, incluirInactivas: incluirInactivas === true, projectIds: acotar(ambito, a).projectIds });
    },
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
  {
    nombre: 'meta_ads',
    titulo: 'Meta Ads',
    descripcion: 'Publicidad de Meta (Facebook e Instagram) de tus campus, como la pantalla «Meta Ads» (solo super admin y admin). Una vista cada vez: '
      + '«campanas» (por campaña: estado, gasto, impresiones, clics, CTR, leads de Meta, prospectos que llegaron al CRM, ventas y coste por lead; es la de por defecto), '
      + '«por_producto» (gasto, prospectos y ventas por formación asociada), «roi» (gasto frente a ventas por campaña) y «evolucion_diaria» (gasto, clics y leads por día). '
      + 'Acepta desde y hasta. Los «leads de Meta» son los que cuenta Meta con su formulario; los «prospectos del CRM» son los que de verdad entraron por esa campaña: pueden no coincidir. '
      + 'Si un campus no tiene Meta conectado, sale vacío con el aviso «sin Meta conectado», no como cero gastado.',
    entrada: {
      ...AMBITO,
      ...PERIODO,
      vista: z.enum(['campanas', 'por_producto', 'roi', 'evolucion_diaria']).default('campanas'),
      limite: z.number().int().min(1).max(100).default(30).describe('Máximo de campañas por campus (por gasto)'),
    },
    ejecutar: async (ambito, a) => {
      const { projectIds } = acotar(ambito, a);
      soloAdministracion(ambito, 'meta_ads');
      const nombres = new Map((ambito.proyectos || []).map((p) => [Number(p.id), p.nombre]));
      const campus = [];
      for (const projectId of projectIds) {
        const base = { projectId, dateFrom: a.desde || null, dateTo: a.hasta || null };
        const cuentas = await metaAds.listAccounts(projectId);
        const entrada = { campus_id: projectId, campus: nombres.get(projectId) || String(projectId) };
        if (!cuentas.length) { campus.push({ ...entrada, aviso: 'sin Meta conectado' }); continue; }
        if (a.vista === 'por_producto') campus.push({ ...entrada, productos: await metaAds.getProductsView(base) });
        else if (a.vista === 'roi') campus.push({ ...entrada, campanas: (await metaAds.getRoi(base)).slice(0, a.limite) });
        else if (a.vista === 'evolucion_diaria') campus.push({ ...entrada, ...(await metaAds.getDashboard(base)) });
        else {
          const filas = await metaAds.listCampaignsForUI(base);
          campus.push({ ...entrada, campanas: filas.slice(0, a.limite).map(resumirCampana), total_campanas: filas.length });
        }
      }
      return { vista: a.vista, desde: a.desde || null, hasta: a.hasta || null, campus };
    },
  },
  {
    nombre: 'equipo',
    titulo: 'Equipo',
    descripcion: 'Quién hay en tus campus: nombre, rol y campus de cada persona, y cuántas hay por rol. Sin correos ni teléfonos. '
      + 'Por defecto solo las activas (solo super admin y admin).',
    entrada: {
      ...AMBITO,
      incluir_inactivos: z.boolean().optional().describe('true: también las personas desactivadas'),
    },
    ejecutar: async (ambito, a) => {
      const { projectIds } = acotar(ambito, a);
      soloAdministracion(ambito, 'equipo');
      return model.equipoDeLosCampus({ projectIds, incluirInactivos: a.incluir_inactivos === true });
    },
  },
  {
    nombre: 'informe',
    titulo: 'Informe del CRM',
    descripcion: 'Ejecuta uno de los informes de Reportes del CRM (mismos números que la pantalla, con el mismo periodo). Sin desde/hasta cubre TODO el histórico; la pantalla de Reportes arranca en «Este mes», así que para cuadrar con ella pasa las fechas del mes. Tipos: '
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
      // `quien` es para lo que es de la PERSONA y no del campus (sus avisos sin leer).
      const params = {
        projectIds, from: a.desde, to: a.hasta, asesoraId: responsableId || undefined,
        quien: { userId: ambito.userId, role: ambito.role },
      };
      const datos = await conTope(INFORMES[a.tipo].ejecutar(params), TOPE_INFORME_MS, a.tipo);
      return { informe: a.tipo, campus: projectIds, desde: a.desde || null, hasta: a.hasta || null, datos };
    },
  },
];
