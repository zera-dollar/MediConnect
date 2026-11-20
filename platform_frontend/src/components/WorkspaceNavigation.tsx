import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, LogOut } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { publicWorkspaceNavigationItems, workspaceNavigationForRole } from '../lib/roleDashboard'
import type { DashboardFeature } from '../lib/roleDashboard'
import { useAuthStore } from '../store/auth'

interface NavigationGroup {
  label: string
  items: DashboardFeature[]
}

function groupForPath(path: string): string {
  if (path.startsWith('/dashboard/')) return 'Overview'
  if (path === '/notifications' || path === '/settings') return 'Account'
  if (['/staffing', '/resources', '/oxygen', '/audit', '/analytics', '/reports'].includes(path)) {
    return 'Operations'
  }
  return 'Care coordination'
}

function groupItems(items: DashboardFeature[]): NavigationGroup[] {
  const grouped = new Map<string, DashboardFeature[]>()
  for (const item of items) {
    const label = groupForPath(item.to)
    const group = grouped.get(label) ?? []
    group.push(item)
    grouped.set(label, group)
  }
  return Array.from(grouped, ([label, groupItems]) => ({ label, items: groupItems }))
}

function NavigationLinks({
  groups,
  current,
}: {
  groups: NavigationGroup[]
  current: string
}) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h2 className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.17em] text-white/45">
            {group.label}
          </h2>
          <div className="space-y-1">
            {group.items.map(({ to, label, icon: Icon }) => {
              const active = to === current
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  className={`group relative flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-white/12 text-white shadow-sm before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-full before:bg-[#81d2ad]'
                      : 'text-white/70 hover:bg-white/[0.07] hover:text-white'
                  }`}
                >
                  <Icon
                    size={17}
                    aria-hidden="true"
                    className={active ? 'text-[#a5e3c4]' : 'text-white/55 group-hover:text-white/90'}
                  />
                  <span className="truncate">{label}</span>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

export function WorkspaceNavigation({ current }: { current: string }) {
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)
  const navigationItems = user
    ? workspaceNavigationForRole(user.role)
    : publicWorkspaceNavigationItems
  const groups = groupItems(navigationItems)
  const activeLabel = navigationItems.find(({ to }) => to === current)?.label ?? 'Workspace menu'
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const displayName = user?.full_name
    || [user?.first_name, user?.last_name].filter(Boolean).join(' ')
    || user?.email

  async function signOut() {
    await queryClient.cancelQueries()
    queryClient.clear()
    clearSession()
    navigate('/connect', { replace: true })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav aria-label="Workspace" className="min-h-0 flex-1 overflow-y-auto px-3 py-4 lg:px-4">
        <div className="hidden lg:block">
          <NavigationLinks groups={groups} current={current} />
        </div>
        <details className="group lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm font-semibold text-white marker:hidden focus-visible:outline-white">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{activeLabel}</span>
              <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/65">
                {navigationItems.length} tools
              </span>
            </span>
            <ChevronDown size={16} aria-hidden="true" className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 max-h-[55vh] overflow-y-auto rounded-xl border border-white/10 bg-[#0f332d] p-3">
            <NavigationLinks groups={groups} current={current} />
          </div>
        </details>
      </nav>

      {user && (
        <footer className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3 lg:block lg:px-5 lg:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d9efe3] text-sm font-bold text-navy">
              {(user.first_name?.[0] || user.email[0]).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{displayName}</p>
              <p className="mt-0.5 hidden truncate text-xs capitalize text-white/55 lg:block">
                {user.role.toLowerCase().replace(/_/g, ' ')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-white/70 transition hover:bg-white/[0.07] hover:text-white lg:mt-3 lg:w-full lg:justify-start"
          >
            <LogOut size={16} aria-hidden="true" />
            <span className="hidden lg:inline">Sign out</span>
            <span className="sr-only lg:hidden">Sign out</span>
          </button>
        </footer>
      )}
    </div>
  )
}
