// types.ts - Shared TypeScript types for Borewell Ledger

export type OwnerType = 'society' | 'farm' | 'other'
export type WellStatus = 'NORMAL' | 'WATCH' | 'CRITICAL' | 'NOT_ENOUGH_DATA'
export type AlertSeverity = 'CRITICAL' | 'WATCH'
export type AlertType = 'WELL' | 'AREA'
export type AlertStatus = 'new' | 'seen' | 'resolved'
export type AdvisorySource = 'ai' | 'template'
export type UserRole = 'society' | 'farm' | 'officer' | 'ngo'
export type Language = 'en' | 'hi' | 'gu'
export type Theme = 'light' | 'dark'

export interface Well {
  wellId: string
  name: string
  ownerType: OwnerType
  locality: string
  lat: number
  lon: number
  geohash5?: string
  pumpDepthM?: number
  latestDepthM?: number
  latestDate?: string
  slopeMPerMonth?: number
  peerMedian?: number
  peerCount?: number
  status: WellStatus
  source: 'user' | 'seed' | 'official'
  createdAt: string
  updatedAt?: string
}

export interface Reading {
  wellId: string
  date: string
  depthM: number
  source: string
  note?: string
  createdAt: string
}

export interface Alert {
  alertId: string
  type: AlertType
  severity: AlertSeverity
  wellId?: string
  locality?: string
  wellCount?: number
  ownSlope?: number
  peerMedian?: number
  medianSlope?: number
  centroidLat?: number
  centroidLon?: number
  message: string
  advisoryText: string
  advisorySource: AdvisorySource
  status: AlertStatus
  createdAt: string
  resolvedAt?: string
}

export interface DryoutEstimate {
  monthsLow: number
  monthsHigh: number
  label: string
}

export interface PeerSummary {
  label: string
  distKm: number
  slope: number
}

export interface WellDetail {
  well: Well
  readings: Reading[]
  peers: {
    summary: PeerSummary[]
    peerCount: number
    peerMedian: number | null
  }
  dryoutEstimate: DryoutEstimate | null
  dataQualityFlags: string[]
}

export interface MapData {
  wells: Well[]
  areaAlerts: AreaAlert[]
  total: number
}

export interface AreaAlert {
  alertId?: string
  locality: string
  wellCount: number
  medianSlope: number
  centroidLat: number
  centroidLon: number
  severity: AlertSeverity
  message?: string
}

export interface AnalysisResult {
  summary: string
  whatIsHappening: string
  possibleReasons: string[]
  confidence: { level: string; notes: string }
  nextSteps: string[]
  advisorySource: AdvisorySource
  disclaimer?: string
  fromCache?: boolean
}

export interface PlanMeasure {
  id: string
  tier: 'this_week' | 'this_month' | 'before_summer'
  title: string
  whyItHelps: string
  effort: 'low' | 'medium' | 'high'
  benefit: 'low' | 'medium' | 'high'
  costRange: string
}

export interface PlanResult {
  situation: string
  measures: PlanMeasure[]
  advisorySource: AdvisorySource
  disclaimer?: string
  fromCache?: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  reply: string
  sources: {
    readingsUsed: number
    peersUsed: number
    alertIdsReferenced: string[]
  }
  advisorySource: AdvisorySource
}

export interface CommunityData {
  statusDistribution: Record<WellStatus, number>
  totalWells: number
  hotspots: LocalityHotspot[]
  coverageGaps: CoverageGap[]
  depthOverTime: DepthPoint[]
  locality?: string
}

export interface LocalityHotspot {
  locality: string
  wellCount: number
  medianSlope: number | null
  criticalCount: number
  watchCount: number
  normalCount: number
  noDataCount: number
}

export interface CoverageGap {
  locality: string
  wellCount: number
  message: string
  inviteMessage: string
}

export interface DepthPoint {
  month: string
  median: number
  min: number
  max: number
  sampleCount: number
}

export interface AppSettings {
  name: string
  role: UserRole
  locality: string
  language: Language
  theme: Theme
  useFt: boolean
  aiLanguage: Language
  aiDetailLevel: 'short' | 'detailed'
  allowAiData: boolean
  followedWellIds: string[]
  completedMeasures: string[]
}

export interface QueuedReading {
  id: string
  wellId: string
  depthM: number
  date: string
  note?: string
  queuedAt: string
}
