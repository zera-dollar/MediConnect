import { describe, expect, it } from 'vitest'
import { dashboardPathForRole, roleDashboards, roleForDashboardSlug } from '../lib/roleDashboard'
import type { UserRole } from '../types'

const roles: UserRole[] = [
  'ADMIN',
  'HOSPITAL_ADMIN',
  'DOCTOR',
  'NURSE',
  'SPECIALIST',
  'STAFF',
  'PATIENT',
]

describe('role dashboards', () => {
  it('assigns a distinct dashboard route to every account role', () => {
    const paths = roles.map(dashboardPathForRole)

    expect(new Set(paths).size).toBe(roles.length)
    roles.forEach((role, index) => {
      expect(roleForDashboardSlug(paths[index].split('/').pop())).toBe(role)
    })
  })

  it('configures patient dashboard with the requested care actions only', () => {
    const dashboard = roleDashboards.PATIENT
    const labels = dashboard.features.map(({ label }) => label)

    expect(dashboard.title).toBe('Patient dashboard')
    expect(labels).toEqual([
      'User Notifications',
      'Ambulance services',
      'Find Hospital',
      'Book appointments',
      'Profile settings',
    ])
    expect(labels).not.toContain('Staffing marketplace')
  })

  it('gives clinical and facility roles distinct operational tools', () => {
    const pathsFor = (role: UserRole) => roleDashboards[role].features.map(({ to }) => to)

    expect(pathsFor('ADMIN')).toContain('/analytics')
    expect(pathsFor('ADMIN')).toContain('/reports')
    expect(pathsFor('HOSPITAL_ADMIN')).toContain('/referrals')
    expect(pathsFor('HOSPITAL_ADMIN')).toContain('/resources')
    expect(pathsFor('HOSPITAL_ADMIN')).not.toContain('/analytics')
    expect(pathsFor('DOCTOR')).toContain('/appointments')
    expect(pathsFor('DOCTOR')).toContain('/staffing')
    expect(pathsFor('DOCTOR')).not.toContain('/resources')
    expect(pathsFor('NURSE')).toEqual(expect.arrayContaining(['/referrals', '/ambulance', '/resources', '/oxygen']))
    expect(pathsFor('STAFF')).toContain('/ambulance')
    expect(pathsFor('STAFF')).toContain('/referrals')
    expect(pathsFor('STAFF')).not.toContain('/staffing')
  })
})
