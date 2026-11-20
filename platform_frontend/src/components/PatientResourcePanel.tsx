import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Ambulance, Boxes, CalendarPlus, ChevronDown, Droplets, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  getBloodStocks,
  getHospitalResources,
  getOxygenSupplies,
} from '../lib/api'
import {
  filterAndSortPatientResources,
  getHospitalActionPaths,
  getPatientResourceTypes,
  type PatientResourceTab,
} from '../lib/patientResources'
import type { BloodStock, HospitalResource, OxygenSupply } from '../types'
import { Card } from './ui/card'

const resourceTabs: { id: PatientResourceTab; label: string }[] = [
  { id: 'oxygen', label: 'Oxygen' },
  { id: 'blood', label: 'Blood' },
  { id: 'beds', label: 'Beds' },
  { id: 'equipment', label: 'Equipment' },
]

function ResourceLoading() {
  return <p className="mt-4 text-sm text-muted">Loading hospital availability…</p>
}

function ResourceError({ children }: { children: string }) {
  return <p role="alert" className="mt-4 text-sm text-[#9d4937]">{children}</p>
}

function HospitalResourceRows({
  tab,
  resources,
  oxygen,
  blood,
  hospitalId,
  resourceType,
  search,
  onHospitalClick,
}: {
  tab: PatientResourceTab
  resources: HospitalResource[]
  oxygen: OxygenSupply[]
  blood: BloodStock[]
  hospitalId: string
  resourceType: string
  search: string
  onHospitalClick: (hospital: { id: number; name: string }) => void
}) {
  const rows = useMemo(() => filterAndSortPatientResources(
    tab,
    resources,
    oxygen,
    blood,
    { hospitalId, resourceType, search },
  ), [tab, resources, oxygen, blood, hospitalId, resourceType, search])

  if (rows.length === 0) {
    return <p className="mt-5 rounded-md bg-canvas px-3 py-4 text-sm text-muted">No matching resource availability was found.</p>
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-[#e4e9e5] text-xs uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className="px-3 py-2.5 font-semibold">Hospital</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Resource</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Availability</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e8ede9]">
          {rows.map((row) => (
            <tr key={row.id} className="align-top">
              <td className="px-3 py-3">
                <button
                  className="text-left font-semibold text-forest underline decoration-transparent underline-offset-2 hover:decoration-current"
                  onClick={() => onHospitalClick({ id: row.hospitalId, name: row.hospitalName })}
                  type="button"
                >
                  {row.hospitalName}
                </button>
              </td>
              <td className="px-3 py-3">
                <p className="font-medium">{row.name}</p>
                <p className="mt-0.5 text-xs text-muted">{row.type}</p>
              </td>
              <td className="px-3 py-3 text-right font-semibold text-forest">{row.availabilityLabel}</td>
              <td className="px-3 py-3 text-right text-xs text-muted">{row.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted">Availability is sorted from highest to lowest. Last reported times are shown per record.</p>
    </div>
  )
}

export function PatientResourcePanel() {
  const [expanded, setExpanded] = useState(false)
  const [tab, setTab] = useState<PatientResourceTab>('oxygen')
  const [hospitalId, setHospitalId] = useState('all')
  const [resourceType, setResourceType] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedHospital, setSelectedHospital] = useState<{ id: number; name: string } | null>(null)

  useEffect(() => {
    if (!selectedHospital) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedHospital(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selectedHospital])

  const resourcesQuery = useQuery({
    queryKey: ['patient-hospital-resources'],
    queryFn: getHospitalResources,
    enabled: expanded,
  })
  const oxygenQuery = useQuery({
    queryKey: ['patient-oxygen-supplies'],
    queryFn: getOxygenSupplies,
    enabled: expanded,
  })
  const bloodQuery = useQuery({
    queryKey: ['patient-blood-stocks'],
    queryFn: getBloodStocks,
    enabled: expanded,
  })

  const resources = resourcesQuery.data ?? []
  const oxygen = oxygenQuery.data ?? []
  const blood = bloodQuery.data ?? []
  const sourceData = tab === 'oxygen'
    ? oxygen
    : tab === 'blood'
      ? blood
      : resources.filter((resource) => (
          resource.is_active
          && resource.resource_type.category_name.toLowerCase().includes(tab === 'beds' ? 'beds' : 'equipment')
        ))
  const availableHospitals = new Map<number, string>()
  for (const resource of sourceData) {
    availableHospitals.set(resource.hospital, resource.hospital_name)
  }
  const resourceTypes = getPatientResourceTypes(tab, resources, oxygen, blood)
  const isLoading = expanded && (
    tab === 'oxygen' ? oxygenQuery.isLoading
      : tab === 'blood' ? bloodQuery.isLoading
        : resourcesQuery.isLoading
  )
  const isError = expanded && (
    tab === 'oxygen' ? oxygenQuery.isError
      : tab === 'blood' ? bloodQuery.isError
        : resourcesQuery.isError
  )

  function changeTab(nextTab: PatientResourceTab) {
    setTab(nextTab)
    setResourceType('all')
    setHospitalId('all')
    setSearch('')
  }

  return (
    <Card className="p-5 lg:col-span-2">
      <button
        aria-controls="patient-resource-display"
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-4 text-left"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-mint text-forest">
            <Boxes size={19} aria-hidden="true" />
          </span>
          <span>
            <span className="block font-semibold text-ink">Hospital resource availability</span>
            <span className="mt-1 block text-sm text-muted">Compare oxygen, blood, beds, and equipment across hospitals.</span>
          </span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {expanded && (
        <div id="patient-resource-display" className="mt-5 border-t border-[#e8ede9] pt-5">
          <div role="tablist" aria-label="Resource category" className="flex flex-wrap gap-2">
            {resourceTabs.map((resourceTab) => (
              <button
                key={resourceTab.id}
                aria-selected={tab === resourceTab.id}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  tab === resourceTab.id
                    ? 'bg-forest text-white'
                    : 'border border-[#d8e0db] bg-white text-ink hover:border-forest'
                }`}
                onClick={() => changeTab(resourceTab.id)}
                role="tab"
                type="button"
              >
                {resourceTab.id === 'oxygen' && <Droplets size={15} className="mr-1.5 inline" aria-hidden="true" />}
                {resourceTab.label}
              </button>
            ))}
          </div>

          <p className="mt-4 text-xs font-medium text-forest">Sorted by availability: highest to lowest</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="block text-xs font-semibold text-muted">
              Hospital
              <select
                className="mt-1.5 h-10 w-full rounded-md border border-[#d8e0db] bg-white px-3 text-sm font-normal text-ink"
                onChange={(event) => setHospitalId(event.target.value)}
                value={hospitalId}
              >
                <option value="all">All hospitals</option>
                {[...availableHospitals.entries()]
                  .sort((left, right) => left[1].localeCompare(right[1]))
                  .map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-muted">
              {tab === 'blood' ? 'Blood group' : tab === 'oxygen' ? 'Oxygen type' : 'Resource type'}
              <select
                className="mt-1.5 h-10 w-full rounded-md border border-[#d8e0db] bg-white px-3 text-sm font-normal text-ink"
                onChange={(event) => setResourceType(event.target.value)}
                value={resourceType}
              >
                <option value="all">All types</option>
                {resourceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-muted">
              Search
              <span className="mt-1.5 flex h-10 items-center gap-2 rounded-md border border-[#d8e0db] bg-white px-3">
                <Search size={15} className="shrink-0 text-muted" aria-hidden="true" />
                <span className="sr-only">Search resource or hospital</span>
                <input
                  className="min-w-0 flex-1 text-sm font-normal text-ink outline-none"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Resource or hospital"
                  type="search"
                  value={search}
                />
              </span>
            </label>
          </div>

          {isLoading && <ResourceLoading />}
          {isError && <ResourceError>Resource availability could not be loaded. Please try again later.</ResourceError>}
          {!isLoading && !isError && (
            <HospitalResourceRows
              tab={tab}
              resources={resources}
              oxygen={oxygen}
              blood={blood}
              hospitalId={hospitalId}
              resourceType={resourceType}
              search={search}
              onHospitalClick={setSelectedHospital}
            />
          )}
        </div>
      )}
      {selectedHospital && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#10251f]/55 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedHospital(null)
          }}
        >
          <section
            aria-describedby="hospital-resource-actions-description"
            aria-labelledby="hospital-resource-actions-title"
            aria-modal="true"
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-forest">Selected hospital</p>
                <h2 id="hospital-resource-actions-title" className="mt-1 text-xl font-semibold text-ink">{selectedHospital.name}</h2>
                <p id="hospital-resource-actions-description" className="mt-2 text-sm leading-5 text-muted">
                  Choose what you would like to do with this hospital.
                </p>
              </div>
              <button
                aria-label="Close hospital actions"
                className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-ink"
                onClick={() => setSelectedHospital(null)}
                type="button"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="mt-5 grid gap-3">
              <Link
                className="flex items-center gap-3 rounded-lg border border-[#d8e0db] p-4 transition hover:border-forest hover:bg-[#f5faf7]"
                onClick={() => setSelectedHospital(null)}
                to={getHospitalActionPaths(selectedHospital.id).appointment}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-mint text-forest">
                  <CalendarPlus size={19} aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold text-ink">Book an appointment</span>
                  <span className="mt-0.5 block text-xs text-muted">Choose a professional affiliated with this hospital.</span>
                </span>
              </Link>
              <Link
                className="flex items-center gap-3 rounded-lg border border-[#d8e0db] p-4 transition hover:border-forest hover:bg-[#f5faf7]"
                onClick={() => setSelectedHospital(null)}
                to={getHospitalActionPaths(selectedHospital.id).ambulance}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-mint text-forest">
                  <Ambulance size={19} aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold text-ink">Request an ambulance</span>
                  <span className="mt-0.5 block text-xs text-muted">Set this hospital as your destination.</span>
                </span>
              </Link>
            </div>
            <button
              className="mt-5 w-full rounded-md border border-[#d8e0db] px-4 py-2 text-sm font-semibold text-ink hover:bg-canvas"
              onClick={() => setSelectedHospital(null)}
              type="button"
            >
              Cancel
            </button>
          </section>
        </div>
      )}
    </Card>
  )
}
