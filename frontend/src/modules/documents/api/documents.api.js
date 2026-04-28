import client from '@/shared/api/client';

export const documentsApi = {
  list: (projectId, type) =>
    client.get(`/documents?projectId=${projectId}${type ? `&type=${type}` : ''}`),

  generate: (projectId, type, data) =>
    client.post('/documents/generate', { projectId, type, data }),

  download: (id, projectId) =>
    client.get(`/documents/${id}/download?projectId=${projectId}`, { responseType: 'blob' }),

  remove: (id, projectId) =>
    client.delete(`/documents/${id}?projectId=${projectId}`),
};
