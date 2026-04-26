import { useRef } from 'react'

const SLOTS = [
  { key: 'upperFile',  label: 'Upper Arch',  icon: '🦷', desc: 'STL or OBJ — max 50 MB' },
  { key: 'lowerFile',  label: 'Lower Arch',  icon: '🦷', desc: 'STL or OBJ — max 50 MB' },
  { key: 'buccalFile', label: 'Buccal View', icon: '📐', desc: 'STL or OBJ — max 50 MB' },
]

const ACCEPTED = '.stl,.obj,model/stl,model/obj,application/octet-stream'

/**
 * Three-slot 3D model upload component.
 * Props:
 *   files: { upperFile, lowerFile, buccalFile }  (File objects or null)
 *   onChange: (key, File) => void
 *   errors: { upperFile?, lowerFile?, buccalFile? }
 */
export default function ModelUploadSlots({ files = {}, onChange, errors = {} }) {
  const refs = {
    upperFile:  useRef(),
    lowerFile:  useRef(),
    buccalFile: useRef(),
  }

  const handleFile = (key, e) => {
    const file = e.target.files?.[0]
    if (file) onChange(key, file)
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue-dark)', marginBottom: 10 }}>
        3D Model Files — Upload all three slots
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        {SLOTS.map(slot => {
          const file = files[slot.key]
          const err  = errors[slot.key]
          return (
            <div key={slot.key}
              style={{ minWidth: 140 }}
              onClick={() => refs[slot.key].current.click()}>
              <div className={`upload-slot ${file ? 'filled' : ''} ${err ? 'error-slot' : ''}`}>
                <input
                  type="file"
                  ref={refs[slot.key]}
                  accept={ACCEPTED}
                  onChange={e => handleFile(slot.key, e)}
                />
                <div style={{ fontSize: 22, marginBottom: 6 }}>{file ? '✅' : slot.icon}</div>
                <div className="upload-slot-label">{slot.label}</div>
                {file ? (
                  <div className="upload-slot-name">{file.name}</div>
                ) : (
                  <>
                    <div className="upload-slot-sub">Click to choose file</div>
                    <div className="upload-slot-sub">{slot.desc}</div>
                  </>
                )}
              </div>
              {err && <div className="form-error" style={{ marginTop: 4 }}>{err}</div>}
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        All three model files are required before calculation.
      </div>
    </div>
  )
}