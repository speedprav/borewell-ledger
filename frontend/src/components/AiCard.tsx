// components/AiCard.tsx
import { Bot, Sparkles, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { AnalysisResult } from '../types'
import { DemoDataBadge } from './DemoDataBadge'

interface Props {
  analysis: AnalysisResult | null
  loading?: boolean
  error?: string
  onGetPlan?: () => void
  onChat?: () => void
}

export function AiCard({ analysis, loading, error, onGetPlan, onChat }: Props) {
  const [expanded, setExpanded] = useState(true)

  if (loading) {
    return (
      <div className="card p-4 space-y-3" aria-busy="true">
        <div className="flex items-center gap-2 text-[#0B5C8A]">
          <Bot size={18} />
          <span className="font-semibold text-sm">AI Analysis</span>
          <span className="text-xs text-gray-400 animate-pulse ml-auto">Analysing…</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-4 skeleton rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-4 border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2 text-red-600 mb-2">
          <AlertCircle size={18} />
          <span className="font-semibold text-sm">AI Analysis</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
      </div>
    )
  }

  if (!analysis) return null

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center gap-2 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
        onClick={() => setExpanded(e => !e)}
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setExpanded(v => !v)}
      >
        <Bot size={18} className="text-[#0B5C8A] dark:text-blue-400" aria-hidden />
        <span className="font-semibold text-sm flex-1">AI Analysis</span>
        {analysis.fromCache && (
          <span className="text-xs text-gray-400">cached</span>
        )}
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 dark:border-gray-700 pt-3">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {analysis.summary}
          </p>

          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              What is Happening
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300">{analysis.whatIsHappening}</p>
          </section>

          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Possible Reasons
            </h4>
            <ul className="space-y-1">
              {analysis.possibleReasons.map((r, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
                  <span className="text-[#0E8FA3] mt-0.5 shrink-0">•</span>
                  {r}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              How Sure Are We
            </h4>
            <div className="flex items-center gap-2 text-sm">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                analysis.confidence.level === 'high' ? 'bg-green-100 text-green-700' :
                analysis.confidence.level === 'medium' ? 'bg-amber-100 text-amber-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {analysis.confidence.level}
              </span>
              <span className="text-gray-600 dark:text-gray-400 text-xs">{analysis.confidence.notes}</span>
            </div>
          </section>

          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Suggested Next Steps
            </h4>
            <ol className="space-y-1">
              {analysis.nextSteps.map((s, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
                  <span className="text-[#0B5C8A] font-semibold shrink-0">{i + 1}.</span>
                  {s}
                </li>
              ))}
            </ol>
          </section>

          <div className="flex gap-2 pt-2">
            {onGetPlan && (
              <button onClick={onGetPlan} className="btn-primary text-xs py-1.5">
                <Sparkles size={14} />
                Get Water-Saving Plan
              </button>
            )}
            {onChat && (
              <button onClick={onChat} className="btn-secondary text-xs py-1.5">
                <Bot size={14} />
                Chat about this well
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400 italic">
            AI analysis is for guidance only. Not a substitute for professional hydrogeology advice.
          </p>
        </div>
      )}
    </div>
  )
}
