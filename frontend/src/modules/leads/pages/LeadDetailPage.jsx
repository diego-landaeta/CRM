import { useParams, useNavigate } from 'react-router-dom';
import { useLeadDetail } from '../hooks/useLeads';
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
      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{label}</p>
      <div className="text-[13px] font-medium">{children}</div>
    </div>
  );
}

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lead, timeline, loading } = useLeadDetail(id);

  if (loading) return <div className="py-20 text-center text-zinc-400">Cargando...</div>;

  if (!lead) {
    return (
      <div className="py-20 text-center">
        <p className="text-zinc-500 mb-4">Lead no encontrado</p>
        <button onClick={() => navigate('/leads')} className="text-sm font-semibold text-[#4361ee] hover:underline">
          Volver a Leads
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/leads')}
          className="text-[#4361ee] text-sm font-semibold flex items-center gap-1.5 mb-4 hover:underline"
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
              <p className="text-zinc-500 text-sm">Lead #{lead.id} &bull; {lead.fecha}</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${ESTADO_STYLES[lead.estado]}`}>
              {ESTADO_LABELS[lead.estado]}
            </span>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-medium hover:bg-zinc-50 transition-colors">
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
          <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="font-bold mb-5">Informacion del Lead</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-5">
              <InfoField label="Email">{lead.email}</InfoField>
              <InfoField label="Telefono">{lead.telefono}</InfoField>
              <InfoField label="Origen">
                <span className="bg-zinc-100 text-zinc-600 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase">
                  {lead.origen}
                </span>
              </InfoField>
              <InfoField label="Campana">{lead.campana || 'Sin campana'}</InfoField>
              <InfoField label="UTM Source / Medium">{lead.utm_source} / {lead.utm_medium}</InfoField>
              <InfoField label="Gestor Asignado">{lead.gestor}</InfoField>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="font-bold mb-5">Historial de Actividad</h3>
            <div className="relative ml-1">
              <div className="absolute left-[4px] top-2 bottom-2 w-px bg-zinc-200" />
              {timeline.map((event, i) => (
                <div key={event.id} className={`flex gap-4 relative ${i < timeline.length - 1 ? 'pb-5' : ''}`}>
                  <div
                    className="w-[10px] h-[10px] rounded-full border-2 bg-white flex-shrink-0 mt-1.5 z-10"
                    style={{ borderColor: event.color }}
                  />
                  <div>
                    <p className="text-[13px] font-medium">{event.action}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{event.date} &bull; {event.source}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-zinc-100 shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="text-[13px] font-bold mb-3">Cambiar Estado</h3>
            <select
              defaultValue={lead.estado}
              className="w-full h-11 px-4 pr-9 rounded-xl border border-zinc-200 bg-zinc-50/50 text-sm outline-none appearance-none cursor-pointer focus:border-[#4361ee] focus:ring-4 focus:ring-[#4361ee]/10 transition-all"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
            >
              {Object.entries(ESTADO_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button className="w-full h-10 mt-3 bg-[#4361ee] text-white rounded-xl text-[13px] font-semibold hover:bg-[#3a56d4] transition-colors shadow-lg shadow-[#4361ee]/20">
              Actualizar
            </button>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-zinc-100 shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="text-[13px] font-bold mb-3">Reasignar Gestor</h3>
            <select
              defaultValue={lead.gestor}
              className="w-full h-11 px-4 pr-9 rounded-xl border border-zinc-200 bg-zinc-50/50 text-sm outline-none appearance-none cursor-pointer focus:border-[#4361ee] focus:ring-4 focus:ring-[#4361ee]/10 transition-all"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
            >
              <option>Diego R.</option>
              <option>Angel M.</option>
            </select>
            <button className="w-full h-10 mt-3 rounded-xl border border-zinc-200 bg-white text-[13px] font-semibold hover:bg-zinc-50 transition-colors">
              Reasignar
            </button>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-zinc-100 shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="text-[13px] font-bold mb-3">Notas</h3>
            <textarea
              placeholder="Agregar una nota..."
              className="w-full h-24 px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50/50 text-sm outline-none resize-none transition-all focus:border-[#4361ee] focus:ring-4 focus:ring-[#4361ee]/10 focus:bg-white placeholder:text-zinc-400"
            />
            <button className="w-full h-10 mt-3 rounded-xl border border-zinc-200 bg-white text-[13px] font-semibold hover:bg-zinc-50 transition-colors">
              Guardar Nota
            </button>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-zinc-100 shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <h3 className="text-[13px] font-bold mb-3">Dossier</h3>
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-blue-50">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <FileText size={18} className="text-[#4361ee]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate">Dossier Psiko v2.pdf</p>
                <p className="text-[10px] text-zinc-400">Enviado {lead.fecha}</p>
              </div>
              <button className="text-[#4361ee] hover:text-[#3a56d4] transition-colors flex-shrink-0">
                <DownloadSimple size={18} weight="bold" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
