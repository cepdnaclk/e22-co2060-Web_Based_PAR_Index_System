import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { patientApi, caseApi } from '../api/api'

export default function PatientDetail() {
  const { id } = useParams()
  const [patient, setPatient] = useState(null)
  const [cases, setCases]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [{ data: p }, { data: c }] = await Promise.all([
        patientApi.get(id),
        caseApi.listByPatient(id),
      ])
      setPatient(p)
      setCases(c)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load patient.')
    } finally { setLoading(false) }
  }

  if (loading) return <div className="centered"><div className="spinner spinner-lg" /></div>
  if (error)   return <div className="page"><div className="alert alert-error">{error}</div></div>
  if (!patient) return <div className="page"><div className="alert alert-error">Patient not found.</div></div>

  return (
    <div className="page">
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
        <Link to="/patients" style={{ color: 'var(--blue-mid)' }}>Patients</Link>
        {' / '}
        <span>{patient.name}</span>
      </div>

      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1>{patient.name}</h1>
          <span className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>
            {patient.referenceId}
          </span>
        </div>
        {/* FIXED: patient.id now correctly serialized (removed @JsonIgnore from entity) */}
        <Link to={`/patients/${patient.id}/cases/new`} className="btn btn-primary">
          + New Case
        </Link>
      </div>

      {/* Info card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Patient Details</div>
        <div className="row">
          <InfoRow label="Date of Birth" value={patient.dateOfBirth ?? '—'} />
          <InfoRow label="Contact"       value={patient.contact ?? '—'} />
          <InfoRow label="Status" value={
            <span className={`badge ${patient.isArchived ? 'badge-gray' : 'badge-green'}`}>
              {patient.isArchived ? 'Archived' : 'Active'}
            </span>
          } />
        </div>
      </div>

      {/* Cases */}
      <h2 style={{ marginBottom: 14 }}>Orthodontic Cases ({cases.length})</h2>
      {cases.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
          No cases yet.{' '}
          <Link to={`/patients/${patient.id}/cases/new`} style={{ color: 'var(--blue-mid)' }}>
            Create the first case →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cases.map(c => <CaseRow key={c.id} c={c} />)}
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="col">
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontWeight: 500 }}>{value}</div>
    </div>
  )
}

function CaseRow({ c }) {
  const stageBadge = c.stage === 'PRE'
    ? <span className="badge badge-blue">Pre-treatment</span>
    : <span className="badge badge-green">Post-treatment</span>

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div className="flex items-center justify-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {stageBadge}
          {c.isFinalized
            ? <span className="badge badge-gray">Finalised</span>
            : <span className="badge badge-amber">Draft</span>}
          {c.parScore && (
            <span style={{ fontWeight: 700, color: 'var(--blue-dark)', fontSize: 15 }}>
              PAR: {c.parScore.totalWeighted}
            </span>
          )}
        </div>
        <div className="flex items-center gap-8">
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {new Date(c.createdAt).toLocaleDateString()}
          </span>
          <Link to={`/cases/${c.id}`} className="btn btn-outline btn-sm">Open</Link>
        </div>
      </div>
      {c.notes && <p style={{ fontSize: 13, marginTop: 8 }}>{c.notes}</p>}
    </div>
  )
}
