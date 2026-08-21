import { CreditCard, Users, TrendDown, WarningCircle as WarnIcon } from '@phosphor-icons/react';
import { useStripeMonitor } from '@/modules/ia-dashboard/hooks/useStripeMonitor';
import { SectionTitle } from './shared';

function fmtMoney(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0));
}
function fmtNum(n) { return new Intl.NumberFormat('es-ES').format(Number(n || 0)); }
function fmtPct(n) { return `${(Number(n) || 0).toFixed(2)}%`; }

export default function StripeTab({ project }) {
  const { metrics, mrrDelta, subsDelta, loading, error } = useStripeMonitor(project.id);

  if (loading) return (
    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-muted/50 rounded-lg animate-pulse" />)}
    </div>
  );

  if (error) return (
    <div className="p-8 text-center">
      <WarnIcon size={28} className="text-red-500 mx-auto mb-2" weight="regular" />
      <p className="text-red-600 font-semibold text-sm">No se pudieron cargar las métricas de Stripe</p>
      <p className="text-xs text-muted-foreground mt-1">{error}</p>
    </div>
  );

  if (!metrics || metrics.mrr === 0) return (
    <div className="p-8 text-center space-y-2">
      <CreditCard size={32} className="text-muted-foreground mx-auto" weight="regular" />
      <p className="font-semibold text-sm">Sin datos de Stripe</p>
      <p className="text-xs text-muted-foreground">
        Aún no hay suscripciones en Stripe para este proyecto, o las credenciales no están configuradas en la pestaña APIs.
      </p>
    </div>
  );

  const kpis = [
    { icon: CreditCard, label: 'MRR actual', value: fmtMoney(metrics.mrr), delta: mrrDelta, color: 'bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400' },
    { icon: Users, label: 'Suscripciones activas', value: fmtNum(metrics.activeSubs), delta: subsDelta, color: 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400' },
    { icon: TrendDown, label: 'Churn rate mensual', value: fmtPct(metrics.churnRate), color: metrics.churnRate > 5 ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400' : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' },
    { icon: WarnIcon, label: 'Cobros fallidos', value: fmtNum(metrics.failedPayments), color: metrics.failedPayments > 0 ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400' : 'bg-muted text-muted-foreground' },
  ];

  return (
    <div className="space-y-5 max-w-2xl">
      <SectionTitle title="Monitor Stripe" subtitle="Métricas de suscripciones en tiempo real" />
      <div className="grid grid-cols-2 gap-3">
        {kpis.map(({ icon: Icon, label, value, delta, color }) => (
          <div key={label} className="bg-card border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className={`w-8 h-8 rounded-md flex items-center justify-center ${color}`}>
                <Icon size={16} weight="duotone" />
              </div>
              {delta && (
                <span className={`text-micro font-bold ${delta.growing ? 'text-emerald-600' : 'text-red-500'}`}>
                  {delta.growing ? '↑' : '↓'} {Math.abs(delta.pct)}%
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/30 rounded-lg p-4 border border-border text-center">
          <p className="text-xs text-muted-foreground">Nuevas suscripciones (mes)</p>
          <p className="text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">+{metrics.newSubs}</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-4 border border-border text-center">
          <p className="text-xs text-muted-foreground">Cancelaciones (mes)</p>
          <p className="text-2xl font-semibold tabular-nums text-red-700 dark:text-red-400 mt-1">−{metrics.cancelledSubs}</p>
        </div>
      </div>
    </div>
  );
}
