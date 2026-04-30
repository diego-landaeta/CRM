import { useEffect, useMemo, useState } from 'react';
import { getStripeMetrics } from '../api/stripe.api';

/**
 * Cómputo puro de delta % entre el último y el penúltimo punto de un array.
 * Devuelve null si no hay suficientes datos o el "previous" es 0/falsy.
 */
export function computePctDelta(arr, key) {
  if (!Array.isArray(arr) || arr.length < 2) return null;
  const current = arr[arr.length - 1]?.[key];
  const previous = arr[arr.length - 2]?.[key];
  if (!previous) return null;
  const pct = ((current - previous) / previous) * 100;
  return { pct: Math.round(pct * 10) / 10, growing: pct >= 0 };
}

/**
 * Cómputo puro de tendencia churn: delta absoluto entre puntos.
 * "improving" si el churn bajó.
 */
export function computeChurnDelta(arr) {
  if (!Array.isArray(arr) || arr.length < 2) return null;
  const current = arr[arr.length - 1]?.churnRate;
  const previous = arr[arr.length - 2]?.churnRate;
  if (current === undefined || previous === undefined) return null;
  return { delta: Math.round((current - previous) * 100) / 100, improving: current < previous };
}

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

  const mrrDelta = useMemo(() => computePctDelta(metrics?.evolution12Months, 'mrr'), [metrics]);
  const subsDelta = useMemo(() => computePctDelta(metrics?.evolution12Months, 'activeSubs'), [metrics]);
  const churnTrend = useMemo(() => computeChurnDelta(metrics?.evolution12Months), [metrics]);

  return { metrics, mrrDelta, subsDelta, churnTrend, loading, error };
}
