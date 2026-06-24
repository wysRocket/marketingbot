import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { getDashboardData } from '#/lib/api'

export const Route = createFileRoute('/sessions')({
  component: SessionsPage,
})

interface SessionRecord {
  recordedAt: string; runId: string; runner: string; label: string;
  profileId: string; targetDomain?: string; elapsedMs: number; elapsedSec: number;
  uniquePageCount: number; uniquePages: string[]; warningsCount: number;
  warnings: string[]; flowsRun: string[]; interactions: number;
  trafficBytesTotal: number; metMinDuration: boolean; metMinUniquePages: boolean;
  extensionSlugs: string[];
}

interface DashboardData {
  sessions: SessionRecord[]
  fingerprint: string
}

function friendlyExtName(slug: string): string {
  const map: Record<string, string> = {
    'similarweb': 'SW',
    'honey': 'Honey',
    'hola': 'Hola',
    'ghostery': 'Ghost',
    'wappalyzer': 'Wapp',
    'builtwith': 'Built',
    'mozbar': 'Moz',
    'ahrefs': 'Ahrefs',
    'keywords-everywhere': 'KE',
  }
  if (map[slug]) return map[slug]
  // For chrome extension IDs, show first 6 chars
  if (slug.length > 12) return slug.slice(0, 8)
  return slug
}

function SessionsPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [lastFp, setLastFp] = useState('')
  const [profileFilter, setProfileFilter] = useState('')
  const [domainFilter, setDomainFilter] = useState('')
  const [sortField, setSortField] = useState<'t' | 'd'>('t')
  const [sortDir, setSortDir] = useState<'d' | 'a'>('d')
  

  const fetchData = useCallback(async () => {
    try {
      const d = await getDashboardData()
      if (d.fingerprint !== lastFp) {
        setLastFp(d.fingerprint)
        setData(d as DashboardData)
        const el = document.getElementById('last-update')
        if (el && el.textContent) el.textContent = 'Updated ' + new Date().toLocaleTimeString()
      }
    } catch (e) { console.error(e) }
  }, [lastFp, getDashboardData])

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 5000); return () => clearInterval(iv) }, [fetchData])

  const profiles = useMemo(() => [...new Set((data?.sessions || []).map(s => s.profileId))].sort(), [data])

  const filtered = useMemo(() => {
    if (!data) return []
    let list = [...(data.sessions || [])]
    if (profileFilter) list = list.filter(s => s.profileId === profileFilter)
    if (domainFilter) {
      const d = domainFilter.toLowerCase()
      list = list.filter(s => (s.targetDomain || '').toLowerCase().includes(d) || (s.uniquePages || []).some(u => u.toLowerCase().includes(d)))
    }
    list.sort((a, b) => {
      const av = sortField === 't' ? Date.parse(a.recordedAt) : (a.elapsedMs || 0)
      const bv = sortField === 't' ? Date.parse(b.recordedAt) : (b.elapsedMs || 0)
      return sortDir === 'd' ? (av < bv ? 1 : -1) : (av < bv ? -1 : 1)
    })
    return list
  }, [data, profileFilter, domainFilter, sortField, sortDir])

  const formatDuration = (session: SessionRecord) =>
    session.elapsedMs < 60000
      ? `${(session.elapsedMs / 1000).toFixed(1)}s`
      : `${Math.floor(session.elapsedMs / 60000)}m`

  const formatTraffic = (session: SessionRecord) =>
    session.trafficBytesTotal < 1048576
      ? `${(session.trafficBytesTotal / 1024).toFixed(0)}KB`
      : `${(session.trafficBytesTotal / 1048576).toFixed(1)}MB`

  if (!data) return <div style={{ padding: 20, color: '#8b949e' }}>Loading...</div>

  return (
    <div className="sessions-page" style={{ background: '#11151c', border: '1px solid #2a2f3a', borderRadius: 6 }}>
      <div className="sessions-toolbar" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase' }}>Profile</label>
        <select className="sessions-control" value={profileFilter} onChange={e => setProfileFilter(e.target.value)} style={{ background: '#181c24', border: '1px solid #2a2f3a', color: '#c9d1d9', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
          <option value="">All</option>
          {profiles.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <label style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase' }}>Domain</label>
        <input className="sessions-control" value={domainFilter} onChange={e => setDomainFilter(e.target.value)} placeholder="Filter…" style={{ background: '#181c24', border: '1px solid #2a2f3a', color: '#c9d1d9', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', width: 120 }} />
        <label style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase' }}>Sort</label>
        <select className="sessions-control" value={sortField + '_' + sortDir} onChange={e => { const [f, d] = e.target.value.split('_'); setSortField(f as 't' | 'd'); setSortDir(d as 'd' | 'a') }} style={{ background: '#181c24', border: '1px solid #2a2f3a', color: '#c9d1d9', padding: '4px 8px', borderRadius: 4, fontSize: 11 }}>
          <option value="t_d">Newest</option><option value="t_a">Oldest</option><option value="d_d">Longest</option>
        </select>
        <span className="sessions-count" style={{ marginLeft: 'auto', fontSize: 11, color: '#8b949e' }}>{filtered.length} sessions</span>
      </div>
      <div className="sessions-table-scroll" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
        <thead><tr style={{ borderBottom: '1px solid #2a2f3a' }}>
          {['Time', 'Runner', 'Profile', 'Label', 'Duration', 'Pages', 'Ext', 'Flows', 'Traffic', 'Quality'].map(h => (
            <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8b949e', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {filtered.slice(0, 500).map((s, i) => {
            const q = s.metMinDuration && s.metMinUniquePages
            return (
              <tr key={i} style={{ borderBottom: '1px solid rgba(42,47,58,.4)', cursor: 'pointer' }}
                onClick={() => { const el = document.getElementById('sess-detail-' + i); if (el) el.style.display = el.style.display === 'none' ? 'table-row' : 'none' }}>
                <td style={{ padding: '6px 8px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>{new Date(s.recordedAt).toLocaleTimeString()}</td>
                <td style={{ padding: '6px 8px' }}><span className="badge badge-b">{s.runner || '?'}</span></td>
                <td style={{ padding: '6px 8px' }}><span className="badge badge-m">{s.profileId || '?'}</span></td>
                <td style={{ padding: '6px 8px', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, whiteSpace: 'nowrap' }}>{s.label || '—'}</td>
                <td style={{ padding: '6px 8px', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>{formatDuration(s)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>{s.uniquePageCount}</td>
                <td style={{ padding: '6px 8px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {(s.extensionSlugs || []).slice(0, 5).map(e => <span key={e} className="pill pill-b" style={{ fontSize: 9, padding: '1px 5px' }}>{friendlyExtName(e)}</span>)}
                    {(s.extensionSlugs || []).length > 5 && <span className="pill" style={{ fontSize: 9, padding: '1px 5px', color: '#8b949e' }}>+{s.extensionSlugs.length - 5}</span>}
                  </div>
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {(s.flowsRun || []).map(f => <span key={f} className="pill pill-g" style={{ fontSize: 9, padding: '1px 5px' }}>{f}</span>)}
                  </div>
                </td>
                <td style={{ padding: '6px 8px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, whiteSpace: 'nowrap' }}>
                  {formatTraffic(s)}
                </td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                  {q ? <span style={{ color: '#22c55e', fontSize: 10, fontWeight: 600 }}>✓ PASS</span> : <span style={{ color: '#ef4444', fontSize: 10, fontWeight: 600 }}>✗ FAIL</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
      <div className="sessions-cards">
        {filtered.slice(0, 500).map((s, i) => {
          const q = s.metMinDuration && s.metMinUniquePages
          return <article className="session-card" key={s.runId || `${s.recordedAt}-${i}`}>
            <div className="session-card-head">
              <span className="session-card-time">{new Date(s.recordedAt).toLocaleTimeString()}</span>
              <span className={q ? 'session-quality pass' : 'session-quality fail'}>{q ? 'PASS' : 'FAIL'}</span>
            </div>
            <div className="session-card-title">{s.label || s.targetDomain || 'Untitled session'}</div>
            <div className="session-card-domain">{s.targetDomain || 'No target domain'}</div>
            <div className="session-card-meta">
              <span>{s.profileId || '?'}</span><span>{s.runner || '?'}</span><span>{formatDuration(s)}</span><span>{s.uniquePageCount} pages</span><span>{formatTraffic(s)}</span>
            </div>
            {!!(s.extensionSlugs || []).length && <div className="session-card-pills">{s.extensionSlugs.slice(0, 4).map(ext => <span className="pill pill-b" key={ext}>{friendlyExtName(ext)}</span>)}</div>}
            {!!(s.flowsRun || []).length && <div className="session-card-pills">{s.flowsRun.slice(0, 3).map(flow => <span className="pill pill-g" key={flow}>{flow}</span>)}</div>}
          </article>
        })}
        {filtered.length === 0 && <div className="sessions-empty">No sessions match these filters.</div>}
      </div>
    </div>
  )
}
