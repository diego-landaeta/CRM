import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLeadDetail } from '../hooks/useLeads';
import ConversionsTab from '@/modules/conversions/components/ConversionsTab';
import Portal from '@/shared/components/ui/portal';
import { toast } from '@/shared/hooks/useToast';
import { useAuth } from '@/contexts/AuthContext';
import client from '@/shared/api/client';
import {
  ArrowLeft,
  Phone,
  EnvelopeSimple,
  WhatsappLogo,
  Note,
  CalendarCheck,
  WarningCircle,
  Users,
  PencilSimple,
  X,
  Check,
  Link as LinkIcon,
  Lightning,
  ArrowClockwise,
  CurrencyEur,
} from '@phosphor-icons/react';
import StatusBadge, { STATUS_LABELS as ESTADO_LABELS } from '@/shared/components/ui/StatusBadge';
import ChannelBadge, { CHANNEL_LABELS as CANAL_LABELS } from '@/shared/components/ui/ChannelBadge';

const INTERACTION_ICONS = {
  llamada: Phone,
  email: EnvelopeSimple,
  whatsapp: WhatsappLogo,
  nota: Note,
};

const INTERACTION_COLORS = {
  llamada: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30',
  email: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30',
  whatsapp: 'text-green-600 bg-green-50 dark:bg-green-950/30',
  nota: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
};

const AVATAR_COLORS = [
  'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
];

function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function InfoField({ label, children }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <div className="text-[13px] font-medium break-words">{children}</div>
    </div>
  );
}

const inputClass = 'w-full h-11 px-4 rounded-xl border border-border bg-muted/50 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground';
const selectClass = "w-full h-11 px-4 pr-9 rounded-xl border border-border bg-muted/50 text-sm outline-none appearance-none cursor-pointer focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all";
const selectBg = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' };

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    lead, timeline, interacciones, reminders, utms, loading, error, refetch,
    updateStatus, addInteraction, addReminder, completeReminder, reassign, updateLead,
  } = useLeadDetail(id);

  const [conversionOpen, setConversionOpen] = useState(false);
  const [lossOpen, setLossOpen] = useState(false);
  const [lossReason, setLossReason] = useState('');
  const [selectedEstado, setSelectedEstado] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);

  // Edicion inline lead
  const [editMode, setEditMode] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editNotas, setEditNotas] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Interaccion form
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [interactionTipo, setInteractionTipo] = useState('llamada');
  const [interactionNota, setInteractionNota] = useState('');
  const [interactionFecha, setInteractionFecha] = useState(() => {
    // Datetime-local espera YYYY-MM-DDTHH:mm en hora local
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [interactionLoading, setInteractionLoading] = useState(false);

  // Reminder form
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderFecha, setReminderFecha] = useState('');
  const [reminderNota, setReminderNota] = useState('');
  const [reminderLoading, setReminderLoading] = useState(false);

  // Reassign dialog
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignId, setReassignId] = useState('');
  const [reassignLoading, setReassignLoading] = useState(false);
  const [gestores, setGestores] = useState([]);

  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';

  // Cargar gestores al montar (si admin+) — solo cuando se abre dialog
  useEffect(() => {
    if (!isAdmin) return;
    if (gestores.length > 0) return;
    client.get('/users?limit=100')
      .then((res) => { if (res.success) setGestores(res.data || []); })
      .catch(() => {});
  }, [isAdmin, gestores.length]);

  // Sincronizar selectedEstado cuando lead cambia
  useEffect(() => {
    if (lead?.estado && !selectedEstado) {
      setSelectedEstado(lead.estado);
    }
  }, [lead, selectedEstado]);

  // Sincronizar form de edicion al activar
  useEffect(() => {
    if (lead && editMode) {
      setEditNombre(lead.nombre || '');
      setEditTelefono(lead.telefono || '');
      setEditNotas(lead.notas || '');
    }
  }, [lead, editMode]);

  async function handleEstadoUpdate() {
    if (!selectedEstado || selectedEstado === lead.estado) return;

    if (selectedEstado === 'convertido') {
      toast({
        title: 'Registra la compra',
        description: 'Ve al apartado "Historial de compras" mas abajo y registra la conversion con importe y metodo de pago.',
      });
      setConversionOpen(true);
      // Scroll hasta la seccion de compras
      setTimeout(() => {
        document.querySelector('[data-section="compras"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return;
    }
    if (selectedEstado === 'no_interesado') {
      setLossOpen(true);
      return;
    }

    setStatusLoading(true);
    try {
      await updateStatus(selectedEstado, `Cambio manual a ${ESTADO_LABELS[selectedEstado]}`);
      toast({ title: 'Estado actualizado', description: `Cambiado a ${ESTADO_LABELS[selectedEstado]}` });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleLossConfirm() {
    if (!lossReason) return;
    setStatusLoading(true);
    try {
      await updateStatus('no_interesado', lossReason);
      toast({ title: 'Lead marcado como no interesado', description: `Motivo: ${lossReason}` });
      setLossOpen(false);
      setLossReason('');
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleAddInteraction(e) {
    e.preventDefault();
    if (!interactionNota.trim() && interactionTipo !== 'llamada') return;
    setInteractionLoading(true);
    try {
      // Convertir datetime-local (sin tz) a ISO con offset local
      const fechaIso = interactionFecha ? new Date(interactionFecha).toISOString() : undefined;
      await addInteraction(interactionTipo, interactionNota, fechaIso);
      toast({ title: 'Interaccion registrada' });
      setInteractionOpen(false);
      setInteractionNota('');
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setInteractionLoading(false);
    }
  }

  async function handleAddReminder(e) {
    e.preventDefault();
    if (!reminderFecha) return;
    setReminderLoading(true);
    try {
      // Convertir datetime-local a YYYY-MM-DD que el backend espera
      const fechaSolo = reminderFecha.slice(0, 10);
      await addReminder(fechaSolo, reminderNota);
      toast({ title: 'Recordatorio programado' });
      setReminderOpen(false);
      setReminderFecha('');
      setReminderNota('');
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setReminderLoading(false);
    }
  }

  async function handleReassign() {
    if (!reassignId) return;
    setReassignLoading(true);
    try {
      await reassign(Number(reassignId));
      toast({ title: 'Lead reasignado correctamente' });
      setReassignOpen(false);
      setReassignId('');
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setReassignLoading(false);
    }
  }

  async function handleCompleteReminder(remId) {
    try {
      await completeReminder(remId);
      toast({ title: 'Recordatorio completado' });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  async function handleSaveEdit() {
    setEditLoading(true);
    try {
      const fields = {};
      if (editNombre !== lead.nombre) fields.nombre = editNombre.trim();
      if ((editTelefono || '') !== (lead.telefono || '')) fields.telefono = editTelefono.trim() || null;
      if ((editNotas || '') !== (lead.notas || '')) fields.notas = editNotas.trim() || null;

      if (Object.keys(fields).length === 0) {
        setEditMode(false);
        return;
      }

      await updateLead(fields);
      toast({ title: 'Lead actualizado' });
      setEditMode(false);
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setEditLoading(false);
    }
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="w-24 h-4 bg-muted rounded animate-pulse" />
        <div className="flex items-center gap-4 animate-pulse">
          <div className="w-12 h-12 rounded-full bg-muted" />
          <div>
            <div className="w-40 h-6 bg-muted rounded mb-2" />
            <div className="w-24 h-4 bg-muted rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-card p-6 rounded-3xl border border-border animate-pulse">
              <div className="w-32 h-5 bg-muted rounded mb-5" />
              <div className="grid grid-cols-2 gap-5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i}>
                    <div className="w-16 h-3 bg-muted rounded mb-2" />
                    <div className="w-28 h-4 bg-muted rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card p-5 rounded-3xl border border-border animate-pulse">
                <div className="w-24 h-4 bg-muted rounded mb-3" />
                <div className="w-full h-11 bg-muted rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-4">
          <WarningCircle size={32} className="text-red-500" weight="duotone" />
        </div>
        <h3 className="font-semibold mb-1">{error ? 'No se pudo cargar el lead' : 'Lead no encontrado'}</h3>
        {error && <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">{error}</p>}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => navigate('/leads')}
            className="text-sm font-semibold text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 rounded px-2 py-1"
          >
            Volver a Leads
          </button>
          {error && (
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground border border-border bg-card px-3 py-1.5 rounded-lg hover:bg-muted transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
            >
              <ArrowClockwise size={12} weight="bold" /> Reintentar
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Conversion dialog removido - ahora se crea desde el tab Compras */}

      {/* Dialog motivo perdida */}
      {lossOpen && (
        <Portal>
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setLossOpen(false)} />
            <div className="relative bg-card rounded-3xl border border-border shadow-[0_20px_25px_-5px_rgb(0_0_0/0.1)] w-full max-w-sm p-6">
              <h2 className="text-lg font-extrabold tracking-tight mb-1">Motivo de perdida</h2>
              <p className="text-muted-foreground text-sm mb-5">Este campo es obligatorio al marcar un lead como no interesado.</p>
              <select value={lossReason} onChange={(e) => setLossReason(e.target.value)} className={selectClass} style={selectBg}>
                <option value="">Selecciona un motivo</option>
                <option value="precio">Precio</option>
                <option value="falta_interes">Falta de interes</option>
                <option value="sin_respuesta">Sin respuesta</option>
                <option value="competencia">Competencia</option>
                <option value="timing">Timing (no es el momento)</option>
                <option value="otro">Otro</option>
              </select>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setLossOpen(false)} className="px-4 py-2 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-muted transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleLossConfirm}
                  disabled={!lossReason || statusLoading}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-40"
                >
                  {statusLoading ? 'Guardando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Dialog reasignar gestor */}
      {reassignOpen && (
        <Portal>
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setReassignOpen(false)} />
            <div className="relative bg-card rounded-3xl border border-border shadow-[0_20px_25px_-5px_rgb(0_0_0/0.1)] w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight">Reasignar Lead</h2>
                  <p className="text-muted-foreground text-sm mt-0.5">Selecciona un nuevo responsable para este lead</p>
                </div>
                <button onClick={() => setReassignOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted">
                  <X size={18} weight="bold" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Nuevo responsable</label>
                  <select value={reassignId} onChange={(e) => setReassignId(e.target.value)} className={selectClass} style={selectBg}>
                    <option value="">Seleccionar responsable</option>
                    {gestores
                      .filter((g) => g.role === 'admin' || g.role === 'gestor' || g.role === 'superadmin')
                      .map((g) => (
                        <option key={g.id} value={g.id}>{g.nombre} ({g.role})</option>
                      ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setReassignOpen(false)} className="px-4 py-2 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-muted transition-colors">
                    Cancelar
                  </button>
                  <button
                    onClick={handleReassign}
                    disabled={!reassignId || reassignLoading}
                    className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40"
                  >
                    {reassignLoading ? 'Guardando...' : 'Reasignar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Dialog nueva interaccion */}
      {interactionOpen && (
        <Portal>
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setInteractionOpen(false)} />
            <div className="relative bg-card rounded-3xl border border-border shadow-[0_20px_25px_-5px_rgb(0_0_0/0.1)] w-full max-w-md p-6">
              <h2 className="text-lg font-extrabold tracking-tight mb-1">Nueva Interaccion</h2>
              <p className="text-muted-foreground text-sm mb-5">Registra un contacto con este lead</p>
              <form onSubmit={handleAddInteraction} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Tipo</label>
                  <select value={interactionTipo} onChange={(e) => setInteractionTipo(e.target.value)} className={selectClass} style={selectBg}>
                    <option value="llamada">Llamada</option>
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="nota">Nota</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Fecha y hora</label>
                  <input
                    type="datetime-local"
                    value={interactionFecha}
                    onChange={(e) => setInteractionFecha(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-muted/50 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Por defecto es ahora. Editala si la interaccion ocurrio antes.</p>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Nota</label>
                  <textarea
                    value={interactionNota}
                    onChange={(e) => setInteractionNota(e.target.value)}
                    placeholder="Describe la interaccion..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-muted/50 text-sm outline-none resize-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setInteractionOpen(false)} className="px-4 py-2 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-muted transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={interactionLoading} className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40">
                    {interactionLoading ? 'Guardando...' : 'Registrar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* Dialog nuevo recordatorio */}
      {reminderOpen && (
        <Portal>
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setReminderOpen(false)} />
            <div className="relative bg-card rounded-3xl border border-border shadow-[0_20px_25px_-5px_rgb(0_0_0/0.1)] w-full max-w-md p-6">
              <h2 className="text-lg font-extrabold tracking-tight mb-1">Programar Recordatorio</h2>
              <p className="text-muted-foreground text-sm mb-5">Establece una fecha y nota para el recordatorio</p>
              <form onSubmit={handleAddReminder} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Fecha *</label>
                  <input
                    type="date"
                    value={reminderFecha}
                    onChange={(e) => setReminderFecha(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-muted/50 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Nota</label>
                  <textarea
                    value={reminderNota}
                    onChange={(e) => setReminderNota(e.target.value)}
                    placeholder="Que hay que recordar..."
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-muted/50 text-sm outline-none resize-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setReminderOpen(false)} className="px-4 py-2 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-muted transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={reminderLoading} className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40">
                    {reminderLoading ? 'Guardando...' : 'Programar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* Alerta duplicado */}
      {lead.lead_duplicado_de && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
          <WarningCircle size={20} weight="duotone" className="flex-shrink-0" />
          <div className="text-sm flex-1">
            <span className="font-bold">Lead duplicado</span> &mdash; Este email ya existe en el sistema.
          </div>
          <Link
            to={`/leads/${lead.lead_duplicado_de}`}
            className="text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors flex-shrink-0"
          >
            <LinkIcon size={12} weight="bold" /> Ver original #{lead.lead_duplicado_de}
          </Link>
        </div>
      )}

      {/* Header */}
      <div>
        <button onClick={() => navigate('/leads')} className="text-primary text-sm font-semibold flex items-center gap-1.5 mb-4 hover:underline">
          <ArrowLeft size={14} weight="bold" /> Volver a Leads
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-extrabold ${AVATAR_COLORS[lead.id % AVATAR_COLORS.length]}`}>
              {getInitials(lead.nombre)}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">{lead.nombre}</h1>
              <p className="text-muted-foreground text-sm">
                Lead #{lead.id} &bull; {lead.created_at ? new Date(lead.created_at).toLocaleDateString('es-ES') : ''}
                {lead.proyecto_nombre && <> &bull; {lead.proyecto_nombre}</>}
              </p>
            </div>
            <StatusBadge status={lead.estado} showIcon />
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <button
                onClick={() => setReassignOpen(true)}
                className="px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2"
              >
                <Lightning size={14} weight="bold" /> Reasignar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Info del Lead - Editable */}
          <div className="bg-card p-6 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold">Informacion del Lead</h3>
              {!editMode ? (
                <button
                  onClick={() => setEditMode(true)}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1.5"
                >
                  <PencilSimple size={12} weight="bold" /> Editar
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditMode(false)}
                    disabled={editLoading}
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2 py-1 rounded hover:bg-muted"
                  >
                    <X size={12} weight="bold" /> Cancelar
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={editLoading}
                    className="text-xs font-bold text-white bg-primary hover:bg-primary/90 flex items-center gap-1.5 px-3 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    <Check size={12} weight="bold" /> {editLoading ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              )}
            </div>
            {!editMode ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                <InfoField label="Nombre">{lead.nombre}</InfoField>
                <InfoField label="Email">{lead.email}</InfoField>
                <InfoField label="Telefono">{lead.telefono || 'Sin telefono'}</InfoField>
                <InfoField label="Producto de interes">{lead.producto_nombre || lead.producto_interes || 'Sin producto'}</InfoField>
                <InfoField label="Gestor Asignado">{lead.responsable_nombre || 'Sin asignar'}</InfoField>
                <InfoField label="Fecha de solicitud">
                  {lead.fecha_solicitud ? new Date(lead.fecha_solicitud).toLocaleString('es-ES') : '--'}
                </InfoField>
                {lead.notas && (
                  <div className="sm:col-span-2">
                    <InfoField label="Notas">{lead.notas}</InfoField>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Nombre</p>
                  <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Email (no editable)</p>
                  <input value={lead.email} disabled className={inputClass + ' opacity-60 cursor-not-allowed'} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Telefono</p>
                  <input value={editTelefono} onChange={(e) => setEditTelefono(e.target.value)} className={inputClass} />
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Notas</p>
                  <textarea
                    value={editNotas}
                    onChange={(e) => setEditNotas(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-muted/50 text-sm outline-none resize-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            )}
          </div>

          {/* UTMs / Origen */}
          <div className="bg-card p-6 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <div className="flex items-center gap-3 mb-5">
              <h3 className="font-bold">Origen y UTMs</h3>
              {(utms?.canal_detectado || lead.origen) && (
                <ChannelBadge channel={utms?.canal_detectado || lead.origen} />
              )}
            </div>
            {utms ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                <InfoField label="UTM Source">{utms.utm_source || '--'}</InfoField>
                <InfoField label="UTM Medium">{utms.utm_medium || '--'}</InfoField>
                <InfoField label="UTM Campaign">{utms.utm_campaign || '--'}</InfoField>
                <InfoField label="UTM Content">{utms.utm_content || '--'}</InfoField>
                <InfoField label="UTM Term">{utms.utm_term || '--'}</InfoField>
                <InfoField label="Canal detectado">
                  <span className="font-semibold">{CANAL_LABELS[utms.canal_detectado] || utms.canal_detectado}</span>
                </InfoField>
                {utms.landing_url && (
                  <div className="sm:col-span-2">
                    <InfoField label="Landing URL">
                      <a
                        href={utms.landing_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-xs break-all"
                      >
                        {utms.landing_url}
                      </a>
                    </InfoField>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Este lead no tiene datos UTM registrados (canal: directo)</p>
            )}
          </div>

          {/* Interacciones */}
          <div className="bg-card p-6 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold">Interacciones ({interacciones.length})</h3>
              <button
                onClick={() => setInteractionOpen(true)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                + Nueva interaccion
              </button>
            </div>
            {interacciones.length === 0 ? (
              <div className="text-center py-8">
                <Phone size={32} className="text-muted-foreground/30 mx-auto mb-2" weight="duotone" />
                <p className="text-sm text-muted-foreground">No hay interacciones registradas</p>
                <button onClick={() => setInteractionOpen(true)} className="text-xs font-semibold text-primary hover:underline mt-2">
                  Registrar la primera interaccion
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {interacciones.map((inter, idx) => {
                  const Icon = INTERACTION_ICONS[inter.tipo] || Note;
                  const colorClass = INTERACTION_COLORS[inter.tipo] || 'text-zinc-600 bg-muted';
                  return (
                    <div key={inter.id || idx} className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/50">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                        <Icon size={16} weight="duotone" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[11px] font-bold uppercase text-muted-foreground">{inter.tipo}</span>
                          <span className="text-[11px] text-muted-foreground">&bull; {inter.fecha ? new Date(inter.fecha).toLocaleString('es-ES') : ''}</span>
                        </div>
                        <p className="text-[13px]">{inter.nota || <span className="text-muted-foreground italic">Sin nota</span>}</p>
                        {inter.created_by_nombre && <p className="text-[11px] text-muted-foreground mt-1">Por {inter.created_by_nombre}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Compras / Conversiones */}
          <div data-section="compras" className="bg-card p-6 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <CurrencyEur size={16} weight="duotone" /> Historial de compras
            </h3>
            <ConversionsTab
              lead={lead}
              projectId={lead.project_id}
              canManage={user?.role === 'admin' || user?.role === 'superadmin' || lead.responsable_id === user?.userId}
            />
          </div>

          {/* Recordatorios */}
          <div className="bg-card p-6 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold flex items-center gap-2">
                <CalendarCheck size={16} weight="duotone" /> Recordatorios ({reminders.length})
              </h3>
              <button
                onClick={() => setReminderOpen(true)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                + Nuevo recordatorio
              </button>
            </div>
            {reminders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No hay recordatorios programados</p>
            ) : (
              <div className="space-y-3">
                {reminders.map((rem) => (
                  <div
                    key={rem.id}
                    className={`p-4 rounded-xl border ${
                      rem.completado
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[11px] font-bold uppercase ${rem.completado ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                        {rem.completado ? 'Completado' : 'Pendiente'}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-semibold">
                        {rem.fecha_recordatorio ? new Date(rem.fecha_recordatorio).toLocaleDateString('es-ES') : ''}
                      </span>
                    </div>
                    {rem.nota && <p className="text-[13px]">{rem.nota}</p>}
                    {rem.created_by_nombre && <p className="text-[11px] text-muted-foreground mt-1">Por {rem.created_by_nombre}</p>}
                    {!rem.completado && (
                      <button
                        onClick={() => handleCompleteReminder(rem.id)}
                        className="mt-2 text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1"
                      >
                        <Check size={12} weight="bold" /> Marcar como completado
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Timeline sistema */}
          {timeline.length > 0 && (
            <div className="bg-card p-6 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
              <h3 className="font-bold mb-5">Historial del Sistema</h3>
              <div className="relative ml-1">
                <div className="absolute left-[4px] top-2 bottom-2 w-px bg-border" />
                {timeline.map((event, i) => (
                  <div key={event.id} className={`flex gap-4 relative ${i < timeline.length - 1 ? 'pb-5' : ''}`}>
                    <div className="w-[10px] h-[10px] rounded-full border-2 bg-card flex-shrink-0 mt-1.5 z-10" style={{ borderColor: event.color }} />
                    <div>
                      <p className="text-[13px] font-medium">{event.action}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{event.date} &bull; {event.source}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Cambiar Estado */}
          <div className="bg-card p-5 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="text-[13px] font-bold mb-3">Cambiar Estado</h3>
            <select value={selectedEstado} onChange={(e) => setSelectedEstado(e.target.value)} className={selectClass} style={selectBg}>
              {Object.entries(ESTADO_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button
              onClick={handleEstadoUpdate}
              disabled={statusLoading || selectedEstado === lead.estado}
              className="w-full h-10 mt-3 bg-primary text-white rounded-xl text-[13px] font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-40"
            >
              {statusLoading ? 'Guardando...' : selectedEstado === 'convertido' && lead.estado !== 'convertido' ? 'Convertir lead' : 'Actualizar'}
            </button>
          </div>

          {/* Acciones rapidas */}
          <div className="bg-card p-5 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="text-[13px] font-bold mb-3">Acciones rapidas</h3>
            <div className="space-y-2">
              <button
                onClick={() => setInteractionOpen(true)}
                className="w-full h-10 rounded-xl border border-border bg-card text-[13px] font-semibold hover:bg-muted transition-colors flex items-center justify-center gap-2"
              >
                <Phone size={14} weight="bold" /> Registrar interaccion
              </button>
              <button
                onClick={() => setReminderOpen(true)}
                className="w-full h-10 rounded-xl border border-border bg-card text-[13px] font-semibold hover:bg-muted transition-colors flex items-center justify-center gap-2"
              >
                <CalendarCheck size={14} weight="bold" /> Programar recordatorio
              </button>
              {isAdmin && (
                <button
                  onClick={() => setReassignOpen(true)}
                  className="w-full h-10 rounded-xl border border-border bg-card text-[13px] font-semibold hover:bg-muted transition-colors flex items-center justify-center gap-2"
                >
                  <Lightning size={14} weight="bold" /> Reasignar
                </button>
              )}
            </div>
          </div>

          {/* Stats rapidas */}
          <div className="bg-card p-5 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="text-[13px] font-bold mb-3">Resumen</h3>
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Interacciones</span>
                <span className="font-bold">{interacciones.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recordatorios</span>
                <span className="font-bold">{reminders.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cambios estado</span>
                <span className="font-bold">{(lead.statusHistory || []).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Canal</span>
                <span className="font-bold">{CANAL_LABELS[lead.origen] || lead.origen}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
