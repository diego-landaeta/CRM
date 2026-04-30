import { describe, it, expect } from 'vitest';
import { computePctDelta, computeChurnDelta } from '@/modules/ia-dashboard/hooks/useStripeMonitor';

describe('computePctDelta — % crecimiento mes-a-mes (MRR/subs)', () => {
  it('lista vacía o null devuelve null', () => {
    expect(computePctDelta(null, 'mrr')).toBeNull();
    expect(computePctDelta(undefined, 'mrr')).toBeNull();
    expect(computePctDelta([], 'mrr')).toBeNull();
  });

  it('un solo punto (sin previo) devuelve null', () => {
    expect(computePctDelta([{ mrr: 100 }], 'mrr')).toBeNull();
  });

  it('previous=0 devuelve null (división por cero)', () => {
    expect(computePctDelta([{ mrr: 0 }, { mrr: 100 }], 'mrr')).toBeNull();
  });

  it('crecimiento +20% devuelve growing=true', () => {
    const r = computePctDelta([{ mrr: 1000 }, { mrr: 1200 }], 'mrr');
    expect(r).toEqual({ pct: 20, growing: true });
  });

  it('decrecimiento -10% devuelve growing=false', () => {
    const r = computePctDelta([{ mrr: 1000 }, { mrr: 900 }], 'mrr');
    expect(r).toEqual({ pct: -10, growing: false });
  });

  it('plano (mismo valor) → 0%, growing=true (≥0)', () => {
    const r = computePctDelta([{ mrr: 500 }, { mrr: 500 }], 'mrr');
    expect(r.pct).toBe(0);
    expect(r.growing).toBe(true);
  });

  it('redondea a 1 decimal', () => {
    // 33.33% → 33.3
    const r = computePctDelta([{ mrr: 300 }, { mrr: 400 }], 'mrr');
    expect(r.pct).toBe(33.3);
  });

  it('toma últimos 2 puntos (ignora histórico antiguo)', () => {
    const arr = [{ mrr: 1 }, { mrr: 999 }, { mrr: 100 }, { mrr: 200 }];
    const r = computePctDelta(arr, 'mrr');
    expect(r.pct).toBe(100); // 100 → 200 = +100%
  });

  it('funciona con cualquier key (subs, etc)', () => {
    const r = computePctDelta(
      [{ activeSubs: 10 }, { activeSubs: 15 }],
      'activeSubs',
    );
    expect(r).toEqual({ pct: 50, growing: true });
  });
});

describe('computeChurnDelta — tendencia de churn rate', () => {
  it('null/empty/un solo punto → null', () => {
    expect(computeChurnDelta(null)).toBeNull();
    expect(computeChurnDelta([])).toBeNull();
    expect(computeChurnDelta([{ churnRate: 5 }])).toBeNull();
  });

  it('churn que baja de 5 a 3 → improving=true, delta=-2', () => {
    const r = computeChurnDelta([{ churnRate: 5 }, { churnRate: 3 }]);
    expect(r).toEqual({ delta: -2, improving: true });
  });

  it('churn que sube de 3 a 5 → improving=false, delta=2', () => {
    const r = computeChurnDelta([{ churnRate: 3 }, { churnRate: 5 }]);
    expect(r).toEqual({ delta: 2, improving: false });
  });

  it('redondea a 2 decimales', () => {
    const r = computeChurnDelta([{ churnRate: 5.123 }, { churnRate: 4.456 }]);
    expect(r.delta).toBeCloseTo(-0.67, 2);
  });

  it('valor 0 (no es falsy ambiguo) — válido', () => {
    const r = computeChurnDelta([{ churnRate: 1 }, { churnRate: 0 }]);
    expect(r).toEqual({ delta: -1, improving: true });
  });

  it('si falta churnRate en algún punto → null', () => {
    expect(computeChurnDelta([{ churnRate: 5 }, { foo: 'bar' }])).toBeNull();
    expect(computeChurnDelta([{ foo: 'bar' }, { churnRate: 5 }])).toBeNull();
  });
});
