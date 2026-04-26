import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { caseApi } from '../api/api'

export default function NewCase() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const [stage, setStage]   = useState('PRE')
  const [notes, setNotes]   = useState('')
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

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
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Treatment Stage</label>
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              {[
                { value: 'PRE',  label: 'Pre-treatment',  desc: 'Initial assessment before treatment begins' },
                { value: 'POST', label: 'Post-treatment', desc: 'Final assessment after treatment completion' },
              ].map(s => (
                <label key={s.value} style={{
                  flex: 1, padding: '14px 16px', border: `1.5px solid ${stage === s.value ? 'var(--blue-mid)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  background: stage === s.value ? 'var(--blue-pale)' : '#fff', transition: 'all .15s',
                }}>
                  <input type="radio" value={s.value} checked={stage === s.value}
                    onChange={() => setStage(s.value)} style={{ display: 'none' }} />
                  <div style={{ fontWeight: 600, color: 'var(--blue-dark)', fontSize: 14 }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{s.desc}</div>
                </label>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any relevant clinical observations…" />
          </div>
          <div className="flex gap-8">
            <button className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : 'Create Case'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}