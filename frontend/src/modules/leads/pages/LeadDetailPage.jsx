import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeadDetail } from '../hooks/useLeads';
import LeadFormDialog from '../components/LeadFormDialog';
import ConversionDialog from '../components/ConversionDialog';
import { toast } from '@/shared/hooks/useToast';
import { useProjectContext } from '@/contexts/ProjectContext';
import { USERS } from '@/shared/data/mock';
import {
  ArrowLeft,
  PencilSimple,
  Trash,
  FileText,
  DownloadSimple,
  Phone,
  EnvelopeSimple,
  WhatsappLogo,
  Note,
  CalendarCheck,
  WarningCircle,
  Copy,
  CheckCircle,
  Clock,
} from '@phosphor-icons/react';

const ESTADO_STYLES = {
  nuevo: 'bg-blue-50 text-blue-600',
  por_contactar: 'bg-orange-50 text-orange-600',
  contactado: 'bg-emerald-50 text-emerald-600',
  en_seguimiento: 'bg-amber-50 text-amber-600',
  convertido: 'bg-violet-50 text-violet-600',
  no_interesado: 'bg-red-50 text-red-600',
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
  llamada: 'text-blue-600 bg-blue-50',
  email: 'text-emerald-600 bg-emerald-50',
  whatsapp: 'text-green-600 bg-green-50',
  nota: 'text-amber-600 bg-amber-50',
};

const AVATAR_COLORS = [
  'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
];

function getInitials(name) {
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
  const { activeProject } = useProjectContext();
  const { lead, timeline, interacciones, recordatorio, loading } = useLeadDetail(id);
  const [editOpen, setEditOpen] = useState(false);
  const [conversionOpen, setConversionOpen] = useState(false);
  const [selectedEstado, setSelectedEstado] = useState(lead?.estado || 'nuevo');

  const gestoresProyecto = USERS.filter((u) => u.projects.includes(activeProject.id));

  async function handleEditLead(data) {
    console.log('Editar lead:', id, data);
    await new Promise((r) => setTimeout(r, 500));
    toast({ title: 'Lead actualizado', description: 'Los cambios se han guardado' });
  }

  function handleEstadoUpdate() {
    if (selectedEstado === 'convertido') {
      setConversionOpen(true);
    } else {
      toast({ title: 'Estado actualizado', description: `Cambiado a ${ESTADO_LABELS[selectedEstado]}` });
    }
  }

  async function handleConversion(data) {
    console.log('Conversion registrada:', data);
    await new Promise((r) => setTimeout(r, 500));
    toast({ title: 'Conversion registrada', description: `${data.producto_contratado} — ${data.importe_total} €` });
  }

  if (loading) return <div className="py-20 text-center text-muted-foreground">Cargando...</div>;

  if (!lead) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground mb-4">Lead no encontrado</p>
        <button onClick={() => navigate('/leads')} className="text-sm font-semibold text-primary hover:underline">
          Volver a Leads
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LeadFormDialog open={editOpen} onClose={() => setEditOpen(false)} lead={lead} onSubmit={handleEditLead} />
      <ConversionDialog open={conversionOpen} onClose={() => setConversionOpen(false)} lead={lead} onSubmit={handleConversion} />

      {/* Alerta duplicado */}
      {lead.lead_duplicado_de && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800">
          <WarningCircle size={20} weight="duotone" className="flex-shrink-0" />
          <div className="text-sm">
            <span className="font-bold">Lead duplicado</span> — Este email ya existe en el sistema (Lead #{lead.lead_duplicado_de}).
            Los historiales estan vinculados.
          </div>
        </div>
      )}

      {/* Alerta dias sin actualizar */}
      {lead.dias_sin_actualizar > 3 && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800">
          <Clock size={20} weight="duotone" className="flex-shrink-0" />
          <div className="text-sm">
            <span className="font-bold">{lead.dias_sin_actualizar} dias sin actualizar</span> — Este lead requiere atencion urgente.
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
              <p className="text-muted-foreground text-sm">Lead #{lead.id} &bull; {lead.fecha}</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${ESTADO_STYLES[lead.estado]}`}>
              {ESTADO_LABELS[lead.estado]}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors">
              <PencilSimple size={14} /> Editar
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors">
              <Trash size={14} /> Eliminar
            </button>
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
              <InfoField label="Telefono">{lead.telefono}</InfoField>
              <InfoField label="Producto de interes">{lead.producto_interes || 'Sin producto'}</InfoField>
              <InfoField label="Origen">
                <span className="bg-muted text-muted-foreground px-2.5 py-1 rounded-full text-[10px] font-bold uppercase">{lead.origen}</span>
              </InfoField>
              <InfoField label="Campana">{lead.campana || 'Sin campana'}</InfoField>
              <InfoField label="Landing URL">
                <span className="text-xs text-muted-foreground truncate block">{lead.landing_url}</span>
              </InfoField>
              <InfoField label="UTM Source / Medium / Campaign">
                {lead.utm_source} / {lead.utm_medium}{lead.utm_campaign ? ` / ${lead.utm_campaign}` : ''}
              </InfoField>
              <InfoField label="Gestor Asignado">{lead.gestor}</InfoField>
              <InfoField label="Dossier Enviado">
                {lead.dossier_enviado
                  ? <span className="flex items-center gap-1.5 text-emerald-600"><CheckCircle size={14} weight="duotone" /> Si — {lead.dossier_enviado_at}</span>
                  : <span className="text-muted-foreground">No enviado</span>
                }
              </InfoField>
              {lead.notas && <InfoField label="Notas">{lead.notas}</InfoField>}
            </div>
          </div>

          {/* Interacciones */}
          <div className="bg-card p-6 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold">Interacciones ({interacciones.length})</h3>
              <button
                onClick={() => toast({ title: 'Interaccion registrada' })}
                className="text-xs font-semibold text-primary hover:underline"
              >
                + Nueva interaccion
              </button>
            </div>
            {interacciones.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No hay interacciones registradas.</p>
            ) : (
              <div className="space-y-3">
                {interacciones.map((inter) => {
                  const Icon = INTERACTION_ICONS[inter.tipo] || Note;
                  const colorClass = INTERACTION_COLORS[inter.tipo] || 'text-zinc-600 bg-muted';
                  return (
                    <div key={inter.id} className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/50">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                        <Icon size={16} weight="duotone" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[11px] font-bold uppercase text-muted-foreground">{inter.tipo}</span>
                          <span className="text-[11px] text-muted-foreground">&bull; {inter.fecha}</span>
                        </div>
                        <p className="text-[13px]">{inter.nota}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">Por {inter.created_by}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Timeline sistema */}
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
              className="w-full h-10 mt-3 bg-primary text-white rounded-xl text-[13px] font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              {selectedEstado === 'convertido' && lead.estado !== 'convertido' ? 'Convertir lead' : 'Actualizar'}
            </button>
          </div>

          {/* Reasignar Gestor */}
          <div className="bg-card p-5 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="text-[13px] font-bold mb-3">Reasignar Gestor</h3>
            <select defaultValue={lead.gestor} className={selectClass} style={selectBg}>
              {gestoresProyecto.map((u) => (
                <option key={u.id} value={u.nombre}>{u.nombre} ({u.role})</option>
              ))}
            </select>
            <button
              onClick={() => toast({ title: 'Gestor reasignado' })}
              className="w-full h-10 mt-3 rounded-xl border border-border bg-card text-[13px] font-semibold hover:bg-muted transition-colors"
            >
              Reasignar
            </button>
          </div>

          {/* Recordatorio */}
          <div className="bg-card p-5 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="text-[13px] font-bold mb-3 flex items-center gap-2">
              <CalendarCheck size={15} weight="duotone" /> Recordatorio
            </h3>
            {recordatorio ? (
              <div className={`p-3 rounded-xl text-sm ${recordatorio.completado ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[12px]">{recordatorio.fecha}</span>
                  <span className={`text-[10px] font-bold uppercase ${recordatorio.completado ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {recordatorio.completado ? 'Completado' : 'Pendiente'}
                  </span>
                </div>
                <p className="text-[13px]">{recordatorio.nota}</p>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground mb-2">Sin recordatorio programado</p>
            )}
            <button
              onClick={() => toast({ title: 'Recordatorio programado' })}
              className="w-full h-10 mt-3 rounded-xl border border-border bg-card text-[13px] font-semibold hover:bg-muted transition-colors"
            >
              {recordatorio ? 'Editar recordatorio' : 'Programar recordatorio'}
            </button>
          </div>

          {/* Notas */}
          <div className="bg-card p-5 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="text-[13px] font-bold mb-3">Agregar Nota</h3>
            <textarea
              placeholder="Escribe una nota sobre este lead..."
              className="w-full h-24 px-4 py-3 rounded-xl border border-border bg-muted/50 text-sm outline-none resize-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground"
            />
            <button
              onClick={() => toast({ title: 'Nota guardada' })}
              className="w-full h-10 mt-3 rounded-xl border border-border bg-card text-[13px] font-semibold hover:bg-muted transition-colors"
            >
              Guardar Nota
            </button>
          </div>

          {/* Dossier */}
          <div className="bg-card p-5 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="text-[13px] font-bold mb-3">Dossier del Producto</h3>
            {lead.producto_interes ? (
              <>
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                    <FileText size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate">Dossier {lead.producto_interes}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {lead.dossier_enviado ? `Enviado ${lead.dossier_enviado_at}` : 'No enviado aun'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => toast({ title: 'Enlace copiado' })}
                      className="text-primary hover:text-primary/90 transition-colors p-1"
                      title="Copiar enlace"
                    >
                      <Copy size={16} weight="bold" />
                    </button>
                    <button className="text-primary hover:text-primary/90 transition-colors p-1" title="Descargar">
                      <DownloadSimple size={16} weight="bold" />
                    </button>
                  </div>
                </div>
                {!lead.dossier_enviado && (
                  <button
                    onClick={() => toast({ title: 'Dossier marcado como enviado' })}
                    className="w-full h-10 mt-3 bg-primary text-white rounded-xl text-[13px] font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Marcar como enviado
                  </button>
                )}
              </>
            ) : (
              <p className="text-[13px] text-muted-foreground">Este lead no tiene producto de interes asignado.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
