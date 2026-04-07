import { useState, useEffect, useCallback } from 'react';
import client from '@/shared/api/client';

export function useProducts(projectId) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProducts = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await client.get(`/products?projectId=${projectId}`);
      if (res.success) {
        setProducts(res.data || []);
      }
    } catch (err) {
      setError(err.message);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Placeholder CRUD functions — product write endpoints pendientes
  const create = async (payload) => {
    try {
      const res = await client.post('/products', { ...payload, project_id: projectId });
      if (res.success) {
        await fetchProducts();
        return res.data;
      }
    } catch (err) {
      throw err;
    }
  };

  const update = async (id, payload) => {
    try {
      const res = await client.patch(`/products/${id}`, payload);
      if (res.success) {
        await fetchProducts();
      }
    } catch (err) {
      throw err;
    }
  };

  const deactivate = async (id) => {
    try {
      const res = await client.delete(`/products/${id}`);
      if (res.success) {
        await fetchProducts();
      }
    } catch (err) {
      throw err;
    }
  };

  return { products, loading, error, refetch: fetchProducts, create, update, deactivate };
}
