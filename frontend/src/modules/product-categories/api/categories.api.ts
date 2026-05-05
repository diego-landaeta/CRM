import client from '@/shared/api/client';

export interface CategoryNode {
  id: number;
  parent_id: number | null;
  nombre: string;
  orden: number;
  source: 'wc' | 'wp_menu' | 'manual' | string;
  external_url: string | null;
  external_id: string | null;
  active: boolean;
  productos_count: number;
  children: CategoryNode[];
}

export async function getTree(projectId: number): Promise<CategoryNode[]> {
  const res = await client.get(`/product-categories/tree?projectId=${projectId}`);
  return res.data;
}

export async function createCategory(data: {
  project_id: number;
  parent_id: number | null;
  nombre: string;
  orden?: number;
}) {
  const res = await client.post('/product-categories', data);
  return res.data;
}

export async function updateCategory(id: number, data: {
  nombre?: string;
  parent_id?: number | null;
  orden?: number;
}) {
  const res = await client.patch(`/product-categories/${id}`, data);
  return res.data;
}

export async function deleteCategory(id: number) {
  const res = await client.delete(`/product-categories/${id}`);
  return res.data;
}
