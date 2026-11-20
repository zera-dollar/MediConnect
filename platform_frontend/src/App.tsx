import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ConnectPage } from './components/ConnectPage'
import { LandingPage } from './components/LandingPage'
import { DriverTelemetryPage } from './components/DriverTelemetryPage'
import { OfflineStatusBanner } from './components/OfflineStatusBanner'
import { RoleDashboardPage } from './components/RoleDashboardPage'
import { dashboardPathForRole } from './lib/roleDashboard'
import { useAuthStore } from './store/auth'

const OxygenDashboard = lazy(() => import('./components/OxygenDashboard').then((module) => ({ default: module.OxygenDashboard })))
const ResourceManagementDashboard = lazy(() => import('./components/ResourceManagementDashboard').then((module) => ({ default: module.ResourceManagementDashboard })))
const AuditCentreDashboard = lazy(() => import('./components/AuditCentreDashboard').then((module) => ({ default: module.AuditCentreDashboard })))
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard').then((module) => ({ default: module.AnalyticsDashboard })))
const ReportsDashboard = lazy(() => import('./components/ReportsDashboard').then((module) => ({ default: module.ReportsDashboard })))
const SystemSettingsDashboard = lazy(() => import('./components/SystemSettingsDashboard').then((module) => ({ default: module.SystemSettingsDashboard })))
const StaffingDashboard = lazy(() => import('./components/StaffingDashboard').then((module) => ({ default: module.StaffingDashboard })))
const NotificationsDashboard = lazy(() => import('./components/NotificationsDashboard').then((module) => ({ default: module.NotificationsDashboard })))
const RegisterPage = lazy(() => import('./components/RegisterPage').then((module) => ({ default: module.RegisterPage })))
const HospitalMapDashboard = lazy(() => import('./components/HospitalMapDashboard').then((module) => ({ default: module.HospitalMapDashboard })))
const AmbulanceDashboard = lazy(() => import('./components/AmbulanceDashboard').then((module) => ({ default: module.AmbulanceDashboard })))
const AppointmentDashboard = lazy(() => import('./components/AppointmentDashboard').then((module) => ({ default: module.AppointmentDashboard })))
const InterfacilityReferralsDashboard = lazy(() => import('./components/InterfacilityReferralsDashboard').then((module) => ({ default: module.InterfacilityReferralsDashboard })))

function HomeRoute() {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.accessToken)
  return user && token
    ? <Navigate to={dashboardPathForRole(user.role)} replace />
    : <LandingPage />
}

export function DashboardLoadingFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-5 text-ink" role="status" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-3 rounded-lg border border-black/[0.06] bg-white px-5 py-4 text-sm text-muted shadow-panel">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#d8e0db] border-t-forest" aria-hidden="true" />
        <span>Loading MediConnect dashboard…</span>
      </div>
    </main>
  )
}

export default function App() {
  return (
    <Suspense fallback={<DashboardLoadingFallback />}>
      <>
        <OfflineStatusBanner />
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/driver/:linkToken" element={<DriverTelemetryPage />} />
          <Route path="/dashboard/:role" element={<RoleDashboardPage />} />
          <Route path="/oxygen" element={<OxygenDashboard />} />
          <Route path="/resources" element={<ResourceManagementDashboard />} />
          <Route path="/audit" element={<AuditCentreDashboard />} />
          <Route path="/analytics" element={<AnalyticsDashboard />} />
          <Route path="/reports" element={<ReportsDashboard />} />
          <Route path="/settings" element={<SystemSettingsDashboard />} />
          <Route path="/staffing" element={<StaffingDashboard />} />
          <Route path="/notifications" element={<NotificationsDashboard />} />
          <Route path="/connect" element={<ConnectPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/hospitals" element={<HospitalMapDashboard />} />
          <Route path="/ambulance" element={<AmbulanceDashboard />} />
          <Route path="/appointments" element={<AppointmentDashboard />} />
          <Route path="/referrals" element={<InterfacilityReferralsDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </>
    </Suspense>
  )
}