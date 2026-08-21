import { Users, Clock } from '@phosphor-icons/react';
import type { Project } from '@/shared/types';
import EmptyState from '@/shared/components/ui/EmptyState';
import StatusDot from '@/shared/components/ui/StatusDot';
import { avatarColorFor, getInitials } from '@/shared/lib/ui';
import type { AvailabilityUser } from '../api/availability.api';
import type { CrmUser } from '../api/users.api';
import {
  ACCESS_STATE_STYLES, ROLE_CHIP, accessStateOf, formatFecha, formatLastLogin, roleLabelCortoOf, roleLabelOf,
} from '../lib/usersUi';
import UserActionsMenu from './UserActionsMenu';

interface Props {
  users: CrmUser[];
  projects: Project[];
  /** Disponibilidad por id. Solo hay entrada para admin/gestor/superadmin. */
  disponibilidad: Map<number, AvailabilityUser>;
  openMenuId: number | null;
  onOpenMenu: (id: number | null) => void;
  onEdit: (user: CrmUser) => void;
  onToggleActive: (user: CrmUser) => void;
  onAvailability: (user: CrmUser) => void;
  hayFiltroActivo: boolean;
  onClearFilters: () => void;
}

/**
 * Aviso de ausencia. Un bloque activo hoy y el interruptor de «no disponible»
 * tienen el mismo efecto —se salta en el reparto— pero se cuentan distinto:
 * el bloque se apaga solo el dia que toca, el interruptor no.
 */
function AusenciaBadge({ estado }: { estado?: AvailabilityUser }) {
  if (!estado) return null;
  if (estado.bloque_activo) {
    return (
      <StatusDot tono="warning" title={estado.bloque_activo.motivo || 'Ausencia programada'}>
        Ausente hasta {formatFecha(estado.bloque_activo.fecha_fin)}
      </StatusDot>
    );
  }
  if (!estado.is_available) {
    return (
      <StatusDot tono="warning" title={estado.unavailable_reason || 'Marcado no disponible'}>
        No disponible
      </StatusDot>
    );
  }
  return null;
}

function nombresDeProyectos(user: CrmUser, projects: Project[]): string {
  const ids = user.projects.map((p) => p.projectId);
  if (ids.length === 0) return 'Ninguno';
  if (projects.length > 0 && ids.length === projects.length) return 'Todos';
  return ids
    .map((id) => projects.find((p) => p.id === id)?.nombre || '')
    .filter(Boolean)
    .join(', ');
}

function EstadoBadge({ user }: { user: CrmUser }) {
  const estilo = ACCESS_STATE_STYLES[accessStateOf(user)];
  return (
    <StatusDot tono={estilo.tono} title={estilo.title}>
      {estilo.label}
    </StatusDot>
  );
}

function RolBadge({ user }: { user: CrmUser }) {
  return (
    <span title={roleLabelOf(user)} className={`px-2 py-0.5 rounded-full text-micro font-medium whitespace-nowrap ${ROLE_CHIP}`}>
      {roleLabelCortoOf(user)}
    </span>
  );
}

export default function UsersTable({
  users, projects, disponibilidad, openMenuId, onOpenMenu, onEdit, onToggleActive,
  onAvailability, hayFiltroActivo, onClearFilters,
}: Props) {
  if (users.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={hayFiltroActivo ? 'Ningún usuario coincide' : 'No hay usuarios registrados'}
        description={hayFiltroActivo
          ? 'Prueba con otra búsqueda o quita los filtros.'
          : 'Crea el primero con el botón de arriba.'}
        action={hayFiltroActivo ? (
          <button
            onClick={onClearFilters}
            className="h-9 px-4 rounded-md border border-border text-sm font-semibold hover:bg-muted transition-colors"
          >
            Limpiar filtros
          </button>
        ) : null}
      />
    );
  }

  return (
    <>
      {/* Tabla en pantallas anchas */}
      <div className="hidden xl:block">
        <table className="w-full text-body">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs text-muted-foreground">Usuario</th>
              <th className="px-4 py-2.5 text-left text-xs text-muted-foreground hidden 2xl:table-cell">Email</th>
              <th className="px-4 py-2.5 text-left text-xs text-muted-foreground">Rol</th>
              <th className="px-4 py-2.5 text-left text-xs text-muted-foreground">Proyectos</th>
              <th className="px-4 py-2.5 text-left text-xs text-muted-foreground hidden 2xl:table-cell">Última conexión</th>
              <th className="px-4 py-2.5 text-left text-xs text-muted-foreground">Estado</th>
              <th className="px-4 py-2.5 text-right text-xs text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const proyectos = nombresDeProyectos(u, projects);
              return (
                <tr
                  key={u.id}
                  className={`border-b last:border-0 hover:bg-muted/50 transition-colors ${!u.active ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-micro font-semibold flex-shrink-0 ${avatarColorFor(u.id)}`}>
                        {getInitials(u.nombre)}
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold block truncate">{u.nombre || 'Sin nombre'}</span>
                        <span className="text-meta text-muted-foreground 2xl:hidden truncate block">{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden 2xl:table-cell truncate max-w-[200px]">{u.email}</td>
                  <td className="px-4 py-3"><RolBadge user={u} /></td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate" title={proyectos}>{proyectos}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden 2xl:table-cell">
                    {u.last_login_at ? (
                      <span className="flex items-center gap-1.5 text-meta">
                        <Clock size={12} weight="regular" />
                        {formatLastLogin(u.last_login_at)}
                      </span>
                    ) : (
                      <span className="text-meta italic text-muted-foreground/60">Nunca</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <EstadoBadge user={u} />
                      <AusenciaBadge estado={disponibilidad.get(u.id)} />
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {u.role !== 'superadmin' && (
                      <UserActionsMenu
                        isActive={u.active}
                        isOpen={openMenuId === u.id}
                        onToggle={() => onOpenMenu(openMenuId === u.id ? null : u.id)}
                        onClose={() => onOpenMenu(null)}
                        onEdit={() => onEdit(u)}
                        onToggleActive={() => onToggleActive(u)}
                        onAvailability={disponibilidad.has(u.id) ? () => onAvailability(u) : undefined}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tarjetas en pantallas estrechas */}
      <div className="xl:hidden divide-y">
        {users.map((u) => {
          const proyectos = nombresDeProyectos(u, projects);
          return (
            <div key={u.id} className={`p-4 space-y-2 ${!u.active ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-micro font-semibold ${avatarColorFor(u.id)}`}>
                  {getInitials(u.nombre)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-body font-semibold block truncate">{u.nombre || 'Sin nombre'}</span>
                  <span className="text-meta text-muted-foreground truncate block">{u.email}</span>
                </div>
                {u.role !== 'superadmin' && (
                  <UserActionsMenu
                    isActive={u.active}
                    isOpen={openMenuId === u.id}
                    onToggle={() => onOpenMenu(openMenuId === u.id ? null : u.id)}
                    onClose={() => onOpenMenu(null)}
                    onEdit={() => onEdit(u)}
                    onToggleActive={() => onToggleActive(u)}
                    onAvailability={disponibilidad.has(u.id) ? () => onAvailability(u) : undefined}
                  />
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <RolBadge user={u} />
                <EstadoBadge user={u} />
                <AusenciaBadge estado={disponibilidad.get(u.id)} />
                <span className="text-micro text-muted-foreground truncate max-w-[200px]" title={proyectos}>{proyectos}</span>
                {u.last_login_at ? (
                  <span className="text-micro text-muted-foreground/70 flex items-center gap-1 ml-auto">
                    <Clock size={10} weight="regular" />
                    {new Date(u.last_login_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </span>
                ) : (
                  <span className="text-micro text-muted-foreground/60 italic ml-auto">Nunca</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
