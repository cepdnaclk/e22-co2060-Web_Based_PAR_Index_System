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
  const [exporting, setExporting] = useState(false)

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

  async function exportPDF() {
    setExporting(true)
    try {
      // Find the most recently updated case with a PAR score
      const scoredCases = cases.filter(c => c.parScore)
      if (scoredCases.length === 0) {
        alert('No PAR scores found for this patient.')
        return
      }
      // Sort by createdAt descending to get latest
      const sorted = [...scoredCases].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      const latestCase = sorted[0]
      const score = latestCase.parScore

      // Build HTML content for the PDF
      const preCase  = cases.find(c => c.stage === 'PRE'  && c.parScore)
      const postCase = cases.find(c => c.stage === 'POST' && c.parScore)
      const hasImprovement = preCase && postCase

      const improvement = hasImprovement
        ? Math.round(((preCase.parScore.totalWeighted - postCase.parScore.totalWeighted) / preCase.parScore.totalWeighted) * 100)
        : null

      const outcomeLabel = hasImprovement
        ? (improvement >= 30 ? 'Greatly Improved' : improvement > 0 ? 'Improved' : 'No Improvement / Worse')
        : null

      const outcomeColor = hasImprovement
        ? (improvement >= 30 ? '#16a34a' : improvement > 0 ? '#2563eb' : '#dc2626')
        : null

      const now = new Date()
      const reportDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

      const scoreRows = (s) => {
        if (!s) return ''
        const rows = [
          ['Upper Anterior',      s.upperAnterior,      s.upperAnteriorW],
          ['Right Buccal Segment',s.rightBuccal,        s.rightBuccalW],
          ['Left Buccal Segment', s.leftBuccal,         s.leftBuccalW],
          ['Overjet',             s.overjet,            s.overjetW],
          ['Overbite',            s.overbite,           s.overbiteW],
          ['Midline',             s.midline,            s.midlineW],
          ['Lower Anterior',      s.lowerAnterior,      s.lowerAnteriorW],
        ]
        return rows.map(([label, raw, weighted]) => `
          <tr>
            <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;">${label}</td>
            <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${raw ?? '—'}</td>
            <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600;">${weighted ?? '—'}</td>
          </tr>`).join('')
      }

      const caseSection = (c, title) => {
        if (!c || !c.parScore) return ''
        const s = c.parScore
        return `
          <div style="margin-bottom:28px;">
            <h3 style="font-size:15px;font-weight:700;color:#1e3a5f;margin:0 0 12px;padding-bottom:6px;border-bottom:2px solid #dbeafe;">
              ${title} &nbsp;<span style="font-weight:400;font-size:13px;color:#6b7280;">${new Date(c.createdAt).toLocaleDateString('en-GB')}</span>
            </h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:10px;">
              <thead>
                <tr style="background:#f0f4ff;">
                  <th style="padding:8px 12px;text-align:left;font-weight:600;color:#374151;border-bottom:2px solid #dbeafe;">Component</th>
                  <th style="padding:8px 12px;text-align:center;font-weight:600;color:#374151;border-bottom:2px solid #dbeafe;">Raw Score</th>
                  <th style="padding:8px 12px;text-align:center;font-weight:600;color:#374151;border-bottom:2px solid #dbeafe;">Weighted Score</th>
                </tr>
              </thead>
              <tbody>${scoreRows(s)}</tbody>
            </table>
            <div style="display:flex;justify-content:flex-end;">
              <div style="background:#1e3a5f;color:#fff;padding:8px 20px;border-radius:6px;font-size:14px;font-weight:700;">
                Total Weighted PAR Score: ${s.totalWeighted ?? '—'}
              </div>
            </div>
          </div>`
      }

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>PAR Score Report — ${patient.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #111827; background: #fff; padding: 32px 40px; }
    @media print { body { padding: 0; } @page { margin: 20mm 15mm; } }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #1e3a5f;">
    <div>
      <div style="font-size:22px;font-weight:800;color:#1e3a5f;letter-spacing:-0.5px;">PAR Index System</div>
      <div style="font-size:12px;color:#6b7280;margin-top:3px;">Peer Assessment Rating — Clinical Report</div>
    </div>
    <div style="text-align:right;font-size:12px;color:#6b7280;">
      <div>Report Date: <strong>${reportDate}</strong></div>
      <div>Prepared by: <strong>Dr. ${user?.name}</strong></div>
    </div>
  </div>

  <!-- Patient Info -->
  <div style="background:#f8faff;border:1px solid #dbeafe;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin-bottom:10px;">Patient Information</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;">
      <div><div style="font-size:11px;color:#9ca3af;">Full Name</div><div style="font-weight:600;font-size:14px;">${patient.name}</div></div>
      <div><div style="font-size:11px;color:#9ca3af;">Reference ID</div><div style="font-weight:600;font-size:14px;">${patient.referenceId ?? '—'}</div></div>
      <div><div style="font-size:11px;color:#9ca3af;">Date of Birth</div><div style="font-weight:600;font-size:14px;">${patient.dateOfBirth ?? '—'}</div></div>
      <div><div style="font-size:11px;color:#9ca3af;">Status</div><div style="font-weight:600;font-size:14px;">${patient.isArchived ? 'Archived' : 'Active'}</div></div>
    </div>
  </div>

  ${hasImprovement ? `
  <!-- Treatment Outcome Summary -->
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin-bottom:10px;">Treatment Outcome Summary</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;align-items:center;">
      <div><div style="font-size:11px;color:#9ca3af;">Pre-Treatment PAR</div><div style="font-weight:700;font-size:22px;color:#1e3a5f;">${preCase.parScore.totalWeighted}</div></div>
      <div><div style="font-size:11px;color:#9ca3af;">Post-Treatment PAR</div><div style="font-weight:700;font-size:22px;color:#1e3a5f;">${postCase.parScore.totalWeighted}</div></div>
      <div><div style="font-size:11px;color:#9ca3af;">Reduction</div><div style="font-weight:700;font-size:22px;color:${outcomeColor};">${improvement}%</div></div>
      <div><div style="font-size:11px;color:#9ca3af;">Outcome</div><div style="font-weight:700;font-size:14px;color:${outcomeColor};">${outcomeLabel}</div></div>
    </div>
  </div>` : ''}

  <!-- Latest PAR Score Highlight -->
  <div style="background:#1e3a5f;color:#fff;border-radius:8px;padding:14px 20px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="font-size:11px;opacity:.65;letter-spacing:.08em;text-transform:uppercase;">Latest PAR Score (${latestCase.stage === 'PRE' ? 'Pre-Treatment' : 'Post-Treatment'})</div>
      <div style="font-size:32px;font-weight:800;margin-top:2px;">${score.totalWeighted}</div>
    </div>
    <div style="text-align:right;font-size:12px;opacity:.75;">
      <div>Case Date: ${new Date(latestCase.createdAt).toLocaleDateString('en-GB')}</div>
      <div style="margin-top:4px;">${latestCase.isFinalized ? '✔ Finalised' : '⚠ Draft'}</div>
    </div>
  </div>

  <!-- Detailed Score Breakdown -->
  <h2 style="font-size:16px;font-weight:700;color:#1e3a5f;margin-bottom:16px;">Detailed Score Breakdown</h2>

  ${caseSection(preCase || latestCase, preCase ? 'Pre-Treatment PAR Scores' : (latestCase.stage === 'POST' ? 'Post-Treatment PAR Scores' : 'PAR Scores'))}
  ${hasImprovement ? caseSection(postCase, 'Post-Treatment PAR Scores') : ''}

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;display:flex;justify-content:space-between;">
    <span>PAR Index System — Confidential Clinical Document</span>
    <span>Generated on ${reportDate}</span>
  </div>
</body>
</html>`

      // Open print dialog in a new window
      const win = window.open('', '_blank', 'width=900,height=700')
      win.document.write(html)
      win.document.close()
      win.focus()
      setTimeout(() => { win.print() }, 600)
    } catch (err) {
      alert('Failed to generate PDF report.')
      console.error(err)
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <div className="centered"><div className="spinner spinner-lg" /></div>
  if (error)   return <div className="page"><div className="alert alert-error">{error}</div></div>
  if (!patient) return <div className="page"><div className="alert alert-error">Patient not found.</div></div>

  const hasPARScores = cases.some(c => c.parScore)

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
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {isOrthodontist() && hasPARScores && (
            <button
              className="btn btn-outline btn-sm"
              onClick={exportPDF}
              disabled={exporting}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {exporting
                ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Generating…</>
                : <>📄 Export PAR Report</>}
            </button>
          )}
          {isOrthodontist() && (
            <Link to={`/patients/${patient.id}/cases/new`} className="btn btn-primary">+ New Case</Link>
          )}
        </div>
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