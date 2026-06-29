// API client — fetches from the bot telemetry API (/api/data)
// Replaces TanStack Start createServerFn with plain fetch()
// so the app works as a static SPA

const API_BASE = ''

export interface SessionRecord {
  recordedAt: string; runId: string; runner: string; label: string;
  profileId: string; extensionBundleHash?: string; extensionSlugs: string[];
  sessionStatePolicy?: string; targetDomain?: string; referrerType?: string;
  endedAt: string; elapsedMs: number; elapsedSec: number;
  uniquePageCount: number; uniquePages: string[]; warningsCount: number;
  warnings: string[]; flowsRun: string[]; interactions: number;
  trafficBytesTotal: number; trafficBytesSameOrigin: number;
  trafficRequestCount: number; metMinDuration: boolean; metMinUniquePages: boolean;
  mostloginProfileId?: string; railwayReplicaId?: string; profileSource?: string;
}

export interface ExtEvent {
  timestamp: number; type: string; url: string; method: string;
  matchedDomain: string; extensionId?: string;
  requestBody?: string; responseBody?: string; statusCode?: number;
}

export interface SWObservation {
  observedAt: string; domain: string;
  similarweb: {
    snapshot: {
      globalRank: number | null; visitsTotalCount: number | null;
      pagesPerVisit: number | null; bounceRate: number | null;
      visitsAvgDurationFormatted: string | null;
    } | null;
  };
}

export interface ModeConfig {
  cbmProfiles: string[]
  cbmUrl: string | null
}

export interface DashboardData {
  sessions: SessionRecord[]
  extEvents: ExtEvent[]
  swObservations: SWObservation[]
  fingerprint: string
  modeConfig?: ModeConfig
}

// --- CBM Profile types ---
export interface CbmProfile {
  id: string
  name: string
  fingerprint_seed?: number
  auto_launch?: boolean
  status?: string
  cdp_url?: string
  vnc_ws_port?: number
  display?: number
  tags?: string[]
}

export interface CbmStatus {
  running_count: number
  binary_version: string
  profiles_total: number
}

export async function getDashboardData(): Promise<DashboardData> {
  const res = await fetch(`${API_BASE}/api/data`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// --- Mode management ---
export async function getModeConfig(): Promise<ModeConfig> {
  const res = await fetch(`${API_BASE}/api/mode`)
  if (!res.ok) return { cbmProfiles: [], cbmUrl: null }
  return res.json()
}

export async function setProfileMode(profileId: string, mode: 'patchright' | 'cbm', cbmUrl?: string): Promise<ModeConfig> {
  const res = await fetch(`${API_BASE}/api/mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId, mode, cbmUrl }),
  })
  if (!res.ok) throw new Error(`Failed to set mode: ${res.status}`)
  return res.json()
}

// --- CBM proxy (routed through dashboard server to avoid CORS) ---
const CBM_PROXY = '/api/cbm'

export async function cbmGetStatus(): Promise<CbmStatus> {
  const res = await fetch(`${CBM_PROXY}/api/status`)
  return res.json()
}

export async function cbmGetProfiles(): Promise<CbmProfile[]> {
  const res = await fetch(`${CBM_PROXY}/api/profiles`)
  return res.json()
}

export async function cbmLaunchProfile(id: string): Promise<any> {
  const res = await fetch(`${CBM_PROXY}/api/profiles/${id}/launch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  return res.json()
}

export async function cbmStopProfile(id: string): Promise<any> {
  const res = await fetch(`${CBM_PROXY}/api/profiles/${id}/stop`, { method: 'POST' })
  return res.json()
}

export async function cbmCreateProfile(name: string, fingerprintSeed: number): Promise<CbmProfile> {
  const res = await fetch(`${CBM_PROXY}/api/profiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, fingerprint_seed: fingerprintSeed, auto_launch: false }),
  })
  return res.json()
}
