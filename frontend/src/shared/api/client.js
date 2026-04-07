const BASE_URL = '/crm/api';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// Token en memoria (NO localStorage por seguridad)
let accessToken = null;
let onAuthFailure = null; // callback para logout en caso de fallo total

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function setOnAuthFailure(cb) {
  onAuthFailure = cb;
}

async function request(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE_URL}${url}`, {
    credentials: 'include',
    ...options,
    headers,
  });

  // Refresh token on 401
  if (res.status === 401 && !options._retry) {
    try {
      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        accessToken = refreshData.data.accessToken;
        return request(url, { ...options, _retry: true });
      }
    } catch { /* ignore refresh error */ }
    // Refresh tambien fallo — sesion expirada
    accessToken = null;
    if (onAuthFailure) onAuthFailure();
    throw new ApiError('Session expired', 401);
  }

  const data = res.headers.get('content-type')?.includes('json')
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    throw new ApiError(data?.error || data?.message || `Error ${res.status}`, res.status, data);
  }

  return data;
}

const client = {
  get: (url, options) => request(url, { method: 'GET', ...options }),
  post: (url, body, options) => request(url, { method: 'POST', body: JSON.stringify(body), ...options }),
  patch: (url, body, options) => request(url, { method: 'PATCH', body: JSON.stringify(body), ...options }),
  put: (url, body, options) => request(url, { method: 'PUT', body: JSON.stringify(body), ...options }),
  delete: (url, options) => request(url, { method: 'DELETE', ...options }),
  upload: async (url, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const headers = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const res = await fetch(`${BASE_URL}${url}`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(data?.error || `Error ${res.status}`, res.status, data);
    }
    return res.json();
  },
};

export default client;
export { ApiError };
