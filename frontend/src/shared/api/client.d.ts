/**
 * Tipos para el client.js (axios-like wrapper sobre fetch).
 * Todas las respuestas siguen el shape `{ success, data?, pagination?, error?, ... }`.
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: string;
  message?: string;
  stats?: Record<string, any>;
  [key: string]: any;
}

export interface RequestOptions {
  signal?: AbortSignal;
  responseType?: 'blob' | 'json' | 'text';
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ApiClient {
  get<T = any>(url: string, options?: RequestOptions): Promise<ApiResponse<T>>;
  post<T = any>(url: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>>;
  patch<T = any>(url: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>>;
  put<T = any>(url: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>>;
  delete<T = any>(url: string, options?: RequestOptions): Promise<ApiResponse<T>>;
  upload<T = any>(url: string, file: File | Blob): Promise<ApiResponse<T>>;
}

/**
 * La raiz de la API, ya con el prefijo del despliegue (/crm/, /testeo/…).
 *
 * Estaba exportada en `client.js` y NO declarada aqui, asi que los dos ficheros
 * que la importan llevaban error de tipos desde que se escribieron. Un `.d.ts`
 * escrito a mano se queda atras en cuanto el `.js` crece; esto es de eso.
 */
export const API_BASE_URL: string;

export function setAccessToken(token: string | null): void;
export function getAccessToken(): string | null;
export function setOnAuthFailure(cb: (() => void) | null): void;

declare const client: ApiClient;
export default client;
