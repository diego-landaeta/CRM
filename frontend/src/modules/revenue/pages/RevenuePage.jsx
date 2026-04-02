import { useProjectContext } from '@/contexts/ProjectContext';
import { STATS, REVENUE_MONTHLY, CONVERSIONS } from '@/shared/data/mock';
import { CurrencyEur, TrendUp, Receipt, Hourglass, CheckCircle } from '@phosphor-icons/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const TIPO_STYLES = {
  pago_completo: 'bg-emerald-50 text-emerald-600',
  abono_parcial: 'bg-amber-50 text-amber-600',
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-lg">
      {label}: <span className="text-emerald-300">{payload[0].value.toLocaleString('es-ES')} €</span>
    </div>
  );
}

export default function RevenuePage() {
  const { activeProject } = useProjectContext();
  const pid = activeProject.id;
  const stats = STATS[pid] || {};
  const monthly = (REVENUE_MONTHLY[pid] || []).map((m) => ({ mes: m.mes, ingresos: m.v }));
  const conversions = CONVERSIONS[pid] || [];

  const ticketMedio = stats.convertido > 0 ? Math.round(stats.ingresosMes / stats.convertido) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Ingresos</h1>
        <p className="text-muted-foreground text-sm">Conversiones, pagos y evolucion &mdash; {activeProject.nombre}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-card p-6 rounded-3xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600"><CurrencyEur size={20} weight="duotone" /></div>
            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full flex items-center gap-1"><TrendUp size={12} weight="bold" />+8%</span>
          </div>
          <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider">Ingresos Mes</p>
          <h3 className="text-3xl font-extrabold mt-1">{(stats.ingresosMes || 0).toLocaleString('es-ES')} &euro;</h3>
        </div>
        <div className="bg-card p-6 rounded-3xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600"><CheckCircle size={20} weight="duotone" /></div>
          </div>
          <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider">Conversiones Mes</p>
          <h3 className="text-3xl font-extrabold mt-1">{stats.convertido || 0}</h3>
        </div>
        <div className="bg-card p-6 rounded-3xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><Receipt size={20} weight="duotone" /></div>
          </div>
          <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider">Ticket Medio</p>
          <h3 className="text-3xl font-extrabold mt-1">{ticketMedio} &euro;</h3>
        </div>
        <div className="bg-card p-6 rounded-3xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><Hourglass size={20} weight="duotone" /></div>
          </div>
          <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider">CPL Medio</p>
          <h3 className="text-3xl font-extrabold mt-1">{stats.cplMedio || 0} &euro;</h3>
        </div>
      </div>

      <div className="bg-card p-6 rounded-3xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
        <div className="mb-6">
          <h3 className="font-bold">Evolucion de Ingresos</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Ultimos 6 meses</p>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={monthly}>
            <defs>
              <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
            <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa', fontWeight: 600 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa' }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="ingresos" stroke="#059669" strokeWidth={2.5} fill="url(#colorIngresos)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card rounded-3xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] overflow-x-auto">
        <div className="p-5">
          <h3 className="font-bold">Conversiones Recientes</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Ultimos pagos registrados</p>
        </div>
        {conversions.length === 0 ? (
          <div className="px-5 py-12 text-center text-muted-foreground">No hay conversiones para este proyecto aun.</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-muted/50 border-y">
              <tr>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Lead</th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Producto</th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Monto</th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tipo</th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {conversions.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="px-5 py-3 font-semibold">{c.lead}</td>
                  <td className="px-5 py-3 text-muted-foreground">{c.producto}</td>
                  <td className="px-5 py-3 font-bold">{c.monto.toLocaleString('es-ES')} &euro;</td>
                  <td className="px-5 py-3"><span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${TIPO_STYLES[c.tipo]}`}>{c.tipo === 'pago_completo' ? 'Completo' : 'Parcial'}</span></td>
                  <td className="px-5 py-3 text-muted-foreground">{c.fecha}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
