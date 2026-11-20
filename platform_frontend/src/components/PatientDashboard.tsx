import { useQuery } from '@tanstack/react-query'
import { Activity, Ambulance, CalendarPlus, Clock3, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  getAmbulanceRequests,
  getAppointments,
  getNotifications,
  getUserProfile,
} from '../lib/api'
import { useAuthStore } from '../store/auth'
import type { AmbulanceRequest, Appointment, NotificationRecord } from '../types'
import { NearbyHospitalsPanel } from './NearbyHospitalsPanel'
import { PatientResourcePanel } from './PatientResourcePanel'
import { WorkspaceNavigation } from './WorkspaceNavigation'
import { Card, CardHeader, CardTitle } from './ui/card'

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString()
}

function displayStatus(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())
}

function PanelError({ children }: { children: string }) {
  return <p role="alert" className="mt-4 text-sm text-[#9d4937]">{children}</p>
}

function LoadingText() {
  return <p className="mt-4 text-sm text-muted">Loading…</p>
}

function NotificationPanel({
  isLoading,
  isError,
  notifications,
}: {
  isLoading: boolean
  isError: boolean
  notifications: NotificationRecord[]
}) {
  const unreadCount = notifications.filter((notification) => !notification.is_read).length
  return (
    <Card className="p-5">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>User Notifications</CardTitle>
          <span className="rounded-full bg-mint px-2.5 py-1 text-xs font-semibold text-forest">{unreadCount} unread</span>
        </div>
        <p className="mt-1 text-sm text-muted">Recent updates about your requests and account.</p>
      </CardHeader>
      {isLoading && <LoadingText />}
      {isError && <PanelError>Notifications could not be loaded.</PanelError>}
      {!isLoading && !isError && notifications.length === 0 && (
        <p className="mt-4 text-sm text-muted">You have no notifications yet.</p>
      )}
      <div className="mt-4 space-y-3">
        {notifications.slice(0, 3).map((notification) => (
          <div key={notification.id} className="border-b border-[#e8ede9] pb-3 last:border-0 last:pb-0">
            <div className="flex items-start gap-2">
              {!notification.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-forest" aria-label="Unread" />}
              <div>
                <p className="text-sm font-semibold">{notification.title}</p>
                <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">{notification.message}</p>
                <p className="mt-1 text-xs text-muted">{formatDateTime(notification.created_at)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Link to="/notifications" className="mt-4 inline-flex text-sm font-semibold text-forest hover:underline">View all notifications</Link>
    </Card>
  )
}

function AmbulancePanel({
  isLoading,
  isError,
  request,
}: {
  isLoading: boolean
  isError: boolean
  request?: AmbulanceRequest
}) {
  return (
    <Card className="p-5">
      <CardHeader>
        <CardTitle>Ambulance services</CardTitle>
        <p className="mt-1 text-sm text-muted">Request transport and check the latest status.</p>
      </CardHeader>
      {isLoading && <LoadingText />}
      {isError && <PanelError>Ambulance requests could not be loaded.</PanelError>}
      {!isLoading && !isError && request && (
        <div className="mt-4 rounded-lg bg-canvas p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">{request.destination_hospital_name}</p>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-forest">{displayStatus(request.status)}</span>
          </div>
          <p className="mt-1 text-sm text-muted">{request.destination_hospital_city}</p>
          <p className="mt-2 text-xs text-muted">Updated {formatDateTime(request.updated_at)}</p>
        </div>
      )}
      {!isLoading && !isError && !request && <p className="mt-4 text-sm text-muted">No ambulance requests yet.</p>}
      <Link to="/ambulance" className="mt-4 inline-flex items-center gap-2 rounded-md bg-forest px-3 py-2 text-sm font-semibold text-white hover:bg-[#164333]">
        <Ambulance size={16} aria-hidden="true" /> Open ambulance services
      </Link>
    </Card>
  )
}

function AppointmentPanel({
  appointments,
  isLoading,
  isError,
}: {
  appointments: Appointment[]
  isLoading: boolean
  isError: boolean
}) {
  const upcoming = appointments
    .filter((appointment) => appointment.status !== 'CANCELLED' && new Date(appointment.start_datetime).getTime() >= Date.now())
    .slice(0, 3)

  return (
    <Card className="p-5">
      <CardHeader>
        <CardTitle>Appointments</CardTitle>
        <p className="mt-1 text-sm text-muted">Your next scheduled care and booking requests.</p>
      </CardHeader>
      {isLoading && <LoadingText />}
      {isError && <PanelError>Appointments could not be loaded.</PanelError>}
      {!isLoading && !isError && upcoming.length === 0 && <p className="mt-4 text-sm text-muted">No upcoming appointments.</p>}
      <div className="mt-4 space-y-3">
        {upcoming.map((appointment) => (
          <div key={appointment.id} className="rounded-lg bg-canvas p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold">{appointment.professional_name}</p>
              <span className="text-xs font-medium text-forest">{displayStatus(appointment.status)}</span>
            </div>
            {appointment.professional_specialization && (
              <p className="mt-1 text-xs text-muted">{appointment.professional_specialization}</p>
            )}
            <p className="mt-2 flex items-center gap-2 text-xs text-muted">
              <Clock3 size={14} aria-hidden="true" />
              {formatDateTime(appointment.start_datetime)} · {appointment.duration_minutes} minutes
            </p>
          </div>
        ))}
      </div>
      <Link to="/appointments" className="mt-4 inline-flex items-center gap-2 rounded-md bg-forest px-3 py-2 text-sm font-semibold text-white hover:bg-[#164333]">
        <CalendarPlus size={16} aria-hidden="true" /> Book or manage appointments
      </Link>
    </Card>
  )
}

function ProfilePanel({ name, email, phone }: { name: string; email: string; phone: string }) {
  return (
    <Card className="p-5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-forest" aria-hidden="true" />
          <CardTitle>Profile settings</CardTitle>
        </div>
        <p className="mt-1 text-sm text-muted">Your account contact information.</p>
      </CardHeader>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Name</dt>
          <dd className="mt-0.5 font-medium">{name}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Email</dt>
          <dd className="mt-0.5 break-all font-medium">{email}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Phone</dt>
          <dd className="mt-0.5 font-medium">{phone || 'Add a contact number in your profile.'}</dd>
        </div>
      </dl>
      <Link to="/settings" className="mt-4 inline-flex text-sm font-semibold text-forest hover:underline">Edit profile settings</Link>
    </Card>
  )
}

export function PatientDashboard() {
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    enabled: Boolean(token),
  })
  const ambulanceQuery = useQuery({
    queryKey: ['ambulance-requests'],
    queryFn: getAmbulanceRequests,
    enabled: Boolean(token),
  })
  const appointmentsQuery = useQuery({
    queryKey: ['appointments'],
    queryFn: getAppointments,
    enabled: Boolean(token),
  })
  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: getUserProfile,
    enabled: Boolean(token),
  })
  const profile = profileQuery.data
  const name = profile?.full_name || user?.full_name || `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim()
  const activeAmbulanceRequest = ambulanceQuery.data?.find(
    (request) => !['COMPLETED', 'CANCELLED'].includes(request.status),
  ) ?? ambulanceQuery.data?.[0]

  return (
    <div className="min-h-screen bg-canvas text-ink lg:flex">
      <aside className="flex shrink-0 flex-col bg-navy text-white lg:sticky lg:top-0 lg:h-screen lg:w-[236px]">
        <Link to="/dashboard/patient" className="flex items-center gap-3 px-5 py-5 lg:px-6 lg:py-7">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#d8eee4] text-forest">
            <Activity size={21} aria-hidden="true" />
          </span>
          <span><span className="block text-[15px] font-semibold">MediConnect</span><span className="mt-0.5 block text-[11px] text-white/55">PATIENT CARE</span></span>
        </Link>
        <WorkspaceNavigation current="/dashboard/patient" />
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-7">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-forest">Welcome, {name || 'Patient'}</p>
              <h1 className="mt-1 text-2xl font-semibold">Your care dashboard</h1>
              <p className="mt-2 text-sm text-muted">Notifications, transport, hospitals, appointments, and your profile in one place.</p>
            </div>
            <Link to="/appointments" className="inline-flex items-center gap-2 rounded-md bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#164333]">
              <CalendarPlus size={16} aria-hidden="true" /> Book an appointment
            </Link>
          </header>

          <section aria-label="Patient care overview" className="grid gap-5 lg:grid-cols-2">
            <NotificationPanel
              isLoading={notificationsQuery.isLoading}
              isError={notificationsQuery.isError}
              notifications={notificationsQuery.data ?? []}
            />
            <AmbulancePanel
              isLoading={ambulanceQuery.isLoading}
              isError={ambulanceQuery.isError}
              request={activeAmbulanceRequest}
            />
            <NearbyHospitalsPanel />
            <PatientResourcePanel />
            <AppointmentPanel
              appointments={appointmentsQuery.data ?? []}
              isLoading={appointmentsQuery.isLoading}
              isError={appointmentsQuery.isError}
            />
            <ProfilePanel
              name={name || 'Patient'}
              email={profile?.email || user?.email || ''}
              phone={profile?.phone || user?.phone || ''}
            />
          </section>
          {profileQuery.isError && (
            <p role="alert" className="mt-4 text-sm text-[#9d4937]">Profile details could not be loaded. You can still update them in profile settings.</p>
          )}
        </div>
      </main>
    </div>
  )
}
