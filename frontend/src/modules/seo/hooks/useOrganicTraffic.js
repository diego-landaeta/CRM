import { useEffect, useState } from 'react';
import { getGscMetrics, getGscConsolidated } from '../api/gsc.api';

export const PRESET_PERIODS = {
  '7d': { label: 'Ultimos 7 dias', days: 7 },
  '14d': { label: 'Ultimos 14 dias', days: 14 },
  '28d': { label: 'Ultimos 28 dias', days: 28 },
  '90d': { label: 'Ultimos 90 dias', days: 90 },
};

function isoDate(d) { return d.toISOString().slice(0, 10); }

function rangeFromPreset(preset) {
  // GSC tiene retraso de 3 dias — fechaHasta es 3 dias antes de hoy
  const days = PRESET_PERIODS[preset]?.days ?? 28;
  const hasta = new Date(Date.now() - 3 * 86400000);
  const desde = new Date(hasta.getTime() - days * 86400000);
  return { fechaDesde: isoDate(desde), fechaHasta: isoDate(hasta) };
}

export function useOrganicTraffic(projectId) {
  const [preset, setPreset] = useState('28d');
  const [customRange, setCustomRange] = useState(null);
  const [metrics, setMetrics] = useState({ totals: null, rows: [], lastUpdate: null });
  const [consolidated, setConsolidated] = useState({ months: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const range = customRange || rangeFromPreset(preset);

  useEffect(() => {
    if (!projectId) {
      setMetrics({ totals: null, rows: [], lastUpdate: null });
      setConsolidated({ months: [] });
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      getGscMetrics(projectId, range).then(r => r.success ? r.data : Promise.reject(r.error)),
      getGscConsolidated(projectId).then(r => r.success ? r.data : Promise.reject(r.error)),
    ]).then(([m, c]) => {
      setMetrics(m);
      setConsolidated(c);
    }).catch(err => setError(err?.message || String(err)))
      .finally(() => setLoading(false));
  }, [projectId, range.fechaDesde, range.fechaHasta]); // eslint-disable-line

  return {
    metrics,
    consolidated,
    loading,
    error,
    preset, setPreset,
    customRange, setCustomRange,
    range,
  };
}
