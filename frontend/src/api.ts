// api.ts - API client for Borewell Ledger
// Reads base URL from /config.json loaded at startup

import type {
  MapData, WellDetail, Well, Reading, Alert, CommunityData,
  AnalysisResult, PlanResult, ChatMessage, ChatResponse, Language, UserRole
} from './types'

function getApiUrl(): string {
  return window.__APP_CONFIG__?.apiUrl || '/api'
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${getApiUrl()}${path}`
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) {
    opts.body = JSON.stringify(body)
  }

  const resp = await fetch(url, opts)
  const data = await resp.json()

  if (!resp.ok) {
    const msg = data?.error?.message || `HTTP ${resp.status}`
    throw new Error(msg)
  }

  return data as T
}

const get = <T>(path: string) => request<T>('GET', path)
const post = <T>(path: string, body: unknown) => request<T>('POST', path, body)
const patch = <T>(path: string, body: unknown) => request<T>('PATCH', path, body)

// ── Map ──────────────────────────────────────────────────────────────────────
export const getMap = () => get<MapData>('/map')

// ── Wells ─────────────────────────────────────────────────────────────────────
export const getWell = (id: string) => get<WellDetail>(`/wells/${id}`)
export const createWell = (data: Partial<Well> & { depthM?: number; date?: string; note?: string }) =>
  post<{ well: Well }>('/wells', data)

// ── Readings ──────────────────────────────────────────────────────────────────
export const addReading = (data: { wellId: string; depthM: number; date: string; note?: string }) =>
  post<{ reading: Reading; updatedWell: Partial<Well>; warning?: string; warningMessage?: string }>(
    '/readings', data
  )

// ── Alerts ────────────────────────────────────────────────────────────────────
export const getAlerts = (params?: { status?: string; severity?: string }) => {
  const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''
  return get<{ alerts: Alert[]; total: number }>(`/alerts${qs}`)
}
export const patchAlert = (id: string, status: 'seen' | 'resolved') =>
  patch<{ alert: Alert }>(`/alerts/${id}`, { status })

// ── Community ─────────────────────────────────────────────────────────────────
export const getCommunity = (locality?: string) => {
  const qs = locality ? `?locality=${encodeURIComponent(locality)}` : ''
  return get<CommunityData>(`/community${qs}`)
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export const runAnalysis = () =>
  post<{ status: string; message: string; changes?: unknown; secondsRemaining?: number }>(
    '/admin/run-analysis', {}
  )

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiAnalyze = (wellId: string, language: Language = 'en') =>
  post<AnalysisResult>('/ai/analyze', { wellId, language })

export const aiPlan = (
  target: { wellId?: string; locality?: string },
  role: UserRole,
  language: Language = 'en'
) => post<PlanResult>('/ai/plan', { ...target, role, language })

export const aiChat = (
  messages: ChatMessage[],
  wellId: string | null,
  language: Language = 'en'
) => post<ChatResponse>('/ai/chat', { messages, wellId, language })

// ── Health ────────────────────────────────────────────────────────────────────
export const getHealth = () => get<{ status: string }>('/health')
