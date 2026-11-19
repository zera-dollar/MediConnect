import { Activity, Ambulance, Bell, Boxes, BriefcaseMedical, CalendarPlus, ClipboardList, Droplets, ChartNoAxesCombined, FileSpreadsheet, MapPinned, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'

const navigationItems = [
  { to: '/', label: 'ICU dashboard', icon: Activity },
  { to: '/staffing', label: 'Staffing marketplace', icon: BriefcaseMedical },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/hospitals', label: 'Find hospitals', icon: MapPinned },
  { to: '/ambulance', label: 'Ambulance services', icon: Ambulance },
  { to: '/appointments', label: 'Book an appointment', icon: CalendarPlus },
  { to: '/oxygen', label: 'Oxygen monitoring', icon: Droplets },
  { to: '/resources', label: 'Resource management', icon: Boxes },
  { to: '/audit', label: 'Audit Centre', icon: ClipboardList },
  { to: '/analytics', label: 'Analytics dashboard', icon: ChartNoAxesCombined },
  { to: '/reports', label: 'Reports', icon: FileSpreadsheet },
  { to: '/settings', label: 'System settings', icon: Settings },
] as const

export function WorkspaceNavigation({ current }: { current: string }) {
  return (
    <nav aria-label="Workspace" className="px-3 pb-4 pt-1 lg:px-4">
      <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a8c0ce]">Care workspace</p>
      <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
        {navigationItems.map(({ to, label, icon: Icon }) => {
          const active = to === current
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? 'bg-white text-navy shadow-sm before:absolute before:bottom-2 before:left-0 before:top-2 before:w-1 before:rounded-full before:bg-forest'
                  : 'text-white/75 hover:bg-white/[0.09] hover:text-white'
              }`}
            >
              <Icon size={17} aria-hidden="true" /> {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
