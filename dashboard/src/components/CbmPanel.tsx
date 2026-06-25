import { useState, useEffect, useCallback } from 'react'
import { cbmGetStatus, cbmGetProfiles, cbmLaunchProfile, cbmStopProfile, cbmCreateProfile, type CbmProfile, type CbmStatus } from '#/lib/api'

export function CbmPanel() {
  const [status, setStatus] = useState<CbmStatus | null>(null)
  const [profiles, setProfiles] = useState<CbmProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSeed, setNewSeed] = useState(Math.floor(Math.random() * 99999))
  const [showCreate, setShowCreate] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([cbmGetStatus(), cbmGetProfiles()])
      setStatus(s)
      setProfiles(p)
    } catch (e) { console.error('CBM fetch error:', e) }
  }, [])

  useEffect(() => {
    fetchData()
    const iv = setInterval(fetchData, 5000)
    return () => clearInterval(iv)
  }, [fetchData])

  const handleLaunch = async (id: string) => {
    setLoading(true)
    try { await cbmLaunchProfile(id); await fetchData() }
    finally { setLoading(false) }
  }

  const handleStop = async (id: string) => {
    setLoading(true)
    try { await cbmStopProfile(id); await fetchData() }
    finally { setLoading(false) }
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setLoading(true)
    try {
      await cbmCreateProfile(newName.trim(), newSeed)
      setNewName('')
      setNewSeed(Math.floor(Math.random() * 99999))
      setShowCreate(false)
      await fetchData()
    } finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
      {/* Header */}
      <div style={{ gridColumn: 'span 12', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8b949e' }}>CloakBrowser Manager</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
            {status ? `${status.running_count}/${status.profiles_total} running` : '—'}
          </div>
          {status && (
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
              Binary: {status.binary_version}
            </div>
          )}
        </div>
        <button onClick={() => setShowCreate(!showCreate)} style={{
          padding: '6px 12px', borderRadius: 6, border: '1px solid #2a2f3a',
          background: showCreate ? '#1e2330' : '#11151c', color: '#c9d1d9',
          fontSize: 11, cursor: 'pointer', fontWeight: 600,
        }}>
          + New Profile
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ gridColumn: 'span 12', background: '#11151c', border: '1px solid #2a2f3a', borderRadius: 6, padding: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Profile name (e.g. bot-p3)"
              style={{ flex: 1, padding: '6px 10px', borderRadius: 4, border: '1px solid #2a2f3a', background: '#0b0d11', color: '#c9d1d9', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }} />
            <input value={newSeed} onChange={e => setNewSeed(Number(e.target.value))} type="number" placeholder="Seed"
              style={{ width: 100, padding: '6px 10px', borderRadius: 4, border: '1px solid #2a2f3a', background: '#0b0d11', color: '#c9d1d9', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }} />
            <button onClick={handleCreate} disabled={loading || !newName.trim()} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', background: '#238636', color: '#fff',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: loading || !newName.trim() ? 0.5 : 1,
            }}>Create</button>
          </div>
        </div>
      )}

      {/* Profile list */}
      {profiles.length === 0 ? (
        <div style={{ gridColumn: 'span 12', padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 12 }}>
          No CBM profiles yet. Create one above.
        </div>
      ) : (
        profiles.map(p => (
          <div key={p.id} style={{ gridColumn: 'span 6', background: '#11151c', border: '1px solid #2a2f3a', borderRadius: 6, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 10, color: '#6b7280', fontFamily: 'JetBrains Mono, monospace' }}>{p.id}</div>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
                padding: '2px 8px', borderRadius: 4,
                background: p.status === 'running' ? 'rgba(34,197,94,.15)' : 'rgba(107,114,128,.15)',
                color: p.status === 'running' ? '#22c55e' : '#6b7280',
              }}>
                {p.status || 'stopped'}
              </span>
            </div>
            <div style={{ fontSize: 10, color: '#8b949e', marginBottom: 8 }}>
              Seed: {p.fingerprint_seed ?? '—'} {p.auto_launch ? '• auto-launch' : ''}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {p.status === 'running' ? (
                <button onClick={() => handleStop(p.id)} disabled={loading} style={{
                  flex: 1, padding: '5px 10px', borderRadius: 4, border: '1px solid #ef4444',
                  background: 'transparent', color: '#ef4444', fontSize: 10, fontWeight: 600, cursor: 'pointer',
                }}>■ Stop</button>
              ) : (
                <button onClick={() => handleLaunch(p.id)} disabled={loading} style={{
                  flex: 1, padding: '5px 10px', borderRadius: 4, border: '1px solid #22c55e',
                  background: 'transparent', color: '#22c55e', fontSize: 10, fontWeight: 600, cursor: 'pointer',
                }}>▶ Launch</button>
              )}
              {p.status === 'running' && p.cdp_url && (
                <a href={`https://cloakbrowser-production-a859.up.railway.app${p.cdp_url}`} target="_blank" rel="noopener" style={{
                  padding: '5px 10px', borderRadius: 4, border: '1px solid #2a2f3a',
                  background: '#0b0d11', color: '#60a5fa', fontSize: 10, fontWeight: 600,
                  textDecoration: 'none',
                }}>CDP ↗</a>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
