import client from '@/shared/api/client';

export async function getProducts(projectId) {
  const { data } = await client.get('/products', { params: { projectId } });
  return data.data;
}

export async function getProduct(id, projectId) {
  const { data } = await client.get(`/products/${id}`, { params: { projectId } });
  return data.data;
}

export async function createProduct(projectId, payload) {
  const { data } = await client.post('/products', { ...payload, projectId });
  return data.data;
}

export async function updateProduct(id, projectId, payload) {
  const { data } = await client.patch(`/products/${id}`, payload, { params: { projectId } });
  return data.data;
}

export async function deactivateProduct(id, projectId) {
  const { data } = await client.delete(`/products/${id}`, { params: { projectId } });
  return data.data;
}
