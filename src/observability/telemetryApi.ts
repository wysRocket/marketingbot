/**
 * Minimal telemetry API server for the dashboard.
 * Can be started alongside the bot to expose /api/data via Railway internal networking.
 * 
 * Usage in index.patchright.ts:
 *   import { startTelemetryApi } from './observability/telemetryApi'
 *   startTelemetryApi() // starts on DASHBOARD_PORT or 3000
 */

import express from 'express'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const TELEMETRY_DIR = path.resolve(process.cwd(), process.env.FLOW_TELEMETRY_DIR ?? 'telemetry')

async function readJsonl<T>(filePath: string, limit?: number): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    const sliced = limit ? lines.slice(-limit) : lines
    return sliced.map(l => JSON.parse(l) as T)
  } catch { return [] }
}

export function startTelemetryApi() {
  const app = express()
  const PORT = parseInt(process.env.DASHBOARD_PORT || '3000', 10)

  app.get('/api/health', (_req, res) => res.json({ ok: true }))

  app.get('/api/data', async (_req, res) => {
    try {
      const [sessions, extEvents, swObservations] = await Promise.all([
        readJsonl<any>(path.join(TELEMETRY_DIR, 'patchright.sessions.jsonl'), 500),
        readJsonl<any>(path.join(TELEMETRY_DIR, 'extension-events.jsonl'), 200),
        readJsonl<any>(path.join(TELEMETRY_DIR, 'similarweb.observations.jsonl')),
      ])
      const fingerprint = sessions.length + ':' + (sessions[sessions.length - 1]?.recordedAt || '')
      res.json({ sessions, extEvents, swObservations, fingerprint })
    } catch (e) {
      res.status(500).json({ error: String(e) })
    }
  })

  app.listen(PORT, () => {
    console.log(`📊 Telemetry API running on port ${PORT}`)
  }).on('error', (err) => {
    console.error(`[telemetry-api] Failed to start on port ${PORT}: ${err.message}`)
  })
}
