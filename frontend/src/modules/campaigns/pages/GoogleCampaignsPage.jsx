import { useProjectContext } from '@/contexts/ProjectContext';
import PageHeader from '@/shared/components/ui/PageHeader';
import KpiCard from '@/shared/components/ui/KpiCard';
import EmptyState from '@/shared/components/ui/EmptyState';
import { useCampaigns } from '../hooks/useCampaigns';
import {
  PeriodSelector, CampaignTable, ErrorState, KeywordsTable,
  STATUS_STYLES_GOOGLE, STATUS_LABEL_GOOGLE, TYPE_LABEL_GOOGLE,
  fmtMoney, fmtNum, fmtCpa, CPA_ALERT_THRESHOLD,
} from '../components/shared';
import {
  CurrencyEur, MouseSimple, Users, TrendUp, GoogleLogo,
} from '@phosphor-icons/react';

export default function GoogleCampaignsPage() {
  const { activeProject } = useProjectContext();
  const all = useCampaigns(activeProject?.id);
  const google = all.google;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Campañas Google Ads"
        subtitle={activeProject ? `${activeProject.nombre} — Search + PMax + Display` : 'Selecciona un proyecto'}
      />

      <PeriodSelector all={all} />

      {all.loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-muted/50 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard icon={CurrencyEur} label="Inversion" value={fmtMoney(google.totals.spend)} />
            <KpiCard icon={MouseSimple} label="Clicks" value={fmtNum(google.totals.clicks)} />
            <KpiCard icon={Users} label="Prospectos CRM" value={fmtNum(google.totals.crmLeads)} tone="success" />
            <KpiCard icon={TrendUp} label="CPA real" value={fmtCpa(google.totals.cpaReal)}
              tone={google.totals.cpaReal > CPA_ALERT_THRESHOLD ? 'destructive' : 'default'} />
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {google.error ? (
              <ErrorState message={google.error} />
            ) : google.campaigns.length === 0 ? (
              <EmptyState icon={GoogleLogo} title="Sin campañas Google"
                description={activeProject ? `No hay campañas activas en este periodo para ${activeProject.nombre}` : 'Selecciona un proyecto'} />
            ) : (
              <CampaignTable
                campaigns={google.campaigns}
                statusStyles={STATUS_STYLES_GOOGLE}
                statusLabel={STATUS_LABEL_GOOGLE}
                getSubLabel={c => TYPE_LABEL_GOOGLE[c.type] || c.type}
              />
            )}
          </div>

          <KeywordsTable keywords={google.keywords} />
        </>
      )}
    </div>
  );
}
