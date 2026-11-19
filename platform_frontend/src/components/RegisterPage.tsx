import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Activity, ArrowLeft, UserRoundPlus } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { registerProfessional } from '../lib/api'
import type { UserRegistration } from '../types'

const initialForm: UserRegistration = {
  email: '',
  password: '',
  password_confirm: '',
  first_name: '',
  last_name: '',
  role: 'DOCTOR',
  phone: '',
  license_number: '',
  specialization: '',
  years_of_experience: 0,
  bio: '',
  preferred_locations: [],
}

export function RegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = (location.state as { from?: string } | null)?.from
  const [form, setForm] = useState(initialForm)
  const [locations, setLocations] = useState('')
  const [error, setError] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: registerProfessional,
    onSuccess: () => navigate('/connect', { replace: true, state: { registered: true, from: returnTo } }),
    onError: () => setError('Registration failed. Check your details, password policy, and API connection.'),
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (form.password !== form.password_confirm) {
      setError('The passwords do not match.')
      return
    }
    if (!Number.isSafeInteger(form.years_of_experience) || form.years_of_experience < 0) {
      setError('Years of experience must be a whole number of zero or more.')
      return
    }
    setError(null)
    mutation.mutate({
      ...form,
      email: form.email.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      preferred_locations: locations.split(',').map((item) => item.trim()).filter(Boolean),
    })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-5 py-10">
      <div className="w-full max-w-2xl">
        <Link to="/connect" state={returnTo ? { from: returnTo } : undefined} className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft size={16} aria-hidden="true" /> Back to sign in
        </Link>
        <section className="rounded-xl border border-black/[0.06] bg-white p-6 shadow-panel sm:p-9">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-mint text-forest">
            <Activity size={23} aria-hidden="true" />
          </div>
          <p className="text-xs font-bold uppercase text-forest">MediConnect</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">Create an account</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Patients, doctors, nurses, specialists, and staff can register. Administrator accounts are created by the platform.</p>

          <form onSubmit={submit} className="mt-7 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-ink">First name
                <input required autoComplete="given-name" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-[#d8e0db] px-3" />
              </label>
              <label className="text-sm font-medium text-ink">Last name
                <input required autoComplete="family-name" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-[#d8e0db] px-3" />
              </label>
              <label className="text-sm font-medium text-ink">Email
                <input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-[#d8e0db] px-3" />
              </label>
              <label className="text-sm font-medium text-ink">Role
                <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as UserRegistration['role'] })} className="mt-2 h-10 w-full rounded-md border border-[#d8e0db] bg-white px-3">
                  <option value="DOCTOR">Doctor</option>
                  <option value="NURSE">Nurse</option>
                  <option value="SPECIALIST">Specialist</option>
                  <option value="STAFF">Staff</option>
                  <option value="PATIENT">Patient</option>
                </select>
              </label>
              <label className="text-sm font-medium text-ink">Phone
                <input autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-[#d8e0db] px-3" />
              </label>
              {form.role !== 'PATIENT' && (
                <>
                  <label className="text-sm font-medium text-ink">License number
                    <input value={form.license_number} onChange={(event) => setForm({ ...form, license_number: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-[#d8e0db] px-3" />
                  </label>
                  <label className="text-sm font-medium text-ink">Specialization
                    <input value={form.specialization} onChange={(event) => setForm({ ...form, specialization: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-[#d8e0db] px-3" />
                  </label>
                  <label className="text-sm font-medium text-ink">Years of experience
                    <input type="number" min={0} step={1} value={form.years_of_experience} onChange={(event) => setForm({ ...form, years_of_experience: Number(event.target.value) })} className="mt-2 h-10 w-full rounded-md border border-[#d8e0db] px-3" />
                  </label>
                </>
              )}
              <label className="text-sm font-medium text-ink">Password
                <input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-[#d8e0db] px-3" />
              </label>
              <label className="text-sm font-medium text-ink">Confirm password
                <input required minLength={8} type="password" autoComplete="new-password" value={form.password_confirm} onChange={(event) => setForm({ ...form, password_confirm: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-[#d8e0db] px-3" />
              </label>
              <label className="text-sm font-medium text-ink sm:col-span-2">Preferred locations <span className="font-normal text-muted">(comma-separated)</span>
                <input value={locations} onChange={(event) => setLocations(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-[#d8e0db] px-3" />
              </label>
              <label className="text-sm font-medium text-ink sm:col-span-2">Professional bio
                <textarea rows={3} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} className="mt-2 w-full rounded-md border border-[#d8e0db] px-3 py-2" />
              </label>
            </div>
            {error && <p role="alert" className="rounded-md bg-[#fff1ed] px-3 py-2.5 text-sm text-[#9d4937]">{error}</p>}
            <button type="submit" disabled={mutation.isPending} className="inline-flex h-11 items-center gap-2 rounded-md bg-forest px-5 text-sm font-semibold text-white hover:bg-[#164333] disabled:opacity-60">
              <UserRoundPlus size={16} aria-hidden="true" />{mutation.isPending ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
