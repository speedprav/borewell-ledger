// pages/AlertsPage.tsx
import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, Eye } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getAlerts, patchAlert } from '../api'
import { CardSkeleton } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { showToast } from '../components/Toast'
import type { Alert, AlertStatus, AlertSeverity } from '../types'

type Tab = 'all' | 'new' | 'critical' | 'area' | 'resolved'

export function AlertsPage() {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('new')
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    loadAlerts()
  }, [])

  const loadAlerts = () => {
    setLoading(true)
    getAlerts()
      .then(data => setAlerts(data.alerts))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const handlePatch = async (alertId: string, status: AlertStatus) => {
    setUpdating(alertId)
    try {
      await patchAlert(alertId, status as 'seen' | 'resolved')
      setAlerts(prev => prev.map(a => a.alertId === alertId ? { ...a, status } : a))
      showToast(`Alert marked as ${status}`, 'success')
    } catch {
      showToast('Update failed', 'error')
    } finally {
      setUpdating(null)
    }
  }

  const markAllSeen = async () => {
    const newAlerts = alerts.filter(a => a.status === 'new')
    for (const a of newAlerts) {
      await handlePatch(a.alertId, 'seen')
    }
  }

  const filtered = alerts.filter(a => {
    if (tab === 'all') return true
    if (tab === 'new') return a.status === 'new'
    if (tab === 'critical') return a.severity === 'CRITICAL'
    if (tab === 'area') return a.type === 'AREA'
    if (tab === 'resolved') return a.status === 'resolved'
    return true
  })

  const counts = {
    all: alerts.length,
    new: alerts.filter(a => a.status === 'new').length,
    critical: alerts.filter(a => a.severity === 'CRITICAL').length,
    area: alerts.filter(a => a.type === 'AREA').length,
    resolved: alerts.filter(a => a.status === 'resolved').length,
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'critical', label: 'Critical' },
    { key: 'area', label: 'Area-wide' },
    { key: 'resolved', label: 'Resolved' },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">Alerts</h1>
        {counts.new > 0 && (
          <button onClick={markAllSeen} className="btn-secondary text-xs py-1.5">
            <Eye size={14} />
            Mark all seen
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1" role="tablist">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`shrink-0 px-3 py-1.5 text-sm rounded-full flex items-center gap-1.5 transition-colors min-h-[36px]
              ${tab === key
                ? 'bg-[#0B5C8A] text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
          >
            {label}
            {counts[key] > 0 && (
              <span className={`text-xs rounded-full px-1.5 font-bold ${
                tab === key ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-600'
              }`}>
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alert list */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={tab === 'new' ? 'No new alerts' : 'No alerts'}
          description="No alerts. Your area looks stable."
          icon={<CheckCircle size={28} className="text-green-400" />}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(alert => (
            <div
              key={alert.alertId}
              className={`card p-4 border-l-4 ${
                alert.severity === 'CRITICAL' ? 'border-l-red-500' :
                alert.severity === 'WATCH' ? 'border-l-amber-500' : 'border-l-gray-300'
              } ${alert.status === 'resolved' ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs font-bold ${
                      alert.severity === 'CRITICAL' ? 'text-red-600' : 'text-amber-600'
                    }`}>
                      {alert.severity}
                    </span>
                    {alert.type === 'AREA' && (
                      <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 rounded-full px-2 py-0.5">
                        Area-wide
                      </span>
                    )}
                    <span className={`text-xs rounded-full px-2 py-0.5 ${
                      alert.status === 'new' ? 'bg-blue-100 text-blue-700' :
                      alert.status === 'seen' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                    }`}>
                      {alert.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 mb-1">{alert.message}</p>
                  {alert.ownSlope !== undefined && alert.peerMedian !== undefined && (
                    <p className="text-xs text-gray-500 tabular-nums">
                      Rate: {alert.ownSlope?.toFixed(2)} m/mo vs peer median {alert.peerMedian?.toFixed(2)} m/mo
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{alert.createdAt?.slice(0, 10)}</p>
                </div>
              </div>

              {alert.status !== 'resolved' && (
                <div className="flex gap-2 mt-3">
                  {alert.wellId && (
                    <button
                      onClick={() => navigate(`/wells/${alert.wellId}`)}
                      className="btn-secondary text-xs py-1"
                    >
                      Open Well
                    </button>
                  )}
                  {alert.status === 'new' && (
                    <button
                      onClick={() => handlePatch(alert.alertId, 'seen')}
                      disabled={updating === alert.alertId}
                      className="btn-secondary text-xs py-1"
                    >
                      {updating === alert.alertId ? '…' : 'Mark seen'}
                    </button>
                  )}
                  <button
                    onClick={() => handlePatch(alert.alertId, 'resolved')}
                    disabled={updating === alert.alertId}
                    className="btn-secondary text-xs py-1"
                  >
                    {updating === alert.alertId ? '…' : 'Resolve'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Alerts show where to look first. They are computed from readings and are not professional advice.
      </p>
    </div>
  )
}
