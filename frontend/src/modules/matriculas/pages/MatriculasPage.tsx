import { useEffect, useState, useCallback } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import client from '@/shared/api/client';
import PageHeader from '@/shared/components/ui/PageHeader';
import usePermission from '@/shared/hooks/usePermission';
import EmptyState from '@/shared/components/ui/EmptyState';
import SkeletonTable from '@/shared/components/ui/SkeletonTable';
import Select from '@/shared/components/ui/Select';
import useUrlFilters from '@/shared/hooks/useUrlFilters';
import { useGestoras } from '@/shared/hooks/useGestoras';
import { GraduationCap, Eye, PlugsConnected, DownloadSimple, X } from '@phosphor-icons/react';
import { toast } from '@/shared/hooks/useToast';
import PromptDialog from '@/shared/components/ui/PromptDialog';
import WebhooksTab from '../components/WebhooksTab';
import MatriculaDetail from '../components/MatriculaDetail';

const ESTADO_LABEL = {
  solicitud_admision: 'Solicitud admisión',
  datos_validados: 'Datos validados',
  pendiente: 'Pendiente',
  validada: 'Validada',
  rechazada: 'Rechazada',
};
const ESTADO_COLOR = {
  solicitud_admision: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900',
  datos_validados: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
  pendiente: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900',
  validada: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
  rechazada: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900',
};

export default function MatriculasPage() {
  const { activeProject } = useProjectContext();
  const { can } = usePermission();
  const [tab, setTab] = useState('list');
  const [data, setData] = useState([]);
  const [stats, setStats] = useState<{ total: number; pendientes: number; validadas: number; rechazadas: number }>({ total: 0, pendientes: 0, validadas: 0, rechazadas: 0 });
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [rechazoTarget, setRechazoTarget] = useState(null);

  // Los filtros viven en la DIRECCIÓN, como en Prospectos (#40). Así se
  // comparten por chat y sobreviven a recargar, que era medio ticket: hoy
  // vivían en el estado del componente y se perdían al pulsar «atrás».
  const [filtros, setFiltros] = useUrlFilters({
    q: '', estado: '', resp: '', prod: '', from: '', to: '', sort: 'recent',
  });
  const { q: search, estado: filterEstado, resp: filterResp, prod: filterProd,
    from: desde, to: hasta, sort: orden } = filtros as Record<string, string>;

  const proyectoId = activeProject?.id && activeProject.id !== -1 ? activeProject.id : null;
  const { gestoras } = useGestoras(proyectoId);
  const [productos, setProductos] = useState<Array<{ id: number; nombre: string }>>([]);

  /** Los mismos filtros que la pantalla, en forma de query. Lo usan la carga
   *  y la exportación — que es como se garantiza que se descargue lo que se
   *  está viendo y no otra cosa. */
  const queryDeLosFiltros = useCallback((extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ projectId: String(activeProject?.id ?? '') });
    // `trim()`: un espacio pegado al nombre dejaba la lista vacia. Viene del
    // tronco (f95020c9) y aqui se repone, porque este helper sustituye a la
    // consulta que lo llevaba.
    if (search.trim()) p.set('search', search.trim());
    if (filterEstado) p.set('estado', filterEstado);
    if (filterResp) p.set('responsableId', filterResp);
    if (filterProd) p.set('productoId', filterProd);
    if (desde) p.set('from', desde);
    if (hasta) p.set('to', hasta);
    if (orden) p.set('sort', orden);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return p;
  }, [activeProject?.id, search, filterEstado, filterResp, filterProd, desde, hasta, orden]);

  const load = useCallback(async () => {
    if (!activeProject?.id) return;
    setLoading(true);
    try {
      const res = await client.get(`/matriculas?${queryDeLosFiltros()}`);
      if (res.success) {
        setData(res.data || []);
        const s = (res.stats || {}) as Partial<typeof stats>;
        setStats({ total: s.total ?? 0, pendientes: s.pendientes ?? 0, validadas: s.validadas ?? 0, rechazadas: s.rechazadas ?? 0 });
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [activeProject?.id, queryDeLosFiltros]);

  const hayFiltro = Boolean(search || filterEstado || filterResp || filterProd || desde || hasta)
    || orden !== 'recent';

  /**
   * Descarga lo FILTRADO, no la página visible (#40).
   *
   * Vuelve a pedirlo al servidor con los mismos filtros y `limit` alto, en vez
   * de volcar el array que hay en pantalla. La lista viene paginada de 50: con
   * un volcado de lo visible, un filtro que devuelve 300 matrículas exporta 50
   * y el fichero parece completo. Nadie cuenta las filas de un CSV.
   */
  const exportarCSV = useCallback(async () => {
    try {
      const res = await client.get(`/matriculas?${queryDeLosFiltros({ limit: '5000' })}`);
      const filas = res?.success ? (res.data || []) : [];
      if (!filas.length) { toast({ title: 'No hay nada que exportar' }); return; }

      const cabecera = ['Nombre', 'Email', 'Telefono', 'DNI', 'Estado', 'Producto', 'Importe', 'Gestora', 'Alta'];
      const cuerpo = filas.map((m: any) => [
        m.lead_nombre || '', m.lead_email || '', m.lead_telefono || '', m.dni || '',
        ESTADO_LABEL[m.estado] || m.estado || '',
        m.producto_contratado || '', m.importe_total ?? '',
        m.responsable_nombre || '', (m.created_at || '').slice(0, 10),
      ]);
      const csv = [cabecera, ...cuerpo]
        .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      // El BOM va delante o Excel se come los acentos: «Matrícula» sale
      // «MatrÃ­cula» y el fichero se devuelve diciendo que está roto.
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `matriculas-${activeProject?.nombre || 'crm'}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: `${filas.length} matrículas exportadas` });
    } catch (err: any) {
      toast({ title: 'No se ha podido exportar', description: err?.message, variant: 'destructive' });
    }
  }, [queryDeLosFiltros, activeProject?.nombre]);

  // El catálogo, para el filtro por producto. Solo una vez por proyecto.
  useEffect(() => {
    if (!proyectoId) { setProductos([]); return; }
    let vivo = true;
    client.get(`/products?projectId=${proyectoId}&limit=200`)
      .then((r: any) => {
        if (!vivo || !r?.success) return;
        setProductos((r.data || []).map((p: any) => ({ id: p.id, nombre: p.nombre })));
      })
      .catch(() => { /* sin catálogo el filtro no se pinta y lo demás sigue */ });
    return () => { vivo = false; };
  }, [proyectoId]);

  useEffect(() => { load(); }, [load]);

  async function handleEstado(m, estado) {
    if (estado === 'rechazada') {
      setRechazoTarget(m);
      return;
    }
    try {
      await client.post(`/matriculas/${m.id}/estado`, { estado, motivo_rechazo: null });
      toast({ title: 'Validada' });
      load();
      if (detail?.id === m.id) setDetail(null);
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  async function confirmRechazo(motivo) {
    if (!rechazoTarget || !motivo) return;
    const m = rechazoTarget;
    setRechazoTarget(null);
    try {
      await client.post(`/matriculas/${m.id}/estado`, { estado: 'rechazada', motivo_rechazo: motivo });
      toast({ title: 'Rechazada' });
      load();
      if (detail?.id === m.id) setDetail(null);
    } catch (err) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader title="Matrículas" subtitle={`${stats.total || 0} matrículas en ${activeProject?.nombre || 'este proyecto'}`} />

      <div className="flex border-b border-border">
        <button
          onClick={() => setTab('list')}
          className={`flex items-center gap-2 px-3 h-9 text-sm font-bold border-b-2 focus:outline-none focus:ring-2 focus:ring-primary/40 ${tab === 'list' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
        >
          <GraduationCap size={14} /> Listado
        </button>
        <button
          onClick={() => setTab('webhooks')}
          className={`flex items-center gap-2 px-3 h-9 text-sm font-bold border-b-2 focus:outline-none focus:ring-2 focus:ring-primary/40 ${tab === 'webhooks' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
        >
          <PlugsConnected size={14} /> <span className="hidden sm:inline">Webhooks de admisión</span><span className="sm:hidden">Webhooks</span>
        </button>
      </div>

      {tab === 'webhooks' ? <WebhooksTab project={activeProject} /> : <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Total', value: stats.total, color: '#64748b' },
          { label: 'Pendientes', value: stats.pendientes, color: '#d97706' },
          { label: 'Validadas', value: stats.validadas, color: '#059669' },
          { label: 'Rechazadas', value: stats.rechazadas, color: '#dc2626' },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-3 border-b-2" style={{ borderBottomColor: k.color }}>
            <p className="text-[11px] font-bold uppercase text-muted-foreground">{k.label}</p>
            <p className="text-xl font-extrabold mt-0.5" style={{ color: k.color }}>{k.value || 0}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <input
          type="search"
          placeholder="Buscar nombre/email/DNI..."
          value={search}
          onChange={e => setFiltros({ q: e.target.value })}
          aria-label="Buscar matrículas"
          className="flex-1 min-w-[200px] h-9 px-3 rounded-lg border border-border bg-card text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
        />
        <Select<string>
          value={filterEstado}
          onChange={(v) => setFiltros({ estado: v })}
          options={[
            { value: '', label: 'Todos los estados' },
            { value: 'solicitud_admision', label: 'Solicitud admisión' },
            { value: 'datos_validados', label: 'Datos validados' },
            { value: 'pendiente', label: 'Pendientes' },
            { value: 'validada', label: 'Validadas' },
            { value: 'rechazada', label: 'Rechazadas' },
          ]}
          ariaLabel="Filtrar por estado"
          className="w-48"
        />
        {/* Solo para quien puede filtrar por gestora. A una gestora no se le
            ofrece: el servidor le devuelve lo suyo pida lo que pida, así que
            el desplegable sería un botón que no hace nada. */}
        {gestoras.length > 0 && (
          <Select<string>
            value={filterResp}
            onChange={(v) => setFiltros({ resp: v })}
            options={[
              { value: '', label: 'Todas las gestoras' },
              ...gestoras.map(g => ({ value: String(g.id), label: g.nombre })),
            ]}
            ariaLabel="Filtrar por gestora"
            className="w-44"
          />
        )}
        {productos.length > 0 && (
          <Select<string>
            value={filterProd}
            onChange={(v) => setFiltros({ prod: v })}
            options={[
              { value: '', label: 'Todos los productos' },
              ...productos.map(p => ({ value: String(p.id), label: p.nombre })),
            ]}
            ariaLabel="Filtrar por producto"
            className="w-52"
          />
        )}
        <input
          type="date" value={desde} onChange={e => setFiltros({ from: e.target.value })}
          aria-label="Matrículas desde"
          className="h-9 px-2 rounded-lg border border-border bg-card text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
        />
        <input
          type="date" value={hasta} onChange={e => setFiltros({ to: e.target.value })}
          aria-label="Matrículas hasta"
          className="h-9 px-2 rounded-lg border border-border bg-card text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40"
        />
        <Select<string>
          value={orden}
          onChange={(v) => setFiltros({ sort: v })}
          options={[
            { value: 'recent', label: 'Más recientes' },
            { value: 'oldest', label: 'Más antiguas' },
            { value: 'nombre', label: 'Por nombre' },
            { value: 'estado', label: 'Por estado' },
            { value: 'importe', label: 'Por importe' },
          ]}
          ariaLabel="Ordenar"
          className="w-40"
        />
        {hayFiltro && (
          <button
            type="button" onClick={() => setFiltros.reset()}
            className="h-9 px-3 rounded-lg border border-border bg-card text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <X size={13} weight="bold" /> Quitar filtros
          </button>
        )}
        {data.length > 0 && (
          <button
            type="button" onClick={exportarCSV}
            title="Exportar lo filtrado"
            className="h-9 px-3 rounded-lg border border-border bg-card text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <DownloadSimple size={14} weight="bold" /> CSV
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? <SkeletonTable rows={5} columns={6} /> : data.length === 0 ? (
          <EmptyState icon={GraduationCap} title="Sin matrículas" description="Aparece aquí cuando se crea una matrícula desde una conversión" />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-bold">Lead</th>
                    <th className="text-left px-4 py-2.5 font-bold">DNI</th>
                    <th className="text-left px-4 py-2.5 font-bold">Producto</th>
                    <th className="text-right px-4 py-2.5 font-bold">Importe</th>
                    <th className="text-center px-4 py-2.5 font-bold">Estado</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(m => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{m.lead_nombre || '—'}</div>
                        <div className="text-xs text-muted-foreground">{m.lead_email}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{m.dni || '—'}</td>
                      <td className="px-4 py-3 text-xs">{m.producto_contratado || '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{Number(m.importe_total || 0).toFixed(2)} €</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ESTADO_COLOR[m.estado]}`}>{ESTADO_LABEL[m.estado]}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setDetail(m)}
                          aria-label="Ver detalle de matrícula"
                          className="p-1.5 rounded hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border">
              {data.map(m => (
                <div key={m.id} className="p-3 flex items-start gap-3 hover:bg-muted/30">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ESTADO_COLOR[m.estado]}`}>{ESTADO_LABEL[m.estado]}</span>
                      <span className="text-sm font-bold tabular-nums">{Number(m.importe_total || 0).toFixed(2)} €</span>
                    </div>
                    <p className="text-sm font-semibold truncate">{m.lead_nombre || '—'}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{m.lead_email}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {m.producto_contratado || 'Sin producto'}{m.dni ? ` · ${m.dni}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setDetail(m)}
                      aria-label="Ver detalle de matrícula"
                      className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <Eye size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      </>}

      {detail && <MatriculaDetail matricula={detail} onClose={() => setDetail(null)} onChange={load} onEstado={can('matriculas.edit') ? handleEstado : undefined} />}
      <PromptDialog
        open={!!rechazoTarget}
        title="Rechazar matrícula"
        message="Indica el motivo del rechazo para que el solicitante pueda recibirlo."
        placeholder="Ej: documentación incompleta o ilegible…"
        multiline
        confirmLabel="Rechazar"
        onConfirm={confirmRechazo}
        onCancel={() => setRechazoTarget(null)}
      />
    </div>
  );
}
