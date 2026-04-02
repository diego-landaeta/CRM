import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';

// Layout
const AppLayout = lazy(() => import('./shared/components/layout/AppLayout'));

// Auth (sin layout)
const LoginPage = lazy(() => import('./shared/pages/LoginPage'));

// Shared
const DashboardPage = lazy(() => import('./shared/pages/DashboardPage'));

// Modules
const LeadsPage = lazy(() => import('./modules/leads/pages/LeadsPage'));
const LeadDetailPage = lazy(() => import('./modules/leads/pages/LeadDetailPage'));
const ProductsPage = lazy(() => import('./modules/products/pages/ProductsPage'));
const ProductDetailPage = lazy(() => import('./modules/products/pages/ProductDetailPage'));
const CampaignsPage = lazy(() => import('./modules/campaigns/pages/CampaignsPage'));
const RevenuePage = lazy(() => import('./modules/revenue/pages/RevenuePage'));
const ReportsPage = lazy(() => import('./modules/reports/pages/ReportsPage'));
const SettingsPage = lazy(() => import('./modules/settings/pages/SettingsPage'));

function App() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-zinc-400">Cargando...</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/leads/:id" element={<LeadDetailPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/revenue" element={<RevenuePage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
