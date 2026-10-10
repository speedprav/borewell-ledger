// components/DemoDataBadge.tsx
import { FlaskConical } from 'lucide-react'

interface Props {
  inline?: boolean
}

export function DemoDataBadge({ inline }: Props) {
  return (
    <span
      className={`demo-badge ${inline ? '' : 'fixed top-2 right-2 z-50'}`}
      title="This data is simulated demo data for demonstration purposes"
      aria-label="Demo data indicator"
    >
      <FlaskConical size={12} aria-hidden />
      Demo data
    </span>
  )
}

export function DemoBanner() {
  return (
    <div
      className="w-full bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800
                 text-blue-800 dark:text-blue-200 text-xs px-4 py-1.5 text-center"
      role="status"
      aria-live="polite"
    >
      <FlaskConical size={12} className="inline mr-1" aria-hidden />
      Some data on this screen is simulated demo data, labeled for transparency.
    </div>
  )
}
