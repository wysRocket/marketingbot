import express from 'express'
import cors from 'cors'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import https from 'node:https'

const TELEMETRY_DIR = process.env.TELEMETRY_DIR || path.resolve(process.cwd(), '..', 'telemetry')
const BOT_API_URL = process.env.BOT_API_URL || null
const PUBLIC_DIR = path.join(process.cwd(), 'dist')

async function readJsonl<T>(filePath: string, limit?: number): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    const sliced = limit ? lines.slice(-limit) : lines
    return sliced.map(l => JSON.parse(l) as T)
  } catch { return [] }
}

async function fetchFromBot(): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BOT_API_URL}/api/data`)
    const mod = url.protocol === 'https:' ? https : http
    const req = mod.get(url.toString(), { timeout: 10000 }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error('Invalid JSON from bot API')) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Bot API timeout')) })
  })
}

const app = express()
app.use(cors())

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() })
})

// Data endpoint — proxy to bot API or read locally
app.get('/api/data', async (_req, res) => {
  try {
    if (BOT_API_URL) {
      // Railway mode: proxy to bot service
      const data = await fetchFromBot()
      return res.json(data)
    }
    // Local mode: read telemetry files directly
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

// Static files
app.use(express.static(PUBLIC_DIR))

// SPA fallback
app.get(/.*/, (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' })
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'))
})

const PORT = parseInt(process.env.PORT || '3000', 10)
app.listen(PORT, () => console.log(`Dashboard at http://localhost:${PORT}`))
