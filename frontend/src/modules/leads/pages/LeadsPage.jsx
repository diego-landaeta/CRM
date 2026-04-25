import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeads } from '../hooks/useLeads';
import LeadFormDialog from '../components/LeadFormDialog';
import { toast } from '@/shared/hooks/useToast';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useProducts } from '@/modules/products/hooks/useProducts';
import client from '@/shared/api/client';
import {
  MagnifyingGlass,
  Plus,
  Export,
  CaretLeft,
  CaretRight,
  Users,
  WarningCircle,
  Notepad,
  PlugsConnected,
  CaretDown,
  Phone,
  EnvelopeSimple,
  WhatsappLogo,
  CheckCircle,
  CalendarPlus,
  DotsThreeVertical,
  Lightning,
} from '@phosphor-icons/react';

const ProjectSettingsDialog = lazy(() => import('@/modules/settings/components/ProjectSettingsDialog'));
const ConversionDialog = lazy(() => import('@/modules/conversions/components/ConversionDialog'));
const ConfirmDialog = lazy(() => import('@/shared/components/ui/ConfirmDialog'));
import StatusBadge, { STATUS_LABELS } from '@/shared/components/ui/StatusBadge';
import ChannelBadge from '@/shared/components/ui/ChannelBadge';
import EmptyState from '@/shared/components/ui/EmptyState';

const AVATAR_COLORS = [
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
  'bg-pink-100 text-pink-700',
  'bg-indigo-100 text-indigo-700',
];

function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function getAvatarColor(id) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

function formatRelative(dateStr, { future = false } = {}) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = future ? d - now : now - d;
  const diffDays = Math.round(diffMs / 86400000);
  if (diffDays < 0) return future ? `hace ${-diffDays}d` : null;
  if (diffDays === 0) return 'hoy';
  if (diffDays === 1) return future ? 'manana' : 'ayer';
  if (diffDays < 7) return future ? `en ${diffDays}d` : `hace ${diffDays}d`;
  if (diffDays < 30) return future ? `en ${Math.round(diffDays / 7)}sem` : `hace ${Math.round(diffDays / 7)}sem`;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

function cleanPhone(phone) {
  return (phone || '').replace(/[^\d]/g, '');
}

function QuickActions({ lead, onMarkContacted, onConvert }) {
  const wa = lead.telefono ? cleanPhone(lead.telefono) : null;
  const email = lead.email;

  return (
    <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
      {wa && (
        <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener" title="WhatsApp"
          className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-950/40 text-muted-foreground hover:text-green-700 dark:hover:text-green-400 transition-colors">
          <WhatsappLogo size={14} weight="regular" />
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} title="Email"
          className="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-950/40 text-muted-foreground hover:text-amber-700 dark:hover:text-amber-400 transition-colors">
          <EnvelopeSimple size={14} weight="regular" />
        </a>
      )}
      {lead.estado !== 'contactado' && lead.estado !== 'convertido' && lead.estado !== 'no_interesado' && onMarkContacted && (
        <button onClick={() => onMarkContacted(lead)} title="Marcar contactado"
          className="p-1.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-950/40 text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">
          <CheckCircle size={14} weight="regular" />
        </button>
      )}
      {lead.estado !== 'convertido' && onConvert && (
        <button onClick={() => onConvert(lead)} title="Convertir a cliente"
          className="p-1.5 rounded hover:bg-violet-100 dark:hover:bg-violet-950/40 text-muted-foreground hover:text-violet-700 dark:hover:text-violet-400 transition-colors">
          <Lightning size={14} weight="regular" />
        </button>
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b animate-pulse">
      <td className="px-5 py-3.5"><div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-full bg-muted" /><div className="w-24 h-4 bg-muted rounded" /></div></td>
      <td className="px-5 py-3.5"><div className="w-32 h-4 bg-muted rounded" /></td>
      <td className="px-5 py-3.5"><div className="w-16 h-4 bg-muted rounded" /></td>
      <td className="px-5 py-3.5"><div className="w-20 h-5 bg-muted rounded" /></td>
      <td className="px-5 py-3.5"><div className="w-16 h-4 bg-muted rounded" /></td>
      <td className="px-5 py-3.5"><div className="w-16 h-4 bg-muted rounded" /></td>
      <td className="px-5 py-3.5"><div className="w-20 h-4 bg-muted rounded" /></td>
      <td className="px-5 py-3.5"><div className="ml-auto w-24 h-6 bg-muted rounded" /></td>
    </tr>
  );
}

export default function LeadsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    leads, stats, total, page, totalPages,
    setPage, search, setSearch,
    filterEstado, setFilterEstado,
    filterOrigen, setFilterOrigen,
    filterResponsable, setFilterResponsable,
    loading, error, refetch,
  } = useLeads();

  const { activeProject } = useProjectContext();
  const { products } = useProducts(activeProject?.id);

  const [formOpen, setFormOpen] = useState(false);
  const [configTab, setConfigTab] = useState(null); // 'campos' | 'webhook' | null
  const [moreOpen, setMoreOpen] = useState(false);
  const [gestores, setGestores] = useState([]);
  const [convertingLead, setConvertingLead] = useState(null);
  const [confirmingContact, setConfirmingContact] = useState(null);

  // Cargar lista de responsables para el filtro (solo admin/superadmin)
  useEffect(() => {
    if (user?.role !== 'superadmin' && user?.role !== 'admin') return;
    client.get('/users?limit=100')
      .then((res) => {
        if (res.success) setGestores(res.data || []);
      })
      .catch(() => {});
  }, [user?.role]);

  function handleMarkContacted(lead) {
    setConfirmingContact(lead);
  }

  async function confirmMarkContacted() {
    const lead = confirmingContact;
    if (!lead) return;
    try {
      const res = await client.patch(`/leads/${lead.id}/status`, { status: 'contactado', motivo: 'Marcado contactado desde lista' });
      if (res.success) {
        toast({ title: 'Marcado como contactado', description: lead.nombre });
        await refetch();
      }
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error || err.message, variant: 'destructive' });
    } finally {
      setConfirmingContact(null);
    }
  }

  function handleConvert(lead) {
    setConvertingLead(lead);
  }

  async function handleConversionCreated() {
    const lead = convertingLead;
    if (!lead) return;
    // Cambiar status a convertido si no lo esta ya
    if (lead.estado !== 'convertido') {
      try {
        await client.patch(`/leads/${lead.id}/status`, { status: 'convertido', motivo: 'Conversion registrada desde lista' });
      } catch {}
    }
    setConvertingLead(null);
    toast({ title: 'Conversion registrada', description: lead.nombre });
    await refetch();
  }

  async function handleCreateLead(data) {
    if (!activeProject?.id) {
      toast({ title: 'Error', description: 'Selecciona un proyecto primero', variant: 'destructive' });
      return;
    }

    // Resolver producto_interes_id a partir del nombre
    let productoInteresId = null;
    if (data.producto_interes) {
      const prod = products.find(p => p.nombre === data.producto_interes);
      productoInteresId = prod?.id || null;
    }

    try {
      const res = await client.post('/leads', {
        project_id: activeProject.id,
        nombre: data.nombre,
        email: data.email,
        telefono: data.telefono || '',
        producto_interes_id: productoInteresId,
        canal: data.origen || 'directo',
        notas: data.notas || '',
        custom_fields: data.custom_fields || undefined,
      });

      if (res.success) {
        const { reincidente, duplicado } = res.data;
        let desc = 'Lead creado y asignado por round-robin';
        if (reincidente) desc = 'Prospecto REINCIDENTE detectado (mismo producto)';
        else if (duplicado) desc = 'Prospecto duplicado detectado en este proyecto';

        toast({ title: 'Lead creado', description: desc });
        await refetch();
      }
    } catch (err) {
      toast({
        title: 'Error al crear lead',
        description: err?.data?.error || err?.message || 'Error desconocido',
        variant: 'destructive',
      });
      throw err;
    }
  }

  // Generar array de paginas visibles (max 5 en torno a la actual)
  function getVisiblePages() {
    const pages = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  return (
    <div className="space-y-6">
      <LeadFormDialog open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleCreateLead} />
      {configTab && activeProject && (
        <Suspense fallback={null}>
          <ProjectSettingsDialog
            project={activeProject}
            initialTab={configTab}
            onClose={() => setConfigTab(null)}
          />
        </Suspense>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold">Gestion de Prospectos</h1>
          <p className="text-muted-foreground text-sm">Explora y gestiona tus clientes potenciales</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/leads/pipeline')}
            className="px-4 py-2.5 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            Pipeline
          </button>
          <button
            onClick={() => navigate('/leads/audiences')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            <Export size={16} weight="bold" />
            Audiencias
          </button>
          {(user?.role === 'admin' || user?.role === 'superadmin') && (
            <div className="relative">
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
              >
                Configurar <CaretDown size={12} weight="bold" />
              </button>
              {moreOpen && (
                <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg z-30 min-w-48 py-1">
                  <button
                    onClick={() => { setConfigTab('campos'); setMoreOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                  >
                    <Notepad size={14} /> Campos custom de leads
                  </button>
                  <button
                    onClick={() => { setConfigTab('webhook'); setMoreOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                  >
                    <PlugsConnected size={14} /> Webhook de captura
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap"
          >
            <Plus size={16} weight="bold" />
            <span className="hidden sm:inline">Nuevo Prospecto</span>
            <span className="sm:hidden">Nuevo</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="w-full h-11 pl-10 pr-4 rounded-md border border-border bg-muted/50 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={filterEstado}
          onChange={(e) => { setFilterEstado(e.target.value); setPage(1); }}
          className="h-11 px-4 pr-9 rounded-md border border-border bg-muted/50 text-sm outline-none appearance-none cursor-pointer focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filterOrigen}
          onChange={(e) => { setFilterOrigen(e.target.value); setPage(1); }}
          className="h-11 px-4 pr-9 rounded-md border border-border bg-muted/50 text-sm outline-none appearance-none cursor-pointer focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
        >
          <option value="">Todos los canales</option>
          <option value="meta_ads">Meta Ads</option>
          <option value="google_ads">Google Ads</option>
          <option value="tiktok_ads">TikTok Ads</option>
          <option value="organico">Organico</option>
          <option value="chatgpt_ia">ChatGPT IA</option>
          <option value="referido">Referido</option>
          <option value="directo">Directo</option>
        </select>
        {(user?.role === 'superadmin' || user?.role === 'admin') && (
          <select
            value={filterResponsable}
            onChange={(e) => { setFilterResponsable(e.target.value); setPage(1); }}
            className="h-11 px-4 pr-9 rounded-md border border-border bg-muted/50 text-sm outline-none appearance-none cursor-pointer focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
          >
            <option value="">Todos los responsables</option>
            {gestores.map((g) => (
              <option key={g.id} value={g.id}>{g.nombre}</option>
            ))}
          </select>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-card px-3 py-2.5 rounded-md border border-border">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-semibold mt-0.5 tabular-nums">{stats.total || 0}</p>
          </div>
          {[
            { key: 'nuevo', label: 'Nuevos', color: '#3b82f6' },
            { key: 'por_contactar', label: 'Por contactar', color: '#f59e0b' },
            { key: 'contactado', label: 'Contactados', color: '#10b981' },
            { key: 'en_seguimiento', label: 'En seguimiento', color: '#eab308' },
            { key: 'convertido', label: 'Convertidos', color: '#8b5cf6' },
            { key: 'no_interesado', label: 'No interesado', color: '#ef4444' },
          ].map(({ key, label, color }) => (
            <div key={key} className="bg-card px-3 py-2.5 rounded-md border border-border border-l-2" style={{ borderLeftColor: color }}>
              <p className="text-xs text-muted-foreground truncate">{label}</p>
              <p className="text-lg font-semibold mt-0.5 tabular-nums">{stats[key] || 0}</p>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <WarningCircle size={32} className="text-red-500 mx-auto mb-2" weight="regular" />
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-lg border border-border">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs text-muted-foreground">Nombre</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted-foreground">Email</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted-foreground">Origen</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted-foreground">Estado</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted-foreground">Ultimo contacto</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted-foreground">Proximo</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted-foreground">Gestor</th>
                <th className="px-5 py-2.5 text-right text-xs text-muted-foreground pr-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && leads.length === 0 && (
                <>
                  {[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
                </>
              )}
              {!loading && leads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold ${getAvatarColor(lead.id)}`}>
                        {getInitials(lead.nombre)}
                      </div>
                      <span className="font-semibold">{lead.nombre}</span>
                      {lead.reincidente && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" title="Reincidente: ya pregunto por este producto antes">
                          Reincidente
                        </span>
                      )}
                      {!lead.reincidente && lead.lead_duplicado_de && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" title="Este email ya existe en el proyecto">
                          Duplicado
                        </span>
                      )}
                      {lead.dias_inactivo != null &&
                       lead.dias_alerta_inactividad != null &&
                       lead.dias_inactivo > lead.dias_alerta_inactividad &&
                       !['convertido', 'no_interesado'].includes(lead.estado) && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" title={`Sin actividad hace ${lead.dias_inactivo} dias`}>
                          {lead.dias_inactivo}d
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{lead.email}</td>
                  <td className="px-5 py-3.5">
                    <ChannelBadge channel={lead.origen} />
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={lead.estado} />
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground text-xs">
                    {lead.last_interaction_at ? formatRelative(lead.last_interaction_at) : <span className="text-muted-foreground/60">Sin contacto</span>}
                  </td>
                  <td className="px-5 py-3.5 text-xs">
                    {lead.next_reminder_at ? (
                      <span className={(new Date(lead.next_reminder_at) < new Date()) ? 'text-red-600 font-medium' : 'text-foreground'}>
                        {formatRelative(lead.next_reminder_at, { future: true })}
                      </span>
                    ) : <span className="text-muted-foreground/60">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{lead.responsable_nombre || lead.gestor || 'Sin asignar'}</td>
                  <td className="px-5 py-3.5 text-right pr-3">
                    <QuickActions lead={lead} onMarkContacted={handleMarkContacted} onConvert={handleConvert} />
                  </td>
                </tr>
              ))}
              {!loading && leads.length === 0 && !error && (
                <tr>
                  <td colSpan={8} className="px-5">
                    <EmptyState
                      icon={Users}
                      title="No se encontraron prospectos"
                      description="Ajusta los filtros o crea un nuevo prospecto manualmente."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y">
          {loading && leads.length === 0 && (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            </div>
          )}
          {!loading && leads.map((lead) => (
            <div
              key={lead.id}
              onClick={() => navigate(`/leads/${lead.id}`)}
              className="p-4 space-y-2.5 cursor-pointer active:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${getAvatarColor(lead.id)}`}>
                    {getInitials(lead.nombre)}
                  </div>
                  <span className="text-[13px] font-semibold truncate">{lead.nombre}</span>
                </div>
                <StatusBadge status={lead.estado} />
              </div>
              <p className="text-[13px] text-muted-foreground truncate">{lead.email}</p>
              <div className="flex items-center gap-2 flex-wrap text-[11px]">
                <ChannelBadge channel={lead.origen} />
                {lead.last_interaction_at && (
                  <span className="text-muted-foreground">Ultimo: <span className="text-foreground">{formatRelative(lead.last_interaction_at)}</span></span>
                )}
                {lead.next_reminder_at && (
                  <span className={(new Date(lead.next_reminder_at) < new Date()) ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>
                    Proximo: <span className="font-medium">{formatRelative(lead.next_reminder_at, { future: true })}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-border/60">
                <span className="text-[11px] text-muted-foreground">{lead.responsable_nombre || 'Sin asignar'}</span>
                <QuickActions lead={lead} onMarkContacted={handleMarkContacted} onConvert={handleConvert} />
              </div>
            </div>
          ))}
          {!loading && leads.length === 0 && !error && (
            <EmptyState
              icon={Users}
              title="No se encontraron prospectos"
              description="Ajusta los filtros o crea un nuevo prospecto manualmente."
            />
          )}
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="px-5 py-3 border-t flex items-center justify-between text-[13px] text-muted-foreground">
            <span>
              Mostrando <strong className="text-foreground">{Math.min((page - 1) * 20 + 1, total)}&ndash;{Math.min(page * 20, total)}</strong> de {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <CaretLeft size={12} weight="bold" /> Anterior
              </button>
              {getVisiblePages().map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    p === page
                      ? 'bg-primary text-white shadow-sm'
                      : 'border border-border bg-card hover:bg-muted'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                Siguiente <CaretRight size={12} weight="bold" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Convertir prospecto — dialog inline */}
      <Suspense fallback={null}>
        <ConversionDialog
          open={!!convertingLead}
          onClose={() => setConvertingLead(null)}
          lead={convertingLead}
          projectId={activeProject?.id}
          onCreated={handleConversionCreated}
        />
      </Suspense>

      {/* Marcar contactado — confirm */}
      <Suspense fallback={null}>
        <ConfirmDialog
          open={!!confirmingContact}
          tone="success"
          title="Marcar como contactado"
          message={confirmingContact ? <>Vas a marcar a <strong className="text-foreground">{confirmingContact.nombre}</strong> como contactado. El estado del prospecto cambiara y se registrara la fecha actual.</> : null}
          confirmLabel="Si, marcar contactado"
          cancelLabel="Cancelar"
          onConfirm={confirmMarkContacted}
          onCancel={() => setConfirmingContact(null)}
        />
      </Suspense>
    </div>
  );
}
