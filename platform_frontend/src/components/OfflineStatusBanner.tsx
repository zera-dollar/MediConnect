import { useEffect, useState } from 'react'
import { CloudOff } from 'lucide-react'

export function OfflineStatusBanner() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const updateStatus = () => setOnline(navigator.onLine)
    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)
    return () => {
      window.removeEventListener('online', updateStatus)
      window.removeEventListener('offline', updateStatus)
    }
  }, [])

  if (online) return null
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-[#573f12] px-4 py-2 text-center text-xs font-medium text-white shadow-md">
      <CloudOff size={14} aria-hidden="true" />
      Offline: cached facility information is marked as potentially outdated. Queued non-clinical updates will sync when connected.
    </div>
  )
}
