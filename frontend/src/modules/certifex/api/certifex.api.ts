import client, { API_BASE_URL, getAccessToken } from '@/shared/api/client';

/** Una consulta que llega desde la web de Certifex (migración 186). */
export type EstadoConsulta = 'nueva' | 'en_curso' | 'resuelta' | 'spam';

export interface ConsultaCertifex {
  id: number;
  certifexId: number;
  tipo: 'centro' | 'consulta';
  nombre: string;
  email: string;
  telefono: string | null;
  organizacion: string | null;
  urlCampus: string | null;
  mensaje: string;
  idioma: string | null;
  estado: EstadoConsulta;
  notaInterna: string | null;
  atendidaPor: string | null;
  recibidaEn: string;
  creadaEnCertifex: string | null;
  updatedAt: string;
}

export interface Bandeja {
  filas: ConsultaCertifex[];
  total: number;
  pagina: number;
  limite: number;
  nuevas: number;
}

export const certifexApi = {
  listar: (f: { estado?: EstadoConsulta; tipo?: 'centro' | 'consulta'; pagina?: number } = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) p.set(k, String(v));
    return client.get(`/certifex/consultas?${p.toString()}`) as Promise<{ success: boolean; data: Bandeja; error?: string }>;
  },
  actualizar: (id: number, b: { estado?: EstadoConsulta; notaInterna?: string | null }) =>
    client.patch(`/certifex/consultas/${id}`, b) as Promise<{ success: boolean; data: ConsultaCertifex; error?: string }>,
};

// --- Emisiones: el visto bueno y la emisión de títulos en Certifex ---
// El CRM habla con Certifex desde su servidor; aquí solo se llama al backend del CRM.

export type EstadoEmision = 'pendiente' | 'aprobada' | 'rechazada' | 'todas';

export interface ConexionCertifex {
  conectado: boolean;
  nombre?: string;
  centros?: string[];
  /** La web pública de Certifex: verificación y diploma de cada título. */
  urlPublica?: string | null;
  error?: string;
}

/** Una matrícula de Certifex a decidir (o ya decidida). Contrato: docs/integracion-crm.md. */
export interface Candidato {
  matriculaId: number;
  centro: string;
  /** `dni` viene en el contrato, pero el CRM no lo usa ni lo enseña (decisión del 08/10). */
  titular: { nombre: string | null; email: string | null; dni: string | null };
  curso: { ref: number; nombre: string };
  notaFinal: number | null;
  umbral: number | null;
  completado: boolean | null;
  actividades: { total: number; calificadas: number };
  propuesto: boolean;
  nexpediente: string | null;
  /**
   * El alumno lo pidió desde Moodle (#272): cuándo y el nombre que escribió para el
   * diploma, que es el que se imprime. null si no lo pidió.
   */
  solicitud?: { en: string; nombre: string | null } | null;
  /**
   * Lo que el CRM sabe de ese correo, en los campus que ve quien mira: `null` si no
   * está en el CRM; sin el campo si el cruce falló (el listado sale igual).
   */
  crm?: EnElCrm | null;
  decision: {
    decision: 'aprobada' | 'rechazada';
    motivo: string | null;
    decididoPor: string;
    decididoEn: string;
    refExterna: string | null;
  } | null;
}

/** Un alumno de Certifex visto desde el CRM: sus fichas y lo que compró y pagó. */
export interface EnElCrm {
  leadId: number;
  fichas: number;
  ventas: number;
  vendido: number;
  cobrado: number;
  pendiente: number;
}

/** Recuentos de lo que hay que hacer: por decidir, listo para emitir, rechazado, emitido. */
export interface Recuentos {
  matriculados: number;
  porDecidir: number;
  aprobadasSinEmitir: number;
  rechazadas: number;
  emitidas: number;
}

/** Un campus de Certifex conectado a este CRM. */
export interface CampusCertifex extends Recuentos {
  codigo: string;
  nombre: string;
  moodleUrl: string | null;
  /** Ruta del logo en la web de Certifex (relativa a `urlPublica`). */
  logo: string | null;
  activo: boolean;
  cursos: number;
}

export interface CursoCertifex extends Recuentos {
  cursoRef: number;
  cursoNombre: string;
}

export interface PaginaCandidatos {
  filas: Candidato[];
  total: number;
  pagina: number;
  tam: number;
}

export interface ResultadoDecision { matriculaId: number | null; ok: boolean; error?: string; decision?: string; yaEmitida?: string }
export interface ResultadoEmision { matriculaId: number | null; ok: boolean; nexpediente?: string; yaExistia?: boolean; error?: string }

type R<T> = Promise<{ success: boolean; data: T; error?: string }>;

export const emisionesApi = {
  estado: () => client.get('/certifex/emisiones/estado') as R<ConexionCertifex>,
  centros: () => client.get('/certifex/emisiones/centros') as R<CampusCertifex[]>,
  cursos: (centro: string) => client.get(`/certifex/emisiones/cursos?centro=${encodeURIComponent(centro)}`) as R<CursoCertifex[]>,
  listar: (f: { estado?: EstadoEmision; centro?: string; pagina?: number; curso?: number; q?: string } = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) p.set(k, String(v));
    return client.get(`/certifex/emisiones?${p.toString()}`) as R<PaginaCandidatos>;
  },
  decidir: (items: { matriculaId: number; decision: 'aprobada' | 'rechazada'; motivo?: string | null }[]) =>
    client.post('/certifex/emisiones/decisiones', { items }) as R<{ resultados: ResultadoDecision[] }>,
  emitir: (matriculaIds: number[]) =>
    client.post('/certifex/emisiones/emitir', { matriculaIds }) as R<{ resultados: ResultadoEmision[] }>,
  /** El logo de un campus, traído por el servidor del CRM para poder medir su brillo. */
  logo: async (ruta: string): Promise<Blob> => {
    const t = getAccessToken();
    const r = await fetch(`${API_BASE_URL}/certifex/emisiones/logo?ruta=${encodeURIComponent(ruta)}`, {
      credentials: 'include',
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    if (!r.ok) throw new Error(`Error ${r.status}`);
    return r.blob();
  },
  /** El PDF del diploma, traído por el servidor del CRM (Certifex no se deja incrustar). */
  diploma: async (nexpediente: string, version?: number): Promise<Blob> => {
    const t = getAccessToken();
    // `version`: tras corregir un diploma, para no ver la copia de antes (el servidor la
    // deja en caché unos minutos).
    const v = version ? `?v=${version}` : '';
    const r = await fetch(`${API_BASE_URL}/certifex/emisiones/diploma/${encodeURIComponent(nexpediente)}${v}`, {
      credentials: 'include',
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d?.error || `Error ${r.status}`);
    }
    return r.blob();
  },
};

// --- Diplomas (#272): lo que el alumno pide desde Moodle y los diplomas emitidos ---
// Emitir NO avisa al alumno: el correo sale solo cuando alguien lo aprueba aquí.

export type PestanaDiplomas = 'pendientes' | 'enviados' | 'rechazados' | 'revocados';
export type ResultadoAviso = 'enviado' | 'correo_apagado' | 'sin_correo' | 'error';
export type FiltroAviso = 'pendiente' | 'enviado' | 'no_salio';

/** Una solicitud de diploma: un candidato de Certifex que lo pidió desde Moodle. */
export interface Solicitud extends Candidato {
  /** El aviso de rechazo que ya se aprobó (solo en las rechazadas). */
  avisoRechazo?: { en: string; por: string; resultado: string } | null;
  /** Solo en «por avisar»: el diploma emitido. */
  diploma?: Diploma | null;
}

export interface Diploma {
  nexpediente: string;
  centro: string;
  alumno: string;
  titulacion: string;
  cursoRef: number | null;
  emitidoEn: string | null;
  emitidaPor: string | null;
  revocada: boolean;
  revocacion: { en: string | null; motivo: string | null; por: string | null } | null;
  verificarUrl: string;
  diplomaUrl: string;
  aviso: { resultado: ResultadoAviso; en: string; por: string } | null;
}

export interface Pagina<T> { filas: T[]; total: number; pagina: number; tam: number; truncado?: boolean }

export interface ResumenDiplomas {
  pendientes: number;
  rechazadas: number;
  vigentes: number;
  revocados: number;
  porAvisar: number;
  sinEmitir: number;
}

export interface FiltrosDiplomas {
  centro?: string;
  curso?: number;
  q?: string;
  desde?: string;
  hasta?: string;
  pagina?: number;
  tam?: number;
  todo?: '1';
}

export interface ResultadoAprobarEmitir { matriculaId: number; ok: boolean; fase: 'aprobar' | 'emitir'; nexpediente?: string; yaExistia?: boolean; error?: string }
export interface RespuestaAvisos { correoActivo: boolean; resultados: { nexpediente: string | null; ok: boolean; resultado?: ResultadoAviso; error?: string }[] }
export interface RespuestaAvisosRechazo { correoActivo: boolean; resultados: { matriculaId: number | null; ok: boolean; resultado?: string; error?: string }[] }

const qs = (f: object) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  return p.toString();
};

export const diplomasApi = {
  resumen: (centro?: string) => client.get(`/certifex/diplomas/resumen?${qs({ centro })}`) as R<ResumenDiplomas>,
  solicitudes: (f: FiltrosDiplomas & { estado?: 'pendiente' | 'aprobada' | 'rechazada' | 'todas' }) =>
    client.get(`/certifex/diplomas/solicitudes?${qs(f)}`) as R<Pagina<Solicitud>>,
  porAvisar: (f: { centro?: string; q?: string }) =>
    client.get(`/certifex/diplomas/por-avisar?${qs(f)}`) as R<{ porAvisar: Solicitud[]; sinEmitir: Solicitud[]; truncado?: boolean }>,
  diplomas: (f: FiltrosDiplomas & { estado?: 'vigentes' | 'revocados' | 'todos'; aviso?: FiltroAviso }) =>
    client.get(`/certifex/diplomas?${qs(f)}`) as R<Pagina<Diploma>>,
  aprobarEmitir: (matriculaIds: number[]) =>
    client.post('/certifex/diplomas/aprobar-emitir', { matriculaIds }) as R<{ resultados: ResultadoAprobarEmitir[] }>,
  rechazar: (matriculaIds: number[], motivo: string) =>
    client.post('/certifex/diplomas/rechazar', { matriculaIds, motivo }) as R<{ resultados: ResultadoDecision[] }>,
  avisos: (nexpedientes: string[]) => client.post('/certifex/diplomas/avisos', { nexpedientes }) as R<RespuestaAvisos>,
  avisosRechazo: (matriculaIds: number[]) =>
    client.post('/certifex/diplomas/avisos-rechazo', { matriculaIds }) as R<RespuestaAvisosRechazo>,
  revocar: (nexpediente: string, motivo: string) =>
    client.post('/certifex/diplomas/revocar', { nexpediente, motivo }) as R<{ ok: true; nexpediente: string }>,
  corregirNombre: (nexpediente: string, valor: string, motivo: string) =>
    client.post('/certifex/diplomas/corregir', { nexpediente, campo: 'alumno_nombre', valor, motivo }) as R<{ ok: true; nexpediente: string }>,
};
