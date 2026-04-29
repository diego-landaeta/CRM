import client from '@/shared/api/client';

export async function listFields(projectId, entity) {
  const qs = entity ? `?entity=${entity}` : '';
  const res = await client.get(`/field-definitions/project/${projectId}${qs}`);
  return res.data || [];
}

export async function createField(payload) {
  const res = await client.post('/field-definitions', payload);
  return res.data;
}

export async function updateField(id, fields) {
  const res = await client.patch(`/field-definitions/${id}`, fields);
  return res.data;
}

export async function deleteField(id) {
  await client.delete(`/field-definitions/${id}`);
}

export async function reorderFields(projectId, order) {
  await client.post('/field-definitions/reorder', { project_id: projectId, order });
}
