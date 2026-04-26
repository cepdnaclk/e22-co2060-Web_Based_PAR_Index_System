import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { caseApi, patientApi } from '../api/api'
import ModelUploadSlots from '../components/ModelUploadSlots'
import Model3DViewer    from '../components/Model3DViewer'
import ThreeDAutoScore  from '../components/ThreeDAutoScore'

// ── PAR components exactly per Green2016b Figure 1 / Table 2 ─────────────
// Each sub-field: { key, label, max }
// Weighting applied at total level

const UPPER_ANT_SEGMENTS = [
  { key: 'upper_3_2', label: '3–2', max: 5 },
  { key: 'upper_2_1', label: '2–1', max: 5 },
  { key: 'upper_1_1', label: '1–1', max: 5 },
  { key: 'upper_1_2', label: '1–2', max: 5 },
  { key: 'upper_2_3', label: '2–3', max: 5 },
]

const LOWER_ANT_SEGMENTS = [
  { key: 'lower_3_2', label: '3–2', max: 5 },
  { key: 'lower_2_1', label: '2–1', max: 5 },
  { key: 'lower_1_1', label: '1–1', max: 5 },
  { key: 'lower_1_2', label: '1–2', max: 5 },
  { key: 'lower_2_3', label: '2–3', max: 5 },
]

// Contact point score options (0-5) per Green2016b Table 2
const CONTACT_SCORE_OPTIONS = [
  { val: 0, desc: '0–1 mm' },
  { val: 1, desc: '1.1–2 mm' },
  { val: 2, desc: '2.1–4 mm' },
  { val: 3, desc: '4.1–8 mm' },
  { val: 4, desc: '>8 mm' },
  { val: 5, desc: 'Impacted (≤4 mm space)' },
]

// Buccal occlusion options
const BUCCAL_AP_OPTIONS = [
  { val: 0, desc: 'Good interdigitation' },
  { val: 1, desc: '<½ unit from full interdigitation' },
  { val: 2, desc: '½ unit discrepancy on any tooth' },
]
const BUCCAL_TRANS_OPTIONS = [
  { val: 0, desc: 'No crossbite' },
  { val: 1, desc: 'Crossbite tendency' },
  { val: 2, desc: 'Single tooth in crossbite' },
  { val: 3, desc: '>1 tooth in crossbite' },
  { val: 4, desc: '>1 tooth in scissor bite' },
]
const BUCCAL_VERT_OPTIONS = [
  { val: 0, desc: 'No posterior open bite' },
  { val: 1, desc: 'Post. open bite >2 mm on ≥2 teeth' },
]

// Overjet options
const OVERJET_POS_OPTIONS = [
  { val: 0, desc: '0–3 mm' },
  { val: 1, desc: '3.1–5 mm' },
  { val: 2, desc: '5.1–7 mm' },
  { val: 3, desc: '7.1–9 mm' },
  { val: 4, desc: '>9 mm' },
]
const OVERJET_NEG_OPTIONS = [
  { val: 0, desc: 'No anterior teeth in crossbite' },
  { val: 1, desc: 'One or more teeth edge-to-edge' },
  { val: 2, desc: 'Single tooth in crossbite' },
  { val: 3, desc: 'Two teeth in crossbite' },
  { val: 4, desc: '>2 teeth in crossbite' },
]

// Overbite options
const OVERBITE_OB_OPTIONS = [
  { val: 0, desc: '<⅓ coverage of lower incisor' },
  { val: 1, desc: '⅓ to <⅔ coverage of lower incisor' },
  { val: 2, desc: '>⅔ coverage of lower incisor' },
  { val: 3, desc: '≥Full coverage of lower incisors' },
]
const OVERBITE_OPEN_OPTIONS = [
  { val: 0, desc: 'No open bite' },
  { val: 1, desc: '≤1 mm open bite' },
  { val: 2, desc: '1.1–2 mm' },
  { val: 3, desc: '2.1–4 mm' },
  { val: 4, desc: '>4 mm' },
]

// Centreline options
const CENTRELINE_OPTIONS = [
  { val: 0, desc: 'Coincident or ≤¼ width of lower incisor' },
  { val: 1, desc: '¼ to ½ width of lower incisor' },
  { val: 2, desc: '>½ width of lower incisor' },
]

const EMPTY_DETAIL = () => ({
  // Upper anterior (each sub-contact scored separately)
  upper_3_2: 0, upper_2_1: 0, upper_1_1: 0, upper_1_2: 0, upper_2_3: 0,
  // Lower anterior
  lower_3_2: 0, lower_2_1: 0, lower_1_1: 0, lower_1_2: 0, lower_2_3: 0,
  // Buccal
  buccal_ap_right: 0, buccal_ap_left: 0,
  buccal_trans_right: 0, buccal_trans_left: 0,
  buccal_vert_right: 0, buccal_vert_left: 0,
  // Overjet & overbite
  overjet_pos: 0, overjet_neg: 0,
  overbite_ob: 0, overbite_open: 0,
  // Centreline
  centreline: 0,
})

// Compute weighted totals using British weightings from Table 2
function computeWeighted(d) {
  // Upper anterior — max per contact = 5, weight ×1
  const upperRaw = Math.max(d.upper_3_2, d.upper_2_1, d.upper_1_1, d.upper_1_2, d.upper_2_3)
  // Lower anterior — weight ×1
  const lowerRaw = Math.max(d.lower_3_2, d.lower_2_1, d.lower_1_1, d.lower_1_2, d.lower_2_3)
  // Buccal — highest of right/left for each plane, weight ×1
  const buccalAP    = Math.max(d.buccal_ap_right, d.buccal_ap_left)
  const buccalTrans = Math.max(d.buccal_trans_right, d.buccal_trans_left)
  const buccalVert  = Math.max(d.buccal_vert_right, d.buccal_vert_left)
  // Overjet — positive overjet or reverse overjet (take higher), weight ×6
  const overjetRaw = Math.max(d.overjet_pos, d.overjet_neg)
  // Overbite — overbite or open bite (take higher), weight ×2
  const overbiteRaw = Math.max(d.overbite_ob, d.overbite_open)
  // Centreline — weight ×4
  const centrelineRaw = d.centreline

  const unweighted = upperRaw + lowerRaw + buccalAP + buccalTrans + buccalVert + overjetRaw + overbiteRaw + centrelineRaw
  const weighted   = upperRaw*1 + lowerRaw*1 + buccalAP*1 + buccalTrans*1 + buccalVert*1
                   + overjetRaw*6 + overbiteRaw*2 + centrelineRaw*4

  return { unweighted, weighted, upperRaw, lowerRaw, buccalAP, buccalTrans, buccalVert, overjetRaw, overbiteRaw, centrelineRaw }
}

// Legacy flat keys → PAR API keys
function detailToApiScores(d) {
  const { upperRaw, lowerRaw, buccalAP, buccalTrans, buccalVert, overjetRaw, overbiteRaw, centrelineRaw } = computeWeighted(d)
  return {
    upperAnterior: upperRaw,
    lowerAnterior: lowerRaw,
    buccalRight:   Math.max(d.buccal_ap_right, d.buccal_trans_right, d.buccal_vert_right),
    buccalLeft:    Math.max(d.buccal_ap_left,  d.buccal_trans_left,  d.buccal_vert_left),
    overjet:       overjetRaw,
    overbite:      overbiteRaw,
    centreline:    centrelineRaw,
  }
}

const CLASS_BADGE = {
  'Greatly Improved':      'badge-green',
  'Improved':              'badge-blue',
  'No Different or Worse': 'badge-coral',
}

export default function CaseDetail() {
  const { id }       = useParams()
  const { user }     = useAuth()
  const navigate     = useNavigate()
  const [orthoCase, setOrthoCase] = useState(null)
  const [allCases, setAllCases]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [pageError, setPageError] = useState('')

  // 3D upload state
  const [files, setFiles]         = useState({})
  const [fileErrors, setFileErrors] = useState({})
  const [uploading, setUploading]   = useState(false)
  const [uploadMsg, setUploadMsg]   = useState('')

  // PAR detail form
  const [detail, setDetail]     = useState(EMPTY_DETAIL())
  const [calculating, setCalc]  = useState(false)
  const [calcError, setCalcError] = useState('')
  const [scoringTab, setScoringTab] = useState('manual')

  // 3D viewer
  const [viewerSlot, setViewerSlot] = useState('UPPER')

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true); setPageError('')
    try {
      const { data } = await caseApi.get(id)
      setOrthoCase(data)
      // Load sibling cases to check pre-treatment finalization
      const { data: cases } = await caseApi.listByPatient(data.patient?.id)
      setAllCases(cases)
      setDetail(EMPTY_DETAIL())
    } catch (err) {
      setPageError(err.response?.data?.message || 'Failed to load case.')
    } finally { setLoading(false) }
  }

  // ── File upload ──────────────────────────────────────────────────
  const handleFileChange = (key, file) => {
    setFiles(f => ({ ...f, [key]: file }))
    setFileErrors(e => ({ ...e, [key]: null }))
  }

  const uploadModels = async () => {
    const errs = {}
    ;['upperFile','lowerFile','buccalFile'].forEach(k => { if (!files[k]) errs[k] = 'Required' })
    if (Object.keys(errs).length) { setFileErrors(errs); return }
    setUploading(true); setUploadMsg('')
    try {
      const fd = new FormData()
      fd.append('upperFile',  files.upperFile)
      fd.append('lowerFile',  files.lowerFile)
      fd.append('buccalFile', files.buccalFile)
      await caseApi.uploadModels(id, fd)
      setUploadMsg('success'); setFiles({})
      await load()
    } catch (err) {
      setUploadMsg('error:' + (err.response?.data?.message || 'Upload failed.'))
    } finally { setUploading(false) }
  }

  // ── PAR Calculation ──────────────────────────────────────────────
  const calculatePAR = async () => {
    setCalc(true); setCalcError('')
    try {
      const scores = detailToApiScores(detail)
      await caseApi.calculate(id, scores)
      await load()
    } catch (err) {
      setCalcError(err.response?.data?.message || 'Calculation failed.')
    } finally { setCalc(false) }
  }

  // ── Finalize ─────────────────────────────────────────────────────
  const finalize = async () => {
    if (!window.confirm(`Finalise this ${orthoCase?.stage === 'PRE' ? 'pre-treatment' : 'post-treatment'} case? It will become read-only.`)) return
    try {
      await caseApi.finalize(id)
      await load()
    } catch (err) { alert(err.response?.data?.message || 'Error finalising case.') }
  }

  // ── Post-treatment guard ─────────────────────────────────────────
  const preCase = allCases.find(c => c.stage === 'PRE')
  const preFinalised = preCase?.isFinalized === true

  if (loading)   return <div className="centered"><div className="spinner spinner-lg" /></div>
  if (pageError) return <div className="page"><div className="alert alert-error">{pageError}</div></div>
  if (!orthoCase) return <div className="page"><div className="alert alert-error">Case not found.</div></div>

  const c          = orthoCase
  const modelsOk   = (c.modelFiles?.length ?? 0) >= 3
  const hasPAR     = !!c.parScore
  const finalized  = c.isFinalized
  const isPost     = c.stage === 'POST'
  const drName     = `Dr. ${user?.name}`

  const { weighted: liveWeighted, unweighted: liveUnweighted } = computeWeighted(detail)

  const uploadSuccess = uploadMsg === 'success'
  const uploadError   = uploadMsg.startsWith('error:') ? uploadMsg.slice(6) : ''

  // Guard: post-treatment requires pre-treatment to be finalised
  if (isPost && !preFinalised) {
    return (
      <div className="page">
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          <Link to="/patients" style={{ color: 'var(--blue-mid)' }}>Patients</Link>{' / '}
          <Link to={`/patients/${c.patient?.id}`} style={{ color: 'var(--blue-mid)' }}>{c.patient?.name}</Link>
          {' / Post-Treatment Case'}
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--amber)' }}>
          <div style={{ fontWeight: 700, color: 'var(--amber)', marginBottom: 8, fontSize: 16 }}>⚠️ Pre-Treatment Required</div>
          <p>Post-treatment scoring cannot be started until the pre-treatment case has been <strong>finalised</strong>.</p>
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
            Please complete and finalise the pre-treatment case for this patient first.
          </p>
          {preCase && (
            <Link to={`/cases/${preCase.id}`} className="btn btn-primary" style={{ marginTop: 16, display: 'inline-flex' }}>
              Open Pre-Treatment Case →
            </Link>
          )}
        </div>
      </div>
    )
  }

  // Viewer model URL helper
  const getModelUrl = (slot) => {
    const mf = c.modelFiles?.find(f => f.slot === slot)
    if (!mf) return null
    return `/api/v1/cases/${id}/models/${slot}`
  }

  return (
    <div className="page">
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
        <Link to="/patients" style={{ color: 'var(--blue-mid)' }}>Patients</Link>{' / '}
        <Link to={`/patients/${c.patient?.id}`} style={{ color: 'var(--blue-mid)' }}>{c.patient?.name ?? 'Patient'}</Link>
        {' / Case'}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0 }}>Orthodontic Case</h1>
          <span className={`badge ${c.stage === 'PRE' ? 'badge-blue' : 'badge-green'}`}>
            {c.stage === 'PRE' ? 'Pre-treatment' : 'Post-treatment'}
          </span>
          <span className={`badge ${finalized ? 'badge-gray' : 'badge-amber'}`}>
            {finalized ? 'Finalised' : 'Draft'}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>— {drName}</span>
        </div>
        {!finalized && hasPAR && (
          <button className="btn btn-outline btn-sm" onClick={finalize}
            style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>
            ✔ Finalise Case
          </button>
        )}
      </div>

      {c.notes && <div className="alert alert-info" style={{ marginBottom: 20 }}>{c.notes}</div>}

      {/* ── PAR Result ───────────────────────────────────────────── */}
      {hasPAR && (
        <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--blue-mid)' }}>
          <div className="card-title">PAR Score Result</div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ textAlign: 'center', minWidth: 120 }}>
              <div style={{ fontSize: 52, fontWeight: 800, color: 'var(--blue-dark)', lineHeight: 1 }}>
                {c.parScore.totalWeighted}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Weighted PAR Score</div>
              {c.parScore.classification && (
                <div style={{ marginTop: 10 }}>
                  <span className={`badge ${CLASS_BADGE[c.parScore.classification] ?? 'badge-gray'}`}
                    style={{ fontSize: 13, padding: '4px 14px' }}>
                    {c.parScore.classification}
                  </span>
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    <th style={{ textAlign: 'left', padding: '3px 6px', fontWeight: 600 }}>Component</th>
                    <th style={{ textAlign: 'center', padding: '3px 6px', fontWeight: 600 }}>Raw</th>
                    <th style={{ textAlign: 'center', padding: '3px 6px', fontWeight: 600 }}>Wt</th>
                    <th style={{ textAlign: 'center', padding: '3px 6px', fontWeight: 600 }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Upper Anterior',   key: 'upperAnterior', wt: 1 },
                    { label: 'Lower Anterior',   key: 'lowerAnterior', wt: 1 },
                    { label: 'Buccal (Right)',    key: 'buccalRight',   wt: 1 },
                    { label: 'Buccal (Left)',     key: 'buccalLeft',    wt: 1 },
                    { label: 'Overjet',          key: 'overjet',       wt: 6 },
                    { label: 'Overbite',         key: 'overbite',      wt: 2 },
                    { label: 'Centreline',       key: 'centreline',    wt: 4 },
                  ].map(row => (
                    <tr key={row.key} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '4px 6px', color: 'var(--text-muted)' }}>{row.label}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>{c.parScore[row.key] ?? 0}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center', color: 'var(--text-muted)' }}>×{row.wt}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 700, color: 'var(--blue-dark)' }}>
                        {(c.parScore[row.key] ?? 0) * row.wt}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--blue-pale)' }}>
                    <td colSpan={3} style={{ padding: '5px 6px', fontWeight: 700 }}>Total Weighted PAR</td>
                    <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 800, color: 'var(--blue-dark)', fontSize: 16 }}>
                      {c.parScore.totalWeighted}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── 3D Models Display (always visible if uploaded) ───────── */}
      {modelsOk && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">
            3D Dental Models
            <span className="badge badge-green" style={{ marginLeft: 10 }}>✓ Uploaded</span>
          </div>
          {/* Slot switcher */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {c.modelFiles.map(mf => (
              <button key={mf.id}
                onClick={() => setViewerSlot(mf.slot)}
                className={`btn btn-sm ${viewerSlot === mf.slot ? 'btn-primary' : 'btn-outline'}`}>
                {mf.slot}
              </button>
            ))}
          </div>
          <Model3DViewer
            modelUrl={getModelUrl(viewerSlot)}
            modelType={c.modelFiles?.find(f => f.slot === viewerSlot)?.fileName?.split('.').pop()?.toLowerCase() ?? 'stl'}
            label={`${viewerSlot} arch — ${c.patient?.name}`}
            height={360}
          />
        </div>
      )}

      {/* ── 3D Upload (only if not finalised) ───────────────────── */}
      {!finalized && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">
            {modelsOk ? 'Replace 3D Dental Models' : 'Upload 3D Dental Models'}
          </div>
          {!modelsOk && (
            <div className="alert alert-info" style={{ marginBottom: 16 }}>
              Upload three 3D dental scan files — one each for upper arch, lower arch, and buccal view (STL or OBJ, max 50 MB each).
            </div>
          )}
          <ModelUploadSlots files={files} onChange={handleFileChange} errors={fileErrors} />
          {uploadSuccess && <div className="alert alert-success" style={{ marginTop: 12 }}>✅ 3D models uploaded successfully.</div>}
          {uploadError   && <div className="alert alert-error"   style={{ marginTop: 12 }}>❌ {uploadError}</div>}
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={uploadModels} disabled={uploading}>
            {uploading ? <><span className="spinner" /> Uploading…</> : '⬆ Upload 3D Models'}
          </button>
        </div>
      )}

      {/* ── PAR Scoring (only if not finalised) ─────────────────── */}
      {!finalized && (
        <div className="card">
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 24, border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', width: 'fit-content' }}>
            <button onClick={() => setScoringTab('manual')} style={{
              padding: '9px 22px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: scoringTab === 'manual' ? 'var(--blue-mid)' : 'var(--gray-50)',
              color: scoringTab === 'manual' ? '#fff' : 'var(--text-muted)',
              borderRight: '1px solid var(--border)',
            }}>✏️ Manual Entry</button>
            <button onClick={() => setScoringTab('3d')} style={{
              padding: '9px 22px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: scoringTab === '3d' ? '#4f46e5' : 'var(--gray-50)',
              color: scoringTab === '3d' ? '#fff' : 'var(--text-muted)',
            }}>🦷 3D Auto-Detect</button>
          </div>

          {scoringTab === '3d' && (
            <ThreeDAutoScore caseId={c.id} modelFiles={c.modelFiles} onScored={() => load()} />
          )}

          {scoringTab === 'manual' && (
            <>
              <div className="card-title" style={{ marginBottom: 4 }}>PAR Component Scores</div>
              <p style={{ fontSize: 13, marginBottom: 20, color: 'var(--text-muted)' }}>
                Score each component as per the British PAR Index (Green 2016). British weightings applied automatically.
              </p>

              {calcError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{calcError}</div>}

              {/* ── 1. Upper Anterior Segments ── */}
              <PARSection title="1. Upper Anterior Segment Alignment" weight={1} badge="×1">
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Contact point displacement — score the greatest displacement of each contact point pair.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                  {UPPER_ANT_SEGMENTS.map(seg => (
                    <ScoreSelect key={seg.key} label={seg.label} options={CONTACT_SCORE_OPTIONS}
                      value={detail[seg.key]}
                      onChange={v => setDetail(d => ({ ...d, [seg.key]: v }))} />
                  ))}
                </div>
                <SectionTotal label="Max displacement" value={Math.max(...UPPER_ANT_SEGMENTS.map(s => detail[s.key]))} weight={1} />
              </PARSection>

              {/* ── 2. Lower Anterior Segments ── */}
              <PARSection title="2. Lower Anterior Segment Alignment" weight={1} badge="×1">
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Contact point displacement — score the greatest displacement of each contact point pair.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                  {LOWER_ANT_SEGMENTS.map(seg => (
                    <ScoreSelect key={seg.key} label={seg.label} options={CONTACT_SCORE_OPTIONS}
                      value={detail[seg.key]}
                      onChange={v => setDetail(d => ({ ...d, [seg.key]: v }))} />
                  ))}
                </div>
                <SectionTotal label="Max displacement" value={Math.max(...LOWER_ANT_SEGMENTS.map(s => detail[s.key]))} weight={1} />
              </PARSection>

              {/* ── 3. Buccal Occlusion ── */}
              <PARSection title="3. Buccal Occlusion" weight={1} badge="×1">
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Scored canine to terminal molar. Anterio-posterior and vertical exclude the canine from transverse.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* Antero-posterior */}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--blue-dark)', marginBottom: 8 }}>Anterio-posterior</div>
                    <ScoreSelect label="Right" options={BUCCAL_AP_OPTIONS} value={detail.buccal_ap_right} onChange={v => setDetail(d => ({ ...d, buccal_ap_right: v }))} />
                    <ScoreSelect label="Left"  options={BUCCAL_AP_OPTIONS} value={detail.buccal_ap_left}  onChange={v => setDetail(d => ({ ...d, buccal_ap_left:  v }))} />
                  </div>
                  {/* Transverse */}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--blue-dark)', marginBottom: 8 }}>Transverse</div>
                    <ScoreSelect label="Right" options={BUCCAL_TRANS_OPTIONS} value={detail.buccal_trans_right} onChange={v => setDetail(d => ({ ...d, buccal_trans_right: v }))} />
                    <ScoreSelect label="Left"  options={BUCCAL_TRANS_OPTIONS} value={detail.buccal_trans_left}  onChange={v => setDetail(d => ({ ...d, buccal_trans_left:  v }))} />
                  </div>
                  {/* Vertical */}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--blue-dark)', marginBottom: 8 }}>Vertical</div>
                    <ScoreSelect label="Right" options={BUCCAL_VERT_OPTIONS} value={detail.buccal_vert_right} onChange={v => setDetail(d => ({ ...d, buccal_vert_right: v }))} />
                    <ScoreSelect label="Left"  options={BUCCAL_VERT_OPTIONS} value={detail.buccal_vert_left}  onChange={v => setDetail(d => ({ ...d, buccal_vert_left:  v }))} />
                  </div>
                </div>
                <SectionTotal
                  label="Buccal score (max of AP/Trans/Vert, each side)"
                  value={Math.max(detail.buccal_ap_right, detail.buccal_ap_left, detail.buccal_trans_right, detail.buccal_trans_left, detail.buccal_vert_right, detail.buccal_vert_left)}
                  weight={1} />
              </PARSection>

              {/* ── 4. Overjet ── */}
              <PARSection title="4. Overjet" weight={6} badge="×6">
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Measured from the most prominent incisor; ruler held parallel to occlusal plane and radial to line of arch.
                  Score both positive and reverse overjet — the higher score is used.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--blue-dark)', marginBottom: 8 }}>Positive Overjet</div>
                    <ScoreSelect label="Positive" options={OVERJET_POS_OPTIONS} value={detail.overjet_pos} onChange={v => setDetail(d => ({ ...d, overjet_pos: v }))} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--blue-dark)', marginBottom: 8 }}>Reverse Overjet (Negative)</div>
                    <ScoreSelect label="Negative" options={OVERJET_NEG_OPTIONS} value={detail.overjet_neg} onChange={v => setDetail(d => ({ ...d, overjet_neg: v }))} />
                  </div>
                </div>
                <SectionTotal label="Overjet (max of positive / reverse)" value={Math.max(detail.overjet_pos, detail.overjet_neg)} weight={6} />
              </PARSection>

              {/* ── 5. Overbite ── */}
              <PARSection title="5. Overbite" weight={2} badge="×2">
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Overbite measured in relation to coverage of lower incisors. Where both overbite and open bite exist, both are scored.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--blue-dark)', marginBottom: 8 }}>Overbite</div>
                    <ScoreSelect label="Overbite" options={OVERBITE_OB_OPTIONS} value={detail.overbite_ob} onChange={v => setDetail(d => ({ ...d, overbite_ob: v }))} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--blue-dark)', marginBottom: 8 }}>Open Bite</div>
                    <ScoreSelect label="Open Bite" options={OVERBITE_OPEN_OPTIONS} value={detail.overbite_open} onChange={v => setDetail(d => ({ ...d, overbite_open: v }))} />
                  </div>
                </div>
                <SectionTotal label="Overbite score (max of overbite / open bite)" value={Math.max(detail.overbite_ob, detail.overbite_open)} weight={2} />
              </PARSection>

              {/* ── 6. Centreline ── */}
              <PARSection title="6. Centreline" weight={4} badge="×4">
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Measured in relation to the lower central incisors. If a lower incisor has been extracted, estimate the lower centreline.
                </p>
                <div style={{ maxWidth: 320 }}>
                  <ScoreSelect label="Centreline discrepancy" options={CENTRELINE_OPTIONS} value={detail.centreline} onChange={v => setDetail(d => ({ ...d, centreline: v }))} />
                </div>
                <SectionTotal label="Centreline score" value={detail.centreline} weight={4} />
              </PARSection>

              {/* ── Live Total ── */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
                padding: '16px 20px', background: 'var(--blue-pale)',
                borderRadius: 'var(--radius-md)', marginBottom: 18, marginTop: 8,
                border: '1.5px solid var(--blue-light)',
              }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--blue-dark)', fontWeight: 600, marginBottom: 2 }}>Live PAR Total (preview)</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Un-weighted: {liveUnweighted}</div>
                </div>
                <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--blue-dark)' }}>
                  {liveWeighted}
                  <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>weighted</span>
                </div>
              </div>

              <button className="btn btn-primary" onClick={calculatePAR} disabled={calculating}>
                {calculating ? <><span className="spinner" /> Calculating…</> : '⚡ Calculate & Save PAR Score'}
              </button>
            </>
          )}
        </div>
      )}

      {finalized && (
        <div className="alert alert-info" style={{ marginTop: 16 }}>
          ✅ This {c.stage === 'PRE' ? 'pre-treatment' : 'post-treatment'} case has been finalised by <strong>{drName}</strong> and is now read-only.
          {c.stage === 'PRE' && (
            <span style={{ marginLeft: 8 }}>Post-treatment scoring is now enabled for this patient.</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────

function PARSection({ title, weight, badge, children }) {
  return (
    <div style={{
      border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)',
      marginBottom: 18, overflow: 'hidden',
    }}>
      <div style={{
        background: 'var(--blue-dark)', color: '#fff',
        padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
        <span style={{
          background: 'rgba(255,255,255,.18)', color: '#fff',
          padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700,
        }}>{badge}</span>
      </div>
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  )
}

function ScoreSelect({ label, options, value, onChange }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width: '100%', fontSize: 13, padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--border)' }}
      >
        {options.map(opt => (
          <option key={opt.val} value={opt.val}>{opt.val} — {opt.desc}</option>
        ))}
      </select>
    </div>
  )
}

function SectionTotal({ label, value, weight }) {
  return (
    <div style={{
      marginTop: 12, padding: '8px 12px',
      background: 'var(--blue-pale)', borderRadius: 6,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontSize: 13,
    }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: 'var(--blue-dark)' }}>
        {value} × {weight} = <span style={{ color: 'var(--blue-mid)', fontSize: 15 }}>{value * weight}</span>
      </span>
    </div>
  )
}
