// components/OfflineBanner.tsx
import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'
import { t } from '../i18n'
import type { Language } from '../types'

export function OfflineBanner({ lang }: { lang?: Language }) {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      className="w-full bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200
                 text-amber-800 dark:text-amber-200 text-sm px-4 py-2 flex items-center gap-2"
      role="alert"
      aria-live="assertive"
    >
      <WifiOff size={16} aria-hidden />
      {t('offline.banner', lang)}
    </div>
  )
}
