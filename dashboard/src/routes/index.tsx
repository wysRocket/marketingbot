import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState, useCallback } from 'react'
import { getDashboardData } from '#/lib/api'

export const Route = createFileRoute('/')({
  component: OverviewPage,
})

interface SessionRecord {
  recordedAt: string; profileId: string; targetDomain?: string;
  elapsedMs: number; uniquePageCount: number; metMinDuration: boolean; metMinUniquePages: boolean;
  extensionSlugs: string[]; trafficBytesTotal: number;
}

interface DashboardData {
  sessions: SessionRecord[]
  fingerprint: string
}

function OverviewPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [lastFp, setLastFp] = useState('')
  const getFn = useServerFn(getDashboardData)

  const fetchData = useCallback(async () => {
    try {
      const d = await getFn()
      if (d.fingerprint !== lastFp) {
        setLastFp(d.fingerprint)
        setData(d as DashboardData)
        const el = document.getElementById('last-update')
        if (el) el.textContent = 'Updated ' + new Date().toLocaleTimeString()
      }
    } catch (e) { console.error(e) }
  }, [lastFp, getFn])

  useEffect(() => {
    fetchData()
    const iv = setInterval(fetchData, 5000)
    return () => clearInterval(iv)
  }, [fetchData])

  if (!data) return <div style={{ padding: 20, color: '#484f58' }}>Loading...</div>

  const s = data.sessions, n = s.length
  const passed = s.filter(x => x.metMinDuration && x.metMinUniquePages).length
  const avgDur = n ? Math.round(s.reduce((a, x) => a + (x.elapsedMs || 0), 0) / n / 1000) : 0
  const totalTraf = s.reduce((a, x) => a + (x.trafficBytesTotal || 0), 0)
  const exts = new Set(s.flatMap(x => x.extensionSlugs || []))
  const domains = new Set(s.map(x => x.targetDomain).filter(Boolean))

  const byDay = new Map<string, { s: number; t: number }>()
  s.forEach(r => {
    const d = (r.recordedAt || '').slice(0, 10)
    if (!byDay.has(d)) byDay.set(d, { s: 0, t: 0 })
    byDay.get(d)!.s++; byDay.get(d)!.t += r.trafficBytesTotal || 0
  })
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14)
  const maxS = Math.max(...days.map(d => d[1].s), 1)
  const maxT = Math.max(...days.map(d => d[1].t), 1)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
      {/* KPI Row */}
      <div style={{ gridColumn: 'span 12' }}>
        <div style={{ display: 'flex', gap: 1, background: '#2a2f3a', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
          {[
            ['Sessions', n], ['Avg Duration', avgDur + 's'], ['Pass Rate', Math.round(passed / n * 100) + '%'],
            ['Traffic', totalTraf < 1048576 ? (totalTraf / 1024).toFixed(0) + ' KB' : (totalTraf / 1048576).toFixed(1) + ' MB'],
            ['Extensions', exts.size], ['Domains', domains.size]
          ].map(([l, v]) => (
            <div key={l} style={{ flex: 1, background: '#11151c', padding: '10px 12px' }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.08em', color: '#484f58', marginBottom: 4 }}>{l}</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div style={{ gridColumn: 'span 6', background: '#11151c', border: '1px solid #2a2f3a', borderRadius: 6 }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #2a2f3a', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8b949e' }}>Sessions / Day</div>
        <div style={{ padding: 12, height: 100, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
          {days.map(d => (
            <div key={d[0]} style={{ flex: 1, height: (d[1].s / maxS * 100) + '%', background: '#60a5fa', borderRadius: '2px 2px 0 0', minHeight: 2 }} title={d[0] + ': ' + d[1].s} />
          ))}
        </div>
      </div>
      <div style={{ gridColumn: 'span 6', background: '#11151c', border: '1px solid #2a2f3a', borderRadius: 6 }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #2a2f3a', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8b949e' }}>Traffic / Day</div>
        <div style={{ padding: 12, height: 100, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
          {days.map(d => (
            <div key={d[0]} style={{ flex: 1, height: (d[1].t / maxT * 100) + '%', background: '#a78bfa', borderRadius: '2px 2px 0 0', minHeight: 2 }} title={d[0] + ': ' + (d[1].t / 1048576).toFixed(1) + ' MB'} />
          ))}
        </div>
      </div>

      {/* Recent Sessions */}
      <div style={{ gridColumn: 'span 12', background: '#11151c', border: '1px solid #2a2f3a', borderRadius: 6 }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #2a2f3a', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8b949e' }}>Recent Sessions</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '1px solid #2a2f3a' }}>
            {['Time', 'Profile', 'Domain', 'Duration', 'Pages', 'Quality'].map(h => (
              <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.06em', color: '#484f58', fontWeight: 600 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {s.slice(-20).reverse().map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(42,47,58,.4)' }}>
                <td style={{ padding: '6px 10px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{new Date(r.recordedAt).toLocaleTimeString()}</td>
                <td style={{ padding: '6px 10px' }}><span className="badge badge-m">{r.profileId || '?'}</span></td>
                <td style={{ padding: '6px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{r.targetDomain || '—'}</td>
                <td style={{ padding: '6px 10px', fontFamily: 'JetBrains Mono, monospace' }}>{r.elapsedMs < 60000 ? (r.elapsedMs / 1000).toFixed(1) + 's' : Math.floor(r.elapsedMs / 60000) + 'm'}</td>
                <td style={{ padding: '6px 10px' }}>{r.uniquePageCount}</td>
                <td style={{ padding: '6px 10px' }}>{r.metMinDuration && r.metMinUniquePages ? <span style={{ color: '#22c55e', fontSize: 10, fontWeight: 600 }}>PASS</span> : <span style={{ color: '#ef4444', fontSize: 10, fontWeight: 600 }}>FAIL</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
