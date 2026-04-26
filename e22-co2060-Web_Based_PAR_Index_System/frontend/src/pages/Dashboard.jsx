import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { patientApi, trainingApi, adminApi } from '../api/api'

export default function Dashboard() {
  const { user, isClinical, isUndergrad, isAdmin } = useAuth()
  const [stats, setStats]     = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const s = {}

        // FIXED: Admin is separate from clinical — avoid double-fetching patients
        if (isClinical() && !isAdmin()) {
          const { data } = await patientApi.list()
          s.patients = data.length
        }

        if (isAdmin()) {
          const [{ data: users }, { data: sets }, { data: pts }] = await Promise.all([
            adminApi.users(),
            trainingApi.listAll(),
            patientApi.list(),
          ])
          s.totalUsers    = users.length
          s.pendingReview = sets.filter(t => t.status === 'PENDING').length
          s.patients      = pts.length
        }

        if (isUndergrad() && !isAdmin()) {
          const { data } = await trainingApi.listMy()
          s.mySubmissions = data.length
          s.pending       = data.filter(t => t.status === 'PENDING').length
          s.approved      = data.filter(t => t.status === 'APPROVED').length
        }

        setStats(s)
      } catch (_) {}
      finally { setLoading(false) }
    }
    load()
  }, [])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  if (loading) return <div className="centered"><div className="spinner spinner-lg" /></div>

  return (
    <div className="page">
      <div style={{ marginBottom: 28 }}>
        <h1>{greeting()}, {user?.name?.split(' ')[0]} 👋</h1>
        <p style={{ marginTop: 4 }}>Welcome to the PAR Index System</p>
      </div>

      {/* ── Clinical ───────────────────────────────────────────────── */}
      {(isClinical() || isAdmin()) && (
        <>
          <h2 style={{ marginBottom: 14 }}>Clinical Overview</h2>
          <div className="row" style={{ marginBottom: 28 }}>
            <StatCard value={stats.patients ?? 0} label="Total Patients" color="var(--blue-dark)" />
          </div>
          <div className="row" style={{ marginBottom: 32 }}>
            <QuickCard
              title="Manage Patients"
              desc="Create new patient records, view profiles, and open orthodontic cases."
              to="/patients" btnLabel="Go to Patients" color="var(--blue-mid)"
            />
            <QuickCard
              title="Calculate PAR Score"
              desc="Open a case, enter the seven PAR component scores, and compute the weighted total."
              to="/patients" btnLabel="Open Cases" color="var(--green)"
            />
          </div>
        </>
      )}

      {/* ── Undergraduate ──────────────────────────────────────────── */}
      {isUndergrad() && !isAdmin() && (
        <>
          <h2 style={{ marginBottom: 14 }}>Training Dataset Contributions</h2>
          <div className="row" style={{ marginBottom: 28 }}>
            <StatCard value={stats.mySubmissions ?? 0} label="Total Submissions" color="var(--purple)" />
            <StatCard value={stats.pending ?? 0}       label="Pending Review"    color="var(--amber)" />
            <StatCard value={stats.approved ?? 0}      label="Approved"          color="var(--green)" />
          </div>
          <div className="row" style={{ marginBottom: 32 }}>
            <QuickCard
              title="Submit 3D Models"
              desc="Upload a set of three 3D dental model files (upper, lower, buccal) with a ground-truth PAR label."
              to="/training/submit" btnLabel="New Submission" color="var(--purple)"
            />
            <QuickCard
              title="My Submissions"
              desc="Track the review status of your submitted training sets."
              to="/training" btnLabel="View Submissions" color="var(--blue-mid)"
            />
          </div>
        </>
      )}

      {/* ── Admin ──────────────────────────────────────────────────── */}
      {isAdmin() && (
        <>
          <h2 style={{ marginBottom: 14 }}>System Overview</h2>
          <div className="row" style={{ marginBottom: 28 }}>
            <StatCard value={stats.totalUsers ?? 0}    label="Registered Users"          color="var(--blue-dark)" />
            <StatCard value={stats.pendingReview ?? 0} label="Training Sets Pending"      color="var(--amber)" />
          </div>
          <div className="row" style={{ marginBottom: 32 }}>
            <QuickCard
              title="Admin Panel"
              desc="Manage users, change roles, review undergraduate training dataset submissions, view audit log."
              to="/admin" btnLabel="Open Admin Panel" color="var(--coral)"
            />
            <QuickCard
              title="Training Dataset"
              desc="Review and approve 3D model submissions from dental undergraduates."
              to="/admin" btnLabel="Review Submissions" color="var(--purple)"
            />
          </div>
        </>
      )}

      {/* ML future banner */}
      <div className="card" style={{ borderLeft: '4px solid var(--amber)', background: 'var(--amber-light)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--amber)', fontSize: 14 }}>
              ML Prediction — Coming Soon
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
              Automated PAR score prediction from 3D dental models will be available once the ML model is
              trained on the approved undergraduate dataset.
            </div>
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
      <p style={{ fontSize: 13, marginBottom: 16 }}>{desc}</p>
      <Link to={to} className="btn btn-outline btn-sm"
        style={{ borderColor: color, color, width: 'fit-content' }}>
        {btnLabel} →
      </Link>
    </div>
  )
}
