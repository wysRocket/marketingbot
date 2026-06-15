import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { getDashboardData } from '#/lib/api'

export const Route = createFileRoute('/extensions')({
  component: ExtensionsPage,
})

interface ExtEvent {
  timestamp: number; type: string; url: string; method: string;
  matchedDomain: string; extensionId?: string;
  requestBody?: string; responseBody?: string;
}

interface DashboardData {
  extEvents: ExtEvent[]
  fingerprint: string
}

function ExtensionsPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [lastFp, setLastFp] = useState('')
  const [domainFilter, setDomainFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  

  const fetchData = useCallback(async () => {
    try {
      const d = await getDashboardData()
      if (d.fingerprint !== lastFp) {
        setLastFp(d.fingerprint)
        setData(d as DashboardData)
      }
    } catch (e) { console.error(e) }
  }, [lastFp, getFn])

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 5000); return () => clearInterval(iv) }, [fetchData])

  const domains = useMemo(() => [...new Set((data?.extEvents || []).map(e => e.matchedDomain))].sort(), [data])
  const methods = useMemo(() => [...new Set((data?.extEvents || []).map(e => e.method))].sort(), [data])

  const filtered = useMemo(() => {
    if (!data) return []
    let list = [...data.extEvents]
    if (domainFilter) list = list.filter(e => e.matchedDomain.includes(domainFilter))
    if (methodFilter) list = list.filter(e => e.method === methodFilter)
    return list
  }, [data, domainFilter, methodFilter])

  if (!data) return <div style={{ padding: 20, color: '#484f58' }}>Loading...</div>

  return (
    <div style={{ background: '#11151c', border: '1px solid #2a2f3a', borderRadius: 6 }}>
      <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 10, color: '#484f58', textTransform: 'uppercase' }}>Domain</label>
        <select value={domainFilter} onChange={e => setDomainFilter(e.target.value)} style={{ background: '#181c24', border: '1px solid #2a2f3a', color: '#c9d1d9', padding: '4px 8px', borderRadius: 4, fontSize: 11 }}>
          <option value="">All</option>
          {domains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <label style={{ fontSize: 10, color: '#484f58', textTransform: 'uppercase' }}>Method</label>
        <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)} style={{ background: '#181c24', border: '1px solid #2a2f3a', color: '#c9d1d9', padding: '4px 8px', borderRadius: 4, fontSize: 11 }}>
          <option value="">All</option>
          {methods.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#484f58' }}>{filtered.length} events</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ borderBottom: '1px solid #2a2f3a' }}>
          {['Time', 'Domain', 'Method', 'URL', 'Request Body', 'Response Body'].map(h => (
            <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.06em', color: '#484f58', fontWeight: 600 }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {filtered.slice(0, 500).map((e, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(42,47,58,.4)' }}>
              <td style={{ padding: '6px 10px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{new Date(e.timestamp).toLocaleTimeString()}</td>
              <td style={{ padding: '6px 10px' }}><span className="badge badge-b">{e.matchedDomain}</span></td>
              <td style={{ padding: '6px 10px' }}><span className="badge badge-m">{e.method}</span></td>
              <td style={{ padding: '6px 10px', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#8b949e' }}>{e.url}</td>
              <td style={{ padding: '6px 10px', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#484f58' }}>{(e.requestBody || '—').slice(0, 60)}</td>
              <td style={{ padding: '6px 10px', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#484f58' }}>{(e.responseBody || '—').slice(0, 60)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
