// Lead emails API (CRM-231) — envio manual de emails desde la ficha del lead
// + listado de historial. Usa Brevo del proyecto via cascade en backend.
import client from '@/shared/api/client';
import type { ApiResponse } from '@/shared/types';

export interface LeadEmail {
  id: number;
  lead_id: number;
  user_id: number;
  user_nombre?: string | null;
  subject: string;
  body_html: string;
  brevo_msg_id: string | null;
  sent_at: string;
}

export interface SendLeadEmailPayload {
  subject: string;
  body_html: string;
  body_text?: string;
  /** De qué paso es. Con `paso_1` el servidor exige los tres documentos (#91). */
  paso?: string;
}

/** Qué lleva el correo del día 1 y qué falta, antes de escribirlo. */
export interface AdjuntosDelDiaUno {
  completo: boolean;
  piezas: { tipo: string; como: string; esta: boolean }[];
}

export const leadEmailsApi = {
  send: (leadId: number, payload: SendLeadEmailPayload): Promise<ApiResponse<{ sent: boolean; messageId: string }>> =>
    client.post(`/leads/${leadId}/send-email`, payload),

  list: (leadId: number): Promise<ApiResponse<LeadEmail[]>> =>
    client.get(`/leads/${leadId}/emails`),

  adjuntosDelDiaUno: (leadId: number): Promise<ApiResponse<AdjuntosDelDiaUno>> =>
    client.get(`/leads/${leadId}/adjuntos-dia-uno`),
};
