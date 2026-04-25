import { useEffect, useState } from 'react';
import { uploadAudienceToMeta, getMetaUploadStatus, getMetaUploadHistory } from '../api/audiences.api';

/**
 * Hook CRM-115: gestiona upload a Meta + polling cada 5s + historial.
 */
export function useMetaUpload(projectId) {
  const [upload, setUpload] = useState(null); // { uploadId, status, ... } en curso
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState(null);

  // Polling 5s mientras hay upload no completado/error
  useEffect(() => {
    if (!upload || upload.status === 'completed' || upload.status === 'error') return;
    const t = setInterval(async () => {
      const r = await getMetaUploadStatus(upload.uploadId);
      if (r.success) {
        setUpload(r.data);
        if (r.data.status === 'completed') {
          // refrescar historial
          loadHistory();
        }
      } else {
        setError(r.error);
      }
    }, 1500); // mock acelerado; backend real seria 5000
    return () => clearInterval(t);
  }, [upload?.uploadId, upload?.status]); // eslint-disable-line

  // Cargar historial cuando cambia proyecto
  useEffect(() => {
    if (projectId) loadHistory();
  }, [projectId]); // eslint-disable-line

  async function loadHistory() {
    if (!projectId) return;
    setHistoryLoading(true);
    try {
      const r = await getMetaUploadHistory(projectId);
      if (r.success) setHistory(r.data || []);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function startUpload({ filters, audienceId } = {}) {
    setError(null);
    const r = await uploadAudienceToMeta({ projectId, filters, audienceId });
    if (r.success) {
      setUpload(r.data);
      return r.data;
    } else {
      setError(r.error);
      throw new Error(r.error);
    }
  }

  function reset() { setUpload(null); setError(null); }

  return { upload, history, historyLoading, error, startUpload, reset, refreshHistory: loadHistory };
}
