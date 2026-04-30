import { useEffect, useMemo, useState } from 'react';
import { previewAudience, exportAudienceCsv } from '../api/audiences.api';

// Minimo de leads para Meta Custom Audience
export const MIN_AUDIENCE_SIZE = 20;

const DEFAULT_FILTERS = {
  statuses: [],
  canales: [],
  fechaDesde: '',
  fechaHasta: '',
  productoId: null,
  importeMinimo: null,
};

/**
 * Wizard 3 pasos:
 * 0 = Filtros
 * 1 = Preview
 * 2 = Descarga
 */
export function useAudienceWizard(projectId, projectSlug) {
  const [step, setStep] = useState(0);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [downloadLoading, setDownloadLoading] = useState(false);

  // Reset al cambiar de proyecto
  useEffect(() => {
    setStep(0);
    setFilters(DEFAULT_FILTERS);
    setPreview(null);
  }, [projectId]);

  // Preview en tiempo real con debounce + AbortController para cancelar
  // requests viejas si el user sigue cambiando filtros antes de que llegue
  // la respuesta. Sin esto, una respuesta tardía podía pisar a una nueva
  // = race condition con count incorrecto.
  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    const t = setTimeout(() => {
      setPreviewLoading(true);
      setPreviewError(null);
      previewAudience({ projectId, filters, signal: controller.signal })
        .then(r => {
          if (controller.signal.aborted) return;
          if (r.success) setPreview(r.data);
          else setPreviewError(r.error);
        })
        .catch(err => {
          if (err?.name === 'AbortError' || controller.signal.aborted) return;
          setPreviewError(err?.message || String(err));
        })
        .finally(() => {
          if (!controller.signal.aborted) setPreviewLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [projectId, JSON.stringify(filters)]); // eslint-disable-line

  function setFilter(patch) {
    setFilters(prev => ({ ...prev, ...patch }));
  }
  function toggleStatus(status) {
    setFilters(prev => ({
      ...prev,
      statuses: prev.statuses.includes(status)
        ? prev.statuses.filter(s => s !== status)
        : [...prev.statuses, status],
    }));
  }
  function toggleCanal(canal) {
    setFilters(prev => ({
      ...prev,
      canales: prev.canales.includes(canal)
        ? prev.canales.filter(c => c !== canal)
        : [...prev.canales, canal],
    }));
  }
  function resetFilters() { setFilters(DEFAULT_FILTERS); }

  const totalCount = preview?.totalCount ?? 0;
  const meetsMinimum = totalCount >= MIN_AUDIENCE_SIZE;

  const filename = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const slugSafe = (projectSlug || 'proyecto').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    return `audiencia_${slugSafe}_${today}.csv`;
  }, [projectSlug]);

  async function downloadCsv() {
    if (!projectId || !meetsMinimum) return;
    setDownloadLoading(true);
    try {
      const blob = await exportAudienceCsv({ projectId, filters });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.message || 'Error generando CSV' };
    } finally {
      setDownloadLoading(false);
    }
  }

  function next() { setStep(s => Math.min(2, s + 1)); }
  function prev() { setStep(s => Math.max(0, s - 1)); }
  function goTo(i) { setStep(Math.max(0, Math.min(2, i))); }

  return {
    step, next, prev, goTo,
    filters, setFilter, toggleStatus, toggleCanal, resetFilters,
    preview, previewLoading, previewError,
    totalCount, meetsMinimum,
    filename, downloadCsv, downloadLoading,
  };
}
