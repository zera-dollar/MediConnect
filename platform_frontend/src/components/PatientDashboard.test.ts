import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { useAuthStore } from '../store/auth'
import { PatientDashboard } from './PatientDashboard'

describe('patient dashboard', () => {
  afterEach(() => useAuthStore.getState().clearSession())

  it('integrates notifications, ambulance, nearby hospitals, appointments, and profile settings', () => {
    const queryClient = new QueryClient()
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          StaticRouter,
          { location: '/dashboard/patient' },
          createElement(PatientDashboard),
        ),
      ),
    )

    expect(html).toContain('Your care dashboard')
    expect(html).toContain('User Notifications')
    expect(html).toContain('Ambulance services')
    expect(html).toContain('Hospitals near you')
    expect(html).toContain('Use my location')
    expect(html).toContain('Book or manage appointments')
    expect(html).toContain('Profile settings')
    expect(html).not.toContain('Search hospitals')
    expect(html).toContain('Hospital resource availability')
    queryClient.clear()
  })
})
