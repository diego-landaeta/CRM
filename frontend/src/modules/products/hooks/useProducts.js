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

  // CRUD: el middleware projectAccess lee projectId desde body o query
  const create = useCallback(async (payload) => {
    const res = await client.post('/products', { ...payload, projectId });
    if (res.success) {
      await fetchProducts();
      return res.data;
    }
    return null;
  }, [projectId, fetchProducts]);

  const update = useCallback(async (id, payload) => {
    const res = await client.patch(`/products/${id}?projectId=${projectId}`, payload);
    if (res.success) {
      await fetchProducts();
      return res.data;
    }
    return null;
  }, [projectId, fetchProducts]);

  const deactivate = useCallback(async (id) => {
    const res = await client.delete(`/products/${id}?projectId=${projectId}`);
    if (res.success) {
      await fetchProducts();
      return res.data;
    }
    return null;
  }, [projectId, fetchProducts]);

  return { products, loading, error, refetch: fetchProducts, create, update, deactivate };
}
