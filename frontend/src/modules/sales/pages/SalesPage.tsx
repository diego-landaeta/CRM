import { lazy, Suspense, useState } from 'react';
import { Plus, Receipt } from '@phosphor-icons/react';
import { useProjectContext } from '@/contexts/ProjectContext';

const RegisterSaleDialog = lazy(() => import('../components/RegisterSaleDialog'));

export default function SalesPage() {
  const { activeProject } = useProjectContext() as { activeProject: { id: number; nombre?: string } | null };
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Ventas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registra ventas — del día o históricas. Crea cliente + conversión + pago en un solo paso.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!activeProject?.id || activeProject?.id === -1}
          className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus size={14} weight="bold" />
          Nueva venta
        </button>
      </header>

      {!activeProject?.id || activeProject?.id === -1 ? (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-6 text-center text-sm text-amber-800 dark:text-amber-300">
          Selecciona un proyecto en la barra superior para registrar ventas.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground">
          <Receipt size={48} weight="duotone" className="mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm">Pulsa <strong>+ Nueva venta</strong> para registrar una venta sobre un cliente nuevo o existente.</p>
          <p className="text-xs mt-2 opacity-70">Por la fecha que indiques se considera <strong>histórica</strong> (anterior a hoy) o <strong>del día</strong>.</p>
        </div>
      )}

      <Suspense fallback={null}>
        <RegisterSaleDialog
          open={open}
          project={activeProject}
          onClose={() => setOpen(false)}
          onSaved={() => setOpen(false)}
        />
      </Suspense>
    </div>
  );
}
