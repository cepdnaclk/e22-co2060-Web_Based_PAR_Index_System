import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { caseApi } from '../api/api'

export default function NewCase() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const [stage, setStage]         = useState(null)   // null = loading
  const [notes, setNotes]         = useState('')
  const [error, setError]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [stageInfo, setStageInfo] = useState(null)   // context info for the user

  // ── Auto-detect the correct stage on mount ───────────────────────────────
  // Logic:
  //   • If there are any unfinalised cases -> Block creation
  //   • If no cases exist yet            → PRE  (first visit, always pre-treatment)
  //   • If a finalised PRE case exists   → POST (pre done, subsequent scans are post-treatment)
  useEffect(() => {
    async function detectStage() {
      try {
        const { data: existingCases } = await caseApi.listByPatient(patientId)
        const hasUnfinalised = existingCases.some(c => !(c.finalized === true || c.isFinalized === true))
        
        if (hasUnfinalised) {
          setStage('POST') // Doesn't matter
          setStageInfo({
            type: 'pending-any',
            message: 'There is an unfinalised case for this patient. Please finalise it before creating new records.',
          })
          return
        }

        const hasFinalisedPre = existingCases.some(
          c => c.stage === 'PRE' && (c.finalized === true || c.isFinalized === true)
        )

        if (hasFinalisedPre) {
          setStage('POST')
          setStageInfo({
            type: 'auto-post',
            message: 'A finalised pre-treatment record exists. This case is automatically set as post-treatment.',
          })
        } else {
          setStage('PRE')
          setStageInfo({
            type: 'first',
            message: 'This is the first case for this patient — set as pre-treatment by default.',
          })
        }
      } catch {
        // If we can't load cases, default to PRE and let backend enforce
        setStage('PRE')
      }
    }
    detectStage()
  }, [patientId])

  const submit = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await caseApi.create({ patientId, stage, notes })
      navigate(`/cases/${data.id}`)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create case.')
      setSaving(false)
    }
  }

  // Stage is still being determined
  if (stage === null) {
    return (
      <div className="page">
        <div className="centered" style={{ padding: 60 }}>
          <div className="spinner spinner-lg" />
          <div style={{ marginTop: 12, color: 'var(--text-muted)' }}>Determining treatment stage…</div>
        </div>
      </div>
    )
  }

  const stageOptions = [
    { value: 'PRE',  label: 'Pre-treatment',  desc: 'Initial assessment before treatment begins' },
    { value: 'POST', label: 'Post-treatment', desc: 'Follow-up assessment after treatment completion' },
  ]

  return (
    <div className="page">
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
        <Link to="/patients" style={{ color: 'var(--blue-mid)' }}>Patients</Link>
        {' / '}
        <Link to={`/patients/${patientId}`} style={{ color: 'var(--blue-mid)' }}>Patient</Link>
        {' / New Case'}
      </div>
      <h1 style={{ marginBottom: 24 }}>New Orthodontic Case</h1>

      <div className="card" style={{ maxWidth: 540 }}>
        {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}

        {/* Contextual stage hint */}
        {stageInfo && (
          <div className={`alert ${stageInfo.type === 'pending-any' ? 'alert-error' : 'alert-info'}`}
               style={{ marginBottom: 14, fontSize: 13 }}>
            {stageInfo.type === 'first'       && '🆕 '}
            {stageInfo.type === 'auto-post'   && '✅ '}
            {stageInfo.type === 'pending-any' && '⚠️ '}
            {stageInfo.message}
          </div>
        )}

        <form onSubmit={submit}>
          <div className="form-group">
            <label>Treatment Stage</label>
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              {stageOptions.map(s => {
                const isSelected = stage === s.value
                // PRE locked once a finalised PRE exists; POST locked until one does
                const isLocked =
                  (s.value === 'POST' && stageInfo?.type !== 'auto-post') ||
                  (s.value === 'PRE'  && stageInfo?.type === 'auto-post')
                return (
                  <label key={s.value} style={{
                    flex: 1, padding: '14px 16px',
                    border: `1.5px solid ${isSelected ? 'var(--blue-mid)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    opacity: isLocked ? 0.45 : 1,
                    background: isSelected ? 'var(--blue-pale)' : '#fff',
                    transition: 'all .15s',
                  }}>
                    <input type="radio" value={s.value} checked={isSelected}
                      disabled={isLocked}
                      onChange={() => !isLocked && setStage(s.value)}
                      style={{ display: 'none' }} />
                    <div style={{ fontWeight: 600, color: 'var(--blue-dark)', fontSize: 14 }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{s.desc}</div>
                    {isLocked && (
                      <div style={{ fontSize: 11, color: 'var(--coral)', marginTop: 4 }}>
                        {stageInfo?.type === 'pending-any'
                          ? 'Resolve pending case first'
                          : s.value === 'PRE'
                            ? 'Pre-treatment is complete for this patient'
                            : 'Requires a finalised pre-treatment case'}
                      </div>
                    )}
                  </label>
                )
              })}
            </div>
          </div>

          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any relevant clinical observations…" />
          </div>

          <div className="flex gap-8">
            <button className="btn btn-primary" disabled={saving || stageInfo?.type === 'pending-any'}>
              {saving ? <span className="spinner" /> : 'Create Case'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}