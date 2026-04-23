import client from '@/shared/api/client';

export const accountingApi = {
  dashboard: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return client.get(`/accounting/dashboard${q ? '?' + q : ''}`);
  },
  listExpenses: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return client.get(`/accounting/expenses${q ? '?' + q : ''}`);
  },
  createExpense: (data) => client.post('/accounting/expenses', data),
  updateExpense: (id, data) => client.patch(`/accounting/expenses/${id}`, data),
  deleteExpense: (id) => client.delete(`/accounting/expenses/${id}`),
};
