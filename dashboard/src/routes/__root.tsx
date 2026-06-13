import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { useEffect, useState } from 'react'
import '../styles.css'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const [tab, setTab] = useState('overview')

  const nav = [
    { id: 'overview', icon: '📊', label: 'Overview' },
    { id: 'sessions', icon: '🖥', label: 'Sessions' },
    { id: 'extensions', icon: '🔌', label: 'Extensions' },
    { id: 'network', icon: '🌐', label: 'Network' },
    { id: 'similarweb', icon: '📈', label: 'Similarweb' },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{
        width: 48, background: '#11151c', borderRight: '1px solid #2a2f3a',
        display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', gap: 4, flexShrink: 0
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 6,
          background: 'linear-gradient(135deg, #f4c430, #f59e0b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, color: '#000', marginBottom: 12, cursor: 'pointer'
        }} onClick={() => setTab('overview')}>M</div>
        {nav.map(n => (
          <div key={n.id} onClick={() => setTab(n.id)} title={n.label} style={{
            width: 36, height: 36, borderRadius: 6, display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            fontSize: 16, background: tab === n.id ? '#1e2330' : 'transparent',
            color: tab === n.id ? '#f4c430' : '#484f58'
          }}>{n.icon}</div>
        ))}
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          height: 40, background: '#11151c', borderBottom: '1px solid #2a2f3a',
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0
        }}>
          <h1 style={{ fontSize: 13, fontWeight: 600 }}>Marketingbot</h1>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: '#484f58' }} id="last-update">—</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          <Outlet />
        </div>
      </div>

      <TanStackRouterDevtools position="bottom-right" />
    </div>
  )
}
