import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';

// Layout
const AppLayout = lazy(() => import('./shared/components/layout/AppLayout'));
const ProtectedRoute = lazy(() => import('./shared/components/layout/ProtectedRoute'));

// Auth (sin layout, sin proteccion)
const LoginPage = lazy(() => import('./shared/pages/LoginPage'));
const SetPasswordPage = lazy(() => import('./shared/pages/SetPasswordPage'));

// Shared
const DashboardPage = lazy(() => import('./shared/pages/DashboardPage'));
const ProfilePage = lazy(() => import('./shared/pages/ProfilePage'));

// Modules
const LeadsPage = lazy(() => import('./modules/leads/pages/LeadsPage'));
const LeadsPipelinePage = lazy(() => import('./modules/leads/pages/LeadsPipelinePage'));
const AudienceExportPage = lazy(() => import('./modules/leads/pages/AudienceExportPage'));
const LeadDetailPage = lazy(() => import('./modules/leads/pages/LeadDetailPage'));
const ProductsPage = lazy(() => import('./modules/products/pages/ProductsPage'));
const ProductDetailPage = lazy(() => import('./modules/products/pages/ProductDetailPage'));
const CampaignsPage = lazy(() => import('./modules/campaigns/pages/CampaignsPage'));
const RevenuePage = lazy(() => import('./modules/revenue/pages/RevenuePage'));
const ReportsPage = lazy(() => import('./modules/reports/pages/ReportsPage'));
const SettingsPage = lazy(() => import('./modules/settings/pages/SettingsPage'));
const AccountingDashboardPage = lazy(() => import('./modules/accounting/pages/AccountingDashboardPage'));
const ExpensesPage = lazy(() => import('./modules/accounting/pages/ExpensesPage'));
const IncomePage = lazy(() => import('./modules/accounting/pages/IncomePage'));
const ReceivablePage = lazy(() => import('./modules/accounting/pages/ReceivablePage'));
const AccountsPayablePage = lazy(() => import('./modules/accounting/pages/AccountsPayablePage'));
const ClientsPage = lazy(() => import('./modules/clients/pages/ClientsPage'));
const CommissionsPage = lazy(() => import('./modules/commissions/pages/CommissionsPage'));
const MatriculasPage = lazy(() => import('./modules/matriculas/pages/MatriculasPage'));
const EmailSequencesPage = lazy(() => import('./modules/email-sequences/pages/EmailSequencesPage'));
const FormsPage = lazy(() => import('./modules/forms/pages/FormsPage'));
const PayrollPage = lazy(() => import('./modules/payroll/pages/PayrollPage'));
const WooCommercePage = lazy(() => import('./modules/woocommerce/pages/WooCommercePage'));

function App() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted-foreground">Cargando...</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/set-password" element={<SetPasswordPage />} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/leads/pipeline" element={<LeadsPipelinePage />} />
          <Route path="/leads/audiences" element={<AudienceExportPage />} />
          <Route path="/leads/:id" element={<LeadDetailPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/revenue" element={<RevenuePage />} />
          <Route path="/accounting" element={<AccountingDashboardPage />} />
          <Route path="/accounting/income" element={<IncomePage />} />
          <Route path="/accounting/expenses" element={<ExpensesPage />} />
          <Route path="/accounting/receivable" element={<ReceivablePage />} />
          <Route path="/accounting/payable" element={<AccountsPayablePage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/commissions" element={<CommissionsPage />} />
          <Route path="/matriculas" element={<MatriculasPage />} />
          <Route path="/email-sequences" element={<EmailSequencesPage />} />
          <Route path="/forms" element={<FormsPage />} />
          <Route path="/payroll" element={<PayrollPage />} />
          <Route path="/woocommerce" element={<WooCommercePage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
