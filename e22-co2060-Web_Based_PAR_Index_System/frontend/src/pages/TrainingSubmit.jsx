import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { trainingApi } from '../api/api'
import ModelUploadSlots from '../components/ModelUploadSlots'

// ── PAR scoring constants (same as CaseDetail) ────────────────────────
const UPPER_ANT_SEGMENTS = [
  { key: 'upper_3_2', label: '3–2', max: 5 },
  { key: 'upper_2_1', label: '2–1', max: 5 },
  { key: 'upper_1_1', label: '1–1', max: 5 },
  { key: 'upper_1_2', label: '1–2', max: 5 },
  { key: 'upper_2_3', label: '2–3', max: 5 },
]
const LOWER_ANT_SEGMENTS = [
  { key: 'lower_3_2', label: '3–2', max: 5 },
  { key: 'lower_2_1', label: '2–1', max: 5 },
  { key: 'lower_1_1', label: '1–1', max: 5 },
  { key: 'lower_1_2', label: '1–2', max: 5 },
  { key: 'lower_2_3', label: '2–3', max: 5 },
]
const CONTACT_SCORE_OPTIONS = [
  { val: 0, desc: '0–1 mm' },{ val: 1, desc: '1.1–2 mm' },{ val: 2, desc: '2.1–4 mm' },
  { val: 3, desc: '4.1–8 mm' },{ val: 4, desc: '>8 mm' },{ val: 5, desc: 'Impacted (≤4 mm space)' },
]
const BUCCAL_AP_OPTIONS = [
  { val: 0, desc: 'Good interdigitation' },{ val: 1, desc: '<½ unit from full interdigitation' },{ val: 2, desc: '½ unit discrepancy on any tooth' },
]
const BUCCAL_TRANS_OPTIONS = [
  { val: 0, desc: 'No crossbite' },{ val: 1, desc: 'Crossbite tendency' },
  { val: 2, desc: 'Single tooth in crossbite' },{ val: 3, desc: '>1 tooth in crossbite' },{ val: 4, desc: '>1 tooth in scissor bite' },
]
const BUCCAL_VERT_OPTIONS = [
  { val: 0, desc: 'No posterior open bite' },{ val: 1, desc: 'Post. open bite >2 mm on ≥2 teeth' },
]
const OVERJET_POS_OPTIONS = [
  { val: 0, desc: '0–3 mm' },{ val: 1, desc: '3.1–5 mm' },{ val: 2, desc: '5.1–7 mm' },{ val: 3, desc: '7.1–9 mm' },{ val: 4, desc: '>9 mm' },
]
const OVERJET_NEG_OPTIONS = [
  { val: 0, desc: 'No anterior teeth in crossbite' },{ val: 1, desc: 'One or more teeth edge-to-edge' },
  { val: 2, desc: 'Single tooth in crossbite' },{ val: 3, desc: 'Two teeth in crossbite' },{ val: 4, desc: '>2 teeth in crossbite' },
]
const OVERBITE_OB_OPTIONS = [
  { val: 0, desc: '<⅓ coverage of lower incisor' },{ val: 1, desc: '⅓ to <⅔ coverage' },
  { val: 2, desc: '>⅔ coverage' },{ val: 3, desc: '≥Full coverage' },
]
const OVERBITE_OPEN_OPTIONS = [
  { val: 0, desc: 'No open bite' },{ val: 1, desc: '≤1 mm open bite' },
  { val: 2, desc: '1.1–2 mm' },{ val: 3, desc: '2.1–4 mm' },{ val: 4, desc: '>4 mm' },
]
const CENTRELINE_OPTIONS = [
  { val: 0, desc: 'Coincident or ≤¼ width of lower incisor' },
  { val: 1, desc: '¼ to ½ width of lower incisor' },{ val: 2, desc: '>½ width of lower incisor' },
]

const EMPTY_DETAIL = () => ({
  upper_3_2: 0, upper_2_1: 0, upper_1_1: 0, upper_1_2: 0, upper_2_3: 0,
  lower_3_2: 0, lower_2_1: 0, lower_1_1: 0, lower_1_2: 0, lower_2_3: 0,
  buccal_ap_right: 0, buccal_ap_left: 0,
  buccal_trans_right: 0, buccal_trans_left: 0,
  buccal_vert_right: 0, buccal_vert_left: 0,
  overjet_pos: 0, overjet_neg: 0,
  overbite_ob: 0, overbite_open: 0,
  centreline: 0,
})

function computeWeighted(d) {
  const upperRaw   = Math.max(d.upper_3_2, d.upper_2_1, d.upper_1_1, d.upper_1_2, d.upper_2_3)
  const lowerRaw   = Math.max(d.lower_3_2, d.lower_2_1, d.lower_1_1, d.lower_1_2, d.lower_2_3)
  const buccalAP   = Math.max(d.buccal_ap_right, d.buccal_ap_left)
  const buccalTrans= Math.max(d.buccal_trans_right, d.buccal_trans_left)
  const buccalVert = Math.max(d.buccal_vert_right, d.buccal_vert_left)
  const overjetRaw = Math.max(d.overjet_pos, d.overjet_neg)
  const overbiteRaw= Math.max(d.overbite_ob, d.overbite_open)
  const centrelineRaw = d.centreline
  const weighted = upperRaw*1 + lowerRaw*1 + buccalAP*1 + buccalTrans*1 + buccalVert*1
                 + overjetRaw*6 + overbiteRaw*2 + centrelineRaw*4
  return weighted
}

function ScoreSelect({ label, options, value, onChange }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>{label}</label>
      <select value={value} onChange={e => onChange(+e.target.value)}
        style={{ width: '100%', fontSize: 13, padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--border)' }}>
        {options.map(opt => <option key={opt.val} value={opt.val}>{opt.val} — {opt.desc}</option>)}
      </select>
    </div>
  )
}

export default function TrainingSubmit() {
  const navigate = useNavigate()
  const [step, setStep]   = useState(1)
  const [setId, setSetId] = useState(null)

  // Step 1 state
  const [meta, setMeta]       = useState({ anonymisedLabel: '', groundTruthPar: '', sourceDescription: '', reviewerId: '' })
  const [reviewers, setReviewers] = useState([])
  const [metaErr, setMetaErr] = useState('')
  const [saving, setSaving]   = useState(false)
  const [parMode, setParMode] = useState('manual')   // 'manual' | 'component'
  const [parDetail, setParDetail] = useState(EMPTY_DETAIL())

  // Load reviewers on mount — filtered to ORTHODONTIST only
  useEffect(() => {
    trainingApi.getReviewers()
      .then(({ data }) => {
        // Only keep orthodontists
        const orthos = data.filter(r => r.role === 'ORTHODONTIST' || !r.role)
        setReviewers(orthos)
      })
      .catch(() => {})
  }, [])

  // Step 2 state
  const [files, setFiles]           = useState({})
  const [fileErrors, setFileErrors] = useState({})
  const [uploading, setUploading]   = useState(false)
  const [uploadErr, setUploadErr]   = useState('')

  // ── Step 1: create training set entry ──────────────────────────
  const createSet = async e => {
    e.preventDefault()
    const finalPar = parMode === 'component' ? computeWeighted(parDetail) : +meta.groundTruthPar
    if (!finalPar && finalPar !== 0) {
      setMetaErr('Ground-truth PAR score is required and must be ≥ 0.'); return
    }
    if (finalPar < 0) {
      setMetaErr('Ground-truth PAR score must be ≥ 0.'); return
    }
    if (!meta.reviewerId) {
      setMetaErr('Please select an orthodontist reviewer.'); return
    }
    setSaving(true)
    try {
      const { data } = await trainingApi.create({
        anonymisedLabel:   meta.anonymisedLabel,
        groundTruthPar:    finalPar,
        sourceDescription: meta.sourceDescription,
        reviewerId:        +meta.reviewerId,
      })
      setSetId(data.id)
      setStep(2)
    } catch (err) {
      setMetaErr(err.response?.data?.message || 'Failed to create submission.')
    } finally { setSaving(false) }
  }

  // ── Step 2: upload 3 model files ───────────────────────────────
  const uploadModels = async () => {
    const errs = {}
    ;['upperFile', 'lowerFile', 'buccalFile'].forEach(k => {
      if (!files[k]) errs[k] = 'Required'
    })
    if (Object.keys(errs).length) { setFileErrors(errs); return }

    setUploading(true); setUploadErr('')
    try {
      const fd = new FormData()
      fd.append('upperFile',  files.upperFile)
      fd.append('lowerFile',  files.lowerFile)
      fd.append('buccalFile', files.buccalFile)
      await trainingApi.uploadModels(setId, fd)
      setStep(3)
    } catch (err) {
      setUploadErr(err.response?.data?.message || 'Upload failed. Check file formats (STL/OBJ, max 50 MB each).')
    } finally { setUploading(false) }
  }

  return (
    <div className="page">
      <h1 style={{ marginBottom: 6 }}>Submit Training Models</h1>
      <p style={{ marginBottom: 28 }}>
        Contribute anonymised 3D dental model sets to the ML training dataset. Each submission requires
        three model files and a ground-truth PAR score verified by your supervising orthodontist.
      </p>

      {/* Progress steps */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 28 }}>
        {['Case Details', '3D Model Upload', 'Complete'].map((label, i) => {
          const n = i + 1
          const done = step > n, active = step === n
          return (
            <div key={n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
                  background: done ? 'var(--green)' : active ? 'var(--blue-mid)' : 'var(--gray-200)',
                  color: done || active ? '#fff' : 'var(--gray-600)',
                }}>{done ? '✓' : n}</div>
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'var(--blue-dark)' : 'var(--text-muted)' }}>
                  {label}
                </span>
              </div>
              {i < 2 && <div style={{ flex: 1, height: 1, background: 'var(--border)', margin: '0 12px' }} />}
            </div>
          )
        })}
      </div>

      {/* ── Step 1 ──────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="card" style={{ maxWidth: 560 }}>
          <div className="card-title">Step 1 — Case Details</div>
          {metaErr && <div className="alert alert-error">{metaErr}</div>}

          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            All submissions must be fully anonymised. Do not include any real patient identifiers.
          </div>

          <form onSubmit={createSet}>
            <div className="form-group">
              <label>Anonymised Case Label *</label>
              <input value={meta.anonymisedLabel}
                onChange={e => setMeta(m => ({ ...m, anonymisedLabel: e.target.value }))}
                placeholder="e.g. CASE-A-2024-01 (no real patient data)" required />
              <span className="form-hint">A label you assign — do not use the real patient reference ID.</span>
            </div>
            <div className="form-group">
              <label>Ground-Truth PAR Score *</label>
              {/* Mode toggle */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 12, border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', width: 'fit-content' }}>
                <button type="button" onClick={() => setParMode('manual')} style={{
                  padding: '7px 18px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12,
                  background: parMode === 'manual' ? 'var(--blue-mid)' : 'var(--gray-50)',
                  color: parMode === 'manual' ? '#fff' : 'var(--text-muted)',
                  borderRight: '1px solid var(--border)',
                }}>✏️ Enter Score Directly</button>
                <button type="button" onClick={() => setParMode('component')} style={{
                  padding: '7px 18px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12,
                  background: parMode === 'component' ? '#4f46e5' : 'var(--gray-50)',
                  color: parMode === 'component' ? '#fff' : 'var(--text-muted)',
                }}>📊 Score by Component</button>
              </div>

              {parMode === 'manual' && (
                <>
                  <input type="number" min={0} max={200}
                    value={meta.groundTruthPar}
                    onChange={e => setMeta(m => ({ ...m, groundTruthPar: e.target.value }))}
                    placeholder="Verified by supervising orthodontist" required />
                  <span className="form-hint">The weighted PAR score provided by your supervising orthodontist.</span>
                </>
              )}

              {parMode === 'component' && (
                <div style={{ border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginTop: 4 }}>
                  <div style={{ background: 'var(--blue-dark)', color: '#fff', padding: '8px 14px', fontWeight: 700, fontSize: 13 }}>
                    PAR Component Scoring (British weightings)
                  </div>
                  <div style={{ padding: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--blue-dark)', marginBottom: 6 }}>1. Upper Anterior Segments ×1</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginBottom: 12 }}>
                      {UPPER_ANT_SEGMENTS.map(seg => (
                        <ScoreSelect key={seg.key} label={seg.label} options={CONTACT_SCORE_OPTIONS}
                          value={parDetail[seg.key]} onChange={v => setParDetail(d => ({ ...d, [seg.key]: v }))} />
                      ))}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--blue-dark)', marginBottom: 6 }}>2. Lower Anterior Segments ×1</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginBottom: 12 }}>
                      {LOWER_ANT_SEGMENTS.map(seg => (
                        <ScoreSelect key={seg.key} label={seg.label} options={CONTACT_SCORE_OPTIONS}
                          value={parDetail[seg.key]} onChange={v => setParDetail(d => ({ ...d, [seg.key]: v }))} />
                      ))}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--blue-dark)', marginBottom: 6 }}>3. Buccal Occlusion ×1</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>AP</div>
                        <ScoreSelect label="Right" options={BUCCAL_AP_OPTIONS} value={parDetail.buccal_ap_right} onChange={v => setParDetail(d => ({ ...d, buccal_ap_right: v }))} />
                        <ScoreSelect label="Left"  options={BUCCAL_AP_OPTIONS} value={parDetail.buccal_ap_left}  onChange={v => setParDetail(d => ({ ...d, buccal_ap_left:  v }))} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Transverse</div>
                        <ScoreSelect label="Right" options={BUCCAL_TRANS_OPTIONS} value={parDetail.buccal_trans_right} onChange={v => setParDetail(d => ({ ...d, buccal_trans_right: v }))} />
                        <ScoreSelect label="Left"  options={BUCCAL_TRANS_OPTIONS} value={parDetail.buccal_trans_left}  onChange={v => setParDetail(d => ({ ...d, buccal_trans_left:  v }))} />
                      </div>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--blue-dark)', marginBottom: 6 }}>4. Overjet ×6</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <ScoreSelect label="Positive Overjet" options={OVERJET_POS_OPTIONS} value={parDetail.overjet_pos} onChange={v => setParDetail(d => ({ ...d, overjet_pos: v }))} />
                      <ScoreSelect label="Reverse Overjet"  options={OVERJET_NEG_OPTIONS} value={parDetail.overjet_neg} onChange={v => setParDetail(d => ({ ...d, overjet_neg: v }))} />
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--blue-dark)', marginBottom: 6 }}>5. Overbite ×2</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <ScoreSelect label="Overbite"  options={OVERBITE_OB_OPTIONS}   value={parDetail.overbite_ob}   onChange={v => setParDetail(d => ({ ...d, overbite_ob:   v }))} />
                      <ScoreSelect label="Open Bite" options={OVERBITE_OPEN_OPTIONS} value={parDetail.overbite_open} onChange={v => setParDetail(d => ({ ...d, overbite_open: v }))} />
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--blue-dark)', marginBottom: 6 }}>6. Centreline ×4</div>
                    <div style={{ maxWidth: 300, marginBottom: 12 }}>
                      <ScoreSelect label="Centreline" options={CENTRELINE_OPTIONS} value={parDetail.centreline} onChange={v => setParDetail(d => ({ ...d, centreline: v }))} />
                    </div>
                    <div style={{ padding: '10px 14px', background: 'var(--blue-pale)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'var(--blue-dark)', fontSize: 13 }}>Computed Weighted PAR Score</span>
                      <span style={{ fontWeight: 800, fontSize: 22, color: 'var(--blue-dark)' }}>{computeWeighted(parDetail)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Source Description (optional)</label>
              <textarea value={meta.sourceDescription}
                onChange={e => setMeta(m => ({ ...m, sourceDescription: e.target.value }))}
                placeholder="e.g. University clinic teaching collection — Cohort 2023" />
            </div>
            <div className="form-group">
              <label>Assign to Orthodontist Reviewer *</label>
              <select value={meta.reviewerId}
                onChange={e => setMeta(m => ({ ...m, reviewerId: e.target.value }))}
                required>
                <option value="">Select an orthodontist reviewer…</option>
                {reviewers.length === 0 && (
                  <option disabled value="">No orthodontists registered yet</option>
                )}
                {reviewers.map(r => (
                  <option key={r.id} value={r.id}>Dr. {r.name}</option>
                ))}
              </select>
              <span className="form-hint">
                Only registered orthodontists are shown. They will review and approve your submission.
              </span>
            </div>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : 'Next: Upload Models →'}
            </button>
          </form>
        </div>
      )}

      {/* ── Step 2 ──────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="card" style={{ maxWidth: 680 }}>
          <div className="card-title">Step 2 — Upload 3D Model Files</div>
          <p style={{ marginBottom: 20, fontSize: 13 }}>
            Upload the three dental scan files for this training set. Each file must be in STL or OBJ format, max 50 MB.
          </p>

          <ModelUploadSlots
            files={files}
            onChange={(k, f) => { setFiles(p => ({ ...p, [k]: f })); setFileErrors(e => ({ ...e, [k]: null })) }}
            errors={fileErrors}
          />

          {uploadErr && <div className="alert alert-error" style={{ marginTop: 14 }}>{uploadErr}</div>}

          <div className="flex gap-8" style={{ marginTop: 20 }}>
            <button className="btn btn-primary" onClick={uploadModels} disabled={uploading}>
              {uploading ? <><span className="spinner" /> Uploading…</> : '⬆ Upload & Submit'}
            </button>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
          </div>
        </div>
      )}

      {/* ── Step 3 ──────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ marginBottom: 8 }}>Submission Complete!</h2>
          <p style={{ marginBottom: 24, fontSize: 14 }}>
            Your 3D model set has been submitted for review. The assigned orthodontist will approve or reject it shortly.
          </p>
          <div className="flex gap-8" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => navigate('/training')}>View My Submissions</button>
            <button className="btn btn-outline" onClick={() => {
              setStep(1); setFiles({})
              setMeta({ anonymisedLabel: '', groundTruthPar: '', sourceDescription: '', reviewerId: '' })
            }}>Submit Another</button>
          </div>
        </div>
      )}
    </div>
  )
}
