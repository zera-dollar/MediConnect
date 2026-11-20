import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth'
import { dashboardPathForRole, workspaceNavigationForRole } from '../lib/roleDashboard'
import { WorkspaceNavigation } from './WorkspaceNavigation'

describe('workspace navigation', () => {
  afterEach(() => useAuthStore.getState().clearSession())

  it('keeps the complete navigation available in sample mode', () => {
    const queryClient = new QueryClient()
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          StaticRouter,
          { location: '/audit' },
          createElement(WorkspaceNavigation, { current: '/audit' }),
        ),
      ),
    )
    queryClient.clear()

    expect(html).toContain('href="/audit"')
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('Audit Centre')
    expect(html).not.toContain('href="/icu"')
    expect(html).toContain('href="/staffing"')
    expect(html).toContain('Staffing marketplace')
    expect(html).toContain('href="/notifications"')
    expect(html).toContain('Notifications')
    expect(html).toContain('href="/hospitals"')
    expect(html).toContain('Facility directory')
    expect(html).toContain('href="/ambulance"')
    expect(html).toContain('Ambulance services')
    expect(html).toContain('href="/referrals"')
    expect(html).toContain('Interfacility referrals')
    expect(html).toContain('href="/appointments"')
    expect(html).toContain('Book appointments')
    expect(html).toContain('href="/oxygen"')
    expect(html).toContain('href="/resources"')
    expect(html).toContain('href="/analytics"')
    expect(html).toContain('href="/reports"')
    expect(html).toContain('href="/settings"')
    expect(html).toContain('href="/appointments"')
  })

  it('limits patient navigation to patient dashboard features', () => {
    const items = workspaceNavigationForRole('PATIENT')
    const paths = items.map(({ to }) => to)

    expect(paths[0]).toBe(dashboardPathForRole('PATIENT'))
    expect(paths).toContain('/notifications')
    expect(paths).toContain('/ambulance')
    expect(paths).toContain('/hospitals')
    expect(paths).toContain('/appointments')
    expect(paths).toContain('/settings')
    expect(paths).not.toContain('/staffing')
    expect(paths).not.toContain('/resources')
  })

  it('limits professional navigation to work and profile features', () => {
    const items = workspaceNavigationForRole('DOCTOR')
    const paths = items.map(({ to }) => to)

    expect(paths[0]).toBe(dashboardPathForRole('DOCTOR'))
    expect(paths).toContain('/staffing')
    expect(paths).toContain('/notifications')
    expect(paths).toContain('/settings')
    expect(paths).toContain('/appointments')
    expect(paths).not.toContain('/ambulance')
  })

  it('makes referral coordination available to nurses and hospital staff', () => {
    expect(workspaceNavigationForRole('NURSE').map(({ to }) => to)).toContain('/referrals')
    expect(workspaceNavigationForRole('STAFF').map(({ to }) => to)).toContain('/referrals')
    expect(workspaceNavigationForRole('HOSPITAL_ADMIN').map(({ to }) => to)).toContain('/referrals')
  })
})
