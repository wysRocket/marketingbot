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

export interface DashboardData {
  sessions: SessionRecord[]
  extEvents: ExtEvent[]
  swObservations: SWObservation[]
  fingerprint: string
}

export async function getDashboardData(): Promise<DashboardData> {
  const res = await fetch(`${API_BASE}/api/data`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}
