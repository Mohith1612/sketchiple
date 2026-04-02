import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  override render(): ReactNode {
    const { error } = this.state
    if (error) {
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f172a',
            color: '#f1f5f9',
            fontFamily: 'system-ui, sans-serif',
            gap: 12,
            padding: 24,
          }}
        >
          <div style={{ fontSize: 32 }}>⚠</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Something went wrong</div>
          <pre
            style={{
              maxWidth: 600,
              overflowX: 'auto',
              background: '#1e293b',
              padding: '12px 16px',
              borderRadius: 6,
              fontSize: 12,
              color: '#f87171',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {error.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              border: 'none',
              background: '#6366f1',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
