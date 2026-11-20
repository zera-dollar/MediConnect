import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  Boxes,
  ChartNoAxesCombined,
  Download,
  Droplets,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Link } from 'react-router-dom'
import { getHospitalResources, getOxygenSupplies, getResourceBurnRates } from '../lib/api'
import {
  buildAnalyticsCsv,
  buildOxygenAnalytics,
  filterAnalyticsByFacility,
  groupResourcesByCategory,
  summarizeAnalytics,
} from '../lib/analytics'
import { useAuthStore } from '../store/auth'
import { Card, CardHeader, CardTitle } from './ui/card'
import { WorkspaceNavigation } from './WorkspaceNavigation'

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
  icon: typeof Boxes
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

export function AnalyticsLoadingState() {
  return <div className="mt-5 rounded-lg border border-black/[0.06] bg-white px-5 py-8 text-center text-sm text-muted" role="status">Loading analytics data…</div>
}

export function AnalyticsEmptyState({ filtered }: { filtered: boolean }) {
  return (
    <Card className="mt-5 px-5 py-10 text-center">
      <ChartNoAxesCombined className="mx-auto text-muted" size={25} aria-hidden="true" />
      <h2 className="mt-3 text-sm font-semibold text-ink">{filtered ? 'No data for this facility' : 'No analytics data available'}</h2>
      <p className="mt-1 text-sm text-muted">The connected APIs returned no resource or oxygen records for this view.</p>
    </Card>
  )
}

export function AnalyticsApiError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div className="mt-4 flex items-start gap-3 rounded-md border border-[#f0c9bd] bg-[#fff6f3] p-4 text-sm text-[#8f4635]" role="alert">
      <AlertTriangle className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-1">The API request failed. Check the backend connection and your access, then retry.</p>
      </div>
      <button onClick={onRetry} className="rounded border border-[#e4b6a9] px-3 py-1.5 text-xs font-semibold" type="button">Retry</button>
    </div>
  )
}

export function AnalyticsDashboard() {
  const queryClient = useQueryClient()
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)
  const isLive = Boolean(token)
  const [facility, setFacility] = useState('all')

  const resourcesQuery = useQuery({
    queryKey: ['hospital-resources'],
    queryFn: getHospitalResources,
    enabled: isLive,
  })
  const oxygenQuery = useQuery({
    queryKey: ['oxygen-supplies'],
    queryFn: getOxygenSupplies,
    enabled: isLive,
  })
  const burnRatesQuery = useQuery({
    queryKey: ['resource-burn-rates', 24],
    queryFn: () => getResourceBurnRates(24),
    enabled: isLive,
  })

  const resources = resourcesQuery.data ?? []
  const oxygen = oxygenQuery.data ?? []
  const facilities = useMemo(
    () => [...new Set([...resources.map((item) => item.hospital_name), ...oxygen.map((item) => item.hospital_name)])].sort(),
    [resources, oxygen],
  )
  const filteredResources = useMemo(() => filterAnalyticsByFacility(resources, facility), [resources, facility])
  const filteredOxygen = useMemo(() => filterAnalyticsByFacility(oxygen, facility), [oxygen, facility])
  const burnRates = useMemo(
    () => (burnRatesQuery.data?.results ?? [])
      .filter((item) => facility === 'all' || item.hospital_name === facility)
      .sort((first, second) => {
        if (first.projected_hours_remaining === null) return second.projected_hours_remaining === null ? 0 : 1
        if (second.projected_hours_remaining === null) return -1
        return first.projected_hours_remaining - second.projected_hours_remaining
      }),
    [burnRatesQuery.data, facility],
  )
  const summary = useMemo(() => summarizeAnalytics(filteredResources, filteredOxygen), [filteredResources, filteredOxygen])
  const categoryData = useMemo(() => groupResourcesByCategory(filteredResources), [filteredResources])
  const oxygenData = useMemo(() => buildOxygenAnalytics(filteredOxygen), [filteredOxygen])
  const loading = isLive && (resourcesQuery.isLoading || oxygenQuery.isLoading)
  const hasError = isLive && (resourcesQuery.isError || oxygenQuery.isError)
  const hasAnyRecords = filteredResources.length > 0 || filteredOxygen.length > 0
  const busy = resourcesQuery.isFetching || oxygenQuery.isFetching || burnRatesQuery.isFetching

  async function signOut() {
    await queryClient.cancelQueries()
    queryClient.clear()
    clearSession()
  }

  async function refresh() {
    await Promise.all([resourcesQuery.refetch(), oxygenQuery.refetch(), burnRatesQuery.refetch()])
  }

  function exportCsv() {
    const csv = buildAnalyticsCsv(filteredResources, filteredOxygen)
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `mediconnect-analytics-${facility === 'all' ? 'all-facilities' : 'facility'}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-canvas text-ink lg:flex">
      <aside className="flex shrink-0 flex-col bg-navy text-white lg:sticky lg:top-0 lg:h-screen lg:w-[236px]">
        <div className="flex items-center gap-3 px-5 py-5 lg:px-6 lg:py-7">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#d8eee4] text-forest"><Activity size={21} aria-hidden="true" /></span>
          <div><p className="text-[15px] font-semibold">MediConnect</p><p className="mt-0.5 text-[11px] text-white/55">CARE OPERATIONS</p></div>
        </div>
        <WorkspaceNavigation current="/analytics" />
        <div className="hidden flex-1 lg:block" />
        <div className="hidden border-t border-white/10 p-5 lg:block">
          <div className="flex items-center gap-2 text-xs text-white/70"><ShieldCheck size={15} aria-hidden="true" /> Secure workspace</div>
          <p className="mt-2 text-[11px] leading-5 text-white/45">Current inventory snapshots only. No patient records.</p>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-5 py-3 shadow-sm backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="hidden sm:inline">Operations</span><span className="hidden text-[#bdc7c1] sm:inline">/</span>
            <span className="font-semibold text-ink">Analytics dashboard</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[11px] font-semibold ${isLive ? 'bg-[#e5f2eb] text-[#28664e]' : 'bg-[#fbf1df] text-[#8b641d]'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-[#3e8a69]' : 'bg-[#d49a36]'}`} />
              {isLive ? 'Signed in' : 'Not connected'}
            </div>
            {isLive ? (
              <button onClick={signOut} className="inline-flex h-9 items-center gap-2 rounded-md border border-black/10 px-3 text-xs font-medium text-muted transition hover:bg-canvas hover:text-ink" type="button" title={user?.first_name || 'Sign out'}>
                <LogOut size={15} aria-hidden="true" /><span className="hidden sm:inline">Sign out</span>
              </button>
            ) : (
              <Link to="/connect" className="inline-flex h-9 items-center gap-2 rounded-md bg-forest px-3 text-xs font-semibold text-white transition hover:bg-[#164333]">
                <ShieldCheck size={15} aria-hidden="true" /> Connect live data
              </Link>
            )}
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-7 sm:px-8 sm:pt-9">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase text-forest">Operations insights</p>
              <h1 className="mt-2 text-[26px] font-semibold leading-tight text-ink sm:text-[30px]">Analytics dashboard</h1>
              <p className="mt-2 text-sm text-muted">A current snapshot of hospital resource inventory and oxygen supply.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isLive && (
                <>
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d8e0db] bg-white px-3 text-xs font-medium text-ink transition hover:bg-[#f8faf9] disabled:opacity-60"
                    disabled={busy}
                    onClick={() => void refresh()}
                    type="button"
                    aria-label="Refresh analytics data"
                  >
                    <RefreshCw className={busy ? 'animate-spin' : ''} size={15} aria-hidden="true" />Refresh
                  </button>
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-forest px-3 text-xs font-semibold text-white transition hover:bg-[#164333] disabled:opacity-60"
                    disabled={!hasAnyRecords}
                    onClick={exportCsv}
                    type="button"
                  >
                    <Download size={15} aria-hidden="true" />Export CSV
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 rounded-md border border-[#d7e6dd] bg-[#eaf3ee] px-4 py-3 text-xs text-[#355f4c] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{isLive ? 'Authenticated session' : 'Analytics requires a live connection'}</span>
              {!isLive && <span className="rounded bg-white/70 px-2 py-1 text-[10px] font-bold uppercase">No sample metrics</span>}
            </div>
            <span>Current snapshots from resources and oxygen APIs · not historical trends</span>
          </div>

          {!isLive && (
            <Card className="mt-5 p-6 sm:p-8">
              <div className="mx-auto max-w-xl text-center">
                <ChartNoAxesCombined className="mx-auto text-forest" size={30} aria-hidden="true" />
                <h2 className="mt-3 text-base font-semibold text-ink">Connect to view verified analytics</h2>
                <p className="mt-2 text-sm leading-6 text-muted">This dashboard calculates summaries from live resource and oxygen records. It does not show demonstration values.</p>
                <Link to="/connect" className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-forest px-4 text-xs font-semibold text-white transition hover:bg-[#164333]">
                  <ShieldCheck size={15} aria-hidden="true" />Connect live data
                </Link>
              </div>
            </Card>
          )}

          {isLive && (
            <>
              <div className="mt-5 flex flex-col gap-3 rounded-md border border-black/[0.06] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <label htmlFor="analytics-facility" className="text-xs font-semibold text-ink">Filter by facility</label>
                <select
                  id="analytics-facility"
                  value={facility}
                  onChange={(event) => setFacility(event.target.value)}
                  className="h-10 w-full rounded-md border border-[#d5ded8] bg-white px-3 text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-[#3e8a69]/15 sm:max-w-sm"
                >
                  <option value="all">All facilities</option>
                  {facilities.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>

              {loading && <AnalyticsLoadingState />}
              {resourcesQuery.isError && <AnalyticsApiError title="Resource inventory could not be loaded." onRetry={() => void resourcesQuery.refetch()} />}
              {oxygenQuery.isError && <AnalyticsApiError title="Oxygen supply data could not be loaded." onRetry={() => void oxygenQuery.refetch()} />}
              {burnRatesQuery.isError && <AnalyticsApiError title="Resource burn-rate history could not be loaded." onRetry={() => void burnRatesQuery.refetch()} />}
              {hasError && hasAnyRecords && (
                <p className="mt-3 text-xs text-[#8f4635]" role="status">Partial snapshot: charts and totals include only successfully loaded records.</p>
              )}
              {!loading && !hasError && !hasAnyRecords && (
                <AnalyticsEmptyState filtered={facility !== 'all'} />
              )}
              {!loading && hasAnyRecords && (
                <>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Resource records" value={String(summary.resourceRecords)} detail="Inventory entries in this view" icon={Boxes} tone="dark" />
                    <MetricCard label="Entries with stock available" value={String(summary.availableResourceRecords)} detail="Resource records with a positive available quantity" icon={Activity} tone="green" />
                    <MetricCard label="Low / critical stock" value={`${summary.lowStockRecords} / ${summary.criticalRecords}`} detail="Resource records flagged by backend" icon={AlertTriangle} tone={summary.criticalRecords ? 'coral' : 'amber'} />
                    <MetricCard label="Oxygen units available" value={`${summary.oxygenAvailableUnits.toLocaleString()} / ${summary.oxygenUnits.toLocaleString()}`} detail={`${summary.lowOxygenRecords} oxygen records marked low`} icon={Droplets} tone={summary.lowOxygenRecords ? 'amber' : 'green'} />
                  </div>

                  <Card className="mt-5 p-5">
                    <CardHeader>
                      <div><CardTitle>Resource burn rate</CardTitle><p className="mt-1 text-xs text-muted">Estimated from hourly snapshots over the last {burnRatesQuery.data?.lookback_hours ?? 24} hours. Projections require at least one hour of history.</p></div>
                    </CardHeader>
                    {burnRatesQuery.isLoading ? (
                      <p className="mt-4 text-sm text-muted" role="status">Loading time-series history…</p>
                    ) : burnRates.length ? (
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full min-w-[620px] text-left text-xs">
                          <thead className="border-b border-[#e5ece7] text-muted">
                            <tr><th className="py-2 pr-3 font-semibold">Facility</th><th className="py-2 pr-3 font-semibold">Resource</th><th className="py-2 pr-3 font-semibold">Burn / hour</th><th className="py-2 pr-3 font-semibold">Projected stock remaining</th><th className="py-2 font-semibold">History</th></tr>
                          </thead>
                          <tbody>
                            {burnRates.map((item) => (
                              <tr key={item.resource_id} className="border-b border-[#eef2ef] last:border-0">
                                <td className="py-3 pr-3 font-medium">{item.hospital_name}</td>
                                <td className="py-3 pr-3">{item.resource_type_name}</td>
                                <td className="py-3 pr-3">{item.sufficient_history && item.burn_rate_per_hour !== null ? `${item.burn_rate_per_hour.toLocaleString()} / hour` : 'Insufficient history'}</td>
                                <td className={`py-3 pr-3 ${item.projected_hours_remaining !== null && item.projected_hours_remaining < 24 ? 'font-semibold text-[#a9503d]' : ''}`}>
                                  {item.projected_hours_remaining === null ? item.sufficient_history ? 'No net depletion' : 'Not available' : `${item.projected_hours_remaining.toLocaleString()} hours`}
                                </td>
                                <td className="py-3">{item.sample_count} samples · {item.observed_hours}h</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="mt-4 rounded-md bg-canvas p-3 text-xs leading-5 text-muted">No resource history is available for this facility yet. Burn-rate estimates appear after snapshots span at least one hour.</p>
                    )}
                  </Card>

                  <div className="mt-5 grid gap-4 xl:grid-cols-2">
                    <Card className="p-5">
                      <CardHeader>
                        <div><CardTitle>Inventory records by category</CardTitle><p className="mt-1 text-xs text-muted">Record counts; avoids adding unlike units together</p></div>
                      </CardHeader>
                      {categoryData.length ? (
                        <div className="mt-5 h-[300px]" role="img" aria-label="Bar chart comparing resource capacity, available, and reserved amounts by category">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={categoryData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8eeea" />
                              <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                              <Tooltip />
                              <Bar dataKey="resourceRecords" name="Records" fill="#193c32" radius={[3, 3, 0, 0]} />
                              <Bar dataKey="availableRecords" name="With stock available" fill="#3e8a69" radius={[3, 3, 0, 0]} />
                              <Bar dataKey="flaggedRecords" name="Low / critical" fill="#d49a36" radius={[3, 3, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : <p className="py-12 text-center text-sm text-muted">No resource inventory records for this facility.</p>}
                    </Card>

                    <Card className="p-5">
                      <CardHeader>
                        <div><CardTitle>Oxygen level by supply</CardTitle><p className="mt-1 text-xs text-muted">Reported percentages; unavailable values are not charted</p></div>
                      </CardHeader>
                      {oxygenData.some((item) => item.levelPercent !== null) ? (
                        <div className="mt-5 h-[300px]" role="img" aria-label="Bar chart of reported oxygen percentages by supply">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={oxygenData.filter((item) => item.levelPercent !== null).map((item) => ({
                                ...item,
                                label: `${item.facility} · ${item.supplyType}`,
                              }))}
                              layout="vertical"
                              margin={{ top: 8, right: 18, left: 8, bottom: 8 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e8eeea" />
                              <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                              <YAxis type="category" dataKey="label" width={125} tick={{ fontSize: 10 }} />
                              <Tooltip formatter={(value) => [`${value}%`, 'Level']} />
                              <Bar dataKey="levelPercent" name="Level" radius={[0, 3, 3, 0]}>
                                {oxygenData.filter((item) => item.levelPercent !== null).map((item, index) => (
                                  <Cell key={`${item.facility}-${item.supplyType}-${index}`} fill={item.low ? '#d97862' : '#3e8a69'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : <p className="py-12 text-center text-sm text-muted">No oxygen percentage values were reported by the API.</p>}
                    </Card>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-muted">Metrics and CSV export reflect the records currently returned by the APIs and the selected facility filter. They are not historical trends or a complete audit of past changes.</p>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
