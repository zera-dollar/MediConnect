export interface ApiUser {
  id: number
  email: string
  full_name?: string
  first_name: string
  last_name: string
  role: string
  phone?: string
  license_number?: string
  specialization?: string
  years_of_experience?: number
  bio?: string
  is_verified?: boolean
  preferred_locations?: string[]
  availability_status?: 'AVAILABLE' | 'BUSY' | 'ON_LEAVE' | 'NOT_AVAILABLE'
}

export interface UserProfile extends ApiUser {
  full_name: string
  profile_picture: string | null
  created_at: string
  updated_at: string
}

export interface UserProfileUpdate {
  first_name: string
  last_name: string
  phone: string
  license_number: string
  specialization: string
  years_of_experience: number
  bio: string
  preferred_locations: string[]
  availability_status: NonNullable<ApiUser['availability_status']>
}

export interface ChangePasswordRequest {
  old_password: string
  new_password: string
  new_password_confirm: string
}

export interface LoginResponse {
  access: string
  refresh: string
  user: ApiUser
}

export interface Hospital {
  id: number
  name: string
  city: string
  country: string
  is_active: boolean
  phone?: string
  latitude?: number | string | null
  longitude?: number | string | null
}

export interface Department {
  id: number
  name: string
  description?: string
  hospital: number
  is_active: boolean
}

export interface ResourceType {
  id: number
  category: number
  category_name: string
  name: string
  code: string
  is_active: boolean
}

export interface ResourceCategory {
  id: number
  name: string
  slug: string
  description: string
  icon: string
  is_critical: boolean
  unit_label: string
}

export interface HospitalResource {
  id: number
  hospital: number
  hospital_name: string
  resource_type: ResourceType
  department: number | null
  total_capacity: number
  available_quantity: number
  reserved_quantity: number
  low_stock_threshold: number
  is_active: boolean
  is_low_stock: boolean
  is_critical: boolean
  occupancy_rate: number | null
  unit: string
  last_updated: string
  notes: string
}

export type ResourceTransactionType = 'ADD' | 'REMOVE' | 'RESERVE' | 'RELEASE' | 'ADJUST' | 'TRANSFER'

export interface ResourceTransaction {
  id: number
  hospital_resource: number
  transaction_type: ResourceTransactionType
  quantity: number
  previous_available: number
  new_available: number
  performed_by: number | null
  performed_by_email: string
  reason: string
  reference: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface ResourceAdjustment {
  transaction_type: ResourceTransactionType
  quantity: number
  reason?: string
  reference?: string
}

export interface ICUUnit {
  id: number
  name: string
  capacity: number
  available: number
  occupied: number
  reserved: number
  threshold: number
}

export interface ICUSummary {
  capacity: number
  available: number
  occupied: number
  reserved: number
  occupancyPercent: number
}

export interface OxygenSupply {
  id: number
  hospital: number
  hospital_name: string
  supply_type: string
  capacity_litres: number | string | null
  current_level_litres: number | string
  number_of_units: number
  available_units: number
  low_level_threshold_pct: number
  location: string
  last_refilled: string | null
  last_updated: string
  level_percentage: number | string | null
  is_low: boolean
}

export interface BloodStock {
  id: number
  hospital: number
  hospital_name: string
  blood_group: string
  component: string
  units_available: number
  units_reserved: number
  expiry_date: string | null
  batch_number: string
  low_stock_threshold: number
  last_updated: string
  is_low_stock: boolean
}

export type UserRole = 'ADMIN' | 'HOSPITAL_ADMIN' | 'DOCTOR' | 'NURSE' | 'SPECIALIST' | 'STAFF' | 'PATIENT'

export interface UserRegistration {
  email: string
  password: string
  password_confirm: string
  first_name: string
  last_name: string
  role: 'DOCTOR' | 'NURSE' | 'SPECIALIST' | 'STAFF' | 'PATIENT'
  phone: string
  license_number: string
  specialization: string
  years_of_experience: number
  bio: string
  preferred_locations: string[]
}

export interface ContractListItem {
  id: number
  title: string
  hospital_name: string
  hospital_city: string
  contract_type: string
  required_role: string
  specialization_required: string
  start_datetime: string
  end_datetime: string
  budget_min: string | null
  budget_max: string | null
  currency: string
  urgency: string
  status: string
  bids_count: number
  duration_hours: number | null
  created_at: string
}

export interface WorkContract {
  id: number
  hospital: Hospital
  department: Department | null
  title: string
  description: string
  contract_type: string
  required_role: string
  specialization_required: string
  min_years_experience: number
  start_datetime: string
  end_datetime: string
  location_details: string
  budget_min: string | null
  budget_max: string | null
  currency: string
  payment_type: string
  urgency: string
  status: string
  max_bids: number | null
  requirements: string[]
  benefits: string
  is_public: boolean
  is_open_for_bidding: boolean
  bids_count: number
  duration_hours: number | null
  created_at: string
  updated_at: string
  published_at: string | null
}

export interface WorkContractCreate {
  hospital_id: number
  department_id?: number | null
  title: string
  description: string
  contract_type: string
  required_role: string
  specialization_required: string
  min_years_experience: number
  start_datetime: string
  end_datetime: string
  location_details: string
  budget_min: number | null
  budget_max: number | null
  currency: string
  payment_type: string
  urgency: string
  max_bids: number | null
  requirements: string[]
  benefits: string
  is_public: boolean
}

export interface Bid {
  id: number
  contract: number
  contract_title: string
  hospital_name: string
  bidder: ApiUser
  proposed_rate: string
  currency: string
  message: string
  availability_confirmed: boolean
  status: string
  review_notes: string
  created_at: string
}

export interface BidCreate {
  contract: number
  proposed_rate: number
  currency: string
  message: string
  availability_confirmed: boolean
}

export interface ContractAssignment {
  id: number
  contract: ContractListItem
  professional: ApiUser
  agreed_rate: string
  currency: string
  start_datetime: string
  end_datetime: string
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
  check_in_time: string | null
  check_out_time: string | null
  notes: string
  rating_by_hospital: number | null
  rating_by_professional: number | null
  feedback: string
}

export interface AssignmentReview {
  rating_by_hospital?: number
  rating_by_professional?: number
  feedback?: string
}

export interface NotificationRecord {
  id: number
  notification_type: string
  title: string
  message: string
  data: Record<string, unknown>
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface NotificationPreference {
  email_enabled: boolean
  push_enabled: boolean
  sms_enabled: boolean
  notify_new_contracts: boolean
  notify_bid_updates: boolean
  notify_resource_alerts: boolean
  notify_assignment_reminders: boolean
}

export interface HospitalDetails extends Hospital {
  registration_number: string
  address: string
  phone: string
  email: string
  state: string
  postal_code: string
  website: string
  description: string
  latitude: number | null
  longitude: number | null
  departments_count: number
}

export interface HospitalStaff {
  id: number
  user: ApiUser
  hospital: number
  hospital_name: string
  department: number | null
  role_at_hospital: string
  is_primary: boolean
  joined_at: string
  is_active: boolean
}

export interface ProfessionalDocument {
  id: number
  document_type: string
  file: string
  description: string
  uploaded_at: string
  is_verified: boolean
}

export type AmbulanceRequestStatus =
  | 'REQUESTED'
  | 'DISPATCHED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'COMPLETED'
  | 'CANCELLED'

export interface AmbulanceRequest {
  id: number
  patient: number
  patient_name: string
  patient_phone: string
  destination_hospital: number
  destination_hospital_name: string
  destination_hospital_city: string
  destination_hospital_latitude: number | string | null
  destination_hospital_longitude: number | string | null
  pickup_address: string
  pickup_latitude: number | string
  pickup_longitude: number | string
  patient_notes: string
  status: AmbulanceRequestStatus
  ambulance_code: string
  dispatcher: number | null
  dispatcher_name: string
  ambulance_latitude: number | string | null
  ambulance_longitude: number | string | null
  eta_minutes: number | null
  requested_at: string
  updated_at: string
  dispatched_at: string | null
  arrived_at: string | null
  completed_at: string | null
  cancelled_at: string | null
}

export interface AmbulanceRequestCreate {
  destination_hospital: number
  pickup_address: string
  pickup_latitude: number
  pickup_longitude: number
  patient_notes: string
}

export interface AmbulanceDispatch {
  ambulance_code: string
  latitude: number
  longitude: number
  eta_minutes: number
}

export interface AmbulanceLocationUpdate {
  latitude: number
  longitude: number
  eta_minutes?: number
}

export interface HealthcareProfessional {
  id: number
  full_name: string
  role: 'DOCTOR' | 'NURSE' | 'SPECIALIST'
  specialization: string
  availability_status: string
}

export interface Appointment {
  id: number
  patient: number
  professional: number
  professional_name: string
  professional_role: HealthcareProfessional['role']
  professional_specialization: string
  patient_name: string
  patient_email: string
  patient_phone: string
  start_datetime: string
  duration_minutes: number
  status: 'REQUESTED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'
  created_at: string
  updated_at: string
}

export interface AppointmentCreate {
  professional: number
  patient_name: string
  patient_email: string
  patient_phone: string
  start_datetime: string
  duration_minutes: number
}