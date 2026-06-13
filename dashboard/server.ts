import express from 'express'
import cors from 'cors'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const TELEMETRY_DIR = path.resolve(process.cwd(), '..', 'telemetry')
const PUBLIC_DIR = path.join(process.cwd(), 'dist')

async function readJsonl<T>(filePath: string, limit?: number): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    const sliced = limit ? lines.slice(-limit) : lines
    return sliced.map(l => JSON.parse(l) as T)
  } catch { return [] }
}

const app = express()
app.use(cors())

// API
app.get('/api/data', async (_req, res) => {
  try {
    const [sessions, extEvents, swObservations] = await Promise.all([
      readJsonl<any>(path.join(TELEMETRY_DIR, 'patchright.sessions.jsonl'), 500),
      readJsonl<any>(path.join(TELEMETRY_DIR, 'extension-events.jsonl'), 200),
      readJsonl<any>(path.join(TELEMETRY_DIR, 'similarweb.observations.jsonl')),
    ])
    const fingerprint = sessions.length + ':' + (sessions[sessions.length - 1]?.recordedAt || '')
    res.json({ sessions, extEvents, swObservations, fingerprint })
  } catch (e) { res.status(500).json({ error: String(e) }) }
})

// Static files
app.use(express.static(PUBLIC_DIR))

// SPA fallback
app.get(/.*/, (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' })
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'))
})

const PORT = parseInt(process.env.PORT || '3005', 10)
app.listen(PORT, () => console.log(`Dashboard at http://localhost:${PORT}`))
