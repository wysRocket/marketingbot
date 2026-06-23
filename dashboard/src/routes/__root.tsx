import { Outlet, createRootRoute, Link, useNavigate } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { useEffect, useState, useCallback } from 'react'

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

interface AuthState {
  authenticated: boolean
  user: { login: string } | null
  oauthEnabled: boolean
}

function RootLayout() {
  const [auth, setAuth] = useState<AuthState | null>(null)

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status')
      if (res.ok) setAuth(await res.json())
      else setAuth({ authenticated: false, user: null, oauthEnabled: false })
    } catch {
      setAuth({ authenticated: false, user: null, oauthEnabled: false })
    }
  }, [])

  useEffect(() => { checkAuth() }, [checkAuth])

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
            inactiveProps={{ style: { background: 'transparent', color: '#8b949e' } }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 6, display: 'flex',
              alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16,
            }} onMouseEnter={e => { e.currentTarget.style.background = '#181c24'; e.currentTarget.style.color = '#c9d1d9' }}
               onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8b949e' }}
            >{n.icon}</div>
          </Link>
        ))}
        <a href="/hermes/" title="Hermes Dashboard" style={{ textDecoration: 'none', color: '#8b949e' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 6, display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16,
          }} onMouseEnter={e => { e.currentTarget.style.background = '#181c24'; e.currentTarget.style.color = '#c9d1d9' }}
             onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8b949e' }}
          >⚕</div>
        </a>
        <div style={{ flex: 1 }} />
        {/* Auth section */}
        {auth?.authenticated && auth.user && (
          <div style={{ textAlign: 'center', padding: '4px 0', marginBottom: 4 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: '#238636',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff', margin: '0 auto 4px',
              fontFamily: 'monospace',
            }}>{auth.user.login[0].toUpperCase()}</div>
            <a href="/api/auth/logout" title="Sign out" style={{
              fontSize: 9, color: '#8b949e', textDecoration: 'none',
            }}>sign out</a>
          </div>
        )}
        {!auth?.authenticated && auth?.oauthEnabled && (
          <a href="/api/auth/login" title="Sign in" style={{
            width: 36, height: 36, borderRadius: 6, display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16,
            background: '#238636', color: '#fff', marginBottom: 4, textDecoration: 'none',
          }}>🔑</a>
        )}
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          height: 40, background: '#11151c', borderBottom: '1px solid #2a2f3a',
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0
        }}>
          <h1 style={{ fontSize: 13, fontWeight: 600, color: '#c9d1d9' }}>Marketingbot</h1>
          <a href="/hermes/" style={{
            display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 10px',
            borderRadius: 6, border: '1px solid #3a3347', background: '#1a1823',
            color: '#f4c430', fontSize: 11, fontWeight: 700, textDecoration: 'none',
          }} title="Open Hermes Dashboard">⚕ Hermes Dashboard</a>
          <div style={{ flex: 1 }} />
          {auth?.authenticated && auth.user && (
            <span style={{ fontSize: 11, color: '#238636', fontWeight: 600 }}>
              @{auth.user.login}
            </span>
          )}
          <span style={{ fontSize: 11, color: '#8b949e' }} id="last-update">—</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          <Outlet />
        </div>
      </div>

      <TanStackRouterDevtools position="bottom-right" />
    </div>
  )
}
