import { createServerFn } from '@tanstack/react-start'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

const TELEMETRY_DIR = path.resolve(process.cwd(), '..', 'telemetry')

interface SessionRecord {
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

interface ExtEvent {
  timestamp: number; type: string; url: string; method: string;
  matchedDomain: string; extensionId?: string;
  requestBody?: string; responseBody?: string; statusCode?: number;
}

interface SWObservation {
  observedAt: string; domain: string;
  similarweb: {
    snapshot: {
      globalRank: number | null; visitsTotalCount: number | null;
      pagesPerVisit: number | null; bounceRate: number | null;
      visitsAvgDurationFormatted: string | null;
    } | null;
  };
}

async function readJsonl<T>(filePath: string, limit?: number): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    const sliced = limit ? lines.slice(-limit) : lines
    return sliced.map(l => JSON.parse(l) as T)
  } catch { return [] }
}

export const getDashboardData = createServerFn({ method: 'GET' }).handler(async () => {
  const sessionsP = readJsonl<SessionRecord>(
    path.join(TELEMETRY_DIR, 'patchright.sessions.jsonl'), 500
  )
  const extEventsP = readJsonl<ExtEvent>(
    path.join(TELEMETRY_DIR, 'extension-events.jsonl'), 200
  )
  const swObsP = readJsonl<SWObservation>(
    path.join(TELEMETRY_DIR, 'similarweb.observations.jsonl')
  )
  const [sessions, extEvents, swObservations] = await Promise.all([sessionsP, extEventsP, swObsP])

  const fingerprint = sessions.length + ':' + (sessions[sessions.length - 1]?.recordedAt || '')

  return { sessions, extEvents, swObservations, fingerprint }
})
