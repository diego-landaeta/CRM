import { useState, useEffect, useCallback } from 'react';
import { PRODUCTS } from '@/shared/data/mock';

// TODO: reemplazar con llamadas API reales cuando backend este listo
// import { getProducts, createProduct, updateProduct, deactivateProduct } from '../api/products.api';

export function useProducts(projectId) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    // Mock: cargar productos del proyecto
    setTimeout(() => {
      setProducts(PRODUCTS[projectId] || []);
      setLoading(false);
    }, 300);
  }, [projectId]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (payload) => {
    const newProduct = {
      id: Date.now(),
      project_id: projectId,
      active: true,
      has_dossier: false,
      ...payload,
    };
    setProducts((prev) => [newProduct, ...prev]);
    return newProduct;
  };

  const update = async (id, payload) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...payload } : p)));
  };

  const deactivate = async (id) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  return { products, loading, error, refetch: fetch, create, update, deactivate };
}
