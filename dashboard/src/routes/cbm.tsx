import { createFileRoute } from '@tanstack/react-router'
import { CbmPanel } from '#/components/CbmPanel'

export const Route = createFileRoute('/cbm')({
  component: CbmPage,
})

function CbmPage() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
      <div style={{ gridColumn: 'span 12' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8b949e', marginBottom: 4 }}>Controls</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>CloakBrowser Manager</div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Create, launch, and manage stealth browser profiles</div>
      </div>
      <div style={{ gridColumn: 'span 12' }}>
        <CbmPanel />
      </div>
    </div>
  )
}
