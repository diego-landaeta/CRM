import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, ArrowSquareOut, EnvelopeSimple, Phone, WhatsappLogo, Calendar,
  CalendarCheck, ClockCounterClockwise, ChatCircleText, Plus, CheckCircle,
} from '@phosphor-icons/react';
import Portal from '@/shared/components/ui/portal';
import StatusBadge, { STATUS_LABELS } from '@/shared/components/ui/StatusBadge';
import ChannelBadge from '@/shared/components/ui/ChannelBadge';
import { useLeadDetail } from '../hooks/useLeads';
import client from '@/shared/api/client';
import { toast } from '@/shared/hooks/useToast';

const EnrollSequenceModal = lazy(() => import('./EnrollSequenceModal'));

const TABS = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'historial', label: 'Historial' },
  { key: 'interacciones', label: 'Interacciones' },
  { key: 'recordatorios', label: 'Recordatorios' },
  { key: 'emails', label: 'Emails' },
];

function fmtDate(d: string | null | undefined): string {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '--';
  return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '??';
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

interface Props {
  leadId: number | string | null;
  open: boolean;
  onClose: () => void;
}

export default function LeadDrawer({ leadId, open, onClose }: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<string>('resumen');
  const [enrollOpen, setEnrollOpen] = useState(false);

  const { lead, timeline, interacciones, reminders, loading, error, refetch } = useLeadDetail(open ? leadId : null);

  // Reset tab al cambiar de lead
  useEffect(() => { if (open) setTab('resumen'); }, [open, leadId]);

  // Cerrar con Esc
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Portal>
      <div role="dialog" aria-label="Detalle de prospecto" aria-modal="true" className="fixed inset-0 z-[60]">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose} />

        <aside className="absolute top-0 right-0 h-full w-full max-w-[480px] bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          <header className="flex items-start justify-between p-5 border-b border-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm flex-shrink-0">
                {getInitials(lead?.nombre)}
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-base truncate">{loading ? 'Cargando…' : lead?.nombre || 'Prospecto'}</h2>
                <p className="text-xs text-muted-foreground truncate">{lead?.email || '--'}</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
              <X size={18} weight="bold" />
            </button>
          </header>

          <nav className="flex border-b border-border overflow-x-auto" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2.5 text-sm whitespace-nowrap transition-colors border-b-2 ${
                  tab === t.key
                    ? 'border-primary text-foreground font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
                {t.key === 'recordatorios' && reminders.length > 0 && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{reminders.length}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-y-auto p-5">
            {error && <p className="text-sm text-red-500">Error: {error}</p>}
            {loading && !lead && <p className="text-sm text-muted-foreground">Cargando datos...</p>}
            {lead && (
              <>
                {tab === 'resumen' && <ResumenTab lead={lead} onEnroll={() => setEnrollOpen(true)} />}
                {tab === 'historial' && <HistorialTab timeline={timeline} />}
                {tab === 'interacciones' && <InteraccionesTab leadId={lead.id} interacciones={interacciones} onRefetch={refetch} />}
                {tab === 'recordatorios' && <RecordatoriosTab leadId={lead.id} reminders={reminders} onRefetch={refetch} />}
                {tab === 'emails' && <EmailsTab leadId={lead.id} onEnroll={() => setEnrollOpen(true)} />}
              </>
            )}
          </div>

          <footer className="p-4 border-t border-border flex gap-2">
            <button
              onClick={() => { onClose(); navigate(`/leads/${leadId}`); }}
              className="flex-1 h-10 px-3 rounded-lg border border-border text-sm font-medium bg-secondary hover:bg-muted transition-colors flex items-center justify-center gap-2"
            >
              <ArrowSquareOut size={14} weight="bold" />
              Ver ficha completa
            </button>
            {lead?.email && (
              <a
                href={`mailto:${lead.email}`}
                className="flex-1 h-10 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <EnvelopeSimple size={14} weight="bold" />
                Email rápido
              </a>
            )}
          </footer>
        </aside>
      </div>

      <Suspense fallback={null}>
        <EnrollSequenceModal
          leadId={leadId}
          open={enrollOpen}
          onClose={() => setEnrollOpen(false)}
          onEnrolled={() => { setEnrollOpen(false); setTab('emails'); refetch(); }}
        />
      </Suspense>
    </Portal>
  );
}

function ResumenTab({ lead, onEnroll }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <StatusBadge status={lead.estado} />
        {lead.canal && <ChannelBadge channel={lead.canal} />}
      </div>

      <DataRow label="Teléfono" value={lead.telefono ? <a href={`tel:${lead.telefono}`} className="text-primary hover:underline">{lead.telefono}</a> : '--'} />
      <DataRow label="Email" value={lead.email || '--'} />
      <DataRow label="Producto interés" value={lead.producto_interes || '--'} />
      <DataRow label="País" value={lead.pais || '--'} />
      <DataRow label="Origen" value={lead.origen || '--'} />
      <DataRow label="Gestor" value={lead.responsable_nombre || lead.gestor || '--'} />
      <DataRow label="Creado" value={fmtDate(lead.created_at)} />
      {lead.notas && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Notas</p>
          <p className="text-sm whitespace-pre-wrap">{lead.notas}</p>
        </div>
      )}

      <button
        onClick={onEnroll}
        className="w-full h-10 rounded-lg bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors flex items-center justify-center gap-2"
      >
        <Plus size={14} weight="bold" />
        Enrolar en secuencia
      </button>
    </div>
  );
}

function DataRow({ label, value }) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
      <span className="text-sm text-right truncate">{value}</span>
    </div>
  );
}

function HistorialTab({ timeline }) {
  if (!timeline.length) return <p className="text-sm text-muted-foreground text-center py-6">Sin historial.</p>;
  return (
    <ol className="space-y-4">
      {timeline.map((ev) => (
        <li key={ev.id} className="flex gap-3">
          <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: ev.color }} />
          <div className="min-w-0 flex-1">
            <p className="text-sm">{ev.action}</p>
            <p className="text-xs text-muted-foreground">{ev.date} · {ev.source}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function InteraccionesTab({ leadId, interacciones, onRefetch }) {
  const [tipo, setTipo] = useState('llamada');
  const [nota, setNota] = useState('');
  const [loading, setLoading] = useState(false);

  async function add(e) {
    e.preventDefault();
    if (!nota.trim()) return;
    setLoading(true);
    try {
      await client.post(`/leads/${leadId}/interactions`, { tipo, nota });
      setNota('');
      toast({ title: 'Interacción registrada' });
      onRefetch();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  const ICON = { llamada: Phone, email: EnvelopeSimple, whatsapp: WhatsappLogo, nota: ChatCircleText };

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
        <div className="flex gap-2">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-9 px-2 rounded-md border border-border bg-card text-xs">
            <option value="llamada">Llamada</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="nota">Nota</option>
          </select>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Notas..."
            className="flex-1 h-9 px-3 rounded-md border border-border bg-card text-xs"
          />
          <button type="submit" disabled={loading} className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50">
            +
          </button>
        </div>
      </form>
      {interacciones.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Sin interacciones registradas.</p>
      ) : (
        <ol className="space-y-3">
          {interacciones.map((it) => {
            const Icon = ICON[it.tipo] || ChatCircleText;
            return (
              <li key={it.id} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0">
                  <Icon size={12} weight="regular" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{it.nota}</p>
                  <p className="text-xs text-muted-foreground">{fmtDateTime(it.fecha || it.created_at)} · {it.tipo}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function RecordatoriosTab({ leadId, reminders, onRefetch }) {
  const [fecha, setFecha] = useState('');
  const [nota, setNota] = useState('');
  const [loading, setLoading] = useState(false);

  async function add(e) {
    e.preventDefault();
    if (!fecha) return;
    setLoading(true);
    try {
      await client.post(`/leads/${leadId}/reminders`, { fecha_recordatorio: fecha, nota });
      setFecha(''); setNota('');
      toast({ title: 'Recordatorio creado' });
      onRefetch();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function complete(id) {
    try {
      await client.patch(`/leads/reminders/${id}/complete`);
      toast({ title: 'Recordatorio completado' });
      onRefetch();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
        <input
          type="datetime-local"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="w-full h-9 px-3 rounded-md border border-border bg-card text-xs"
        />
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Qué recordar (opcional)"
          className="w-full h-9 px-3 rounded-md border border-border bg-card text-xs"
        />
        <button type="submit" disabled={loading || !fecha} className="w-full h-9 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50">
          + Programar recordatorio
        </button>
      </form>
      {reminders.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Sin recordatorios programados.</p>
      ) : (
        <ol className="space-y-3">
          {reminders.map((r) => (
            <li key={r.id} className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CalendarCheck size={12} weight="regular" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{r.nota || 'Recordatorio'}</p>
                <p className="text-xs text-muted-foreground">{fmtDateTime(r.fecha_recordatorio)}</p>
              </div>
              {!r.completado && (
                <button
                  onClick={() => complete(r.id)}
                  title="Marcar completado"
                  className="p-1.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-950/40 text-muted-foreground hover:text-emerald-700"
                >
                  <CheckCircle size={14} weight="regular" />
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function EmailsTab({ leadId, onEnroll }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get(`/email-sequences/runs?leadId=${leadId}`);
      if (res.success) setRuns(res.data || []);
    } catch {} finally { setLoading(false); }
  }, [leadId]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  async function stop(runId) {
    try {
      await client.post(`/email-sequences/runs/${runId}/stop`);
      toast({ title: 'Secuencia detenida' });
      fetchRuns();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onEnroll}
        className="w-full h-10 rounded-lg bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors flex items-center justify-center gap-2"
      >
        <Plus size={14} weight="bold" />
        Enrolar en secuencia
      </button>

      {loading && <p className="text-sm text-muted-foreground text-center py-4">Cargando…</p>}
      {!loading && runs.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">No está enrolado en ninguna secuencia.</p>
      )}
      {runs.map((r) => {
        const totalSteps = Array.isArray(r.steps) ? r.steps.length : 0;
        const statusColor = {
          active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
          completed: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
          stopped: 'bg-muted text-muted-foreground',
        }[r.status] || 'bg-muted';
        return (
          <div key={r.id} className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{r.sequence_nombre}</p>
                <p className="text-xs text-muted-foreground">Paso {Math.min(r.current_step + 1, totalSteps)} de {totalSteps || '?'}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor}`}>{r.status}</span>
            </div>
            {r.next_send_at && r.status === 'active' && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ClockCounterClockwise size={12} /> Próximo envío: {fmtDateTime(r.next_send_at)}
              </p>
            )}
            {r.status === 'active' && (
              <button onClick={() => stop(r.id)} className="text-xs text-red-600 hover:underline">Detener</button>
            )}
          </div>
        );
      })}
    </div>
  );
}
