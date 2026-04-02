import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeadDetail } from '../hooks/useLeads';
import LeadFormDialog from '../components/LeadFormDialog';
import {
  ArrowLeft,
  PencilSimple,
  Trash,
  FileText,
  DownloadSimple,
} from '@phosphor-icons/react';

const ESTADO_STYLES = {
  nuevo: 'bg-blue-50 text-blue-600',
  contactado: 'bg-emerald-50 text-emerald-600',
  en_proceso: 'bg-amber-50 text-amber-600',
  convertido: 'bg-violet-50 text-violet-600',
  perdido: 'bg-red-50 text-red-600',
};

const ESTADO_LABELS = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  en_proceso: 'En proceso',
  convertido: 'Convertido',
  perdido: 'Perdido',
};

const AVATAR_COLORS = [
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
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

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lead, timeline, loading } = useLeadDetail(id);
  const [editOpen, setEditOpen] = useState(false);

  async function handleEditLead(data) {
    // TODO: llamar API real — PATCH /api/leads/:id
    console.log('Editar lead:', id, data);
    await new Promise((r) => setTimeout(r, 500));
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

      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/leads')}
          className="text-primary text-sm font-semibold flex items-center gap-1.5 mb-4 hover:underline"
        >
          <ArrowLeft size={14} weight="bold" /> Volver a Leads
        </button>
        <div className="flex items-center justify-between">
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
      <div className="grid grid-cols-3 gap-6">
        {/* Left: Info + Timeline */}
        <div className="col-span-2 space-y-5">
          <div className="bg-card p-6 rounded-3xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="font-bold mb-5">Informacion del Lead</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-5">
              <InfoField label="Email">{lead.email}</InfoField>
              <InfoField label="Telefono">{lead.telefono}</InfoField>
              <InfoField label="Origen">
                <span className="bg-muted text-zinc-600 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase">
                  {lead.origen}
                </span>
              </InfoField>
              <InfoField label="Campana">{lead.campana || 'Sin campana'}</InfoField>
              <InfoField label="UTM Source / Medium">{lead.utm_source} / {lead.utm_medium}</InfoField>
              <InfoField label="Gestor Asignado">{lead.gestor}</InfoField>
            </div>
          </div>

          <div className="bg-card p-6 rounded-3xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="font-bold mb-5">Historial de Actividad</h3>
            <div className="relative ml-1">
              <div className="absolute left-[4px] top-2 bottom-2 w-px bg-border" />
              {timeline.map((event, i) => (
                <div key={event.id} className={`flex gap-4 relative ${i < timeline.length - 1 ? 'pb-5' : ''}`}>
                  <div
                    className="w-[10px] h-[10px] rounded-full border-2 bg-card flex-shrink-0 mt-1.5 z-10"
                    style={{ borderColor: event.color }}
                  />
                  <div>
                    <p className="text-[13px] font-medium">{event.action}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{event.date} &bull; {event.source}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="space-y-4">
          <div className="bg-card p-5 rounded-3xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="text-[13px] font-bold mb-3">Cambiar Estado</h3>
            <select
              defaultValue={lead.estado}
              className="w-full h-11 px-4 pr-9 rounded-xl border border-border bg-muted/50 text-sm outline-none appearance-none cursor-pointer focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
            >
              {Object.entries(ESTADO_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button className="w-full h-10 mt-3 bg-primary text-white rounded-xl text-[13px] font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
              Actualizar
            </button>
          </div>

          <div className="bg-card p-5 rounded-3xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="text-[13px] font-bold mb-3">Reasignar Gestor</h3>
            <select
              defaultValue={lead.gestor}
              className="w-full h-11 px-4 pr-9 rounded-xl border border-border bg-muted/50 text-sm outline-none appearance-none cursor-pointer focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
            >
              <option>Diego R.</option>
              <option>Angel M.</option>
            </select>
            <button className="w-full h-10 mt-3 rounded-xl border border-border bg-card text-[13px] font-semibold hover:bg-muted transition-colors">
              Reasignar
            </button>
          </div>

          <div className="bg-card p-5 rounded-3xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="text-[13px] font-bold mb-3">Notas</h3>
            <textarea
              placeholder="Agregar una nota..."
              className="w-full h-24 px-4 py-3 rounded-xl border border-border bg-muted/50 text-sm outline-none resize-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground"
            />
            <button className="w-full h-10 mt-3 rounded-xl border border-border bg-card text-[13px] font-semibold hover:bg-muted transition-colors">
              Guardar Nota
            </button>
          </div>

          <div className="bg-card p-5 rounded-3xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="text-[13px] font-bold mb-3">Dossier</h3>
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-blue-50">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <FileText size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate">Dossier Psiko v2.pdf</p>
                <p className="text-[10px] text-muted-foreground">Enviado {lead.fecha}</p>
              </div>
              <button className="text-primary hover:text-primary/90 transition-colors flex-shrink-0">
                <DownloadSimple size={18} weight="bold" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
