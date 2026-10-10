// pages/CommunityPage.tsx
import { useState, useEffect } from 'react'
import { Users, BarChart2, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getCommunity } from '../api'
import { CardSkeleton } from '../components/Skeleton'
import { DemoBanner } from '../components/DemoDataBadge'
import type { CommunityData } from '../types'

export function CommunityPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<CommunityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [locality, setLocality] = useState('')

  useEffect(() => {
    getCommunity().then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const loadLocality = (loc: string) => {
    setLocality(loc)
    getCommunity(loc).then(d => setData(d)).catch(() => {})
  }

  const localities = data?.hotspots.map(h => h.locality) || []

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <DemoBanner />
      <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">Community Insights</h1>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>
      ) : data ? (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Wells', value: data.totalWells },
              { label: 'Critical', value: data.statusDistribution?.CRITICAL || 0, color: 'text-red-600' },
              { label: 'Watch', value: data.statusDistribution?.WATCH || 0, color: 'text-amber-600' },
              { label: 'Normal', value: data.statusDistribution?.NORMAL || 0, color: 'text-green-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card p-3 text-center">
                <div className={`text-2xl font-bold tabular-nums ${color || 'text-gray-800 dark:text-gray-200'}`}>{value}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            ))}
          </div>

          {/* Hotspot ranking */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Hotspot Ranking (by median decline rate)
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 dark:bg-gray-700/50">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Locality</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Wells</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Med. Rate</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Critical</th>
                </tr>
              </thead>
              <tbody>
                {data.hotspots.map(h => (
                  <tr
                    key={h.locality}
                    className="border-b border-gray-50 dark:border-gray-700/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30"
                    onClick={() => loadLocality(h.locality)}
                  >
                    <td className="px-4 py-2 font-medium text-[#0B5C8A] dark:text-blue-400">{h.locality}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{h.wellCount}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {h.medianSlope !== null ? `${h.medianSlope.toFixed(2)} m/mo` : '—'}
                    </td>
                    <td className={`px-4 py-2 text-right tabular-nums font-medium ${h.criticalCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {h.criticalCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Coverage gaps */}
          {data.coverageGaps.length > 0 && (
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                Coverage Gaps
              </h2>
              <div className="space-y-2">
                {data.coverageGaps.map(g => (
                  <div key={g.locality} className="text-sm">
                    <span className="font-medium">{g.locality}</span>
                    <span className="text-gray-500 ml-1">— {g.message}</span>
                    <button
                      onClick={() => navigator.clipboard?.writeText(g.inviteMessage)}
                      className="ml-2 text-xs text-[#0B5C8A] hover:underline"
                    >
                      Copy invite
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Depth over time for selected locality */}
          {locality && data.depthOverTime.length > 0 && (
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Median Depth — {locality}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1">Month</th>
                      <th className="text-right py-1">Median</th>
                      <th className="text-right py-1">Min</th>
                      <th className="text-right py-1">Max</th>
                      <th className="text-right py-1">Samples</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.depthOverTime.map(d => (
                      <tr key={d.month} className="border-b border-gray-50">
                        <td className="py-1">{d.month}</td>
                        <td className="text-right tabular-nums">{d.median} m</td>
                        <td className="text-right tabular-nums">{d.min} m</td>
                        <td className="text-right tabular-nums">{d.max} m</td>
                        <td className="text-right tabular-nums">{d.sampleCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-6 text-center text-gray-500">Failed to load community data</div>
      )}
    </div>
  )
}
