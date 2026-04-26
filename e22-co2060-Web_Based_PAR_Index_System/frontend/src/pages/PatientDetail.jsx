import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { patientApi, caseApi } from '../api/api'
import { useAuth } from '../context/AuthContext'

export default function PatientDetail() {
  const { id } = useParams()
  const { user, isAdmin, isOrthodontist } = useAuth()
  const [patient, setPatient] = useState(null)
  const [cases, setCases]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true); setError('')
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
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
        <Link to="/patients" style={{ color: 'var(--blue-mid)' }}>Patients</Link>
        {' / '}
        <span>{patient.name}</span>
      </div>

      {/* Admin notice */}
      {isAdmin() && (
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          👁 You are viewing this patient record as <strong>Administrator</strong>. Case editing is restricted to orthodontists.
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h1>{patient.name}</h1>
          <span className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>{patient.referenceId}</span>
        </div>
        {isOrthodontist() && (
          <Link to={`/patients/${patient.id}/cases/new`} className="btn btn-primary">+ New Case</Link>
        )}
      </div>

      {/* Info card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Patient Details</div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Orthodontic Cases ({cases.length})</h2>
      </div>

      {cases.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
          No cases yet.{' '}
          {isOrthodontist() && (
            <Link to={`/patients/${patient.id}/cases/new`} style={{ color: 'var(--blue-mid)' }}>
              Create the first case →
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cases.map(c => (
            <CaseRow
              key={c.id}
              c={c}
              canOpen={isOrthodontist()}
              currentUserName={user?.name}
            />
          ))}
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

function CaseRow({ c, canOpen, currentUserName }) {
  const stageBadge = c.stage === 'PRE'
    ? <span className="badge badge-blue">Pre-treatment</span>
    : <span className="badge badge-green">Post-treatment</span>

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {new Date(c.createdAt).toLocaleDateString()}
          </span>
          {canOpen ? (
            <Link to={`/cases/${c.id}`} className="btn btn-primary btn-sm">
              Open →
            </Link>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Read-only
            </span>
          )}
        </div>
      </div>
      {c.notes && <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-muted)' }}>{c.notes}</p>}
    </div>
  )
}
