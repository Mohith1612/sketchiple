import { useEffect, useState } from 'react'

interface WelcomeScreenProps {
  onDismiss: () => void
}

const tools = [
  { icon: '↖', name: 'Select', desc: 'Move, resize & group shapes' },
  { icon: '▭', name: 'Rect', desc: 'Draw rectangles and boxes' },
  { icon: '◯', name: 'Ellipse', desc: 'Draw circles and ovals' },
  { icon: '→', name: 'Arrow', desc: 'Connect shapes with arrows' },
  { icon: 'T', name: 'Text', desc: 'Add and edit text labels' },
  { icon: '✏', name: 'Pen', desc: 'Freehand drawing strokes' },
]

const shortcuts = [
  { keys: 'Ctrl+Z / Ctrl+Y', action: 'Undo / Redo' },
  { keys: 'Space (hold)', action: 'Pan canvas temporarily' },
  { keys: 'Ctrl+Scroll', action: 'Zoom in / out' },
  { keys: 'Delete', action: 'Remove selected shapes' },
  { keys: 'Ctrl+G', action: 'Group selected shapes' },
]

export function WelcomeScreen({ onDismiss }: WelcomeScreenProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger fade-in on mount
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // pointer-events: none lets canvas events pass through so drawing starts immediately
        pointerEvents: 'none',
        background: visible ? 'rgba(15,15,20,0.5)' : 'rgba(15,15,20,0)',
        backdropFilter: visible ? 'blur(2px)' : 'none',
        transition: 'background 220ms ease, backdrop-filter 220ms ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          pointerEvents: 'auto',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
          padding: '32px 36px',
          width: '100%',
          maxWidth: 480,
          margin: '0 16px',
          fontFamily: 'system-ui, sans-serif',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 220ms ease, transform 220ms ease',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.5px' }}>
            Sketchiple
          </div>
          <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
            A real-time collaborative drawing canvas
          </div>
        </div>

        {/* Tool grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            marginBottom: 20,
          }}
        >
          {tools.map((t) => (
            <div
              key={t.name}
              style={{
                background: '#f8fafc',
                borderRadius: 8,
                padding: '10px 12px',
                borderLeft: '3px solid #6366f1',
              }}
            >
              <div style={{ fontSize: 16, marginBottom: 2 }}>
                <span style={{ marginRight: 4 }}>{t.icon}</span>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{t.name}</span>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>{t.desc}</div>
            </div>
          ))}
        </div>

        {/* Shortcuts */}
        <div
          style={{
            background: '#f8fafc',
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Shortcuts
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {shortcuts.map((s) => (
              <div key={s.keys} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <code
                  style={{
                    fontSize: 11,
                    background: '#e2e8f0',
                    color: '#334155',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontFamily: 'monospace',
                  }}
                >
                  {s.keys}
                </code>
                <span style={{ fontSize: 12, color: '#475569' }}>{s.action}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
            Click anywhere on the canvas to start drawing →
          </div>
          <button
            onClick={onDismiss}
            style={{
              background: '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '9px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  )
}
