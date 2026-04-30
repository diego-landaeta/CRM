import client from '@/shared/api/client';
import type { ApiResponse } from '@/shared/types';

export type DocumentType = 'invoice' | 'certificate';

export type DocumentStatus = 'draft' | 'issued' | 'paid' | 'cancelled';

export interface InvoiceData {
  client_nombre?: string;
  client_dni?: string;
  client_direccion?: string;
  concept?: string;
  items?: Array<{ description: string; qty: number; unit_price: number }>;
  iva_percent?: number;
  total?: number;
  notes?: string;
  [key: string]: unknown;
}

export interface CertificateData {
  client_nombre?: string;
  client_dni?: string;
  course_name?: string;
  hours?: number;
  start_date?: string;
  end_date?: string;
  signed_by?: string;
  [key: string]: unknown;
}

export type DocumentData = InvoiceData | CertificateData | Record<string, unknown>;

export interface CrmDocument {
  id: number;
  project_id: number;
  type: DocumentType;
  number: string;
  client_nombre?: string;
  client_email?: string;
  data: DocumentData;
  pdf_url?: string;
  status?: DocumentStatus;
  created_at: string;
  updated_at?: string;
  created_by_nombre?: string;
}

export interface PreviewResult {
  html?: string;
  pdf_base64?: string;
  url?: string;
}

export const documentsApi = {
  list: (projectId: number, type?: DocumentType): Promise<ApiResponse<CrmDocument[]>> =>
    client.get(`/documents?projectId=${projectId}${type ? `&type=${type}` : ''}`),

  generate: (projectId: number, type: DocumentType, data: DocumentData): Promise<ApiResponse<CrmDocument>> =>
    client.post('/documents/generate', { projectId, type, data }),

  download: (id: number, projectId: number): Promise<Blob> =>
    client.get(`/documents/${id}/download?projectId=${projectId}`, { responseType: 'blob' }),

  remove: (id: number, projectId: number): Promise<ApiResponse<void>> =>
    client.delete(`/documents/${id}?projectId=${projectId}`),

  preview: (type: DocumentType, data: DocumentData): Promise<ApiResponse<PreviewResult>> =>
    client.post('/documents/preview', { type, data }),
};
