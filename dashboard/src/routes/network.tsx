import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { getDashboardData } from '#/lib/api'

export const Route = createFileRoute('/network')({
  component: NetworkPage,
})

interface ExtEvent {
  url: string; method: string; matchedDomain: string; requestBody?: string;
}

interface DashboardData {
  extEvents: ExtEvent[]
  fingerprint: string
}

function NetworkPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [lastFp, setLastFp] = useState('')
  const getFn = useServerFn(getDashboardData)

  const fetchData = useCallback(async () => {
    try {
      const d = await getFn()
      if (d.fingerprint !== lastFp) { setLastFp(d.fingerprint); setData(d as DashboardData) }
    } catch (e) { console.error(e) }
  }, [lastFp, getFn])

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 5000); return () => clearInterval(iv) }, [fetchData])

  const domainMap = useMemo(() => {
    const map = new Map<string, { count: number; endpoints: Map<string, { count: number; body: string }> }>()
    ;(data?.extEvents || []).forEach(e => {
      const d = e.matchedDomain
      if (!map.has(d)) map.set(d, { count: 0, endpoints: new Map() })
      const dm = map.get(d)!
      dm.count++
      let key = '?'
      try { key = e.method + ' ' + new URL(e.url).pathname } catch {}
      let ep = dm.endpoints.get(key)
      if (!ep) { ep = { count: 0, body: '' }; dm.endpoints.set(key, ep) }
      ep.count++
      if (!ep.body && e.requestBody) ep.body = e.requestBody.slice(0, 150)
    })
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count)
  }, [data])

  if (!data) return <div style={{ padding: 20, color: '#484f58' }}>Loading...</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 12 }}>
      {domainMap.map(([domain, dd]) => (
        <div key={domain} style={{ background: '#11151c', border: '1px solid #2a2f3a', borderRadius: 6 }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #2a2f3a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 12, fontWeight: 600, color: '#60a5fa', fontFamily: 'JetBrains Mono, monospace' }}>{domain}</h2>
            <span className="badge badge-b">{dd.count} events</span>
          </div>
          <div style={{ padding: 12, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {[...dd.endpoints.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 15).map(([k, v]) => (
              <div key={k} style={{ background: '#181c24', padding: '4px 8px', borderRadius: 4, fontSize: 10, border: '1px solid #2a2f3a' }}>
                <span style={{ color: '#f4c430', fontFamily: 'JetBrains Mono, monospace' }}>{k}</span>
                <span style={{ color: '#484f58', marginLeft: 4 }}>×{v.count}</span>
                {v.body && <div style={{ marginTop: 2, color: '#484f58', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis' }} title={v.body}>{v.body.slice(0, 60)}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
      {domainMap.length === 0 && <div style={{ gridColumn: 'span 12', textAlign: 'center', color: '#484f58', padding: 40 }}>No extension network events</div>}
    </div>
  )
}
