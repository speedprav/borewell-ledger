// pages/MyWellsPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, TrendingDown, Plus, Star, StarOff } from 'lucide-react'
import { getMap } from '../api'
import { getSettings, followWell, unfollowWell } from '../store'
import { StatusBadge } from '../components/StatusBadge'
import { DemoDataBadge } from '../components/DemoDataBadge'
import { CardSkeleton } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import type { Well } from '../types'

function exportCSV(wells: Well[]) {
  const header = 'Name,Locality,Status,Latest Depth (m),Slope (m/mo),Last Reading,Source'
  const rows = wells.map(w =>
    `"${w.name}","${w.locality}","${w.status}","${w.latestDepthM ?? ''}","${w.slopeMPerMonth ?? ''}","${w.latestDate ?? ''}","${w.source}"`
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'borewell-ledger-wells.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function MyWellsPage() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState(getSettings())
  const [wells, setWells] = useState<Well[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'urgency' | 'name' | 'depth' | 'rate'>('urgency')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    getMap().then(data => {
      setWells(data.wells)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const followed = settings.followedWellIds
  const displayWells = showAll ? wells : wells.filter(w => followed.includes(w.wellId))

  const filtered = displayWells.filter(w =>
    !search ||
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.locality.toLowerCase().includes(search.toLowerCase())
  )

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'urgency') {
      const order: Record<string, number> = { CRITICAL: 0, WATCH: 1, NORMAL: 2, NOT_ENOUGH_DATA: 3 }
      return (order[a.status] ?? 3) - (order[b.status] ?? 3)
    }
    if (sort === 'name') return a.name.localeCompare(b.name)
    if (sort === 'depth') return (b.latestDepthM ?? 0) - (a.latestDepthM ?? 0)
    if (sort === 'rate') return (b.slopeMPerMonth ?? 0) - (a.slopeMPerMonth ?? 0)
    return 0
  })

  const toggleFollow = (wellId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (followed.includes(wellId)) {
      unfollowWell(wellId)
    } else {
      followWell(wellId)
    }
    setSettings(getSettings())
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">
          {showAll ? 'All Wells' : 'My Wells'}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => exportCSV(sorted)}
            className="btn-secondary text-xs py-1.5"
          >
            Export CSV
          </button>
          <button
            onClick={() => navigate('/add')}
            className="btn-primary text-xs py-1.5"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search wells…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          />
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as any)}
          className="py-2 px-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          aria-label="Sort by"
        >
          <option value="urgency">Urgency</option>
          <option value="name">Name</option>
          <option value="depth">Depth</option>
          <option value="rate">Rate</option>
        </select>
      </div>

      <button
        onClick={() => setShowAll(v => !v)}
        className="text-xs text-[#0B5C8A] hover:underline"
      >
        {showAll ? `Show only my ${followed.length} followed wells` : `Show all ${wells.length} wells`}
      </button>

      {/* Wells grid */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          title="No wells found"
          description={followed.length === 0 ? "You're not following any wells yet." : "No wells match your search."}
          action={
            <button onClick={() => navigate('/add')} className="btn-primary">
              Add a Reading
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {sorted.map(well => (
            <div
              key={well.wellId}
              className="card p-4 cursor-pointer hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
              onClick={() => navigate(`/wells/${well.wellId}`)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && navigate(`/wells/${well.wellId}`)}
              aria-label={`View ${well.name}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">
                      {well.name}
                    </span>
                    <StatusBadge status={well.status} size="sm" />
                    {well.source === 'seed' && <DemoDataBadge inline />}
                  </div>
                  <div className="text-xs text-gray-500 mb-2">{well.locality}</div>

                  <div className="flex flex-wrap gap-4 text-xs tabular-nums">
                    <span>
                      <span className="text-gray-400">Depth: </span>
                      <span className="font-medium">{well.latestDepthM?.toFixed(1) ?? '—'} m</span>
                    </span>
                    <span>
                      <span className="text-gray-400">Rate: </span>
                      <span className="font-medium">
                        {well.slopeMPerMonth !== null && well.slopeMPerMonth !== undefined
                          ? `${well.slopeMPerMonth.toFixed(2)} m/mo`
                          : '—'}
                      </span>
                    </span>
                    {well.peerMedian !== null && well.peerMedian !== undefined && (
                      <span>
                        <span className="text-gray-400">Peer: </span>
                        <span className="font-medium">{well.peerMedian.toFixed(2)} m/mo</span>
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={e => toggleFollow(well.wellId, e)}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 min-w-[36px] min-h-[36px] flex items-center justify-center"
                  aria-label={followed.includes(well.wellId) ? 'Unfollow well' : 'Follow well'}
                >
                  {followed.includes(well.wellId)
                    ? <Star size={16} className="text-[#0B5C8A] fill-[#0B5C8A]" />
                    : <StarOff size={16} className="text-gray-400" />
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
