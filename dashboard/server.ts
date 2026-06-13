import express from 'express'
import cors from 'cors'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const TELEMETRY_DIR = path.resolve(process.cwd(), '..', 'telemetry')

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

app.use(express.static(path.join(process.cwd(), 'dist', 'public')))
app.get('*', (_req, res) => res.sendFile(path.join(process.cwd(), 'dist', 'public', 'index.html')))

const PORT = parseInt(process.env.PORT || '3005', 10)
app.listen(PORT, () => console.log(`Dashboard at http://localhost:${PORT}`))
