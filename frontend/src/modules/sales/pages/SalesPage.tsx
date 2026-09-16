import PageHeader from '@/shared/components/ui/PageHeader';
import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { Plus, Receipt, UsersThree, Buildings } from '@phosphor-icons/react';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import client from '@/shared/api/client';

const RegisterSaleDialog = lazy(() => import('../components/RegisterSaleDialog'));
const CursosVendidosCard = lazy(() => import('../components/CursosVendidosCard'));
const MyGoalCard = lazy(() => import('../components/MyGoalCard'));
const GestoresStatsTable = lazy(() => import('../components/GestoresStatsTable'));
const DesgloseVentas = lazy(() => import('../components/DesgloseVentas'));
const ResumenVentas = lazy(() => import('../components/ResumenVentas'));
const EvolucionVentas = lazy(() => import('../components/EvolucionVentas'));
const VentasPorPais = lazy(() => import('../components/VentasPorPais'));
const ClientesVentas = lazy(() => import('../components/ClientesVentas'));
import FiltroPeriodo, { useEstadoPeriodo } from '../components/FiltroPeriodo';

/** El id con el que el CRM representa «todos los proyectos» (lo pone el
 *  selector del menú; aquí se reutiliza para poder activarlo desde Ventas). */
const ALL_PROJECTS_ID = -1;

export default function SalesPage() {
  const { activeProject, activeIssuerId, switchProject, projects } = useProjectContext() as {
    activeProject: { id: number; nombre?: string } | null;
    activeIssuerId: number | null;
    switchProject: (id: number) => void;
    projects: Array<{ id: number; nombre?: string }>;
  };
  const { user } = useAuth() as { user: { role?: string } | null };
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const [open, setOpen] = useState(false);
  // -1 = "Todos los proyectos" del header. En ese caso pasamos null al backend
  // para que agregue cross-proyecto. Si NO hay proyecto activo, ni siquiera el
  // header está listo todavía.
  const hasActiveCtx = !!activeProject?.id;
  const allProjects = activeProject?.id === ALL_PROJECTS_ID;

  // A dónde se vuelve al apagar «todos los proyectos».
  //
  // Se recuerda el último proyecto real en el que se estuvo, porque salir del
  // modo agregado y aterrizar en otro proyecto distinto del que se venía es
  // desorientador — y sobre todo porque desde el agregado no se puede
  // registrar una venta, así que apagarlo suele ser para volver a trabajar
  // donde se estaba.
  const ultimoReal = useRef<number | null>(null);
  useEffect(() => {
    if (activeProject?.id && !allProjects) ultimoReal.current = activeProject.id;
  }, [activeProject?.id, allProjects]);
  const volverA = ultimoReal.current ?? projects.find((p) => p.id !== ALL_PROJECTS_ID)?.id ?? ALL_PROJECTS_ID;
  const projectIdParam = hasActiveCtx && !allProjects ? activeProject!.id : null;
  // Con una sociedad elegida, Ventas enseña sus campus sumados —igual que
  // Reportes—, en vez del muro de «elige un proyecto». El servidor traduce el
  // `issuerId` a la lista de proyectos y las consultas no se enteran.
  const issuerIdParam = activeIssuerId ?? null;

  // El periodo de la pantalla, elegido UNA vez: antes cada tarjeta traía el
  // suyo y en la misma vista convivían cuatro criterios distintos, así que los
  // números no se podían comparar entre sí.
  // Arranca en el año en curso: un mes recién empezado sale en blanco —ISEIE
  // no tiene ventas en agosto— y la pantalla parecía rota. «Mes» está a un clic.
  const { periodo, setPeriodo, desde, hasta, onFechas, rango, mes } = useEstadoPeriodo('ytd');

  // Filtro por gestora/vendedora (solo admin/superadmin). Las tarjetas ya
  // soportan responsableId; aquí solo lo elegimos.
  const [gestores, setGestores] = useState<Array<{ id: number; nombre: string }>>([]);
  const [responsableId, setResponsableId] = useState<number | null>(null);
  useEffect(() => {
    if (!isAdmin) return;
    const pid = projectIdParam ? `&projectId=${projectIdParam}` : '';
    client.get(`/users?limit=100${pid}`).then((r) => setGestores(r.success ? (r.data || []) : [])).catch(() => {});
  }, [isAdmin, projectIdParam]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={allProjects ? 'Ventas · Todos los proyectos' : 'Ventas'}
        subtitle={allProjects
          ? 'Vista agregada de todos los proyectos. Para registrar una venta entra en un proyecto concreto.'
          : 'Registra ventas — del día o históricas. Crea cliente + conversión + pago en un solo paso.'}
        actions={(
          <>
          {/* El interruptor de «todos los proyectos» (#100).
              La vista agregada YA existía, pero solo se activaba desde el
              selector de proyecto del menú lateral: había que salir de Ventas
              para verla y nada en la pantalla lo sugería. Es la misma acción
              —`switchProject(-1)`, que es lo que hace el selector—, puesta
              donde se echa en falta. Solo para quien manda: una gestora no
              cruza proyectos. */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => switchProject(allProjects ? volverA : ALL_PROJECTS_ID)}
              aria-pressed={allProjects}
              title={allProjects
                ? 'Volver a un proyecto para poder registrar ventas'
                : 'Sumar todos los proyectos en una sola vista'}
              className={
                'inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 '
                + (allProjects
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground')
              }
            >
              <Buildings size={14} weight="bold" />
              <span className="hidden sm:inline">Todos los proyectos</span>
            </button>
          )}
          {isAdmin && !allProjects && (
            <div className="flex items-center gap-1.5 h-9 px-2.5 rounded-md border border-border bg-card text-sm">
              <UsersThree size={14} className="text-muted-foreground" />
              <select
                value={responsableId ?? ''}
                onChange={(e) => setResponsableId(e.target.value ? Number(e.target.value) : null)}
                className="bg-transparent focus:outline-none max-w-[160px]"
                title="Filtrar por gestora"
              >
                <option value="">Todas las gestoras</option>
                {gestores.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={!hasActiveCtx || allProjects}
            title={allProjects ? 'Selecciona un proyecto concreto para registrar una venta' : ''}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus size={14} weight="bold" />
            Nueva venta
          </button>
          </>
        )}
      />

      {hasActiveCtx && !allProjects && (
        <FiltroPeriodo
          valor={periodo} onChange={setPeriodo}
          desde={desde} hasta={hasta} onFechas={onFechas}
        />
      )}

      {!hasActiveCtx ? (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-6 text-center text-sm text-amber-800 dark:text-amber-300">
          Cargando proyectos…
        </div>
      ) : (
        <>
          <Suspense fallback={null}>
            <ResumenVentas projectId={projectIdParam} issuerId={issuerIdParam} from={rango.from} to={rango.to} responsableId={responsableId} />
          </Suspense>

          <Suspense fallback={null}>
            <CursosVendidosCard projectId={projectIdParam} issuerId={issuerIdParam} responsableId={responsableId} from={rango.from} to={rango.to} />
          </Suspense>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* «Mi meta» es de quien vende. Un admin o superadmin no tiene
                ventas propias y la tarjeta le salia siempre a cero. */}
            {!isAdmin && (
              <Suspense fallback={null}>
                <MyGoalCard projectId={projectIdParam} issuerId={issuerIdParam} periodo={mes} />
              </Suspense>
            )}
          </div>

          {/* Cómo va contra el periodo anterior, y el año mes a mes. Lo ve
              también la gestora: el servidor le devuelve solo lo suyo. */}
          {!allProjects && (
            <Suspense fallback={null}>
              <EvolucionVentas projectId={projectIdParam} issuerId={issuerIdParam} from={rango.from} to={rango.to} responsableId={responsableId} />
            </Suspense>
          )}

          {!allProjects && (
            <Suspense fallback={null}>
              <DesgloseVentas projectId={projectIdParam} issuerId={issuerIdParam} from={rango.from} to={rango.to} responsableId={responsableId} />
            </Suspense>
          )}

          {!allProjects && (
            <Suspense fallback={null}>
              <VentasPorPais projectId={projectIdParam} issuerId={issuerIdParam} from={rango.from} to={rango.to} responsableId={responsableId} />
            </Suspense>
          )}

          {!allProjects && (
            <Suspense fallback={null}>
              <ClientesVentas projectId={projectIdParam} issuerId={issuerIdParam} from={rango.from} to={rango.to} responsableId={responsableId} />
            </Suspense>
          )}

          {isAdmin && (
            <Suspense fallback={null}>
              <GestoresStatsTable projectId={projectIdParam} issuerId={issuerIdParam} canEdit={!allProjects} periodo={mes} />
            </Suspense>
          )}

          {!allProjects && (
            <div className="bg-card border border-border rounded-lg p-6 text-center text-muted-foreground text-sm">
              <Receipt size={32} weight="duotone" className="mx-auto mb-2 text-muted-foreground/50" />
              Pulsa <strong>+ Nueva venta</strong> para registrar una sobre un cliente nuevo o existente.
              <p className="text-xs mt-1 opacity-70">Por la fecha indicada se marca como histórica (anterior a hoy) o del día.</p>
            </div>
          )}

          {/* Los números de Análisis · Reportes, aquí abajo: se mira Ventas a
              diario y no debería hacer falta cambiar de sección para saber
              cómo va el mes. Son los mismos paneles, no una copia. */}
        </>
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
