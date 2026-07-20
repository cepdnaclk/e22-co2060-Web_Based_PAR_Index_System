// frontend/src/components/MLStatusPanel.jsx
// REQUIREMENT 14: ML Status Panel embedded in AdminPanel
// Polls /api/v1/ml/status, shows training controls with validation,
// confidence color coding, and experimental disclaimer.

import { useEffect, useState, useRef } from 'react'
import { mlApi } from '../api/api'

/**
 * MLStatusPanel — embedded in AdminPanel's ML tab.
 *
 * REQUIREMENT 14:
 *   - On mount: fetch /api/v1/ml/status
 *   - Train button: validate version non-empty and epochs 10–500 before enabling
 *   - After Train click: disable button, show "Training in background..."
 *   - Poll /api/v1/ml/status every 10 seconds while status is TRAINING
 *   - On COMPLETED or FAILED: show result banner, re-enable button
 *   - Confidence color coding: red < 100, orange 100–499, green 500+
 *   - Disclaimer: "ML predictions are experimental. Never replace clinical judgment."
 */
export default function MLStatusPanel() {
  const [status, setStatus]           = useState(null)
  const [loading, setLoading]         = useState(true)
  const [modelVersion, setModelVersion] = useState('v1.0')
  const [epochs, setEpochs]           = useState(50)
  const [training, setTraining]       = useState(false)
  const [resultBanner, setResultBanner] = useState(null) // { type: 'success'|'error', msg }
  const pollRef = useRef(null)

  // ── Load initial status ────────────────────────────────────────────
  useEffect(() => {
    fetchStatus()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, []) // eslint-disable-line

  async function fetchStatus() {
    try {
      const { data } = await mlApi.status()
      setStatus(data)

      // If training is in progress, start polling
      if (data.currentStatus === 'TRAINING') {
        setTraining(true)
        startPolling()
      } else {
        setTraining(false)
        stopPolling()
      }
    } catch (err) {
      console.error('Failed to fetch ML status:', err)
    } finally {
      setLoading(false)
    }
  }

  function startPolling() {
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await mlApi.status()
        setStatus(data)

        if (data.currentStatus === 'COMPLETED') {
          setTraining(false)
          stopPolling()
          setResultBanner({
            type: 'success',
            msg: `Training completed! Version: ${data.latestVersion} | Best accuracy: ${data.bestAccuracy}%`
          })
        } else if (data.currentStatus === 'FAILED') {
          setTraining(false)
          stopPolling()
          setResultBanner({ type: 'error', msg: 'Training failed. Check server logs for details.' })
        }
      } catch (_) {}
    }, 10_000)
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  async function handleTrain() {
    if (!modelVersion.trim()) {
      alert('Model version is required.')
      return
    }
    if (epochs < 10 || epochs > 500) {
      alert('Epochs must be between 10 and 500.')
      return
    }

    setTraining(true)
    setResultBanner(null)

    try {
      await mlApi.train({ modelVersion: modelVersion.trim(), epochs })
      setResultBanner(null)
      startPolling()
    } catch (err) {
      setTraining(false)
      const msg = err.response?.data?.message || 'Failed to start training.'
      setResultBanner({ type: 'error', msg })
    }
  }

  // ── Confidence color coding ────────────────────────────────────────
  function confidenceColor(datasetSize) {
    if (datasetSize < 100)  return { color: '#dc2626', bg: '#fef2f2', label: 'Low' }
    if (datasetSize < 500)  return { color: '#d97706', bg: '#fffbeb', label: 'Medium' }
    return { color: '#16a34a', bg: '#f0fdf4', label: 'High' }
  }

  const conf = status ? confidenceColor(status.approvedDatasets) : null

  // ── Validation ────────────────────────────────────────────────────
  const canTrain = !training && modelVersion.trim().length > 0 && epochs >= 10 && epochs <= 500

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
        <div className="spinner" style={{ margin: '0 auto 8px' }} />
        Loading ML status…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Disclaimer — always visible */}
      <div style={{
        background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8,
        padding: '10px 16px', fontSize: 13, color: '#92400e',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        ⚠️ <strong>ML predictions are experimental. Never replace clinical judgment.</strong>
      </div>

      {/* Result banner */}
      {resultBanner && (
        <div style={{
          background: resultBanner.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${resultBanner.type === 'success' ? '#86efac' : '#fca5a5'}`,
          borderRadius: 8, padding: '10px 16px', fontSize: 13,
          color: resultBanner.type === 'success' ? '#166534' : '#dc2626',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{resultBanner.type === 'success' ? '✅' : '❌'} {resultBanner.msg}</span>
          <button onClick={() => setResultBanner(null)} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 16,
          }}>✕</button>
        </div>
      )}

      {/* Status overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {[
          { label: 'Current Status',      value: status?.currentStatus ?? 'N/A' },
          { label: 'Latest Version',      value: status?.latestVersion ?? 'N/A' },
          { label: 'Approved Datasets',   value: status?.approvedDatasets ?? 0 },
          { label: 'Best Accuracy',       value: status?.bestAccuracy != null ? `${status.bestAccuracy}%` : 'N/A' },
          { label: 'Total Training Runs', value: status?.totalRuns ?? 0 },
        ].map(item => (
          <div key={item.label} style={{
            background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 10, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b' }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Confidence indicator */}
      {conf && status && (
        <div style={{
          background: conf.bg, border: `1px solid ${conf.color}`,
          borderRadius: 8, padding: '10px 16px', fontSize: 13,
          color: conf.color,
        }}>
          <strong>Dataset Confidence: {conf.label}</strong>
          {' '}— {status.approvedDatasets} approved datasets.
          {status.approvedDatasets < 100 && ' At least 100 approved datasets are recommended for reliable predictions.'}
          {status.approvedDatasets >= 100 && status.approvedDatasets < 500 && ' 500+ datasets will significantly improve accuracy.'}
          {status.approvedDatasets >= 500 && ' Sufficient data for high-confidence predictions.'}
        </div>
      )}

      {/* Training in progress */}
      {training && (
        <div style={{
          background: '#eff6ff', border: '1px solid #93c5fd',
          borderRadius: 8, padding: '14px 16px', fontSize: 13, color: '#1e40af',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div className="spinner" style={{ width: 16, height: 16 }} />
          <div>
            <div style={{ fontWeight: 600 }}>Training in background…</div>
            <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>
              Polling status every 10 seconds. You may leave this page.
            </div>
          </div>
        </div>
      )}

      {/* Training controls */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20,
      }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14, color: '#1e293b' }}>
          🚀 Start New Training Run
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>
              Model Version *
            </label>
            <input
              value={modelVersion}
              onChange={e => setModelVersion(e.target.value)}
              placeholder="e.g. v1.0"
              disabled={training}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 6,
                border: `1px solid ${modelVersion.trim() ? '#d1d5db' : '#fca5a5'}`,
                fontSize: 13,
              }}
            />
          </div>

          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>
              Epochs (10–500) *
            </label>
            <input
              type="number"
              value={epochs}
              min={10}
              max={500}
              onChange={e => setEpochs(Number(e.target.value))}
              disabled={training}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 6,
                border: `1px solid ${epochs >= 10 && epochs <= 500 ? '#d1d5db' : '#fca5a5'}`,
                fontSize: 13,
              }}
            />
          </div>

          <button
            onClick={handleTrain}
            disabled={!canTrain}
            style={{
              padding: '9px 20px', borderRadius: 6, border: 'none', cursor: canTrain ? 'pointer' : 'not-allowed',
              background: canTrain ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : '#e5e7eb',
              color: canTrain ? '#fff' : '#9ca3af',
              fontWeight: 600, fontSize: 13,
              boxShadow: canTrain ? '0 2px 8px rgba(79,70,229,0.3)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {training ? '⏳ Training…' : '▶ Start Training'}
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>
          Training runs on the FastAPI ML service using approved datasets only.
          The model file is backed up automatically before each run.
        </div>
      </div>
    </div>
  )
}
