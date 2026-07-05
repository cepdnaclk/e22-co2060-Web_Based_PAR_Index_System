// frontend/src/components/Case3DViewer.jsx
// Manages upper/lower/buccal STL models for one clinical case
//
// ── FIX APPLIED ──────────────────────────────────────────────────────────────
// getModelUrl() was returning a hardcoded wrong path:
//   `/api/v1/cases/files/${file.id}`         ← by file ID — endpoint does NOT exist
//
// The actual backend endpoint is:
//   GET /api/v1/cases/{caseId}/models/{slot}
//
// Fixed to use caseApi.getModelFileUrl(caseId, slotKey) which (after api.js fix)
// returns the correct RELATIVE path:  `cases/{caseId}/models/{slot}`
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import STLViewer from './STLViewer'
import { caseApi } from '../api/api'

const SLOTS = [
  { key: 'UPPER',  label: '🦷 Upper',  color: '#2563eb' },
  { key: 'LOWER',  label: '🦷 Lower',  color: '#16a34a' },
  { key: 'BUCCAL', label: '📐 Buccal', color: '#d97706' },
]

/**
 * Case3DViewer — shows 3 STL models per case with slot tabs
 * Props:
 *   caseId         number
 *   modelFiles     Model3DFile[]
 *   placementMode  bool
 *   activeLandmark string|null
 *   placedPoints   { UPPER:{}, LOWER:{}, BUCCAL:{} }
 *   onPointPlaced  fn(slot, name, coords)
 *   activeSlot     string   — controlled from parent
 *   onSlotChange   fn(slot) — controlled from parent
 */
export default function Case3DViewer({
  caseId,
  modelFiles = [],
  placementMode = false,
  activeLandmark = null,
  placedPoints = { UPPER: {}, LOWER: {}, BUCCAL: {} },
  onPointPlaced,
  activeSlot,
  onSlotChange,
  resolveUrl,   // optional: (id, slot) => relative URL — defaults to clinical-case models
}) {
  const [internalSlot, setInternalSlot] = useState('UPPER')
  const slot    = activeSlot    ?? internalSlot
  const setSlot = onSlotChange  ?? setInternalSlot

  const resolver = resolveUrl ?? caseApi.getModelFileUrl

  function getModelUrl(slotKey) {
    const file = modelFiles.find(f => f.slot === slotKey)
    if (!file) return null
    return resolver(caseId, slotKey)
  }

  const currentUrl = getModelUrl(slot)

  return (
    <div style={{ width: '100%' }}>
      {/* Slot tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {SLOTS.map(s => {
          const hasModel = !!getModelUrl(s.key)
          const isActive = slot === s.key
          return (
            <button
              key={s.key}
              onClick={() => setSlot(s.key)}
              disabled={!hasModel}
              style={{
                padding: '7px 18px',
                borderRadius: 7,
                border: 'none',
                fontWeight: 600,
                fontSize: 13,
                cursor: hasModel ? 'pointer' : 'not-allowed',
                opacity: hasModel ? 1 : 0.4,
                background: isActive ? s.color : '#f3f4f6',
                color: isActive ? '#fff' : '#374151',
                transition: 'all 0.15s',
              }}
            >
              {s.label}
            </button>
          )
        })}
      </div>

      {/* Placement hint bar */}
      {placementMode && activeLandmark && (
        <div style={{
          padding: '7px 14px',
          background: 'rgba(37,99,235,0.9)',
          color: '#fff',
          borderRadius: '8px 8px 0 0',
          fontSize: 13,
          fontWeight: 600,
        }}>
          📍 Click model to place:{' '}
          <code style={{ background: 'rgba(255,255,255,.2)', padding: '1px 8px', borderRadius: 4 }}>
            {activeLandmark}
          </code>
          {' '}on <strong>{slot}</strong>
        </div>
      )}

      {/* Viewer */}
      {currentUrl ? (
        <STLViewer
          url={currentUrl}
          height={450}
          placementMode={placementMode}
          activeLandmark={activeLandmark}
          placedPoints={placedPoints[slot] ?? {}}
          landmarkCategory={slot}
          onPointPlaced={(name, coords) => onPointPlaced?.(slot, name, coords)}
        />
      ) : (
        <div style={{
          height: 450,
          border: '2px dashed #d1d5db',
          borderRadius: placementMode && activeLandmark ? '0 0 8px 8px' : 8,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#9ca3af', gap: 10, background: '#fafafa',
        }}>
          <span style={{ fontSize: 36 }}>📁</span>
          <span style={{ fontSize: 14 }}>No 3D model uploaded for <strong>{slot}</strong> arch</span>
          <span style={{ fontSize: 12, color: '#d1d5db' }}>
            Upload in the &quot;3D Dental Models&quot; section
          </span>
        </div>
      )}
    </div>
  )
}