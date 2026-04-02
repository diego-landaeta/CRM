import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeads } from '../hooks/useLeads';
import LeadFormDialog from '../components/LeadFormDialog';
import { toast } from '@/shared/hooks/useToast';
import {
  MagnifyingGlass,
  Plus,
  Export,
  CaretLeft,
  CaretRight,
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
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function getAvatarColor(id) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

export default function LeadsPage() {
  const navigate = useNavigate();
  const {
    leads, stats, total, page, totalPages,
    setPage, search, setSearch,
    filterEstado, setFilterEstado,
    filterOrigen, setFilterOrigen,
  } = useLeads();

  const [formOpen, setFormOpen] = useState(false);

  async function handleCreateLead(data) {
    // TODO: llamar API real — POST /api/leads
    console.log('Nuevo lead:', data);
    await new Promise((r) => setTimeout(r, 500));
    toast({ title: 'Lead creado', description: 'El lead se ha registrado correctamente' });
  }

  return (
    <div className="space-y-6">
      <LeadFormDialog open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleCreateLead} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Gestion de Leads</h1>
          <p className="text-muted-foreground text-sm">Explora y gestiona tus clientes potenciales</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/leads/pipeline')}
            className="px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            Pipeline
          </button>
          <button
            onClick={() => navigate('/leads/audiences')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            <Export size={16} weight="bold" />
            Audiencias
          </button>
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            <Plus size={16} weight="bold" />
            Nuevo Lead
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
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-muted/50 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={filterEstado}
          onChange={(e) => { setFilterEstado(e.target.value); setPage(1); }}
          className="h-11 px-4 pr-9 rounded-xl border border-border bg-muted/50 text-sm outline-none appearance-none cursor-pointer focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filterOrigen}
          onChange={(e) => { setFilterOrigen(e.target.value); setPage(1); }}
          className="h-11 px-4 pr-9 rounded-xl border border-border bg-muted/50 text-sm outline-none appearance-none cursor-pointer focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
        >
          <option value="">Todos los origenes</option>
          <option value="Meta Ads">Meta Ads</option>
          <option value="Google Ads">Google Ads</option>
          <option value="Organico">Organico</option>
          <option value="Referido">Referido</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <div className="bg-card px-4 py-3 rounded-2xl border-border text-center shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Total</p>
          <p className="text-xl font-extrabold mt-0.5">{stats.total}</p>
        </div>
        {[
          { key: 'nuevo', label: 'Nuevos', color: '#4361ee' },
          { key: 'por_contactar', label: 'Por contactar', color: '#ea580c' },
          { key: 'contactado', label: 'Contactados', color: '#059669' },
          { key: 'en_seguimiento', label: 'En seguimiento', color: '#d97706' },
          { key: 'convertido', label: 'Convertidos', color: '#7c3aed' },
          { key: 'no_interesado', label: 'No interesado', color: '#dc2626' },
        ].map(({ key, label, color }) => (
          <div key={key} className="bg-card px-4 py-3 rounded-2xl border-border text-center shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] border-b-2" style={{ borderBottomColor: color }}>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-xl font-extrabold mt-0.5" style={{ color }}>{stats[key]}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-3xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nombre</th>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email</th>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Telefono</th>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Origen</th>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Estado</th>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Gestor</th>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => navigate(`/leads/${lead.id}`)}
                className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold ${getAvatarColor(lead.id)}`}>
                      {getInitials(lead.nombre)}
                    </div>
                    <span className="font-semibold">{lead.nombre}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">{lead.email}</td>
                <td className="px-5 py-3.5 text-muted-foreground">{lead.telefono}</td>
                <td className="px-5 py-3.5">
                  <span className="bg-muted text-zinc-600 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase">
                    {lead.origen}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${ESTADO_STYLES[lead.estado]}`}>
                    {ESTADO_LABELS[lead.estado]}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">{lead.gestor}</td>
                <td className="px-5 py-3.5 text-muted-foreground">{formatDate(lead.fecha)}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                  No se encontraron leads con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="px-5 py-3 border-t flex items-center justify-between text-[13px] text-muted-foreground">
          <span>
            Mostrando <strong className="text-foreground">{(page - 1) * 6 + 1}&ndash;{Math.min(page * 6, total)}</strong> de {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <CaretLeft size={12} weight="bold" /> Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
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
      </div>
    </div>
  );
}
