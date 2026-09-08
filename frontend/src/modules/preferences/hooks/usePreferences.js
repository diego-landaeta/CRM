import { useState, useEffect, useCallback } from 'react';
import client from '@/shared/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/shared/hooks/useToast';

const DEFAULT = {
  hidden_sidebar_items: [],
  lead_columns_override: null,
  client_columns_override: null,
  dashboard_widgets: [],
  saved_filters: [],
  table_density: 'comfortable',
  theme_preference: null,
  language: 'es',
};

export function usePreferences(projectId) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const qs = projectId ? `?projectId=${projectId}` : '';
      const res = await client.get(`/users/${user.id}/views${qs}`);
      if (res.success) setPreferences({ ...DEFAULT, ...res.data });
      setError(null);
    } catch (err) {
      setError(err);
      // Fallback a defaults silencioso
    } finally {
      setLoading(false);
    }
  }, [user?.id, projectId]);

  useEffect(() => { load(); }, [load]);

  const update = useCallback(async (changes) => {
    if (!user?.id) return;
    const antes = preferences;
    setPreferences({ ...preferences, ...changes });
    try {
      await client.patch(`/users/${user.id}/views`, { ...changes, projectId: projectId || null });
    } catch (err) {
      // Se pintaba el cambio y se tragaba el fallo: quedaba en pantalla algo
      // que no se habia guardado, y al recargar volvia atras sin explicacion.
      setPreferences(antes);
      setError(err);
      toast({
        title: 'No se pudo guardar',
        description: err?.response?.data?.error || 'Lo dejamos como estaba.',
        variant: 'destructive',
      });
    }
  }, [user?.id, preferences, projectId]);

  return { preferences, loading, error, update, reload: load };
}
