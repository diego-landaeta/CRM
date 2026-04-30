import client from '@/shared/api/client';

export type ProductStatus = 'draft' | 'pending' | 'active' | 'archived' | string;

export interface PaymentLink {
  label: string;
  url: string;
  tipo: 'completo' | 'anticipo' | 'parcial' | string;
}

export interface Product {
  id: number;
  project_id: number;
  nombre: string;
  descripcion?: string | null;
  sku?: string | null;
  categoria_id?: number | null;
  subcategoria_id?: number | null;
  precio?: number | string | null;
  moneda?: string | null;
  duracion?: string | null;
  duracion_horas?: number | null;
  modalidad?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  url_info?: string | null;
  active?: boolean;
  estado_creacion?: ProductStatus;
  payment_links?: PaymentLink[];
  stripe_link?: string | null;
  notas?: string | null;
  dossier_url?: string | null;
  dossier_version?: number | null;
  dossier_versiones_count?: number;
  has_dossier?: boolean;
  created_at?: string;
  updated_at?: string;
}

export async function getProduct(id: number, projectId: number): Promise<Product> {
  const { data } = await client.get(`/products/${id}`, { params: { projectId } });
  return data.data;
}
