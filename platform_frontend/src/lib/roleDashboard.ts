import {
  Ambulance,
  Bell,
  Boxes,
  BriefcaseMedical,
  CalendarPlus,
  ChartNoAxesCombined,
  ClipboardList,
  Droplets,
  FileSpreadsheet,
  Handshake,
  Home,
  MapPinned,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import type { UserRole } from '../types'

export interface DashboardFeature {
  to: string
  label: string
  description: string
  icon: LucideIcon
}

interface RoleDashboard {
  slug: string
  title: string
  description: string
  features: DashboardFeature[]
}

const patientFeatures: DashboardFeature[] = [
  { to: '/notifications', label: 'User Notifications', description: 'Read updates about your care and requests.', icon: Bell },
  { to: '/ambulance', label: 'Ambulance services', description: 'Request or track patient transport.', icon: Ambulance },
  { to: '/hospitals', label: 'Find Hospital', description: 'Explore nearby hospitals and care facilities.', icon: MapPinned },
  { to: '/appointments', label: 'Book appointments', description: 'Choose a professional, date, time, and duration.', icon: CalendarPlus },
  { to: '/settings', label: 'Profile settings', description: 'Update your contact details and account profile.', icon: Settings },
]

const administratorFeatures: DashboardFeature[] = [
  { to: '/staffing', label: 'Staffing marketplace', description: 'Manage contracts, bids, and assignments.', icon: BriefcaseMedical },
  { to: '/referrals', label: 'Interfacility referrals', description: 'Coordinate clinical handoffs and reserved transport.', icon: Handshake },
  { to: '/resources', label: 'Resource management', description: 'Manage facility resources and stock.', icon: Boxes },
  { to: '/ambulance', label: 'Ambulance services', description: 'Review and coordinate transport requests.', icon: Ambulance },
  { to: '/hospitals', label: 'Facility directory', description: 'Review registered hospitals and facility locations.', icon: MapPinned },
  { to: '/oxygen', label: 'Oxygen monitoring', description: 'Monitor oxygen levels and availability.', icon: Droplets },
  { to: '/notifications', label: 'Notifications', description: 'Review platform and operational alerts.', icon: Bell },
  { to: '/audit', label: 'Audit Centre', description: 'Review operational audit records.', icon: ClipboardList },
  { to: '/analytics', label: 'Analytics dashboard', description: 'Review platform-wide operational metrics.', icon: ChartNoAxesCombined },
  { to: '/reports', label: 'Reports', description: 'View and export operational reports.', icon: FileSpreadsheet },
  { to: '/settings', label: 'System settings', description: 'Manage your account and profile.', icon: Settings },
]

const hospitalAdminFeatures: DashboardFeature[] = [
  { to: '/referrals', label: 'Interfacility referrals', description: 'Review incoming handoffs and resource reservations.', icon: Handshake },
  { to: '/resources', label: 'Resource management', description: 'Update facility inventory and availability.', icon: Boxes },
  { to: '/staffing', label: 'Staffing marketplace', description: 'Publish contracts, review bids, and manage shifts.', icon: BriefcaseMedical },
  { to: '/ambulance', label: 'Ambulance dispatch', description: 'Coordinate active requests and driver location links.', icon: Ambulance },
  { to: '/oxygen', label: 'Oxygen monitoring', description: 'Review supply levels and low-stock alerts.', icon: Droplets },
  { to: '/notifications', label: 'Notifications', description: 'Review facility and operational alerts.', icon: Bell },
  { to: '/audit', label: 'Audit Centre', description: 'Review resource changes and operational history.', icon: ClipboardList },
  { to: '/reports', label: 'Reports', description: 'Review and export facility operations data.', icon: FileSpreadsheet },
  { to: '/settings', label: 'Profile settings', description: 'Manage your account and notification preferences.', icon: Settings },
]

const clinicianFeatures: DashboardFeature[] = [
  { to: '/staffing', label: 'Staffing marketplace', description: 'Browse professional opportunities and assignments.', icon: BriefcaseMedical },
  { to: '/appointments', label: 'Appointments', description: 'Review and manage patient appointment requests.', icon: CalendarPlus },
  { to: '/notifications', label: 'Notifications', description: 'Review account and assignment updates.', icon: Bell },
  { to: '/hospitals', label: 'Find hospitals', description: 'Explore facilities and care locations.', icon: MapPinned },
  { to: '/settings', label: 'Profile settings', description: 'Maintain your professional profile.', icon: Settings },
]
const nurseFeatures = [
  { to: '/referrals', label: 'Interfacility referrals', description: 'Submit structured triage handoffs to receiving facilities.', icon: Handshake },
  { to: '/ambulance', label: 'Ambulance services', description: 'Track referral transport and coordinate requests.', icon: Ambulance },
  { to: '/resources', label: 'Resource management', description: 'Review clinical resource availability.', icon: Boxes },
  { to: '/oxygen', label: 'Oxygen monitoring', description: 'Review oxygen availability and alerts.', icon: Droplets },
  { to: '/staffing', label: 'Assignments', description: 'Review shifts and check-in requirements.', icon: BriefcaseMedical },
  { to: '/appointments', label: 'Appointments', description: 'Review patient appointment requests.', icon: CalendarPlus },
  { to: '/notifications', label: 'Notifications', description: 'Review account and care-team updates.', icon: Bell },
  { to: '/settings', label: 'Profile settings', description: 'Maintain your professional profile.', icon: Settings },
]
const staffFeatures: DashboardFeature[] = [
  { to: '/ambulance', label: 'Ambulance services', description: 'Coordinate transport requests where authorized.', icon: Ambulance },
  { to: '/referrals', label: 'Interfacility referrals', description: 'Coordinate clinical handoffs and resource reservations.', icon: Handshake },
  { to: '/resources', label: 'Resource management', description: 'Review hospital resource availability.', icon: Boxes },
  { to: '/oxygen', label: 'Oxygen monitoring', description: 'Review oxygen availability.', icon: Droplets },
  { to: '/notifications', label: 'Notifications', description: 'Review operational updates.', icon: Bell },
  { to: '/hospitals', label: 'Find hospitals', description: 'View facility locations.', icon: MapPinned },
  { to: '/settings', label: 'Profile settings', description: 'Update your account profile.', icon: Settings },
]

export const roleDashboards: Record<UserRole, RoleDashboard> = {
  ADMIN: {
    slug: 'admin',
    title: 'Platform administrator dashboard',
    description: 'Oversee platform operations, facilities, staffing, resources, and reports.',
    features: administratorFeatures,
  },
  HOSPITAL_ADMIN: {
    slug: 'hospital-admin',
    title: 'Hospital administrator dashboard',
    description: 'Manage your hospital’s staffing, resources, and operational activity.',
    features: hospitalAdminFeatures,
  },
  DOCTOR: {
    slug: 'doctor',
    title: 'Doctor dashboard',
    description: 'Access professional opportunities, facility information, and account updates.',
    features: clinicianFeatures,
  },
  NURSE: {
    slug: 'nurse',
    title: 'Nurse dashboard',
    description: 'Access assignments, facility information, and clinical resource monitoring.',
    features: nurseFeatures,
  },
  SPECIALIST: {
    slug: 'specialist',
    title: 'Specialist dashboard',
    description: 'Access professional opportunities, facility information, and account updates.',
    features: clinicianFeatures,
  },
  STAFF: {
    slug: 'staff',
    title: 'Hospital staff dashboard',
    description: 'Access facility operations and tools available to your account.',
    features: staffFeatures,
  },
  PATIENT: {
    slug: 'patient',
    title: 'Patient dashboard',
    description: 'Manage your care requests, appointments, and account details.',
    features: patientFeatures,
  },
}

export function dashboardPathForRole(role: UserRole): string {
  return `/dashboard/${roleDashboards[role].slug}`
}

export function workspaceNavigationForRole(role: UserRole): DashboardFeature[] {
  return [
    { to: dashboardPathForRole(role), label: 'My dashboard', description: '', icon: Home },
    ...roleDashboards[role].features,
  ]
}

export const publicWorkspaceNavigationItems: DashboardFeature[] = [
  ...roleDashboards.ADMIN.features,
  ...roleDashboards.PATIENT.features.filter(({ to }) => to === '/appointments'),
]

export function roleForDashboardSlug(slug: string | undefined): UserRole | undefined {
  return (Object.keys(roleDashboards) as UserRole[]).find(
    (role) => roleDashboards[role].slug === slug,
  )
}
