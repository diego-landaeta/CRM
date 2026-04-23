import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectContext } from '@/contexts/ProjectContext';
import client from '@/shared/api/client';
import LeadFormDialog from '../components/LeadFormDialog';
import { toast } from '@/shared/hooks/useToast';
import { Plus, User, DotsSixVertical, Users } from '@phosphor-icons/react';
import ChannelBadge from '@/shared/components/ui/ChannelBadge';
import PageHeader from '@/shared/components/ui/PageHeader';

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
  if (!name) return '??';
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

function daysAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return 'hoy';
  if (diff === 1) return 'ayer';
  return `hace ${diff}d`;
}

function LeadCard({ lead, onClick, onDragStart }) {
  const canal = lead.canal_detectado || lead.origen;
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      onClick={() => onClick(lead.id)}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(lead.id); }}
      className="bg-card border border-border rounded-lg p-3 space-y-2 cursor-grab active:cursor-grabbing hover:shadow-sm hover:border-primary/30 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-1"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 ${AVATAR_COLORS[lead.id % AVATAR_COLORS.length]}`}>
            {getInitials(lead.nombre)}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold leading-tight truncate">{lead.nombre}</p>
            <p className="text-[11px] text-muted-foreground truncate">{lead.email}</p>
          </div>
        </div>
        <DotsSixVertical size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
      </div>

      {lead.producto_interes && (
        <p className="text-[11px] text-muted-foreground bg-muted rounded-md px-2 py-1 truncate">
          {lead.producto_interes}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        {canal ? <ChannelBadge channel={canal} showIcon /> : <span />}
        <span className="flex items-center gap-1 flex-shrink-0">
          {(lead.responsable_nombre || lead.gestor) && (
            <>
              <User size={10} weight="duotone" />
              <span className="truncate max-w-[60px]">{(lead.responsable_nombre || lead.gestor).split(' ')[0]}</span>
              <span className="text-muted-foreground/60">&bull;</span>
            </>
          )}
          <span>{daysAgo(lead.created_at || lead.fecha)}</span>
        </span>
      </div>
    </div>
  );
}

export default function LeadsPipelinePage() {
  const navigate = useNavigate();
  const { activeProject } = useProjectContext();
  const pid = activeProject?.id;

  const [allLeads, setAllLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [dragLead, setDragLead] = useState(null);

  const fetchAllLeads = useCallback(async () => {
    if (!pid) return;
    setLoading(true);
    try {
      const res = await client.get(`/leads?projectId=${pid}&limit=200`);
      if (res.success) {
        // Backend devuelve status, frontend usa estado - normalizar
        setAllLeads((res.data || []).map(l => ({
          ...l,
          estado: l.status || l.estado,
          origen: l.canal_detectado || l.origen || 'directo',
        })));
      }
    } catch (err) {
      toast({ title: 'Error cargando leads', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => {
    fetchAllLeads();
  }, [fetchAllLeads]);

  // Agrupa leads por estado
  const grouped = {};
  for (const col of COLUMNS) {
    grouped[col.key] = [];
  }
  for (const lead of allLeads) {
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

  async function handleDrop(e, targetEstado) {
    e.preventDefault();
    if (!dragLead || dragLead.estado === targetEstado) {
      setDragLead(null);
      return;
    }

    try {
      // Backend requiere motivo al cambiar status
      await client.patch(`/leads/${dragLead.id}/status`, {
        status: targetEstado,
        motivo: `Movido a ${COLUMNS.find(c => c.key === targetEstado)?.label} desde pipeline`,
      });
      toast({
        title: 'Estado actualizado',
        description: `${dragLead.nombre} movido a "${COLUMNS.find(c => c.key === targetEstado)?.label}"`,
      });
      setAllLeads((prev) =>
        prev.map((l) => l.id === dragLead.id ? { ...l, estado: targetEstado, status: targetEstado } : l)
      );
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error || err.message, variant: 'destructive' });
    }
    setDragLead(null);
  }

  async function handleCreateLead(data) {
    if (!pid) return;
    try {
      const res = await client.post('/leads', {
        project_id: pid,
        nombre: data.nombre,
        email: data.email,
        telefono: data.telefono || '',
        canal: data.origen || 'directo',
        notas: data.notas || '',
      });
      if (res.success) {
        toast({ title: 'Lead creado' });
        await fetchAllLeads();
      }
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error || err.message, variant: 'destructive' });
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Pipeline de Leads</h1>
          <p className="text-muted-foreground text-sm">Cargando...</p>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <div key={col.key} className="flex-shrink-0 w-[280px]">
              <div className={`rounded-2xl px-4 py-3 mb-3 ${col.bg} animate-pulse`}>
                <div className="w-24 h-4 bg-muted rounded" />
              </div>
              <div className="space-y-2.5">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-7 h-7 rounded-full bg-muted" />
                      <div><div className="w-20 h-4 bg-muted rounded mb-1" /><div className="w-28 h-3 bg-muted rounded" /></div>
                    </div>
                    <div className="w-full h-3 bg-muted rounded" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <LeadFormDialog open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleCreateLead} />

      <PageHeader
        title="Pipeline de Leads"
        subtitle="Vista Kanban &mdash; arrastra una tarjeta para cambiar su estado"
        actions={
          <>
            <button
              onClick={() => navigate('/leads')}
              className="px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
            >
              Vista tabla
            </button>
            <button
              onClick={() => setFormOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all duration-200 shadow-lg shadow-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
            >
              <Plus size={16} weight="bold" /> Nuevo Lead
            </button>
          </>
        }
      />

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
                    <Users size={20} className="mx-auto mb-1 opacity-40" weight="duotone" />
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
