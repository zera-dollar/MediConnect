import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Ambulance, ArrowRightLeft, CheckCircle2, ClipboardPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  acceptInterfacilityReferral,
  createInterfacilityReferral,
  getHospitals,
  getHospitalResources,
  getInterfacilityReferrals,
  getMyHospitals,
} from '../lib/api'
import { useAuthStore } from '../store/auth'
import type { InterfacilityReferralCreate, ReferralAcuity, ReferralVitals } from '../types'
import { WorkspaceNavigation } from './WorkspaceNavigation'
import { Card, CardHeader, CardTitle } from './ui/card'

const acuityOptions: { value: ReferralAcuity; label: string }[] = [
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'ROUTINE', label: 'Routine' },
]

const vitalFields: { key: keyof ReferralVitals; label: string; min: number; max: number; step?: string }[] = [
  { key: 'systolic_bp', label: 'Systolic BP (mmHg)', min: 0, max: 300 },
  { key: 'diastolic_bp', label: 'Diastolic BP (mmHg)', min: 0, max: 200 },
  { key: 'heart_rate', label: 'Heart rate (/min)', min: 0, max: 300 },
  { key: 'respiratory_rate', label: 'Respiratory rate (/min)', min: 0, max: 100 },
  { key: 'temperature_celsius', label: 'Temperature (°C)', min: 25, max: 50, step: '0.1' },
  { key: 'oxygen_saturation_pct', label: 'Oxygen saturation (%)', min: 0, max: 100 },
]

function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = error.response
    if (typeof response === 'object' && response !== null && 'data' in response) {
      const data = response.data
      if (typeof data === 'object' && data !== null && 'detail' in data && typeof data.detail === 'string') {
        return data.detail
      }
    }
  }
  return 'The referral request failed. Check access and resource availability, then retry.'
}

export function InterfacilityReferralsDashboard() {
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const [sourceHospitalId, setSourceHospitalId] = useState('')
  const [receivingHospitalId, setReceivingHospitalId] = useState('')
  const [patientId, setPatientId] = useState('')
  const [presentingConcern, setPresentingConcern] = useState('')
  const [acuity, setAcuity] = useState<ReferralAcuity>('URGENT')
  const [vitals, setVitals] = useState<Record<string, string>>({})
  const [interventions, setInterventions] = useState('')
  const [resourceTypeId, setResourceTypeId] = useState('')
  const [resourceQuantity, setResourceQuantity] = useState('1')
  const [error, setError] = useState<string | null>(null)

  const myHospitalsQuery = useQuery({
    queryKey: ['my-hospitals'],
    queryFn: getMyHospitals,
    enabled: Boolean(token),
  })
  const hospitalsQuery = useQuery({
    queryKey: ['hospitals'],
    queryFn: getHospitals,
    enabled: Boolean(token),
  })
  const resourcesQuery = useQuery({
    queryKey: ['hospital-resources'],
    queryFn: getHospitalResources,
    enabled: Boolean(token),
  })
  const referralsQuery = useQuery({
    queryKey: ['interfacility-referrals'],
    queryFn: getInterfacilityReferrals,
    enabled: Boolean(token),
  })
  const memberships = myHospitalsQuery.data ?? []
  const hospitals = hospitalsQuery.data ?? []
  const resources = resourcesQuery.data ?? []
  const receivingResources = useMemo(() => {
    const selectedHospital = Number(receivingHospitalId)
    const types = new Map<number, { id: number; name: string; available: number }>()
    for (const resource of resources) {
      if (!resource.is_active || resource.hospital !== selectedHospital) continue
      const current = types.get(resource.resource_type.id) ?? {
        id: resource.resource_type.id,
        name: resource.resource_type.name,
        available: 0,
      }
      current.available = Math.max(current.available, resource.available_quantity)
      types.set(resource.resource_type.id, current)
    }
    return [...types.values()].sort((first, second) => first.name.localeCompare(second.name))
  }, [receivingHospitalId, resources])

  const createMutation = useMutation({
    mutationFn: createInterfacilityReferral,
    onSuccess: async () => {
      setError(null)
      setPresentingConcern('')
      setInterventions('')
      setVitals({})
      await queryClient.invalidateQueries({ queryKey: ['interfacility-referrals'] })
    },
    onError: (requestError: unknown) => setError(errorMessage(requestError)),
  })
  const acceptMutation = useMutation({
    mutationFn: acceptInterfacilityReferral,
    onSuccess: async () => {
      setError(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['interfacility-referrals'] }),
        queryClient.invalidateQueries({ queryKey: ['ambulance-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['hospital-resources'] }),
      ])
    },
    onError: (requestError: unknown) => setError(errorMessage(requestError)),
  })

  function submitReferral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedVitals: ReferralVitals = {}
    for (const field of vitalFields) {
      const value = vitals[field.key]
      if (value !== undefined && value.trim() !== '') {
        parsedVitals[field.key] = Number(value)
      }
    }
    const payload: InterfacilityReferralCreate = {
      source_hospital: Number(sourceHospitalId),
      receiving_hospital: Number(receivingHospitalId),
      patient: Number(patientId),
      presenting_concern: presentingConcern.trim(),
      acuity,
      vitals: parsedVitals,
      interventions: interventions.trim(),
      resource_type: Number(resourceTypeId),
      resource_quantity: Number(resourceQuantity),
    }
    createMutation.mutate(payload)
  }

  if (!token || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-5 text-ink">
        <Card className="max-w-lg p-7">
          <CardHeader><CardTitle>Interfacility referrals</CardTitle></CardHeader>
          <p className="mt-3 text-sm text-muted">Sign in with an authorized hospital account to access referral workflows.</p>
          <Link to="/connect" className="mt-4 inline-block rounded-md bg-forest px-4 py-2 text-sm font-semibold text-white">Sign in</Link>
        </Card>
      </main>
    )
  }

  const canCreateReferral = user.role === 'NURSE' || user.role === 'STAFF'
  const selectedResource = receivingResources.find((resource) => String(resource.id) === resourceTypeId)
  const managerHospitalIds = new Set(
    memberships
      .filter((hospital) => ['ADMIN', 'MANAGER', 'COORDINATOR'].includes(hospital.role_at_hospital))
      .map((hospital) => hospital.id),
  )

  return (
    <div className="min-h-screen bg-canvas text-ink lg:flex">
      <aside className="flex shrink-0 flex-col bg-navy text-white lg:sticky lg:top-0 lg:h-screen lg:w-[236px]">
        <Link to="/" className="flex items-center gap-3 px-5 py-5 lg:px-6 lg:py-7">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#d8eee4] text-forest"><Activity size={21} aria-hidden="true" /></span>
          <span><span className="block text-[15px] font-semibold">MediConnect</span><span className="mt-0.5 block text-[11px] text-white/55">CARE WORKSPACE</span></span>
        </Link>
        <WorkspaceNavigation current="/referrals" />
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-7">
        <div className="mx-auto max-w-6xl">
          <header className="mb-6">
            <p className="text-xs font-bold uppercase tracking-wide text-forest">Hospital coordination</p>
            <h1 className="mt-1 text-2xl font-semibold">Interfacility referrals</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Share a structured triage handoff with a receiving facility. Acceptance reserves the requested resource and creates a linked ambulance dispatch request.
            </p>
          </header>

          <div className="mb-5 rounded-lg border border-[#eadfbd] bg-[#fff9eb] p-4 text-xs leading-5 text-[#6e5727]">
            Clinical details are limited to authorized source and receiving hospital members. Enter only information needed for transfer. This workflow does not replace clinical judgment or emergency services.
          </div>

          {canCreateReferral && (
            <Card className="mb-6 p-5 sm:p-6">
              <CardHeader>
                <div>
                  <CardTitle>Create referral</CardTitle>
                  <p className="mt-1 text-xs text-muted">Nurses and authorized facility staff can submit a request. Resource stock is reserved only after receiving-facility acceptance.</p>
                </div>
                <ClipboardPlus size={20} className="text-forest" aria-hidden="true" />
              </CardHeader>
              <form className="mt-5 space-y-5" onSubmit={submitReferral}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-ink">
                    Referring facility
                    <select className="mt-1.5 h-10 w-full rounded-md border border-[#d8e0db] bg-white px-3 text-sm" required value={sourceHospitalId} onChange={(event) => setSourceHospitalId(event.target.value)}>
                      <option value="">Select your facility</option>
                      {memberships.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name} · Level {hospital.facility_level ?? 'unlisted'}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-ink">
                    Receiving facility
                    <select className="mt-1.5 h-10 w-full rounded-md border border-[#d8e0db] bg-white px-3 text-sm" required value={receivingHospitalId} onChange={(event) => { setReceivingHospitalId(event.target.value); setResourceTypeId('') }}>
                      <option value="">Select receiving facility</option>
                      {hospitals.filter((hospital) => String(hospital.id) !== sourceHospitalId).map((hospital) => (
                        <option key={hospital.id} value={hospital.id}>
                          {hospital.name}{hospital.facility_level ? ` · Level ${hospital.facility_level}` : ''}
                          {hospital.county ? ` · ${hospital.county}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-ink">
                    Patient account ID
                    <input className="mt-1.5 h-10 w-full rounded-md border border-[#d8e0db] px-3 text-sm" min={1} required type="number" value={patientId} onChange={(event) => setPatientId(event.target.value)} />
                    <span className="mt-1 block font-normal text-muted">Use the patient's MediConnect account ID; do not enter a national ID or free-text identifier.</span>
                  </label>
                  <label className="text-xs font-medium text-ink">
                    Acuity
                    <select className="mt-1.5 h-10 w-full rounded-md border border-[#d8e0db] bg-white px-3 text-sm" value={acuity} onChange={(event) => setAcuity(event.target.value as ReferralAcuity)}>
                      {acuityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>

                <fieldset>
                  <legend className="text-xs font-semibold text-ink">Clinical triage summary</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {vitalFields.map((field) => (
                      <label key={field.key} className="text-[11px] font-medium text-muted">
                        {field.label}
                        <input
                          className="mt-1 h-9 w-full rounded-md border border-[#d8e0db] px-2 text-sm text-ink"
                          max={field.max}
                          min={field.min}
                          onChange={(event) => setVitals((current) => ({ ...current, [field.key]: event.target.value }))}
                          step={field.step}
                          type="number"
                          value={vitals[field.key] ?? ''}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-medium text-ink">
                      Presenting concern
                      <textarea className="mt-1.5 w-full rounded-md border border-[#d8e0db] px-3 py-2 text-sm" maxLength={2000} required rows={3} value={presentingConcern} onChange={(event) => setPresentingConcern(event.target.value)} />
                    </label>
                    <label className="text-xs font-medium text-ink">
                      Interventions provided
                      <textarea className="mt-1.5 w-full rounded-md border border-[#d8e0db] px-3 py-2 text-sm" maxLength={2000} rows={3} value={interventions} onChange={(event) => setInterventions(event.target.value)} />
                    </label>
                  </div>
                </fieldset>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                  <label className="text-xs font-medium text-ink">
                    Resource requested at receiving facility
                    <select className="mt-1.5 h-10 w-full rounded-md border border-[#d8e0db] bg-white px-3 text-sm" required value={resourceTypeId} onChange={(event) => setResourceTypeId(event.target.value)}>
                      <option value="">Select an available resource</option>
                      {receivingResources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name} · up to {resource.available} available in one resource record</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-ink">
                    Quantity
                    <input className="mt-1.5 h-10 w-full rounded-md border border-[#d8e0db] px-3 text-sm" max={selectedResource?.available} min={1} required type="number" value={resourceQuantity} onChange={(event) => setResourceQuantity(event.target.value)} />
                  </label>
                </div>
                {error && <p role="alert" className="rounded-md bg-[#fff1ed] px-3 py-2.5 text-sm text-[#9d4937]">{error}</p>}
                <button className="inline-flex h-10 items-center gap-2 rounded-md bg-forest px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={createMutation.isPending || !memberships.length}>
                  <ArrowRightLeft size={16} aria-hidden="true" />{createMutation.isPending ? 'Submitting referral…' : 'Submit referral'}
                </button>
              </form>
            </Card>
          )}

          <Card className="p-5 sm:p-6">
            <CardHeader>
              <div><CardTitle>Referral handoffs</CardTitle><p className="mt-1 text-xs text-muted">{referralsQuery.data?.length ?? 0} referrals visible to your facility memberships</p></div>
              <Ambulance size={20} className="text-forest" aria-hidden="true" />
            </CardHeader>
            {referralsQuery.isError && <p role="alert" className="mt-4 text-sm text-[#9d4937]">Could not load referrals. Check your facility access and retry.</p>}
            {resourcesQuery.isError && <p role="alert" className="mt-4 text-sm text-[#9d4937]">Resource availability could not be loaded; referral creation may be unavailable.</p>}
            <div className="mt-4 space-y-3">
              {(referralsQuery.data ?? []).map((referral) => {
                const canAccept = referral.status === 'PENDING' && managerHospitalIds.has(referral.receiving_hospital)
                return (
                  <article key={referral.id} className="rounded-lg border border-[#e5ece7] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{referral.source_hospital_name} <span className="font-normal text-muted">to</span> {referral.receiving_hospital_name}</h3>
                        <p className="mt-1 text-xs text-muted">Referral #{referral.id} · Patient {referral.patient_name} · {referral.acuity} · {new Date(referral.created_at).toLocaleString()}</p>
                      </div>
                      <span className="rounded-full bg-[#f0f4f1] px-3 py-1 text-xs font-semibold">{referral.status}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6">{referral.presenting_concern}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      <span>Requested: {referral.resource_quantity} × {referral.resource_type_name}</span>
                      {referral.vitals.systolic_bp !== undefined && <span>BP {referral.vitals.systolic_bp}/{referral.vitals.diastolic_bp ?? '—'}</span>}
                      {referral.vitals.heart_rate !== undefined && <span>HR {referral.vitals.heart_rate}</span>}
                      {referral.vitals.oxygen_saturation_pct !== undefined && <span>SpO₂ {referral.vitals.oxygen_saturation_pct}%</span>}
                    </div>
                    {referral.interventions && <p className="mt-2 text-xs text-muted">Interventions: {referral.interventions}</p>}
                    {referral.reservation_transaction && <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#28664e]"><CheckCircle2 size={14} aria-hidden="true" /> Resource reserved at acceptance.</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {canAccept && (
                        <button
                          className="rounded-md bg-forest px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                          disabled={acceptMutation.isPending}
                          onClick={() => { setError(null); acceptMutation.mutate(referral.id) }}
                          type="button"
                        >
                          Accept and reserve resource
                        </button>
                      )}
                      {referral.ambulance_request && <Link className="text-xs font-semibold text-forest underline" to="/ambulance">Open transport dispatch/tracking</Link>}
                    </div>
                  </article>
                )
              })}
              {!referralsQuery.isLoading && !referralsQuery.isError && (referralsQuery.data ?? []).length === 0 && (
                <p className="rounded-lg border border-dashed border-[#d4dfd8] p-6 text-center text-sm text-muted">No referrals have been shared with your facility memberships.</p>
              )}
              {error && !canCreateReferral && <p role="alert" className="text-sm text-[#9d4937]">{error}</p>}
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
