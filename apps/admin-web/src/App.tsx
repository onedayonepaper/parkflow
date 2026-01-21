import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import LoginPage from './pages/LoginPage';
import KioskPage from './pages/KioskPage';
import KioskPaymentSuccessPage from './pages/KioskPaymentSuccessPage';
import KioskPaymentFailPage from './pages/KioskPaymentFailPage';
import UsageGuidePage from './pages/UsageGuidePage';
import InstallationGuidePage from './pages/InstallationGuidePage';
import HardwareGuidePage from './pages/HardwareGuidePage';
import EnvironmentStatusPage from './pages/EnvironmentStatusPage';
import DashboardPage from './pages/DashboardPage';
import SessionsPage from './pages/SessionsPage';
import SessionDetailPage from './pages/SessionDetailPage';
import PaymentsPage from './pages/PaymentsPage';
import RatePlansPage from './pages/RatePlansPage';
import DiscountRulesPage from './pages/DiscountRulesPage';
import MembershipsPage from './pages/MembershipsPage';
import ReportsPage from './pages/ReportsPage';
import AuditLogPage from './pages/AuditLogPage';
import SettingsPage from './pages/SettingsPage';
import UsersPage from './pages/UsersPage';
import BlacklistPage from './pages/BlacklistPage';
import SitesPage from './pages/SitesPage';
import NotificationsPage from './pages/NotificationsPage';
import DevicesPage from './pages/DevicesPage';
import Layout from './components/Layout';
import { PWAUpdatePrompt, PWAInstallPrompt, OfflineIndicator } from './components/PWAPrompt';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <OfflineIndicator />
      <PWAUpdatePrompt />
      <PWAInstallPrompt />
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/kiosk" element={<KioskPage />} />
      <Route path="/kiosk/payment/success" element={<KioskPaymentSuccessPage />} />
      <Route path="/kiosk/payment/fail" element={<KioskPaymentFailPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/sessions" element={<SessionsPage />} />
                <Route path="/sessions/:id" element={<SessionDetailPage />} />
                <Route path="/payments" element={<PaymentsPage />} />
                <Route path="/rate-plans" element={<RatePlansPage />} />
                <Route path="/discount-rules" element={<DiscountRulesPage />} />
                <Route path="/memberships" element={<MembershipsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/audit" element={<AuditLogPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/blacklist" element={<BlacklistPage />} />
                <Route path="/sites" element={<SitesPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/devices" element={<DevicesPage />} />
                <Route path="/guide" element={<UsageGuidePage />} />
                <Route path="/installation" element={<InstallationGuidePage />} />
                <Route path="/hardware" element={<HardwareGuidePage />} />
                <Route path="/status" element={<EnvironmentStatusPage />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
    </>
  );
}
