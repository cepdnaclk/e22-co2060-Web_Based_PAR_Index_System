// frontend/src/components/ErrorBoundary.jsx
// REQUIREMENT 12: React Error Boundaries — clinical context requires explicit error UI,
// never a silent white screen.

import React from 'react'

/**
 * ErrorBoundary — wraps individual high-risk components.
 *
 * REQUIREMENT 12:
 *   - Catches JS errors and shows a clinical-appropriate fallback
 *   - Reports error to /api/v1/admin/frontend-error (no auth required)
 *   - "Clinical data is safe. Please refresh." messaging
 *
 * Usage (wrap EACH component individually — never wrap entire App):
 *   <ErrorBoundary><STLViewer /></ErrorBoundary>
 *   <ErrorBoundary><LandmarkPanel /></ErrorBoundary>
 *   <ErrorBoundary><MLStatusPanel /></ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('UI component error:', info.componentStack)

    // Report to backend — no auth header needed (endpoint is public)
    fetch('/api/v1/cases/admin/frontend-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack:   info.componentStack,
      }),
    }).catch(() => {
      // Silently ignore — don't cause secondary errors during error handling
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          border: '1.5px solid #fca5a5',
          borderRadius: 10,
          background: '#fef2f2',
          padding: '20px 24px',
          margin: '8px 0',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <h2 style={{ color: '#dc2626', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            ⚠️ Something went wrong loading this section
          </h2>
          <p style={{ color: '#7f1d1d', fontSize: 13, marginBottom: 12 }}>
            Clinical data is safe. Please refresh the page to continue.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#dc2626', color: '#fff', border: 'none',
              borderRadius: 6, padding: '8px 16px', cursor: 'pointer',
              fontWeight: 600, fontSize: 13, marginBottom: 12,
            }}
          >
            🔄 Refresh Page
          </button>
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 12, color: '#6b7280', cursor: 'pointer' }}>
              Technical details
            </summary>
            <pre style={{
              fontSize: 11, color: '#6b7280', marginTop: 8, whiteSpace: 'pre-wrap',
              background: '#f9fafb', padding: 10, borderRadius: 6, overflowX: 'auto',
            }}>
              {this.state.error?.message}
            </pre>
          </details>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
