import { useState, useEffect, useCallback, useMemo } from 'react'
import Case3DViewer     from './Case3DViewer'
import LandmarkPanel, { LANDMARK_DEFS } from './LandmarkPanel'
import AutoScoreResult  from './AutoScoreResult'
import { landmarkApi } from '../api/api'
import { calcAllMeasurements } from '../utils/measurements'

/**
 * ThreeDAutoScore
 *
 * Full workflow for automatic PAR scoring from 3D landmarks.
 *
 * Props:
 *   caseId      number           — OrthoCase ID
 *   modelFiles  Model3DFile[]    — from the case (contains storagePath via API URL)
 *   onScored    fn(autoResult)   — called when auto-calc succeeds (to refresh parent)
 */

const SLOTS = ['UPPER', 'LOWER', 'BUCCAL']

export default function ThreeDAutoScore({ caseId, modelFiles, onScored }) {
  // Which arch we're viewing in the 3D viewer
  const [viewSlot, setViewSlot]         = useState('UPPER')
  // Active landmark being placed (click on model to set coords)
  const [activeLandmark, setActive]     = useState(null)
  // Placed points: { UPPER: {R3M:{x,y,z}, ...}, LOWER: {...}, BUCCAL: {...} }
  const [placedPoints, setPlacedPoints] = useState({ UPPER: {}, LOWER: {}, BUCCAL: {} })
  // Per-point metadata: { UPPER: { R3M: { source, confirmed } }, ... }
  const [pointMeta, setPointMeta]       = useState({ UPPER: {}, LOWER: {}, BUCCAL: {} })
  // Saved-to-backend slots
  const [savedSlots, setSavedSlots]     = useState({ UPPER: false, LOWER: false, BUCCAL: false })

  // UI state
  const [submitting,  setSubmitting]  = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [predicting,  setPredicting]  = useState(false)
  const [confirming,  setConfirming]  = useState(false)
  const [predictMsg,  setPredictMsg]  = useState('')
  const [mlParEstimate, setMlParEstimate] = useState(null)
  const [mlParModelVersion, setMlParModelVersion] = useState(null)
  const [error,       setError]       = useState('')
  const [autoResult,  setAutoResult]  = useState(null)

  // Live measurements derived from placed points
  const measurements = useMemo(() => {
    return calcAllMeasurements(
      placedPoints.UPPER,
      placedPoints.LOWER,
    )
  }, [placedPoints])

  // Reloads landmarks (and their source/confirmed metadata) from the backend
  const reloadLandmarks = useCallback(() => {
    if (!caseId) return
    return landmarkApi.get(caseId).then(({ data }) => {
      const restored = { UPPER: {}, LOWER: {}, BUCCAL: {} }
      const meta      = { UPPER: {}, LOWER: {}, BUCCAL: {} }
      ;(data ?? []).forEach(lm => {
        if (restored[lm.slot]) {
          restored[lm.slot][lm.pointName] = { x: lm.x, y: lm.y, z: lm.z }
          meta[lm.slot][lm.pointName] = { source: lm.source, confirmed: lm.confirmed }
        }
      })
      setPlacedPoints(restored)
      setPointMeta(meta)
      setSavedSlots({
        UPPER:  Object.keys(restored.UPPER).length  > 0,
        LOWER:  Object.keys(restored.LOWER).length  > 0,
        BUCCAL: Object.keys(restored.BUCCAL).length > 0,
      })
    })
  }, [caseId])

  // Load any previously saved landmarks when the panel first opens
  useEffect(() => {
    reloadLandmarks().catch(() => { /* no landmarks yet — that's fine */ })
  }, [reloadLandmarks])

  // ── ML prediction ─────────────────────────────────────────────────────
  const handlePredict = async () => {
    setPredicting(true)
    setError('')
    setPredictMsg('')
    try {
      const { data } = await landmarkApi.predict(caseId)
      setPredictMsg(data.message ?? `Predicted ${data.landmarksPredicted} point(s).`)
      setMlParEstimate(data.mlParEstimate ?? null)
      setMlParModelVersion(data.mlParModelVersion ?? null)
      await reloadLandmarks()
    } catch (err) {
      setError(err.response?.data?.message ?? 'ML prediction failed.')
    } finally {
      setPredicting(false)
    }
  }

  // ── Confirm ML suggestions for the current slot ────────────────────────
  const handleConfirmMl = async () => {
    setConfirming(true)
    setError('')
    try {
      await landmarkApi.confirmSlot(caseId, viewSlot)
      await reloadLandmarks()
    } catch (err) {
      setError(err.response?.data?.message ?? 'Could not confirm ML points.')
    } finally {
      setConfirming(false)
    }
  }

  // ── Point placement ─────────────────────────────────────────────────
  const handlePointPlaced = useCallback((name, coords) => {
    setPlacedPoints(prev => ({
      ...prev,
      [viewSlot]: { ...prev[viewSlot], [name]: coords },
    }))
    setActive(null)         // deselect after placement

    // Auto-advance to next unplaced landmark in this slot
    const defs    = LANDMARK_DEFS[viewSlot] ?? []
    const current = defs.findIndex(d => d.name === name)
    const next    = defs.slice(current + 1).find(d => !placedPoints[viewSlot]?.[d.name])
    if (next) setTimeout(() => setActive(next.name), 120)
  }, [viewSlot, placedPoints])

  // ── Save one slot to backend ────────────────────────────────────────
  const handleSubmitSlot = async () => {
    const pts = placedPoints[viewSlot]
    if (!Object.keys(pts).length) return
    setSubmitting(true)
    setError('')
    try {
      const points = Object.entries(pts).map(([name, { x, y, z }]) => ({ name, x, y, z }))
      await landmarkApi.submit(caseId, { slot: viewSlot, points })
      setSavedSlots(prev => ({ ...prev, [viewSlot]: true }))
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to save landmarks.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Clear one slot (local + backend) ───────────────────────────────
  const handleClearSlot = async () => {
    setPlacedPoints(prev => ({ ...prev, [viewSlot]: {} }))
    setSavedSlots(prev  => ({ ...prev, [viewSlot]: false }))
    setActive(null)
    // Also delete from backend for this slot
    try {
      await landmarkApi.clear(caseId)
      for (const slot of SLOTS) {
        const pts2 = slot === viewSlot ? {} : placedPoints[slot]
        const arr  = Object.entries(pts2).map(([name, { x, y, z }]) => ({ name, x, y, z }))
        if (arr.length) {
          await landmarkApi.submit(caseId, { slot, points: arr })
        }
      }
    } catch { /* silent — local state already cleared */ }
  }

  // ── Auto-calculate ──────────────────────────────────────────────────
  const handleAutoCalc = async () => {
    setCalculating(true)
    setError('')
    setAutoResult(null)
    try {
      const { data } = await landmarkApi.autoCalculate(caseId)
      setAutoResult(data)
      onScored?.(data)
    } catch (err) {
      setError(err.response?.data?.message ?? 'Auto-calculation failed.')
    } finally {
      setCalculating(false)
    }
  }

  // ── Summary counts ──────────────────────────────────────────────────
  const totalPlaced   = SLOTS.reduce((n, s) => n + Object.keys(placedPoints[s]).length, 0)
  const totalRequired = 3 // at least one point per slot to enable auto-calc
  const savedCount    = SLOTS.filter(s => savedSlots[s]).length

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Top status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px', marginBottom: 14,
        background: '#f8faff', border: '1px solid #c7d2fe',
        borderRadius: 8, flexWrap: 'wrap',
      }}>
        <span style={{ fontWeight: 600, color: '#3730a3', fontSize: 13 }}>
          3D Auto-Detection Workflow
        </span>
        {SLOTS.map(slot => (
          <span key={slot} style={{
            padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: savedSlots[slot] ? '#f0fdf4' : '#f3f4f6',
            color:      savedSlots[slot] ? '#15803d' : '#9ca3af',
            border:     savedSlots[slot] ? '1px solid #86efac' : '1px solid #e5e7eb',
          }}>
            {savedSlots[slot] ? '✓' : '○'} {slot}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>
          {totalPlaced} points placed · {savedCount}/3 slots saved
        </span>
        <button
          onClick={handlePredict}
          disabled={predicting}
          style={{
            padding: '5px 14px', borderRadius: 20, border: '1px solid #c4b5fd',
            background: predicting ? '#f3f4f6' : '#faf5ff', color: '#6d28d9',
            fontWeight: 600, fontSize: 12, cursor: predicting ? 'not-allowed' : 'pointer',
          }}
          title="Ask the ML service to suggest landmarks from the uploaded 3D models"
        >
          {predicting ? '⏳ Predicting…' : '🤖 Predict Landmarks (ML)'}
        </button>
      </div>

      {predictMsg && (
        <div style={{
          padding: '10px 14px', background: '#faf5ff', border: '1px solid #e9d5ff',
          borderRadius: 8, color: '#6d28d9', fontSize: 13, marginBottom: 14,
        }}>
          🤖 {predictMsg}
        </div>
      )}

      {mlParEstimate != null && (
        <div style={{
          padding: '10px 14px', background: '#ecfeff', border: '1px solid #a5f3fc',
          borderRadius: 8, color: '#155e75', fontSize: 13, marginBottom: 14,
        }}>
          📊 <strong>ML PAR cross-check estimate: {mlParEstimate}</strong> (model {mlParModelVersion}).
          This is a secondary signal from a trained regressor, shown alongside the geometric
          calculation below — it does not replace or override it.
        </div>
      )}

      {error && (
        <div style={{
          padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5',
          borderRadius: 8, color: '#b91c1c', fontSize: 13, marginBottom: 14,
        }}>
          ❌ {error}
        </div>
      )}

      {/* Auto result */}
      {autoResult && (
        <div style={{ marginBottom: 20 }}>
          <AutoScoreResult
            result={autoResult}
            onReset={() => { setAutoResult(null) }}
          />
        </div>
      )}

      {/* Main layout: viewer + panel */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* 3D viewer — replaced Model3DViewer with Case3DViewer */}
        <div style={{ flex: 1, minWidth: 320 }}>
          <Case3DViewer
            caseId={caseId}
            modelFiles={modelFiles}
            placementMode={!!activeLandmark}
            activeLandmark={activeLandmark}
            placedPoints={placedPoints}
            activeSlot={viewSlot}
            onSlotChange={(slot) => { setViewSlot(slot); setActive(null) }}
            onPointPlaced={(slot, name, coords) => {
              if (slot !== viewSlot) return
              handlePointPlaced(name, coords)
            }}
          />

          {/* Live Measurements Panel */}
          {(measurements.overjet !== null || measurements.overbite !== null) && (
            <div style={{
              marginTop: 10,
              padding: '12px 16px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 8,
              display: 'flex',
              gap: 24,
              flexWrap: 'wrap',
              fontSize: 13,
            }}>
              <strong style={{ color: '#14532d', fontSize: 12, width: '100%' }}>
                📏 Live Measurements (from placed landmarks)
              </strong>
              {measurements.overjet !== null && (
                <div>
                  <span style={{ color: '#6b7280' }}>Overjet: </span>
                  <strong style={{ color: '#1d4ed8' }}>{measurements.overjet} mm</strong>
                </div>
              )}
              {measurements.overbite !== null && (
                <div>
                  <span style={{ color: '#6b7280' }}>Overbite: </span>
                  <strong style={{ color: '#16a34a' }}>{measurements.overbite} mm</strong>
                </div>
              )}
              {measurements.centerlineDeviation !== null && (
                <div>
                  <span style={{ color: '#6b7280' }}>Centreline dev: </span>
                  <strong style={{ color: '#b45309' }}>{measurements.centerlineDeviation} mm</strong>
                </div>
              )}
            </div>
          )}

          {/* Orbit controls hint */}
          {!activeLandmark && (
            <div style={{
              marginTop: 8, padding: '6px 12px',
              background: '#f9fafb', border: '1px solid #e5e7eb',
              borderRadius: 6, fontSize: 11, color: '#9ca3af',
            }}>
              🖱 Left-drag to orbit · Scroll to zoom · Right-drag to pan
            </div>
          )}
        </div>

        {/* Landmark panel */}
        <LandmarkPanel
          slot={viewSlot}
          placedPoints={placedPoints[viewSlot]}
          pointMeta={pointMeta[viewSlot]}
          activeLandmark={activeLandmark}
          onSelectLandmark={setActive}
          onClear={handleClearSlot}
          onSubmitSlot={handleSubmitSlot}
          onAutoCalc={handleAutoCalc}
          onConfirmMl={handleConfirmMl}
          confirming={confirming}
          submitting={submitting}
          calculating={calculating}
          totalPlaced={savedCount}
          totalRequired={totalRequired}
        />
      </div>

      {/* Step guide */}
      <div style={{
        marginTop: 16, padding: '12px 16px',
        background: '#fffbeb', border: '1px solid #fde68a',
        borderRadius: 8, fontSize: 12, color: '#78350f',
        display: 'flex', gap: 20, flexWrap: 'wrap',
      }}>
        <span><strong>Step 1:</strong> Select landmark → click model to place</span>
        <span>→</span>
        <span><strong>Step 2:</strong> Save each arch slot (Upper, Lower, Buccal)</span>
        <span>→</span>
        <span><strong>Step 3:</strong> Click ⚡ Auto-Calculate PAR</span>
      </div>
    </div>
  )
}