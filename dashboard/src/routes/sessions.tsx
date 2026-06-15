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
  }, [lastFp, getFn])

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 5000); return () => clearInterval(iv) }, [fetchData])

  const profiles = useMemo(() => [...new Set((data?.sessions || []).map(s => s.profileId))].sort(), [data])

  const filtered = useMemo(() => {
    if (!data) return []
    let list = [...data.sessions]
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

  if (!data) return <div style={{ padding: 20, color: '#484f58' }}>Loading...</div>

  return (
    <div style={{ background: '#11151c', border: '1px solid #2a2f3a', borderRadius: 6 }}>
      <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 10, color: '#484f58', textTransform: 'uppercase' }}>Profile</label>
        <select value={profileFilter} onChange={e => setProfileFilter(e.target.value)} style={{ background: '#181c24', border: '1px solid #2a2f3a', color: '#c9d1d9', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
          <option value="">All</option>
          {profiles.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <label style={{ fontSize: 10, color: '#484f58', textTransform: 'uppercase' }}>Domain</label>
        <input value={domainFilter} onChange={e => setDomainFilter(e.target.value)} placeholder="Filter…" style={{ background: '#181c24', border: '1px solid #2a2f3a', color: '#c9d1d9', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', width: 120 }} />
        <label style={{ fontSize: 10, color: '#484f58', textTransform: 'uppercase' }}>Sort</label>
        <select value={sortField + '_' + sortDir} onChange={e => { const [f, d] = e.target.value.split('_'); setSortField(f as 't' | 'd'); setSortDir(d as 'd' | 'a') }} style={{ background: '#181c24', border: '1px solid #2a2f3a', color: '#c9d1d9', padding: '4px 8px', borderRadius: 4, fontSize: 11 }}>
          <option value="t_d">Newest</option><option value="t_a">Oldest</option><option value="d_d">Longest</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#484f58' }}>{filtered.length} sessions</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ borderBottom: '1px solid #2a2f3a' }}>
          {['Time', 'Runner', 'Profile', 'Label', 'Domain', 'Duration', 'Pages', 'Extensions', 'Flows', 'Traffic', 'Quality'].map(h => (
            <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.06em', color: '#484f58', fontWeight: 600 }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {filtered.slice(0, 500).map((s, i) => {
            const q = s.metMinDuration && s.metMinUniquePages
            return (
              <tr key={i} style={{ borderBottom: '1px solid rgba(42,47,58,.4)', cursor: 'pointer' }}
                onClick={() => { const el = document.getElementById('sess-detail-' + i); if (el) el.style.display = el.style.display === 'none' ? 'table-row' : 'none' }}>
                <td style={{ padding: '6px 10px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{new Date(s.recordedAt).toLocaleTimeString()}</td>
                <td style={{ padding: '6px 10px' }}><span className="badge badge-b">{s.runner || '?'}</span></td>
                <td style={{ padding: '6px 10px' }}><span className="badge badge-m">{s.profileId || '?'}</span></td>
                <td style={{ padding: '6px 10px', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{s.label || '—'}</td>
                <td style={{ padding: '6px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{s.targetDomain || '—'}</td>
                <td style={{ padding: '6px 10px', fontFamily: 'JetBrains Mono, monospace' }}>{s.elapsedMs < 60000 ? (s.elapsedMs / 1000).toFixed(1) + 's' : Math.floor(s.elapsedMs / 60000) + 'm'}</td>
                <td style={{ padding: '6px 10px' }}>{s.uniquePageCount}</td>
                <td style={{ padding: '6px 10px' }}>{(s.extensionSlugs || []).slice(0, 4).map(e => <span className="pill pill-b">{e}</span>)}</td>
                <td style={{ padding: '6px 10px' }}>{(s.flowsRun || []).slice(0, 3).map(f => <span className="pill pill-g">{f}</span>)}</td>
                <td style={{ padding: '6px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
                  {s.trafficBytesTotal < 1048576 ? (s.trafficBytesTotal / 1024).toFixed(0) + 'KB' : (s.trafficBytesTotal / 1048576).toFixed(1) + 'MB'}
                </td>
                <td style={{ padding: '6px 10px' }}>
                  {q ? <span style={{ color: '#22c55e', fontSize: 10, fontWeight: 600 }}>✓ PASS</span> : <span style={{ color: '#ef4444', fontSize: 10, fontWeight: 600 }}>✗ FAIL</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
