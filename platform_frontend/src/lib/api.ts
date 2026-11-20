import axios, { type AxiosError, type AxiosResponse } from 'axios'
import { useAuthStore } from '../store/auth'
import { cacheFacilityData, readCachedFacilityData } from './offlineStore'
import type {
  AmbulanceDispatch,
  AmbulanceLocationUpdate,
  AmbulanceRequest,
  AmbulanceRequestCreate,
  AmbulanceRequestStatus,
  Appointment,
  AppointmentCreate,
  Department,
  BloodStock,
  ChangePasswordRequest,
  Bid,
  BidCreate,
  AssignmentReview,
  ContractAssignment,
  ContractListItem,
  Hospital,
  HospitalDetails,
  HospitalMembership,
  HospitalResource,
  InterfacilityReferral,
  InterfacilityReferralCreate,
  HospitalStaff,
  HealthcareProfessional,
  LoginResponse,
  NotificationPreference,
  NotificationRecord,
  OxygenSupply,
  ProfessionalDocument,
  ResourceAdjustment,
  ResourceBurnRatesResponse,
  ResourceCategory,
  ResourceTransaction,
  UserRegistration,
  ApiUser,
  UserProfile,
  UserProfileUpdate,
  WorkContract,
  WorkContractCreate,
} from '../types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api',
  timeout: 15_000,
})

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retry?: boolean
  }
}

type CollectionPage<T> = { results: T[]; next: string | null }

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshRequest: Promise<string> | null = null

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config
    const url = request?.url ?? ''
    const isAuthEndpoint = url.includes('auth/login/') || url.includes('auth/register/') || url.includes('auth/token/refresh/')
    const refreshToken = useAuthStore.getState().refreshToken
    if (!request || error.response?.status !== 401 || request._retry || isAuthEndpoint || !refreshToken) {
      return Promise.reject(error)
    }

    request._retry = true
    if (!refreshRequest) {
      refreshRequest = api.post<{ access: string; refresh?: string }>('auth/token/refresh/', { refresh: refreshToken })
        .then(({ data }) => {
          useAuthStore.getState().updateTokens(data.access, data.refresh ?? refreshToken)
          return data.access
        })
        .catch((refreshError: unknown) => {
          useAuthStore.getState().clearSession()
          throw refreshError
        })
        .finally(() => {
          refreshRequest = null
        })
    }

    try {
      const accessToken = await refreshRequest
      request.headers.Authorization = `Bearer ${accessToken}`
      return api(request)
    } catch (refreshError) {
      return Promise.reject(refreshError)
    }
  },
)

async function fetchCollection<T>(path: string): Promise<T[]> {
  const records: T[] = []
  const visited = new Set<string>()
  let next: string | null = path

  while (next && !visited.has(next)) {
    visited.add(next)
    const response: AxiosResponse<T[] | CollectionPage<T>> = await api.get(next)
    if (Array.isArray(response.data)) {
      records.push(...response.data)
      break
    }
    records.push(...response.data.results)
    next = response.data.next
  }

  return records
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('auth/login/', { email, password })
  return response.data
}

export async function registerProfessional(registration: UserRegistration): Promise<ApiUser> {
  const response = await api.post<ApiUser>('auth/register/', registration)
  return response.data
}

export async function getUserProfile(): Promise<UserProfile> {
  const response = await api.get<UserProfile>('auth/profile/')
  return response.data
}

export async function updateUserProfile(profile: UserProfileUpdate): Promise<UserProfile> {
  const response = await api.patch<UserProfile>('auth/profile/', profile)
  return response.data
}

export async function changePassword(request: ChangePasswordRequest): Promise<{ detail: string }> {
  const response = await api.post<{ detail: string }>('auth/change-password/', request)
  return response.data
}

export function getHospitals(): Promise<Hospital[]> {
  return fetchCachedFacilityCollection<Hospital>('hospitals/', 'hospitals')
}

export function getMyHospitals(): Promise<HospitalMembership[]> {
  return fetchCollection<HospitalMembership>('hospitals/mine/')
}

export function getInterfacilityReferrals(): Promise<InterfacilityReferral[]> {
  return fetchCollection<InterfacilityReferral>('ambulance/referrals/')
}

export async function createInterfacilityReferral(
  referral: InterfacilityReferralCreate,
): Promise<InterfacilityReferral> {
  const response = await api.post<InterfacilityReferral>('ambulance/referrals/', referral)
  return response.data
}

export async function acceptInterfacilityReferral(referralId: number): Promise<InterfacilityReferral> {
  const response = await api.post<InterfacilityReferral>(
    `ambulance/referrals/${referralId}/accept/`,
  )
  return response.data
}

export function getAmbulanceRequests(): Promise<AmbulanceRequest[]> {
  return fetchCollection<AmbulanceRequest>('ambulance/requests/')
}

async function fetchCachedFacilityCollection<T>(
  path: string,
  cacheKey: string,
  sanitize: (records: T[]) => T[] = (records) => records,
): Promise<T[]> {
  try {
    const records = await fetchCollection<T>(path)
    if (typeof window !== 'undefined') {
      try {
        await cacheFacilityData(cacheKey, sanitize(records))
      } catch (error) {
        console.error(`Could not cache facility data (${cacheKey}).`, error)
      }
    }
    return records
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response) throw error
    if (typeof window !== 'undefined') {
      try {
        const cached = await readCachedFacilityData<T[]>(cacheKey)
        if (cached) return cached
      } catch (cacheError) {
        console.error(`Could not read cached facility data (${cacheKey}).`, cacheError)
      }
    }
    throw error
  }
}

function roundAmbulanceCoordinates(latitude: number, longitude: number) {
  return {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
  }
}

export async function createAmbulanceRequest(request: AmbulanceRequestCreate): Promise<AmbulanceRequest> {
  const coordinates = roundAmbulanceCoordinates(request.pickup_latitude, request.pickup_longitude)
  const response = await api.post<AmbulanceRequest>('ambulance/requests/', {
    ...request,
    pickup_latitude: coordinates.latitude,
    pickup_longitude: coordinates.longitude,
  })
  return response.data
}

export interface DriverTelemetrySessionLink {
  driver_url: string
  expires_at: string
  detail: string
}

export async function createDriverTelemetrySession(ambulanceRequestId: number): Promise<DriverTelemetrySessionLink> {
  const response = await api.post<DriverTelemetrySessionLink>('driver-telemetry/sessions/', {
    ambulance_request_id: ambulanceRequestId,
  })
  return response.data
}

export interface DriverTelemetryExchange {
  access_token: string
  expires_at: string
  ambulance_request_id: number
}

export async function exchangeDriverLink(linkToken: string): Promise<DriverTelemetryExchange> {
  const response = await api.post<DriverTelemetryExchange>('driver-telemetry/exchange/', {
    link_token: linkToken,
  })
  return response.data
}

export async function dispatchAmbulanceRequest(
  requestId: number,
  dispatch: AmbulanceDispatch,
): Promise<AmbulanceRequest> {
  const coordinates = roundAmbulanceCoordinates(dispatch.latitude, dispatch.longitude)
  const response = await api.post<AmbulanceRequest>(
    `ambulance/requests/${requestId}/dispatch/`,
    { ...dispatch, ...coordinates },
  )
  return response.data
}

export async function updateAmbulanceLocation(
  requestId: number,
  location: AmbulanceLocationUpdate,
): Promise<AmbulanceRequest> {
  const coordinates = roundAmbulanceCoordinates(location.latitude, location.longitude)
  const response = await api.post<AmbulanceRequest>(
    `ambulance/requests/${requestId}/location/`,
    { ...location, ...coordinates },
  )
  return response.data
}

export async function updateAmbulanceStatus(
  requestId: number,
  status: AmbulanceRequestStatus,
): Promise<AmbulanceRequest> {
  const response = await api.post<AmbulanceRequest>(
    `ambulance/requests/${requestId}/status/`,
    { status },
  )
  return response.data
}

export async function cancelAmbulanceRequest(requestId: number): Promise<AmbulanceRequest> {
  const response = await api.post<AmbulanceRequest>(
    `ambulance/requests/${requestId}/cancel/`,
  )
  return response.data
}

export function getHealthcareProfessionals(hospitalId?: number): Promise<HealthcareProfessional[]> {
  const query = hospitalId ? `?hospital=${hospitalId}` : ''
  return fetchCollection<HealthcareProfessional>(`appointments/professionals/${query}`)
}

export function getAppointments(): Promise<Appointment[]> {
  return fetchCollection<Appointment>('appointments/bookings/')
}

export async function createAppointment(appointment: AppointmentCreate): Promise<Appointment> {
  const response = await api.post<Appointment>('appointments/bookings/', appointment)
  return response.data
}

export async function getHospital(hospitalId: number): Promise<HospitalDetails> {
  const response = await api.get<HospitalDetails>(`hospitals/${hospitalId}/`)
  return response.data
}

export async function createHospital(hospital: Partial<HospitalDetails>): Promise<HospitalDetails> {
  const response = await api.post<HospitalDetails>('hospitals/', hospital)
  return response.data
}

export async function updateHospital(hospitalId: number, hospital: Partial<HospitalDetails>): Promise<HospitalDetails> {
  const response = await api.patch<HospitalDetails>(`hospitals/${hospitalId}/`, hospital)
  return response.data
}

export function getHospitalResources(): Promise<HospitalResource[]> {
  return fetchCachedFacilityCollection<HospitalResource>(
    'resources/stocks/',
    'hospital-resources',
    (resources) => resources.map((resource) => ({ ...resource, notes: '' })),
  )
}

export async function getResourceBurnRates(hours = 24): Promise<ResourceBurnRatesResponse> {
  const response = await api.get<ResourceBurnRatesResponse>('resources/burn-rates/', {
    params: { hours },
  })
  return response.data
}

export interface OfflineResourceUpdateRequest {
  idempotency_key: string
  hospital_resource: number
  expected_last_updated: string
  available_quantity: number
}

export interface OfflineResourceUpdateResponse extends OfflineResourceUpdateRequest {
  status: 'PROCESSING' | 'APPLIED' | 'CONFLICT'
  previous_available: number | null
  detail: string
  created_at: string
  applied_at: string | null
}

export async function postOfflineResourceUpdate(
  update: OfflineResourceUpdateRequest,
): Promise<OfflineResourceUpdateResponse> {
  const response = await api.post<OfflineResourceUpdateResponse>(
    'integrations/resources/offline-updates/',
    update,
  )
  return response.data
}

export function getResourceCategories(): Promise<ResourceCategory[]> {
  return fetchCollection<ResourceCategory>('resources/categories/')
}

export async function adjustHospitalResource(
  resourceId: number,
  adjustment: ResourceAdjustment,
): Promise<HospitalResource> {
  const response = await api.post<HospitalResource>(`resources/stocks/${resourceId}/adjust/`, adjustment)
  return response.data
}

export async function getResourceTransactions(resourceId: number): Promise<ResourceTransaction[]> {
  const response = await api.get<ResourceTransaction[]>(`resources/stocks/${resourceId}/transactions/`)
  return response.data
}

export function getHospitalDepartments(hospitalId: number): Promise<Department[]> {
  return fetchCollection<Department>(`hospitals/${hospitalId}/departments/`)
}

export async function createDepartment(department: Pick<Department, 'hospital' | 'name'> & { description: string }): Promise<Department> {
  const response = await api.post<Department>('departments/', department)
  return response.data
}

export function getHospitalStaff(hospitalId: number): Promise<HospitalStaff[]> {
  return fetchCollection<HospitalStaff>(`hospitals/${hospitalId}/staff/`)
}

export async function addHospitalStaff(membership: {
  user_id: number
  hospital: number
  department: number | null
  role_at_hospital: string
  is_primary: boolean
}): Promise<HospitalStaff> {
  const response = await api.post<HospitalStaff>('staff/', membership)
  return response.data
}

export function searchUsers(search: string): Promise<ApiUser[]> {
  return fetchCollection<ApiUser>(`auth/users/?search=${encodeURIComponent(search)}`)
}

export function getOxygenSupplies(): Promise<OxygenSupply[]> {
  return fetchCollection<OxygenSupply>('resources/oxygen/')
}

export function getBloodStocks(): Promise<BloodStock[]> {
  return fetchCollection<BloodStock>('resources/blood/')
}

export function getContracts(): Promise<ContractListItem[]> {
  return fetchCollection<ContractListItem>('contracts/')
}

export async function getContract(contractId: number): Promise<WorkContract> {
  const response = await api.get<WorkContract>(`contracts/${contractId}/`)
  return response.data
}

export async function createContract(contract: WorkContractCreate): Promise<WorkContract> {
  const response = await api.post<WorkContract>('contracts/', contract)
  return response.data
}

export async function publishContract(contractId: number): Promise<WorkContract> {
  const response = await api.post<WorkContract>(`contracts/${contractId}/publish/`)
  return response.data
}

export async function closeContract(contractId: number): Promise<WorkContract> {
  const response = await api.post<WorkContract>(`contracts/${contractId}/close/`)
  return response.data
}

export function getBids(): Promise<Bid[]> {
  return fetchCollection<Bid>('bids/')
}

export async function createBid(bid: BidCreate): Promise<Bid> {
  const response = await api.post<Bid>('bids/', bid)
  return response.data
}

export async function reviewBid(bidId: number, status: 'ACCEPTED' | 'REJECTED', review_notes: string): Promise<Bid> {
  const response = await api.post<Bid>(`bids/${bidId}/review/`, { status, review_notes })
  return response.data
}

export function getAssignments(): Promise<ContractAssignment[]> {
  return fetchCollection<ContractAssignment>('assignments/')
}

export async function checkInAssignment(assignmentId: number): Promise<ContractAssignment> {
  const response = await api.post<ContractAssignment>(`assignments/${assignmentId}/check_in/`)
  return response.data
}

export async function checkOutAssignment(assignmentId: number): Promise<ContractAssignment> {
  const response = await api.post<ContractAssignment>(`assignments/${assignmentId}/check_out/`)
  return response.data
}

export async function updateAssignmentReview(assignmentId: number, review: AssignmentReview): Promise<ContractAssignment> {
  const response = await api.patch<ContractAssignment>(`assignments/${assignmentId}/`, review)
  return response.data
}

export function getNotifications(): Promise<NotificationRecord[]> {
  return fetchCollection<NotificationRecord>('notifications/')
}

export async function getUnreadNotificationCount(): Promise<number> {
  const response = await api.get<{ unread_count: number }>('notifications/unread_count/')
  return response.data.unread_count
}

export async function markNotificationRead(notificationId: number): Promise<NotificationRecord> {
  const response = await api.post<NotificationRecord>(`notifications/${notificationId}/mark_read/`)
  return response.data
}

export async function markAllNotificationsRead(): Promise<{ marked_read: number }> {
  const response = await api.post<{ marked_read: number }>('notifications/mark_all_read/')
  return response.data
}

export async function getNotificationPreferences(): Promise<NotificationPreference> {
  const response = await api.get<NotificationPreference>('preferences/')
  return response.data
}

export async function updateNotificationPreferences(
  preferences: Partial<NotificationPreference>,
): Promise<NotificationPreference> {
  const response = await api.patch<NotificationPreference>('preferences/', preferences)
  return response.data
}

export function getProfessionalDocuments(): Promise<ProfessionalDocument[]> {
  return fetchCollection<ProfessionalDocument>('auth/documents/')
}

export async function uploadProfessionalDocument(file: File, documentType: string, description: string): Promise<ProfessionalDocument> {
  const data = new FormData()
  data.append('file', file)
  data.append('document_type', documentType)
  data.append('description', description)
  const response = await api.post<ProfessionalDocument>('auth/documents/', data)
  return response.data
}