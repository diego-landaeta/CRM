import client from '@/shared/api/client';

const qs = (params) => {
  const filtered = Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== null && v !== undefined && v !== ''));
  const s = new URLSearchParams(filtered).toString();
  return s ? `?${s}` : '';
};

export const commissionsApi = {
  // Reglas (admin/superadmin)
  listRules: (params) => client.get(`/commissions/rules${qs(params)}`),
  createRule: (data) => client.post('/commissions/rules', data),
  updateRule: (id, data) => client.patch(`/commissions/rules/${id}`, data),
  deleteRule: (id) => client.delete(`/commissions/rules/${id}`),

  // Vista propia gestor
  listMine: (params) => client.get(`/commissions/me${qs(params)}`),
  statsMine: (params) => client.get(`/commissions/me/stats${qs(params)}`),

  // Vista admin
  list: (params) => client.get(`/commissions${qs(params)}`),
  stats: (params) => client.get(`/commissions/stats${qs(params)}`),

  // Acciones
  pay: (id, data) => client.patch(`/commissions/${id}/pay`, data),
  recalculate: (conversionId) => client.post(`/commissions/recalculate/${conversionId}`),
};
