import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeads } from '../hooks/useLeads';
import LeadFormDialog from '../components/LeadFormDialog';
import { toast } from '@/shared/hooks/useToast';
import { Plus, User, Phone, EnvelopeSimple, Clock, DotsSixVertical } from '@phosphor-icons/react';

const COLUMNS = [
  { key: 'nuevo', label: 'Nuevo', color: '#4361ee', bg: 'bg-blue-50 dark:bg-blue-950/30', dot: 'bg-blue-500' },
  { key: 'por_contactar', label: 'Por contactar', color: '#ea580c', bg: 'bg-orange-50 dark:bg-orange-950/30', dot: 'bg-orange-500' },
  { key: 'contactado', label: 'Contactado', color: '#059669', bg: 'bg-emerald-50 dark:bg-emerald-950/30', dot: 'bg-emerald-500' },
  { key: 'en_seguimiento', label: 'En seguimiento', color: '#d97706', bg: 'bg-amber-50 dark:bg-amber-950/30', dot: 'bg-amber-500' },
  { key: 'convertido', label: 'Convertido', color: '#7c3aed', bg: 'bg-violet-50 dark:bg-violet-950/30', dot: 'bg-violet-500' },
  { key: 'no_interesado', label: 'No interesado', color: '#dc2626', bg: 'bg-red-50 dark:bg-red-950/30', dot: 'bg-red-500' },
];

const AVATAR_COLORS = [
  'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700', 'bg-teal-100 text-teal-700',
];

function getInitials(name) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

function LeadCard({ lead, onClick, onDragStart }) {
  const hasAlert = lead.dias_sin_actualizar > 3;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      onClick={() => onClick(lead.id)}
      className={`bg-card border border-border rounded-2xl p-4 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group ${hasAlert ? 'ring-2 ring-red-200 dark:ring-red-800' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold ${AVATAR_COLORS[lead.id % AVATAR_COLORS.length]}`}>
            {getInitials(lead.nombre)}
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-tight">{lead.nombre}</p>
            <p className="text-[11px] text-muted-foreground">{lead.email}</p>
          </div>
        </div>
        <DotsSixVertical size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
      </div>

      {lead.producto_interes && (
        <p className="text-[11px] text-muted-foreground bg-muted rounded-lg px-2.5 py-1 mb-2 truncate">
          {lead.producto_interes}
        </p>
      )}

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <User size={11} /> {lead.gestor.split(' ')[0]}
          </span>
          <span>{formatDate(lead.fecha)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {lead.dossier_enviado && (
            <span className="w-4 h-4 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center" title="Dossier enviado">
              <EnvelopeSimple size={10} />
            </span>
          )}
          {lead.interacciones?.length > 0 && (
            <span className="w-4 h-4 rounded bg-blue-100 text-blue-600 flex items-center justify-center" title={`${lead.interacciones.length} interacciones`}>
              <Phone size={10} />
            </span>
          )}
          {hasAlert && (
            <span className="w-4 h-4 rounded bg-red-100 text-red-600 flex items-center justify-center" title={`${lead.dias_sin_actualizar} dias sin actualizar`}>
              <Clock size={10} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LeadsPipelinePage() {
  const navigate = useNavigate();
  const { leads: allLeads, stats, search, setSearch } = useLeads();
  const [formOpen, setFormOpen] = useState(false);
  const [dragLead, setDragLead] = useState(null);

  // Usa todos los leads sin paginar para el pipeline
  const { leads: fullLeads } = useLeads();

  // Agrupa leads por estado
  const grouped = {};
  for (const col of COLUMNS) {
    grouped[col.key] = [];
  }
  for (const lead of fullLeads) {
    if (grouped[lead.estado]) {
      grouped[lead.estado].push(lead);
    }
  }

  function handleDragStart(e, lead) {
    setDragLead(lead);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e, targetEstado) {
    e.preventDefault();
    if (dragLead && dragLead.estado !== targetEstado) {
      toast({
        title: 'Estado actualizado',
        description: `${dragLead.nombre} movido a "${COLUMNS.find(c => c.key === targetEstado)?.label}"`,
      });
    }
    setDragLead(null);
  }

  async function handleCreateLead(data) {
    console.log('Nuevo lead:', data);
    await new Promise((r) => setTimeout(r, 500));
    toast({ title: 'Lead creado', description: 'El lead se ha registrado correctamente' });
  }

  return (
    <div className="space-y-5">
      <LeadFormDialog open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleCreateLead} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Pipeline de Leads</h1>
          <p className="text-muted-foreground text-sm">Vista Kanban — arrastra para cambiar estado</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/leads')}
            className="px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            Vista tabla
          </button>
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            <Plus size={16} weight="bold" /> Nuevo Lead
          </button>
        </div>
      </div>

      {/* Pipeline columns */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 lg:mx-0 lg:px-0">
        {COLUMNS.map((col) => {
          const colLeads = grouped[col.key] || [];
          return (
            <div
              key={col.key}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.key)}
              className="flex-shrink-0 w-[280px] flex flex-col"
            >
              {/* Column header */}
              <div className={`rounded-2xl px-4 py-3 mb-3 ${col.bg}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                    <span className="text-[13px] font-bold">{col.label}</span>
                  </div>
                  <span className="text-[12px] font-bold bg-card border border-border rounded-lg px-2 py-0.5">
                    {colLeads.length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="space-y-2.5 flex-1 min-h-[200px]">
                {colLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onClick={(id) => navigate(`/leads/${id}`)}
                    onDragStart={handleDragStart}
                  />
                ))}
                {colLeads.length === 0 && (
                  <div className="border-2 border-dashed border-border rounded-2xl p-6 text-center text-[13px] text-muted-foreground">
                    Sin leads
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
