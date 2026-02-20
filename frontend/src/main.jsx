import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', gap: 16,
          background: '#08080f', color: '#ff4d6d', fontFamily: 'monospace',
          padding: 32, textAlign: 'center',
        }}>
          <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p style={{ fontSize: 18, fontWeight: 700 }}>RIFT — Render Error</p>
          <p style={{ fontSize: 13, color: '#ff8c9a', maxWidth: 600, lineHeight: 1.6 }}>{String(this.state.err)}</p>
          <button
            onClick={() => { this.setState({ err: null }); window.location.reload(); }}
            style={{ marginTop: 8, padding: '8px 20px', borderRadius: 6, border: '1px solid #ff4d6d', background: 'transparent', color: '#ff4d6d', cursor: 'pointer', fontSize: 13 }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
