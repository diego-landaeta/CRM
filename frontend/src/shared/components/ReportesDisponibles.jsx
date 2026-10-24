// Catálogo de reportes previstos, agrupados por tema.
//
// Es el mapa de lo que se puede llegar a consultar. Los que ya están hechos se
// descargan en la sección de arriba; estos marcan lo que viene y sirven para
// que nadie tenga que preguntar qué se puede sacar del CRM.
import { Users, Receipt, CurrencyEur, ChartBar, ChartLineUp, ChartPie, ChartDonut, ArrowsClockwise } from '@phosphor-icons/react';
import { ACCENT_COLORS } from '@/shared/lib/ui';

const CATEGORIAS = [
  {
    title: 'Prospectos',
    description: 'Volumen, canales, conversiones y tiempo de respuesta.',
    icon: Users,
    accent: 'sky',
    reports: [
      { label: 'Nuevos prospectos por canal', icon: ChartBar },
      { label: 'Tasa de conversión por gestor', icon: ChartLineUp },
      { label: 'Tiempo medio hasta primer contacto', icon: ChartPie },
    ],
  },
  {
    title: 'Ventas',
    description: 'Ingresos, productos top y desempeño temporal.',
    icon: Receipt,
    accent: 'emerald',
    reports: [
      { label: 'Ingresos por producto', icon: ChartBar },
      { label: 'Ventas mes a mes', icon: ChartLineUp },
      { label: 'Distribución por método de pago', icon: ChartDonut },
    ],
  },
  {
    title: 'Comisiones',
    description: 'A pagar, pagadas y comparativa entre gestores.',
    icon: CurrencyEur,
    accent: 'violet',
    reports: [
      { label: 'Comisiones del mes', icon: ChartBar },
      { label: 'Ranking de gestores', icon: ChartLineUp },
    ],
  },
];

// Los colores de cada cifra viven con las demás paletas de identidad (shared/lib/ui).
const ACCENT = ACCENT_COLORS;

export default function ReportesDisponibles() {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold tracking-tight">Reportes disponibles</h2>
        <button
          type="button"
          onClick={() => window.location.reload()}
          title="Refrescar todos los datos del reporte"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowsClockwise size={12} /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {CATEGORIAS.map((cat) => {
          const c = ACCENT[cat.accent];
          return (
            <div key={cat.title} className="rounded-xl border border-border bg-card p-4">
              <div className={`w-9 h-9 rounded-lg ${c.bg} ${c.text} flex items-center justify-center mb-3`}>
                <cat.icon size={17} weight="duotone" />
              </div>
              <h3 className="font-semibold tracking-tight">{cat.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">{cat.description}</p>
              <div className="space-y-0.5 border-t border-border pt-2">
                {cat.reports.map((r) => (
                  <button
                    type="button"
                    key={r.label}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-sm text-left transition-colors group"
                  >
                    <r.icon size={15} weight="duotone" className="text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="flex-1 text-foreground">{r.label}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity">
                      Ver
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
