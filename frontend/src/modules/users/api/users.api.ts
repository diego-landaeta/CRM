import client from '@/shared/api/client';
import type { UserRole } from '@/shared/types';

/** Un proyecto asignado, con su flag de round-robin. */
export interface ProjectAssignment {
  projectId: number;
  recibeLeads: boolean;
}

export interface CrmUser {
  id: number;
  nombre: string;
  email: string;
  role: UserRole;
  active: boolean;
  last_login_at: string | null;
  created_at: string | null;
  whatsapp_phone: string | null;
  whatsapp_display_name: string | null;
  avatar_url: string | null;
  projects: ProjectAssignment[];
  /**
   * OJO: el listado del backend NO devuelve esta columna (la usa en el WHERE
   * pero no la incluye en el SELECT). Llega siempre undefined, asi que quien
   * lleva colaboraciones sale etiquetado como «gestor». Es un SELECT de una
   * linea en backend/src/modules/users/user.model.js — pedido a Diego.
   */
  gestor_colaboraciones?: boolean;
}

export interface ListUsersParams {
  /** Proyecto concreto, o undefined para todos. */
  projectId?: number;
  /** El backend topa en 100. */
  limit?: number;
  page?: number;
}

export interface ListUsersResult {
  users: CrmUser[];
  /** Cuantos hay en total en el servidor — puede ser mayor que users.length. */
  total: number;
}

/**
 * El backend devuelve los proyectos en dos formas segun la antiguedad del dato:
 * `projects: [{projectId, recibeLeads}]` (actual) y `project_ids: [1,2]` (viejo).
 * Aqui se normaliza a una sola para que ningun componente tenga que saberlo.
 */
function normalizeProjects(raw: any): ProjectAssignment[] {
  const lista = raw?.projects;
  if (Array.isArray(lista) && lista.length > 0 && typeof lista[0] === 'object' && lista[0] !== null && 'projectId' in lista[0]) {
    return lista.map((p: any) => ({ projectId: Number(p.projectId), recibeLeads: !!p.recibeLeads }));
  }
  return (raw?.project_ids || []).map((id: number) => ({ projectId: Number(id), recibeLeads: false }));
}

function normalizeUser(raw: any): CrmUser {
  return {
    id: raw.id,
    nombre: raw.nombre || raw.name || '',
    email: raw.email || '',
    role: raw.role,
    active: raw.active !== false,
    last_login_at: raw.last_login_at ?? null,
    created_at: raw.created_at ?? null,
    whatsapp_phone: raw.whatsapp_phone ?? null,
    whatsapp_display_name: raw.whatsapp_display_name ?? null,
    avatar_url: raw.avatar_url ?? null,
    projects: normalizeProjects(raw),
    gestor_colaboraciones: raw.gestor_colaboraciones,
  };
}

export async function listUsers({ projectId, limit = 100, page = 1 }: ListUsersParams = {}): Promise<ListUsersResult> {
  const res = await client.get('/users', {
    params: {
      limit,
      page,
      // La pantalla de Usuarios es la que tiene que verlos a todos: profesores y
      // colaboraciones incluidos. El resto del CRM los pide sin este flag.
      incluirTodos: 'true',
      // El sentinel -1 («todos los proyectos») no vale: el backend valida > 0.
      projectId: projectId && projectId > 0 ? projectId : undefined,
    },
  });
  if (!res.success) throw new Error(res.error || 'No se pudieron cargar los usuarios');
  return {
    users: (res.data || []).map(normalizeUser),
    total: res.pagination?.total ?? (res.data || []).length,
  };
}

export interface CreateUserPayload {
  nombre: string;
  email: string;
  role: UserRole;
  projects: ProjectAssignment[];
}

export interface CreateUserResult {
  user: CrmUser;
  /** Link de invitacion — solo viene si el envio por email no salio. */
  setPasswordToken?: string;
}

export async function createUser(payload: CreateUserPayload): Promise<CreateUserResult> {
  const res = await client.post('/users', payload);
  if (!res.success) throw new Error(res.error || 'No se pudo crear el usuario');
  return { user: normalizeUser(res.data), setPasswordToken: res.data?.setPasswordToken };
}

/** Solo estos campos acepta el backend hoy. El email NO se puede cambiar. */
export interface UpdateUserPayload {
  nombre?: string;
  role?: UserRole;
  projects?: ProjectAssignment[];
  /**
   * Formato viejo, que aqui sirve para una cosa que el nuevo no puede: dejar a
   * un usuario SIN proyectos. El backend lee `projects: []` como «no tocar»
   * (cae al else y se queda en null), mientras que `projectIds: []` si
   * desactiva todas sus asignaciones. Ver user.model.js · update().
   */
  projectIds?: number[];
  whatsapp_phone?: string;
}

export async function updateUser(id: number, payload: UpdateUserPayload): Promise<CrmUser> {
  const res = await client.patch(`/users/${id}`, payload);
  if (!res.success) throw new Error(res.error || 'No se pudo actualizar el usuario');
  return normalizeUser(res.data);
}

export async function deactivateUser(id: number): Promise<{ leads_huerfanizados?: number; leads_reasignados?: number }> {
  const res = await client.delete(`/users/${id}`);
  if (!res.success) throw new Error(res.error || 'No se pudo desactivar el usuario');
  return res.data || {};
}

export async function reactivateUser(id: number): Promise<void> {
  const res = await client.patch(`/users/${id}/reactivate`);
  if (!res.success) throw new Error(res.error || 'No se pudo reactivar el usuario');
}

/** Reset de contraseña por un superadmin. Cierra las sesiones activas del usuario. */
export async function setUserPassword(id: number, password: string): Promise<void> {
  const res = await client.patch(`/users/${id}/password`, { password });
  if (!res.success) throw new Error(res.error || 'No se pudo cambiar la contraseña');
}
