import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { trainingApi } from '../api/api'
import ModelUploadSlots from '../components/ModelUploadSlots'

export default function TrainingSubmit() {
  const navigate = useNavigate()
  const [step, setStep]   = useState(1)   // 1=metadata, 2=upload, 3=done
  const [setId, setSetId] = useState(null)

  // Step 1 state
  const [meta, setMeta]     = useState({ anonymisedLabel: '', groundTruthPar: '', sourceDescription: '', reviewerId: '' })
  const [reviewers, setReviewers] = useState([])
  const [metaErr, setMetaErr] = useState('')
  const [saving, setSaving]   = useState(false)

  // Load reviewers on mount
  useEffect(() => {
    trainingApi.getReviewers().then(({ data }) => setReviewers(data)).catch(() => {})
  }, [])

  // Step 2 state
  const [files, setFiles]       = useState({})
  const [fileErrors, setFileErrors] = useState({})
  const [uploading, setUploading]   = useState(false)
  const [uploadErr, setUploadErr]   = useState('')

  // ── Step 1: create training set entry ────────────────────────────
  const createSet = async e => {
    e.preventDefault()
    if (!meta.groundTruthPar || +meta.groundTruthPar < 0) {
      setMetaErr('Ground-truth PAR score is required and must be ≥ 0.'); return
    }
    if (!meta.reviewerId) {
      setMetaErr('Please select a reviewer.'); return
    }
    setSaving(true)
    try {
      const { data } = await trainingApi.create({
        anonymisedLabel:    meta.anonymisedLabel,
        groundTruthPar:     +meta.groundTruthPar,
        sourceDescription:  meta.sourceDescription,
        reviewerId:         +meta.reviewerId,
      })
      setSetId(data.id)
      setStep(2)
    } catch (err) {
      setMetaErr(err.response?.data?.message || 'Failed to create submission.')
    } finally { setSaving(false) }
  }

  // ── Step 2: upload 3 model files ─────────────────────────────────
  const uploadModels = async () => {
    const errs = {}
    ;['upperFile', 'lowerFile', 'buccalFile'].forEach(k => {
      if (!files[k]) errs[k] = 'Required'
    })
    if (Object.keys(errs).length) { setFileErrors(errs); return }

    setUploading(true)
    setUploadErr('')
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
        Contribute anonymised 3D dental model sets to the ML training dataset. Each submission requires three model files and a ground-truth PAR score verified by your supervising clinician.
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
                }}>
                  {done ? '✓' : n}
                </div>
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'var(--blue-dark)' : 'var(--text-muted)' }}>
                  {label}
                </span>
              </div>
              {i < 2 && <div style={{ flex: 1, height: 1, background: 'var(--border)', margin: '0 12px' }} />}
            </div>
          )
        })}
      </div>

      {/* ── Step 1 ───────────────────────────────────────────────── */}
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
              <input type="number" min={0} max={200}
                value={meta.groundTruthPar}
                onChange={e => setMeta(m => ({ ...m, groundTruthPar: e.target.value }))}
                placeholder="Verified by supervising clinician" required />
              <span className="form-hint">The weighted PAR score provided by your supervising clinician.</span>
            </div>
            <div className="form-group">
              <label>Source Description (optional)</label>
              <textarea value={meta.sourceDescription}
                onChange={e => setMeta(m => ({ ...m, sourceDescription: e.target.value }))}
                placeholder="e.g. University clinic teaching collection — Cohort 2023" />
            </div>
            <div className="form-group">
              <label>Assign to Reviewer *</label>
              <select value={meta.reviewerId}
                onChange={e => setMeta(m => ({ ...m, reviewerId: e.target.value }))}
                required>
                <option value="">Select a dentist or orthodontist</option>
                {reviewers.map(r => (
                  <option key={r.id} value={r.id}>{r.name} ({r.role})</option>
                ))}
              </select>
              <span className="form-hint">The selected professional will review and approve your submission.</span>
            </div>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : 'Next: Upload Models →'}
            </button>
          </form>
        </div>
      )}

      {/* ── Step 2 ───────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="card" style={{ maxWidth: 680 }}>
          <div className="card-title">Step 2 — Upload 3D Model Files</div>
          <p style={{ marginBottom: 20, fontSize: 13 }}>
            Upload the three dental scan files for this training set. Each file must be in STL or OBJ format, max 50 MB.
          </p>

          <ModelUploadSlots files={files} onChange={(k, f) => { setFiles(p => ({ ...p, [k]: f })); setFileErrors(e => ({ ...e, [k]: null })) }} errors={fileErrors} />

          {uploadErr && <div className="alert alert-error" style={{ marginTop: 14 }}>{uploadErr}</div>}

          <div className="flex gap-8" style={{ marginTop: 20 }}>
            <button className="btn btn-primary" onClick={uploadModels} disabled={uploading}>
              {uploading ? <><span className="spinner" /> Uploading…</> : '⬆ Upload & Submit'}
            </button>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
          </div>
        </div>
      )}

      {/* ── Step 3 ───────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ marginBottom: 8 }}>Submission Complete!</h2>
          <p style={{ marginBottom: 24, fontSize: 14 }}>
            Your 3D model set has been submitted for review. An admin will approve or reject it shortly.
          </p>
          <div className="flex gap-8" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => navigate('/training')}>View My Submissions</button>
            <button className="btn btn-outline" onClick={() => { setStep(1); setFiles({}); setMeta({ anonymisedLabel: '', groundTruthPar: '', sourceDescription: '', reviewerId: '' }) }}>
              Submit Another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}