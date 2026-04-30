import client from '@/shared/api/client';
import type { PermissionMap } from '@/shared/hooks/usePermission';

// API stub para custom_roles. El backend (CRM-228) aun no esta desplegado en
// esta rama; estos endpoints devolveran 404 hasta entonces. La pagina de
// roles los detecta y muestra disclaimer en vez de romper.

export interface CustomRole {
  id: number;
  project_id?: number;
  nombre: string;
  descripcion?: string | null;
  base_role?: string | null;
  permissions?: PermissionMap;
}

export async function listCustomRoles(projectId: number): Promise<CustomRole[]> {
  const res = await client.get(`/permissions/custom-roles?projectId=${projectId}`);
  return (res.data as CustomRole[]) || [];
}
