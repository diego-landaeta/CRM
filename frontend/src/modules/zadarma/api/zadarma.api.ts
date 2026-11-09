import client from '@/shared/api/client';

/*
  Zadarma (#137): llamar por la centralita, las extensiones de cada persona y
  el reporte de llamadas. Lo que se puede hacer lo decide el servidor con la
  sesión; aquí solo se pide.
*/

/** Un campus con Zadarma conectado que alcanza quien pregunta, y SU extensión allí. */
export interface CampusZadarma {
  project_id: number;
  extension: string | null;
}

export interface ResultadoLlamada {
  extension: string;
  numero: string;
  lead_id: number;
}

export interface ExtensionDePersona {
  user_id: number;
  nombre: string;
  role: string;
  extension: string | null;
}

export interface FilaLlamadas {
  user_id: number | null;
  comercial: string;
  llamadas: number;
  salientes: number;
  entrantes: number;
  contestadas: number;
  no_contestadas: number;
  segundos: number;
  media_segundos: number;
  personas: number;
}

export interface ReporteLlamadas {
  desde: string;
  hasta: string;
  conectado: boolean;
  filas: FilaLlamadas[];
  equipo: Omit<FilaLlamadas, 'user_id' | 'comercial' | 'personas'>;
}

// Una sola petición por carga de la app: el botón sale en muchas fichas y chats,
// y lo que dice cambia solo cuando un admin conecta un campus o pone extensiones.
let estadoEnCurso: Promise<CampusZadarma[]> | null = null;

export function getEstado({ refrescar = false } = {}): Promise<CampusZadarma[]> {
  if (!estadoEnCurso || refrescar) {
    estadoEnCurso = client.get<CampusZadarma[]>('/zadarma/estado')
      .then((r) => (r.success && Array.isArray(r.data) ? r.data : []))
      // Sin permiso o sin el módulo, simplemente no hay Zadarma: sin botón.
      .catch(() => []);
  }
  return estadoEnCurso;
}

export async function llamar(leadId: number): Promise<ResultadoLlamada> {
  const r = await client.post<ResultadoLlamada>('/zadarma/llamar', { lead_id: leadId });
  return r.data as ResultadoLlamada;
}

export async function getExtensiones(projectId: number): Promise<ExtensionDePersona[]> {
  const r = await client.get<ExtensionDePersona[]>(`/zadarma/extensiones?projectId=${projectId}`);
  return r.data ?? [];
}

export async function guardarExtensiones(
  projectId: number,
  extensiones: { user_id: number; extension: string | null }[],
): Promise<ExtensionDePersona[]> {
  const r = await client.put<ExtensionDePersona[]>('/zadarma/extensiones', { projectId, extensiones });
  getEstado({ refrescar: true });
  return r.data ?? [];
}

/** `ambito` es lo de `ambitoComoObjeto`: `{}`, `{ projectId }` o `{ issuerId }`. */
export async function getReporte(
  ambito: { projectId?: number; issuerId?: number },
  desde: string,
  hasta: string,
): Promise<ReporteLlamadas> {
  const p = new URLSearchParams({ desde, hasta });
  Object.entries(ambito).forEach(([k, v]) => p.set(k, String(v)));
  const r = await client.get<ReporteLlamadas>(`/zadarma/reporte?${p.toString()}`);
  return r.data as ReporteLlamadas;
}
