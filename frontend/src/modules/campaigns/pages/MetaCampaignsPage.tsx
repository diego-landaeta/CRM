import { useProjectContext } from '@/contexts/ProjectContext';
import PageHeader from '@/shared/components/ui/PageHeader';
import KpiCard from '@/shared/components/ui/KpiCard';
import MetricLabel from '@/shared/components/ui/MetricLabel';
import EmptyState from '@/shared/components/ui/EmptyState';
import { useCampaigns } from '../hooks/useCampaigns';
import {
  PeriodSelector, CampaignTable, ErrorState,
  STATUS_STYLES_META, STATUS_LABEL_META,
  fmtMoney, fmtNum, fmtCpa, CPA_ALERT_THRESHOLD,
} from '../components/shared';
import {
  CurrencyEur, MouseSimple, Users, TrendUp, FacebookLogo,
} from '@phosphor-icons/react';

export default function MetaCampaignsPage() {
  const { activeProject } = useProjectContext();
  const all = useCampaigns(activeProject?.id);
  const meta = all.meta;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Campañas Meta Ads"
        subtitle={activeProject ? `${activeProject.nombre} — Facebook + Instagram Ads` : 'Selecciona un proyecto'}
      />

      <PeriodSelector all={all} />

      {all.loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-muted/50 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard icon={CurrencyEur} label="Inversion" numericValue={meta.totals.spend} format={fmtMoney} />
            <KpiCard icon={MouseSimple} label="Clicks" numericValue={meta.totals.clicks} format={fmtNum} />
            <KpiCard icon={Users} label="Prospectos CRM" numericValue={meta.totals.crmLeads} format={fmtNum} tone="success" />
            <KpiCard icon={TrendUp} label={<MetricLabel term="CPA">CPA real</MetricLabel>} numericValue={meta.totals.cpaReal} format={fmtCpa}
              tone={meta.totals.cpaReal > CPA_ALERT_THRESHOLD ? 'destructive' : 'default'} />
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {meta.error ? (
              <ErrorState message={meta.error} />
            ) : meta.campaigns.length === 0 ? (
              <EmptyState icon={FacebookLogo} title="Sin campañas Meta"
                description={activeProject ? `No hay campañas activas en este periodo para ${activeProject.nombre}` : 'Selecciona un proyecto'} />
            ) : (
              <CampaignTable
                campaigns={meta.campaigns}
                statusStyles={STATUS_STYLES_META}
                statusLabel={STATUS_LABEL_META}
                getSubLabel={(c) => (c as { objective?: string }).objective || ''}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
