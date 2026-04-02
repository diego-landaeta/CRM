import {
  ChartLineUp,
  FileText,
  CalendarBlank,
  DownloadSimple,
  Robot,
} from '@phosphor-icons/react';

const MOCK_REPORTS = [
  { id: 1, name: 'Reporte Mensual — Marzo 2026', type: 'mensual', date: '01 abr 2026', status: 'generado', pages: 12 },
  { id: 2, name: 'Reporte Mensual — Febrero 2026', type: 'mensual', date: '01 mar 2026', status: 'generado', pages: 10 },
  { id: 3, name: 'Reporte Mensual — Enero 2026', type: 'mensual', date: '01 feb 2026', status: 'generado', pages: 11 },
  { id: 4, name: 'Analisis de Campanas Q1 2026', type: 'trimestral', date: '01 abr 2026', status: 'generado', pages: 18 },
  { id: 5, name: 'Reporte Rendimiento Gestores', type: 'custom', date: '28 mar 2026', status: 'generado', pages: 8 },
];

const MOCK_METRICS = [
  { label: 'Leads Totales', value: '1,284', period: 'Acumulado' },
  { label: 'Tasa Conversion', value: '26.8%', period: 'Ultimo mes' },
  { label: 'CPL Medio', value: '29.42 €', period: 'Ultimo mes' },
  { label: 'ROI Campanas', value: '3.2x', period: 'Q1 2026' },
];

const TYPE_STYLES = {
  mensual: 'bg-blue-50 text-blue-600',
  trimestral: 'bg-violet-50 text-violet-600',
  custom: 'bg-amber-50 text-amber-600',
};

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Reportes</h1>
          <p className="text-muted-foreground text-sm">Informes generados por Claude AI y metricas clave</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
          <Robot size={16} weight="bold" />
          Generar Reporte IA
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {MOCK_METRICS.map((m) => (
          <div key={m.label} className="bg-card p-5 rounded-2xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{m.label}</p>
            <p className="text-2xl font-extrabold mt-1">{m.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{m.period}</p>
          </div>
        ))}
      </div>

      {/* Reports List */}
      <div className="bg-card rounded-3xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] overflow-hidden">
        <div className="p-5">
          <h3 className="font-bold">Reportes Generados</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Informes PDF con analisis de Claude AI</p>
        </div>
        <div className="divide-y">
          {MOCK_REPORTS.map((r) => (
            <div key={r.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <FileText size={20} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate">{r.name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <CalendarBlank size={11} /> {r.date}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{r.pages} paginas</span>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${TYPE_STYLES[r.type]}`}>
                {r.type}
              </span>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-zinc-600 hover:bg-muted transition-colors">
                <DownloadSimple size={14} weight="bold" /> PDF
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
