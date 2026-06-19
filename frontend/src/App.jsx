import { Routes, Route, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { useProjectContext } from './contexts/ProjectContext';

const ROUTE_TITLES = {
  '/': 'Dashboard',
  '/prospectos': 'Prospectos',
  '/prospectos/pipeline': 'Pipeline',
  '/prospectos/audiencias': 'Audiencias',
  '/clientes': 'Clientes',
  '/clientes/matriculas': 'Matrículas',
  '/captacion': 'Captación',
  '/captacion/webhooks': 'Webhooks',
  '/captacion/make': 'Make',
  '/campanas': 'Campañas',
  '/campanas/meta': 'Meta Ads',
  '/campanas/google': 'Google Ads',
  '/campanas/seo': 'Tráfico orgánico',
  '/productos': 'Productos',
  '/productos/arbol': 'Árbol de categorías',
  '/productos/pendientes': 'Cursos pendientes',
  '/productos/woocommerce': 'WooCommerce',
  '/finanzas': 'Contabilidad',
  '/finanzas/ventas': 'Ventas',
  '/finanzas/ingresos': 'Ingresos',
  '/finanzas/conversiones': 'Conversiones',
  '/finanzas/egresos': 'Egresos',
  '/finanzas/por-cobrar': 'Cuentas por cobrar',
  '/finanzas/por-pagar': 'Cuentas por pagar',
  '/finanzas/comisiones': 'Comisiones',
  '/finanzas/nominas': 'Nóminas',
  '/finanzas/integraciones': 'Integraciones',
  '/finanzas/pendiente-facturar': 'Pendientes de facturar',
  '/finanzas/pagos-stripe': 'Pagos Stripe',
  '/finanzas/facturas': 'Facturas',
  '/finanzas/facturas/configuracion': 'Configuración de facturación',
  '/stripe': 'Stripe',
  '/soporte': 'Soporte',
  '/status': 'Estado del sistema',
  '/notificaciones': 'Notificaciones',
  '/email-sequences': 'Email seguimiento',
  '/configuracion/campos': 'Campos personalizados',
  '/configuracion/roles': 'Roles y Permisos',
  '/configuracion/canales': 'Canales del proyecto',
  '/configuracion/atajos': 'Atajos rápidos',
  '/configuracion/documentos': 'Numeración de documentos',
  '/configuracion/email-templates': 'Plantillas de email',
  '/reports': 'Reportes',
  '/messages': 'Mensajes',
  '/manual': 'Manual',
  '/settings': 'Configuración',
  '/profile': 'Mi perfil',
  '/dev/components': 'Catálogo UI',
  '/prueba_ui': 'Laboratorio UI',
  '/prueba_ui_leads': 'Prueba UI Prospectos',
  '/prueba_ui_clientes': 'Prueba UI Clientes',
  '/prueba_ui_finanzas': 'Prueba UI Finanzas',
  '/prueba_ui_productos': 'Prueba UI Productos',
  '/prueba_ui_reportes': 'Prueba UI Reportes',
  '/prueba_ui_configuracion': 'Prueba UI Configuracion',
  '/testeo2': 'Testeo2 CRM Workspace',
};

const APP_BASE_URL = import.meta.env.BASE_URL || '';
const IS_TESTEO_PREVIEW_BASE = APP_BASE_URL.startsWith('/testeo/') || APP_BASE_URL.startsWith('/testeo2/');
const IS_TESTEO2_BASE = APP_BASE_URL.startsWith('/testeo2/');

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
    if (IS_TESTEO2_BASE && pathname === '/') {
      document.title = `Testeo2 CRM Workspace — ${base}`;
      return;
    }
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

// Layouts con SubNav (tabs)
const ProspectosLayout = lazy(() => import('./modules/leads/pages/ProspectosLayout'));
const CaptacionLayout = lazy(() => import('./modules/forms/pages/CaptacionLayout'));
const CampanasLayout = lazy(() => import('./modules/campaigns/pages/CampanasLayout'));
const ClientesLayout = lazy(() => import('./modules/clients/pages/ClientesLayout'));
const ProductosLayout = lazy(() => import('./modules/products/pages/ProductosLayout'));
const FinanzasLayout = lazy(() => import('./modules/accounting/pages/FinanzasLayout'));

// Modules
const LeadsPage = lazy(() => import('./modules/leads/pages/LeadsPage'));
const LeadsPipelinePage = lazy(() => import('./modules/leads/pages/LeadsPipelinePage'));
const AudienceExportPage = lazy(() => import('./modules/leads/pages/AudienceExportPage'));
const LeadDetailPage = lazy(() => import('./modules/leads/pages/LeadDetailPage'));
const ProductsPage = lazy(() => import('./modules/products/pages/ProductsPage'));
const ProductsTreePage = lazy(() => import('./modules/products/pages/ProductsTreePage'));
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
const ReportsIAPage = lazy(() => import('./modules/reports-ia/pages/ReportsIAPage'));
const AIChatPage = lazy(() => import('./modules/ai-chat/pages/AIChatPage'));
const SettingsPage = lazy(() => import('./modules/settings/pages/SettingsPage'));
const AccountingDashboardPage = lazy(() => import('./modules/accounting/pages/AccountingDashboardPage'));
const ExpensesPage = lazy(() => import('./modules/accounting/pages/ExpensesPage'));
const IncomePage = lazy(() => import('./modules/accounting/pages/IncomePage'));
const IntegrationsPage = lazy(() => import('./modules/accounting/pages/IntegrationsPage'));
const PendienteFacturarPage = lazy(() => import('./modules/accounting/pages/PendienteFacturarPage'));
const StripePaymentsPage = lazy(() => import('./modules/accounting/pages/StripePaymentsPage'));
const InvoicesPage = lazy(() => import('./modules/invoices/pages/InvoicesPage'));
const InvoicingConfigPage = lazy(() => import('./modules/invoices/pages/InvoicingConfigPage'));
const ReceivablePage = lazy(() => import('./modules/accounting/pages/ReceivablePage'));
const AccountsPayablePage = lazy(() => import('./modules/accounting/pages/AccountsPayablePage'));
const ClientsPage = lazy(() => import('./modules/clients/pages/ClientsPage'));
const ClientDetailPage = lazy(() => import('./modules/clients/pages/ClientDetailPage'));
const CommissionsPage = lazy(() => import('./modules/commissions/pages/CommissionsPage'));
const MatriculasPage = lazy(() => import('./modules/matriculas/pages/MatriculasPage'));
const SalesPage = lazy(() => import('./modules/sales/pages/SalesPage'));
const MetaAdsPage = lazy(() => import('./modules/meta-ads/pages/MetaAdsPage'));
const ChangeRequestsPage = lazy(() => import('./modules/change-requests/pages/ChangeRequestsPage'));
const ChangeRequestDetailPage = lazy(() => import('./modules/change-requests/pages/ChangeRequestDetailPage'));
const DupReviewQueuePage = lazy(() => import('./modules/leads/pages/DupReviewQueuePage'));
const EmailSequencesPage = lazy(() => import('./modules/email-sequences/pages/EmailSequencesPage'));
const FormsPage = lazy(() => import('./modules/forms/pages/FormsPage'));
const WebhooksPage = lazy(() => import('./modules/webhooks/pages/WebhooksPage'));
const WebhookDetailPage = lazy(() => import('./modules/webhooks/pages/WebhookDetailPage'));
const MakeWebhooksPage = lazy(() => import('./modules/make-webhooks/pages/MakeWebhooksPage'));
const MakeWebhookDetailPage = lazy(() => import('./modules/make-webhooks/pages/MakeWebhookDetailPage'));
const FieldDefinitionsPage = lazy(() => import('./modules/field-definitions/pages/FieldDefinitionsPage'));
const RolesPage = lazy(() => import('./modules/permissions/pages/RolesPage'));
const CategoriesTreePage = lazy(() => import('./modules/product-categories/pages/CategoriesTreePage'));
const ChannelsConfigPage = lazy(() => import('./modules/settings/pages/ChannelsConfigPage'));
const ShortcutsConfigPage = lazy(() => import('./modules/settings/pages/ShortcutsConfigPage'));
const EmailTemplatesPage = lazy(() => import('./modules/email-templates/pages/EmailTemplatesPage'));
const PayrollPage = lazy(() => import('./modules/payroll/pages/PayrollPage'));
const WooCommercePage = lazy(() => import('./modules/woocommerce/pages/WooCommercePage'));
const MessagesPage = lazy(() => import('./modules/messages/pages/MessagesPage'));
const ManualPage = lazy(() => import('./modules/manual/pages/ManualPage'));
const DocumentsPage = lazy(() => import('./modules/documents/pages/DocumentsPage'));
const DocumentsConfigPage = lazy(() => import('./modules/documents/pages/DocumentsConfigPage'));
const PreferencesPage = lazy(() => import('./modules/preferences/pages/PreferencesPage'));
const EmbedFormPage = lazy(() => import('./modules/forms/pages/EmbedFormPage'));
const ExternalPanelPage = lazy(() => import('./modules/external-panels/pages/ExternalPanelPage'));
const UiPreviewHomePage = lazy(() => import('./modules/ui-preview/pages/UiPreviewHomePage'));
const LeadsUiPreviewPage = lazy(() => import('./modules/ui-preview/pages/LeadsUiPreviewPage'));
const GenericUiPreviewPage = lazy(() => import('./modules/ui-preview/pages/GenericUiPreviewPage'));
const SuiteDashCrmPreviewPage = lazy(() => import('./modules/suitedash-preview/pages/SuiteDashCrmPreviewPage'));

// Dev-only: catalogo de componentes UI (CRM-205). Solo se monta en development;
// en build de produccion Vite elimina la rama por dead-code elimination.
const DevComponentsPage = import.meta.env.DEV
  ? lazy(() => import('./modules/dev/pages/DevComponentsPage'))
  : null;

const UI_PREVIEW_ENABLED = import.meta.env.DEV || IS_TESTEO_PREVIEW_BASE;

function UiPreviewRoute({ children }) {
  return UI_PREVIEW_ENABLED ? children : <NotFoundPage />;
}

function App() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted-foreground">Cargando…</div>}>
      <ScrollToTop />
      <DocumentTitle />
      <Routes>
        <Route path="/embed/form/:embedId" element={<EmbedFormPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/set-password" element={<SetPasswordPage />} />
        {IS_TESTEO2_BASE && (
          <Route path="/" element={<ProtectedRoute><SuiteDashCrmPreviewPage /></ProtectedRoute>} />
        )}
        <Route path="/testeo2" element={<ProtectedRoute><UiPreviewRoute><SuiteDashCrmPreviewPage /></UiPreviewRoute></ProtectedRoute>} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          {!IS_TESTEO2_BASE && <Route path="/" element={<DashboardPage />} />}

          {/* Prospectos — tabs */}
          <Route path="/prospectos" element={<ProspectosLayout />}>
            <Route index element={<LeadsPage />} />
            <Route path="pipeline" element={<LeadsPipelinePage />} />
            <Route path="audiencias" element={<AudienceExportPage />} />
          </Route>
          <Route path="/prospectos/:id" element={<LeadDetailPage />} />

          {/* Clientes — tabs */}
          <Route path="/clientes" element={<ClientesLayout />}>
            <Route index element={<ClientsPage />} />
            <Route path="matriculas" element={<MatriculasPage />} />
          </Route>
          <Route path="/sales" element={<SalesPage />} />
          <Route path="/meta-ads" element={<MetaAdsPage />} />
          <Route path="/prospectos/revision-duplicados" element={<DupReviewQueuePage />} />
          <Route path="/clientes/:id" element={<ClientDetailPage />} />

          {/* Captación — tabs */}
          <Route path="/captacion" element={<CaptacionLayout />}>
            <Route index element={<FormsPage />} />
            <Route path="webhooks" element={<WebhooksPage />} />
            <Route path="webhooks/:id" element={<WebhookDetailPage />} />
            <Route path="make" element={<MakeWebhooksPage />} />
            <Route path="make/:id" element={<MakeWebhookDetailPage />} />
          </Route>

          {/* Campañas — tabs */}
          <Route path="/campanas" element={<CampanasLayout />}>
            <Route index element={<CampaignsPage />} />
            <Route path="meta" element={<MetaCampaignsPage />} />
            <Route path="google" element={<GoogleCampaignsPage />} />
            <Route path="seo" element={<SeoPage />} />
          </Route>

          {/* Productos — tabs */}
          <Route path="/productos" element={<ProductosLayout />}>
            <Route index element={<ProductsPage />} />
            <Route path="arbol" element={<ProductsTreePage />} />
            <Route path="pendientes" element={<CoursesPendingPage />} />
            <Route path="woocommerce" element={<WooCommercePage />} />
          </Route>
          <Route path="/productos/:id" element={<ProductDetailPage />} />

          {/* Finanzas — tabs */}
          <Route path="/finanzas" element={<FinanzasLayout />}>
            <Route index element={<AccountingDashboardPage />} />
            <Route path="ventas" element={<IncomePage title="Ventas" subtitlePrefix="Todas las ventas registradas" />} />
            <Route path="ingresos" element={<IncomePage />} />
            <Route path="conversiones" element={<RevenuePage />} />
            <Route path="egresos" element={<ExpensesPage />} />
            <Route path="por-cobrar" element={<ReceivablePage />} />
            <Route path="por-pagar" element={<AccountsPayablePage />} />
            <Route path="comisiones" element={<CommissionsPage />} />
            <Route path="nominas" element={<PayrollPage />} />
            <Route path="integraciones" element={<IntegrationsPage />} />
            <Route path="pendiente-facturar" element={<PendienteFacturarPage />} />
            <Route path="pagos-stripe" element={<StripePaymentsPage />} />
            <Route path="facturas" element={<InvoicesPage />} />
            <Route path="facturas/configuracion" element={<InvoicingConfigPage />} />
          </Route>

          <Route path="/email-sequences" element={<EmailSequencesPage />} />
          <Route path="/stripe" element={<IADashboardPage />} />
          <Route path="/configuracion/campos" element={<FieldDefinitionsPage />} />
          <Route path="/configuracion/roles" element={<RolesPage />} />
          <Route path="/configuracion/canales" element={<ChannelsConfigPage />} />
          <Route path="/configuracion/atajos" element={<ShortcutsConfigPage />} />
          <Route path="/configuracion/categorias-arbol" element={<CategoriesTreePage />} />
          <Route path="/configuracion/documentos" element={<DocumentsConfigPage />} />
          <Route path="/configuracion/email-templates" element={<EmailTemplatesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/reports/ia" element={<ReportsIAPage />} />
          <Route path="/ai-chat" element={<AIChatPage />} />
          <Route path="/soporte" element={<SoportePage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/notificaciones" element={<NotificacionesPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/solicitudes-cambio" element={<ChangeRequestsPage />} />
          <Route path="/solicitudes-cambio/:id" element={<ChangeRequestDetailPage />} />
          <Route path="/manual" element={<ManualPage />} />
          <Route path="/documentos" element={<DocumentsPage />} />
          <Route path="/preferences" element={<PreferencesPage />} />
          <Route path="/external/:panelId" element={<ExternalPanelPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/prueba_ui" element={<UiPreviewRoute><UiPreviewHomePage /></UiPreviewRoute>} />
          <Route path="/prueba_ui_leads" element={<UiPreviewRoute><LeadsUiPreviewPage /></UiPreviewRoute>} />
          <Route path="/prueba_ui_clientes" element={<UiPreviewRoute><GenericUiPreviewPage area="clientes" /></UiPreviewRoute>} />
          <Route path="/prueba_ui_finanzas" element={<UiPreviewRoute><GenericUiPreviewPage area="finanzas" /></UiPreviewRoute>} />
          <Route path="/prueba_ui_productos" element={<UiPreviewRoute><GenericUiPreviewPage area="productos" /></UiPreviewRoute>} />
          <Route path="/prueba_ui_reportes" element={<UiPreviewRoute><GenericUiPreviewPage area="reportes" /></UiPreviewRoute>} />
          <Route path="/prueba_ui_configuracion" element={<UiPreviewRoute><GenericUiPreviewPage area="configuracion" /></UiPreviewRoute>} />
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
