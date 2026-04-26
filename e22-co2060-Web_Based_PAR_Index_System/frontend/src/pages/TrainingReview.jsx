import { useEffect, useState } from 'react'
import { trainingApi } from '../api/api'
import Model3DViewer from '../components/Model3DViewer'

const STATUS_BADGE = {
  PENDING:  'badge-amber',
  APPROVED: 'badge-green',
  REJECTED: 'badge-coral',
}

export default function TrainingReview() {
  const [submissions, setSubmissions] = useState([])
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState(false)

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
    if (!selectedSubmission) return
    setReviewing(true)
    try {
      await trainingApi.review(selectedSubmission.id, { status, comment })
      setSubmissions(s => s.filter(sub => sub.id !== selectedSubmission.id))
      setSelectedSubmission(null)
    } catch (err) {
      alert(err.response?.data?.message || 'Review failed.')
    } finally { setReviewing(false) }
  }

  const getModelUrl = (file) => {
    // Assuming the backend serves files at /api/v1/training-sets/{setId}/models/{slot}
    return `/api/v1/training-sets/${selectedSubmission.id}/models/${file.slot}`
  }

  return (
    <div className="page">
      <h1>Review Training Submissions</h1>
      <p>Submissions assigned to you for review and approval.</p>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Submissions List */}
        <div style={{ flex: 1 }}>
          <div className="card">
            {loading ? (
              <div className="centered"><div className="spinner" /></div>
            ) : submissions.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                No submissions assigned to you.
              </div>
            ) : (
              <div>
                {submissions.map(sub => (
                  <div
                    key={sub.id}
                    className={`card ${selectedSubmission?.id === sub.id ? 'card-selected' : ''}`}
                    style={{ marginBottom: 8, cursor: 'pointer', padding: 16 }}
                    onClick={() => setSelectedSubmission(sub)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{sub.anonymisedLabel}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          Submitted by {sub.submittedBy.name} • {new Date(sub.submittedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <span className={`badge ${STATUS_BADGE[sub.status]}`}>{sub.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submission Details */}
        {selectedSubmission && (
          <div style={{ flex: 1 }}>
            <div className="card">
              <div className="card-title">{selectedSubmission.anonymisedLabel}</div>

              <div style={{ marginBottom: 16 }}>
                <strong>Submitted by:</strong> {selectedSubmission.submittedBy.name}
              </div>

              <div style={{ marginBottom: 16 }}>
                <strong>Ground-truth PAR:</strong> {selectedSubmission.groundTruthPar}
              </div>

              {selectedSubmission.sourceDescription && (
                <div style={{ marginBottom: 16 }}>
                  <strong>Source:</strong> {selectedSubmission.sourceDescription}
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <strong>3D Models:</strong>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                  {selectedSubmission.modelFiles.map(file => (
                    <div key={file.id} style={{ textAlign: 'center' }}>
                      <Model3DViewer
                        modelUrl={getModelUrl(file)}
                        modelType={file.filename.split('.').pop().toLowerCase()}
                      />
                      <div style={{ fontSize: 12, marginTop: 4 }}>{file.slot}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-success"
                  onClick={() => reviewSubmission('APPROVED', '')}
                  disabled={reviewing}
                >
                  {reviewing ? 'Approving...' : 'Approve'}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    const comment = prompt('Rejection reason:')
                    if (comment) reviewSubmission('REJECTED', comment)
                  }}
                  disabled={reviewing}
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}