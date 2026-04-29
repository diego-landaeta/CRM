import { useEffect, useRef, useState } from 'react';

const PREFERS_REDUCED = typeof window !== 'undefined'
  && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// easeOutQuart — empieza rápido, termina suave (mejor para counters que linear).
function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

/**
 * Anima un número desde 0 (o desde el valor previo) hasta `target` en `duration` ms.
 * Respeta `prefers-reduced-motion` (devuelve el target instantáneamente).
 *
 * Uso:
 *   const display = useCountUp(1234.56);
 *   <span>{fmt(display)}</span>
 *
 * @param {number} target valor final
 * @param {object} [opts]
 * @param {number} [opts.duration=800] ms
 * @param {boolean} [opts.fromZero=true] si false, anima desde el valor anterior cuando cambia
 */
export default function useCountUp(target, opts = {}) {
  const { duration = 800, fromZero = true } = opts;
  const safeTarget = Number.isFinite(target) ? Number(target) : 0;
  const [value, setValue] = useState(PREFERS_REDUCED ? safeTarget : (fromZero ? 0 : safeTarget));
  const fromRef = useRef(value);
  const rafRef = useRef(null);
  const startRef = useRef(0);

  useEffect(() => {
    if (PREFERS_REDUCED) {
      setValue(safeTarget);
      return;
    }
    // Punto de partida: 0 si fromZero, o el último valor mostrado (para transiciones suaves)
    fromRef.current = fromZero ? 0 : value;
    startRef.current = 0;

    function tick(ts) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / duration);
      const eased = easeOutQuart(t);
      const next = fromRef.current + (safeTarget - fromRef.current) * eased;
      setValue(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeTarget, duration]);

  return value;
}
