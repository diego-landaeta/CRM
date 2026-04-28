import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLeads } from '../hooks/useLeads';
import { useWhatsappTemplates, fillTemplate } from '../hooks/useWhatsappTemplates';
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
  UploadSimple,
  ChatCircleText,
  PencilSimple,
  X,
  ArrowCounterClockwise,
  DownloadSimple,
} from '@phosphor-icons/react';

const ProjectSettingsDialog = lazy(() => import('@/modules/settings/components/ProjectSettingsDialog'));
const ConversionDialog = lazy(() => import('@/modules/conversions/components/ConversionDialog'));
const ConfirmDialog = lazy(() => import('@/shared/components/ui/ConfirmDialog'));
const CsvImportDialog = lazy(() => import('../components/CsvImportDialog'));
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
  if (diffDays === 1) return future ? 'mañana' : 'ayer';
  if (diffDays < 7) return future ? `en ${diffDays}d` : `hace ${diffDays}d`;
  if (diffDays < 30) return future ? `en ${Math.round(diffDays / 7)} sem` : `hace ${Math.round(diffDays / 7)} sem`;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

function cleanPhone(phone) {
  return (phone || '').replace(/[^\d]/g, '');
}

function exportLeadsCSV(leads, filename) {
  const STATUS_LABELS_ES = { nuevo: 'Nuevo', por_contactar: 'Por contactar', contactado: 'Contactado', en_seguimiento: 'En seguimiento', convertido: 'Convertido', no_interesado: 'No interesado' };
  const rows = [
    ['Nombre', 'Email', 'Teléfono', 'Estado', 'Canal', 'Responsable', 'Producto interés', 'Notas', 'Creado', 'Último contacto', 'Próximo recordatorio'],
    ...leads.map(l => [
      l.nombre || '',
      l.email || '',
      l.telefono || '',
      STATUS_LABELS_ES[l.estado] || l.estado || '',
      l.canal || '',
      l.responsable_nombre || '',
      l.producto_interes || '',
      l.notas || '',
      l.created_at ? new Date(l.created_at).toLocaleDateString('es-ES') : '',
      l.last_interaction_at ? new Date(l.last_interaction_at).toLocaleDateString('es-ES') : '',
      l.next_reminder_at ? new Date(l.next_reminder_at).toLocaleDateString('es-ES') : '',
    ]),
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function QuickActions({ lead, onMarkContacted, onConvert, onLogInteraction, onCreateReminder, templates, projectName, onEditTemplates }) {
  const wa = lead.telefono ? cleanPhone(lead.telefono) : null;
  const email = lead.email;
  const [waMenuOpen, setWaMenuOpen] = useState(false);

  function openWhatsappWithTemplate(tpl) {
    const text = tpl ? fillTemplate(tpl.text, { lead, projectName }) : '';
    const url = `https://wa.me/${wa}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
    window.open(url, '_blank', 'noopener');
    onLogInteraction?.(lead, 'whatsapp');
    setWaMenuOpen(false);
  }
  function handleEmail() {
    onLogInteraction?.(lead, 'email');
  }

  return (
    <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
      {wa && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setWaMenuOpen(o => !o)}
            title="WhatsApp con plantilla"
            className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-950/40 text-muted-foreground hover:text-green-700 dark:hover:text-green-400 transition-colors"
          >
            <WhatsappLogo size={14} weight="regular" />
          </button>
          {waMenuOpen && (
            <>
              <div className="fixed inset-0 !m-0 z-30" onClick={() => setWaMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-md py-1 min-w-60 z-40" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Plantillas</div>
                <button
                  type="button"
                  onClick={() => openWhatsappWithTemplate(null)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2"
                >
                  <WhatsappLogo size={12} weight="regular" /> Mensaje en blanco
                </button>
                {(templates || []).map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => openWhatsappWithTemplate(tpl)}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted"
                    title={tpl.text}
                  >
                    <span className="font-medium block truncate">{tpl.label}</span>
                    <span className="block text-[10px] text-muted-foreground truncate">{tpl.text}</span>
                  </button>
                ))}
                {onEditTemplates && (
                  <>
                    <div className="my-1 border-t border-border" />
                    <button
                      type="button"
                      onClick={() => { onEditTemplates(); setWaMenuOpen(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2 text-muted-foreground"
                    >
                      <PencilSimple size={12} weight="regular" /> Editar plantillas
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
      {email && (
        <a href={`mailto:${email}`} title="Email (registra interaccion)" onClick={handleEmail}
          className="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-950/40 text-muted-foreground hover:text-amber-700 dark:hover:text-amber-400 transition-colors">
          <EnvelopeSimple size={14} weight="regular" />
        </a>
      )}
      {onCreateReminder && (
        <button onClick={() => onCreateReminder(lead)} title="Programar siguiente contacto"
          className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-950/40 text-muted-foreground hover:text-blue-700 dark:hover:text-blue-400 transition-colors">
          <CalendarPlus size={14} weight="regular" />
        </button>
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

// Mini-dialog inline para crear recordatorio rapido
function ReminderQuickDialog({ open, lead, onClose, onSaved }) {
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('10:00');
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // Default: mañana a las 10am
      const tomorrow = new Date(Date.now() + 86400000);
      setFecha(tomorrow.toISOString().slice(0, 10));
      setHora('10:00');
      setNota('');
    }
  }, [open]);

  if (!open || !lead) return null;

  async function handleSave() {
    if (!fecha) return;
    setSaving(true);
    try {
      const fechaIso = new Date(`${fecha}T${hora}:00`).toISOString();
      await client.post(`/leads/${lead.id}/reminders`, { fecha: fechaIso, nota: nota || `Contacto programado` });
      toast({ title: 'Recordatorio creado', description: `${lead.nombre} — ${new Date(fechaIso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` });
      onSaved?.();
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error || err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Suspense fallback={null}>
      <div className="fixed inset-0 !m-0 z-[80] flex items-center justify-center sm:p-4">
        <div className="fixed inset-0 !m-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div role="dialog" className="relative bg-card sm:rounded-lg border border-border w-full max-w-md flex flex-col">
          <div className="px-5 py-4 border-b border-border flex items-start gap-3">
            <div className="w-9 h-9 rounded-md bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <CalendarPlus size={18} weight="regular" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-base">Programar siguiente contacto</h3>
              <p className="text-xs text-muted-foreground truncate">{lead.nombre}</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Fecha</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-border bg-card text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Hora</label>
                <input type="time" value={hora} onChange={e => setHora(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-border bg-card text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nota (opcional)</label>
              <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2}
                placeholder="Ej. Llamar para cerrar venta del Master"
                className="w-full px-3 py-2 rounded-md border border-border bg-card text-sm resize-none" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: 'En 2 horas', delta: 2 * 3600000 },
                { label: 'Manana 10am', getDate: () => { const t = new Date(Date.now() + 86400000); t.setHours(10, 0, 0, 0); return t; } },
                { label: 'En 3 dias', delta: 3 * 86400000 },
                { label: 'En 1 semana', delta: 7 * 86400000 },
              ].map(p => (
                <button key={p.label} type="button"
                  onClick={() => {
                    const d = p.getDate ? p.getDate() : new Date(Date.now() + p.delta);
                    setFecha(d.toISOString().slice(0, 10));
                    setHora(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
                  }}
                  className="px-2.5 py-1 rounded-md border border-border bg-card text-xs hover:bg-muted">
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/20">
            <button onClick={onClose} disabled={saving}
              className="inline-flex items-center h-9 px-4 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || !fecha}
              className="inline-flex items-center h-9 px-4 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Crear recordatorio'}
            </button>
          </div>
        </div>
      </div>
    </Suspense>
  );
}

function QuickChip({ active, onClick, label, count, tone = 'default' }) {
  const toneActive = {
    default: 'bg-primary text-white',
    danger: 'bg-red-600 text-white',
    warning: 'bg-amber-600 text-white',
  }[tone];
  const toneIdleCount = {
    default: 'bg-primary/15 text-primary',
    danger: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  }[tone];
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
        active ? toneActive : 'bg-muted text-muted-foreground hover:bg-muted/80'
      }`}
    >
      {label}
      {typeof count === 'number' && count > 0 && (
        <span className={`text-[10px] font-bold rounded-full px-1.5 ${active ? 'bg-white/20' : toneIdleCount}`}>{count}</span>
      )}
    </button>
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
  const { templates: waTemplates, save: saveWaTemplates, reset: resetWaTemplates } = useWhatsappTemplates(activeProject?.id);

  const [formOpen, setFormOpen] = useState(false);
  const [configTab, setConfigTab] = useState(null); // 'campos' | 'webhook' | null
  const [moreOpen, setMoreOpen] = useState(false);
  const [gestores, setGestores] = useState([]);
  const [convertingLead, setConvertingLead] = useState(null);
  const [confirmingContact, setConfirmingContact] = useState(null);
  const [reminderLead, setReminderLead] = useState(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [waTemplatesOpen, setWaTemplatesOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]); // bulk actions
  const [bulkAction, setBulkAction] = useState(null); // null | 'reassign' | 'status' | 'export'
  const [bulkLoading, setBulkLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [quickFilter, setQuickFilterState] = useState(searchParams.get('qf') || ''); // '' | 'urgent' | 'overdue' | 'today' | 'no-contact'

  // Sincronizar filtro con URL para deep-linking desde el Dashboard
  function setQuickFilter(v) {
    setQuickFilterState(v);
    setSelectedIds([]);
    if (v) setSearchParams({ qf: v }, { replace: true });
    else setSearchParams({}, { replace: true });
  }

  // Filtros rapidos client-side (sobre los leads ya cargados)
  const filteredLeads = useMemo(() => {
    if (!quickFilter) return leads;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 86400000);
    return leads.filter(l => {
      const next = l.next_reminder_at ? new Date(l.next_reminder_at) : null;
      const last = l.last_interaction_at ? new Date(l.last_interaction_at) : null;
      if (quickFilter === 'overdue') return next && next < now;
      if (quickFilter === 'today') return next && next >= today && next < tomorrow;
      if (quickFilter === 'no-contact') return !last && ['nuevo', 'por_contactar'].includes(l.estado);
      if (quickFilter === 'urgent') {
        // Vencidos + hoy + sin contacto en estado nuevo/por_contactar
        if (next && next < tomorrow) return true;
        if (!last && ['nuevo', 'por_contactar'].includes(l.estado)) return true;
        return false;
      }
      return true;
    });
  }, [leads, quickFilter]);

  const quickCounts = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 86400000);
    let overdue = 0, todayCount = 0, noContact = 0;
    leads.forEach(l => {
      const next = l.next_reminder_at ? new Date(l.next_reminder_at) : null;
      const last = l.last_interaction_at ? new Date(l.last_interaction_at) : null;
      if (next && next < now) overdue++;
      if (next && next >= today && next < tomorrow) todayCount++;
      if (!last && ['nuevo', 'por_contactar'].includes(l.estado)) noContact++;
    });
    return { overdue, today: todayCount, noContact, urgent: overdue + todayCount + noContact };
  }, [leads]);

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

  function handleCreateReminder(lead) {
    setReminderLead(lead);
  }

  // Bulk actions ----------------------------------------------
  function toggleSelected(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleSelectAll() {
    if (selectedIds.length === filteredLeads.length && filteredLeads.length > 0) setSelectedIds([]);
    else setSelectedIds(filteredLeads.map(l => l.id));
  }
  function clearSelection() {
    setSelectedIds([]);
    setBulkAction(null);
  }

  async function handleBulkStatusChange(newStatus) {
    setBulkLoading(true);
    let ok = 0, fail = 0;
    for (const id of selectedIds) {
      try {
        await client.patch(`/leads/${id}/status`, { status: newStatus, motivo: `Cambio masivo desde tabla` });
        ok++;
      } catch { fail++; }
    }
    setBulkLoading(false);
    setBulkAction(null);
    setSelectedIds([]);
    toast({ title: `${ok} actualizados`, description: fail > 0 ? `${fail} con error` : null });
    refetch();
  }

  async function handleBulkReassign(gestorId) {
    setBulkLoading(true);
    let ok = 0, fail = 0;
    for (const id of selectedIds) {
      try {
        await client.patch(`/leads/${id}/reassign`, { responsable_id: gestorId });
        ok++;
      } catch { fail++; }
    }
    setBulkLoading(false);
    setBulkAction(null);
    setSelectedIds([]);
    const gestor = gestores.find(g => g.id === gestorId);
    toast({ title: `${ok} reasignados a ${gestor?.nombre || ''}`, description: fail > 0 ? `${fail} con error` : null });
    refetch();
  }

  function handleBulkExportCsv() {
    const selected = filteredLeads.filter(l => selectedIds.includes(l.id));
    const headers = ['nombre', 'email', 'telefono', 'estado', 'origen', 'gestor', 'fecha'];
    const rows = selected.map(l => [
      l.nombre, l.email, l.telefono || '', l.estado || '',
      l.origen || l.canal_detectado || '', l.responsable_nombre || '',
      (l.created_at || '').slice(0, 10),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prospectos_${activeProject?.slug || 'proyecto'}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 100);
    toast({ title: `${selected.length} prospectos exportados` });
  }

  // Auto-log de interaccion al usar acciones rapidas (WhatsApp/Email)
  async function handleLogInteraction(lead, tipo) {
    try {
      await client.post(`/leads/${lead.id}/interactions`, {
        tipo,
        nota: tipo === 'whatsapp' ? 'Contacto por WhatsApp (acceso rapido)' : 'Email enviado (acceso rapido)',
        fecha: new Date().toISOString(),
      });
      toast({ title: 'Interaccion registrada', description: `${tipo === 'whatsapp' ? 'WhatsApp' : 'Email'} con ${lead.nombre}` });
      refetch();
    } catch (err) {
      // Silent fail — el link igual abre, no queremos bloquear al usuario
    }
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
          <h1 className="text-xl sm:text-2xl font-semibold">Gestión de Prospectos</h1>
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
          {filteredLeads.length > 0 && (
            <button
              onClick={() => exportLeadsCSV(filteredLeads, `prospectos-${activeProject?.nombre || 'crm'}-${new Date().toISOString().slice(0, 10)}.csv`)}
              title="Exportar CSV"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
            >
              <DownloadSimple size={16} weight="bold" />
              CSV
            </button>
          )}
          {(user?.role === 'admin' || user?.role === 'superadmin') && (
            <div className="relative">
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
              >
                Configurar <CaretDown size={12} weight="bold" />
              </button>
              {moreOpen && (
                <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg z-30 min-w-52 py-1">
                  <button
                    onClick={() => { setCsvImportOpen(true); setMoreOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                  >
                    <UploadSimple size={14} /> Importar desde CSV
                  </button>
                  <div className="my-1 border-t border-border" />
                  <button
                    onClick={() => { setConfigTab('campos'); setMoreOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                  >
                    <Notepad size={14} /> Campos custom de prospectos
                  </button>
                  <button
                    onClick={() => { setConfigTab('webhook'); setMoreOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                  >
                    <PlugsConnected size={14} /> Webhook de captura
                  </button>
                  <button
                    onClick={() => { setWaTemplatesOpen(true); setMoreOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                  >
                    <ChatCircleText size={14} /> Plantillas de WhatsApp
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
          <option value="organico">Orgánico</option>
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

      {/* Filtros rapidos por accion (client-side) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs text-muted-foreground flex-shrink-0">Mostrar</span>
        <QuickChip active={!quickFilter} onClick={() => setQuickFilter('')} label="Todos" />
        <QuickChip active={quickFilter === 'urgent'} onClick={() => setQuickFilter('urgent')}
          label="Necesitan accion hoy" count={quickCounts.urgent} tone="danger" />
        <QuickChip active={quickFilter === 'overdue'} onClick={() => setQuickFilter('overdue')}
          label="Vencidos" count={quickCounts.overdue} tone="danger" />
        <QuickChip active={quickFilter === 'today'} onClick={() => setQuickFilter('today')}
          label="Hoy" count={quickCounts.today} tone="warning" />
        <QuickChip active={quickFilter === 'no-contact'} onClick={() => setQuickFilter('no-contact')}
          label="Sin contacto" count={quickCounts.noContact} tone="default" />
      </div>

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
                <th className="pl-5 pr-2 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === filteredLeads.length}
                    onChange={toggleSelectAll}
                    className="rounded border-border"
                    aria-label="Seleccionar todos"
                  />
                </th>
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
              {!loading && filteredLeads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  className={`border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer ${selectedIds.includes(lead.id) ? 'bg-primary/5' : ''}`}
                >
                  <td className="pl-5 pr-2 py-3.5" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(lead.id)}
                      onChange={() => toggleSelected(lead.id)}
                      className="rounded border-border"
                      aria-label={`Seleccionar ${lead.nombre}`}
                    />
                  </td>
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
                    <QuickActions lead={lead} onMarkContacted={handleMarkContacted} onConvert={handleConvert} onLogInteraction={handleLogInteraction} onCreateReminder={handleCreateReminder} templates={waTemplates} projectName={activeProject?.nombre} onEditTemplates={() => setWaTemplatesOpen(true)} />
                  </td>
                </tr>
              ))}
              {!loading && filteredLeads.length === 0 && !error && (
                <tr>
                  <td colSpan={9} className="px-5">
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
          {!loading && filteredLeads.map((lead) => (
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
                <QuickActions lead={lead} onMarkContacted={handleMarkContacted} onConvert={handleConvert} onLogInteraction={handleLogInteraction} onCreateReminder={handleCreateReminder} templates={waTemplates} projectName={activeProject?.nombre} onEditTemplates={() => setWaTemplatesOpen(true)} />
              </div>
            </div>
          ))}
          {!loading && filteredLeads.length === 0 && !error && (
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

      {/* Bulk action bar — sticky abajo cuando hay seleccion */}
      {selectedIds.length > 0 && (
        <BulkActionBar
          count={selectedIds.length}
          onClear={clearSelection}
          onChangeStatus={status => handleBulkStatusChange(status)}
          onReassign={gestorId => handleBulkReassign(gestorId)}
          onExport={handleBulkExportCsv}
          gestores={gestores}
          isAdmin={user?.role === 'superadmin' || user?.role === 'admin'}
          loading={bulkLoading}
        />
      )}

      {/* Crear recordatorio inline */}
      <ReminderQuickDialog
        open={!!reminderLead}
        lead={reminderLead}
        onClose={() => setReminderLead(null)}
        onSaved={() => { setReminderLead(null); refetch(); }}
      />

      {/* Import CSV */}
      <Suspense fallback={null}>
        <CsvImportDialog
          open={csvImportOpen}
          onClose={() => setCsvImportOpen(false)}
          projectId={activeProject?.id}
          onImported={({ ok }) => { if (ok > 0) refetch(); }}
        />
      </Suspense>

      {/* Plantillas WhatsApp por proyecto */}
      <WhatsappTemplatesDialog
        open={waTemplatesOpen}
        onClose={() => setWaTemplatesOpen(false)}
        templates={waTemplates}
        onSave={saveWaTemplates}
        onReset={resetWaTemplates}
        projectName={activeProject?.nombre}
      />
    </div>
  );
}

// ===== BulkActionBar — sticky abajo cuando hay seleccion =====
function BulkActionBar({ count, onClear, onChangeStatus, onReassign, onExport, gestores, isAdmin, loading }) {
  const [openMenu, setOpenMenu] = useState(null); // null | 'status' | 'reassign'

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-card border border-border rounded-lg px-4 py-2.5 flex items-center gap-3 max-w-[95vw]" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
      <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
        {count} seleccionado{count === 1 ? '' : 's'}
      </span>

      <div className="h-5 w-px bg-border" />

      <div className="flex items-center gap-1 flex-wrap">
        {/* Cambiar estado */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'status' ? null : 'status')}
            disabled={loading}
            className="px-3 py-1.5 rounded-md text-xs font-medium hover:bg-muted disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <CheckCircle size={14} weight="regular" /> Cambiar estado <CaretDown size={10} weight="bold" />
          </button>
          {openMenu === 'status' && (
            <div className="absolute bottom-full mb-1 left-0 bg-card border border-border rounded-md py-1 min-w-44 z-10" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <button key={k} onClick={() => { onChangeStatus(k); setOpenMenu(null); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted">
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reasignar (solo admin) */}
        {isAdmin && gestores.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === 'reassign' ? null : 'reassign')}
              disabled={loading}
              className="px-3 py-1.5 rounded-md text-xs font-medium hover:bg-muted disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Users size={14} weight="regular" /> Reasignar <CaretDown size={10} weight="bold" />
            </button>
            {openMenu === 'reassign' && (
              <div className="absolute bottom-full mb-1 left-0 bg-card border border-border rounded-md py-1 min-w-48 max-h-60 overflow-y-auto z-10" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                {gestores.map(g => (
                  <button key={g.id} onClick={() => { onReassign(g.id); setOpenMenu(null); }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted">
                    {g.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Exportar CSV */}
        <button
          onClick={onExport}
          disabled={loading}
          className="px-3 py-1.5 rounded-md text-xs font-medium hover:bg-muted disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <Export size={14} weight="regular" /> Exportar CSV
        </button>
      </div>

      <div className="h-5 w-px bg-border" />

      <button onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground p-1 rounded">
        Cancelar
      </button>
    </div>
  );
}

// ===== WhatsappTemplatesDialog — editor de plantillas por proyecto =====
function WhatsappTemplatesDialog({ open, onClose, templates, onSave, onReset, projectName }) {
  const [draft, setDraft] = useState([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(templates ? templates.map(t => ({ ...t })) : []);
      setDirty(false);
    }
  }, [open, templates]);

  if (!open) return null;

  function updateField(idx, field, value) {
    setDraft(d => d.map((t, i) => i === idx ? { ...t, [field]: value } : t));
    setDirty(true);
  }
  function addTemplate() {
    setDraft(d => [...d, { id: `tpl_${Date.now()}`, label: 'Nueva plantilla', text: 'Hola {nombre}, ' }]);
    setDirty(true);
  }
  function removeTemplate(idx) {
    setDraft(d => d.filter((_, i) => i !== idx));
    setDirty(true);
  }
  function handleSave() {
    onSave(draft);
    toast({ title: 'Plantillas guardadas', description: `${draft.length} plantillas para ${projectName || 'este proyecto'}` });
    onClose();
  }
  function handleReset() {
    onReset();
    toast({ title: 'Plantillas restauradas a las predeterminadas' });
    onClose();
  }

  return (
    <div className="fixed inset-0 !m-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div>
            <h2 className="text-base font-semibold">Plantillas de WhatsApp</h2>
            <p className="text-xs text-muted-foreground">Para {projectName || 'este proyecto'} - guardadas en este navegador</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>

        <div className="px-5 py-3 text-xs text-muted-foreground bg-muted/30 border-b">
          Variables disponibles: <code className="bg-card px-1 rounded">{'{nombre}'}</code> <code className="bg-card px-1 rounded">{'{nombreCompleto}'}</code> <code className="bg-card px-1 rounded">{'{producto}'}</code> <code className="bg-card px-1 rounded">{'{proyecto}'}</code> <code className="bg-card px-1 rounded">{'{email}'}</code> <code className="bg-card px-1 rounded">{'{telefono}'}</code>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {draft.map((tpl, idx) => (
            <div key={tpl.id} className="border border-border rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tpl.label}
                  onChange={e => updateField(idx, 'label', e.target.value)}
                  className="flex-1 px-2 py-1.5 text-sm font-medium border border-border rounded bg-background"
                  placeholder="Nombre de la plantilla"
                />
                <button
                  type="button"
                  onClick={() => removeTemplate(idx)}
                  className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-950/40 text-muted-foreground hover:text-red-700"
                  title="Eliminar plantilla"
                >
                  <X size={14} />
                </button>
              </div>
              <textarea
                value={tpl.text}
                onChange={e => updateField(idx, 'text', e.target.value)}
                rows={3}
                className="w-full px-2 py-1.5 text-xs border border-border rounded bg-background resize-y font-mono"
                placeholder="Hola {nombre}, ..."
              />
            </div>
          ))}
          {draft.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">No hay plantillas. Anade una para empezar.</p>
          )}
          <button
            type="button"
            onClick={addTemplate}
            className="w-full py-2 border border-dashed border-border rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center justify-center gap-1.5"
          >
            <Plus size={14} weight="bold" /> Anadir plantilla
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-muted"
          >
            <ArrowCounterClockwise size={12} /> Restaurar predeterminadas
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-sm font-medium hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty}
              className="px-4 py-1.5 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              Guardar plantillas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
