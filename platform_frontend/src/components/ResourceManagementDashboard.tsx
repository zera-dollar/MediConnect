import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { WorkspaceNavigation } from './WorkspaceNavigation'
import { adjustHospitalResource, getHospitalResources, getResourceCategories } from '../lib/api'
import {
  filterHospitalResources,
  formatResourceUpdatedAt,
  summarizeHospitalResources,
} from '../lib/resourceManagement'
import type { ResourceStatusFilter } from '../lib/resourceManagement'
import { useAuthStore } from '../store/auth'
import type { HospitalResource, ResourceAdjustment, ResourceTransactionType } from '../types'
import { Card, CardHeader, CardTitle } from './ui/card'
import { OfflineResourceSyncPanel } from './OfflineResourceSyncPanel'

const sampleResources: HospitalResource[] = [
  {
    id: 1,
    hospital: 1,
    hospital_name: 'Sample Central Hospital',
    resource_type: { id: 1, category: 1, category_name: 'Equipment', name: 'Patient monitors', code: 'MON', is_active: true },
    department: 1,
    total_capacity: 32,
    available_quantity: 24,
    reserved_quantity: 3,
    low_stock_threshold: 8,
    is_active: true,
    is_low_stock: false,
    is_critical: false,
    occupancy_rate: 25,
    unit: 'units',
    last_updated: '2026-10-15T09:30:00Z',
    notes: 'ICU and emergency',
  },
  {
    id: 2,
    hospital: 1,
    hospital_name: 'Sample Central Hospital',
    resource_type: { id: 2, category: 2, category_name: 'Consumables', name: 'Surgical gloves', code: 'GLOVE', is_active: true },
    department: 2,
    total_capacity: 500,
    available_quantity: 65,
    reserved_quantity: 20,
    low_stock_threshold: 75,
    is_active: true,
    is_low_stock: true,
    is_critical: true,
    occupancy_rate: 87,
    unit: 'boxes',
    last_updated: '2026-10-15T08:55:00Z',
    notes: 'Size mix',
  },
  {
    id: 3,
    hospital: 2,
    hospital_name: 'Sample Riverside Clinic',
    resource_type: { id: 3, category: 1, category_name: 'Equipment', name: 'Wheelchairs', code: 'WCHR', is_active: true },
    department: null,
    total_capacity: 16,
    available_quantity: 4,
    reserved_quantity: 2,
    low_stock_threshold: 5,
    is_active: true,
    is_low_stock: true,
    is_critical: false,
    occupancy_rate: 75,
    unit: 'units',
    last_updated: '2026-10-15T08:15:00Z',
    notes: 'Outpatient area',
  },
  {
    id: 4,
    hospital: 2,
    hospital_name: 'Sample Riverside Clinic',
    resource_type: { id: 4, category: 3, category_name: 'Critical supplies', name: 'Infusion pumps', code: 'PUMP', is_active: true },
    department: 3,
    total_capacity: 8,
    available_quantity: 1,
    reserved_quantity: 2,
    low_stock_threshold: 2,
    is_active: true,
    is_low_stock: true,
    is_critical: true,
    occupancy_rate: 88,
    unit: 'units',
    last_updated: '2026-10-15T07:45:00Z',
    notes: 'Ward 2',
  },
]

type AdjustmentAction = Extract<ResourceTransactionType, 'ADD' | 'REMOVE' | 'RESERVE' | 'RELEASE'>

const actions: { value: AdjustmentAction; label: string; help: string }[] = [
  { value: 'ADD', label: 'Add stock', help: 'Increase available stock.' },
  { value: 'REMOVE', label: 'Remove stock', help: 'Decrease available stock.' },
  { value: 'RESERVE', label: 'Reserve stock', help: 'Move available stock into reserved stock.' },
  { value: 'RELEASE', label: 'Release reservation', help: 'Return reserved stock to available stock.' },
]

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  detail: string
  icon: LucideIcon
  tone: 'green' | 'coral' | 'amber' | 'dark'
}) {
  const toneClasses = {
    green: 'bg-[#e4f1eb] text-[#28664e]',
    coral: 'bg-[#fae9e4] text-[#a9503d]',
    amber: 'bg-[#fbf1df] text-[#996b1d]',
    dark: 'bg-[#e9eeeb] text-ink',
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-muted">{label}</p>
          <p className="mt-3 text-3xl font-semibold leading-none text-ink">{value}</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-md ${toneClasses[tone]}`}>
          <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-xs text-muted">{detail}</p>
    </Card>
  )
}

function ResourceProgress({ resource }: { resource: HospitalResource }) {
  const percent = resource.total_capacity > 0
    ? Math.min(100, Math.max(0, (resource.available_quantity / resource.total_capacity) * 100))
    : null
  const barClass = resource.is_critical
    ? 'bg-[#d97862]'
    : resource.is_low_stock
      ? 'bg-[#d49a36]'
      : 'bg-[#3e8a69]'

  return (
    <div className="min-w-[120px]">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-ink">{resource.available_quantity} <span className="font-normal text-muted">/ {resource.total_capacity} {resource.unit || 'units'}</span></span>
        <span className="text-muted">{percent === null ? '—' : `${Math.round(percent)}%`}</span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf1ee]"
        role="progressbar"
        aria-label={`${resource.resource_type.name} available stock`}
        aria-valuemin={0}
        aria-valuemax={resource.total_capacity}
        aria-valuenow={resource.available_quantity}
      >
        {percent !== null && <div className={`h-full rounded-full ${barClass}`} style={{ width: `${percent}%` }} />}
      </div>
      <p className="mt-1 text-[11px] text-muted">{resource.reserved_quantity} reserved</p>
    </div>
  )
}

function AdjustmentDialog({
  resource,
  isPending,
  error,
  onClose,
  onSubmit,
}: {
  resource: HospitalResource
  isPending: boolean
  error: string | null
  onClose: () => void
  onSubmit: (adjustment: ResourceAdjustment) => void
}) {
  const [action, setAction] = useState<AdjustmentAction>('ADD')
  const [quantity, setQuantity] = useState('1')
  const [reason, setReason] = useState('')
  const [reference, setReference] = useState('')
  const selectedAction = actions.find((option) => option.value === action) ?? actions[0]

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedQuantity = Number(quantity)
    if (!Number.isSafeInteger(parsedQuantity) || parsedQuantity < 1) return
    onSubmit({
      transaction_type: action,
      quantity: parsedQuantity,
      reason: reason.trim(),
      reference: reference.trim(),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#12231d]/45 p-0 sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isPending) onClose()
    }}>
      <section
        aria-labelledby="resource-adjustment-title"
        aria-modal="true"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-xl sm:p-7"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-forest">Stock transaction</p>
            <h2 id="resource-adjustment-title" className="mt-1 text-xl font-semibold text-ink">Adjust resource</h2>
            <p className="mt-1 text-sm text-muted">{resource.hospital_name} · {resource.resource_type.name}</p>
          </div>
          <button className="rounded-md p-2 text-muted hover:bg-canvas hover:text-ink" type="button" aria-label="Close adjustment dialog" onClick={onClose} disabled={isPending}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-ink">
            Transaction
            <select
              className="mt-1.5 h-11 w-full rounded-md border border-[#d8e0db] bg-white px-3 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-forest/10"
              value={action}
              onChange={(event) => setAction(event.target.value as AdjustmentAction)}
            >
              {actions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <span className="mt-1 block text-xs font-normal text-muted">{selectedAction.help}</span>
          </label>

          <label className="block text-sm font-medium text-ink">
            Quantity ({resource.unit || 'units'})
            <input
              className="mt-1.5 h-11 w-full rounded-md border border-[#d8e0db] bg-white px-3 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-forest/10"
              min="1"
              onChange={(event) => setQuantity(event.target.value)}
              required
              step="1"
              type="number"
              value={quantity}
            />
          </label>

          <label className="block text-sm font-medium text-ink">
            Reason <span className="font-normal text-muted">(optional)</span>
            <input
              className="mt-1.5 h-11 w-full rounded-md border border-[#d8e0db] bg-white px-3 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-forest/10"
              maxLength={255}
              onChange={(event) => setReason(event.target.value)}
              placeholder="For example, new delivery"
              value={reason}
            />
          </label>

          <label className="block text-sm font-medium text-ink">
            Reference <span className="font-normal text-muted">(optional)</span>
            <input
              className="mt-1.5 h-11 w-full rounded-md border border-[#d8e0db] bg-white px-3 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-forest/10"
              maxLength={100}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Delivery note or internal reference"
              value={reference}
            />
          </label>

          {error && <p className="rounded-md bg-[#fff1ed] px-3 py-2.5 text-sm text-[#9d4937]" role="alert">{error}</p>}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button className="h-10 rounded-md border border-[#d8e0db] px-4 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-60" disabled={isPending} onClick={onClose} type="button">Cancel</button>
            <button className="h-10 rounded-md bg-forest px-4 text-sm font-semibold text-white hover:bg-[#164333] disabled:cursor-wait disabled:opacity-60" disabled={isPending} type="submit">
              {isPending ? 'Saving transaction…' : 'Save transaction'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function ErrorMessage({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const isForbidden = typeof error === 'object' && error !== null && 'response' in error &&
    typeof error.response === 'object' && error.response !== null && 'status' in error.response &&
    error.response.status === 403

  return (
    <div className="mt-5 flex flex-col gap-3 rounded-lg border border-[#f0c9be] bg-[#fff6f3] p-5 sm:flex-row sm:items-center sm:justify-between" role="alert">
      <p className="text-sm text-[#914c3c]">
        {isForbidden
          ? 'Your account cannot access or manage these resources. Ask a hospital administrator to check your permissions.'
          : 'Could not load resource data. Check your access and confirm Django is running at the configured API URL.'}
      </p>
      <button className="inline-flex h-9 w-fit items-center gap-2 rounded-md border border-[#e6b9ad] bg-white px-3 text-xs font-semibold text-[#914c3c] hover:bg-[#fff1ed]" onClick={onRetry} type="button">
        <RefreshCw size={14} aria-hidden="true" /> Retry
      </button>
    </div>
  )
}

export function ResourceManagementDashboard() {
  const queryClient = useQueryClient()
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)
  const isLive = Boolean(token)
  const [facility, setFacility] = useState('all')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState<ResourceStatusFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedResource, setSelectedResource] = useState<HospitalResource | null>(null)
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null)
  const resourcesQuery = useQuery({
    queryKey: ['hospital-resources'],
    queryFn: getHospitalResources,
    enabled: isLive,
  })
  const categoriesQuery = useQuery({
    queryKey: ['resource-categories'],
    queryFn: getResourceCategories,
    enabled: isLive,
  })

  const adjustmentMutation = useMutation({
    mutationFn: (input: { id: number; adjustment: ResourceAdjustment }) => adjustHospitalResource(input.id, input.adjustment),
    onSuccess: async () => {
      setSelectedResource(null)
      setAdjustmentError(null)
      await queryClient.invalidateQueries({ queryKey: ['hospital-resources'] })
      await queryClient.invalidateQueries({ queryKey: ['oxygen-supplies'] })
    },
    onError: (error: unknown) => {
      const responseData = typeof error === 'object' && error !== null && 'response' in error &&
        typeof error.response === 'object' && error.response !== null && 'data' in error.response
        ? error.response.data
        : null
      const detail = typeof responseData === 'object' && responseData !== null && 'detail' in responseData &&
        typeof responseData.detail === 'string'
        ? responseData.detail
        : null
      setAdjustmentError(detail ?? 'The stock adjustment failed. Check permissions and available/reserved quantities, then try again.')
    },
  })

  const signOutMutation = useMutation({
    mutationFn: async () => {
      await queryClient.cancelQueries()
    },
    onSuccess: () => {
      queryClient.clear()
      clearSession()
    },
  })

  const resources = isLive ? resourcesQuery.data ?? [] : sampleResources
  const facilities = useMemo(() => [...new Set(resources.map((resource) => resource.hospital_name))].sort(), [resources])
  const categories = useMemo(() => [...new Set([
    ...resources.map((resource) => resource.resource_type.category_name),
    ...(isLive ? categoriesQuery.data?.map((resourceCategory) => resourceCategory.name) ?? [] : []),
  ])].sort(), [categoriesQuery.data, isLive, resources])
  const filteredResources = useMemo(() => filterHospitalResources(resources, { facility, category, status, search }), [resources, facility, category, status, search])
  const summary = useMemo(() => summarizeHospitalResources(resources), [resources])
  const loading = isLive && resourcesQuery.isLoading
  const updatedAt = resourcesQuery.dataUpdatedAt
    ? new Date(resourcesQuery.dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  function submitAdjustment(adjustment: ResourceAdjustment) {
    if (!selectedResource) return
    setAdjustmentError(null)
    adjustmentMutation.mutate({ id: selectedResource.id, adjustment })
  }

  return (
    <div className="min-h-screen bg-canvas text-ink lg:flex">
      <aside className="flex shrink-0 flex-col bg-navy text-white lg:sticky lg:top-0 lg:h-screen lg:w-[236px]">
        <div className="flex items-center gap-3 px-5 py-5 lg:px-6 lg:py-7">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#d8eee4] text-forest"><Activity size={21} aria-hidden="true" /></span>
          <div><p className="text-[15px] font-semibold">MediConnect</p><p className="mt-0.5 text-[11px] text-white/55">CARE OPERATIONS</p></div>
        </div>
        <WorkspaceNavigation current="/resources" />
        <div className="hidden flex-1 lg:block" />
        <div className="hidden border-t border-white/10 p-5 lg:block">
          <div className="flex items-center gap-2 text-xs text-white/70"><ShieldCheck size={15} aria-hidden="true" /> Secure workspace</div>
          <p className="mt-2 text-[11px] leading-5 text-white/45">Hospital resource inventory. Changes are audited by the backend.</p>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-5 py-3 shadow-sm backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-2 text-xs text-muted"><span className="hidden sm:inline">Operations</span><span className="hidden text-[#bdc7c1] sm:inline">/</span><span className="font-semibold text-ink">Resource management</span></div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[11px] font-semibold ${isLive ? 'bg-[#e5f2eb] text-[#28664e]' : 'bg-[#fbf1df] text-[#8b641d]'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-[#3e8a69]' : 'bg-[#d49a36]'}`} />{isLive ? 'Signed in' : 'Sample data · not live'}
            </div>
            {isLive ? (
              <button onClick={() => signOutMutation.mutate()} className="inline-flex h-9 items-center gap-2 rounded-md border border-black/10 px-3 text-xs font-medium text-muted transition hover:bg-canvas hover:text-ink disabled:opacity-60" type="button" disabled={signOutMutation.isPending} title={user?.first_name || 'Sign out'}>
                <LogOut size={15} aria-hidden="true" /><span className="hidden sm:inline">Sign out</span>
              </button>
            ) : (
              <Link to="/connect" className="inline-flex h-9 items-center gap-2 rounded-md bg-forest px-3 text-xs font-semibold text-white transition hover:bg-[#164333]"><ShieldCheck size={15} aria-hidden="true" /> Connect live data</Link>
            )}
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-7 sm:px-8 sm:pt-9">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase text-forest">Hospital operations</p>
              <h1 className="mt-2 text-[26px] font-semibold leading-tight text-ink sm:text-[30px]">Resource management</h1>
              <p className="mt-2 text-sm text-muted">Monitor hospital stock and record audited inventory transactions.</p>
            </div>
            {isLive && (
              <button className="inline-flex h-10 w-fit items-center gap-2 rounded-md border border-[#d8e0db] bg-white px-3 text-xs font-medium text-ink transition hover:bg-[#f8faf9] disabled:opacity-60" disabled={resourcesQuery.isFetching} onClick={() => void resourcesQuery.refetch()} type="button" aria-label="Refresh resource data">
                <RefreshCw className={resourcesQuery.isFetching ? 'animate-spin' : ''} size={15} aria-hidden="true" />Refresh
              </button>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#d7e6dd] bg-[#eaf3ee] px-4 py-3 text-xs text-[#355f4c]">
            <div className="flex items-center gap-2"><span className="font-semibold">{isLive ? 'Authenticated session' : 'Demonstration resource inventory'}</span>{!isLive && <span className="rounded bg-white/70 px-2 py-1 text-[10px] font-bold uppercase">Demonstration only</span>}</div>
            <div>{isLive ? (updatedAt ? `Fetched ${updatedAt}` : 'Waiting for resource data') : 'Example figures · no hospital data connected'}</div>
          </div>

          {isLive && user && user.role !== 'PATIENT' && resources.length > 0 && (
            <OfflineResourceSyncPanel resources={resources} userId={user.id} />
          )}

          {loading && <div className="mt-5 rounded-lg border border-black/[0.06] bg-white px-5 py-8 text-center text-sm text-muted" role="status">Loading hospital resource data…</div>}
          {isLive && resourcesQuery.error && <ErrorMessage error={resourcesQuery.error} onRetry={() => void resourcesQuery.refetch()} />}
          {isLive && categoriesQuery.error && <ErrorMessage error={categoriesQuery.error} onRetry={() => void categoriesQuery.refetch()} />}
          {isLive && !loading && !resourcesQuery.error && resources.length === 0 && (
            <div className="mt-5 rounded-lg border border-dashed border-[#cbd8d0] bg-white px-5 py-10 text-center">
              <Boxes className="mx-auto text-muted" size={24} aria-hidden="true" />
              <h2 className="mt-3 text-sm font-semibold text-ink">No resources are registered</h2>
              <p className="mt-1 text-sm text-muted">No hospital resource records were returned for this account.</p>
            </div>
          )}

          {!loading && !resourcesQuery.error && resources.length > 0 && (
            <>
              <section aria-label="Resource inventory summary" className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Resource records" value={String(summary.resourceTypes)} detail="Listed resource entries" icon={Boxes} tone="dark" />
                <MetricCard label="Total capacity" value={summary.totalCapacity.toLocaleString()} detail="Combined capacity across records" icon={Building2} tone="green" />
                <MetricCard label="Available stock" value={summary.available.toLocaleString()} detail="Available quantity reported" icon={CheckCircle2} tone="coral" />
                <MetricCard label="Low stock alerts" value={String(summary.lowStock)} detail={`${summary.critical} marked critical by the API`} icon={AlertTriangle} tone={summary.lowStock ? 'amber' : 'green'} />
              </section>

              <Card className="mt-4 p-5 sm:p-6">
                <CardHeader className="flex-col sm:flex-row sm:items-center">
                  <div><CardTitle>Hospital resource inventory</CardTitle><p className="mt-1.5 text-xs text-muted">Search, filter, and review available and reserved stock.</p></div>
                  <button
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-forest px-3 text-xs font-semibold text-white transition hover:bg-[#164333] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    disabled={!isLive}
                    onClick={() => {
                      setAdjustmentError(null)
                      setSelectedResource(filteredResources.find((resource) => resource.is_active) ?? null)
                    }}
                    type="button"
                    title={isLive ? 'Choose a resource below to record a stock transaction' : 'Connect live data to record a real transaction'}
                  >
                    <ClipboardList size={15} aria-hidden="true" /> Record stock transaction
                  </button>
                </CardHeader>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <label className="relative">
                    <span className="sr-only">Search resources</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={15} aria-hidden="true" />
                    <input className="h-10 w-full rounded-md border border-[#d8e0db] bg-white pl-9 pr-3 text-sm outline-none placeholder:text-[#9aa59f] focus:border-forest focus:ring-2 focus:ring-forest/10" onChange={(event) => setSearch(event.target.value)} placeholder="Search inventory" type="search" value={search} />
                  </label>
                  <label className="relative">
                    <span className="sr-only">Filter by facility</span>
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={15} aria-hidden="true" />
                    <select className="h-10 w-full appearance-none rounded-md border border-[#d8e0db] bg-white pl-9 pr-9 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-forest/10" onChange={(event) => setFacility(event.target.value)} value={facility}>
                      <option value="all">All facilities</option>{facilities.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" size={15} aria-hidden="true" />
                  </label>
                  <label className="relative">
                    <span className="sr-only">Filter by category</span>
                    <Stethoscope className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={15} aria-hidden="true" />
                    <select className="h-10 w-full appearance-none rounded-md border border-[#d8e0db] bg-white pl-9 pr-9 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-forest/10" onChange={(event) => setCategory(event.target.value)} value={category}>
                      <option value="all">All categories</option>{categories.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" size={15} aria-hidden="true" />
                  </label>
                  <label className="relative">
                    <span className="sr-only">Filter by stock status</span>
                    <AlertTriangle className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={15} aria-hidden="true" />
                    <select className="h-10 w-full appearance-none rounded-md border border-[#d8e0db] bg-white pl-9 pr-9 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-forest/10" onChange={(event) => setStatus(event.target.value as ResourceStatusFilter)} value={status}>
                      <option value="all">All stock statuses</option><option value="low">Low stock</option><option value="critical">Critical stock</option><option value="inactive">Inactive records</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" size={15} aria-hidden="true" />
                  </label>
                </div>

                {filteredResources.length > 0 ? (
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[980px] text-left text-sm">
                      <thead><tr className="border-y border-black/[0.06] text-[11px] font-semibold uppercase tracking-wide text-muted">
                        <th className="px-3 py-3">Facility / resource</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Stock level</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Updated</th><th className="px-3 py-3">Action</th>
                      </tr></thead>
                      <tbody className="divide-y divide-black/[0.05]">
                        {filteredResources.map((resource) => (
                          <tr key={resource.id} className="align-middle">
                            <td className="px-3 py-4">
                              <div className="flex items-start gap-3">
                                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#e5f2eb] text-forest"><Boxes size={17} aria-hidden="true" /></span>
                                <div><p className="font-semibold text-ink">{resource.resource_type.name}</p><p className="mt-1 text-xs text-muted">{resource.hospital_name} · {resource.unit || 'units'}</p></div>
                              </div>
                            </td>
                            <td className="px-3 py-4"><span className="rounded bg-[#f1f4f2] px-2 py-1 text-xs text-[#58665e]">{resource.resource_type.category_name}</span><p className="mt-1.5 text-[11px] text-muted">{resource.resource_type.code || 'No code'}</p></td>
                            <td className="px-3 py-4"><ResourceProgress resource={resource} /></td>
                            <td className="px-3 py-4">
                              {!resource.is_active
                                ? <span className="inline-flex rounded-full bg-[#eef1ef] px-2.5 py-1 text-[11px] font-semibold text-[#66746c]">Inactive</span>
                                : resource.is_critical
                                  ? <span className="inline-flex rounded-full bg-[#fae9e4] px-2.5 py-1 text-[11px] font-semibold text-[#a9503d]">Critical stock</span>
                                  : resource.is_low_stock
                                    ? <span className="inline-flex rounded-full bg-[#fbf1df] px-2.5 py-1 text-[11px] font-semibold text-[#996b1d]">Low stock</span>
                                    : <span className="inline-flex rounded-full bg-[#e5f2eb] px-2.5 py-1 text-[11px] font-semibold text-[#28664e]">In stock</span>}
                            </td>
                            <td className="px-3 py-4 text-xs text-muted">{formatResourceUpdatedAt(resource.last_updated)}</td>
                            <td className="px-3 py-4">
                              <button
                                className="inline-flex h-9 items-center gap-2 rounded-md border border-[#d8e0db] bg-white px-3 text-xs font-semibold text-ink transition hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={!isLive || !resource.is_active}
                                onClick={() => {
                                  setAdjustmentError(null)
                                  setSelectedResource(resource)
                                }}
                                type="button"
                              >
                                <ArrowUpFromLine size={14} aria-hidden="true" /> Adjust
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-5 rounded-md bg-[#f4f7f5] px-4 py-6 text-center text-sm text-muted">No resources match these filters. Try another facility, category, status, or search term.</p>
                )}
              </Card>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex items-start gap-3 rounded-md border border-[#dce4df] bg-white px-4 py-3 text-xs leading-5 text-muted">
                  <ArrowDownToLine className="mt-0.5 shrink-0 text-forest" size={16} aria-hidden="true" />
                  <p><span className="font-semibold text-ink">Stock changes are recorded.</span> Live adjustments are submitted to the authenticated backend, which creates a resource transaction audit record.</p>
                </div>
                <div className="flex items-start gap-3 rounded-md border border-[#dce4df] bg-white px-4 py-3 text-xs leading-5 text-muted">
                  <ShieldCheck className="mt-0.5 shrink-0 text-forest" size={16} aria-hidden="true" />
                  <p>{isLive ? 'Inventory figures are from the connected resource API; the backend enforces who may make changes.' : 'All inventory and stock status shown are demonstration data, not live hospital records. Connect live data to enable transactions.'}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {selectedResource && isLive && (
        <AdjustmentDialog
          resource={selectedResource}
          isPending={adjustmentMutation.isPending}
          error={adjustmentError}
          onClose={() => {
            if (!adjustmentMutation.isPending) setSelectedResource(null)
          }}
          onSubmit={submitAdjustment}
        />
      )}
    </div>
  )
}
