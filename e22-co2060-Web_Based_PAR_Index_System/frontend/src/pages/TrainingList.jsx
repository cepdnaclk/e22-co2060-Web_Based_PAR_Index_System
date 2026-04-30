import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { trainingApi } from '../api/api'
import { useAuth } from '../context/AuthContext'
import Model3DViewer from '../components/Model3DViewer'

const STATUS_BADGE = {
  PENDING:  'badge-amber',
  APPROVED: 'badge-green',
  REJECTED: 'badge-coral',
}

export default function TrainingList() {
  const { isAdmin } = useAuth()
  const [sets, setSets]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('ALL')
  const [viewingSet, setViewingSet] = useState(null)   // for 3D model viewer
  const [viewerSlot, setViewerSlot] = useState('UPPER')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data } = isAdmin()
        ? await trainingApi.listAll()
        : await trainingApi.listMy()
      setSets(data)
    } catch (_) {}
    finally { setLoading(false) }
  }

  async function deleteSet(id) {
    if (!window.confirm('Delete this pending submission?')) return
    try {
      await trainingApi.delete(id)
      setSets(s => s.filter(t => t.id !== id))
    } catch (err) { alert(err.response?.data?.message || 'Delete failed.') }
  }

  const filtered = filter === 'ALL' ? sets : sets.filter(s => s.status === filter)
  const counts = {
    ALL:      sets.length,
    PENDING:  sets.filter(s => s.status === 'PENDING').length,
    APPROVED: sets.filter(s => s.status === 'APPROVED').length,
    REJECTED: sets.filter(s => s.status === 'REJECTED').length,
  }

  return (
    <div className="page">
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1>{isAdmin() ? 'All Training Submissions' : 'My Submissions'}</h1>
          <p style={{ marginTop: 3 }}>
            {sets.length} total set{sets.length !== 1 ? 's' : ''} contributed to the ML training dataset
          </p>
        </div>
        {!isAdmin() && (
          <Link to="/training/submit" className="btn btn-primary">+ New Submission</Link>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}>
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="centered"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            {filter === 'ALL' ? 'No submissions yet.' : `No ${filter.toLowerCase()} submissions.`}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Ground-Truth PAR</th>
                <th>Models</th>
                <th>Submitted</th>
                <th>Reviewer</th>
                <th>Status</th>
                <th>Reviewer Note</th>
                {!isAdmin() && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{t.anonymisedLabel}</div>
                    {t.sourceDescription && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {t.sourceDescription}
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--blue-dark)' }}>
                      {t.groundTruthPar}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {new Date(t.submittedAt).toLocaleDateString()}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {t.reviewer ? `Dr. ${t.reviewer.name}` : '—'}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[t.status]}`}>{t.status}</span>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {t.reviewerComment ?? '—'}
                  </td>
                  {!isAdmin() && (
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(t.modelFiles?.length ?? 0) > 0 && (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              if (viewingSet?.id === t.id) { setViewingSet(null) }
                              else { setViewingSet(t); setViewerSlot(t.modelFiles?.[0]?.slot ?? 'UPPER') }
                            }}
                          >
                            {viewingSet?.id === t.id ? '▲ Hide' : '🔍 View 3D'}
                          </button>
                        )}
                        {t.status === 'PENDING' && (
                          <button className="btn btn-danger btn-sm" onClick={() => deleteSet(t.id)}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── 3D Model Viewer (undergraduate self-view) ─────────────── */}
      {viewingSet && !isAdmin() && (
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="card-title" style={{ margin: 0 }}>3D Models — {viewingSet.anonymisedLabel}</div>
            <button onClick={() => setViewingSet(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {viewingSet.modelFiles.map(f => (
              <button key={f.id} onClick={() => setViewerSlot(f.slot)}
                className={`btn btn-sm ${viewerSlot === f.slot ? 'btn-primary' : 'btn-outline'}`}>
                {f.slot}
              </button>
            ))}
          </div>
          <Model3DViewer
            modelUrl={trainingApi.getModelUrl(viewingSet.id, viewerSlot)}
            modelType={viewingSet.modelFiles.find(f => f.slot === viewerSlot)?.fileName?.split('.').pop()?.toLowerCase() ?? 'stl'}
            label={`${viewerSlot} arch — ${viewingSet.anonymisedLabel}`}
            height={340}
          />
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {viewingSet.modelFiles.map(f => (
              <div key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', background: 'var(--gray-50)',
                border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: 'var(--blue-mid)' }}>{f.slot}</span>
                <span style={{ color: 'var(--text-muted)' }}>{f.fileName}</span>
                <span style={{ color: 'var(--text-muted)' }}>({f.fileSizeMb} MB)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{
        marginTop: 24, borderLeft: '4px solid var(--amber)',
        background: 'var(--amber-light)', padding: '14px 18px'
      }}>
        <div style={{ fontWeight: 600, color: 'var(--amber)', fontSize: 13, marginBottom: 4 }}>
          🤖 How your submissions are used
        </div>
        <p style={{ fontSize: 13 }}>
          Approved submissions form the ML training dataset. A deep-learning model will be
          trained on these 3D model sets in a future phase to automate PAR score prediction.
        </p>
      </div>
    </div>
  )
}
