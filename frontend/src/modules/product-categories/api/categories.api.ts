import client from '@/shared/api/client';

export interface CategoryNode {
  id: number;
  parent_id: number | null;
  nombre: string;
  orden: number;
  source: string;
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
