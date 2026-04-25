import { useEffect, useMemo, useState } from 'react';
import { getStripeMetrics } from '../api/stripe.api';

export function useStripeMonitor(projectId) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectId) { setMetrics(null); return; }
    setLoading(true);
    setError(null);
    getStripeMetrics(projectId)
      .then(r => r.success ? setMetrics(r.data) : setError(r.error || 'Error'))
      .catch(err => setError(err?.message || String(err)))
      .finally(() => setLoading(false));
  }, [projectId]);

  // Variacion MRR mes a mes (% crecimiento)
  const mrrDelta = useMemo(() => {
    if (!metrics?.evolution12Months || metrics.evolution12Months.length < 2) return null;
    const arr = metrics.evolution12Months;
    const current = arr[arr.length - 1].mrr;
    const previous = arr[arr.length - 2].mrr;
    if (!previous) return null;
    const pct = ((current - previous) / previous) * 100;
    return { pct: Math.round(pct * 10) / 10, growing: pct >= 0 };
  }, [metrics]);

  const subsDelta = useMemo(() => {
    if (!metrics?.evolution12Months || metrics.evolution12Months.length < 2) return null;
    const arr = metrics.evolution12Months;
    const current = arr[arr.length - 1].activeSubs;
    const previous = arr[arr.length - 2].activeSubs;
    if (!previous) return null;
    const pct = ((current - previous) / previous) * 100;
    return { pct: Math.round(pct * 10) / 10, growing: pct >= 0 };
  }, [metrics]);

  const churnTrend = useMemo(() => {
    if (!metrics?.evolution12Months || metrics.evolution12Months.length < 2) return null;
    const arr = metrics.evolution12Months;
    const current = arr[arr.length - 1].churnRate;
    const previous = arr[arr.length - 2].churnRate;
    return { delta: Math.round((current - previous) * 100) / 100, improving: current < previous };
  }, [metrics]);

  return { metrics, mrrDelta, subsDelta, churnTrend, loading, error };
}
