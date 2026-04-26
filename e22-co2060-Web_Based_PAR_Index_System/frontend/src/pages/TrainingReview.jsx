import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { trainingApi } from '../api/api'
import Model3DViewer from '../components/Model3DViewer'

const STATUS_BADGE = {
  PENDING:  'badge-amber',
  APPROVED: 'badge-green',
  REJECTED: 'badge-coral',
}

export default function TrainingReview() {
  const { user } = useAuth()
  const [submissions, setSubmissions] = useState([])
  const [selected, setSelected]       = useState(null)
  const [loading, setLoading]         = useState(true)
  const [reviewing, setReviewing]     = useState(false)
  const [reviewMsg, setReviewMsg]     = useState('')
  const [viewerSlot, setViewerSlot]   = useState('UPPER')
  const [filter, setFilter]           = useState('ALL')

  const drName = `Dr. ${user?.name}`

  useEffect(() => { loadSubmissions() }, [])

  async function loadSubmissions() {
    setLoading(true)
    try {
      const { data } = await trainingApi.listAssigned()
      setSubmissions(data)
    } catch (_) {}
    finally { setLoading(false) }
  }

  async function reviewSubmission(status, comment) {
    if (!selected) return
    setReviewing(true); setReviewMsg('')
    try {
      // Update submission status — this updates the TrainingSet in DB
      // The undergraduate's submission record is updated server-side (same TrainingSet entity)
      await trainingApi.review(selected.id, { status, comment: comment || '' })
      // Update local state — mark as reviewed rather than remove, so orthodontist sees history
      setSubmissions(s => s.map(sub =>
        sub.id === selected.id
          ? { ...sub, status, reviewerComment: comment || '', reviewedBy: drName }
          : sub
      ))
      setSelected(prev => ({ ...prev, status, reviewerComment: comment || '' }))
      setReviewMsg(status === 'APPROVED' ? 'approved' : 'rejected')
    } catch (err) {
      alert(err.response?.data?.message || 'Review failed.')
    } finally { setReviewing(false) }
  }

  const filtered = filter === 'ALL' ? submissions : submissions.filter(s => s.status === filter)

  const counts = {
    ALL:      submissions.length,
    PENDING:  submissions.filter(s => s.status === 'PENDING').length,
    APPROVED: submissions.filter(s => s.status === 'APPROVED').length,
    REJECTED: submissions.filter(s => s.status === 'REJECTED').length,
  }

  const selectedModelSlots = selected?.modelFiles?.map(f => f.slot) ?? []

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ marginBottom: 4 }}>Review Training Submissions</h1>
        <p>Submissions assigned to <strong>{drName}</strong> for review and approval.</p>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['ALL','PENDING','APPROVED','REJECTED'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}>
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1.5fr' : '1fr', gap: 20, alignItems: 'start' }}>

        {/* ── Submissions List ──────────────────────────────────── */}
        <div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {loading ? (
              <div className="centered" style={{ padding: 40 }}><div className="spinner" /></div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                {filter === 'ALL' ? 'No submissions assigned to you yet.' : `No ${filter.toLowerCase()} submissions.`}
              </div>
            ) : (
              <div>
                {filtered.map(sub => (
                  <div key={sub.id}
                    onClick={() => { setSelected(sub); setViewerSlot(sub.modelFiles?.[0]?.slot ?? 'UPPER'); setReviewMsg('') }}
                    style={{
                      padding: '14px 16px', cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      background: selected?.id === sub.id ? 'var(--blue-pale)' : '#fff',
                      borderLeft: selected?.id === sub.id ? '3px solid var(--blue-mid)' : '3px solid transparent',
                      transition: 'background .15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{sub.anonymisedLabel}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Submitted by <strong>{sub.submittedBy?.name}</strong> · {new Date(sub.submittedAt).toLocaleDateString()}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          PAR score: <strong>{sub.groundTruthPar}</strong> · {sub.modelFiles?.length ?? 0} model files
                        </div>
                      </div>
                      <span className={`badge ${STATUS_BADGE[sub.status]}`} style={{ flexShrink: 0 }}>{sub.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Submission Details ────────────────────────────────── */}
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Header card */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>{selected.anonymisedLabel}</div>
                  <span className={`badge ${STATUS_BADGE[selected.status]}`}>{selected.status}</span>
                </div>
                <button onClick={() => { setSelected(null); setReviewMsg('') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)', padding: 4 }}>✕</button>
              </div>

              {/* Undergraduate details */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                  Submitted By
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', fontSize: 13 }}>
                  <DetailRow label="Name"  value={selected.submittedBy?.name ?? '—'} />
                  <DetailRow label="Email" value={selected.submittedBy?.email ?? '—'} />
                  <DetailRow label="Role"  value={selected.submittedBy?.role ?? 'UNDERGRADUATE'} />
                  <DetailRow label="Submitted" value={new Date(selected.submittedAt).toLocaleString()} />
                </div>
              </div>

              {/* Case details */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                  Submission Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', fontSize: 13 }}>
                  <DetailRow label="Anonymised Label" value={selected.anonymisedLabel} />
                  <DetailRow label="Ground-Truth PAR" value={<strong style={{ color: 'var(--blue-dark)', fontSize: 16 }}>{selected.groundTruthPar}</strong>} />
                  <DetailRow label="3D Files Uploaded" value={`${selected.modelFiles?.length ?? 0} / 3`} />
                  {selected.sourceDescription && (
                    <DetailRow label="Source" value={selected.sourceDescription} />
                  )}
                </div>
              </div>

              {/* Reviewer comment if already reviewed */}
              {selected.reviewerComment && (
                <div className="alert alert-info" style={{ marginBottom: 0, fontSize: 13 }}>
                  <strong>Reviewer note:</strong> {selected.reviewerComment}
                </div>
              )}
            </div>

            {/* 3D Model Viewer */}
            {(selected.modelFiles?.length ?? 0) > 0 && (
              <div className="card">
                <div className="card-title" style={{ marginBottom: 12 }}>3D Dental Models</div>
                {/* Slot switcher */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  {selected.modelFiles.map(f => (
                    <button key={f.id}
                      onClick={() => setViewerSlot(f.slot)}
                      className={`btn btn-sm ${viewerSlot === f.slot ? 'btn-primary' : 'btn-outline'}`}>
                      {f.slot}
                    </button>
                  ))}
                </div>
                <Model3DViewer
                  modelUrl={trainingApi.getModelUrl(selected.id, viewerSlot)}
                  modelType={
                    selected.modelFiles.find(f => f.slot === viewerSlot)
                      ?.fileName?.split('.').pop()?.toLowerCase() ?? 'stl'
                  }
                  label={`${viewerSlot} arch`}
                  height={320}
                />
                <div style={{ marginTop: 10 }}>
                  {selected.modelFiles.map(f => (
                    <div key={f.id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px', background: 'var(--gray-50)',
                      border: '1px solid var(--border)', borderRadius: 6,
                      fontSize: 12, marginRight: 8, marginTop: 4,
                    }}>
                      <span style={{ fontWeight: 700, color: 'var(--blue-mid)' }}>{f.slot}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{f.fileName}</span>
                      <span style={{ color: 'var(--text-muted)' }}>({f.fileSizeMb} MB)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Review actions */}
            {selected.status === 'PENDING' && (
              <div className="card">
                <div className="card-title" style={{ marginBottom: 12 }}>Review Decision — {drName}</div>

                {reviewMsg === 'approved' && (
                  <div className="alert alert-success" style={{ marginBottom: 12 }}>
                    ✅ Submission approved. The undergraduate's submission record has been updated.
                  </div>
                )}
                {reviewMsg === 'rejected' && (
                  <div className="alert alert-error" style={{ marginBottom: 12 }}>
                    ❌ Submission rejected. The undergraduate will see your feedback.
                  </div>
                )}

                {!reviewMsg && (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary"
                      style={{ background: 'var(--green)', borderColor: 'var(--green)' }}
                      onClick={() => reviewSubmission('APPROVED', '')}
                      disabled={reviewing}
                    >
                      {reviewing ? <><span className="spinner" /> Processing…</> : '✔ Approve Submission'}
                    </button>
                    <button
                      className="btn btn-outline"
                      style={{ borderColor: 'var(--coral)', color: 'var(--coral)' }}
                      onClick={() => {
                        const comment = window.prompt('Please provide a reason for rejection:')
                        if (comment !== null) reviewSubmission('REJECTED', comment)
                      }}
                      disabled={reviewing}
                    >
                      ✖ Reject
                    </button>
                  </div>
                )}
              </div>
            )}

            {selected.status !== 'PENDING' && (
              <div className="alert alert-info">
                This submission has already been <strong>{selected.status.toLowerCase()}</strong>.
                {selected.reviewerComment && <span> Feedback: "{selected.reviewerComment}"</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 500 }}>{value}</div>
    </div>
  )
}
