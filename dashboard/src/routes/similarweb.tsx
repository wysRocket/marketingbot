import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { getDashboardData } from '#/lib/api'

export const Route = createFileRoute('/similarweb')({
  component: SimilarwebPage,
})

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

interface SessionRecord {
  recordedAt: string; endedAt: string; elapsedSec: number; uniquePageCount: number;
  metMinDuration: boolean; extensionSlugs: string[]; uniquePages: string[];
}

interface DashboardData {
  sessions: SessionRecord[]
  swObservations: SWObservation[]
  fingerprint: string
}

function SimilarwebPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [lastFp, setLastFp] = useState('')
  const [domain, setDomain] = useState('')
  const [hours, setHours] = useState(168)
  const getFn = useServerFn(getDashboardData)

  const fetchData = useCallback(async () => {
    try {
      const d = await getFn()
      if (d.fingerprint !== lastFp) { setLastFp(d.fingerprint); setData(d as DashboardData) }
    } catch (e) { console.error(e) }
  }, [lastFp, getFn])

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 5000); return () => clearInterval(iv) }, [fetchData])

  const allDomains = useMemo(() => [...new Set((data?.swObservations || []).map(o => o.domain))].sort(), [data])

  const filtered = useMemo(() => {
    if (!data) return { obs: [] as SWObservation[], sessions: [] as SessionRecord[] }
    const domainToUse = domain || allDomains[0] || 'eurocookflow.com'
    const cutoff = Date.now() - hours * 3600000
    const obs = data.swObservations.filter(o => o.domain === domainToUse && Date.parse(o.observedAt) >= cutoff)
    const sessions = data.sessions.filter(s => {
      const ts = Date.parse(s.endedAt || s.recordedAt)
      return ts >= cutoff && s.uniquePages.some(p => p.includes(domainToUse))
    })
    return { obs, sessions }
  }, [data, domain, hours, allDomains])

  const byDay = useMemo(() => {
    const map = new Map<string, SessionRecord[]>()
    filtered.sessions.forEach(s => {
      const d = (s.endedAt || s.recordedAt).slice(0, 10)
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(s)
    })
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered.sessions])

  if (!data) return <div style={{ padding: 20, color: '#484f58' }}>Loading...</div>

  const first = filtered.obs[0]
  const last = filtered.obs[filtered.obs.length - 1]
  const vD = first?.similarweb?.snapshot?.visitsTotalCount != null && last?.similarweb?.snapshot?.visitsTotalCount != null
    ? last.similarweb.snapshot.visitsTotalCount! - first.similarweb.snapshot.visitsTotalCount! : null
  const rD = first?.similarweb?.snapshot?.globalRank != null && last?.similarweb?.snapshot?.globalRank != null
    ? last.similarweb.snapshot.globalRank! - first.similarweb.snapshot.globalRank! : null

  const recommendation = !filtered.sessions.length ? 'Run the bot first to see correlation.'
    : filtered.obs.length < 2 ? 'Not enough SW observations. Run check:similarweb at least 2x.'
    : vD === null ? 'SW snapshot data unavailable. Check SCRAPFLY_KEY.'
    : vD > 0 ? `POSITIVE: visits increased by ${vD}. ${filtered.sessions.length} sessions with: ${[...new Set(filtered.sessions.flatMap(s => s.extensionSlugs || []))].join(', ') || '(none)'}.`
    : vD === 0 ? 'NEUTRAL: visits unchanged. May need more time (24-48h lag).'
    : `Decreased by ${Math.abs(vD)}. May be natural fluctuation.`

  const snapRows = filtered.obs.map((o, i) => (
    <tr key={i} style={{ borderBottom: '1px solid rgba(42,47,58,.4)' }}>
      <td style={{ padding: '6px 10px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{new Date(o.observedAt).toLocaleString()}</td>
      <td style={{ padding: '6px 10px' }}>{o.similarweb?.snapshot?.visitsTotalCount != null ? o.similarweb.snapshot.visitsTotalCount.toLocaleString() : '—'}</td>
      <td style={{ padding: '6px 10px' }}>{o.similarweb?.snapshot?.globalRank != null ? o.similarweb.snapshot.globalRank.toLocaleString() : '—'}</td>
      <td style={{ padding: '6px 10px' }}>{o.similarweb?.snapshot?.pagesPerVisit || '—'}</td>
      <td style={{ padding: '6px 10px' }}>{o.similarweb?.snapshot?.bounceRate != null ? (o.similarweb.snapshot.bounceRate * 100).toFixed(1) + '%' : '—'}</td>
    </tr>
  ))

  const bucketRows = byDay.map(b => {
    const recs = b[1]; const n = recs.length
    return (
      <tr key={b[0]} style={{ borderBottom: '1px solid rgba(42,47,58,.4)' }}>
        <td style={{ padding: '6px 10px', fontFamily: 'JetBrains Mono, monospace' }}>{b[0]}</td>
        <td style={{ padding: '6px 10px' }}>{n}</td>
        <td style={{ padding: '6px 10px', fontFamily: 'JetBrains Mono, monospace' }}>{Math.round(recs.reduce((a, r) => a + (r.elapsedSec || 0), 0) / n)}s</td>
        <td style={{ padding: '6px 10px' }}>{(recs.reduce((a, r) => a + r.uniquePageCount, 0) / n).toFixed(1)}</td>
        <td style={{ padding: '6px 10px' }}>{Math.round(recs.filter(r => r.metMinDuration).length / n * 100)}%</td>
        <td style={{ padding: '6px 10px' }}>{[...new Set(recs.flatMap(r => r.extensionSlugs || []))].map(e => <span className="pill pill-b">{e}</span>)}</td>
      </tr>
    )
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: '#11151c', border: '1px solid #2a2f3a', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 10, color: '#484f58', textTransform: 'uppercase' }}>Domain</label>
        <select value={domain} onChange={e => setDomain(e.target.value)} style={{ background: '#181c24', border: '1px solid #2a2f3a', color: '#c9d1d9', padding: '4px 8px', borderRadius: 4, fontSize: 11 }}>
          {allDomains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <label style={{ fontSize: 10, color: '#484f58', textTransform: 'uppercase' }}>Window</label>
        <select value={hours} onChange={e => setHours(parseInt(e.target.value))} style={{ background: '#181c24', border: '1px solid #2a2f3a', color: '#c9d1d9', padding: '4px 8px', borderRadius: 4, fontSize: 11 }}>
          <option value="24">24h</option><option value="168">7d</option><option value="720">30d</option>
        </select>
      </div>

      <div style={{ background: '#11151c', border: '1px solid #2a2f3a', borderRadius: 6 }}>
        <div style={{ padding: 12 }}>
          <div style={{ display: 'flex', gap: 1, background: '#2a2f3a', borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
            {[
              ['Sessions', filtered.sessions.length], ['Days', byDay.length],
              ['Visits Δ', vD !== null ? (vD >= 0 ? '+' : '') + vD : '—'],
              ['Rank Δ', rD !== null ? (rD >= 0 ? '+' : '') + rD : '—'],
              ['SW Obs', filtered.obs.length]
            ].map(([l, v]) => (
              <div key={l} style={{ flex: 1, background: '#11151c', padding: '10px 12px' }}>
                <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.08em', color: '#484f58', marginBottom: 4 }}>{l}</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: typeof v === 'number' && v > 0 ? '#22c55e' : typeof v === 'string' && v.startsWith('+') ? '#22c55e' : typeof v === 'string' && v.startsWith('-') ? '#ef4444' : '#c9d1d9' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: '#11151c', border: '1px solid #2a2f3a', borderRadius: 6 }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #2a2f3a', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8b949e' }}>Sessions by Day</div>
        <table><thead><tr style={{ borderBottom: '1px solid #2a2f3a' }}>
          {['Date', 'Sessions', 'Avg Dur', 'Avg Pg', 'Pass', 'Extensions'].map(h => (
            <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.06em', color: '#484f58', fontWeight: 600 }}>{h}</th>
          ))}
        </tr></thead><tbody>{bucketRows}</tbody></table>
      </div>

      <div style={{ background: '#11151c', border: '1px solid #2a2f3a', borderRadius: 6 }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #2a2f3a', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8b949e' }}>SW Snapshot Timeline</div>
        <table><thead><tr style={{ borderBottom: '1px solid #2a2f3a' }}>
          {['Observed', 'Visits', 'Rank', 'Pg/Visit', 'Bounce'].map(h => (
            <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.06em', color: '#484f58', fontWeight: 600 }}>{h}</th>
          ))}
        </tr></thead><tbody>{snapRows}</tbody></table>
      </div>

      <div style={{ background: '#11151c', border: '1px solid #2a2f3a', borderRadius: 6, padding: 16, fontSize: 12, lineHeight: 1.6 }}>
        <strong>Recommendation:</strong> {recommendation}
      </div>
    </div>
  )
}
