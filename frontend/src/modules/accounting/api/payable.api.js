import client from '@/shared/api/client';

export const payableApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return client.get(`/accounts-payable${qs ? '?' + qs : ''}`);
  },
  stats: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return client.get(`/accounts-payable/stats${qs ? '?' + qs : ''}`);
  },
  get: (id) => client.get(`/accounts-payable/${id}`),
  create: (data) => client.post('/accounts-payable', data),
  update: (id, data) => client.patch(`/accounts-payable/${id}`, data),
  remove: (id) => client.delete(`/accounts-payable/${id}`),
  addPayment: (id, data) => client.post(`/accounts-payable/${id}/payments`, data),
};
