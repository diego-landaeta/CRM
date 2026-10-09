import { z } from 'zod';
import { ESTADOS } from './certifex.model.js';

const texto = (max) => z.string().trim().max(max);
const opcional = (max) => z.union([texto(max), z.null()]).optional();

/** Lo que manda Certifex. Ya viene validado alli; aqui se valida otra vez, por si acaso. */
export const recibirSchema = z.object({
  certifexId: z.number().int().positive(),
  tipo: z.enum(['centro', 'consulta']),
  nombre: texto(200).min(2),
  email: z.string().trim().email().max(254),
  telefono: opcional(40),
  organizacion: opcional(200),
  urlCampus: opcional(500),
  mensaje: z.string().trim().min(5).max(4000),
  idioma: z.union([z.enum(['es', 'en', 'fr', 'pt']), z.null()]).optional(),
  creadoEn: z.string().datetime({ offset: true }).optional().nullable(),
});

export const listarSchema = z.object({
  estado: z.enum(ESTADOS).optional(),
  tipo: z.enum(['centro', 'consulta']).optional(),
  pagina: z.coerce.number().int().positive().optional(),
  limite: z.coerce.number().int().positive().max(100).optional(),
});

export const actualizarSchema = z.object({
  estado: z.enum(ESTADOS).optional(),
  notaInterna: z.union([texto(4000), z.null()]).optional(),
});

// --- Emisiones: lo que se le pide a la API de Certifex (/api/crm/v1) ---

export const listarEmisionesSchema = z.object({
  estado: z.enum(['pendiente', 'aprobada', 'rechazada', 'todas']).optional(),
  centro: z.string().trim().regex(/^[A-Za-z0-9]{2,10}$/, 'Centro no valido').optional(),
  pagina: z.coerce.number().int().positive().optional(),
  tam: z.coerce.number().int().positive().max(200).optional(),
  curso: z.coerce.number().int().optional(),
  q: z.string().trim().max(100).optional(),
});

export const cursosSchema = z.object({
  centro: z.string().trim().regex(/^[A-Za-z0-9]{2,10}$/, 'Centro no valido'),
});

/** Quien decide NO va aqui: lo pone el servidor con el usuario de la sesion. */
export const decisionesSchema = z.object({
  items: z.array(z.object({
    matriculaId: z.number().int().positive(),
    decision: z.enum(['aprobada', 'rechazada']),
    motivo: z.union([texto(500), z.null()]).optional(),
  })).min(1, 'Elige al menos una matricula').max(200, 'Maximo 200 por vez'),
});

export const emitirSchema = z.object({
  // 10 y no 50, lo mismo que la pantalla: cada matricula de un campus con Moodle baja su
  // expediente en serie, y 50 pasan del minuto que nginx espera (504 con la emision a medias).
  matriculaIds: z.array(z.number().int().positive()).min(1, 'Elige al menos una matricula').max(10, 'Maximo 10 por vez: dividelo en tandas'),
});

// --- Diplomas (#272): solicitudes desde Moodle y el panel Diplomas ---

const centro = z.string().trim().regex(/^[A-Za-z0-9]{2,10}$/, 'Centro no valido');
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no valida (AAAA-MM-DD)');
const nexp = z.string().trim().toUpperCase().regex(/^[A-Z]{3}-\d{4}-\d{6}-[A-Z0-9]{4}$/, 'Numero de expediente no valido');
const ids = (max, msg) => z.array(z.number().int().positive()).min(1, 'Elige al menos una').max(max, msg);
const motivo = z.string().trim().min(3, 'Indica el motivo').max(500);

/**
 * Lo que manda Certifex al pedir un alumno su diploma. SIN DNI (decision del 08/10):
 * el alumno solo escribe su nombre, y ese es el que se imprimira.
 */
export const solicitudSchema = z.object({
  matriculaId: z.number().int().positive(),
  centro,
  curso: z.object({
    ref: z.union([z.number().int(), z.null()]).optional(),
    nombre: z.union([texto(300), z.null()]).optional(),
  }).optional().nullable(),
  alumno: z.object({
    nombreDiploma: texto(200).min(2, 'Falta el nombre del diploma'),
    nombreMoodle: opcional(200),
    email: z.union([z.string().trim().email().max(254), z.null()]).optional(),
  }),
  solicitadaEn: z.string().datetime({ offset: true }),
});

/** Filtros comunes del panel: campus, formacion, busqueda, fechas y pagina. */
const filtrosPanel = {
  centro: centro.optional(),
  curso: z.coerce.number().int().optional(),
  q: z.string().trim().max(100).optional(),
  desde: dia.optional(),
  hasta: dia.optional(),
  pagina: z.coerce.number().int().positive().optional(),
  tam: z.coerce.number().int().positive().max(200).optional(),
  // `todo=1`: todas las filas que cumplen los filtros (para exportar a Excel).
  todo: z.enum(['0', '1']).optional(),
};

export const listarSolicitudesSchema = z.object({
  estado: z.enum(['pendiente', 'aprobada', 'rechazada', 'todas']).optional(),
  ...filtrosPanel,
});

export const listarDiplomasSchema = z.object({
  estado: z.enum(['vigentes', 'revocados', 'todos']).optional(),
  aviso: z.enum(['pendiente', 'enviado', 'no_salio']).optional(),
  ...filtrosPanel,
}).refine((f) => f.curso === undefined || f.centro, { message: 'Para filtrar por formacion elige antes el campus', path: ['curso'] });

export const porAvisarSchema = z.object({
  centro: centro.optional(),
  q: z.string().trim().max(100).optional(),
});

/** Aprobar y emitir: 10 por llamada, lo mismo que emitir (ver `emitirSchema`). */
export const aprobarEmitirSchema = z.object({
  matriculaIds: ids(10, 'Maximo 10 por vez: dividelo en tandas'),
});

export const rechazarSchema = z.object({
  matriculaIds: ids(200, 'Maximo 200 por vez'),
  motivo,
});

export const avisosSchema = z.object({
  nexpedientes: z.array(nexp).min(1, 'Elige al menos un diploma').max(50, 'Maximo 50 por vez: dividelo en tandas'),
});

export const avisosRechazoSchema = z.object({
  matriculaIds: ids(50, 'Maximo 50 por vez: dividelo en tandas'),
});

export const revocarSchema = z.object({ nexpediente: nexp, motivo });

/** Un nombre mal escrito se CORRIGE (mismo numero, auditado): no se revoca y reemite. */
export const corregirSchema = z.object({
  nexpediente: nexp,
  campo: z.enum(['alumno_nombre', 'titulacion']).default('alumno_nombre'),
  valor: texto(200).min(2, 'Escribe el valor correcto'),
  motivo,
});
