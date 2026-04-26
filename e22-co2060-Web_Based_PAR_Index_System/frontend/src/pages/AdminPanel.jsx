import { useEffect, useState } from 'react'
import { adminApi, trainingApi } from '../api/api'

const ROLES      = ['DENTIST', 'ORTHODONTIST', 'UNDERGRADUATE', 'ADMIN']
const ROLE_BADGE = {
  DENTIST:       'badge-blue',
  ORTHODONTIST:  'badge-blue',
  UNDERGRADUATE: 'badge-purple',
  ADMIN:         'badge-coral',
}
const STATUS_BADGE = { PENDING: 'badge-amber', APPROVED: 'badge-green', REJECTED: 'badge-coral' }

export default function AdminPanel() {
  const [tab, setTab] = useState('users')

  return (
    <div className="page">
      <h1 style={{ marginBottom: 6 }}>Admin Panel</h1>
      <p style={{ marginBottom: 24 }}>
        Manage users, roles, and review undergraduate training submissions.
      </p>

      <div style={{
        display: 'flex', gap: 0, marginBottom: 28,
        borderBottom: '1px solid var(--border)'
      }}>
        {[
          { key: 'users',    label: '👤 User Management' },
          { key: 'training', label: '📁 Training Review' },
          { key: 'audit',    label: '📋 Audit Log' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 20px', border: 'none', background: 'transparent',
            fontWeight: 500, fontSize: 14, cursor: 'pointer',
            color: tab === t.key ? 'var(--blue-mid)' : 'var(--text-muted)',
            borderBottom: tab === t.key ? '2px solid var(--blue-mid)' : '2px solid transparent',
            marginBottom: -1, transition: 'all .15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users'    && <UsersTab />}
      {tab === 'training' && <TrainingTab />}
      {tab === 'audit'    && <AuditTab />}
    </div>
  )
}

// ── Users Tab ────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { const { data } = await adminApi.users(); setUsers(data) }
    catch (_) {}
    finally { setLoading(false) }
  }

  async function toggleActive(id, currentlyActive) {
    try {
      await adminApi.setActive(id, !currentlyActive)
      setUsers(u => u.map(x => x.id === id ? { ...x, active: !currentlyActive } : x))
    } catch (err) { alert(err.response?.data?.message || 'Error.') }
  }

  async function changeRole(id, role) {
    try {
      await adminApi.changeRole(id, role)
      setUsers(u => u.map(x => x.id === id ? { ...x, role } : x))
    } catch (err) { alert(err.response?.data?.message || 'Error.') }
  }

  const filtered = users.filter(u =>
    (u.name  ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div className="row" style={{ marginBottom: 20 }}>
        <StatCard value={users.length}                                            label="Total Users"    color="var(--blue-dark)" />
        <StatCard value={users.filter(u => u.active !== false).length}            label="Active"         color="var(--green)" />
        <StatCard value={users.filter(u => u.role === 'ADMIN').length}            label="Admins"         color="var(--coral)" />
        <StatCard value={users.filter(u => u.role === 'UNDERGRADUATE').length}    label="Undergraduates" color="var(--purple)" />
      </div>

      <input placeholder="Search by name or email…" value={search}
        onChange={e => setSearch(e.target.value)} style={{ maxWidth: 340, marginBottom: 14 }} />

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="centered"><div className="spinner" /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Role</th>
                <th>Status</th><th>Change Role</th><th>Toggle</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.name}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{u.email}</td>
                  <td>
                    <span className={`badge ${ROLE_BADGE[u.role] ?? 'badge-gray'}`}>{u.role}</span>
                  </td>
                  <td>
                    <span className={`badge ${u.active !== false ? 'badge-green' : 'badge-gray'}`}>
                      {u.active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
                      style={{ width: 'auto', padding: '4px 8px', fontSize: 13 }}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    <button
                      className={`btn btn-sm ${u.active !== false ? 'btn-danger' : 'btn-green'}`}
                      onClick={() => toggleActive(u.id, u.active !== false)}>
                      {u.active !== false ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// ── Training Review Tab ──────────────────────────────────────────────────
function TrainingTab() {
  const [sets, setSets]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('PENDING')
  const [reviewing, setReviewing] = useState({})
  const [comments, setComments]   = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { const { data } = await trainingApi.listAll(); setSets(data) }
    catch (_) {}
    finally { setLoading(false) }
  }

  async function review(id, status) {
    setReviewing(r => ({ ...r, [id]: true }))
    try {
      await trainingApi.review(id, { status, comment: comments[id] ?? '' })
      setSets(s => s.map(t =>
        t.id === id ? { ...t, status, reviewerComment: comments[id] } : t))
    } catch (err) { alert(err.response?.data?.message || 'Review failed.') }
    finally { setReviewing(r => ({ ...r, [id]: false })) }
  }

  const filtered = filter === 'ALL' ? sets : sets.filter(s => s.status === filter)
  const counts = {
    ALL: sets.length,
    PENDING:  sets.filter(s => s.status === 'PENDING').length,
    APPROVED: sets.filter(s => s.status === 'APPROVED').length,
    REJECTED: sets.filter(s => s.status === 'REJECTED').length,
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 20 }}>
        <StatCard value={counts.PENDING}  label="Pending Review" color="var(--amber)" />
        <StatCard value={counts.APPROVED} label="Approved"       color="var(--green)" />
        <StatCard value={counts.REJECTED} label="Rejected"       color="var(--coral)" />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}>
            {f} ({counts[f] ?? sets.length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="centered"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          No {filter.toLowerCase()} submissions.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(t => (
            <div key={t.id} className="card" style={{ padding: '18px 20px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 600 }}>{t.anonymisedLabel}</span>
                  <span className={`badge ${STATUS_BADGE[t.status]}`}>{t.status}</span>
                  <span style={{ fontWeight: 700, color: 'var(--blue-dark)' }}>
                    PAR: {t.groundTruthPar}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Submitted by: {t.submittedBy?.name ?? '—'} &nbsp;·&nbsp;
                  {new Date(t.submittedAt).toLocaleDateString()}
                </span>
              </div>

              {t.sourceDescription && (
                <p style={{ fontSize: 13, marginBottom: 10 }}>{t.sourceDescription}</p>
              )}

              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {(t.modelFiles ?? []).map(f => (
                  <div key={f.id} style={{
                    padding: '5px 12px', background: 'var(--purple-light)',
                    borderRadius: 'var(--radius-sm)', fontSize: 12
                  }}>
                    <span style={{ fontWeight: 600, color: 'var(--purple)' }}>{f.slot}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{f.fileName}</span>
                  </div>
                ))}
              </div>

              {t.reviewerComment && (
                <div className="alert alert-info" style={{ marginBottom: 10, fontSize: 13 }}>
                  Reviewer note: {t.reviewerComment}
                </div>
              )}

              {t.status === 'PENDING' && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <input placeholder="Optional reviewer comment…"
                      value={comments[t.id] ?? ''}
                      onChange={e => setComments(c => ({ ...c, [t.id]: e.target.value }))}
                      style={{ fontSize: 13 }} />
                  </div>
                  <button className="btn btn-green btn-sm" disabled={reviewing[t.id]}
                    onClick={() => review(t.id, 'APPROVED')}>
                    {reviewing[t.id] ? <span className="spinner" /> : '✅ Approve'}
                  </button>
                  <button className="btn btn-danger btn-sm" disabled={reviewing[t.id]}
                    onClick={() => review(t.id, 'REJECTED')}>
                    {reviewing[t.id] ? <span className="spinner" /> : '❌ Reject'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ── Audit Log Tab ────────────────────────────────────────────────────────
function AuditTab() {
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data } = await adminApi.auditLog()
      setLogs(data.content ?? data)
    } catch (_) {}
    finally { setLoading(false) }
  }

  const ACTION_COLOR = {
    REGISTER:               'badge-blue',
    LOGIN:                  'badge-gray',
    CREATE_PATIENT:         'badge-green',
    CREATE_CASE:            'badge-green',
    CALCULATE_PAR:          'badge-green',
    FINALIZE_CASE:          'badge-blue',
    UPLOAD_3D_MODELS:       'badge-purple',
    UPLOAD_TRAINING_MODELS: 'badge-purple',
    CREATE_TRAINING_SET:    'badge-amber',
    REVIEW_TRAINING_SET:    'badge-coral',
    ARCHIVE_PATIENT:        'badge-gray',
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {loading ? (
        <div className="centered"><div className="spinner" /></div>
      ) : logs.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
          No audit entries yet.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {new Date(log.performedAt).toLocaleString()}
                </td>
                <td style={{ fontSize: 13 }}>{log.performedBy?.name ?? '—'}</td>
                <td>
                  <span className={`badge ${ACTION_COLOR[log.action] ?? 'badge-gray'}`}
                    style={{ fontSize: 11 }}>
                    {log.action}
                  </span>
                </td>
                <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {log.entityType} #{log.entityId}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{log.detail ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function StatCard({ value, label, color }) {
  return (
    <div className="stat-card col">
      <div className="stat-card-value" style={{ color }}>{value}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  )
}
