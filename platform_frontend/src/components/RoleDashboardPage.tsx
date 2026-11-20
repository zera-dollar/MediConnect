import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import {
  Activity,
  ArrowRight,
  Ambulance,
  Bell,
  Boxes,
  BriefcaseMedical,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  ClipboardList,
  Droplets,
  Handshake,
  RefreshCw,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  getAmbulanceRequests,
  getAppointments,
  getBids,
  getContracts,
  getHospitals,
  getInterfacilityReferrals,
  getMyHospitals,
  getNotifications,
  getOxygenSupplies,
  getAssignments,
  getHospitalResources,
} from '../lib/api'
import { dashboardPathForRole, roleDashboards, roleForDashboardSlug } from '../lib/roleDashboard'
import type { ApiUser, UserRole } from '../types'
import { useAuthStore } from '../store/auth'
import { PatientDashboard } from './PatientDashboard'
import { WorkspaceNavigation } from './WorkspaceNavigation'

type MetricTone = 'green' | 'blue' | 'amber' | 'red'

interface DashboardMetric {
  label: string
  value: number | string | null
  detail: string
  href: string
  icon: LucideIcon
  tone: MetricTone
  loading: boolean
  error: boolean
}

interface WorkItem {
  title: string
  detail: string
  href: string
  icon: LucideIcon
  count?: number
}

function countMetric<T>(
  query: UseQueryResult<T[], Error>,
  label: string,
  detail: string,
  href: string,
  icon: LucideIcon,
  tone: MetricTone,
  matches: (record: T) => boolean = () => true,
): DashboardMetric {
  return {
    label,
    value: query.data ? query.data.filter(matches).length : null,
    detail,
    href,
    icon,
    tone,
    loading: query.isLoading,
    error: query.isError,
  }
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
  const Icon = metric.icon
  const toneClass = {
    green: 'bg-mint text-forest',
    blue: 'bg-[#eaf2f8] text-[#35697d]',
    amber: 'bg-[#fff4df] text-amber',
    red: 'bg-[#fff0ed] text-coral',
  }[metric.tone]

  return (
    <Link
      to={metric.href}
      className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-panel transition hover:-translate-y-0.5 hover:border-forest/30 hover:shadow-panel-hover focus-visible:outline-forest"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneClass}`}>
          <Icon size={19} aria-hidden="true" />
        </span>
        <ArrowRight size={16} aria-hidden="true" className="mt-1 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-forest" />
      </div>
      <p className="mt-5 text-sm font-medium text-muted">{metric.label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-ink" aria-live="polite">
        {metric.loading && metric.value === null
          ? '…'
          : metric.error && metric.value === null
            ? 'Unavailable'
            : metric.value ?? 0}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted">
        {metric.error && metric.value !== null ? 'Showing the last loaded data.' : metric.detail}
      </p>
    </Link>
  )
}

function formatRelativeDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Time unavailable'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function credentialLabel(user: ApiUser): string {
  if (user.is_verified || user.verification_status === 'VERIFIED') return 'Verified'
  switch (user.verification_status) {
    case 'PENDING':
      return 'In review'
    case 'PENDING_EXTERNAL_ACCESS':
      return 'Awaiting regulator access'
    case 'REJECTED':
      return 'Action required'
    default:
      return 'Not submitted'
  }
}

function DashboardWorkspace({ role, user }: { role: UserRole; user: ApiUser }) {
  const token = useAuthStore((state) => state.accessToken)
  const queryClient = useQueryClient()
  const dashboard = roleDashboards[role]
  const isPlatformAdmin = role === 'ADMIN'
  const isFacilityManager = role === 'HOSPITAL_ADMIN'
  const isClinicalProfessional = ['DOCTOR', 'NURSE', 'SPECIALIST'].includes(role)
  const isFacilityOperationsRole = ['ADMIN', 'HOSPITAL_ADMIN', 'NURSE', 'STAFF'].includes(role)
  const canSeeContracts = ['ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'SPECIALIST'].includes(role)
  const canSeeBids = ['ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'SPECIALIST'].includes(role)
  const canSeeAssignments = isFacilityManager || isClinicalProfessional
  const canSeeReferrals = ['ADMIN', 'HOSPITAL_ADMIN', 'NURSE', 'STAFF'].includes(role)
  const canSeeAmbulances = ['ADMIN', 'HOSPITAL_ADMIN'].includes(role)
  const queryKey = (name: string) => ['dashboard', user.id, name]

  const notificationsQuery = useQuery({
    queryKey: queryKey('notifications'),
    queryFn: getNotifications,
    enabled: Boolean(token),
  })
  const hospitalsQuery = useQuery({
    queryKey: queryKey('facilities'),
    queryFn: getHospitals,
    enabled: Boolean(token) && isPlatformAdmin,
  })
  const membershipsQuery = useQuery({
    queryKey: queryKey('memberships'),
    queryFn: getMyHospitals,
    enabled: Boolean(token) && !isPlatformAdmin,
  })
  const contractsQuery = useQuery({
    queryKey: queryKey('contracts'),
    queryFn: getContracts,
    enabled: Boolean(token) && canSeeContracts,
  })
  const bidsQuery = useQuery({
    queryKey: queryKey('bids'),
    queryFn: getBids,
    enabled: Boolean(token) && canSeeBids,
  })
  const assignmentsQuery = useQuery({
    queryKey: queryKey('assignments'),
    queryFn: getAssignments,
    enabled: Boolean(token) && canSeeAssignments,
  })
  const appointmentsQuery = useQuery({
    queryKey: queryKey('appointments'),
    queryFn: getAppointments,
    enabled: Boolean(token) && isClinicalProfessional,
  })
  const referralsQuery = useQuery({
    queryKey: queryKey('referrals'),
    queryFn: getInterfacilityReferrals,
    enabled: Boolean(token) && canSeeReferrals,
  })
  const ambulanceQuery = useQuery({
    queryKey: queryKey('ambulances'),
    queryFn: getAmbulanceRequests,
    enabled: Boolean(token) && canSeeAmbulances,
  })
  const resourcesQuery = useQuery({
    queryKey: queryKey('resources'),
    queryFn: getHospitalResources,
    enabled: Boolean(token) && isFacilityOperationsRole,
  })
  const oxygenQuery = useQuery({
    queryKey: queryKey('oxygen'),
    queryFn: getOxygenSupplies,
    enabled: Boolean(token) && isFacilityOperationsRole,
  })

  const openContractsMetric = countMetric(
    contractsQuery,
    'Open opportunities',
    'Published contracts accepting bids.',
    '/staffing',
    BriefcaseMedical,
    'blue',
    (contract) => contract.status === 'OPEN',
  )
  const pendingBidsMetric = countMetric(
    bidsQuery,
    'Bids to review',
    'Bids awaiting a facility decision.',
    '/staffing',
    ClipboardList,
    'amber',
    (bid) => bid.status === 'PENDING',
  )
  const assignmentMetric = countMetric(
    assignmentsQuery,
    'Upcoming assignments',
    'Scheduled or active shifts.',
    '/staffing',
    CalendarCheck2,
    'green',
    (assignment) => (
      ['SCHEDULED', 'IN_PROGRESS'].includes(assignment.status)
      && new Date(assignment.end_datetime).getTime() >= Date.now()
    ),
  )
  const appointmentMetric = countMetric(
    appointmentsQuery,
    'Appointment requests',
    'Patient bookings waiting for professional review.',
    '/appointments',
    CalendarCheck2,
    'amber',
    (appointment) => appointment.status === 'REQUESTED',
  )
  const referralMetric = countMetric(
    referralsQuery,
    'Pending referrals',
    'Interfacility handoffs requiring coordination.',
    '/referrals',
    Handshake,
    'amber',
    (referral) => referral.status === 'PENDING',
  )
  const ambulanceMetric = countMetric(
    ambulanceQuery,
    'Active transports',
    'Requests not yet completed or cancelled.',
    '/ambulance',
    Ambulance,
    'blue',
    (request) => !['COMPLETED', 'CANCELLED'].includes(request.status),
  )
  const resourceMetric = countMetric(
    resourcesQuery,
    'Low-stock resources',
    'Facility resources at or below their threshold.',
    '/resources',
    Boxes,
    'red',
    (resource) => resource.is_low_stock,
  )
  const oxygenMetric = countMetric(
    oxygenQuery,
    'Oxygen alerts',
    'Supplies below their configured level threshold.',
    '/oxygen',
    Droplets,
    'red',
    (supply) => supply.is_low,
  )
  const unreadMetric = countMetric(
    notificationsQuery,
    'Unread notifications',
    'Updates that may need your attention.',
    '/notifications',
    Bell,
    'amber',
    (notification) => !notification.is_read,
  )
  const facilitiesMetric: DashboardMetric = {
    label: isPlatformAdmin ? 'Active facilities' : 'My facilities',
    value: isPlatformAdmin ? hospitalsQuery.data?.filter((hospital) => hospital.is_active).length ?? null
      : membershipsQuery.data?.filter((hospital) => hospital.is_active).length ?? null,
    detail: isPlatformAdmin ? 'Registered and active on the platform.' : 'Facilities linked to your account.',
    href: '/hospitals',
    icon: Building2,
    tone: 'green',
    loading: isPlatformAdmin ? hospitalsQuery.isLoading : membershipsQuery.isLoading,
    error: isPlatformAdmin ? hospitalsQuery.isError : membershipsQuery.isError,
  }
  const verificationMetric: DashboardMetric = {
    label: 'Credential status',
    value: credentialLabel(user),
    detail: user.is_verified
      ? 'Your professional profile is cleared for verified workflows.'
      : 'Review your profile and submit credentials if required.',
    href: '/settings',
    icon: ShieldCheck,
    tone: user.is_verified ? 'green' : 'amber',
    loading: false,
    error: false,
  }

  const metrics = role === 'ADMIN'
    ? [facilitiesMetric, openContractsMetric, referralMetric, ambulanceMetric, resourceMetric, oxygenMetric, unreadMetric]
    : role === 'HOSPITAL_ADMIN'
      ? [facilitiesMetric, pendingBidsMetric, referralMetric, assignmentMetric, resourceMetric, oxygenMetric, ambulanceMetric]
      : role === 'NURSE'
        ? [referralMetric, appointmentMetric, assignmentMetric, resourceMetric, oxygenMetric, unreadMetric]
        : role === 'STAFF'
          ? [referralMetric, resourceMetric, oxygenMetric, unreadMetric]
          : [openContractsMetric, appointmentMetric, assignmentMetric, verificationMetric, unreadMetric]

  const workItems: WorkItem[] = []
  const pendingReferrals = referralsQuery.data?.filter((referral) => referral.status === 'PENDING').length ?? 0
  const pendingBids = bidsQuery.data?.filter((bid) => bid.status === 'PENDING').length ?? 0
  const lowResources = resourcesQuery.data?.filter((resource) => resource.is_low_stock).length ?? 0
  const lowOxygen = oxygenQuery.data?.filter((supply) => supply.is_low).length ?? 0
  const activeTransports = ambulanceQuery.data?.filter(
    (request) => !['COMPLETED', 'CANCELLED'].includes(request.status),
  ).length ?? 0
  const upcomingAssignments = assignmentsQuery.data?.filter((assignment) => (
    ['SCHEDULED', 'IN_PROGRESS'].includes(assignment.status)
    && new Date(assignment.end_datetime).getTime() >= Date.now()
  )).length ?? 0
  const appointmentRequests = appointmentsQuery.data?.filter(
    (appointment) => appointment.status === 'REQUESTED',
  ).length ?? 0

  if (pendingReferrals > 0) {
    workItems.push({
      title: 'Review interfacility referrals',
      detail: 'Triage handoffs are waiting for facility coordination.',
      href: '/referrals',
      icon: Handshake,
      count: pendingReferrals,
    })
  }
  if (isFacilityManager && pendingBids > 0) {
    workItems.push({
      title: 'Review professional bids',
      detail: 'Compare pending bids before filling open contracts.',
      href: '/staffing',
      icon: BriefcaseMedical,
      count: pendingBids,
    })
  }
  if (isClinicalProfessional && appointmentRequests > 0) {
    workItems.push({
      title: 'Review appointment requests',
      detail: 'Confirm or manage patient booking requests.',
      href: '/appointments',
      icon: CalendarCheck2,
      count: appointmentRequests,
    })
  }
  if (lowResources > 0) {
    workItems.push({
      title: 'Update low-stock resources',
      detail: 'Check the latest counts and record a verified adjustment.',
      href: '/resources',
      icon: Boxes,
      count: lowResources,
    })
  }
  if (lowOxygen > 0) {
    workItems.push({
      title: 'Check oxygen availability',
      detail: 'Review supplies flagged below their configured threshold.',
      href: '/oxygen',
      icon: Droplets,
      count: lowOxygen,
    })
  }
  if (activeTransports > 0) {
    workItems.push({
      title: 'Coordinate active transport',
      detail: 'Review dispatch status and live driver location.',
      href: '/ambulance',
      icon: Ambulance,
      count: activeTransports,
    })
  }
  if (upcomingAssignments > 0 && canSeeAssignments) {
    workItems.push({
      title: isFacilityManager ? 'Track facility assignments' : 'Prepare for your next shift',
      detail: isFacilityManager
        ? 'Review staffing coverage and active shifts.'
        : 'Review assignment details and check-in requirements.',
      href: '/staffing',
      icon: CalendarCheck2,
      count: upcomingAssignments,
    })
  }
  if (isClinicalProfessional && !user.is_verified) {
    workItems.push({
      title: 'Check credential verification',
      detail: `${credentialLabel(user)}. Credential checks remain subject to authorized regulator access.`,
      href: '/settings',
      icon: ShieldCheck,
    })
  }

  const displayName = user.first_name || user.full_name || 'there'
  const hasWorkQueueError = (
    (canSeeReferrals && referralsQuery.isError)
    || (isFacilityOperationsRole && (resourcesQuery.isError || oxygenQuery.isError))
    || (canSeeAmbulances && ambulanceQuery.isError)
    || (isFacilityManager && bidsQuery.isError)
    || (canSeeAssignments && assignmentsQuery.isError)
    || (isClinicalProfessional && appointmentsQuery.isError)
  )
  const isWorkQueueLoading = (
    (canSeeReferrals && referralsQuery.isLoading)
    || (isFacilityOperationsRole && (resourcesQuery.isLoading || oxygenQuery.isLoading))
    || (canSeeAmbulances && ambulanceQuery.isLoading)
    || (isFacilityManager && bidsQuery.isLoading)
    || (canSeeAssignments && assignmentsQuery.isLoading)
    || (isClinicalProfessional && appointmentsQuery.isLoading)
  )

  return (
    <div className="min-h-screen bg-canvas text-ink lg:flex">
      <aside className="flex shrink-0 flex-col bg-navy text-white lg:sticky lg:top-0 lg:h-screen lg:w-[236px]">
        <Link to={dashboardPathForRole(role)} className="flex items-center gap-3 px-5 py-5 lg:px-6 lg:py-7">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d8eee4] text-forest">
            <Activity size={21} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-[15px] font-semibold tracking-tight">MediConnect</span>
            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">Care workspace</span>
          </span>
        </Link>
        <WorkspaceNavigation current={dashboardPathForRole(role)} />
      </aside>

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-7 sm:py-8 xl:px-10">
        <div className="mx-auto max-w-[1440px]">
          <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200/80 pb-6">
            <div>
              <p className="text-sm font-semibold text-forest">Welcome back, {displayName}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-[30px]">{dashboard.title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{dashboard.description}</p>
              {isFacilityManager && membershipsQuery.data?.[0] && (
                <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-muted ring-1 ring-slate-200">
                  <Building2 size={14} className="text-forest" aria-hidden="true" />
                  {membershipsQuery.data[0].name}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ['dashboard', user.id] })}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-ink shadow-sm transition hover:border-forest/40 hover:text-forest"
              aria-label="Refresh dashboard data"
            >
              <RefreshCw size={15} aria-hidden="true" />
              Refresh data
            </button>
          </header>

          <section aria-label="Operational overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
          </section>

          <section className="mt-7 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-panel sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-forest">Work queue</p>
                  <h2 className="mt-1 text-lg font-semibold text-ink">What needs your attention</h2>
                </div>
                <span className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-muted">
                  {workItems.length} items
                </span>
              </div>
              {hasWorkQueueError && (
                <p role="alert" className="mt-4 rounded-xl bg-[#fff4df] px-4 py-3 text-sm text-[#795515]">
                  Some operational data could not be loaded. Check the overview cards or reopen the relevant tool.
                </p>
              )}
              {workItems.length > 0 ? (
                <div className="mt-4 divide-y divide-slate-100">
                  {workItems.slice(0, 5).map((item) => {
                    const Icon = item.icon
                    return (
                      <Link key={item.title} to={item.href} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-canvas text-forest">
                          <Icon size={18} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-ink">{item.title}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-muted">{item.detail}</span>
                        </span>
                        {item.count !== undefined && (
                          <span className="rounded-full bg-[#fff4df] px-2.5 py-1 text-xs font-bold text-amber">{item.count}</span>
                        )}
                        <ArrowRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                      </Link>
                    )
                  })}
                </div>
              ) : isWorkQueueLoading ? (
                <p role="status" className="mt-5 text-sm text-muted">Checking your current work…</p>
              ) : hasWorkQueueError ? null : (
                <div className="mt-5 rounded-xl bg-canvas px-4 py-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <CheckCircle2 size={17} className="text-forest" aria-hidden="true" />
                    No priority items need your attention.
                  </div>
                  <p className="mt-1 pl-6 text-sm text-muted">Use the shortcuts below to continue your work.</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-panel sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-forest">Recent updates</p>
                  <h2 className="mt-1 text-lg font-semibold text-ink">Notifications</h2>
                </div>
                <Bell size={18} className="mt-1 text-forest" aria-hidden="true" />
              </div>
              {notificationsQuery.isLoading && <p role="status" className="mt-4 text-sm text-muted">Loading notifications…</p>}
              {notificationsQuery.isError && <p role="alert" className="mt-4 text-sm text-coral">Notifications could not be loaded.</p>}
              {!notificationsQuery.isLoading && !notificationsQuery.isError && notificationsQuery.data?.length === 0 && (
                <p className="mt-4 rounded-xl bg-canvas px-4 py-5 text-sm text-muted">No notifications yet.</p>
              )}
              <div className="mt-4 space-y-3">
                {notificationsQuery.data?.slice(0, 4).map((notification) => (
                  <article key={notification.id} className="rounded-xl bg-canvas/80 p-3.5">
                    <div className="flex items-start gap-2.5">
                      {!notification.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-forest" aria-label="Unread" />}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">{notification.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{notification.message}</p>
                        <p className="mt-1.5 text-[11px] font-medium text-muted">{formatRelativeDate(notification.created_at)}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <Link to="/notifications" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-forest hover:underline">
                View all notifications <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </section>

          <section className="mt-7">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-forest">Shortcuts</p>
                <h2 className="mt-1 text-lg font-semibold text-ink">Go straight to a task</h2>
              </div>
              <p className="text-xs text-muted">Tools are limited to your role and facility access.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {dashboard.features.slice(0, 4).map(({ to, label, description, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="group flex min-h-[116px] items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-panel transition hover:-translate-y-0.5 hover:border-forest/30 hover:shadow-panel-hover"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint text-forest">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{label}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted">{description}</span>
                  </span>
                  <ArrowRight size={15} className="mt-1 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-forest" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export function RoleDashboardPage() {
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const { role: roleSlug } = useParams()

  if (!token || !user) return <Navigate to="/connect" replace />

  const requestedRole = roleForDashboardSlug(roleSlug)
  if (!requestedRole || requestedRole !== user.role) {
    return <Navigate to={dashboardPathForRole(user.role)} replace />
  }

  if (requestedRole === 'PATIENT') return <PatientDashboard />
  return <DashboardWorkspace role={requestedRole} user={user} />
}
