import axios from 'axios';

const client = axios.create({
  baseURL: '/crm/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const { data } = await axios.post('/crm/api/auth/refresh', {}, { withCredentials: true });
        localStorage.setItem('accessToken', data.data.accessToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return client(original);
      } catch {
        localStorage.removeItem('accessToken');
        window.location.href = '/crm/login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;
