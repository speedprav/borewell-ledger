// store.ts - App-wide state in localStorage
// Wraps every access in try/catch; app works if storage is blocked.

import type { AppSettings, QueuedReading, Language, Theme, UserRole } from './types'

const SETTINGS_KEY = 'bl:settings'
const QUEUE_KEY = 'bl:queue'

const DEFAULT_SETTINGS: AppSettings = {
  name: '',
  role: 'society',
  locality: '',
  language: 'en',
  theme: 'light',
  useFt: false,
  aiLanguage: 'en',
  aiDetailLevel: 'short',
  allowAiData: true,
  followedWellIds: [],
  completedMeasures: [],
}

// Demo wells auto-followed on first "Explore Demo"
const DEMO_WELL_IDS = ['seed-well-001', 'seed-well-002', 'seed-well-003']

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function safeSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage blocked or full — silently ignore
  }
}

export function getSettings(): AppSettings {
  const stored = safeGet<Partial<AppSettings>>(SETTINGS_KEY, {})
  return { ...DEFAULT_SETTINGS, ...stored }
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const updated = { ...current, ...settings }
  safeSet(SETTINGS_KEY, updated)
  return updated
}

export function followWell(wellId: string): void {
  const s = getSettings()
  if (!s.followedWellIds.includes(wellId)) {
    saveSettings({ followedWellIds: [...s.followedWellIds, wellId] })
  }
}

export function unfollowWell(wellId: string): void {
  const s = getSettings()
  saveSettings({ followedWellIds: s.followedWellIds.filter(id => id !== wellId) })
}

export function exploreDemo(): void {
  const s = getSettings()
  const merged = [...new Set([...s.followedWellIds, ...DEMO_WELL_IDS])]
  saveSettings({ followedWellIds: merged })
}

export function toggleMeasure(measureId: string): boolean {
  const s = getSettings()
  const done = s.completedMeasures.includes(measureId)
  if (done) {
    saveSettings({ completedMeasures: s.completedMeasures.filter(id => id !== measureId) })
    return false
  } else {
    saveSettings({ completedMeasures: [...s.completedMeasures, measureId] })
    return true
  }
}

// ── Queued readings (offline queue) ──────────────────────────────────────────

export function getQueue(): QueuedReading[] {
  return safeGet<QueuedReading[]>(QUEUE_KEY, [])
}

export function enqueueReading(reading: Omit<QueuedReading, 'id' | 'queuedAt'>): void {
  const queue = getQueue()
  queue.push({
    ...reading,
    id: crypto.randomUUID?.() || Date.now().toString(),
    queuedAt: new Date().toISOString()
  })
  safeSet(QUEUE_KEY, queue)
}

export function dequeueReading(id: string): void {
  const queue = getQueue().filter(r => r.id !== id)
  safeSet(QUEUE_KEY, queue)
}

export function clearQueue(): void {
  safeSet(QUEUE_KEY, [])
}

// ── Theme ─────────────────────────────────────────────────────────────────────

export function applyTheme(theme: Theme): void {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

// ── Unit conversion ───────────────────────────────────────────────────────────

export function toDisplayUnit(meters: number, useFt: boolean): string {
  if (useFt) {
    return `${(meters * 3.28084).toFixed(1)} ft`
  }
  return `${meters.toFixed(1)} m`
}

export function formatRate(mpm: number | undefined, useFt: boolean): string {
  if (mpm === undefined || mpm === null) return '—'
  if (useFt) {
    return `${(mpm * 3.28084).toFixed(2)} ft/month`
  }
  return `${mpm.toFixed(2)} m/month`
}

// ── Chat history ──────────────────────────────────────────────────────────────

export function getChatHistory(wellId: string | null): { role: string; content: string }[] {
  const key = `bl:chat:${wellId || 'general'}`
  return safeGet(key, [])
}

export function saveChatHistory(wellId: string | null, messages: { role: string; content: string }[]): void {
  const key = `bl:chat:${wellId || 'general'}`
  // Keep last 20 messages
  safeSet(key, messages.slice(-20))
}
