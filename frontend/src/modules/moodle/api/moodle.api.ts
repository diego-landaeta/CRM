import client from '@/shared/api/client';

// Moodle: el panel de cursos, alumnos y recursos de cada campus (#335). Solo lectura.
// El token de cada Moodle vive cifrado en el servidor y nunca llega aquí.

export type EstadoCurso = 'activo' | 'proximo' | 'terminado' | 'oculto';
export type FiltroEstado = 'activos' | 'proximos' | 'terminados' | 'ocultos' | 'todos';

export interface CampusMoodle {
  id: number;
  nombre: string;
  /** Hay un token de Moodle guardado para este campus. */
  configurado: boolean;
  cursos?: { total: number; activos: number; proximos: number; terminados: number; ocultos: number };
  /** El Moodle del campus no contestó (token caducado, caído…). */
  error?: string;
}

export interface CursoMoodle {
  campus_id: number;
  curso_id: number;
  nombre: string;
  nombre_corto: string | null;
  categoria: string | null;
  estado: EstadoCurso;
  visible: boolean;
  inicio: string | null;
  fin: string | null;
  finalizacion_activada: boolean;
  /** null = no se pudo leer (con su motivo en `alumnos_error`), nunca un 0 que lo disimule. */
  alumnos: number | null;
  alumnos_error?: string;
}

export interface ListaCursos {
  total: number;
  pagina: number;
  limite: number;
  cursos: CursoMoodle[];
  resumen: { cursos_en_moodle: number; de_cache: boolean; actualizado_hace_s: number };
}

export interface CategoriaMoodle {
  id: number;
  nombre: string;
  ruta: string;
  padre_id: number | null;
  profundidad: number;
  cursos: number;
  visible: boolean;
}

export interface AlumnosDelCurso {
  matriculados: number;
  matricula_activa: number | null;
  suspendidos: number | null;
  nunca_han_entrado: number | null;
  terminados: number | null;
  criterios_de_finalizacion: boolean | null;
  otros_roles: number;
  avisos?: string[];
  /** `activos_ultimos_30_dias` (el número de días va en el nombre). */
  [campo: string]: unknown;
}

export interface ActividadDelCurso {
  nombre: string;
  tipo: string;
  visible: boolean;
}

export interface EstructuraDelCurso {
  total_secciones: number;
  total_actividades: number;
  por_tipo: Record<string, number>;
  secciones: { numero: number; nombre: string; visible: boolean; total_actividades: number; actividades: ActividadDelCurso[] }[];
}

export interface RecursoExterno {
  nombre: string;
  seccion: string;
  visible: boolean;
  tipo: 'youtube' | 'vimeo' | 'drive' | 'lti' | 'enlace';
  url: string | null;
  /** Solo si se pidió comprobar: ok · roto · restringido · error_servidor · no_responde · bloqueado · sin_comprobar. */
  estado?: string;
  http?: number;
}

export interface RecursosDelCurso {
  total_recursos_externos: number;
  por_tipo: Record<string, number>;
  enlaces_rotos?: number;
  recursos: RecursoExterno[];
}

const proyecto = (proyectoId: number) => ({ proyecto_id: proyectoId });

export const moodleApi = {
  campus: (refrescar = false) => client.get('/moodle/campus', { params: refrescar ? { refrescar: 1 } : {} }),
  cursos: (p: { proyectoId: number; estado: FiltroEstado; texto?: string; categoriaId?: number | null; pagina: number; limite?: number; refrescar?: boolean }) =>
    client.get('/moodle/cursos', {
      params: {
        proyecto_id: p.proyectoId,
        estado: p.estado,
        pagina: p.pagina,
        limite: p.limite ?? 25,
        ...(p.texto ? { texto: p.texto } : {}),
        ...(p.categoriaId ? { categoria_id: p.categoriaId } : {}),
        ...(p.refrescar ? { refrescar: 1 } : {}),
      },
    }),
  categorias: (proyectoId: number) => client.get('/moodle/categorias', { params: proyecto(proyectoId) }),
  alumnos: (proyectoId: number, cursoId: number) => client.get(`/moodle/cursos/${cursoId}/alumnos`, { params: proyecto(proyectoId) }),
  estructura: (proyectoId: number, cursoId: number) => client.get(`/moodle/cursos/${cursoId}/estructura`, { params: proyecto(proyectoId) }),
  recursos: (proyectoId: number, cursoId: number, comprobar = false) =>
    client.get(`/moodle/cursos/${cursoId}/recursos`, { params: { ...proyecto(proyectoId), ...(comprobar ? { comprobar: 1 } : {}) } }),
};
