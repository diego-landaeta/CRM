import client from '@/shared/api/client';

// API stub para custom_roles. El backend (CRM-228) aun no esta desplegado en
// esta rama; estos endpoints devolveran 404 hasta entonces. La pagina de
// roles los detecta y muestra disclaimer en vez de romper.

export async function listCustomRoles(projectId) {
  const res = await client.get(`/permissions/custom-roles?projectId=${projectId}`);
  return res.data || [];
}

export async function createCustomRole(payload) {
  const res = await client.post('/permissions/custom-roles', payload);
  return res.data;
}

export async function updateCustomRole(id, payload) {
  const res = await client.patch(`/permissions/custom-roles/${id}`, payload);
  return res.data;
}

export async function deleteCustomRole(id) {
  await client.delete(`/permissions/custom-roles/${id}`);
}

export async function getUserPermissions(userId) {
  const res = await client.get(`/users/${userId}/permissions`);
  return res.data || {};
}

export async function setUserPermissions(userId, overrides) {
  const res = await client.put(`/users/${userId}/permissions`, { overrides });
  return res.data;
}
