import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, patch, post } = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}))

vi.mock('axios', () => ({
  default: {
    create: () => ({
      get,
      patch,
      post,
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    }),
  },
}))

import {
  cancelAmbulanceRequest,
  checkInAssignment,
  checkOutAssignment,
  createAmbulanceRequest,
  createBid,
  dispatchAmbulanceRequest,
  createAppointment,
  getContracts,
  getHealthcareProfessionals,
  getNotifications,
  getNotificationPreferences,
  getAmbulanceRequests,
  getResourceCategories,
  markAllNotificationsRead,
  markNotificationRead,
  publishContract,
  registerProfessional,
  reviewBid,
  updateAmbulanceLocation,
  updateAmbulanceStatus,
  updateNotificationPreferences,
} from './api'

describe('MediConnect platform API', () => {
  beforeEach(() => {
    get.mockReset()
    patch.mockReset()
    post.mockReset()
  })

  it('loads contract collections and submits bids and contract actions to documented routes', async () => {
    const contracts = [{ id: 21, title: 'Night nurse' }]
    get.mockResolvedValue({ data: { results: contracts, next: null } })
    post.mockImplementation(async (path: string) => ({ data: { path } }))

    await expect(getContracts()).resolves.toEqual(contracts)
    await expect(createBid({ contract: 21, proposed_rate: 80, currency: 'KES', message: 'Available', availability_confirmed: true }))
      .resolves.toEqual({ path: 'bids/' })
    await expect(publishContract(21)).resolves.toEqual({ path: 'contracts/21/publish/' })
    await expect(reviewBid(8, 'ACCEPTED', 'Welcome aboard')).resolves.toEqual({ path: 'bids/8/review/' })

    expect(get).toHaveBeenCalledWith('contracts/')
    expect(post).toHaveBeenCalledWith('bids/', {
      contract: 21,
      proposed_rate: 80,
      currency: 'KES',
      message: 'Available',
      availability_confirmed: true,
    })
    expect(post).toHaveBeenCalledWith('bids/8/review/', { status: 'ACCEPTED', review_notes: 'Welcome aboard' })
  })

  it('routes check-in and check-out through assignment actions', async () => {
    post.mockImplementation(async (path: string) => ({ data: { path } }))

    await expect(checkInAssignment(3)).resolves.toEqual({ path: 'assignments/3/check_in/' })
    await expect(checkOutAssignment(3)).resolves.toEqual({ path: 'assignments/3/check_out/' })
  })

  it('uses the documented registration, inbox, and preference routes', async () => {
    const registration = {
      email: 'clinician@example.test',
      password: 'pass',
      password_confirm: 'pass',
      first_name: 'Clinician',
      last_name: 'Example',
      role: 'DOCTOR' as const,
      phone: '',
      license_number: '',
      specialization: '',
      years_of_experience: 0,
      bio: '',
      preferred_locations: [],
    }
    post.mockImplementation(async (path: string) => ({ data: { path } }))
    get.mockImplementation(async (path: string) => ({ data: path === 'notifications/' ? [] : { path } }))
    patch.mockImplementation(async (path: string) => ({ data: { path } }))

    await expect(registerProfessional(registration)).resolves.toEqual({ path: 'auth/register/' })
    await expect(getNotifications()).resolves.toEqual([])
    await expect(markNotificationRead(4)).resolves.toEqual({ path: 'notifications/4/mark_read/' })
    await expect(markAllNotificationsRead()).resolves.toEqual({ path: 'notifications/mark_all_read/' })
    await expect(getNotificationPreferences()).resolves.toEqual({ path: 'preferences/' })
    await expect(updateNotificationPreferences({ sms_enabled: true })).resolves.toEqual({ path: 'preferences/' })

    expect(patch).toHaveBeenCalledWith('preferences/', { sms_enabled: true })
  })

  it('creates and tracks ambulance requests through their documented actions', async () => {
    const request = {
      destination_hospital: 7,
      pickup_address: 'Test Street',
      pickup_latitude: -1.2921234567,
      pickup_longitude: 36.8219876543,
      patient_notes: '',
    }
    get.mockResolvedValue({ data: { results: [{ id: 3 }], next: null } })
    post.mockImplementation(async (path: string) => ({ data: { path } }))

    await expect(getAmbulanceRequests()).resolves.toEqual([{ id: 3 }])
    await expect(createAmbulanceRequest(request)).resolves.toEqual({ path: 'ambulance/requests/' })
    await expect(dispatchAmbulanceRequest(3, {
      ambulance_code: 'AMB-3',
      latitude: -1.2901234567,
      longitude: 36.8298765432,
      eta_minutes: 10,
    })).resolves.toEqual({ path: 'ambulance/requests/3/dispatch/' })
    await expect(updateAmbulanceLocation(3, {
      latitude: -1.2859876543,
      longitude: 36.8212345678,
      eta_minutes: 4,
    })).resolves.toEqual({ path: 'ambulance/requests/3/location/' })
    await expect(updateAmbulanceStatus(3, 'ARRIVED')).resolves.toEqual({
      path: 'ambulance/requests/3/status/',
    })
    await expect(cancelAmbulanceRequest(3)).resolves.toEqual({
      path: 'ambulance/requests/3/cancel/',
    })

    expect(post).toHaveBeenCalledWith('ambulance/requests/3/status/', { status: 'ARRIVED' })
    expect(post).toHaveBeenCalledWith('ambulance/requests/', {
      ...request,
      pickup_latitude: -1.292123,
      pickup_longitude: 36.821988,
    })
    expect(post).toHaveBeenCalledWith('ambulance/requests/3/dispatch/', {
      ambulance_code: 'AMB-3',
      latitude: -1.290123,
      longitude: 36.829877,
      eta_minutes: 10,
    })
    expect(post).toHaveBeenCalledWith('ambulance/requests/3/location/', {
      latitude: -1.285988,
      longitude: 36.821235,
      eta_minutes: 4,
    })
  })

  it('scopes appointment professionals and booking payloads to the selected hospital', async () => {
    const professionals = [{ id: 8, full_name: 'Alex Doctor' }]
    get.mockResolvedValue({ data: { results: professionals, next: null } })
    post.mockImplementation(async (path: string, payload: unknown) => ({ data: { path, payload } }))

    await expect(getHealthcareProfessionals(42)).resolves.toEqual(professionals)
    await expect(createAppointment({
      professional: 8,
      hospital: 42,
      patient_name: 'Pat Patient',
      patient_email: 'patient@example.test',
      patient_phone: '',
      start_datetime: '2027-01-01T10:00:00Z',
      duration_minutes: 30,
    })).resolves.toEqual({
      path: 'appointments/bookings/',
      payload: {
        professional: 8,
        hospital: 42,
        patient_name: 'Pat Patient',
        patient_email: 'patient@example.test',
        patient_phone: '',
        start_datetime: '2027-01-01T10:00:00Z',
        duration_minutes: 30,
      },
    })

    expect(get).toHaveBeenCalledWith('appointments/professionals/?hospital=42')
    expect(post).toHaveBeenCalledWith('appointments/bookings/', expect.objectContaining({ hospital: 42 }))
  })

  it('loads the resource catalog including categories without stock records', async () => {
    const categories = [{ id: 8, name: 'Organs', slug: 'organs' }]
    get.mockResolvedValue({ data: { results: categories, next: null } })

    await expect(getResourceCategories()).resolves.toEqual(categories)
    expect(get).toHaveBeenCalledWith('resources/categories/')
  })
})
