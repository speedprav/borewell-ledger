// pages/DashboardPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingDown, AlertTriangle, Droplets, Calendar, RefreshCw, Bot } from 'lucide-react'
import { getMap, getAlerts, runAnalysis, aiAnalyze } from '../api'
import { getSettings } from '../store'
import { StatusBadge } from '../components/StatusBadge'
import { CardSkeleton } from '../components/Skeleton'
import { AiCard } from '../components/AiCard'
import { DemoBanner } from '../components/DemoDataBadge'
import { showToast } from '../components/Toast'
import type { Well, Alert, AnalysisResult } from '../types'

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string
  icon: React.FC<any>; color: string
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon size={16} style={{ color }} aria-hidden />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-800 dark:text-gray-200 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const settings = getSettings()
  const lang = settings.language
  const [wells, setWells] = useState<Well[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [runningAnalysis, setRunningAnalysis] = useState(false)
  const [hasDemo, setHasDemo] = useState(false)

  const followed = settings.followedWellIds
  const name = settings.name

  useEffect(() => {
    Promise.all([
      getMap(),
      getAlerts({ status: 'new' })
    ]).then(([mapData, alertData]) => {
      setWells(mapData.wells)
      setAlerts(alertData.alerts.slice(0, 3))
      const demo = mapData.wells.some(w => w.source === 'seed')
      setHasDemo(demo)

      // Use followed wells OR most urgent wells from all if none followed
      const followedWells = mapData.wells.filter(w => followed.includes(w.wellId))
      const displayWells = followedWells.length > 0 ? followedWells : mapData.wells
      const urgent = displayWells.find(w => w.status === 'CRITICAL')
        || displayWells.find(w => w.status === 'WATCH')
        || displayWells[0]

      if (urgent) {
        setAnalysisLoading(true)
        aiAnalyze(urgent.wellId, lang)
          .then(res => setAnalysis(res))
          .catch(() => {})
          .finally(() => setAnalysisLoading(false))
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleRunAnalysis = async () => {
    setRunningAnalysis(true)
    try {
      const result = await runAnalysis()
      if (result.status === 'cooldown') {
        showToast(result.message, 'info')
      } else {
        showToast('Analysis complete. Status updated!', 'success')
      }
    } catch {
      showToast('Analysis failed. Try again.', 'error')
    } finally {
      setRunningAnalysis(false)
    }
  }

  // Show followed wells stats, or fall back to ALL wells so dashboard is never blank
  const followedWells = followed.length > 0
    ? wells.filter(w => followed.includes(w.wellId))
    : wells
  const isShowingAll = followed.length === 0
  const needsAttention = followedWells.filter(w => w.status === 'CRITICAL' || w.status === 'WATCH')
  const avgRate = followedWells
    .filter(w => w.slopeMPerMonth !== null && w.slopeMPerMonth !== undefined)
    .reduce((sum, w, _, arr) => sum + (w.slopeMPerMonth! / arr.length), 0)
  const lastReadingDates = followedWells
    .filter(w => w.latestDate)
    .map(w => w.latestDate!)
    .sort()
  const lastDate = lastReadingDates[lastReadingDates.length - 1]

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {hasDemo && <DemoBanner />}

      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">
          {name ? `Hello, ${name}` : 'Dashboard'}
        </h1>
        <p className="text-sm text-gray-500">
          {isShowingAll
            ? `Showing community overview — ${wells.length} wells in your area`
            : `Tracking ${followed.length} well${followed.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label={isShowingAll ? 'Total wells' : 'Wells followed'}
            value={isShowingAll ? wells.length : followed.length}
            sub={isShowingAll ? 'in community' : undefined}
            icon={Droplets}
            color="#0B5C8A"
          />
          <StatCard
            label="Needs attention"
            value={needsAttention.length}
            sub={needsAttention.length > 0 ? 'Critical or Watch' : 'All clear ✓'}
            icon={AlertTriangle}
            color={needsAttention.length > 0 ? '#D97706' : '#16A34A'}
          />
          <StatCard
            label="Avg decline rate"
            value={followedWells.length > 0 && avgRate !== 0 ? `${avgRate.toFixed(2)} m/mo` : '—'}
            sub={isShowingAll ? 'community average' : undefined}
            icon={TrendingDown}
            color="#0E8FA3"
          />
          <StatCard
            label="Last reading"
            value={lastDate ? lastDate.slice(0, 10) : '—'}
            icon={Calendar}
            color="#6B7280"
          />
        </div>
      )}

      {/* Run analysis button */}
      <button
        onClick={handleRunAnalysis}
        disabled={runningAnalysis}
        className="btn-secondary w-full justify-center gap-2"
        aria-label="Run groundwater analysis now"
      >
        <RefreshCw size={16} className={runningAnalysis ? 'animate-spin' : ''} aria-hidden />
        {runningAnalysis ? 'Running analysis…' : 'Run Analysis Now'}
      </button>

      {/* AI insight */}
      {(analysisLoading || analysis) && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
            <Bot size={16} className="text-[#0B5C8A]" />
            AI Insight of the Day
          </h2>
          <AiCard
            analysis={analysis}
            loading={analysisLoading}
            onGetPlan={() => navigate('/plan')}
            onChat={() => navigate('/assistant')}
          />
        </div>
      )}

      {/* Needs attention */}
      {needsAttention.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Needs Attention
          </h2>
          <div className="space-y-2">
            {needsAttention.map(well => (
              <div
                key={well.wellId}
                className="card p-3 flex items-center gap-3 cursor-pointer hover:border-gray-300"
                onClick={() => navigate(`/wells/${well.wellId}`)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && navigate(`/wells/${well.wellId}`)}
              >
                <StatusBadge status={well.status} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{well.name}</div>
                  <div className="text-xs text-gray-500">{well.locality}</div>
                </div>
                <div className="text-xs text-gray-500 tabular-nums text-right shrink-0">
                  {well.slopeMPerMonth !== undefined && well.slopeMPerMonth !== null
                    ? `${well.slopeMPerMonth.toFixed(2)} m/mo`
                    : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent alerts */}
      {alerts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Alerts</h2>
            <button onClick={() => navigate('/alerts')} className="text-xs text-[#0B5C8A] hover:underline">
              View all
            </button>
          </div>
          <div className="space-y-2">
            {alerts.map(alert => (
              <div key={alert.alertId} className={`card p-3 border-l-4
                ${alert.severity === 'CRITICAL' ? 'border-l-red-500' : 'border-l-amber-500'}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${
                    alert.severity === 'CRITICAL' ? 'text-red-600' : 'text-amber-600'
                  }`}>
                    {alert.severity}
                  </span>
                  <span className="text-xs text-gray-500">
                    {alert.type === 'AREA' ? `Area: ${alert.locality}` : ''}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 line-clamp-2">
                  {alert.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Personalise prompt when viewing community overview */}
      {!loading && followed.length === 0 && (
        <div className="card p-4 border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20">
          <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-1">
            📍 Viewing community overview
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-300 mb-3">
            Follow specific wells to personalise this dashboard with your own data.
          </p>
          <div className="flex gap-2">
            <button onClick={() => navigate('/map')} className="btn-primary text-xs py-1.5">
              Find wells on map
            </button>
            <button onClick={() => navigate('/add')} className="btn-secondary text-xs py-1.5">
              Add your well
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
