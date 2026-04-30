// Tipos compartidos del módulo webhooks. Los webhooks son entradas de
// datos externas (Make/Zapier/forms HTTP) que crean Lead o Matrícula
// según el `field_mapping`.

export type WebhookDestination = 'lead' | 'matricula';

/**
 * El backend reusa la tabla `forms` para webhooks (kind='webhook').
 * Por eso muchos endpoints son /forms/:id y comparte schema con FormDef.
 */
export interface Webhook {
  id: number;
  project_id: number;
  kind: 'webhook';
  nombre: string;
  destination: WebhookDestination;
  field_mapping?: Record<string, string>;
  embed_id: string;
  active: boolean;
  submissions_count?: number;
  sample_payload?: Record<string, unknown> | null;
  listening_until?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface WebhookTarget {
  key: string;
  label: string;
  required?: boolean;
}

export type WebhookFieldMapping = Record<string, string>;
