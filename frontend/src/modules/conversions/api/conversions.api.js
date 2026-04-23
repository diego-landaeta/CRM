import client from '@/shared/api/client';

export const conversionsApi = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return client.get(`/conversions${q ? '?' + q : ''}`);
  },
  getById: (id) => client.get(`/conversions/${id}`),
  byLead: (leadId) => client.get(`/conversions/by-lead/${leadId}`),
  create: (data) => client.post('/conversions', data),
  update: (id, data) => client.patch(`/conversions/${id}`, data),
  remove: (id) => client.delete(`/conversions/${id}`),
  addPayment: (id, data) => client.post(`/conversions/${id}/payments`, data),
  removePayment: (paymentId) => client.delete(`/conversions/payments/${paymentId}`),
};
