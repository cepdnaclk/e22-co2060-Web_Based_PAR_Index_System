import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { patientApi } from '../api/api'

export default function PatientList() {
  const [patients, setPatients] = useState([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [showNew, setShowNew]   = useState(false)
  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data } = await patientApi.list()
      setPatients(data)
    } catch (_) {}
    finally { setLoading(false) }
  }

  const filtered = patients.filter(p =>
    (p.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.referenceId ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page">
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1>Patients</h1>
          <p style={{ marginTop: 3 }}>{patients.length} active record{patients.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Patient</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          placeholder="Search by name or reference ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 340 }}
        />
      </div>

      {showNew && (
        <NewPatientForm
          onSaved={p => { setShowNew(false); navigate(`/patients/${p.id}`) }}
          onCancel={() => setShowNew(false)}
        />
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="centered"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            {search ? 'No patients match your search.' : 'No patients yet. Create one above.'}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Reference ID</th>
                <th>Name</th>
                <th>Date of Birth</th>
                <th>Contact</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td><span className="font-mono text-sm">{p.referenceId}</span></td>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td>{p.dateOfBirth ?? '—'}</td>
                  <td>{p.contact ?? '—'}</td>
                  <td>
                    <span className={`badge ${p.isArchived ? 'badge-gray' : 'badge-green'}`}>
                      {p.isArchived ? 'Archived' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <Link to={`/patients/${p.id}`} className="btn btn-ghost btn-sm">View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function NewPatientForm({ onSaved, onCancel }) {
  const [form, setForm]     = useState({ referenceId: '', name: '', dateOfBirth: '', contact: '' })
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    if (!form.referenceId.trim()) { setError('Reference ID is required.'); return }
    if (!form.name.trim())        { setError('Name is required.'); return }
    setSaving(true)
    setError('')
    try {
      // FIXED: send plain JSON — PatientController now accepts Map<String,String>
      const { data } = await patientApi.create({
        referenceId:  form.referenceId.trim(),
        name:         form.name.trim(),
        dateOfBirth:  form.dateOfBirth || null,
        contact:      form.contact.trim() || null,
      })
      onSaved(data)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create patient.')
    } finally { setSaving(false) }
  }

  return (
    <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid var(--blue-mid)' }}>
      <h3 style={{ marginBottom: 16 }}>New Patient</h3>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={submit}>
        <div className="row">
          <div className="col form-group">
            <label>Reference ID *</label>
            <input name="referenceId" value={form.referenceId} onChange={handle}
              required placeholder="e.g. PT-2024-001" />
          </div>
          <div className="col form-group">
            <label>Full Name *</label>
            <input name="name" value={form.name} onChange={handle} required />
          </div>
        </div>
        <div className="row">
          <div className="col form-group">
            <label>Date of Birth</label>
            <input name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handle} />
          </div>
          <div className="col form-group">
            <label>Contact</label>
            <input name="contact" value={form.contact} onChange={handle} placeholder="Phone or email" />
          </div>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" /> : 'Save Patient'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
