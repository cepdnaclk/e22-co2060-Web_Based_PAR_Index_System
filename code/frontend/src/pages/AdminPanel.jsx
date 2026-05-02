import { useEffect, useState } from 'react'
import { adminApi, trainingApi } from '../api/api'

const ROLES      = ['ORTHODONTIST', 'UNDERGRADUATE', 'ADMIN']
const ROLE_BADGE = {
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
      <p style={{ marginBottom: 24 }}>Manage users, roles and view submission statuses.</p>

      <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: '1px solid var(--border)' }}>
        {[
          { key: 'users',    label: '👤 User Management' },
          { key: 'training', label: '📁 Submissions Overview' },
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
      {tab === 'training' && <TrainingOverviewTab />}
      {tab === 'audit'    && <AuditTab />}
    </div>
  )
}

// ── Users Tab ─────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')

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
    if (role === 'DENTIST') { alert('DENTIST role is no longer supported.'); return }
    try {
      await adminApi.changeRole(id, role)
      setUsers(u => u.map(x => x.id === id ? { ...x, role } : x))
    } catch (err) { alert(err.response?.data?.message || 'Error.') }
  }

  // Non-admin users only (exclude admins from display)
  const nonAdmins = users.filter(u => u.role !== 'ADMIN')
  const orthodontists  = nonAdmins.filter(u => u.role === 'ORTHODONTIST')
  const undergraduates = nonAdmins.filter(u => u.role === 'UNDERGRADUATE')

  const roleFiltered = roleFilter === 'ALL'
    ? nonAdmins
    : nonAdmins.filter(u => u.role === roleFilter)

  const searched = roleFiltered.filter(u =>
    (u.name  ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      {/* Stats — order: Orthodontists, Undergraduates */}
      <div className="row" style={{ marginBottom: 20 }}>
        <StatCard value={orthodontists.length}  label="Orthodontists"  color="var(--blue-mid)" />
        <StatCard value={undergraduates.length} label="Undergraduates" color="var(--purple)" />
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {['ALL', 'ORTHODONTIST', 'UNDERGRADUATE'].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`btn btn-sm ${roleFilter === r ? 'btn-primary' : 'btn-outline'}`}>
              {r === 'ALL' ? 'All' : r === 'ORTHODONTIST' ? 'Orthodontists' : 'Undergraduates'}
              {' '}({r === 'ALL' ? nonAdmins.length : r === 'ORTHODONTIST' ? orthodontists.length : undergraduates.length})
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="centered"><div className="spinner" /></div>
        ) : searched.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No users found.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Role</th>
                <th>Status</th><th>Change Role</th><th>Toggle</th>
              </tr>
            </thead>
            <tbody>
              {searched.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>
                    {u.role === 'ORTHODONTIST' ? `Dr. ${u.name}` : u.name}
                  </td>
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

// ── Submissions Overview Tab (READ-ONLY for admin) ────────────────────────
function TrainingOverviewTab() {
  const [sets, setSets]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('ALL')
  const [search, setSearch]   = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { const { data } = await trainingApi.listAll(); setSets(data) }
    catch (_) {}
    finally { setLoading(false) }
  }

  const counts = {
    ALL:      sets.length,
    PENDING:  sets.filter(s => s.status === 'PENDING').length,
    APPROVED: sets.filter(s => s.status === 'APPROVED').length,
    REJECTED: sets.filter(s => s.status === 'REJECTED').length,
  }

  const filtered = (filter === 'ALL' ? sets : sets.filter(s => s.status === filter))
    .filter(s =>
      (s.anonymisedLabel    ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (s.submittedBy?.name  ?? '').toLowerCase().includes(search.toLowerCase())
    )

  return (
    <>
      <div className="alert alert-info" style={{ marginBottom: 20 }}>
        👁 <strong>Read-only view.</strong> Approving and rejecting submissions is handled by the assigned orthodontist in their Review Submissions section.
      </div>

      {/* Stats */}
      <div className="row" style={{ marginBottom: 20 }}>
        <StatCard value={counts.PENDING}  label="Pending"  color="var(--amber)" />
        <StatCard value={counts.APPROVED} label="Approved" color="var(--green)" />
        <StatCard value={counts.REJECTED} label="Rejected" color="var(--coral)" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search by label or student name…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}>
              {f} ({counts[f] ?? sets.length})
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="centered"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          No {filter === 'ALL' ? '' : filter.toLowerCase() + ' '}submissions found.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Submitted By</th>
                <th>Reviewer (Orthodontist)</th>
                <th>PAR Score</th>
                <th>Models</th>
                <th>Date</th>
                <th>Status</th>
                <th>Reviewer Note</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 500 }}>{t.anonymisedLabel}</td>
                  <td style={{ fontSize: 13 }}>{t.submittedBy?.name ?? '—'}</td>
                  <td style={{ fontSize: 13 }}>
                    {t.reviewer ? `Dr. ${t.reviewer.name}` : '—'}
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: 'var(--blue-dark)' }}>
                      {t.groundTruthPar}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(t.modelFiles ?? []).map(f => (
                        <span key={f.id} className="badge badge-purple" style={{ fontSize: 11 }}>
                          {f.slot}
                        </span>
                      ))}
                      {(!t.modelFiles || t.modelFiles.length === 0) && (
                        <span className="badge badge-gray" style={{ fontSize: 11 }}>None</span>
                      )}
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(t.submittedAt).toLocaleDateString()}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[t.status]}`}>{t.status}</span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {t.reviewerComment ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ── Audit Log Tab ─────────────────────────────────────────────────────────
function AuditTab() {
  const [logs, setLogs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [actionFilter, setActionFilter] = useState('ALL')
  const [search, setSearch]     = useState('')

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
    UPDATE_PATIENT:         'badge-green',
    ARCHIVE_PATIENT:        'badge-gray',
    CREATE_CASE:            'badge-green',
    CALCULATE_PAR:          'badge-blue',
    FINALIZE_CASE:          'badge-blue',
    UPLOAD_3D_MODELS:       'badge-purple',
    UPLOAD_TRAINING_MODELS: 'badge-purple',
    CREATE_TRAINING_SET:    'badge-amber',
    REVIEW_TRAINING_SET:    'badge-coral',
    DELETE_TRAINING_SET:    'badge-coral',
  }

  const allActions = ['ALL', ...Object.keys(ACTION_COLOR)]

  const filtered = logs.filter(log => {
    const matchAction = actionFilter === 'ALL' || log.action === actionFilter
    const matchSearch = (log.performedBy?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
                        (log.action ?? '').toLowerCase().includes(search.toLowerCase()) ||
                        (log.entityType ?? '').toLowerCase().includes(search.toLowerCase())
    return matchAction && matchSearch
  })

  return (
    <>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search by user, action or entity…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280 }} />
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          style={{ width: 'auto', padding: '7px 12px', fontSize: 13 }}>
          {allActions.map(a => (
            <option key={a} value={a}>{a === 'ALL' ? 'All Actions' : a.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Showing {filtered.length} of {logs.length} entries
        </span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="centered"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            No audit entries match your filters.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Entity</th><th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <tr key={log.id}>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(log.performedAt).toLocaleString()}
                  </td>
                  <td style={{ fontSize: 13, fontWeight: 500 }}>
                    {log.performedBy?.role === 'ORTHODONTIST'
                      ? `Dr. ${log.performedBy?.name}`
                      : log.performedBy?.name ?? '—'}
                  </td>
                  <td>
                    <span className={`badge ${ROLE_BADGE[log.performedBy?.role] ?? 'badge-gray'}`}
                      style={{ fontSize: 11 }}>
                      {log.performedBy?.role ?? '—'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${ACTION_COLOR[log.action] ?? 'badge-gray'}`}
                      style={{ fontSize: 11 }}>
                      {log.action?.replace(/_/g, ' ')}
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
    </>
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
