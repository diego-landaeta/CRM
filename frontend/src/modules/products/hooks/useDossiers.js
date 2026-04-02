import { useState, useEffect, useCallback } from 'react';
import { getDossierHistory, uploadDossier, getDossierUrl } from '../api/dossiers.api';

export function useDossiers(productId, projectId) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(async () => {
    if (!productId || !projectId) return;
    setLoading(true);
    try {
      const data = await getDossierHistory(productId, projectId);
      setHistory(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar historial');
    } finally {
      setLoading(false);
    }
  }, [productId, projectId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const upload = async (file) => {
    setUploading(true);
    setUploadProgress(0);
    setError(null);
    try {
      const dossier = await uploadDossier(projectId, productId, file, (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percent);
      });
      await fetchHistory();
      return dossier;
    } catch (err) {
      setError(err.response?.data?.error || 'Error al subir archivo');
      throw err;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const download = async (dossierId) => {
    const { url } = await getDossierUrl(dossierId, projectId);
    window.open(url, '_blank');
  };

  const activeDossier = history.find((d) => d.active);

  return { history, activeDossier, loading, uploading, uploadProgress, error, upload, download, refetch: fetchHistory };
}
