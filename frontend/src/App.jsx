import { Routes, Route, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { useProjectContext } from './contexts/ProjectContext';

const ROUTE_TITLES = {
  '/': 'Dashboard',
  '/leads': 'Prospectos',
  '/leads/pipeline': 'Pipeline',
  '/leads/audiences': 'Audiencias',
  '/clients': 'Clientes',
  '/products': 'Productos',
  '/products/pending': 'Productos pendientes',
  '/campaigns': 'Campañas',
  '/campaigns/meta': 'Meta Ads',
  '/campaigns/google': 'Google Ads',
  '/seo': 'Tráfico orgánico',
  '/stripe': 'Stripe',
  '/revenue': 'Conversiones',
  '/soporte': 'Soporte',
  '/status': 'Estado del sistema',
  '/notificaciones': 'Notificaciones',
  '/accounting': 'Contabilidad',
  '/accounting/income': 'Ingresos',
  '/accounting/expenses': 'Egresos',
  '/accounting/receivable': 'Cuentas por cobrar',
  '/accounting/payable': 'Cuentas por pagar',
  '/commissions': 'Comisiones',
  '/matriculas': 'Matrículas',
  '/email-sequences': 'Email seguimiento',
  '/forms': 'Forms',
  '/webhooks': 'Webhooks',
  '/configuracion/campos': 'Campos personalizados',
  '/configuracion/roles': 'Roles y Permisos',
  '/configuracion/canales': 'Canales del proyecto',
  '/configuracion/atajos': 'Atajos rápidos',
  '/payroll': 'Nóminas',
  '/woocommerce': 'WooCommerce',
  '/reports': 'Reportes',
  '/manual': 'Manual',
  '/settings': 'Configuración',
  '/profile': 'Mi perfil',
  '/dev/components': 'Catálogo UI',
};

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function DocumentTitle() {
  const { pathname } = useLocation();
  const { activeProject: project } = useProjectContext();
  useEffect(() => {
    const base = 'MultiCRM';
    const match = Object.keys(ROUTE_TITLES)
      .sort((a, b) => b.length - a.length)
      .find(k => pathname === k || pathname.startsWith(k + '/'));
    const route = match ? ROUTE_TITLES[match] : null;
    const proj = project?.nombre;
    // Formato: "Prospectos · Psiko Aprende — MultiCRM"
    if (route && proj) document.title = `${route} · ${proj} — ${base}`;
    else if (route) document.title = `${route} — ${base}`;
    else if (proj) document.title = `${proj} — ${base}`;
    else document.title = base;
  }, [pathname, project?.nombre]);
  return null;
}

// Layout
const AppLayout = lazy(() => import('./shared/components/layout/AppLayout'));
const ProtectedRoute = lazy(() => import('./shared/components/layout/ProtectedRoute'));

// Auth (sin layout, sin proteccion)
const LoginPage = lazy(() => import('./shared/pages/LoginPage'));
const SetPasswordPage = lazy(() => import('./shared/pages/SetPasswordPage'));

// Shared
const DashboardPage = lazy(() => import('./shared/pages/DashboardPage'));
const ProfilePage = lazy(() => import('./shared/pages/ProfilePage'));
const NotFoundPage = lazy(() => import('./shared/pages/NotFoundPage'));

// Modules
const LeadsPage = lazy(() => import('./modules/leads/pages/LeadsPage'));
const LeadsPipelinePage = lazy(() => import('./modules/leads/pages/LeadsPipelinePage'));
const AudienceExportPage = lazy(() => import('./modules/leads/pages/AudienceExportPage'));
const LeadDetailPage = lazy(() => import('./modules/leads/pages/LeadDetailPage'));
const ProductsPage = lazy(() => import('./modules/products/pages/ProductsPage'));
const ProductDetailPage = lazy(() => import('./modules/products/pages/ProductDetailPage'));
const CoursesPendingPage = lazy(() => import('./modules/products/pages/CoursesPendingPage'));
const CampaignsPage = lazy(() => import('./modules/campaigns/pages/CampaignsPage'));
const MetaCampaignsPage = lazy(() => import('./modules/campaigns/pages/MetaCampaignsPage'));
const GoogleCampaignsPage = lazy(() => import('./modules/campaigns/pages/GoogleCampaignsPage'));
const SeoPage = lazy(() => import('./modules/seo/pages/SeoPage'));
const IADashboardPage = lazy(() => import('./modules/ia-dashboard/pages/IADashboardPage'));
const RevenuePage = lazy(() => import('./modules/revenue/pages/RevenuePage'));
const SoportePage = lazy(() => import('./modules/soporte/pages/SoportePage'));
const StatusPage = lazy(() => import('./modules/status/pages/StatusPage'));
const NotificacionesPage = lazy(() => import('./modules/notificaciones/pages/NotificacionesPage'));
const ReportsPage = lazy(() => import('./modules/reports/pages/ReportsPage'));
const SettingsPage = lazy(() => import('./modules/settings/pages/SettingsPage'));
const AccountingDashboardPage = lazy(() => import('./modules/accounting/pages/AccountingDashboardPage'));
const ExpensesPage = lazy(() => import('./modules/accounting/pages/ExpensesPage'));
const IncomePage = lazy(() => import('./modules/accounting/pages/IncomePage'));
const ReceivablePage = lazy(() => import('./modules/accounting/pages/ReceivablePage'));
const AccountsPayablePage = lazy(() => import('./modules/accounting/pages/AccountsPayablePage'));
const ClientsPage = lazy(() => import('./modules/clients/pages/ClientsPage'));
const ClientDetailPage = lazy(() => import('./modules/clients/pages/ClientDetailPage'));
const CommissionsPage = lazy(() => import('./modules/commissions/pages/CommissionsPage'));
const MatriculasPage = lazy(() => import('./modules/matriculas/pages/MatriculasPage'));
const EmailSequencesPage = lazy(() => import('./modules/email-sequences/pages/EmailSequencesPage'));
const FormsPage = lazy(() => import('./modules/forms/pages/FormsPage'));
const WebhooksPage = lazy(() => import('./modules/webhooks/pages/WebhooksPage'));
const WebhookDetailPage = lazy(() => import('./modules/webhooks/pages/WebhookDetailPage'));
const FieldDefinitionsPage = lazy(() => import('./modules/field-definitions/pages/FieldDefinitionsPage'));
const RolesPage = lazy(() => import('./modules/permissions/pages/RolesPage'));
const ChannelsConfigPage = lazy(() => import('./modules/settings/pages/ChannelsConfigPage'));
const ShortcutsConfigPage = lazy(() => import('./modules/settings/pages/ShortcutsConfigPage'));
const PayrollPage = lazy(() => import('./modules/payroll/pages/PayrollPage'));
const WooCommercePage = lazy(() => import('./modules/woocommerce/pages/WooCommercePage'));
const ManualPage = lazy(() => import('./modules/manual/pages/ManualPage'));
const DocumentsPage = lazy(() => import('./modules/documents/pages/DocumentsPage'));
const EmbedFormPage = lazy(() => import('./modules/forms/pages/EmbedFormPage'));

// Dev-only: catalogo de componentes UI (CRM-205). Solo se monta en development;
// en build de produccion Vite elimina la rama por dead-code elimination.
const DevComponentsPage = import.meta.env.DEV
  ? lazy(() => import('./modules/dev/pages/DevComponentsPage'))
  : null;

function App() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted-foreground">Cargando…</div>}>
      <ScrollToTop />
      <DocumentTitle />
      <Routes>
        <Route path="/embed/form/:embedId" element={<EmbedFormPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/set-password" element={<SetPasswordPage />} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/leads/pipeline" element={<LeadsPipelinePage />} />
          <Route path="/leads/audiences" element={<AudienceExportPage />} />
          <Route path="/leads/:id" element={<LeadDetailPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/pending" element={<CoursesPendingPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/campaigns/meta" element={<MetaCampaignsPage />} />
          <Route path="/campaigns/google" element={<GoogleCampaignsPage />} />
          <Route path="/seo" element={<SeoPage />} />
          <Route path="/stripe" element={<IADashboardPage />} />
          <Route path="/revenue" element={<RevenuePage />} />
          <Route path="/accounting" element={<AccountingDashboardPage />} />
          <Route path="/accounting/income" element={<IncomePage />} />
          <Route path="/accounting/expenses" element={<ExpensesPage />} />
          <Route path="/accounting/receivable" element={<ReceivablePage />} />
          <Route path="/accounting/payable" element={<AccountsPayablePage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:id" element={<ClientDetailPage />} />
          <Route path="/commissions" element={<CommissionsPage />} />
          <Route path="/matriculas" element={<MatriculasPage />} />
          <Route path="/email-sequences" element={<EmailSequencesPage />} />
          <Route path="/forms" element={<FormsPage />} />
          <Route path="/webhooks" element={<WebhooksPage />} />
          <Route path="/webhooks/:id" element={<WebhookDetailPage />} />
          <Route path="/configuracion/campos" element={<FieldDefinitionsPage />} />
          <Route path="/configuracion/roles" element={<RolesPage />} />
          <Route path="/configuracion/canales" element={<ChannelsConfigPage />} />
          <Route path="/configuracion/atajos" element={<ShortcutsConfigPage />} />
          <Route path="/payroll" element={<PayrollPage />} />
          <Route path="/woocommerce" element={<WooCommercePage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/soporte" element={<SoportePage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/notificaciones" element={<NotificacionesPage />} />
          <Route path="/manual" element={<ManualPage />} />
          <Route path="/documentos" element={<DocumentsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          {DevComponentsPage && (
            <Route path="/dev/components" element={<DevComponentsPage />} />
          )}
          {/* Catch-all 404 dentro del layout (mantiene sidebar y header) */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
