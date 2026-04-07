import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeadDetail } from '../hooks/useLeads';
import ConversionDialog from '../components/ConversionDialog';
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
  Copy,
  CheckCircle,
  Clock,
  FileText,
  DownloadSimple,
  Users,
} from '@phosphor-icons/react';

const ESTADO_STYLES = {
  nuevo: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
  por_contactar: 'bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400',
  contactado: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
  en_seguimiento: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
  convertido: 'bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400',
  no_interesado: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
};

const ESTADO_LABELS = {
  nuevo: 'Nuevo',
  por_contactar: 'Por contactar',
  contactado: 'Contactado',
  en_seguimiento: 'En seguimiento',
  convertido: 'Convertido',
  no_interesado: 'No interesado',
};

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
      <div className="text-[13px] font-medium">{children}</div>
    </div>
  );
}

const selectClass = "w-full h-11 px-4 pr-9 rounded-xl border border-border bg-muted/50 text-sm outline-none appearance-none cursor-pointer focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all";
const selectBg = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' };

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    lead, timeline, interacciones, recordatorio, loading, error,
    updateStatus, addInteraction, addReminder, completeReminder, reassign,
  } = useLeadDetail(id);

  const [conversionOpen, setConversionOpen] = useState(false);
  const [lossOpen, setLossOpen] = useState(false);
  const [lossReason, setLossReason] = useState('');
  const [selectedEstado, setSelectedEstado] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);

  // Interaccion form
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [interactionTipo, setInteractionTipo] = useState('llamada');
  const [interactionNota, setInteractionNota] = useState('');
  const [interactionLoading, setInteractionLoading] = useState(false);

  // Reminder form
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderFecha, setReminderFecha] = useState('');
  const [reminderNota, setReminderNota] = useState('');
  const [reminderLoading, setReminderLoading] = useState(false);

  // Nota rapida
  const [nota, setNota] = useState('');
  const [notaLoading, setNotaLoading] = useState(false);

  // Reasignar
  const [reassignId, setReassignId] = useState('');
  const [reassignLoading, setReassignLoading] = useState(false);
  const [gestores, setGestores] = useState([]);

  // Cargar gestores al montar (si admin+)
  useState(() => {
    if (user?.role === 'superadmin' || user?.role === 'admin') {
      client.get('/users?limit=100').then((res) => {
        if (res.success) setGestores(res.data || []);
      }).catch(() => {});
    }
  });

  // Sincronizar selectedEstado cuando lead cambia
  if (lead && !selectedEstado) {
    setSelectedEstado(lead.estado);
  }

  async function handleEstadoUpdate() {
    if (!selectedEstado || selectedEstado === lead.estado) return;

    if (selectedEstado === 'convertido') {
      setConversionOpen(true);
      return;
    }
    if (selectedEstado === 'no_interesado') {
      setLossOpen(true);
      return;
    }

    setStatusLoading(true);
    try {
      await updateStatus(selectedEstado);
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
    if (!interactionNota.trim()) return;
    setInteractionLoading(true);
    try {
      await addInteraction(interactionTipo, interactionNota);
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
    if (!reminderFecha || !reminderNota.trim()) return;
    setReminderLoading(true);
    try {
      await addReminder(reminderFecha, reminderNota);
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

  async function handleAddNota() {
    if (!nota.trim()) return;
    setNotaLoading(true);
    try {
      await addInteraction('nota', nota);
      toast({ title: 'Nota guardada' });
      setNota('');
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setNotaLoading(false);
    }
  }

  async function handleReassign() {
    if (!reassignId) return;
    setReassignLoading(true);
    try {
      await reassign(Number(reassignId));
      toast({ title: 'Gestor reasignado' });
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

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <div className="w-24 h-4 bg-muted rounded animate-pulse" />
        </div>
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
        <Users size={48} className="text-muted-foreground/30 mx-auto mb-4" weight="duotone" />
        <p className="text-muted-foreground mb-2">{error || 'Lead no encontrado'}</p>
        <button onClick={() => navigate('/leads')} className="text-sm font-semibold text-primary hover:underline">
          Volver a Leads
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConversionDialog open={conversionOpen} onClose={() => setConversionOpen(false)} lead={lead} onSubmit={async (data) => {
        await updateStatus('convertido');
        toast({ title: 'Conversion registrada', description: `${data.producto_contratado} — ${data.importe_total} EUR` });
      }} />

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
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Nota *</label>
                  <textarea
                    value={interactionNota}
                    onChange={(e) => setInteractionNota(e.target.value)}
                    placeholder="Describe la interaccion..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-muted/50 text-sm outline-none resize-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground"
                    required
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
                    type="datetime-local"
                    value={reminderFecha}
                    onChange={(e) => setReminderFecha(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-muted/50 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Nota *</label>
                  <textarea
                    value={reminderNota}
                    onChange={(e) => setReminderNota(e.target.value)}
                    placeholder="Que hay que recordar..."
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-muted/50 text-sm outline-none resize-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground"
                    required
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
          <div className="text-sm">
            <span className="font-bold">Lead duplicado</span> — Este email ya existe en el sistema (Lead #{lead.lead_duplicado_de}).
          </div>
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
              <p className="text-muted-foreground text-sm">Lead #{lead.id} &bull; {new Date(lead.created_at || lead.fecha).toLocaleDateString('es-ES')}</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${ESTADO_STYLES[lead.estado] || 'bg-muted text-muted-foreground'}`}>
              {ESTADO_LABELS[lead.estado] || lead.estado}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Info del Lead */}
          <div className="bg-card p-6 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="font-bold mb-5">Informacion del Lead</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              <InfoField label="Email">{lead.email}</InfoField>
              <InfoField label="Telefono">{lead.telefono || 'Sin telefono'}</InfoField>
              <InfoField label="Producto de interes">{lead.producto_interes || 'Sin producto'}</InfoField>
              <InfoField label="Pais">{lead.pais || 'Sin especificar'}</InfoField>
              <InfoField label="Origen">
                <span className="bg-muted text-muted-foreground px-2.5 py-1 rounded-full text-[10px] font-bold uppercase">{lead.origen}</span>
              </InfoField>
              <InfoField label="Gestor Asignado">{lead.responsable_nombre || lead.gestor || 'Sin asignar'}</InfoField>
              {lead.utm_source && (
                <InfoField label="UTM Source / Medium">
                  {lead.utm_source}{lead.utm_medium ? ` / ${lead.utm_medium}` : ''}
                </InfoField>
              )}
              {lead.utm_campaign && <InfoField label="UTM Campaign">{lead.utm_campaign}</InfoField>}
              {lead.landing_url && (
                <InfoField label="Landing URL">
                  <span className="text-xs text-muted-foreground truncate block">{lead.landing_url}</span>
                </InfoField>
              )}
              {lead.notas && <InfoField label="Notas">{lead.notas}</InfoField>}
            </div>
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
                          <span className="text-[11px] text-muted-foreground">&bull; {new Date(inter.created_at || inter.fecha).toLocaleDateString('es-ES')}</span>
                        </div>
                        <p className="text-[13px]">{inter.nota}</p>
                        {inter.created_by_name && <p className="text-[11px] text-muted-foreground mt-1">Por {inter.created_by_name}</p>}
                      </div>
                    </div>
                  );
                })}
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

          {/* Reasignar Gestor */}
          {(user?.role === 'superadmin' || user?.role === 'admin') && gestores.length > 0 && (
            <div className="bg-card p-5 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
              <h3 className="text-[13px] font-bold mb-3">Reasignar Gestor</h3>
              <select value={reassignId} onChange={(e) => setReassignId(e.target.value)} className={selectClass} style={selectBg}>
                <option value="">Seleccionar gestor</option>
                {gestores.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre} ({u.role})</option>
                ))}
              </select>
              <button
                onClick={handleReassign}
                disabled={!reassignId || reassignLoading}
                className="w-full h-10 mt-3 rounded-xl border border-border bg-card text-[13px] font-semibold hover:bg-muted transition-colors disabled:opacity-40"
              >
                {reassignLoading ? 'Guardando...' : 'Reasignar'}
              </button>
            </div>
          )}

          {/* Recordatorio */}
          <div className="bg-card p-5 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="text-[13px] font-bold mb-3 flex items-center gap-2">
              <CalendarCheck size={15} weight="duotone" /> Recordatorio
            </h3>
            {recordatorio ? (
              <div className={`p-3 rounded-xl text-sm ${recordatorio.completado ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[12px]">
                    {new Date(recordatorio.fecha_recordatorio || recordatorio.fecha).toLocaleDateString('es-ES')}
                  </span>
                  <span className={`text-[10px] font-bold uppercase ${recordatorio.completado ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {recordatorio.completado ? 'Completado' : 'Pendiente'}
                  </span>
                </div>
                <p className="text-[13px]">{recordatorio.nota}</p>
                {!recordatorio.completado && recordatorio.id && (
                  <button
                    onClick={() => handleCompleteReminder(recordatorio.id)}
                    className="mt-2 text-xs font-semibold text-emerald-600 hover:underline"
                  >
                    Marcar como completado
                  </button>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground mb-2">Sin recordatorio programado</p>
            )}
            <button
              onClick={() => setReminderOpen(true)}
              className="w-full h-10 mt-3 rounded-xl border border-border bg-card text-[13px] font-semibold hover:bg-muted transition-colors"
            >
              {recordatorio ? 'Nuevo recordatorio' : 'Programar recordatorio'}
            </button>
          </div>

          {/* Notas */}
          <div className="bg-card p-5 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="text-[13px] font-bold mb-3">Agregar Nota</h3>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Escribe una nota sobre este lead..."
              className="w-full h-24 px-4 py-3 rounded-xl border border-border bg-muted/50 text-sm outline-none resize-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground"
            />
            <button
              onClick={handleAddNota}
              disabled={!nota.trim() || notaLoading}
              className="w-full h-10 mt-3 rounded-xl border border-border bg-card text-[13px] font-semibold hover:bg-muted transition-colors disabled:opacity-40"
            >
              {notaLoading ? 'Guardando...' : 'Guardar Nota'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
