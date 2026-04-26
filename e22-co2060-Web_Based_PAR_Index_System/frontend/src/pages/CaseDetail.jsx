import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { caseApi } from '../api/api'
import ModelUploadSlots   from '../components/ModelUploadSlots'
import ThreeDAutoScore    from '../components/ThreeDAutoScore'

const COMPONENTS = [
  { key: 'upperAnterior', label: 'Upper Anterior Segment', max: 10, weight: 1 },
  { key: 'lowerAnterior', label: 'Lower Anterior Segment', max: 10, weight: 1 },
  { key: 'buccalLeft',    label: 'Buccal Occlusion — Left',  max: 5,  weight: 1 },
  { key: 'buccalRight',   label: 'Buccal Occlusion — Right', max: 5,  weight: 1 },
  { key: 'overjet',       label: 'Overjet',    max: 5, weight: 6 },
  { key: 'overbite',      label: 'Overbite',   max: 4, weight: 2 },
  { key: 'centreline',    label: 'Centreline', max: 2, weight: 4 },
]

const EMPTY_SCORES = Object.fromEntries(COMPONENTS.map(c => [c.key, 0]))

const computePreview = scores =>
  COMPONENTS.reduce((sum, c) => sum + (scores[c.key] ?? 0) * c.weight, 0)

const CLASS_BADGE = {
  'Greatly Improved':      'badge-green',
  'Improved':              'badge-blue',
  'No Different or Worse': 'badge-coral',
}

export default function CaseDetail() {
  const { id } = useParams()
  const [orthoCase, setOrthoCase]   = useState(null)
  const [loading, setLoading]       = useState(true)
  const [pageError, setPageError]   = useState('')

  // 3D upload state
  const [files, setFiles]           = useState({})
  const [fileErrors, setFileErrors] = useState({})
  const [uploading, setUploading]   = useState(false)
  const [uploadMsg, setUploadMsg]   = useState('')

  // PAR form state
  const [scores, setScores]         = useState(EMPTY_SCORES)
  const [calculating, setCalc]      = useState(false)
  const [calcError, setCalcError]   = useState('')
  // Scoring mode tab: 'manual' | '3d'
  const [scoringTab, setScoringTab] = useState('manual')

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    setPageError('')
    try {
      const { data } = await caseApi.get(id)
      setOrthoCase(data)
      if (data.parScore) {
        const s = {}
        COMPONENTS.forEach(comp => { s[comp.key] = data.parScore[comp.key] ?? 0 })
        setScores(s)
      } else {
        setScores(EMPTY_SCORES)
      }
    } catch (err) {
      setPageError(err.response?.data?.message || 'Failed to load case.')
    } finally { setLoading(false) }
  }

  // ── 3D Upload ────────────────────────────────────────────────────
  const handleFileChange = (key, file) => {
    setFiles(f => ({ ...f, [key]: file }))
    setFileErrors(e => ({ ...e, [key]: null }))
  }

  const uploadModels = async () => {
    const errs = {}
    ;['upperFile', 'lowerFile', 'buccalFile'].forEach(k => {
      if (!files[k]) errs[k] = 'Required'
    })
    if (Object.keys(errs).length) { setFileErrors(errs); return }

    setUploading(true)
    setUploadMsg('')
    try {
      const fd = new FormData()
      fd.append('upperFile',  files.upperFile)
      fd.append('lowerFile',  files.lowerFile)
      fd.append('buccalFile', files.buccalFile)
      await caseApi.uploadModels(id, fd)
      setUploadMsg('success')
      setFiles({})
      await load()
    } catch (err) {
      setUploadMsg('error:' + (err.response?.data?.message || 'Upload failed.'))
    } finally { setUploading(false) }
  }

  // ── PAR Calculation ──────────────────────────────────────────────
  const calculatePAR = async () => {
    setCalc(true)
    setCalcError('')
    try {
      await caseApi.calculate(id, scores)
      await load()
    } catch (err) {
      setCalcError(err.response?.data?.message || 'Calculation failed.')
    } finally { setCalc(false) }
  }

  const finalize = async () => {
    if (!window.confirm('Finalise this case? It will become read-only.')) return
    try {
      await caseApi.finalize(id)
      await load()
    } catch (err) { alert(err.response?.data?.message || 'Error.') }
  }

  if (loading)   return <div className="centered"><div className="spinner spinner-lg" /></div>
  if (pageError) return <div className="page"><div className="alert alert-error">{pageError}</div></div>
  if (!orthoCase) return <div className="page"><div className="alert alert-error">Case not found.</div></div>

  const c        = orthoCase
  const preview  = computePreview(scores)
  const modelsOk = (c.modelFiles?.length ?? 0) >= 3
  const hasPAR   = !!c.parScore
  const finalized = c.isFinalized

  const uploadSuccess = uploadMsg === 'success'
  const uploadError   = uploadMsg.startsWith('error:') ? uploadMsg.slice(6) : ''

  return (
    <div className="page">
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
        <Link to="/patients" style={{ color: 'var(--blue-mid)' }}>Patients</Link>
        {' / '}
        {/* FIXED: c.patient.id now works since Patient.id @JsonIgnore removed */}
        <Link to={`/patients/${c.patient?.id}`} style={{ color: 'var(--blue-mid)' }}>
          {c.patient?.name ?? 'Patient'}
        </Link>
        {' / Case'}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ margin: 0 }}>Orthodontic Case</h1>
          <span className={`badge ${c.stage === 'PRE' ? 'badge-blue' : 'badge-green'}`}>
            {c.stage === 'PRE' ? 'Pre-treatment' : 'Post-treatment'}
          </span>
          <span className={`badge ${finalized ? 'badge-gray' : 'badge-amber'}`}>
            {finalized ? 'Finalised' : 'Draft'}
          </span>
        </div>
        {!finalized && hasPAR && (
          <button className="btn btn-outline btn-sm" onClick={finalize}
            style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>
            Finalise Case
          </button>
        )}
      </div>

      {c.notes && (
        <div className="alert alert-info" style={{ marginBottom: 20 }}>{c.notes}</div>
      )}

      {/* ── PAR Result ─────────────────────────────────────────────── */}
      {hasPAR && (
        <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--blue-mid)' }}>
          <div className="card-title">PAR Score Result</div>
          <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 56, fontWeight: 800, color: 'var(--blue-dark)', lineHeight: 1 }}>
                {c.parScore.totalWeighted}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                Weighted PAR Score
              </div>
            </div>
            <div style={{ flex: 1 }}>
              {c.parScore.classification && (
                <div style={{ marginBottom: 14 }}>
                  <span
                    className={`badge ${CLASS_BADGE[c.parScore.classification] ?? 'badge-gray'}`}
                    style={{ fontSize: 14, padding: '5px 16px' }}>
                    {c.parScore.classification}
                  </span>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', fontSize: 13 }}>
                {COMPONENTS.map(comp => (
                  <div key={comp.key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{comp.label}</span>
                    <span style={{ fontWeight: 600 }}>
                      {c.parScore[comp.key]} × {comp.weight} = {c.parScore[comp.key] * comp.weight}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 3D Upload ──────────────────────────────────────────────── */}
      {!finalized && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">
            3D Dental Models
            {modelsOk && <span className="badge badge-green" style={{ marginLeft: 10 }}>✓ Uploaded</span>}
          </div>

          {modelsOk ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                {c.modelFiles.map(mf => (
                  <div key={mf.id} style={{
                    padding: '7px 14px', background: 'var(--green-light)',
                    borderRadius: 'var(--radius-sm)', fontSize: 13
                  }}>
                    <span style={{ fontWeight: 600, color: 'var(--green)' }}>{mf.slot}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{mf.fileName}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                      ({mf.fileSizeMb} MB)
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 13 }}>Upload new files below to replace existing models:</p>
            </div>
          ) : (
            <div className="alert alert-info" style={{ marginBottom: 16 }}>
              Upload three 3D dental scan files — one each for the upper arch, lower arch, and buccal view.
            </div>
          )}

          <ModelUploadSlots files={files} onChange={handleFileChange} errors={fileErrors} />

          {uploadSuccess && (
            <div className="alert alert-success" style={{ marginTop: 12 }}>
              ✅ 3D models uploaded successfully.
            </div>
          )}
          {uploadError && (
            <div className="alert alert-error" style={{ marginTop: 12 }}>❌ {uploadError}</div>
          )}

          <button className="btn btn-primary" style={{ marginTop: 14 }}
            onClick={uploadModels} disabled={uploading}>
            {uploading ? <><span className="spinner" /> Uploading…</> : '⬆ Upload 3D Models'}
          </button>
        </div>
      )}

      {/* ── PAR Scoring Section (Manual + 3D Auto) ──────────────── */}
      {!finalized && (
        <div className="card">
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 20, border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', width: 'fit-content' }}>
            <button
              onClick={() => setScoringTab('manual')}
              style={{
                padding: '9px 22px', border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 13,
                background: scoringTab === 'manual' ? 'var(--blue-mid)' : 'var(--gray-50)',
                color: scoringTab === 'manual' ? '#fff' : 'var(--text-muted)',
                borderRight: '1px solid var(--border)',
              }}>
              ✏️ Manual Entry
            </button>
            <button
              onClick={() => setScoringTab('3d')}
              style={{
                padding: '9px 22px', border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 13,
                background: scoringTab === '3d' ? '#4f46e5' : 'var(--gray-50)',
                color: scoringTab === '3d' ? '#fff' : 'var(--text-muted)',
              }}>
              🦷 3D Auto-Detect
            </button>
          </div>

          {/* 3D Auto-Detect tab */}
          {scoringTab === '3d' && (
            <ThreeDAutoScore
              caseId={c.id}
              modelFiles={c.modelFiles}
              onScored={() => load()}
            />
          )}

          {/* Manual Entry tab */}
          {scoringTab === 'manual' && (
            <>
          <div className="card-title" style={{ marginBottom: 4 }}>PAR Component Scores</div>
          <p style={{ fontSize: 13, marginBottom: 20 }}>
            Enter the raw score for each component using the sliders. The weighted total is
            calculated live using the British PAR weighting scheme.
          </p>

          {calcError && <div className="alert alert-error">{calcError}</div>}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 14, marginBottom: 20
          }}>
            {COMPONENTS.map(comp => (
              <div key={comp.key} style={{
                padding: '14px 16px', border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-sm)', background: 'var(--gray-50)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{comp.label}</div>
                  <span className="badge badge-gray" style={{ fontSize: 11 }}>×{comp.weight}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="range" min={0} max={comp.max} value={scores[comp.key]}
                    onChange={e => setScores(s => ({ ...s, [comp.key]: +e.target.value }))}
                    style={{ flex: 1, width: 'auto' }}
                  />
                  <div style={{
                    width: 36, textAlign: 'center', fontWeight: 700,
                    fontSize: 18, color: 'var(--blue-dark)'
                  }}>
                    {scores[comp.key]}
                  </div>
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 11, color: 'var(--text-muted)', marginTop: 4
                }}>
                  <span>0</span>
                  <span>Weighted: {scores[comp.key] * comp.weight}</span>
                  <span>{comp.max}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Live preview bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 22px', background: 'var(--blue-pale)',
            borderRadius: 'var(--radius-md)', marginBottom: 18,
            border: '1.5px solid var(--blue-light)'
          }}>
            <div style={{ fontSize: 14, color: 'var(--blue-dark)', fontWeight: 500 }}>
              Live weighted total preview
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--blue-dark)' }}>
              {preview}
            </div>
          </div>

          <button className="btn btn-primary" onClick={calculatePAR} disabled={calculating}>
            {calculating
              ? <><span className="spinner" /> Calculating…</>
              : '⚡ Calculate & Save PAR Score'}
          </button>
            </>
          )}
        </div>
      )}

      {finalized && (
        <div className="alert alert-info" style={{ marginTop: 16 }}>
          This case has been finalised and is read-only.
        </div>
      )}
    </div>
  )
}
