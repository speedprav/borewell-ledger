// pages/PlanPage.tsx
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Leaf, RefreshCw, Check, Download, Bot } from 'lucide-react'
import { aiPlan, getMap } from '../api'
import { getSettings, toggleMeasure } from '../store'
import { CardSkeleton } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import type { PlanResult, PlanMeasure, Well, UserRole } from '../types'

const TIER_LABELS: Record<string, string> = {
  this_week: 'This Week',
  this_month: 'This Month',
  before_summer: 'Before Summer',
}

const EFFORT_COLOR: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
}

function MeasureCard({ measure, done, onToggle }: { measure: PlanMeasure; done: boolean; onToggle: () => void }) {
  return (
    <div className={`card p-4 transition-opacity ${done ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-0.5
            ${done ? 'border-green-500 bg-green-500' : 'border-gray-300 dark:border-gray-600'}`}
          aria-label={done ? 'Mark as not done' : 'Mark as done'}
        >
          {done && <Check size={12} className="text-white" />}
        </button>
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium text-sm ${done ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>
            {measure.title}
          </h4>
          <p className="text-xs text-gray-500 mt-0.5 mb-2">{measure.whyItHelps}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${EFFORT_COLOR[measure.effort]}`}>
              {measure.effort} effort
            </span>
            <span className="text-xs text-gray-500">{measure.costRange}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PlanPage() {
  const [searchParams] = useSearchParams()
  const prefillWellId = searchParams.get('wellId')
  const settings = getSettings()
  const lang = settings.language
  const role = settings.role

  const [wells, setWells] = useState<Well[]>([])
  const [selectedWellId, setSelectedWellId] = useState(prefillWellId || '')
  const [plan, setPlan] = useState<PlanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [completedIds, setCompletedIds] = useState(new Set(settings.completedMeasures))

  useEffect(() => {
    getMap().then(data => {
      setWells(data.wells)
      if (!prefillWellId && data.wells.length > 0) {
        const urgent = data.wells.find(w => w.status === 'CRITICAL') || data.wells[0]
        if (urgent) setSelectedWellId(urgent.wellId)
      }
    }).catch(() => {})
  }, [])

  const loadPlan = () => {
    if (!selectedWellId) return
    setLoading(true)
    aiPlan({ wellId: selectedWellId }, role as UserRole, lang)
      .then(res => setPlan(res))
      .catch(() => setPlan(null))
      .finally(() => setLoading(false))
  }

  const handleToggle = (measureId: string) => {
    const nowDone = toggleMeasure(measureId)
    setCompletedIds(prev => {
      const next = new Set(prev)
      if (nowDone) next.add(measureId)
      else next.delete(measureId)
      return next
    })
  }

  const handlePrint = () => window.print()

  const tiers = ['this_week', 'this_month', 'before_summer']

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">Water-Saving Plan</h1>
        {plan && (
          <button onClick={handlePrint} className="btn-secondary text-xs py-1.5 no-print">
            <Download size={14} />
            PDF
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <select
          value={selectedWellId}
          onChange={e => setSelectedWellId(e.target.value)}
          className="flex-1 p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          aria-label="Select target well"
        >
          <option value="">— Select a well —</option>
          {wells.map(w => (
            <option key={w.wellId} value={w.wellId}>{w.name} ({w.locality})</option>
          ))}
        </select>
        <button
          onClick={loadPlan}
          disabled={loading || !selectedWellId}
          className="btn-primary shrink-0"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Loading…' : 'Get Plan'}
        </button>
      </div>

      {loading && <div className="space-y-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>}

      {!loading && !plan && !selectedWellId && (
        <EmptyState
          title="Select a well"
          description="Choose a well above to generate a personalised water-saving plan."
          icon={<Leaf size={28} className="text-green-400" />}
        />
      )}

      {plan && !loading && (
        <div className="space-y-6">
          <div className="card p-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">{plan.situation}</p>
            {plan.advisorySource === 'template' && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠️ Template advice — AI unavailable. Suggestions based on fixed rules.
              </p>
            )}
          </div>

          {tiers.map(tier => {
            const measures = plan.measures.filter(m => m.tier === tier)
            if (measures.length === 0) return null
            return (
              <div key={tier}>
                <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#0B5C8A]" />
                  {TIER_LABELS[tier]}
                </h2>
                <div className="space-y-2">
                  {measures.map(m => (
                    <MeasureCard
                      key={m.id}
                      measure={m}
                      done={completedIds.has(m.id)}
                      onToggle={() => handleToggle(m.id)}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          <p className="text-xs text-gray-400 text-center">
            All quantities are indicative ranges only. Consult local experts for implementation.
          </p>
        </div>
      )}
    </div>
  )
}
