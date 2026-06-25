import { useState, useEffect, useCallback } from 'react'
import { getModeConfig, setProfileMode, type ModeConfig } from '#/lib/api'

const PROFILE_IDS = ['fp-00', 'fp-01', 'fp-02', 'fp-03']

export function ModeSelector() {
  const [config, setConfig] = useState<ModeConfig | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchConfig = useCallback(async () => {
    try { setConfig(await getModeConfig()) } catch {}
  }, [])

  useEffect(() => { fetchConfig(); const iv = setInterval(fetchConfig, 5000); return () => clearInterval(iv) }, [fetchConfig])

  const handleToggle = async (profileId: string, currentIsCbm: boolean) => {
    setLoading(true)
    try {
      await setProfileMode(profileId, currentIsCbm ? 'patchright' : 'cbm', config?.cbmUrl || undefined)
      await fetchConfig()
    } finally { setLoading(false) }
  }

  if (!config) return <div style={{ padding: 10, fontSize: 11, color: '#6b7280' }}>Loading modes…</div>

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {PROFILE_IDS.map(id => {
        const isCbm = config.cbmProfiles.includes(id)
        return (
          <button key={id} onClick={() => handleToggle(id, isCbm)} disabled={loading} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 6,
            border: `1px solid ${isCbm ? '#a78bfa' : '#2a2f3a'}`,
            background: isCbm ? 'rgba(167,139,250,.1)' : '#11151c',
            color: isCbm ? '#a78bfa' : '#8b949e',
            fontSize: 10, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: isCbm ? '#a78bfa' : '#374151',
            }} />
            {id}
            <span style={{ fontSize: 8, opacity: .7, marginLeft: 2 }}>
              {isCbm ? 'CBM' : 'PR'}
            </span>
          </button>
        )
      })}
      {config.cbmUrl && (
        <span style={{
          padding: '5px 10px', borderRadius: 6,
          background: '#0b0d11', border: '1px solid #1e2330',
          fontSize: 9, color: '#6b7280', fontFamily: 'JetBrains Mono, monospace',
        }}>
          CBM: …{config.cbmUrl.slice(-30)}
        </span>
      )}
    </div>
  )
}
