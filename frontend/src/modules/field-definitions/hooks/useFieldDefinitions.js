import { useEffect, useState, useCallback } from 'react';
import * as api from '../api/fields.api';

export default function useFieldDefinitions(projectId, entity) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.listFields(projectId, entity);
      setFields(data);
    } catch (err) {
      setError(err.message || 'Error cargando campos');
    } finally {
      setLoading(false);
    }
  }, [projectId, entity]);

  useEffect(() => { load(); }, [load]);

  return { fields, loading, error, refetch: load };
}
