// pages/AddReadingPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, ChevronLeft, MapPin, CheckCircle, AlertTriangle, Loader2, Navigation, RotateCcw, X } from 'lucide-react'
import { addReading, createWell, getMap } from '../api'
import { getSettings, followWell, enqueueReading } from '../store'
import { StatusBadge } from '../components/StatusBadge'
import { showToast } from '../components/Toast'
import type { Well } from '../types'

type Step = 1 | 2 | 3
type LocationState = 'idle' | 'loading' | 'success' | 'error'

export function AddReadingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefillWellId = searchParams.get('wellId')
  const settings = getSettings()

  const [step, setStep] = useState<Step>(prefillWellId ? 2 : 1)
  const [wells, setWells] = useState<Well[]>([])
  const [selectedWellId, setSelectedWellId] = useState(prefillWellId || '')
  const [selectedWell, setSelectedWell] = useState<Well | null>(null)
  const [createNew, setCreateNew] = useState(false)

  // Step 1: new well fields
  const [newName, setNewName] = useState('')
  const [newOwnerType, setNewOwnerType] = useState('society')
  const [newLocality, setNewLocality] = useState(settings.locality || '')
  const [newLat, setNewLat] = useState('')
  const [newLon, setNewLon] = useState('')
  const [newPumpDepth, setNewPumpDepth] = useState('')
  const [locationState, setLocationState] = useState<LocationState>('idle')
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null)

  // Step 2: reading fields
  const [depth, setDepth] = useState('')
  const [readingDate, setReadingDate] = useState(new Date().toISOString().slice(0, 10))
  const [condition, setCondition] = useState('pump_off')
  const [note, setNote] = useState('')

  // State
  const [loading, setLoading] = useState(false)
  const [largeJump, setLargeJump] = useState(false)
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    getMap().then(data => {
      setWells(data.wells)
      if (prefillWellId) {
        const w = data.wells.find(w => w.wellId === prefillWellId)
        if (w) setSelectedWell(w)
      }
    }).catch(() => {})
  }, [])

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      showToast('Location not available on this device', 'error')
      setLocationState('error')
      return
    }
    setLocationState('loading')
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = parseFloat(pos.coords.latitude.toFixed(3))
        const lon = parseFloat(pos.coords.longitude.toFixed(3))
        setNewLat(String(lat))
        setNewLon(String(lon))
        setLocationAccuracy(Math.round(pos.coords.accuracy))
        setLocationState('success')
      },
      err => {
        setLocationState('error')
        const msg = err.code === 1
          ? 'Location permission denied. Please allow location access in your browser settings.'
          : err.code === 2
          ? 'Location unavailable. Check your GPS or network connection.'
          : 'Location request timed out. Please try again.'
        showToast(msg, 'error')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const handleClearLocation = () => {
    setNewLat('')
    setNewLon('')
    setLocationState('idle')
    setLocationAccuracy(null)
  }

  const handleSelectWell = (wellId: string) => {
    setSelectedWellId(wellId)
    const w = wells.find(w => w.wellId === wellId)
    setSelectedWell(w || null)
  }

  const handleSubmit = async () => {
    if (!selectedWellId && !createNew) {
      showToast('Please select or create a well', 'error')
      return
    }

    const depthNum = parseFloat(depth)
    if (isNaN(depthNum) || depthNum < 0 || depthNum > 300) {
      showToast('Depth must be between 0 and 300 m', 'error')
      return
    }

    setLoading(true)
    try {
      let wellId = selectedWellId

      // Create new well if needed
      if (createNew) {
        const latNum = parseFloat(newLat)
        const lonNum = parseFloat(newLon)
        if (isNaN(latNum) || isNaN(lonNum)) {
          showToast('Please provide valid coordinates', 'error')
          setLoading(false)
          return
        }

        const wellResp = await createWell({
          name: newName,
          ownerType: newOwnerType as any,
          locality: newLocality,
          lat: latNum,
          lon: lonNum,
          pumpDepthM: newPumpDepth ? parseFloat(newPumpDepth) : undefined,
          depthM: depthNum,
          date: readingDate,
          note: note || undefined
        })
        wellId = wellResp.well.wellId
        followWell(wellId)
        setResult({ well: wellResp.well })
        setStep(3)
        setLoading(false)
        return
      }

      const resp = await addReading({
        wellId,
        depthM: depthNum,
        date: readingDate,
        note: note || undefined
      })

      if (resp.warning === 'large_jump') {
        setLargeJump(true)
        showToast(resp.warningMessage || 'Large depth change detected — please verify.', 'info')
      }

      setResult(resp)
      setStep(3)
    } catch (err: any) {
      // Queue offline
      if (!navigator.onLine && selectedWellId) {
        enqueueReading({ wellId: selectedWellId, depthM: depthNum, date: readingDate, note })
        showToast('Saved offline. Will submit when reconnected.', 'info')
        setStep(3)
      } else {
        showToast(err?.message || 'Submission failed', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  if (step === 3) {
    const updatedWell = result?.updatedWell || result?.well
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center space-y-4">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle size={32} className="text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Reading Submitted!</h2>
        {updatedWell?.status && (
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-gray-600">Updated status:</span>
            <StatusBadge status={updatedWell.status} />
          </div>
        )}
        {largeJump && (
          <div className="card border-amber-200 bg-amber-50 p-3 flex gap-2 text-left">
            <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-700">Large depth change detected. Please verify your measurement.</p>
          </div>
        )}
        <div className="flex gap-3 justify-center pt-2">
          <button onClick={() => navigate('/wells')} className="btn-primary">
            View My Wells
          </button>
          <button onClick={() => { setStep(2); setResult(null); setLargeJump(false) }} className="btn-secondary">
            Add Another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-1">
        {step === 1 ? 'Select Well' : 'Log Reading'}
      </h1>
      <p className="text-sm text-gray-500 mb-6">Step {step} of 2</p>

      {/* Progress bar */}
      <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded mb-6">
        <div className="h-1 bg-[#0B5C8A] rounded transition-all" style={{ width: step === 1 ? '50%' : '100%' }} />
      </div>

      {step === 1 && (
        <div className="space-y-4">
          {/* Existing well picker */}
          {!createNew && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Choose an existing well
              </label>
              <select
                value={selectedWellId}
                onChange={e => handleSelectWell(e.target.value)}
                className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm
                           dark:bg-gray-700 dark:text-gray-200"
                aria-label="Select existing well"
              >
                <option value="">— Select a well —</option>
                {wells.map(w => (
                  <option key={w.wellId} value={w.wellId}>
                    {w.name} ({w.locality})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-600" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-600" />
          </div>

          <button
            onClick={() => setCreateNew(v => !v)}
            className={`w-full p-3 border-2 rounded-lg text-sm font-medium transition-colors min-h-[44px]
              ${createNew
                ? 'border-[#0B5C8A] bg-[#0B5C8A]/5 text-[#0B5C8A]'
                : 'border-dashed border-gray-300 dark:border-gray-600 text-gray-500 hover:border-gray-400'
              }`}
          >
            {createNew ? '← Select existing well instead' : '+ Create a new well'}
          </button>

          {createNew && (
            <div className="space-y-3 card p-4">
              <div>
                <label className="block text-xs font-medium mb-1">Well name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Sunrise Heights Society Borewell"
                  className="w-full p-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  maxLength={80}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Type</label>
                  <select
                    value={newOwnerType}
                    onChange={e => setNewOwnerType(e.target.value)}
                    className="w-full p-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  >
                    <option value="society">Housing Society</option>
                    <option value="farm">Farm</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Locality *</label>
                  <input
                    type="text"
                    value={newLocality}
                    onChange={e => setNewLocality(e.target.value)}
                    placeholder="e.g. Alkapuri"
                    className="w-full p-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  />
                </div>
              </div>

              {/* Location section — primary: Use My Location button */}
              <div>
                <label className="block text-xs font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Location *
                </label>

                {/* Use My Location button — primary action */}
                {locationState !== 'success' && (
                  <button
                    onClick={handleUseMyLocation}
                    disabled={locationState === 'loading'}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-medium text-sm transition-all min-h-[52px]
                      ${locationState === 'loading'
                        ? 'border-[#0B5C8A] bg-[#0B5C8A]/5 text-[#0B5C8A] cursor-wait'
                        : locationState === 'error'
                        ? 'border-red-300 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 dark:border-red-700'
                        : 'border-[#0B5C8A] bg-[#0B5C8A] text-white hover:bg-[#094a70] active:scale-95'
                      }`}
                    aria-label="Use current GPS location"
                  >
                    {locationState === 'loading' ? (
                      <><Loader2 size={18} className="animate-spin" aria-hidden /> Detecting location…</>
                    ) : locationState === 'error' ? (
                      <><RotateCcw size={18} aria-hidden /> Try again</>
                    ) : (
                      <><Navigation size={18} aria-hidden /> Use My Current Location</>
                    )}
                  </button>
                )}

                {/* Success state — show coordinates card with map preview */}
                {locationState === 'success' && newLat && newLon && (
                  <div className="rounded-xl border-2 border-green-400 dark:border-green-600 overflow-hidden">
                    {/* OpenStreetMap static preview */}
                    <div className="relative bg-gray-100 dark:bg-gray-700" style={{ height: '140px' }}>
                      <img
                        src={`https://staticmap.openstreetmap.de/staticmap.php?center=${newLat},${newLon}&zoom=16&size=400x140&markers=${newLat},${newLon},red`}
                        alt={`Map showing location at ${newLat}, ${newLon}`}
                        className="w-full h-full object-cover"
                        onError={e => {
                          // Fallback: show OSM tile directly
                          const t = e.currentTarget
                          t.onerror = null
                          t.src = `https://tile.openstreetmap.org/16/${Math.floor((parseFloat(newLon)+180)/360*65536)}/${Math.floor((1-Math.log(Math.tan(parseFloat(newLat)*Math.PI/180)+1/Math.cos(parseFloat(newLat)*Math.PI/180))/Math.PI)/2*65536)}.png`
                        }}
                      />
                      {/* Pin overlay */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-6 h-6 bg-[#0B5C8A] rounded-full border-3 border-white shadow-lg flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full" />
                        </div>
                      </div>
                      {/* Change button */}
                      <button
                        onClick={handleClearLocation}
                        className="absolute top-2 right-2 bg-white dark:bg-gray-800 rounded-lg p-1.5 shadow text-gray-600 dark:text-gray-300 hover:bg-gray-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
                        aria-label="Change location"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Coordinates + accuracy info */}
                    <div className="p-3 bg-green-50 dark:bg-green-900/20">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle size={14} className="text-green-600 dark:text-green-400 shrink-0" />
                        <span className="text-xs font-semibold text-green-700 dark:text-green-300">
                          Location detected
                        </span>
                        {locationAccuracy && (
                          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                            locationAccuracy <= 20 ? 'bg-green-100 text-green-700' :
                            locationAccuracy <= 100 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-600'
                          }`}>
                            ±{locationAccuracy}m accuracy
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs tabular-nums text-gray-600 dark:text-gray-300">
                        <div className="bg-white dark:bg-gray-800 rounded px-2 py-1">
                          <span className="text-gray-400 block text-[10px] uppercase tracking-wide">Latitude</span>
                          <span className="font-mono font-medium">{newLat}</span>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded px-2 py-1">
                          <span className="text-gray-400 block text-[10px] uppercase tracking-wide">Longitude</span>
                          <span className="font-mono font-medium">{newLon}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2">
                        Coordinates rounded to ~100 m for privacy. © OpenStreetMap contributors
                      </p>
                    </div>
                  </div>
                )}

                {/* Manual entry fallback — collapsed by default */}
                <details className="mt-2">
                  <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-200 select-none">
                    Enter coordinates manually instead
                  </summary>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="block text-xs font-medium mb-1">Latitude</label>
                      <input
                        type="number"
                        value={newLat}
                        onChange={e => { setNewLat(e.target.value); setLocationState('idle') }}
                        placeholder="22.307"
                        className="w-full p-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 font-mono"
                        step="0.001"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Longitude</label>
                      <input
                        type="number"
                        value={newLon}
                        onChange={e => { setNewLon(e.target.value); setLocationState('idle') }}
                        placeholder="73.181"
                        className="w-full p-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 font-mono"
                        step="0.001"
                      />
                    </div>
                  </div>
                </details>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Pump Depth (m, optional)</label>
                <input
                  type="number"
                  value={newPumpDepth}
                  onChange={e => setNewPumpDepth(e.target.value)}
                  placeholder="e.g. 60"
                  className="w-full p-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  min="0" max="300"
                />
              </div>
            </div>
          )}

          <button
            onClick={() => setStep(2)}
            disabled={!createNew && !selectedWellId}
            className="btn-primary w-full justify-center mt-4"
          >
            Next: Add Reading
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {selectedWell && (
            <div className="card p-3 flex items-center gap-2">
              <StatusBadge status={selectedWell.status} />
              <div>
                <div className="font-medium text-sm">{selectedWell.name}</div>
                <div className="text-xs text-gray-500">
                  {selectedWell.latestDepthM
                    ? `Last: ${selectedWell.latestDepthM.toFixed(1)} m on ${selectedWell.latestDate}`
                    : 'No previous readings'
                  }
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Date *</label>
            <input
              type="date"
              value={readingDate}
              onChange={e => setReadingDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Depth to water (m) *</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDepth(d => String(Math.max(0, parseFloat(d || '0') - 0.5)))}
                className="w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center font-bold"
                aria-label="Decrease depth"
              >−</button>
              <input
                type="number"
                value={depth}
                onChange={e => setDepth(e.target.value)}
                placeholder="e.g. 25.5"
                className="flex-1 p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-center dark:bg-gray-700"
                min="0" max="300" step="0.1"
                aria-label="Depth in meters"
              />
              <button
                onClick={() => setDepth(d => String(parseFloat(d || '0') + 0.5))}
                className="w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center font-bold"
                aria-label="Increase depth"
              >+</button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Depth from surface to water level</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Measurement condition</label>
            <select
              value={condition}
              onChange={e => setCondition(e.target.value)}
              className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700"
            >
              <option value="pump_off">Pump off 30+ minutes</option>
              <option value="recently_used">Recently used (pump running)</option>
              <option value="not_sure">Not sure</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Note (optional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. After monsoon rain, level recovered"
              className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 resize-none"
              rows={2}
              maxLength={200}
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary flex-1 justify-center">
              <ChevronLeft size={16} />
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !depth}
              className="btn-primary flex-1 justify-center"
            >
              {loading ? 'Submitting…' : 'Submit Reading'}
            </button>
          </div>

          {/* How to measure helper */}
          <details className="card p-3 text-sm">
            <summary className="font-medium cursor-pointer">How to measure your borewell</summary>
            <ol className="mt-2 space-y-1 text-gray-600 dark:text-gray-400">
              <li>1. Turn off the pump and wait at least 30 minutes</li>
              <li>2. Lower a measuring tape or depth sounder into the borewell</li>
              <li>3. Note the depth when the tape touches water</li>
              <li>4. Record the date and time of measurement</li>
            </ol>
          </details>
        </div>
      )}
    </div>
  )
}
