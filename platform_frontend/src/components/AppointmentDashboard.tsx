import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, CalendarPlus, Clock3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  createAppointment,
  getAppointments,
  getHealthcareProfessionals,
} from '../lib/api'
import { useAuthStore } from '../store/auth'
import { WorkspaceNavigation } from './WorkspaceNavigation'
import { Card, CardHeader, CardTitle } from './ui/card'

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString()
}

export function AppointmentDashboard() {
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const [professionalId, setProfessionalId] = useState('')
  const [patientName, setPatientName] = useState('')
  const [patientEmail, setPatientEmail] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [startDateTime, setStartDateTime] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (!user) return
    setPatientName(user.full_name || `${user.first_name} ${user.last_name}`.trim())
    setPatientEmail(user.email)
    setPatientPhone(user.phone ?? '')
  }, [user])

  const professionalsQuery = useQuery({
    queryKey: ['appointment-professionals'],
    queryFn: getHealthcareProfessionals,
    enabled: Boolean(token && user?.role === 'PATIENT'),
  })
  const appointmentsQuery = useQuery({
    queryKey: ['appointments'],
    queryFn: getAppointments,
    enabled: Boolean(token && user?.role === 'PATIENT'),
  })
  const bookingMutation = useMutation({
    mutationFn: createAppointment,
    onSuccess: async (appointment) => {
      await queryClient.invalidateQueries({ queryKey: ['appointments'] })
      setStartDateTime('')
      setSuccessMessage(`Your request with ${appointment.professional_name} has been submitted.`)
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSuccessMessage('')
    bookingMutation.mutate({
      professional: Number(professionalId),
      patient_name: patientName.trim(),
      patient_email: patientEmail.trim(),
      patient_phone: patientPhone.trim(),
      start_datetime: new Date(startDateTime).toISOString(),
      duration_minutes: durationMinutes,
    })
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-5 text-ink">
        <Card className="max-w-lg p-7">
          <CardHeader><CardTitle>Book an appointment</CardTitle></CardHeader>
          <p className="mt-3 text-sm leading-6 text-muted">Sign in with a patient account to book time with a healthcare professional.</p>
          <div className="mt-5 flex gap-3">
            <Link to="/connect" state={{ from: '/appointments' }} className="rounded-md bg-forest px-4 py-2 text-sm font-semibold text-white">Sign in</Link>
            <Link to="/register" state={{ from: '/appointments' }} className="rounded-md border border-[#d8e0db] px-4 py-2 text-sm font-semibold text-ink">Create patient account</Link>
          </div>
        </Card>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-canvas text-ink lg:flex">
      <aside className="flex shrink-0 flex-col bg-navy text-white lg:sticky lg:top-0 lg:h-screen lg:w-[236px]">
        <Link to="/" className="flex items-center gap-3 px-5 py-5 lg:px-6 lg:py-7">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#d8eee4] text-forest">
            <Activity size={21} aria-hidden="true" />
          </span>
          <span><span className="block text-[15px] font-semibold">MediConnect</span><span className="mt-0.5 block text-[11px] text-white/55">CARE OPERATIONS</span></span>
        </Link>
        <WorkspaceNavigation current="/appointments" />
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-7">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6">
            <p className="text-xs font-bold uppercase tracking-wide text-forest">Patient care</p>
            <h1 className="mt-1 text-2xl font-semibold">Book an appointment</h1>
            <p className="mt-1 text-sm text-muted">Choose an available professional and request a date, time, and duration.</p>
          </header>

          {user?.role !== 'PATIENT' ? (
            <Card className="max-w-2xl p-5">
              <CardHeader><CardTitle>Patient account required</CardTitle></CardHeader>
              <p className="mt-2 text-sm leading-6 text-muted">Appointment bookings can only be created from a patient account. Sign in with one or switch accounts.</p>
            </Card>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
              <Card className="p-5">
                <CardHeader>
                  <CardTitle>Appointment details</CardTitle>
                  <p className="mt-1 text-sm text-muted">Your name and contact details will be saved with the request.</p>
                </CardHeader>
                <form className="mt-5 space-y-4" onSubmit={submit}>
                  <label className="block text-sm font-medium text-ink">
                    Healthcare professional
                    <select
                      className="mt-2 h-10 w-full rounded-md border border-[#d8e0db] bg-white px-3"
                      value={professionalId}
                      onChange={(event) => setProfessionalId(event.target.value)}
                      required
                    >
                      <option value="">Select a professional</option>
                      {(professionalsQuery.data ?? []).map((professional) => (
                        <option key={professional.id} value={professional.id}>
                          {professional.full_name} — {professional.role.replace('_', ' ')}{professional.specialization ? ` · ${professional.specialization}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  {professionalsQuery.isLoading && <p className="text-xs text-muted">Loading available professionals…</p>}
                  {professionalsQuery.isError && <p role="alert" className="text-sm text-[#9d4937]">Available professionals could not be loaded. Please try again.</p>}
                  {!professionalsQuery.isLoading && !professionalsQuery.isError && professionalsQuery.data?.length === 0 && (
                    <p className="rounded-md bg-[#fff9ed] px-3 py-2 text-sm text-[#76551a]">No professionals are currently available for booking.</p>
                  )}

                  <label className="block text-sm font-medium text-ink">
                    Patient name
                    <input
                      autoComplete="name"
                      className="mt-2 h-10 w-full rounded-md border border-[#d8e0db] px-3"
                      onChange={(event) => setPatientName(event.target.value)}
                      required
                      value={patientName}
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    Email address
                    <input
                      autoComplete="email"
                      className="mt-2 h-10 w-full rounded-md border border-[#d8e0db] px-3"
                      onChange={(event) => setPatientEmail(event.target.value)}
                      required={!patientPhone.trim()}
                      type="email"
                      value={patientEmail}
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    Contact number
                    <input
                      autoComplete="tel"
                      className="mt-2 h-10 w-full rounded-md border border-[#d8e0db] px-3"
                      onChange={(event) => setPatientPhone(event.target.value)}
                      required={!patientEmail.trim()}
                      type="tel"
                      value={patientPhone}
                    />
                  </label>
                  <p className="-mt-2 text-xs text-muted">Provide at least one contact method.</p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-ink">
                      Date and time
                      <input
                        className="mt-2 h-10 w-full rounded-md border border-[#d8e0db] bg-white px-3"
                        min={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16)}
                        onChange={(event) => setStartDateTime(event.target.value)}
                        required
                        type="datetime-local"
                        value={startDateTime}
                      />
                    </label>
                    <label className="block text-sm font-medium text-ink">
                      Duration (minutes)
                      <input
                        className="mt-2 h-10 w-full rounded-md border border-[#d8e0db] px-3"
                        max={480}
                        min={15}
                        onChange={(event) => setDurationMinutes(Number(event.target.value))}
                        required
                        step={15}
                        type="number"
                        value={durationMinutes}
                      />
                    </label>
                  </div>

                  {bookingMutation.isError && (
                    <p role="alert" className="rounded-md bg-[#fff1ed] px-3 py-2.5 text-sm text-[#9d4937]">
                      Appointment could not be submitted. Check the details and try again.
                    </p>
                  )}
                  {successMessage && (
                    <p role="status" className="rounded-md bg-[#eaf3ee] px-3 py-2.5 text-sm text-[#28664e]">
                      {successMessage}
                    </p>
                  )}
                  <button
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-forest px-4 text-sm font-semibold text-white transition hover:bg-[#164333] disabled:cursor-wait disabled:opacity-70"
                    disabled={bookingMutation.isPending || !professionalsQuery.data?.length}
                    type="submit"
                  >
                    <CalendarPlus size={16} aria-hidden="true" />
                    {bookingMutation.isPending ? 'Submitting…' : 'Request appointment'}
                  </button>
                </form>
              </Card>

              <Card className="p-5">
                <CardHeader>
                  <CardTitle>Your appointment requests</CardTitle>
                  <p className="mt-1 text-sm text-muted">Review the date, professional, and request status.</p>
                </CardHeader>
                {appointmentsQuery.isLoading && <p className="mt-5 text-sm text-muted">Loading your appointments…</p>}
                {appointmentsQuery.isError && <p role="alert" className="mt-5 text-sm text-[#9d4937]">Your appointments could not be loaded. Please try again.</p>}
                {!appointmentsQuery.isLoading && !appointmentsQuery.isError && appointmentsQuery.data?.length === 0 && (
                  <p className="mt-5 rounded-md bg-canvas px-3 py-4 text-sm text-muted">You have no appointment requests yet.</p>
                )}
                <div className="mt-4 space-y-3">
                  {(appointmentsQuery.data ?? []).map((appointment) => (
                    <article key={appointment.id} className="rounded-lg border border-[#e4e9e5] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="font-semibold">{appointment.professional_name}</h2>
                          <p className="mt-1 text-sm text-muted">
                            {appointment.professional_role.replace('_', ' ')}
                            {appointment.professional_specialization ? ` · ${appointment.professional_specialization}` : ''}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#eaf3ee] px-2.5 py-1 text-xs font-semibold text-[#28664e]">
                          {appointment.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                        <Clock3 size={15} aria-hidden="true" />
                        {formatDateTime(appointment.start_datetime)} · {appointment.duration_minutes} minutes
                      </p>
                    </article>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
