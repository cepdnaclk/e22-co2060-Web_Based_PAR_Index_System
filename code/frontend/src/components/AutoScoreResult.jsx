/**
 * AutoScoreResult
 *
 * Renders the response from POST /auto-calculate as a rich breakdown card.
 *
 * Props:
 *   result   AutoScoreResponse object from backend
 *   onReset  fn() — called when user clicks "Place New Points"
 */

const CLASS_STYLE = {
  'Greatly Improved':      { bg: '#f0fdf4', color: '#15803d', border: '#86efac', icon: '🏆' },
  'Improved':              { bg: '#eff6ff', color: '#1d4ed8', border: '#93c5fd', icon: '✅' },
  'No Different or Worse': { bg: '#fef2f2', color: '#b91c1c', border: '#fca5a5', icon: '⚠️' },
  'No Pre-Treatment Reference': { bg: '#fffbeb', color: '#b45309', border: '#fde68a', icon: 'ℹ️' },
}

const COMPONENTS = [
  { key: 'upperAnterior', label: 'Upper Anterior',   weight: 1,  rawKey: 'upperAnteriorRaw',  wKey: 'upperAnteriorWeighted' },
  { key: 'lowerAnterior', label: 'Lower Anterior',   weight: 1,  rawKey: 'lowerAnteriorRaw',  wKey: 'lowerAnteriorWeighted' },
  { key: 'buccalLeft',    label: 'Buccal Left',      weight: 1,  rawKey: 'buccalLeftRaw',     wKey: 'buccalLeftWeighted' },
  { key: 'buccalRight',   label: 'Buccal Right',     weight: 1,  rawKey: 'buccalRightRaw',    wKey: 'buccalRightWeighted' },
  { key: 'overjet',       label: 'Overjet',          weight: 6,  rawKey: 'overjetRaw',        wKey: 'overjetWeighted' },
  { key: 'overbite',      label: 'Overbite',         weight: 2,  rawKey: 'overbiteRaw',       wKey: 'overbiteWeighted' },
  { key: 'centreline',    label: 'Centreline',       weight: 4,  rawKey: 'centrelineRaw',     wKey: 'centrelineWeighted' },
]

export default function AutoScoreResult({ result, onReset }) {
  if (!result) return null

  const classStyle = CLASS_STYLE[result.classification] ?? {
    bg: '#f9fafb', color: '#374151', border: '#e5e7eb', icon: '📊',
  }

  return (
    <div style={{
      border: '2px solid #4f46e5', borderRadius: 12,
      background: '#fff', overflow: 'hidden',
      boxShadow: '0 4px 16px rgba(79,70,229,0.12)',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Score header */}
      <div style={{
        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
        padding: '20px 24px', color: '#fff',
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 58, fontWeight: 900, lineHeight: 1 }}>
            {result.totalWeighted}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
            Weighted PAR Score
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
            ⚡ Auto-Calculated from 3D Landmarks
          </div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>
            {result.landmarksUsed} landmark points used
          </div>
          {result.message && (
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              {result.message}
            </div>
          )}
        </div>

        {onReset && (
          <button
            onClick={onReset}
            style={{
              padding: '8px 16px', borderRadius: 6, border: '1.5px solid rgba(255,255,255,0.5)',
              background: 'rgba(255,255,255,0.15)', color: '#fff',
              cursor: 'pointer', fontWeight: 600, fontSize: 12,
              whiteSpace: 'nowrap',
            }}
          >
            📍 Re-Place Points
          </button>
        )}
      </div>

      {/* Classification badge */}
      {result.classification && (
        <div style={{
          margin: '16px 20px 0',
          padding: '12px 16px',
          background: classStyle.bg,
          border: `1.5px solid ${classStyle.border}`,
          borderRadius: 8,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 22 }}>{classStyle.icon}</span>
          <div>
            <div style={{ fontWeight: 700, color: classStyle.color, fontSize: 15 }}>
              {result.classification}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
              British PAR Index post-treatment outcome classification
            </div>
          </div>
        </div>
      )}

      {/* Component breakdown */}
      <div style={{ padding: '16px 20px 20px' }}>
        <div style={{ fontWeight: 700, color: '#374151', marginBottom: 12, fontSize: 13 }}>
          📋 Component Breakdown
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
          {COMPONENTS.map(comp => {
            const raw = result[comp.rawKey] ?? 0
            const weighted = result[comp.wKey] ?? 0
            const maxPossibleRaw = comp.weight === 6 ? 4 : comp.weight === 2 ? 4 : comp.weight === 4 ? 2 : 10
            const barPct = Math.min((raw / (maxPossibleRaw || 1)) * 100, 100)

            return (
              <div key={comp.key} style={{
                padding: '10px 12px',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>
                    {comp.label}
                  </span>
                  <span style={{
                    background: weighted > 0 ? '#4f46e5' : '#e5e7eb',
                    color: weighted > 0 ? '#fff' : '#9ca3af',
                    borderRadius: 4, padding: '1px 7px',
                    fontSize: 11, fontWeight: 700,
                  }}>
                    ×{comp.weight}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Mini progress bar */}
                  <div style={{ flex: 1, height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      width: `${barPct}%`, height: '100%',
                      background: raw === 0 ? '#86efac' : raw <= 2 ? '#fbbf24' : '#ef4444',
                      borderRadius: 2, transition: 'width 0.5s',
                    }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>
                    {raw} → <span style={{ color: '#4f46e5' }}>{weighted}</span>
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Total row */}
        <div style={{
          marginTop: 14,
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #eef2ff, #ede9fe)',
          border: '1.5px solid #c7d2fe',
          borderRadius: 8,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontWeight: 600, color: '#3730a3', fontSize: 14 }}>
            Total Weighted PAR Score
          </span>
          <span style={{ fontWeight: 900, fontSize: 26, color: '#312e81' }}>
            {result.totalWeighted}
          </span>
        </div>
      </div>
    </div>
  )
}
