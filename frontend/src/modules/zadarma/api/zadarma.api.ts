import client, { getAccessToken } from '@/shared/api/client';

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

// Una sola petición por persona y carga de la app: el botón sale en muchas
// fichas y chats, y lo que dice cambia solo cuando un admin conecta un campus o
// pone extensiones.
//
// Guardada POR PERSONA: si en la misma pestaña se sale y entra otra (un
// ordenador compartido), no puede heredar las extensiones de la anterior. Se
// sabe quién es por el token de la sesión (su `userId`), sin depender de que
// alguien vacíe esto al salir.
let estado: { userId: string; promesa: Promise<CampusZadarma[]> } | null = null;

function quienSoy(): string {
  const token = getAccessToken();
  if (!token) return '';
  try {
    const carga = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return String(carga.userId ?? carga.id ?? '');
  } catch {
    return '';
  }
}

export function getEstado({ refrescar = false } = {}): Promise<CampusZadarma[]> {
  const userId = quienSoy();
  if (estado && estado.userId === userId && !refrescar) return estado.promesa;
  const promesa = client.get<CampusZadarma[]>('/zadarma/estado')
    .then((r) => (r.success && Array.isArray(r.data) ? r.data : []))
    .catch((err: { status?: number }) => {
      // Sin permiso (403) o sin el módulo (404) la respuesta no va a cambiar:
      // no hay Zadarma y se recuerda. Cualquier otro fallo (red, 500) NO se
      // guarda: la próxima ficha lo vuelve a preguntar.
      if (err?.status !== 403 && err?.status !== 404 && estado?.promesa === promesa) estado = null;
      return [] as CampusZadarma[];
    });
  estado = { userId, promesa };
  return promesa;
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
