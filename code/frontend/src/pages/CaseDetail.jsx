// frontend/src/pages/CaseDetail.jsx
// REQUIREMENT 2:  Show PRE case reference on POST cases (pre_case_id + date)
// REQUIREMENT 3:  Finalization modal requires typing CONFIRM + shows PAR score
// REQUIREMENT 7:  If API returns 409, show "Case updated by another user" and reload
// REQUIREMENT 12: Individual ErrorBoundary for STLViewer, LandmarkPanel, MLStatusPanel, AutoScoreResult
// REQUIREMENT 14: Show ML predicted score, confidence note, null guards

import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { caseApi, landmarkApi } from '../api/api'
import ModelUploadSlots from '../components/ModelUploadSlots'
import Case3DViewer     from '../components/Case3DViewer'
import ThreeDAutoScore  from '../components/ThreeDAutoScore'
import ErrorBoundary    from '../components/ErrorBoundary'
import { calcLandmarkImprovement } from '../utils/measurements'

// ── PAR component definitions ─────────────────────────────────────────────

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

const CONTACT_SCORE_OPTIONS = [
  { val: 0, desc: '0–1 mm' },
  { val: 1, desc: '1.1–2 mm' },
  { val: 2, desc: '2.1–4 mm' },
  { val: 3, desc: '4.1–8 mm' },
  { val: 4, desc: '>8 mm' },
  { val: 5, desc: 'Impacted (≤4 mm space)' },
]

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

const CENTRELINE_OPTIONS = [
  { val: 0, desc: 'Coincident or ≤¼ width of lower incisor' },
  { val: 1, desc: '¼ to ½ width of lower incisor' },
  { val: 2, desc: '>½ width of lower incisor' },
]

const EMPTY_DETAIL = () => ({
  upper_3_2: 0, upper_2_1: 0, upper_1_1: 0, upper_1_2: 0, upper_2_3: 0,
  lower_3_2: 0, lower_2_1: 0, lower_1_1: 0, lower_1_2: 0, lower_2_3: 0,
  buccal_ap_right: 0, buccal_ap_left: 0,
  buccal_trans_right: 0, buccal_trans_left: 0,
  buccal_vert_right: 0, buccal_vert_left: 0,
  overjet_pos: 0, overjet_neg: 0,
  overbite_ob: 0, overbite_open: 0,
  centreline: 0,
})

function computeWeighted(d) {
  const upperRaw    = Math.max(d.upper_3_2, d.upper_2_1, d.upper_1_1, d.upper_1_2, d.upper_2_3)
  const lowerRaw    = Math.max(d.lower_3_2, d.lower_2_1, d.lower_1_1, d.lower_1_2, d.lower_2_3)
  const buccalAP    = Math.max(d.buccal_ap_right, d.buccal_ap_left)
  const buccalTrans = Math.max(d.buccal_trans_right, d.buccal_trans_left)
  const buccalVert  = Math.max(d.buccal_vert_right, d.buccal_vert_left)
  const overjetRaw  = Math.max(d.overjet_pos, d.overjet_neg)
  const overbiteRaw = Math.max(d.overbite_ob, d.overbite_open)
  const centrelineRaw = d.centreline

  const unweighted = upperRaw + lowerRaw + buccalAP + buccalTrans + buccalVert + overjetRaw + overbiteRaw + centrelineRaw
  const weighted   = upperRaw*1 + lowerRaw*1 + buccalAP*1 + buccalTrans*1 + buccalVert*1
                   + overjetRaw*6 + overbiteRaw*2 + centrelineRaw*4

  return { unweighted, weighted, upperRaw, lowerRaw, buccalAP, buccalTrans, buccalVert, overjetRaw, overbiteRaw, centrelineRaw }
}

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

const SOURCE_LABEL = {
  MANUAL:        'Manual entry',
  AUTO_LANDMARK: '3D landmark auto-score',
  ML:            'ML prediction',
}

function reshapeLandmarks(apiArray) {
  const out = { UPPER: {}, LOWER: {}, BUCCAL: {} }
  if (!Array.isArray(apiArray)) return out
  apiArray.forEach(lm => { if (out[lm.slot]) out[lm.slot][lm.pointName] = { x: lm.x, y: lm.y, z: lm.z } })
  return out
}

// ── REQUIREMENT 3: Finalization modal ────────────────────────────────────

function FinalizeModal({ parScore, onConfirm, onCancel }) {
  const [confirmText, setConfirmText] = useState('')
  const isValid = confirmText.trim() === 'CONFIRM'

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 28, maxWidth: 440, width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18, color: '#1e293b' }}>
          ✔ Finalise This Case
        </h2>
        <p style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>
          Finalising locks this case permanently. No further edits will be possible
          without admin intervention.
        </p>

        {/* Show current PAR score */}
        <div style={{
          background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 8,
          padding: '12px 16px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 12, color: '#3b82f6', marginBottom: 4 }}>Current PAR Score</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1e40af' }}>{parScore}</div>
        </div>

        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
          Type <strong>CONFIRM</strong> to proceed:
        </p>
        <input
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
          placeholder="Type CONFIRM"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 6, marginBottom: 16,
            border: `1.5px solid ${isValid ? '#22c55e' : '#d1d5db'}`,
            fontSize: 14, boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '8px 18px', borderRadius: 6, border: '1px solid #d1d5db',
            background: '#fff', cursor: 'pointer', fontWeight: 500,
          }}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!isValid}
            style={{
              padding: '8px 18px', borderRadius: 6, border: 'none', cursor: isValid ? 'pointer' : 'not-allowed',
              background: isValid ? '#16a34a' : '#e5e7eb',
              color: isValid ? '#fff' : '#9ca3af', fontWeight: 600,
            }}
          >
            ✔ Finalise
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Reusable dropdown for a single manual PAR component ───────────────────

function ScoreSelect({ label, value, options, onChange, disabled }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
        {label}
      </label>
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: '100%', padding: '7px 8px', borderRadius: 6,
          border: '1px solid #d1d5db', fontSize: 13, background: disabled ? '#f1f5f9' : '#fff',
          color: '#1e293b',
        }}
      >
        {options.map(o => (
          <option key={o.val} value={o.val}>{o.val} — {o.desc}</option>
        ))}
      </select>
    </div>
  )
}

function ToggleGroup({ value, options, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1, padding: '6px 8px', fontSize: 11.5, fontWeight: 600,
            borderRadius: 6, cursor: 'pointer',
            border: `1.5px solid ${value === opt.value ? 'var(--blue-mid)' : '#d1d5db'}`,
            background: value === opt.value ? 'var(--blue-pale)' : '#fff',
            color: value === opt.value ? 'var(--blue-dark)' : '#475569',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Ask the orthodontist: apply ML prediction as final, or score manually? ─

function ScoreChoiceModal({ mlScore, applying, applyError, onUseMl, onUseManual, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 28, maxWidth: 440, width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 18, color: '#1e293b' }}>
          How should this case be scored?
        </h2>
        <p style={{ fontSize: 13, color: '#475569', marginBottom: 18, lineHeight: 1.5 }}>
          The ML model predicts a PAR score of <strong>{mlScore?.toFixed(1)}</strong> from the uploaded
          3D models. You can accept that as this case's final score, or enter a manual
          component-by-component breakdown yourself.
        </p>

        {applyError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{applyError}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn-primary" onClick={onUseMl} disabled={applying}
            style={{ justifyContent: 'center', padding: '10px 16px' }}>
            {applying ? '⏳ Applying…' : `🤖 Use ML Score (${mlScore?.toFixed(1)}) as Final`}
          </button>
          <button className="btn btn-outline" onClick={onUseManual} disabled={applying}
            style={{ justifyContent: 'center', padding: '10px 16px' }}>
            📝 Enter Score Manually
          </button>
        </div>

        <button onClick={onClose} disabled={applying} style={{
          marginTop: 16, background: 'none', border: 'none', color: '#94a3b8',
          fontSize: 12, cursor: 'pointer', width: '100%', textAlign: 'center',
        }}>
          Decide later
        </button>
      </div>
    </div>
  )
}

// ── Main CaseDetail component ─────────────────────────────────────────────

export default function CaseDetail() {
  const { id }       = useParams()
  const { user }     = useAuth()
  const navigate     = useNavigate()
  const [orthoCase, setOrthoCase] = useState(null)
  const [allCases, setAllCases]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [pageError, setPageError] = useState('')

  // 3D upload state
  const [files, setFiles]           = useState({})
  const [fileErrors, setFileErrors] = useState({})
  const [uploading, setUploading]   = useState(false)
  const [uploadMsg, setUploadMsg]   = useState('')

  // PAR detail form
  const [detail, setDetail]         = useState(EMPTY_DETAIL())
  const [overjetType, setOverjetType]   = useState('positive') // 'positive' | 'reverse'
  const [overbiteType, setOverbiteType] = useState('overbite') // 'overbite' | 'openbite'
  const [calculating, setCalc]      = useState(false)
  const [calcError, setCalcError]   = useState('')
  const [scoringTab, setScoringTab] = useState('manual')
  const [showManualOverride, setShowManualOverride] = useState(false)

  // ML-score-as-final flow
  const [showScoreChoice, setShowScoreChoice]         = useState(false)
  const [scoreChoicePrompted, setScoreChoicePrompted] = useState(false)
  const [applyingMl, setApplyingMl]   = useState(false)
  const [mlApplyError, setMlApplyError] = useState('')

  // 3D viewer
  const [viewerSlot, setViewerSlot] = useState('UPPER')

  // Comparison landmarks
  const [preCaseLandmarks,  setPreCaseLandmarks]  = useState(null)
  const [postCaseLandmarks, setPostCaseLandmarks] = useState(null)
  const [comparisonLoading, setComparisonLoading] = useState(false)

  // REQUIREMENT 3: Finalization modal
  const [showFinalizeModal, setShowFinalizeModal] = useState(false)

  useEffect(() => { load() }, [id]) // eslint-disable-line

  // Auto-prompt once per case load: if ML has a prediction and no PAR score
  // has been chosen yet (and the case isn't finalised), ask which path to use.
  useEffect(() => {
    if (!orthoCase || scoreChoicePrompted) return
    if (orthoCase.mlPredictedScore != null && !orthoCase.parScore && !orthoCase.isFinalized) {
      setShowScoreChoice(true)
      setScoreChoicePrompted(true)
    }
  }, [orthoCase, scoreChoicePrompted])

  const setField = (key, val) => setDetail(d => ({ ...d, [key]: val }))

  // Overjet and overbite are each scored as ONE of two mutually-exclusive
  // sub-types (e.g. positive overjet vs reverse/crossbite overjet). Switching
  // type zeroes the other field so a stale value can't sneak into the total
  // via Math.max() in computeWeighted().
  const handleOverjetTypeChange = (type) => {
    setOverjetType(type)
    if (type === 'positive') setField('overjet_neg', 0)
    else setField('overjet_pos', 0)
  }
  const handleOverbiteTypeChange = (type) => {
    setOverbiteType(type)
    if (type === 'overbite') setField('overbite_open', 0)
    else setField('overbite_ob', 0)
  }

  async function load() {
    setLoading(true); setPageError('')
    try {
      const { data } = await caseApi.get(id)
      setOrthoCase(data)
      const { data: cases } = await caseApi.listByPatient(data.patient?.id)
      setAllCases(cases)
      setDetail(EMPTY_DETAIL())
      await loadComparisonLandmarks(data, cases)
    } catch (err) {
      // REQUIREMENT 7: 409 = concurrent edit conflict — show message and reload
      if (err.response?.status === 409) {
        alert('Case updated by another user — refreshing...')
        window.location.reload()
        return
      }
      setPageError(err.response?.data?.message || 'Failed to load case.')
    } finally { setLoading(false) }
  }

  async function loadComparisonLandmarks(thisCase, cases) {
    setComparisonLoading(true)
    try {
      if (thisCase.stage === 'POST') {
        const { data: postLms } = await landmarkApi.get(thisCase.id)
        setPostCaseLandmarks(reshapeLandmarks(postLms))

        // REQUIREMENT 2: Use explicitly linked preCaseId if available
        const preSibling = thisCase.preCase
          ? cases.find(c => c.id === thisCase.preCase.id)
          : cases.find(c => c.stage === 'PRE')

        if (preSibling) {
          const { data: preLms } = await landmarkApi.get(preSibling.id)
          setPreCaseLandmarks(reshapeLandmarks(preLms))
        }
      } else {
        const { data: preLms } = await landmarkApi.get(thisCase.id)
        setPreCaseLandmarks(reshapeLandmarks(preLms))
        setPostCaseLandmarks(null)
      }
    } catch {
      setPreCaseLandmarks(null)
      setPostCaseLandmarks(null)
    } finally { setComparisonLoading(false) }
  }

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
      // REQUIREMENT 7: 409 conflict
      if (err.response?.status === 409) {
        alert('Case updated by another user — refreshing...')
        window.location.reload()
        return
      }
      setUploadMsg('error:' + (err.response?.data?.message || 'Upload failed.'))
    } finally { setUploading(false) }
  }

  const calculatePAR = async () => {
    setCalc(true); setCalcError('')
    try {
      const scores = detailToApiScores(detail)
      await caseApi.calculate(id, scores)
      await load()
    } catch (err) {
      if (err.response?.status === 409) { alert('Case updated by another user — refreshing...'); window.location.reload(); return }
      setCalcError(err.response?.data?.message || 'Calculation failed.')
    } finally { setCalc(false) }
  }

  const applyMlScore = async () => {
    setApplyingMl(true); setMlApplyError('')
    try {
      await caseApi.calculateFromMl(id)
      setShowScoreChoice(false)
      await load()
    } catch (err) {
      if (err.response?.status === 409) { alert('Case updated by another user — refreshing...'); window.location.reload(); return }
      setMlApplyError(err.response?.data?.message || 'Could not apply the ML score.')
    } finally { setApplyingMl(false) }
  }

  // REQUIREMENT 3: Show modal first, then finalize if CONFIRM typed
  const requestFinalize = () => { setShowFinalizeModal(true) }

  const finalize = async () => {
    setShowFinalizeModal(false)
    try {
      await caseApi.finalize(id)
      await load()
    } catch (err) {
      const status = err.response?.status

      // 409 = genuine state conflict (e.g. already finalised, or two tabs racing).
      // Reload once and retry — this is the only case where a silent retry makes sense.
      if (status === 409) {
        await load()
        try {
          await caseApi.finalize(id)
          await load()
          return
        } catch (retryErr) {
          alert(retryErr.response?.data?.message || 'Case could not be finalised after refresh.')
          return
        }
      }

      // 422 = business-rule failure (no PAR score, score is 0, etc.) — retrying
      // won't help, so show the real message immediately instead of masking it.
      if (status === 422) {
        alert(err.response?.data?.message || 'Case cannot be finalised yet.')
        return
      }

      alert(err.response?.data?.message || 'Error finalising case.')
    }
  }
  

  const preCase      = orthoCase?.preCase
    ? allCases.find(c => c.id === orthoCase.preCase.id)
    : allCases.find(c => c.stage === 'PRE')
  const preFinalised = preCase?.isFinalized === true

  if (loading)    return <div className="centered"><div className="spinner spinner-lg" /></div>
  if (pageError)  return <div className="page"><div className="alert alert-error">{pageError}</div></div>
  if (!orthoCase) return <div className="page"><div className="alert alert-error">Case not found.</div></div>

  const c          = orthoCase
  const modelsOk   = (c.modelFiles?.length ?? 0) >= 3
  const hasPAR     = !!c.parScore
  const finalized  = c.isFinalized
  const isPost     = c.stage === 'POST'
  const isOrthodontist = user?.role === 'ORTHODONTIST'
  const drName     = `Dr. ${user?.name}`

  const { weighted: liveWeighted } = computeWeighted(detail)

  const uploadSuccess = uploadMsg === 'success'
  const uploadError   = uploadMsg.startsWith('error:') ? uploadMsg.slice(6) : ''

  const postPAR  = isPost ? c.parScore?.totalWeighted : null
  const prePAR   = isPost ? preCase?.parScore?.totalWeighted : null
  const parDelta = (postPAR != null && prePAR != null) ? prePAR - postPAR : null

  const hasComparisonData = isPost && preCaseLandmarks != null && postCaseLandmarks != null &&
    ['UPPER','LOWER','BUCCAL'].some(slot =>
      Object.keys(preCaseLandmarks[slot] ?? {}).length > 0 &&
      Object.keys(postCaseLandmarks[slot] ?? {}).length > 0
    )

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
          {preCase && (
            <Link to={`/cases/${preCase.id}`} className="btn btn-primary" style={{ marginTop: 16, display: 'inline-flex' }}>
              Open Pre-Treatment Case →
            </Link>
          )}
        </div>
      </div>
    )
  }

  const getModelUrl = (slot) => {
    const mf = c.modelFiles?.find(f => f.slot === slot)
    if (!mf) return null
    return `cases/${id}/models/${slot}`
  }

  return (
    <div className="page">
      {/* REQUIREMENT 3: Finalization modal */}
      {showFinalizeModal && (
        <FinalizeModal
          parScore={c.parScore?.totalWeighted ?? 0}
          onConfirm={finalize}
          onCancel={() => setShowFinalizeModal(false)}
        />
      )}

      {/* Ask whether to apply the ML prediction as the final score, or score manually */}
      {showScoreChoice && (
        <ScoreChoiceModal
          mlScore={c.mlPredictedScore}
          applying={applyingMl}
          applyError={mlApplyError}
          onUseMl={applyMlScore}
          onUseManual={() => { setShowScoreChoice(false); setShowManualOverride(true) }}
          onClose={() => setShowScoreChoice(false)}
        />
      )}

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
        {!finalized && hasPAR && isOrthodontist && (
          <button className="btn btn-outline btn-sm" onClick={requestFinalize}
            style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>
            ✔ Finalise Case
          </button>
        )}
      </div>

      {c.notes && <div className="alert alert-info" style={{ marginBottom: 20 }}>{c.notes}</div>}

      {/* REQUIREMENT 2: PRE case reference for POST cases */}
      {isPost && c.preCase && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid #8b5cf6', padding: '12px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#7c3aed', marginBottom: 4 }}>
            📎 Compared to PRE Case
          </div>
          <div style={{ fontSize: 13, color: '#374151' }}>
            PRE Case <strong>#{c.preCase.id}</strong>
            {preCase?.createdAt && (
              <span style={{ color: '#6b7280', marginLeft: 8 }}>
                from {new Date(preCase.createdAt).toLocaleDateString()}
              </span>
            )}
            {' '}
            <Link to={`/cases/${c.preCase.id}`} style={{ color: 'var(--blue-mid)', fontSize: 12, marginLeft: 8 }}>
              View PRE case →
            </Link>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            Verify this is the correct pre-treatment case before finalising.
          </div>
        </div>
      )}

      {/* ── PAR Score Result ──────────────────────────────────────────── */}
      {hasPAR && (
        <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--blue-mid)' }}>
          <div className="card-title">PAR Score Result</div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ textAlign: 'center', minWidth: 120 }}>
              <div style={{ fontSize: 52, fontWeight: 800, color: 'var(--blue-dark)', lineHeight: 1 }}>
                {c.parScore.totalWeighted}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Weighted PAR Score</div>
              {c.parScore.scoreSource && (
                <div style={{ marginTop: 6 }}>
                  <span className="badge badge-gray" style={{ fontSize: 11, padding: '3px 10px' }}>
                    {SOURCE_LABEL[c.parScore.scoreSource] ?? c.parScore.scoreSource}
                  </span>
                </div>
              )}
              {c.parScore.classification && (
                <div style={{ marginTop: 10 }}>
                  <span className={`badge ${CLASS_BADGE[c.parScore.classification] ?? 'badge-gray'}`}
                    style={{ fontSize: 13, padding: '4px 14px' }}>
                    {c.parScore.classification}
                  </span>
                </div>
              )}
              {parDelta != null && (
                <div style={{
                  marginTop: 12, padding: '6px 12px',
                  background: parDelta > 0 ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${parDelta > 0 ? '#86efac' : '#fca5a5'}`,
                  borderRadius: 8, fontSize: 13,
                }}>
                  <span style={{ fontWeight: 700, color: parDelta > 0 ? '#15803d' : '#b91c1c' }}>
                    {parDelta > 0 ? `↓ ${parDelta} pts improved` : `↑ ${Math.abs(parDelta)} pts worse`}
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    vs. pre-treatment score of {prePAR}
                  </div>
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 240 }}>
              {c.parScore.scoreSource === 'ML' ? (
                <div style={{
                  background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8,
                  padding: '10px 14px', fontSize: 12, color: '#92400e', lineHeight: 1.5,
                }}>
                  This score was taken directly from the ML model's total prediction.
                  The ML model does not produce a per-component breakdown, so the
                  Upper Anterior / Buccal / Overjet / Overbite / Centreline values
                  aren't available for this score. To see a full component
                  breakdown, use the Manual Override panel below or run the 3D
                  landmark auto-score.
                </div>
              ) : (
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
                    { label: 'Upper Anterior', key: 'upperAnterior', wt: 1 },
                    { label: 'Lower Anterior', key: 'lowerAnterior', wt: 1 },
                    { label: 'Buccal (Right)', key: 'buccalRight',   wt: 1 },
                    { label: 'Buccal (Left)',  key: 'buccalLeft',    wt: 1 },
                    { label: 'Overjet',        key: 'overjet',       wt: 6 },
                    { label: 'Overbite',       key: 'overbite',      wt: 2 },
                    { label: 'Centreline',     key: 'centreline',    wt: 4 },
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ML Predicted PAR — now the primary/default score path ─────── */}
      <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--blue-mid)', background: '#f8fafc' }}>
        <div className="card-title" style={{ color: 'var(--blue-dark)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          🤖 ML Predicted PAR
        </div>

        {/* REQUIREMENT 12: Null guard — never access mlPredictedScore without optional chaining */}
        {orthoCase?.mlPredictedScore != null ? (
          <>
            <div style={{ fontSize: 44, fontWeight: 800, color: 'var(--blue-dark)', lineHeight: 1, marginBottom: 8 }}>
              {orthoCase.mlPredictedScore.toFixed(1)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
              Automatically detected from the uploaded 3D models — no manual landmark placement required.
            </div>

            {/* Confidence note banner */}
            {orthoCase?.mlConfidenceNote && (
              <div style={{
                background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8,
                padding: '8px 12px', fontSize: 12, color: '#92400e', marginBottom: 10,
              }}>
                ⚠️ {orthoCase.mlConfidenceNote}
              </div>
            )}

            {!finalized && (
              c.parScore?.scoreSource === 'ML' ? (
                <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
                  ✓ This ML prediction is currently the case's final PAR score.
                </div>
              ) : (
                <>
                  {mlApplyError && <div className="alert alert-error" style={{ marginBottom: 8, fontSize: 12 }}>{mlApplyError}</div>}
                  <button className="btn btn-outline btn-sm" onClick={applyMlScore} disabled={applyingMl}>
                    {applyingMl ? '⏳ Applying…' : '✅ Use This Score as Final'}
                  </button>
                </>
              )
            )}
          </>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            ML prediction not yet available — upload all three STL files below to trigger it automatically.
          </div>
        )}

        <div style={{ marginTop: 10, fontSize: 11, color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
          ⚠️ ML predictions are experimental. If this score looks off, use the Manual Override / Calibration panel below.
        </div>
      </div>

      {/* ── 3D Models Upload ──────────────────────────────────────────── */}
      {!finalized && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">3D Model Upload</div>
          <ModelUploadSlots
            files={files}
            errors={fileErrors}
            existingModels={c.modelFiles}
            onChange={handleFileChange}
          />
          {uploadSuccess && <div className="alert alert-success" style={{ marginTop: 10 }}>Models uploaded successfully. ML prediction is running in background.</div>}
          {uploadError  && <div className="alert alert-error"   style={{ marginTop: 10 }}>{uploadError}</div>}
          <button className="btn btn-primary" style={{ marginTop: 12 }}
            onClick={uploadModels} disabled={uploading}>
            {uploading ? '⏳ Uploading…' : '⬆ Upload 3D Models'}
          </button>
        </div>
      )}

      {/* ── 3D Viewer ─────────────────────────────────────────────────── */}
      {modelsOk && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">3D Model Viewer</div>
          {/* REQUIREMENT 12: Wrap in ErrorBoundary */}
          <ErrorBoundary>
            <Case3DViewer
              caseId={Number(id)}
              modelFiles={c.modelFiles}
              activeSlot={viewerSlot}
              onSlotChange={setViewerSlot}
            />
          </ErrorBoundary>
        </div>
      )}

      {/* ── Manual Override / Calibration (collapsed by default) ───────
          Landmark placement and manual component-by-component scoring
          are a fallback/calibration tool, not the primary clinical workflow.
          The ML prediction above is the default path. This panel stays
          fully functional but hidden until the orthodontist opens it. ── */}
      {modelsOk && !finalized && (
        <div className="card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
          <button
            onClick={() => setShowManualOverride(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', background: showManualOverride ? 'var(--blue-pale)' : '#f8fafc',
              border: 'none', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
                🔧 Manual Override / Calibration
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Landmark placement and manual PAR entry — use only to calibrate or override the ML score
              </div>
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
              {showManualOverride ? '▲ Hide' : '▼ Show'}
            </span>
          </button>

          {showManualOverride && (
            <div style={{ padding: 20, borderTop: '1px solid var(--border)' }}>
              
              {/* ── Scoring method switcher ───────────────────────────────
                  Manual weighted scoring is the default and only thing most
                  orthodontists need — it needs no landmark placement at all.
                  3D landmark placement is an optional, advanced way to derive
                  the same weighted fields automatically and is opt-in. ── */}
              <div style={{ marginBottom: 18 }}>
                <ToggleGroup
                  value={scoringTab}
                  onChange={setScoringTab}
                  options={[
                    { value: 'manual',   label: '📊 Manual PAR Scoring' },
                    { value: 'landmark', label: '🦷 3D Landmark Placement (Advanced, optional)' },
                  ]}
                />
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: -4 }}>
                  Most orthodontists only need <strong>Manual PAR Scoring</strong> — pick the
                  weighted value for each component below per the British PAR index criteria.
                  3D landmark placement is an optional tool that auto-fills those same values
                  from clicked points on the model; it is not required to score a case.
                </p>
              </div>

              {/* ── 3D Auto-Score (LandmarkPanel) — optional, advanced ──── */}
              {scoringTab === 'landmark' && (
                <div style={{ marginBottom: 24 }}>
                  <div className="card-title">3D Auto-Score — Landmark Placement (optional)</div>
                  {/* REQUIREMENT 12: Wrap in ErrorBoundary */}
                  <ErrorBoundary>
                    <ThreeDAutoScore
                      caseId={Number(id)}
                      modelFiles={c.modelFiles}
                      onScored={load}
                    />
                  </ErrorBoundary>
                </div>
              )}

              {/* ── Manual PAR Entry — default, primary workflow ────────── */}
              {scoringTab === 'manual' && (
              <div>
                <div className="card-title">Manual PAR Scoring</div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -6, marginBottom: 16 }}>
                  Select the score for each component below, per the British PAR index criteria.
                  The weighted total updates live as you go.
                </p>

                {calcError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{calcError}</div>}

                {/* Live score preview */}
                <div style={{
                  background: 'var(--blue-pale)', borderRadius: 8, padding: '12px 16px', marginBottom: 16,
                  display: 'flex', alignItems: 'center', gap: 16,
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>LIVE WEIGHTED</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--blue-dark)' }}>{liveWeighted}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Adjust the fields below and click "Calculate PAR" to save.
                  </div>
                </div>

                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: '4px 28px', marginBottom: 18,
                }}>
                  {/* Upper anterior segment */}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 8 }}>
                      Upper Anterior Segment <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(×1)</span>
                    </div>
                    {UPPER_ANT_SEGMENTS.map(seg => (
                      <ScoreSelect
                        key={seg.key}
                        label={`Contact point ${seg.label}`}
                        value={detail[seg.key]}
                        options={CONTACT_SCORE_OPTIONS}
                        onChange={v => setField(seg.key, v)}
                      />
                    ))}
                  </div>

                  {/* Lower anterior segment */}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 8 }}>
                      Lower Anterior Segment <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(×1)</span>
                    </div>
                    {LOWER_ANT_SEGMENTS.map(seg => (
                      <ScoreSelect
                        key={seg.key}
                        label={`Contact point ${seg.label}`}
                        value={detail[seg.key]}
                        options={CONTACT_SCORE_OPTIONS}
                        onChange={v => setField(seg.key, v)}
                      />
                    ))}
                  </div>

                  {/* Buccal right */}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 8 }}>
                      Buccal Occlusion — Right <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(×1)</span>
                    </div>
                    <ScoreSelect label="Antero-Posterior" value={detail.buccal_ap_right}
                      options={BUCCAL_AP_OPTIONS} onChange={v => setField('buccal_ap_right', v)} />
                    <ScoreSelect label="Transverse (Crossbite)" value={detail.buccal_trans_right}
                      options={BUCCAL_TRANS_OPTIONS} onChange={v => setField('buccal_trans_right', v)} />
                    <ScoreSelect label="Vertical (Open Bite)" value={detail.buccal_vert_right}
                      options={BUCCAL_VERT_OPTIONS} onChange={v => setField('buccal_vert_right', v)} />
                  </div>

                  {/* Buccal left */}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 8 }}>
                      Buccal Occlusion — Left <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(×1)</span>
                    </div>
                    <ScoreSelect label="Antero-Posterior" value={detail.buccal_ap_left}
                      options={BUCCAL_AP_OPTIONS} onChange={v => setField('buccal_ap_left', v)} />
                    <ScoreSelect label="Transverse (Crossbite)" value={detail.buccal_trans_left}
                      options={BUCCAL_TRANS_OPTIONS} onChange={v => setField('buccal_trans_left', v)} />
                    <ScoreSelect label="Vertical (Open Bite)" value={detail.buccal_vert_left}
                      options={BUCCAL_VERT_OPTIONS} onChange={v => setField('buccal_vert_left', v)} />
                  </div>

                  {/* Overjet */}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 8 }}>
                      Overjet <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(×6)</span>
                    </div>
                    <ToggleGroup
                      value={overjetType}
                      onChange={handleOverjetTypeChange}
                      options={[
                        { value: 'positive', label: 'Positive Overjet' },
                        { value: 'reverse',  label: 'Reverse / Crossbite' },
                      ]}
                    />
                    {overjetType === 'positive' ? (
                      <ScoreSelect label="Overjet" value={detail.overjet_pos}
                        options={OVERJET_POS_OPTIONS} onChange={v => setField('overjet_pos', v)} />
                    ) : (
                      <ScoreSelect label="Reverse overjet" value={detail.overjet_neg}
                        options={OVERJET_NEG_OPTIONS} onChange={v => setField('overjet_neg', v)} />
                    )}
                  </div>

                  {/* Overbite */}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 8 }}>
                      Overbite <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(×2)</span>
                    </div>
                    <ToggleGroup
                      value={overbiteType}
                      onChange={handleOverbiteTypeChange}
                      options={[
                        { value: 'overbite', label: 'Overbite' },
                        { value: 'openbite', label: 'Anterior Open Bite' },
                      ]}
                    />
                    {overbiteType === 'overbite' ? (
                      <ScoreSelect label="Overbite" value={detail.overbite_ob}
                        options={OVERBITE_OB_OPTIONS} onChange={v => setField('overbite_ob', v)} />
                    ) : (
                      <ScoreSelect label="Anterior open bite" value={detail.overbite_open}
                        options={OVERBITE_OPEN_OPTIONS} onChange={v => setField('overbite_open', v)} />
                    )}
                  </div>

                  {/* Centreline */}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 8 }}>
                      Centreline <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(×4)</span>
                    </div>
                    <ScoreSelect label="Centreline deviation" value={detail.centreline}
                      options={CENTRELINE_OPTIONS} onChange={v => setField('centreline', v)} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" onClick={calculatePAR} disabled={calculating}>
                    {calculating ? '⏳ Calculating…' : '📊 Calculate PAR Score'}
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => { setDetail(EMPTY_DETAIL()); setOverjetType('positive'); setOverbiteType('overbite') }}
                  >
                    ↺ Reset Form
                  </button>
                </div>
              </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Before/After comparison ───────────────────────────────────── */}
      {isPost && hasComparisonData && (
        <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid #8b5cf6' }}>
          <div className="card-title">📊 Treatment Improvement — Landmark Displacement</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Landmark displacement between pre- and post-treatment scans.
          </p>
          {['UPPER', 'LOWER', 'BUCCAL'].map(slot => {
            const improvements = calcLandmarkImprovement(
              preCaseLandmarks[slot]  ?? {},
              postCaseLandmarks[slot] ?? {},
            )
            if (!improvements.length) return null
            return (
              <div key={slot} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: '#374151' }}>{slot}</div>
                {improvements.slice(0, 5).map(imp => (
                  <div key={imp.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 60, fontFamily: 'monospace', fontSize: 11 }}>{imp.name}</span>
                    <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min((imp.displacement / 10) * 100, 100)}%`,
                        height: '100%', borderRadius: 4,
                        background: imp.displacement < 2 ? '#22c55e' : imp.displacement < 5 ? '#f59e0b' : '#ef4444',
                      }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#6b7280', width: 50, textAlign: 'right' }}>
                      {imp.displacement.toFixed(1)}mm
                    </span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}