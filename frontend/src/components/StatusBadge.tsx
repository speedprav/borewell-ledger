// components/StatusBadge.tsx
import { CheckCircle, AlertTriangle, OctagonAlert, HelpCircle, type LucideIcon } from 'lucide-react'
import type { WellStatus } from '../types'

interface Props {
  status: WellStatus
  size?: 'sm' | 'md'
}

const config: Record<WellStatus, { cls: string; Icon: LucideIcon; label: string }> = {
  NORMAL:           { cls: 'status-badge-normal',   Icon: CheckCircle,   label: 'Normal' },
  WATCH:            { cls: 'status-badge-watch',    Icon: AlertTriangle, label: 'Watch' },
  CRITICAL:         { cls: 'status-badge-critical', Icon: OctagonAlert,  label: 'Critical' },
  NOT_ENOUGH_DATA:  { cls: 'status-badge-nodata',   Icon: HelpCircle,    label: 'No data' },
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const { cls, Icon, label } = config[status] || config.NOT_ENOUGH_DATA
  const iconSize = size === 'sm' ? 12 : 14
  return (
    <span className={cls} aria-label={`Status: ${label}`}>
      <Icon size={iconSize} aria-hidden />
      {label}
    </span>
  )
}
