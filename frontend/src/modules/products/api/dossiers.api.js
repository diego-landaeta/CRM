import client from '@/shared/api/client';

export async function uploadDossier(projectId, productId, file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('productId', productId);

  const { data } = await client.post('/dossiers/upload', formData, {
    params: { projectId },
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress,
  });
  return data.data;
}

export async function getDossierUrl(id, projectId) {
  const { data } = await client.get(`/dossiers/${id}/url`, { params: { projectId } });
  return data.data;
}

export async function getDossierHistory(productId, projectId) {
  const { data } = await client.get(`/dossiers/product/${productId}/history`, { params: { projectId } });
  return data.data;
}
