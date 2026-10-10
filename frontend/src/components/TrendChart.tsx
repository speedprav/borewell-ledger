// components/TrendChart.tsx
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Legend
} from 'recharts'
import type { Reading } from '../types'

interface Props {
  readings: Reading[]
  peerMedian?: number | null
  slope?: number | null
  rangeSelector?: boolean
  'aria-label'?: string
}

type Range = '3m' | '6m' | '1y' | 'all'

function filterByRange(readings: Reading[], range: Range): Reading[] {
  const now = new Date()
  const days = range === '3m' ? 90 : range === '6m' ? 180 : range === '1y' ? 365 : 99999
  const cutoff = new Date(now.getTime() - days * 86400000)
  return readings.filter(r => new Date(r.date) >= cutoff)
}

function computeTrendLine(readings: Reading[]): { date: string; trend: number }[] {
  if (readings.length < 2) return []
  const t0 = new Date(readings[0].date).getTime()
  const n = readings.length
  const xs = readings.map(r => (new Date(r.date).getTime() - t0) / (86400000 * 30.4375))
  const ys = readings.map(r => r.depthM)
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0)
  const sumXX = xs.reduce((a, x) => a + x * x, 0)
  const denom = n * sumXX - sumX * sumX
  if (Math.abs(denom) < 1e-12) return []
  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return readings.map(r => ({
    date: r.date,
    trend: parseFloat((intercept + slope * ((new Date(r.date).getTime() - t0) / (86400000 * 30.4375))).toFixed(2))
  }))
}

export function TrendChart({ readings, peerMedian, slope, rangeSelector, 'aria-label': ariaLabel }: Props) {
  const [range, setRange] = (rangeSelector ? [undefined, undefined] : [undefined, undefined]) as any
  // Simple range state
  const [activeRange, setActiveRange] = useState<Range>('6m')

  const filtered = filterByRange(readings, activeRange)
  const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date))
  const trendLine = computeTrendLine(sorted)
  const trendMap = new Map(trendLine.map(t => [t.date, t.trend]))

  const data = sorted.map(r => ({
    date: r.date.slice(5), // mm-dd
    depth: r.depthM,
    trend: trendMap.get(r.date),
    peer: peerMedian ? parseFloat((r.depthM - r.depthM + peerMedian).toFixed(2)) : undefined
  }))

  const minDepth = Math.min(...sorted.map(r => r.depthM))
  const maxDepth = Math.max(...sorted.map(r => r.depthM))
  const padding = Math.max(1, (maxDepth - minDepth) * 0.2)

  const screenReaderText = sorted.length > 0
    ? `Borewell depth trend from ${sorted[0]?.date} to ${sorted[sorted.length - 1]?.date}. ` +
      `Latest depth: ${sorted[sorted.length - 1]?.depthM} m. ` +
      (slope !== null && slope !== undefined ? `Decline rate: ${slope.toFixed(2)} m/month.` : '')
    : 'No readings available for chart.'

  return (
    <div>
      {rangeSelector && (
        <div className="flex gap-1 mb-3" role="group" aria-label="Chart time range">
          {(['3m', '6m', '1y', 'all'] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setActiveRange(r)}
              className={`px-3 py-1 text-xs rounded-full transition-colors min-h-[32px]
                ${activeRange === r
                  ? 'bg-[#0B5C8A] text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                }`}
              aria-pressed={activeRange === r}
            >
              {r === 'all' ? 'All' : r}
            </button>
          ))}
        </div>
      )}

      <p className="sr-only" aria-live="polite">{screenReaderText}</p>

      {sorted.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-gray-400">
          No readings in this time range
        </div>
      ) : (
        <div aria-label={ariaLabel || 'Borewell depth trend chart'} role="img">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                reversed
                tick={{ fontSize: 11 }}
                tickLine={false}
                tickFormatter={v => `${v}m`}
                domain={[minDepth - padding, maxDepth + padding]}
                label={{ value: 'Depth (deeper →)', angle: -90, position: 'insideLeft', fontSize: 10 }}
              />
              <Tooltip
                formatter={(val: number, name: string) => {
                  if (name === 'depth') return [`${val} m`, 'Depth']
                  if (name === 'trend') return [`${val} m`, 'Trend line']
                  return [`${val} m`, name]
                }}
                labelFormatter={(l) => `Date: ${l}`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="depth"
                stroke="#0B5C8A"
                strokeWidth={2}
                dot={{ r: 3, fill: '#0B5C8A' }}
                activeDot={{ r: 5 }}
                name="Depth"
              />
              <Line
                type="monotone"
                dataKey="trend"
                stroke="#0E8FA3"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={false}
                name="Trend"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// Need to import useState separately to avoid the placeholder
import { useState } from 'react'
