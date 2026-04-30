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

interface ParamsWithProjectId {
  params: { projectId: number };
}

export async function getProducts(projectId: number): Promise<Product[]> {
  const { data } = await (client as any).get('/products', { params: { projectId } } as ParamsWithProjectId);
  return data.data;
}

export async function getProduct(id: number, projectId: number): Promise<Product> {
  const { data } = await (client as any).get(`/products/${id}`, { params: { projectId } } as ParamsWithProjectId);
  return data.data;
}

export async function createProduct(projectId: number, payload: Partial<Product>): Promise<Product> {
  const { data } = await (client as any).post('/products', { ...payload, projectId });
  return data.data;
}

export async function updateProduct(id: number, projectId: number, payload: Partial<Product>): Promise<Product> {
  const { data } = await (client as any).patch(`/products/${id}`, payload, { params: { projectId } } as ParamsWithProjectId);
  return data.data;
}

export async function deactivateProduct(id: number, projectId: number): Promise<Product> {
  const { data } = await (client as any).delete(`/products/${id}`, { params: { projectId } } as ParamsWithProjectId);
  return data.data;
}
