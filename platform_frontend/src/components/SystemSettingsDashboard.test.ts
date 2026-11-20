import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../store/auth'
import { DashboardLoadingFallback } from '../App'
import {
  SettingsErrorNotice,
  SettingsLoadingState,
  credentialStatusLabel,
  profileFormToUpdate,
  validatePasswordForm,
  validateProfileForm,
} from './SystemSettingsDashboard'

describe('System Settings route and validation', () => {
  afterEach(() => useAuthStore.getState().clearSession())

  it('shows an accessible loading fallback while a dashboard route is being loaded', () => {
    const html = renderToStaticMarkup(createElement(DashboardLoadingFallback))
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Loading MediConnect dashboard')
  })

  it('validates required names and non-negative whole-number experience', () => {
    const base = {
      first_name: '  Sam ',
      last_name: ' Lee ',
      phone: '',
      license_number: '',
      specialization: '',
      years_of_experience: '4',
      bio: '',
      preferred_locations: 'Nairobi, Kisumu, ,',
      availability_status: 'AVAILABLE' as const,
    }
    expect(validateProfileForm({ ...base, first_name: ' ' })).toBe('First and last name are required.')
    expect(validateProfileForm({ ...base, years_of_experience: '-1' })).toContain('whole number')
    expect(profileFormToUpdate(base)).toMatchObject({
      first_name: 'Sam',
      last_name: 'Lee',
      years_of_experience: 4,
      preferred_locations: ['Nairobi', 'Kisumu'],
    })
  })

  it('validates password confirmation and renders loading and retry states accessibly', () => {
    expect(validatePasswordForm({ old_password: 'same', new_password: 'new', new_password_confirm: 'no' })).toBe('New password entries do not match.')
    expect(validatePasswordForm({ old_password: 'same', new_password: 'same', new_password_confirm: 'same' })).toContain('different')
    const loading = renderToStaticMarkup(createElement(SettingsLoadingState))
    const error = renderToStaticMarkup(createElement(SettingsErrorNotice, { onRetry: () => undefined }))
    expect(loading).toContain('role="status"')
    expect(error).toContain('role="alert"')
    expect(error).toContain('>Retry</button>')
  })

  it('distinguishes credential verification from pending external access', () => {
    expect(credentialStatusLabel('VERIFIED')).toBe('Verified')
    expect(credentialStatusLabel('PENDING_EXTERNAL_ACCESS')).toContain('authorized KMPDC/registry access')
    expect(credentialStatusLabel('REJECTED')).toBe('Verification rejected')
  })
})
