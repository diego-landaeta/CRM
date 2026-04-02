import { useState } from 'react';
import { MetaLogo, GoogleLogo } from '@phosphor-icons/react';
import { useProjectContext } from '@/contexts/ProjectContext';
import { CAMPAIGNS } from '@/shared/data/mock';

function getCplColor(cpl) {
  if (cpl < 25) return 'bg-emerald-50 text-emerald-600';
  if (cpl < 40) return 'bg-amber-50 text-amber-600';
  return 'bg-red-50 text-red-600';
}

const STATUS_STYLES = {
  activa: 'bg-emerald-50 text-emerald-600',
  pausada: 'bg-muted text-muted-foreground',
  finalizada: 'bg-blue-50 text-blue-600',
};

export default function CampaignsPage() {
  const { activeProject } = useProjectContext();
  const [tab, setTab] = useState('meta');
  const projectCampaigns = CAMPAIGNS[activeProject.id] || { meta: [], google: [] };
  const campaigns = projectCampaigns[tab] || [];

  const totalSpent = campaigns.reduce((s, c) => s + c.spent, 0);
  const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0);
  const avgCpl = totalLeads > 0 ? (totalSpent / totalLeads).toFixed(2) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Campanas Publicitarias</h1>
        <p className="text-muted-foreground text-sm">Metricas de rendimiento &mdash; {activeProject.nombre}</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setTab('meta')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all ${
            tab === 'meta' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'border border-border bg-card text-zinc-600 hover:bg-muted'
          }`}
        >
          <MetaLogo size={16} weight="bold" /> Meta Ads
        </button>
        <button
          onClick={() => setTab('google')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all ${
            tab === 'google' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'border border-border bg-card text-zinc-600 hover:bg-muted'
          }`}
        >
          <GoogleLogo size={16} weight="bold" /> Google Ads
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card p-5 rounded-2xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] text-center">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Total Gastado</p>
          <p className="text-2xl font-extrabold mt-1">{totalSpent.toLocaleString('es-ES')} &euro;</p>
        </div>
        <div className="bg-card p-5 rounded-2xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] text-center">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Total Leads</p>
          <p className="text-2xl font-extrabold mt-1">{totalLeads}</p>
        </div>
        <div className="bg-card p-5 rounded-2xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] text-center">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">CPL Medio</p>
          <p className="text-2xl font-extrabold mt-1">{avgCpl} &euro;</p>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="font-semibold">No hay campanas de {tab === 'meta' ? 'Meta' : 'Google'} Ads para este proyecto.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-card p-6 rounded-3xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] hover:shadow-[0_10px_15px_-3px_rgb(0_0_0/0.04)] hover:-translate-y-0.5 transition-all">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h3 className="font-bold tracking-tight">{c.name}</h3>
                  <p className="text-[11px] text-muted-foreground mt-1">{c.dates}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${STATUS_STYLES[c.status]}`}>{c.status}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted rounded-xl py-3 text-center"><p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Gastado</p><p className="font-extrabold text-base mt-0.5">{c.spent.toLocaleString('es-ES')} &euro;</p></div>
                <div className="bg-muted rounded-xl py-3 text-center"><p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Leads</p><p className="font-extrabold text-base mt-0.5">{c.leads}</p></div>
                <div className={`rounded-xl py-3 text-center ${getCplColor(c.cpl)}`}><p className="text-[9px] font-bold uppercase tracking-wider opacity-70">CPL</p><p className="font-extrabold text-base mt-0.5">{c.cpl} &euro;</p></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
