// pages/MapPage.tsx
import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Locate, Layers, Filter, Search, X, Eye } from 'lucide-react'
import { getMap } from '../api'
import { getSettings } from '../store'
import { StatusBadge } from '../components/StatusBadge'
import { DemoBanner } from '../components/DemoDataBadge'
import type { Well, MapData, WellStatus, OwnerType } from '../types'

// Lazy-load MapLibre
let maplibregl: typeof import('maplibre-gl') | null = null

const STATUS_COLORS: Record<WellStatus, string> = {
  NORMAL: '#16A34A',
  WATCH: '#D97706',
  CRITICAL: '#DC2626',
  NOT_ENOUGH_DATA: '#6B7280',
}

function makeMarkerSVG(color: string, shape: 'circle' | 'diamond' = 'circle'): string {
  if (shape === 'diamond') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <path d="M12 2l10 10-10 10L2 12z" fill="${color}" stroke="white" stroke-width="2"/>
    </svg>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="7" fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="10" cy="10" r="3" fill="white"/>
  </svg>`
}

export function MapPage() {
  const navigate = useNavigate()
  const settings = getSettings()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [mapData, setMapData] = useState<MapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedWell, setSelectedWell] = useState<Well | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<WellStatus | ''>('')
  const [ownerFilter, setOwnerFilter] = useState<OwnerType | ''>('')
  const [hasDemo, setHasDemo] = useState(false)
  const [mapError, setMapError] = useState(false)

  useEffect(() => {
    getMap().then(data => {
      setMapData(data)
      setHasDemo(data.wells.some(w => w.source === 'seed'))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const initMap = useCallback(async () => {
    if (!mapContainerRef.current || mapRef.current) return
    try {
      const ml = await import('maplibre-gl')
      maplibregl = ml
      const map = new ml.default.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }
          },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
        },
        center: [73.1812, 22.3072],
        zoom: 11
      })
      mapRef.current = map
    } catch {
      setMapError(true)
    }
  }, [])

  useEffect(() => {
    initMap()
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [initMap])

  useEffect(() => {
    if (!mapRef.current || !mapData) return

    // Clear existing markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const filteredWells = mapData.wells.filter(w => {
      if (statusFilter && w.status !== statusFilter) return false
      if (ownerFilter && w.ownerType !== ownerFilter) return false
      if (search && !w.name.toLowerCase().includes(search.toLowerCase()) &&
          !w.locality.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })

    filteredWells.forEach(well => {
      const color = STATUS_COLORS[well.status]
      const shape = well.source === 'official' ? 'diamond' : 'circle'
      const svg = makeMarkerSVG(color, shape)
      const el = document.createElement('div')
      el.innerHTML = svg
      el.style.cursor = 'pointer'
      el.setAttribute('aria-label', `${well.name}: ${well.status}`)
      el.setAttribute('role', 'button')
      el.setAttribute('tabindex', '0')
      el.addEventListener('click', () => setSelectedWell(well))
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter') setSelectedWell(well)
      })

      if (!maplibregl) return
      const marker = new (maplibregl as any).default.Marker({ element: el })
        .setLngLat([well.lon, well.lat])
        .addTo(mapRef.current)
      markersRef.current.push(marker)
    })

    // Area alert zones
    mapData.areaAlerts.forEach(area => {
      if (!mapRef.current.getSource(`area-${area.locality}`)) {
        try {
          mapRef.current.addSource(`area-${area.locality}`, {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [area.centroidLon, area.centroidLat]
              },
              properties: { name: area.locality }
            }
          })
          mapRef.current.addLayer({
            id: `area-circle-${area.locality}`,
            type: 'circle',
            source: `area-${area.locality}`,
            paint: {
              'circle-radius': 60,
              'circle-color': '#DC2626',
              'circle-opacity': 0.12,
              'circle-stroke-color': '#DC2626',
              'circle-stroke-width': 1,
              'circle-stroke-opacity': 0.4
            }
          })
        } catch { /* layer may already exist */ }
      }
    })
  }, [mapData, statusFilter, ownerFilter, search])

  const locateMe = () => {
    if (!navigator.geolocation || !mapRef.current) return
    navigator.geolocation.getCurrentPosition(pos => {
      mapRef.current.flyTo({
        center: [pos.coords.longitude, pos.coords.latitude],
        zoom: 13
      })
    })
  }

  const resetView = () => {
    mapRef.current?.flyTo({ center: [73.1812, 22.3072], zoom: 11 })
  }

  return (
    <div className="h-[calc(100vh-112px)] md:h-[calc(100vh-56px)] flex flex-col">
      {hasDemo && <DemoBanner />}

      {/* Search and filters */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 space-y-2 shrink-0">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search wells…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-gray-200
                       dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            aria-label="Search wells"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-2.5 text-gray-400">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {(['', 'NORMAL', 'WATCH', 'CRITICAL', 'NOT_ENOUGH_DATA'] as (WellStatus | '')[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`shrink-0 px-3 py-1 text-xs rounded-full border transition-colors min-h-[28px]
                ${statusFilter === s
                  ? 'bg-[#0B5C8A] text-white border-[#0B5C8A]'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
                }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="relative flex-1">
        {mapError ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="text-lg mb-2">Map unavailable</p>
              <p className="text-sm">MapLibre GL could not load. Check your connection.</p>
            </div>
          </div>
        ) : (
          <div ref={mapContainerRef} className="w-full h-full" aria-label="Borewell map" />
        )}

        {/* Map controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <button onClick={locateMe} className="bg-white dark:bg-gray-800 rounded-lg shadow p-2 min-w-[36px] min-h-[36px]" aria-label="Locate me">
            <Locate size={16} className="text-gray-600 dark:text-gray-300" />
          </button>
          <button onClick={resetView} className="bg-white dark:bg-gray-800 rounded-lg shadow px-2 py-1 text-xs text-gray-600 dark:text-gray-300 min-h-[36px]" aria-label="Reset view">
            Reset
          </button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 bg-white dark:bg-gray-800 rounded-lg shadow p-2 text-xs space-y-1">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: color }} />
              <span className="text-gray-600 dark:text-gray-300">
                {status === 'NOT_ENOUGH_DATA' ? 'No data' : status.charAt(0) + status.slice(1).toLowerCase()}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 border-t border-gray-100 pt-1 mt-1">
            <div className="w-3 h-3 rotate-45 bg-gray-500" />
            <span className="text-gray-500">Official well</span>
          </div>
        </div>
      </div>

      {/* Well bottom sheet */}
      {selectedWell && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl
                     border-t border-gray-200 dark:border-gray-700 p-4 z-20 max-h-64 overflow-y-auto md:max-w-sm md:left-auto md:right-4 md:bottom-4 md:rounded-xl"
          role="dialog"
          aria-label={`Well details: ${selectedWell.name}`}
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{selectedWell.name}</h3>
              <p className="text-xs text-gray-500">{selectedWell.locality}</p>
            </div>
            <button onClick={() => setSelectedWell(null)} className="text-gray-400 min-w-[32px] min-h-[32px] flex items-center justify-center" aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <StatusBadge status={selectedWell.status} />
            <span className="text-sm tabular-nums">
              {selectedWell.latestDepthM ? `${selectedWell.latestDepthM.toFixed(1)} m` : '—'}
            </span>
            {selectedWell.slopeMPerMonth !== undefined && selectedWell.slopeMPerMonth !== null && (
              <span className="text-sm text-gray-500 tabular-nums">
                {selectedWell.slopeMPerMonth.toFixed(2)} m/mo
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/wells/${selectedWell.wellId}`)}
              className="btn-primary text-xs py-1.5 flex-1 justify-center"
            >
              <Eye size={14} />
              View Details
            </button>
            <button
              onClick={() => navigate(`/add?wellId=${selectedWell.wellId}`)}
              className="btn-secondary text-xs py-1.5 flex-1 justify-center"
            >
              Add Reading
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
