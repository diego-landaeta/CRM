import { useEffect, useState } from 'react';
import {
  uploadAudienceToMeta,
  getMetaUploadStatus,
  getMetaUploadHistory,
  type AudienceFilters,
  type MetaUpload,
  type MetaUploadHistoryItem,
} from '../api/audiences.api';

export interface StartUploadArgs {
  filters: AudienceFilters;
  audienceId?: string;
}

export interface UseMetaUploadResult {
  upload: MetaUpload | null;
  history: MetaUploadHistoryItem[];
  historyLoading: boolean;
  error: string | null;
  startUpload: (args: StartUploadArgs) => Promise<MetaUpload>;
  reset: () => void;
  refreshHistory: () => Promise<void>;
}

/**
 * Hook CRM-115: gestiona upload a Meta + polling + historial.
 */
export function useMetaUpload(projectId: number | null | undefined): UseMetaUploadResult {
  const [upload, setUpload] = useState<MetaUpload | null>(null);
  const [history, setHistory] = useState<MetaUploadHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Polling mientras el upload no termine
  useEffect(() => {
    if (!upload || upload.status === 'completed' || upload.status === 'error') return;
    const t = setInterval(async () => {
      const r = await getMetaUploadStatus(upload.uploadId);
      if (r.success && r.data) {
        setUpload(r.data);
        if (r.data.status === 'completed') {
          loadHistory();
        }
      } else if (!r.success) {
        setError(r.error || null);
      }
    }, 1500); // mock acelerado; backend real seria 5000
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upload?.uploadId, upload?.status]);

  // Cargar historial cuando cambia proyecto
  useEffect(() => {
    if (projectId) loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function loadHistory(): Promise<void> {
    if (!projectId) return;
    setHistoryLoading(true);
    try {
      const r = await getMetaUploadHistory(projectId);
      if (r.success) setHistory(r.data || []);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function startUpload({ filters, audienceId }: StartUploadArgs): Promise<MetaUpload> {
    setError(null);
    if (!projectId) throw new Error('Proyecto no seleccionado');
    const r = await uploadAudienceToMeta({ projectId, filters, audienceId });
    if (r.success && r.data) {
      setUpload(r.data);
      return r.data;
    }
    setError(r.error || 'Error');
    throw new Error(r.error || 'Error');
  }

  function reset(): void {
    setUpload(null);
    setError(null);
  }

  return { upload, history, historyLoading, error, startUpload, reset, refreshHistory: loadHistory };
}
