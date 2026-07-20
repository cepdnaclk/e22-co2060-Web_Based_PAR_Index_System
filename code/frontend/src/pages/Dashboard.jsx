import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { patientApi, trainingApi, adminApi, mlApi } from '../api/api'

export default function Dashboard() {
  const { user, isUndergrad, isAdmin, isOrthodontist } = useAuth()
  const [stats, setStats]       = useState({})
  const [mlStatus, setMlStatus] = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const s = {}

        if (isOrthodontist()) {
          const [{ data: pts }, { data: assigned }] = await Promise.all([
            patientApi.list(),
            trainingApi.listAssigned(),
          ])
          s.patients       = pts.length
          s.pendingReviews = assigned.filter(t => t.status === 'PENDING').length
          s.totalReviews   = assigned.length
        }

        if (isAdmin()) {
          const [{ data: users }, { data: pts }] = await Promise.all([
            adminApi.users(),
            patientApi.list(),
          ])
          // Order: Orthodontists, Undergraduates, Patients
          s.orthodontists  = users.filter(u => u.role === 'ORTHODONTIST').length
          s.undergraduates = users.filter(u => u.role === 'UNDERGRADUATE').length
          s.patients       = pts.length
        }

        if (isUndergrad()) {
          const { data } = await trainingApi.listMy()
          s.mySubmissions = data.length
          s.pending       = data.filter(t => t.status === 'PENDING').length
          s.approved      = data.filter(t => t.status === 'APPROVED').length
          s.rejected      = data.filter(t => t.status === 'REJECTED').length
        }

        setStats(s)
      } catch (_) {}
      finally { setLoading(false) }

      // Live ML status — never let this block the rest of the dashboard
      try {
        const { data } = await mlApi.status()
        setMlStatus(data)
      } catch (_) {
        setMlStatus(null)
      }
    }
    load()
  }, [])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const displayName = isOrthodontist()
    ? `Dr. ${user?.name?.split(' ')[0]}`
    : user?.name?.split(' ')[0]

  if (loading) return <div className="centered"><div className="spinner spinner-lg" /></div>

  return (
    <div className="page">
      <div style={{ marginBottom: 28 }}>
        <h1>{greeting()}, {displayName} 👋</h1>
        <p style={{ marginTop: 4, color: 'var(--text-muted)' }}>Welcome to the PAR Index System</p>
      </div>

      {/* ── Orthodontist ─────────────────────────────────────── */}
      {isOrthodontist() && (
        <>
          <h2 style={{ marginBottom: 14 }}>Clinical Overview</h2>
          <div className="row" style={{ marginBottom: 28 }}>
            <StatCard value={stats.patients       ?? 0} label="My Patients"              color="var(--blue-dark)" />
            <StatCard value={stats.pendingReviews ?? 0} label="Submissions to Review"    color="var(--amber)" />
            <StatCard value={stats.totalReviews   ?? 0} label="Total Assigned Reviews"   color="var(--blue-mid)" />
          </div>
          <div className="row" style={{ marginBottom: 32 }}>
            <QuickCard
              title="Manage Patients"
              desc="Create new patient records, view profiles, and open orthodontic cases for PAR scoring."
              to="/patients" btnLabel="Go to Patients" color="var(--blue-mid)"
            />
            <QuickCard
              title="Review Submissions"
              desc="Review and approve 3D model training submissions assigned to you by dental undergraduates."
              to="/training/review" btnLabel="Open Reviews" color="var(--green)"
            />
          </div>
        </>
      )}

      {/* ── Admin ─────────────────────────────────────────────── */}
      {isAdmin() && (
        <>
          <h2 style={{ marginBottom: 14 }}>System Overview</h2>
          {/* Order: Orthodontists, Undergraduates, Patients */}
          <div className="row" style={{ marginBottom: 28 }}>
            <StatCard value={stats.orthodontists  ?? 0} label="Orthodontists"  color="var(--blue-mid)" />
            <StatCard value={stats.undergraduates ?? 0} label="Undergraduates" color="var(--purple)" />
            <StatCard value={stats.patients       ?? 0} label="Patients"       color="var(--green)" />
          </div>
          <div className="row" style={{ marginBottom: 32 }}>
            <QuickCard
              title="Patient Records"
              desc="View all patient records and their associated cases (read-only for admin)."
              to="/patients" btnLabel="View Patients" color="var(--blue-mid)"
            />
            <QuickCard
              title="Admin Panel"
              desc="Manage users, change roles, view submission statuses and the full system audit log."
              to="/admin" btnLabel="Open Admin Panel" color="var(--coral)"
            />
          </div>
        </>
      )}

      {/* ── Undergraduate ─────────────────────────────────────── */}
      {isUndergrad() && (
        <>
          <h2 style={{ marginBottom: 14 }}>Training Dataset Contributions</h2>
          <div className="row" style={{ marginBottom: 28 }}>
            <StatCard value={stats.mySubmissions ?? 0} label="Total Submissions" color="var(--blue-dark)" />
            <StatCard value={stats.pending       ?? 0} label="Pending Review"    color="var(--amber)" />
            <StatCard value={stats.approved      ?? 0} label="Approved"          color="var(--green)" />
            <StatCard value={stats.rejected      ?? 0} label="Rejected"          color="var(--coral)" />
          </div>
          <div className="row" style={{ marginBottom: 32 }}>
            <QuickCard
              title="Submit 3D Models"
              desc="Upload a set of three 3D dental model files (upper, lower, buccal) with a verified PAR score. Assigned to an orthodontist for review."
              to="/training/submit" btnLabel="New Submission" color="var(--purple)"
            />
            <QuickCard
              title="My Submissions"
              desc="Track the review status of your submitted training sets and see orthodontist feedback."
              to="/training" btnLabel="View Submissions" color="var(--blue-mid)"
            />
          </div>
        </>
      )}

      {/* ML banner — driven by real /api/v1/ml/status, not a static placeholder */}
      <MLBanner mlStatus={mlStatus} />
    </div>
  )
}

function MLBanner({ mlStatus }) {
  // Still loading or status endpoint unreachable — neutral, not "coming soon"
  if (!mlStatus) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--text-muted)', background: 'var(--bg-subtle, #f8fafc)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: 14 }}>ML Prediction Status Unavailable</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
              Couldn't reach the ML service status endpoint right now.
            </div>
          </div>
        </div>
      </div>
    )
  }

  const hasModel = !!mlStatus.latestVersion && mlStatus.currentStatus !== 'NO_RUNS'
  const isTraining = mlStatus.currentStatus === 'TRAINING'

  if (isTraining) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--blue-mid)', background: '#eff6ff' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--blue-mid)', fontSize: 14 }}>ML Model Training In Progress</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
              Training on {mlStatus.approvedDatasets} approved dataset{mlStatus.approvedDatasets === 1 ? '' : 's'}. New predictions will use this model once training completes.
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (hasModel) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--green, #16a34a)', background: '#f0fdf4' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <div>
            <div style={{ fontWeight: 600, color: '#16a34a', fontSize: 14 }}>
              ML Prediction Live — Model {mlStatus.latestVersion}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
              Automated PAR prediction from uploaded 3D models is active, trained on {mlStatus.approvedDatasets} approved
              dataset{mlStatus.approvedDatasets === 1 ? '' : 's'}{mlStatus.bestAccuracy ? ` (best accuracy ${mlStatus.bestAccuracy}%)` : ''}.
              Predictions remain experimental and never replace the clinical PAR score.
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Genuinely no trained model yet
  return (
    <div className="card" style={{ borderLeft: '4px solid var(--amber)', background: 'var(--amber-light)' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 20 }}>🤖</span>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--amber)', fontSize: 14 }}>ML Prediction Not Yet Trained</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            {mlStatus.approvedDatasets > 0
              ? `${mlStatus.approvedDatasets} approved dataset${mlStatus.approvedDatasets === 1 ? '' : 's'} ready. An admin needs to start a training run before predictions go live.`
              : 'No approved training datasets yet. Once undergraduates submit STL sets and an orthodontist approves them, an admin can start training.'}
          </div>
        </div>
      </div>
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

function QuickCard({ title, desc, to, btnLabel, color }) {
  return (
    <div className="card col">
      <div style={{ fontWeight: 600, color: 'var(--blue-dark)', marginBottom: 6 }}>{title}</div>
      <p style={{ fontSize: 13, marginBottom: 16, color: 'var(--text-muted)' }}>{desc}</p>
      <Link to={to} className="btn btn-outline btn-sm" style={{ borderColor: color, color, width: 'fit-content' }}>
        {btnLabel} →
      </Link>
    </div>
  )
}