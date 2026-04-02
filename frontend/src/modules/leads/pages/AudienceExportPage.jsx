import { useState, useMemo } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import { LEADS } from '@/shared/data/mock';
import { toast } from '@/shared/hooks/useToast';
import {
  Export,
  FunnelSimple,
  Users,
  UserMinus,
  CheckCircle,
  XCircle,
  CalendarBlank,
  MagnifyingGlass,
  DownloadSimple,
  CloudArrowUp,
} from '@phosphor-icons/react';

const ESTADO_LABELS = {
  nuevo: 'Nuevo',
  por_contactar: 'Por contactar',
  contactado: 'Contactado',
  en_seguimiento: 'En seguimiento',
  convertido: 'Convertido',
  no_interesado: 'No interesado',
};

const ORIGEN_LABELS = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  organico: 'Organico',
  referido: 'Referido',
  directo: 'Directo',
};

const AUDIENCE_PRESETS = [
  { id: 'no_convertidos', label: 'Leads no convertidos', desc: 'Solicitaron info pero no compraron — ideal para retargeting', icon: UserMinus, filter: (l) => l.estado !== 'convertido' && l.estado !== 'no_interesado' },
  { id: 'convertidos', label: 'Clientes convertidos', desc: 'Para excluir de captacion o hacer upsell', icon: CheckCircle, filter: (l) => l.estado === 'convertido' },
  { id: 'perdidos', label: 'Leads perdidos', desc: 'Marcados como no interesado — excluir del gasto', icon: XCircle, filter: (l) => l.estado === 'no_interesado' },
  { id: 'organico', label: 'Leads organicos', desc: 'Origen organico — ver si convierten con paid', icon: MagnifyingGlass, filter: (l) => l.origen === 'organico' },
];

function sha256Mock(str) {
  // Mock: en produccion usar Web Crypto API
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, '0') + 'a'.repeat(48);
}

function generateCSV(leads) {
  const header = 'email_hash,phone_hash,first_name,last_name';
  const rows = leads.map((l) => {
    const parts = l.nombre.split(' ');
    return `${sha256Mock(l.email.toLowerCase())},${sha256Mock(l.telefono || '')},${parts[0] || ''},${parts.slice(1).join(' ') || ''}`;
  });
  return [header, ...rows].join('\n');
}

const selectClass = "h-11 px-4 pr-9 rounded-xl border border-border bg-muted/50 text-sm outline-none appearance-none cursor-pointer focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all";
const selectBg = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' };

export default function AudienceExportPage() {
  const { activeProject } = useProjectContext();
  const allLeads = LEADS[activeProject.id] || [];

  const [filterEstado, setFilterEstado] = useState('');
  const [filterOrigen, setFilterOrigen] = useState('');
  const [activePreset, setActivePreset] = useState(null);

  const filtered = useMemo(() => {
    let result = allLeads;
    if (activePreset) {
      const preset = AUDIENCE_PRESETS.find((p) => p.id === activePreset);
      if (preset) result = result.filter(preset.filter);
    }
    if (filterEstado) result = result.filter((l) => l.estado === filterEstado);
    if (filterOrigen) result = result.filter((l) => l.origen === filterOrigen);
    return result;
  }, [allLeads, filterEstado, filterOrigen, activePreset]);

  function handleExportCSV() {
    if (filtered.length === 0) {
      toast({ title: 'Sin datos', description: 'No hay leads que exportar con estos filtros', variant: 'destructive' });
      return;
    }
    const csv = generateCSV(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audiencia_${activeProject.slug}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado', description: `${filtered.length} leads exportados para Meta Ads` });
  }

  function handleUploadAPI() {
    toast({ title: 'Subida a Meta API', description: 'Funcion disponible cuando se conecte Meta Marketing API (Fase 2)' });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Exportar Audiencias</h1>
          <p className="text-muted-foreground text-sm">Crea listas para Custom Audiences de Meta Ads — {activeProject.nombre}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
            <DownloadSimple size={16} weight="bold" /> Exportar CSV
          </button>
          <button onClick={handleUploadAPI} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors">
            <CloudArrowUp size={16} weight="bold" /> Subir a Meta API
          </button>
        </div>
      </div>

      {/* Presets */}
      <div>
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">Audiencias predefinidas</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {AUDIENCE_PRESETS.map((preset) => {
            const Icon = preset.icon;
            const isActive = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => setActivePreset(isActive ? null : preset.id)}
                className={`p-4 rounded-2xl text-left transition-all ${
                  isActive
                    ? 'bg-primary/10 border-2 border-primary'
                    : 'bg-card border border-border hover:border-primary/30'
                }`}
              >
                <Icon size={20} weight="duotone" className={isActive ? 'text-primary' : 'text-muted-foreground'} />
                <p className="text-[13px] font-bold mt-2">{preset.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{preset.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Extra filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FunnelSimple size={16} />
          <span className="text-[13px] font-medium">Filtros:</span>
        </div>
        <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} className={selectClass} style={selectBg}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={filterOrigen} onChange={(e) => setFilterOrigen(e.target.value)} className={selectClass} style={selectBg}>
          <option value="">Todos los origenes</option>
          {Object.entries(ORIGEN_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Preview */}
      <div className="bg-card rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] overflow-hidden">
        <div className="p-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold">Previsualizacion</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{filtered.length} leads seleccionados — emails hasheados SHA256 en la exportacion</p>
          </div>
          <span className="text-sm font-bold bg-primary/10 text-primary px-3 py-1.5 rounded-xl">
            {filtered.length} leads
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/50 border-y">
              <tr>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nombre</th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email</th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Telefono</th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Estado</th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Origen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 10).map((l) => (
                <tr key={l.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="px-5 py-3 font-semibold">{l.nombre}</td>
                  <td className="px-5 py-3 text-muted-foreground">{l.email}</td>
                  <td className="px-5 py-3 text-muted-foreground">{l.telefono}</td>
                  <td className="px-5 py-3"><span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-muted text-muted-foreground">{ESTADO_LABELS[l.estado]}</span></td>
                  <td className="px-5 py-3 text-muted-foreground">{ORIGEN_LABELS[l.origen] || l.origen}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">No hay leads con estos filtros</td></tr>
              )}
              {filtered.length > 10 && (
                <tr><td colSpan={5} className="px-5 py-3 text-center text-[12px] text-muted-foreground">...y {filtered.length - 10} leads mas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
