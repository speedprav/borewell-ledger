// pages/WellDetailPage.tsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Bot, Leaf, Star, StarOff, AlertCircle } from 'lucide-react'
import { getWell, aiAnalyze } from '../api'
import { getSettings, followWell, unfollowWell } from '../store'
import { StatusBadge } from '../components/StatusBadge'
import { DemoDataBadge } from '../components/DemoDataBadge'
import { ChartSkeleton, CardSkeleton } from '../components/Skeleton'
import { AiCard } from '../components/AiCard'
import { TrendChart } from '../components/TrendChart'
import type { WellDetail, AnalysisResult } from '../types'

export function WellDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const settings = getSettings()
  const lang = settings.language
  const [data, setData] = useState<WellDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [followed, setFollowed] = useState(settings.followedWellIds.includes(id || ''))

  useEffect(() => {
    if (!id) return
    getWell(id)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [id])

  const loadAnalysis = () => {
    if (!id || analysisLoading) return
    setAnalysisLoading(true)
    aiAnalyze(id, lang)
      .then(res => setAnalysis(res))
      .catch(e => setAnalysis(null))
      .finally(() => setAnalysisLoading(false))
  }

  const toggleFollow = () => {
    if (!id) return
    if (followed) { unfollowWell(id); setFollowed(false) }
    else { followWell(id); setFollowed(true) }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <CardSkeleton />
        <ChartSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="card p-6 text-center">
          <AlertCircle size={32} className="mx-auto text-red-400 mb-2" />
          <p className="text-gray-600">{error || 'Well not found'}</p>
          <button onClick={() => navigate(-1)} className="btn-secondary mt-4">Go Back</button>
        </div>
      </div>
    )
  }

  const { well, readings, peers, dryoutEstimate, dataQualityFlags } = data
  const isDemo = well.source === 'seed'
  const peerRatio = well.slopeMPerMonth && peers.peerMedian
    ? (well.slopeMPerMonth / peers.peerMedian).toFixed(1)
    : null

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate(-1)}
          className="mt-1 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 min-w-[36px] min-h-[36px] flex items-center justify-center"
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200 break-words">
              {well.name}
            </h1>
            {isDemo && <DemoDataBadge inline />}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={well.status} />
            <span className="text-xs text-gray-500">{well.locality} · {well.ownerType}</span>
          </div>
        </div>
        <button
          onClick={toggleFollow}
          className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 min-w-[36px] min-h-[36px] flex items-center justify-center"
          aria-label={followed ? 'Unfollow well' : 'Follow well'}
        >
          {followed
            ? <Star size={20} className="text-[#0B5C8A] fill-[#0B5C8A]" />
            : <StarOff size={20} className="text-gray-400" />
          }
        </button>
      </div>

      {/* Data quality flags */}
      {dataQualityFlags.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {dataQualityFlags.map(flag => (
            <span key={flag} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
              {flag === 'few_readings' ? 'Few readings' : 'Stale reading'}
            </span>
          ))}
        </div>
      )}

      {/* Metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Latest Depth', value: well.latestDepthM ? `${well.latestDepthM.toFixed(1)} m` : '—' },
          { label: 'Rate', value: well.slopeMPerMonth !== null && well.slopeMPerMonth !== undefined ? `${well.slopeMPerMonth.toFixed(2)} m/mo` : '—' },
          { label: 'Peer Median', value: peers.peerMedian ? `${peers.peerMedian.toFixed(2)} m/mo` : '—' },
          { label: 'Nearby Wells', value: `${peers.peerCount}` },
        ].map(({ label, value }) => (
          <div key={label} className="card p-3 text-center">
            <div className="text-lg font-bold tabular-nums text-gray-800 dark:text-gray-200">{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {peerRatio && parseFloat(peerRatio) > 1.5 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300">
          ⚠️ This well is declining <strong>{peerRatio}× faster</strong> than nearby wells.
        </div>
      )}

      {dryoutEstimate && (
        <div className="card p-3 border-amber-200 dark:border-amber-700">
          <div className="text-xs text-gray-500 mb-1">Dry-out Estimate (rough)</div>
          <div className="font-semibold tabular-nums">
            {dryoutEstimate.monthsLow}–{dryoutEstimate.monthsHigh} months at current rate
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{dryoutEstimate.label}</div>
        </div>
      )}

      {/* Trend chart */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Depth Trend</h2>
        <TrendChart
          readings={readings}
          peerMedian={peers.peerMedian}
          slope={well.slopeMPerMonth}
          rangeSelector
          aria-label={`Depth trend for ${well.name}`}
        />
      </div>

      {/* Peer comparison */}
      {peers.summary.length > 0 && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Nearby Wells ({peers.peerCount})
          </h2>
          <div className="space-y-2">
            {peers.summary.map(p => (
              <div key={p.label} className="flex items-center gap-3 text-sm">
                <span className="w-24 text-gray-500 shrink-0">{p.label}</span>
                <span className="text-xs text-gray-400 w-16 shrink-0 tabular-nums">{p.distKm} km</span>
                <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-[#0E8FA3] rounded-full"
                    style={{ width: `${Math.min(100, (p.slope / 1.5) * 100)}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums w-20 text-right">{p.slope.toFixed(2)} m/mo</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Analysis */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">AI Analysis</h2>
          {!analysis && !analysisLoading && (
            <button onClick={loadAnalysis} className="text-xs text-[#0B5C8A] hover:underline">
              Load analysis
            </button>
          )}
        </div>
        <AiCard
          analysis={analysis}
          loading={analysisLoading}
          onGetPlan={() => navigate(`/plan?wellId=${well.wellId}`)}
          onChat={() => navigate(`/assistant?wellId=${well.wellId}`)}
        />
        {!analysis && !analysisLoading && (
          <button
            onClick={loadAnalysis}
            className="btn-secondary w-full justify-center mt-2"
          >
            <Bot size={16} />
            Get AI Analysis
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => navigate(`/add?wellId=${well.wellId}`)}
          className="btn-primary flex-1 justify-center"
        >
          <Plus size={16} />
          Add Reading
        </button>
        <button
          onClick={() => navigate(`/plan?wellId=${well.wellId}`)}
          className="btn-secondary flex-1 justify-center"
        >
          <Leaf size={16} />
          Get Plan
        </button>
      </div>

      {/* Readings table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Reading History ({readings.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Date</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Depth (m)</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Source</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Note</th>
              </tr>
            </thead>
            <tbody>
              {[...readings].sort((a, b) => b.date.localeCompare(a.date)).map(r => (
                <tr key={r.date} className="border-b border-gray-50 dark:border-gray-700/50">
                  <td className="px-4 py-2 tabular-nums text-gray-800 dark:text-gray-200">{r.date}</td>
                  <td className="px-4 py-2 tabular-nums text-right font-medium">{r.depthM.toFixed(2)}</td>
                  <td className="px-4 py-2">
                    {r.source === 'seed' ? <span className="demo-badge">demo</span> : r.source}
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs max-w-[200px] truncate">{r.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
