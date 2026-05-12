import client from '@/shared/api/client';
import type { ApiResponse } from '@/shared/types';

export type MetodoPago = 'tarjeta' | 'transferencia' | 'efectivo' | 'fraccionado';

export interface Payment {
  id: number;
  conversion_id?: number;
  importe: number | string;
  fecha: string;
  notas?: string | null;
  created_at?: string;
}

export interface Conversion {
  id: number;
  lead_id?: number;
  project_id?: number;
  producto_contratado: string;
  importe_total: number | string;
  importe_pagado: number | string;
  metodo_pago?: MetodoPago | null;
  fecha_conversion: string;
  fecha_compromiso_pago?: string | null;
  notas_pago?: string | null;
  payments_count?: number;
  payments?: Payment[];
  lead_nombre?: string;
  product_nombre?: string;
  created_at?: string;
}

export interface CreateConversionInput {
  lead_id: number;
  project_id: number;
  producto_contratado: string;
  importe_total: number;
  importe_pagado: number;
  metodo_pago: MetodoPago;
  fecha_compromiso_pago?: string | null;
  fecha_conversion: string;
  notas_pago?: string | null;
}

export interface AddPaymentInput {
  importe: number;
  fecha: string;
  notas?: string | null;
}

type ListParams = Record<string, string | number | undefined> | undefined;

export const conversionsApi = {
  list: (params: ListParams = {}): Promise<ApiResponse<Conversion[]>> => {
    const filtered = Object.fromEntries(
      Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    ) as Record<string, string>;
    const q = new URLSearchParams(filtered).toString();
    return client.get(`/conversions${q ? '?' + q : ''}`);
  },
  getById: (id: number): Promise<ApiResponse<Conversion>> =>
    client.get(`/conversions/${id}`),
  byLead: (leadId: number): Promise<ApiResponse<Conversion[]>> =>
    client.get(`/conversions/by-lead/${leadId}`),
  create: (data: CreateConversionInput): Promise<ApiResponse<Conversion>> =>
    client.post('/conversions', data),
  update: (id: number, data: Partial<Conversion>): Promise<ApiResponse<Conversion>> =>
    client.patch(`/conversions/${id}`, data),
  remove: (id: number): Promise<ApiResponse<void>> =>
    client.delete(`/conversions/${id}`),
  addPayment: (id: number, data: AddPaymentInput): Promise<ApiResponse<Payment>> =>
    client.post(`/conversions/${id}/payments`, data),
  removePayment: (paymentId: number): Promise<ApiResponse<void>> =>
    client.delete(`/conversions/payments/${paymentId}`),
  generateInstallments: (
    id: number,
    data: {
      num_cuotas?: number;
      importe_total?: number;
      fecha_inicio?: string;
      installments?: Array<{ importe_previsto: number; fecha_vencimiento: string }>;
    },
  ): Promise<ApiResponse<unknown>> =>
    client.post(`/conversions/${id}/installments/generate`, data),
};
