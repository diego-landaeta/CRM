import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowClockwise,
  CaretDown,
  Funnel,
  MagnifyingGlass,
  SlidersHorizontal,
  X,
} from '@phosphor-icons/react';
import { cn } from '@/shared/lib/utils';

const PERIOD_OPTIONS = [
  { value: '7d', label: 'Ultimos 7 dias' },
  { value: '30d', label: 'Ultimos 30 dias' },
  { value: '90d', label: 'Ultimos 90 dias' },
  { value: 'all', label: 'Todo el historial' },
];

const DEFAULT_STATUS_OPTIONS = [{ value: '', label: 'Todos los estados' }];
const DEFAULT_OWNER_OPTIONS = [{ value: '', label: 'Todos los responsables' }];
const DEFAULT_CHANNEL_OPTIONS = [{ value: '', label: 'Todos los canales' }];
const DEFAULT_PRODUCT_OPTIONS = [{ value: '', label: 'Todos los programas' }];
const DEFAULT_SORT_OPTIONS = [{ value: 'priority', label: 'Prioridad' }];

function optionLabel(options, value) {
  if (!value) return '';
  return options.find((option) => String(option.value) === String(value))?.label || String(value);
}

function activePills(filters, options, defaults) {
  const pills = [];
  if (filters.search?.trim()) pills.push({ key: 'search', label: `"${filters.search.trim().slice(0, 24)}"` });
  if (filters.period && filters.period !== defaults.period) {
    pills.push({ key: 'period', label: optionLabel(PERIOD_OPTIONS, filters.period) });
  }
  if (filters.dateFrom || filters.dateTo) {
    pills.push({ key: 'dateRange', label: `${filters.dateFrom || '...'} -> ${filters.dateTo || 'hoy'}` });
  }
  if (filters.status) pills.push({ key: 'status', label: optionLabel(options.status, filters.status) });
  if (filters.owner) pills.push({ key: 'owner', label: optionLabel(options.owner, filters.owner) });
  if (filters.channel) pills.push({ key: 'channel', label: optionLabel(options.channel, filters.channel) });
  if (filters.product) pills.push({ key: 'product', label: optionLabel(options.product, filters.product) });
  if (filters.sort && filters.sort !== defaults.sort) {
    pills.push({ key: 'sort', label: optionLabel(options.sort, filters.sort) });
  }
  if (filters.duplicated) pills.push({ key: 'duplicated', label: 'Duplicados' });
  if (filters.reincidente) pills.push({ key: 'reincidente', label: 'Reincidentes' });
  return pills.filter((pill) => pill.label);
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <select
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        {options.map((option) => (
          <option key={option.value || option.label} value={option.value}>
            {option.count != null ? `${option.label} (${option.count})` : option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterChip({ children, onClear }) {
  return (
    <span className="inline-flex h-9 items-center gap-1 rounded-md border border-primary/20 bg-primary/10 pl-2.5 pr-1.5 text-xs font-semibold text-primary">
      {children}
      <button
        type="button"
        onClick={onClear}
        className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-primary/20"
        aria-label="Quitar filtro"
      >
        <X size={10} weight="bold" />
      </button>
    </span>
  );
}

export function PreviewMetricsRow({ summary = [], className }) {
  if (!summary.length) return null;
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {summary.map((item) => (
        <div key={item.label} className="min-w-0 rounded-lg border border-border bg-card p-3">
          <div className="truncate text-xs font-medium text-muted-foreground">{item.label}</div>
          <div className="mt-2 truncate text-2xl font-semibold tabular-nums">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function PreviewFilterBar({
  filters,
  onChange,
  onClear,
  onRefresh,
  statusOptions = DEFAULT_STATUS_OPTIONS,
  ownerOptions = DEFAULT_OWNER_OPTIONS,
  channelOptions = DEFAULT_CHANNEL_OPTIONS,
  productOptions = DEFAULT_PRODUCT_OPTIONS,
  sortOptions = DEFAULT_SORT_OPTIONS,
  showPeriod = true,
  showDateRange = false,
  showProduct = false,
  showAdvanced = false,
  className,
  defaultPeriod = 'all',
  defaultSort = 'priority',
}) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);
  const value = {
    search: '',
    status: '',
    period: defaultPeriod,
    owner: '',
    channel: '',
    product: '',
    dateFrom: '',
    dateTo: '',
    sort: defaultSort,
    duplicated: false,
    reincidente: false,
    ...filters,
  };

  const options = useMemo(() => ({
    status: statusOptions,
    owner: ownerOptions,
    channel: channelOptions,
    product: productOptions,
    sort: sortOptions,
  }), [statusOptions, ownerOptions, channelOptions, productOptions, sortOptions]);
  const pills = activePills(value, options, { period: defaultPeriod, sort: defaultSort });
  const update = (key, nextValue) => onChange?.(key, nextValue);

  useEffect(() => {
    if (!open) return undefined;
    function onClick(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <section className={cn('rounded-lg border border-border bg-card p-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            className={cn(
              'h-10 inline-flex items-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30',
              pills.length
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border bg-background hover:bg-muted',
            )}
          >
            <Funnel size={15} weight={pills.length ? 'fill' : 'bold'} />
            Filtros
            {pills.length > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none text-primary-foreground">
                {pills.length}
              </span>
            )}
            <CaretDown size={12} weight="bold" className={cn('transition-transform', open && 'rotate-180')} />
          </button>

          {open && (
            <div className="absolute left-0 top-full z-50 mt-2 w-[min(780px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-card shadow-xl">
              <div className="max-h-[70vh] overflow-y-auto p-3">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <label className="grid gap-1.5 md:col-span-2 xl:col-span-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Busqueda
                    </span>
                    <div className="relative">
                      <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={value.search}
                        onChange={(event) => update('search', event.target.value)}
                        placeholder="Nombre, email, telefono, programa o referencia"
                        className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </label>

                  {showPeriod && (
                    <SelectField
                      label="Periodo"
                      value={value.period}
                      onChange={(nextValue) => update('period', nextValue)}
                      options={PERIOD_OPTIONS}
                    />
                  )}
                  {showDateRange && (
                    <>
                      <label className="grid gap-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Desde</span>
                        <input
                          type="date"
                          value={value.dateFrom || ''}
                          onChange={(event) => update('dateFrom', event.target.value)}
                          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Hasta</span>
                        <input
                          type="date"
                          value={value.dateTo || ''}
                          min={value.dateFrom || undefined}
                          onChange={(event) => update('dateTo', event.target.value)}
                          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                    </>
                  )}
                  <SelectField label="Estado" value={value.status} onChange={(nextValue) => update('status', nextValue)} options={statusOptions} />
                  <SelectField label="Responsable" value={value.owner} onChange={(nextValue) => update('owner', nextValue)} options={ownerOptions} />
                  <SelectField label="Canal" value={value.channel} onChange={(nextValue) => update('channel', nextValue)} options={channelOptions} />
                  {showProduct && (
                    <SelectField label="Programa" value={value.product} onChange={(nextValue) => update('product', nextValue)} options={productOptions} />
                  )}
                  <SelectField label="Orden" value={value.sort} onChange={(nextValue) => update('sort', nextValue)} options={sortOptions} />
                </div>

                {showAdvanced && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    <button
                      type="button"
                      onClick={() => update('duplicated', !value.duplicated)}
                      className={cn(
                        'h-8 rounded-md px-3 text-xs font-semibold transition-colors',
                        value.duplicated ? 'bg-amber-600 text-white' : 'bg-muted text-muted-foreground hover:text-foreground',
                      )}
                    >
                      Duplicados
                    </button>
                    <button
                      type="button"
                      onClick={() => update('reincidente', !value.reincidente)}
                      className={cn(
                        'h-8 rounded-md px-3 text-xs font-semibold transition-colors',
                        value.reincidente ? 'bg-red-600 text-white' : 'bg-muted text-muted-foreground hover:text-foreground',
                      )}
                    >
                      Reincidentes
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-3 py-2">
                <button
                  type="button"
                  onClick={onClear}
                  className="h-8 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Limpiar todo
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>

        {pills.map((pill) => (
          <FilterChip
            key={pill.key}
            onClear={() => {
              if (pill.key === 'dateRange') {
                update('dateFrom', '');
                update('dateTo', '');
                return;
              }
              if (pill.key === 'period') {
                update('period', defaultPeriod);
                return;
              }
              if (pill.key === 'sort') {
                update('sort', defaultSort);
                return;
              }
              update(pill.key, pill.key === 'duplicated' || pill.key === 'reincidente' ? false : '');
            }}
          >
            {pill.label}
          </FilterChip>
        ))}

        {pills.length === 0 && (
          <span className="inline-flex h-9 items-center gap-1.5 rounded-md bg-muted/40 px-2.5 text-xs text-muted-foreground">
            <SlidersHorizontal size={13} weight="bold" />
            Sin filtros extra
          </span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="h-10 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-semibold hover:bg-muted transition-colors"
          >
            <X size={14} weight="bold" />
            Limpiar
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="h-10 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <ArrowClockwise size={14} weight="bold" />
            Actualizar
          </button>
        </div>
      </div>
    </section>
  );
}
