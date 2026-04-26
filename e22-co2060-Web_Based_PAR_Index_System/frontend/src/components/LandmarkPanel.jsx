/**
 * LandmarkPanel
 *
 * Displays the list of required landmarks per arch slot, tracks placement
 * progress, and drives the "active landmark" cursor in the 3D viewer.
 *
 * Props:
 *   slot           'UPPER'|'LOWER'|'BUCCAL'
 *   placedPoints   { [name]: {x,y,z} }
 *   activeLandmark string|null
 *   onSelectLandmark fn(name)
 *   onClear        fn()
 *   onSubmitSlot   fn()    — saves this slot's points to backend
 *   onAutoCalc     fn()    — triggers auto PAR calculation
 *   submitting     bool
 *   calculating    bool
 *   totalPlaced    number  — across all slots
 *   totalRequired  number  — across all slots
 */

// ── Landmark definitions per slot ────────────────────────────────────────

export const LANDMARK_DEFS = {
  UPPER: [
    { name: 'R3M',   desc: 'Upper Right Canine — Mesial contact' },
    { name: 'R2D',   desc: 'Upper Right Lateral — Distal contact' },
    { name: 'R2M',   desc: 'Upper Right Lateral — Mesial contact' },
    { name: 'R1D',   desc: 'Upper Right Central — Distal contact' },
    { name: 'R1M',   desc: 'Upper Right Central — Mesial contact' },
    { name: 'R1Mid', desc: 'Upper Right Central — Incisal tip (mid)' },
    { name: 'L1M',   desc: 'Upper Left Central — Mesial contact' },
    { name: 'L1D',   desc: 'Upper Left Central — Distal contact' },
    { name: 'L2M',   desc: 'Upper Left Lateral — Mesial contact' },
    { name: 'L2D',   desc: 'Upper Left Lateral — Distal contact' },
    { name: 'L3M',   desc: 'Upper Left Canine — Mesial contact' },
    // Molar points for buccal occlusion
    { name: 'R6MB',  desc: 'Upper Right 1st Molar — Mesio-Buccal cusp' },
    { name: 'R6MP',  desc: 'Upper Right 1st Molar — Mesio-Palatal cusp' },
    { name: 'R6DB',  desc: 'Upper Right 1st Molar — Disto-Buccal cusp' },
    { name: 'R6DP',  desc: 'Upper Right 1st Molar — Disto-Palatal cusp' },
    { name: 'R6GB',  desc: 'Upper Right 1st Molar — Buccal Groove' },
    { name: 'L6MB',  desc: 'Upper Left 1st Molar — Mesio-Buccal cusp' },
    { name: 'L6MP',  desc: 'Upper Left 1st Molar — Mesio-Palatal cusp' },
    { name: 'L6DB',  desc: 'Upper Left 1st Molar — Disto-Buccal cusp' },
    { name: 'L6DP',  desc: 'Upper Left 1st Molar — Disto-Palatal cusp' },
    { name: 'L6GB',  desc: 'Upper Left 1st Molar — Buccal Groove' },
    // Premolars
    { name: 'R5BT',  desc: 'Upper Right 2nd Premolar — Buccal Tip' },
    { name: 'R5PT',  desc: 'Upper Right 2nd Premolar — Palatal Tip' },
    { name: 'R4BT',  desc: 'Upper Right 1st Premolar — Buccal Tip' },
    { name: 'R4PT',  desc: 'Upper Right 1st Premolar — Palatal Tip' },
    { name: 'L5BT',  desc: 'Upper Left 2nd Premolar — Buccal Tip' },
    { name: 'L5PT',  desc: 'Upper Left 2nd Premolar — Palatal Tip' },
    { name: 'L4BT',  desc: 'Upper Left 1st Premolar — Buccal Tip' },
    { name: 'L4PT',  desc: 'Upper Left 1st Premolar — Palatal Tip' },
  ],
  LOWER: [
    { name: 'R3M',   desc: 'Lower Right Canine — Mesial contact' },
    { name: 'R2D',   desc: 'Lower Right Lateral — Distal contact' },
    { name: 'R2M',   desc: 'Lower Right Lateral — Mesial contact' },
    { name: 'R1D',   desc: 'Lower Right Central — Distal contact' },
    { name: 'R1M',   desc: 'Lower Right Central — Mesial contact' },
    { name: 'R1Mid', desc: 'Lower Right Central — Incisal tip (mid)' },
    { name: 'R1Low', desc: 'Lower Right Central — Gingival margin' },
    { name: 'L1M',   desc: 'Lower Left Central — Mesial contact' },
    { name: 'L1D',   desc: 'Lower Left Central — Distal contact' },
    { name: 'L2M',   desc: 'Lower Left Lateral — Mesial contact' },
    { name: 'L2D',   desc: 'Lower Left Lateral — Distal contact' },
    { name: 'L3M',   desc: 'Lower Left Canine — Mesial contact' },
    // Molar points
    { name: 'R6MB',  desc: 'Lower Right 1st Molar — Mesio-Buccal cusp' },
    { name: 'R6MP',  desc: 'Lower Right 1st Molar — Mesio-Lingual cusp' },
    { name: 'R6DB',  desc: 'Lower Right 1st Molar — Disto-Buccal cusp' },
    { name: 'R6DP',  desc: 'Lower Right 1st Molar — Disto-Lingual cusp' },
    { name: 'R6GB',  desc: 'Lower Right 1st Molar — Buccal Groove' },
    { name: 'R6M',   desc: 'Lower Right 1st Molar — Mesial contact' },
    { name: 'L6MB',  desc: 'Lower Left 1st Molar — Mesio-Buccal cusp' },
    { name: 'L6MP',  desc: 'Lower Left 1st Molar — Mesio-Lingual cusp' },
    { name: 'L6DB',  desc: 'Lower Left 1st Molar — Disto-Buccal cusp' },
    { name: 'L6DP',  desc: 'Lower Left 1st Molar — Disto-Lingual cusp' },
    { name: 'L6GB',  desc: 'Lower Left 1st Molar — Buccal Groove' },
    { name: 'L6M',   desc: 'Lower Left 1st Molar — Mesial contact' },
    // Premolars
    { name: 'R5BT',  desc: 'Lower Right 2nd Premolar — Buccal Tip' },
    { name: 'R5PT',  desc: 'Lower Right 2nd Premolar — Lingual Tip' },
    { name: 'R4BT',  desc: 'Lower Right 1st Premolar — Buccal Tip' },
    { name: 'R4PT',  desc: 'Lower Right 1st Premolar — Lingual Tip' },
    { name: 'L5BT',  desc: 'Lower Left 2nd Premolar — Buccal Tip' },
    { name: 'L5PT',  desc: 'Lower Left 2nd Premolar — Lingual Tip' },
    { name: 'L4BT',  desc: 'Lower Left 1st Premolar — Buccal Tip' },
    { name: 'L4PT',  desc: 'Lower Left 1st Premolar — Lingual Tip' },
  ],
  BUCCAL: [
    { name: 'LCover', desc: 'Lower Incisor — visible edge (overjet cover point)' },
  ],
}

const SLOT_COLOR = { UPPER: '#2563eb', LOWER: '#16a34a', BUCCAL: '#b45309' }
const SLOT_BG    = { UPPER: '#eff6ff', LOWER: '#f0fdf4', BUCCAL: '#fffbeb' }

export default function LandmarkPanel({
  slot,
  placedPoints,
  activeLandmark,
  onSelectLandmark,
  onClear,
  onSubmitSlot,
  onAutoCalc,
  submitting  = false,
  calculating = false,
  totalPlaced = 0,
  totalRequired = 0,
}) {
  const defs    = LANDMARK_DEFS[slot] ?? []
  const placed  = defs.filter(d => placedPoints[d.name]).length
  const color   = SLOT_COLOR[slot] ?? '#6b7280'
  const bgLight = SLOT_BG[slot]    ?? '#f9fafb'

  return (
    <div style={{
      width: 280, flexShrink: 0,
      border: '1.5px solid #e5e7eb', borderRadius: 10,
      background: '#fff', display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif', fontSize: 13,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        background: bgLight,
        borderBottom: '1px solid #e5e7eb',
        borderRadius: '8px 8px 0 0',
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, color, marginBottom: 4 }}>
          {slot === 'UPPER'  && '🦷 Upper Arch Landmarks'}
          {slot === 'LOWER'  && '🦷 Lower Arch Landmarks'}
          {slot === 'BUCCAL' && '📐 Buccal Reference Points'}
        </div>
        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden',
          }}>
            <div style={{
              width: defs.length ? `${(placed / defs.length) * 100}%` : '0%',
              height: '100%', background: color, borderRadius: 3,
              transition: 'width 0.3s',
            }} />
          </div>
          <span style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>
            {placed} / {defs.length}
          </span>
        </div>
      </div>

      {/* Instruction */}
      <div style={{ padding: '8px 16px', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>
        Click a landmark below, then click on the 3D model to place it.
      </div>

      {/* Landmark list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', maxHeight: 340 }}>
        {defs.map(def => {
          const isPlaced = !!placedPoints[def.name]
          const isActive = activeLandmark === def.name
          return (
            <div
              key={def.name}
              onClick={() => onSelectLandmark(isActive ? null : def.name)}
              title={def.desc}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', borderRadius: 6, marginBottom: 3,
                cursor: 'pointer',
                background: isActive ? color : isPlaced ? '#f0fdf4' : '#fafafa',
                border: isActive
                  ? `1.5px solid ${color}`
                  : isPlaced
                    ? '1.5px solid #86efac'
                    : '1.5px solid #e5e7eb',
                transition: 'all 0.15s',
              }}
            >
              {/* Status icon */}
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
                background: isPlaced ? '#16a34a' : isActive ? 'rgba(255,255,255,0.3)' : '#e5e7eb',
                color: isPlaced ? '#fff' : isActive ? '#fff' : '#9ca3af',
              }}>
                {isPlaced ? '✓' : isActive ? '•' : '○'}
              </span>

              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: 'monospace', fontWeight: 600,
                  color: isActive ? '#fff' : isPlaced ? '#15803d' : '#374151',
                  fontSize: 12,
                }}>
                  {def.name}
                </div>
                {isPlaced && !isActive && placedPoints[def.name] && (
                  <div style={{ fontSize: 10, color: '#6b7280', fontFamily: 'monospace' }}>
                    ({placedPoints[def.name].x.toFixed(1)},&nbsp;
                     {placedPoints[def.name].y.toFixed(1)},&nbsp;
                     {placedPoints[def.name].z.toFixed(1)})
                  </div>
                )}
                {isActive && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>
                    Click on model →
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Save this slot */}
        <button
          onClick={onSubmitSlot}
          disabled={submitting || placed === 0}
          style={{
            padding: '8px 0', borderRadius: 6, border: 'none', cursor: placed === 0 ? 'not-allowed' : 'pointer',
            background: placed > 0 ? color : '#e5e7eb',
            color: placed > 0 ? '#fff' : '#9ca3af',
            fontWeight: 600, fontSize: 13,
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? '⏳ Saving…' : `💾 Save ${slot} Points (${placed})`}
        </button>

        {/* Clear this slot */}
        {placed > 0 && (
          <button
            onClick={onClear}
            style={{
              padding: '6px 0', borderRadius: 6, border: '1.5px solid #fca5a5',
              cursor: 'pointer', background: '#fff', color: '#dc2626',
              fontWeight: 500, fontSize: 12,
            }}
          >
            🗑 Clear {slot} Points
          </button>
        )}

        {/* Auto-calculate — only show when all 3 slots have ≥1 point */}
        {totalPlaced >= 3 && (
          <button
            onClick={onAutoCalc}
            disabled={calculating}
            style={{
              padding: '10px 0', borderRadius: 6, border: 'none',
              cursor: calculating ? 'not-allowed' : 'pointer',
              background: calculating ? '#e5e7eb' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              color: calculating ? '#9ca3af' : '#fff',
              fontWeight: 700, fontSize: 13,
              opacity: calculating ? 0.8 : 1,
              boxShadow: calculating ? 'none' : '0 2px 8px rgba(79,70,229,0.35)',
            }}
          >
            {calculating
              ? '⏳ Calculating…'
              : `⚡ Auto-Calculate PAR  (${totalPlaced} pts)`}
          </button>
        )}

        {totalPlaced < 3 && totalPlaced > 0 && (
          <div style={{
            fontSize: 11, color: '#6b7280', textAlign: 'center',
            padding: '4px 0', lineHeight: 1.4,
          }}>
            Save points in all 3 arch slots to enable auto-calculation
          </div>
        )}
      </div>
    </div>
  )
}
