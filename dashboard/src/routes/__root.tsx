import { Outlet, createRootRoute, Link } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
export const Route = createRootRoute({
  component: RootLayout,
})

const nav = [
  { to: '/', icon: '📊', label: 'Overview' },
  { to: '/sessions', icon: '🖥', label: 'Sessions' },
  { to: '/extensions', icon: '🔌', label: 'Extensions' },
  { to: '/network', icon: '🌐', label: 'Network' },
  { to: '/similarweb', icon: '📈', label: 'Similarweb' },
]

function RootLayout() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0b0d11' }}>
      {/* Sidebar */}
      <div style={{
        width: 48, background: '#11151c', borderRight: '1px solid #2a2f3a',
        display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', gap: 4, flexShrink: 0, zIndex: 10
      }}>
        <Link to="/" title="Home" style={{
          width: 32, height: 32, borderRadius: 6,
          background: 'linear-gradient(135deg, #f4c430, #f59e0b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, color: '#000', marginBottom: 12, textDecoration: 'none'
        }}>M</Link>
        {nav.map(n => (
          <Link key={n.to} to={n.to} title={n.label}
            style={{ textDecoration: 'none', color: 'inherit' }}
            activeProps={{ style: { background: '#1e2330', color: '#f4c430' } }}
            inactiveProps={{ style: { background: 'transparent', color: '#484f58' } }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 6, display: 'flex',
              alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16,
            }} onMouseEnter={e => { e.currentTarget.style.background = '#181c24'; e.currentTarget.style.color = '#8b949e' }}
               onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#484f58' }}
            >{n.icon}</div>
          </Link>
        ))}
        <div style={{ flex: 1 }} />
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          height: 40, background: '#11151c', borderBottom: '1px solid #2a2f3a',
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0
        }}>
          <h1 style={{ fontSize: 13, fontWeight: 600, color: '#c9d1d9' }}>Marketingbot</h1>
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
