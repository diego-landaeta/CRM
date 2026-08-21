import { MagnifyingGlass, X } from '@phosphor-icons/react';
import type { Project } from '@/shared/types';
import Select from '@/shared/components/ui/Select';
import { ASSIGNABLE_ROLES, ROLE_LABELS } from '../lib/usersUi';
import type { EstadoFiltro, RolFiltro, UsersFilters } from '../hooks/useUsers';

interface Props {
  filters: UsersFilters;
  onFilterChange: <K extends keyof UsersFilters>(key: K, value: UsersFilters[K]) => void;
  onClear: () => void;
  hayFiltroActivo: boolean;
  /** Filtro de proyecto: 'all' o el id. Dispara petición, por eso va aparte. */
  projectFilter: string;
  onProjectFilterChange: (value: string) => void;
  projects: Project[];
  totalFiltrados: number;
  cargados: number;
}

const ESTADOS: Array<{ value: EstadoFiltro; label: string }> = [
  { value: 'todos', label: 'Cualquier estado' },
  { value: 'activo', label: 'Activos' },
  { value: 'nunca_entro', label: 'Nunca han entrado' },
  { value: 'inactivo', label: 'Desactivados' },
];

export default function UsersToolbar({
  filters, onFilterChange, onClear, hayFiltroActivo,
  projectFilter, onProjectFilterChange, projects,
  totalFiltrados, cargados,
}: Props) {
  const rolOptions: Array<{ value: RolFiltro; label: string }> = [
    { value: 'todos', label: 'Cualquier rol' },
    { value: 'superadmin', label: ROLE_LABELS.superadmin },
    ...ASSIGNABLE_ROLES.map((r) => ({ value: r.value as RolFiltro, label: r.label })),
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-md border border-border bg-card">
        <div className="relative flex-1 min-w-[180px]">
          <MagnifyingGlass
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            placeholder="Buscar por nombre o email…"
            aria-label="Buscar usuarios"
            className="w-full h-9 pl-8 pr-3 rounded-md border border-border bg-muted/50 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground"
          />
        </div>

        <Select<RolFiltro>
          value={filters.role}
          onChange={(v) => onFilterChange('role', v)}
          options={rolOptions}
          ariaLabel="Filtrar por rol"
          size="sm"
          className="max-w-[170px] w-full"
        />

        <Select<EstadoFiltro>
          value={filters.estado}
          onChange={(v) => onFilterChange('estado', v)}
          options={ESTADOS}
          ariaLabel="Filtrar por estado"
          size="sm"
          className="max-w-[180px] w-full"
        />

        {hayFiltroActivo && (
          <button
            onClick={onClear}
            className="h-9 px-2.5 inline-flex items-center gap-1 rounded-md border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={12} weight="bold" /> Limpiar
          </button>
        )}
      </div>

      {/*
        Un solo filtro de proyecto, no dos.
        Antes convivían las pastillas («Fono Aprende» / «Todos los proyectos») y
        un desplegable de «proyecto específico». Hacían lo mismo, y mientras
        estuvieran los dos siempre habría alguien mirando una lista filtrada por
        el que no tocó. Se queda el desplegable: aguanta las nueve marcas, y las
        pastillas se quedaban cortas en cuanto pasan de tres.
      */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-md border border-border bg-card">
        <label htmlFor="filtro-proyecto" className="text-[11px] font-medium text-muted-foreground">
          Proyecto
        </label>
        <Select<string>
          value={projectFilter}
          onChange={onProjectFilterChange}
          options={[
            { value: 'all', label: 'Todos los proyectos' },
            ...(projects || []).map((p) => ({ value: String(p.id), label: p.nombre })),
          ]}
          ariaLabel="Filtrar por proyecto"
          size="sm"
          className="max-w-[220px] w-full"
        />
        <span className="text-[11px] text-muted-foreground whitespace-nowrap ml-auto">
          {hayFiltroActivo
            ? `${totalFiltrados} de ${cargados} usuario${cargados !== 1 ? 's' : ''}`
            : `${cargados} usuario${cargados !== 1 ? 's' : ''}`}
        </span>
      </div>
    </div>
  );
}
