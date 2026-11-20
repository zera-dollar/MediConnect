import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, AlertTriangle, CheckCircle2, LogOut, RefreshCw, Settings, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  changePassword,
  getNotificationPreferences,
  getProfessionalDocuments,
  getUserProfile,
  updateNotificationPreferences,
  updateUserProfile,
  uploadProfessionalDocument,
} from '../lib/api'
import { useAuthStore } from '../store/auth'
import type { ChangePasswordRequest, CredentialVerificationStatus, UserProfileUpdate } from '../types'
import { Card, CardHeader, CardTitle } from './ui/card'
import { WorkspaceNavigation } from './WorkspaceNavigation'

const availabilityOptions = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'BUSY', label: 'Busy' },
  { value: 'ON_LEAVE', label: 'On leave' },
  { value: 'NOT_AVAILABLE', label: 'Not available' },
] as const

interface ProfileForm {
  first_name: string
  last_name: string
  phone: string
  license_number: string
  specialization: string
  years_of_experience: string
  bio: string
  preferred_locations: string
  availability_status: UserProfileUpdate['availability_status']
}

interface PasswordForm {
  old_password: string
  new_password: string
  new_password_confirm: string
}

const emptyProfile: ProfileForm = {
  first_name: '',
  last_name: '',
  phone: '',
  license_number: '',
  specialization: '',
  years_of_experience: '0',
  bio: '',
  preferred_locations: '',
  availability_status: 'AVAILABLE',
}

const emptyPassword: PasswordForm = {
  old_password: '',
  new_password: '',
  new_password_confirm: '',
}

export function profileFormToUpdate(form: ProfileForm): UserProfileUpdate {
  return {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    phone: form.phone.trim(),
    license_number: form.license_number.trim(),
    specialization: form.specialization.trim(),
    years_of_experience: Number(form.years_of_experience),
    bio: form.bio.trim(),
    preferred_locations: form.preferred_locations.split(',').map((location) => location.trim()).filter(Boolean),
    availability_status: form.availability_status,
  }
}

export function validateProfileForm(form: ProfileForm): string | null {
  if (!form.first_name.trim() || !form.last_name.trim()) return 'First and last name are required.'
  if (!/^\d+$/.test(form.years_of_experience) || !Number.isSafeInteger(Number(form.years_of_experience))) {
    return 'Years of experience must be a whole number of zero or more.'
  }
  return null
}

export function validatePasswordForm(form: PasswordForm): string | null {
  if (!form.old_password || !form.new_password || !form.new_password_confirm) return 'Complete all password fields.'
  if (form.new_password !== form.new_password_confirm) return 'New password entries do not match.'
  if (form.old_password === form.new_password) return 'Choose a new password different from your current password.'
  return null
}

export function credentialStatusLabel(status: CredentialVerificationStatus | undefined): string {
  switch (status) {
    case 'VERIFIED':
      return 'Verified'
    case 'PENDING_EXTERNAL_ACCESS':
      return 'Waiting for authorized KMPDC/registry access'
    case 'PENDING':
      return 'Queued for verification'
    case 'REJECTED':
      return 'Verification rejected'
    default:
      return 'Not submitted'
  }
}

export function SettingsLoadingState() {
  return <div className="mt-5 rounded-lg border border-black/[0.06] bg-white px-5 py-8 text-center text-sm text-muted" role="status">Loading account settings…</div>
}

export function SettingsErrorNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mt-5 flex items-start gap-3 rounded-md border border-[#f0c9bd] bg-[#fff6f3] p-4 text-sm text-[#8f4635]" role="alert">
      <AlertTriangle className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
      <div className="flex-1"><p className="font-semibold">Could not load account settings</p><p className="mt-1">Check the backend connection and your access, then try again.</p></div>
      <button onClick={onRetry} className="rounded border border-[#e4b6a9] px-3 py-1.5 text-xs font-semibold" type="button">Retry</button>
    </div>
  )
}

export function SystemSettingsDashboard() {
  const queryClient = useQueryClient()
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const updateUser = useAuthStore((state) => state.updateUser)
  const clearSession = useAuthStore((state) => state.clearSession)
  const isLive = Boolean(token)
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile)
  const [password, setPassword] = useState<PasswordForm>(emptyPassword)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [documentType, setDocumentType] = useState('LICENSE')
  const [documentDescription, setDocumentDescription] = useState('')
  const [documentFile, setDocumentFile] = useState<File | null>(null)

  const profileQuery = useQuery({
    queryKey: ['user-profile'],
    queryFn: getUserProfile,
    enabled: isLive,
  })
  const preferencesQuery = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: getNotificationPreferences,
    enabled: isLive,
  })
  const documentsQuery = useQuery({
    queryKey: ['professional-documents'],
    queryFn: getProfessionalDocuments,
    enabled: isLive,
  })

  useEffect(() => {
    if (!profileQuery.data) return
    const data = profileQuery.data
    setProfile({
      first_name: data.first_name ?? '',
      last_name: data.last_name ?? '',
      phone: data.phone ?? '',
      license_number: data.license_number ?? '',
      specialization: data.specialization ?? '',
      years_of_experience: String(data.years_of_experience ?? 0),
      bio: data.bio ?? '',
      preferred_locations: (data.preferred_locations ?? []).join(', '),
      availability_status: data.availability_status ?? 'AVAILABLE',
    })
  }, [profileQuery.data])

  const profileMutation = useMutation({
    mutationFn: (data: UserProfileUpdate) => updateUserProfile(data),
    onSuccess: async (data) => {
      setProfileError(null)
      updateUser(data)
      await queryClient.setQueryData(['user-profile'], data)
    },
    onError: () => setProfileError('Profile could not be saved. Check your access and the submitted values, then try again.'),
  })

  const passwordMutation = useMutation({
    mutationFn: (data: ChangePasswordRequest) => changePassword(data),
    onSuccess: () => {
      setPassword(emptyPassword)
      setPasswordError(null)
      setPasswordSuccess(true)
    },
    onError: () => {
      setPasswordSuccess(false)
      setPasswordError('Password could not be changed. Verify your current password and meet the server password policy.')
    },
  })
  const preferencesMutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (preferences) => {
      void queryClient.setQueryData(['notification-preferences'], preferences)
    },
  })
  const documentMutation = useMutation({
    mutationFn: ({ file, type, description }: { file: File; type: string; description: string }) =>
      uploadProfessionalDocument(file, type, description),
    onSuccess: async () => {
      setDocumentFile(null)
      setDocumentDescription('')
      await queryClient.invalidateQueries({ queryKey: ['professional-documents'] })
    },
  })

  async function signOut() {
    await queryClient.cancelQueries()
    queryClient.clear()
    clearSession()
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationError = validateProfileForm(profile)
    if (validationError) {
      setProfileError(validationError)
      return
    }
    setProfileError(null)
    profileMutation.mutate(profileFormToUpdate(profile))
  }

  function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationError = validatePasswordForm(password)
    if (validationError) {
      setPasswordError(validationError)
      setPasswordSuccess(false)
      return
    }
    setPasswordError(null)
    setPasswordSuccess(false)
    passwordMutation.mutate(password)
  }

  return (
    <div className="min-h-screen bg-canvas text-ink lg:flex">
      <aside className="flex shrink-0 flex-col bg-navy text-white lg:sticky lg:top-0 lg:h-screen lg:w-[236px]">
        <div className="flex items-center gap-3 px-5 py-5 lg:px-6 lg:py-7">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#d8eee4] text-forest"><Activity size={21} aria-hidden="true" /></span>
          <div><p className="text-[15px] font-semibold">MediConnect</p><p className="mt-0.5 text-[11px] text-white/55">CARE OPERATIONS</p></div>
        </div>
        <WorkspaceNavigation current="/settings" />
        <div className="hidden flex-1 lg:block" />
        <div className="hidden border-t border-white/10 p-5 lg:block">
          <div className="flex items-center gap-2 text-xs text-white/70"><ShieldCheck size={15} aria-hidden="true" /> Secure workspace</div>
          <p className="mt-2 text-[11px] leading-5 text-white/45">Account settings are saved to your authenticated profile.</p>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-5 py-3 shadow-sm backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="hidden sm:inline">Operations</span><span className="hidden text-[#bdc7c1] sm:inline">/</span>
            <span className="font-semibold text-ink">System settings</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[11px] font-semibold ${isLive ? 'bg-[#e5f2eb] text-[#28664e]' : 'bg-[#fbf1df] text-[#8b641d]'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-[#3e8a69]' : 'bg-[#d49a36]'}`} />{isLive ? 'Account connected' : 'Not connected'}
            </div>
            {isLive ? (
              <button onClick={signOut} className="inline-flex h-9 items-center gap-2 rounded-md border border-black/10 px-3 text-xs font-medium text-muted transition hover:bg-canvas hover:text-ink" type="button" title={user?.first_name || 'Sign out'}>
                <LogOut size={15} aria-hidden="true" /><span className="hidden sm:inline">Sign out</span>
              </button>
            ) : (
              <Link to="/connect" className="inline-flex h-9 items-center gap-2 rounded-md bg-forest px-3 text-xs font-semibold text-white transition hover:bg-[#164333]"><ShieldCheck size={15} aria-hidden="true" />Connect live data</Link>
            )}
          </div>
        </header>

        <div className="mx-auto max-w-[1100px] px-5 pb-10 pt-7 sm:px-8 sm:pt-9">
          <div>
            <p className="text-xs font-semibold uppercase text-forest">Account &amp; preferences</p>
            <h1 className="mt-2 text-[26px] font-semibold leading-tight text-ink sm:text-[30px]">System settings</h1>
            <p className="mt-2 text-sm text-muted">Manage profile details and credentials supported by your account API.</p>
          </div>

          {!isLive && (
            <Card className="mt-5 p-6 sm:p-8">
              <div className="mx-auto max-w-xl text-center">
                <Settings className="mx-auto text-forest" size={30} aria-hidden="true" />
                <h2 className="mt-3 text-base font-semibold text-ink">Connect to manage account settings</h2>
                <p className="mt-2 text-sm leading-6 text-muted">Settings are not editable while disconnected. No changes are saved locally.</p>
                <Link to="/connect" className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-forest px-4 text-xs font-semibold text-white transition hover:bg-[#164333]"><ShieldCheck size={15} aria-hidden="true" />Connect live data</Link>
              </div>
            </Card>
          )}

          {isLive && profileQuery.isLoading && <SettingsLoadingState />}
          {isLive && profileQuery.isError && <SettingsErrorNotice onRetry={() => void profileQuery.refetch()} />}
          {isLive && profileQuery.isSuccess && (
            <div className="mt-5 grid gap-5">
              <Card className="p-5 sm:p-7">
                <CardHeader className="flex-col sm:flex-row sm:items-center">
                  <div><CardTitle>Profile information</CardTitle><p className="mt-1 text-xs text-muted">Saved to your MediConnect account.</p></div>
                  <span className="rounded-full bg-[#eaf3ee] px-3 py-1 text-xs font-semibold text-[#28664e]">{profileQuery.data.is_verified ? 'Verified account' : 'Verification status: not verified'}</span>
                </CardHeader>
                <form onSubmit={saveProfile} className="mt-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-ink">First name
                      <input autoComplete="given-name" required maxLength={150} value={profile.first_name} onChange={(event) => setProfile({ ...profile, first_name: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-[#d5ded8] px-3 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-[#3e8a69]/15" />
                    </label>
                    <label className="block text-sm font-medium text-ink">Last name
                      <input autoComplete="family-name" required maxLength={150} value={profile.last_name} onChange={(event) => setProfile({ ...profile, last_name: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-[#d5ded8] px-3 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-[#3e8a69]/15" />
                    </label>
                    <label className="block text-sm font-medium text-ink">Email address <span className="text-xs font-normal text-muted">(read-only)</span>
                      <input type="email" disabled value={profileQuery.data.email} className="mt-2 h-10 w-full rounded-md border border-[#d5ded8] bg-[#f5f7f6] px-3 text-sm text-muted" />
                    </label>
                    <label className="block text-sm font-medium text-ink">Phone
                      <input autoComplete="tel" maxLength={20} value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-[#d5ded8] px-3 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-[#3e8a69]/15" />
                    </label>
                    <label className="block text-sm font-medium text-ink">Role <span className="text-xs font-normal text-muted">(read-only)</span>
                      <input disabled value={profileQuery.data.role} className="mt-2 h-10 w-full rounded-md border border-[#d5ded8] bg-[#f5f7f6] px-3 text-sm text-muted" />
                    </label>
                    <label className="block text-sm font-medium text-ink">Availability
                      <select value={profile.availability_status} onChange={(event) => setProfile({ ...profile, availability_status: event.target.value as UserProfileUpdate['availability_status'] })} className="mt-2 h-10 w-full rounded-md border border-[#d5ded8] bg-white px-3 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-[#3e8a69]/15">
                        {availabilityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-ink">License number
                      <input maxLength={100} value={profile.license_number} onChange={(event) => setProfile({ ...profile, license_number: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-[#d5ded8] px-3 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-[#3e8a69]/15" />
                    </label>
                    <label className="block text-sm font-medium text-ink">Specialization
                      <input maxLength={150} value={profile.specialization} onChange={(event) => setProfile({ ...profile, specialization: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-[#d5ded8] px-3 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-[#3e8a69]/15" />
                    </label>
                    <label className="block text-sm font-medium text-ink">Years of experience
                      <input type="number" min={0} step={1} value={profile.years_of_experience} onChange={(event) => setProfile({ ...profile, years_of_experience: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-[#d5ded8] px-3 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-[#3e8a69]/15" />
                    </label>
                    <label className="block text-sm font-medium text-ink">Preferred locations <span className="text-xs font-normal text-muted">(comma-separated)</span>
                      <input value={profile.preferred_locations} onChange={(event) => setProfile({ ...profile, preferred_locations: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-[#d5ded8] px-3 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-[#3e8a69]/15" />
                    </label>
                    <label className="block text-sm font-medium text-ink sm:col-span-2">Bio
                      <textarea rows={4} value={profile.bio} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} className="mt-2 w-full rounded-md border border-[#d5ded8] px-3 py-2 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-[#3e8a69]/15" />
                    </label>
                  </div>
                  {profileError && <p className="mt-4 rounded-md bg-[#fff1ed] px-3 py-2.5 text-sm text-[#9d4937]" role="alert">{profileError}</p>}
                  {profileMutation.isSuccess && <p className="mt-4 flex items-center gap-2 text-sm text-[#28664e]" role="status"><CheckCircle2 size={16} aria-hidden="true" />Profile saved to your account.</p>}
                  <button className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-forest px-4 text-xs font-semibold text-white transition hover:bg-[#164333] disabled:cursor-wait disabled:opacity-60" disabled={profileMutation.isPending} type="submit">
                    {profileMutation.isPending && <RefreshCw className="animate-spin" size={15} aria-hidden="true" />}
                    {profileMutation.isPending ? 'Saving profile…' : 'Save profile'}
                  </button>
                </form>
              </Card>

              <Card className="p-5 sm:p-7">
                <div><CardTitle>Change password</CardTitle><p className="mt-1 text-xs text-muted">The server checks your current password and enforces its password policy.</p></div>
                <form onSubmit={savePassword} className="mt-5 max-w-xl space-y-4">
                  <label className="block text-sm font-medium text-ink">Current password
                    <input autoComplete="current-password" required type="password" value={password.old_password} onChange={(event) => setPassword({ ...password, old_password: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-[#d5ded8] px-3 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-[#3e8a69]/15" />
                  </label>
                  <label className="block text-sm font-medium text-ink">New password
                    <input autoComplete="new-password" required type="password" value={password.new_password} onChange={(event) => setPassword({ ...password, new_password: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-[#d5ded8] px-3 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-[#3e8a69]/15" />
                  </label>
                  <label className="block text-sm font-medium text-ink">Confirm new password
                    <input autoComplete="new-password" required type="password" value={password.new_password_confirm} onChange={(event) => setPassword({ ...password, new_password_confirm: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-[#d5ded8] px-3 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-[#3e8a69]/15" />
                  </label>
                  {passwordError && <p className="rounded-md bg-[#fff1ed] px-3 py-2.5 text-sm text-[#9d4937]" role="alert">{passwordError}</p>}
                  {passwordSuccess && <p className="flex items-center gap-2 text-sm text-[#28664e]" role="status"><CheckCircle2 size={16} aria-hidden="true" />Password updated successfully.</p>}
                  <button className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d8e0db] bg-white px-4 text-xs font-semibold text-ink transition hover:bg-[#f8faf9] disabled:cursor-wait disabled:opacity-60" disabled={passwordMutation.isPending} type="submit">
                    {passwordMutation.isPending && <RefreshCw className="animate-spin" size={15} aria-hidden="true" />}
                    {passwordMutation.isPending ? 'Updating password…' : 'Update password'}
                  </button>
                </form>
              </Card>

              <Card className="p-5 sm:p-7">
                <CardHeader><div><CardTitle>Notification preferences</CardTitle><p className="mt-1 text-xs text-muted">Changes are saved to your notification preferences.</p></div></CardHeader>
                {preferencesQuery.isLoading && <p className="mt-4 text-sm text-muted" role="status">Loading preferences…</p>}
                {preferencesQuery.isError && <p className="mt-4 text-sm text-[#9d4937]" role="alert">Notification preferences could not be loaded.</p>}
                {preferencesQuery.data && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {([
                      ['email_enabled', 'Email notifications'],
                      ['push_enabled', 'Push notifications'],
                      ['sms_enabled', 'SMS notifications'],
                      ['notify_new_contracts', 'New matching contracts'],
                      ['notify_bid_updates', 'Bid updates'],
                      ['notify_resource_alerts', 'Resource alerts'],
                      ['notify_assignment_reminders', 'Assignment reminders'],
                    ] as const).map(([field, label]) => (
                      <label key={field} className="flex items-center justify-between gap-3 rounded-md bg-canvas px-3 py-2.5 text-sm">
                        <span>{label}</span>
                        <input type="checkbox" checked={preferencesQuery.data[field]} disabled={preferencesMutation.isPending} onChange={(event) => preferencesMutation.mutate({ [field]: event.target.checked })} />
                      </label>
                    ))}
                  </div>
                )}
                {preferencesMutation.isError && <p className="mt-3 text-sm text-[#9d4937]" role="alert">Preference change could not be saved.</p>}
              </Card>

              <Card className="p-5 sm:p-7">
                <CardHeader><div><CardTitle>Professional credentials</CardTitle><p className="mt-1 text-xs text-muted">Upload professional documents and track verification status. Automated KMPDC checks remain pending until authorized API access is configured.</p></div></CardHeader>
                {profileQuery.data && (
                  <div className="mt-4 rounded-md bg-canvas px-3 py-2.5 text-sm" role="status">
                    Account verification: <strong>{credentialStatusLabel(profileQuery.data.verification_status)}</strong>
                  </div>
                )}
                {documentsQuery.isLoading && <p className="mt-4 text-sm text-muted" role="status">Loading documents…</p>}
                {documentsQuery.isError && <p className="mt-4 text-sm text-[#9d4937]" role="alert">Professional documents could not be loaded.</p>}
                <div className="mt-4 divide-y divide-black/[0.06]">
                  {(documentsQuery.data ?? []).map((document) => (
                    <div key={document.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                      <div><a href={new URL(document.file, import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api').toString()} target="_blank" rel="noreferrer" className="font-medium text-forest hover:underline">{document.document_type} document</a><p className="mt-1 text-xs text-muted">{document.description || 'No description'} · {credentialStatusLabel(document.verification_status)}</p></div>
                    </div>
                  ))}
                  {documentsQuery.data?.length === 0 && <p className="py-3 text-sm text-muted">No documents uploaded yet.</p>}
                </div>
                <form onSubmit={(event) => { event.preventDefault(); if (documentFile) documentMutation.mutate({ file: documentFile, type: documentType, description: documentDescription }) }} className="mt-4 grid gap-3 sm:grid-cols-[170px_1fr_1fr_auto]">
                  <label className="text-sm font-medium">Document type
                    <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-[#d5ded8] bg-white px-3 text-sm"><option value="LICENSE">Medical license</option><option value="CERTIFICATE">Certificate</option><option value="ID">Government ID</option><option value="CV">Curriculum vitae</option><option value="OTHER">Other</option></select>
                  </label>
                  <label className="text-sm font-medium">File
                    <input required type="file" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-xs" />
                  </label>
                  <label className="text-sm font-medium">Description
                    <input value={documentDescription} onChange={(event) => setDocumentDescription(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-[#d5ded8] px-3 text-sm" />
                  </label>
                  <button type="submit" disabled={!documentFile || documentMutation.isPending} className="mt-auto h-10 rounded-md bg-forest px-4 text-xs font-semibold text-white disabled:opacity-50">{documentMutation.isPending ? 'Uploading…' : 'Upload'}</button>
                </form>
                {documentMutation.isError && <p className="mt-3 text-sm text-[#9d4937]" role="alert">Document upload failed. Check the file and your account permissions.</p>}
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
