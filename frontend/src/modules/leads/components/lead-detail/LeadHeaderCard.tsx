import { useState, lazy, Suspense } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CaretRight, Lightning, WarningCircle, Link as LinkIcon, GitMerge, ChatCircle, FileText } from '@phosphor-icons/react';
import StatusBadge from '@/shared/components/ui/StatusBadge';
import { getLeadPriority, getPriorityStyle } from '../../lib/leadPriority';
import { avatarColor, getInitials } from './InfoField';
import type { Lead } from '@/shared/types';
import { etiquetaCampusPais } from '@/shared/lib/paises';
import usePermission from '@/shared/hooks/usePermission';
import MenuAcciones from '@/shared/components/ui/MenuAcciones';

const MergeLeadDialog = lazy(() => import('../MergeLeadDialog'));
// Repartir la venta de este prospecto entre dos gestoras. Se carga aparte
// porque solo lo ven admin y superadmin.
const CompartirVentaBoton = lazy(() => import('@/modules/sales/components/CompartirVentaBoton'));
// «Crear link de pago» arriba, no solo en la tarjeta de abajo (Diego, 19/11).
const BotonCrearLink = lazy(() => import('@/modules/links-pago/components/BotonCrearLink'));

interface LeadHeaderCardProps {
  lead: Lead;
  isAdmin: boolean;
  onReassign: () => void;
  onBack: () => void;
  onMerged?: () => void;
}

export default function LeadHeaderCard({ lead, isAdmin, onReassign, onBack, onMerged }: LeadHeaderCardProps) {
  // Lo que dice el servidor (#423): sale si salía antes Y tiene el permiso.
  const { can } = usePermission();
  const [mergeOpen, setMergeOpen] = useState(false);
  const navigate = useNavigate();
  // Sin página anterior dentro del CRM (enlace pegado, pestaña nueva), a Prospectos.
  const hayAnterior = useLocation().key !== 'default';
  return (
    <>
      {lead.lead_duplicado_de && (
        <div role="alert" className="flex items-center gap-3 p-4 rounded-xl bg-warning-soft border border-warning/30 text-warning dark:text-warning">
          <WarningCircle size={20} weight="bold" className="flex-shrink-0 text-warning" />
          <div className="text-sm flex-1">
            <span className="font-bold">Prospecto duplicado</span> — este email ya existe en el sistema.
          </div>
          <Link
            to={`/prospectos/${lead.lead_duplicado_de}`}
            className="text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warning-soft hover:bg-warning transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-warning/40"
          >
            <LinkIcon size={12} weight="bold" /> Ver original #{lead.lead_duplicado_de}
          </Link>
        </div>
      )}

      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {/* Volver a la página de la que se viene (Reportes, el Dashboard…), no siempre a Prospectos. */}
        <button
          type="button"
          onClick={() => (hayAnterior ? navigate(-1) : navigate('/prospectos'))}
          aria-label="Volver a la página anterior"
          title="Volver a la página anterior"
          className="p-1 -ml-1 rounded-md hover:bg-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <ArrowLeft size={14} weight="bold" />
        </button>
        <Link to="/prospectos" className="hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 rounded px-1">
          Prospectos
        </Link>
        <CaretRight size={10} weight="bold" className="opacity-50" />
        <span className="text-foreground font-medium truncate max-w-[200px]">{lead.nombre}</span>
      </nav>

      {/* Rediseño (20/11): la cabecera de la ficha sin caja, en una fila. El
          nombre manda (20 px) y nunca se aplasta: los botones bajan de línea
          antes que encogerlo (a 1280 se quedaba en 0 px). Una acción visible
          por familia; Mensaje, Proforma y Fusionar, en «⋯». La prioridad, en
          un punto junto al nombre en vez de una franja de color. */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-border pb-4">
          <div className="flex min-w-[min(100%,16rem)] flex-1 items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${avatarColor(lead.id)}`}>
              {getInitials(lead.nombre)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  aria-hidden="true"
                  title={`Prioridad: ${getPriorityStyle(getLeadPriority(lead)).label}`}
                  className={`h-2 w-2 shrink-0 rounded-full ${getPriorityStyle(getLeadPriority(lead)).dotClass}`}
                />
                <h2 className="min-w-0 break-words text-xl font-semibold leading-tight tracking-tight">{lead.nombre}</h2>
                <StatusBadge status={lead.estado} showIcon />
              </div>
              <p className="text-muted-foreground text-xs mt-1">
                Prospecto #{lead.id} · creado {lead.created_at ? new Date(lead.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--'}
                {/* «Fono Aprende · Chile»: el campus y el país por el que entró (#221). */}
                {lead.proyecto_nombre && <> · {etiquetaCampusPais(lead.proyecto_nombre, lead.pais_origen)}</>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Suspense fallback={null}>
              <BotonCrearLink leadId={lead.id} />
            </Suspense>
            {/* «Compartir» va antes de «Reasignar» porque son la misma familia:
                reasignar es pasarsela a otra, compartir es atenderla entre dos.
                Diego: «no es nada intuitivo» — la funcion existia pero habia que
                entrar a la ficha de la venta para encontrarla. */}
            {isAdmin && can('conversions.reparto') && (
              <Suspense fallback={null}>
                <CompartirVentaBoton leadId={lead.id} />
              </Suspense>
            )}
            {isAdmin && can('leads.assign') && (
              <button
                onClick={onReassign}
                aria-label="Reasignar"
                className="h-9 px-3 rounded-md border border-input bg-card text-[13px] font-medium hover:bg-muted transition-colors flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Lightning size={14} weight="regular" /> <span className="hidden sm:inline">Reasignar</span>
              </button>
            )}
            <MenuAcciones
              etiqueta="Más acciones del prospecto"
              acciones={[
                {
                  label: 'Mensaje al responsable',
                  icon: ChatCircle,
                  title: 'Chatear con el responsable sobre este prospecto',
                  oculta: !(isAdmin && lead.responsable_id),
                  onClick: () => navigate(`/mensajes?chatWith=${lead.responsable_id}&leadId=${lead.id}`),
                },
                {
                  label: 'Emitir proforma',
                  icon: FileText,
                  title: 'Emitir una proforma (presupuesto) para este prospecto, sin convertir',
                  onClick: () => navigate(`/finanzas/facturas/nueva?tipo=proforma&leadId=${lead.id}`),
                },
                {
                  label: 'Fusionar duplicado',
                  icon: GitMerge,
                  title: 'Fusionar con otro prospecto duplicado',
                  onClick: () => setMergeOpen(true),
                },
                {
                  label: 'Volver a prospectos',
                  icon: ArrowLeft,
                  onClick: onBack,
                },
              ]}
            />
          </div>
      </div>

      <Suspense fallback={null}>
        <MergeLeadDialog
          open={mergeOpen}
          winner={{ id: lead.id, nombre: lead.nombre, email: lead.email }}
          projectId={(lead as any).project_id || null}
          onClose={() => setMergeOpen(false)}
          onMerged={() => { setMergeOpen(false); onMerged?.(); }}
        />
      </Suspense>
    </>
  );
}
