import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_BADGE = {
  DENTIST:       { label: 'Dentist',       cls: 'badge-blue'   },
  ORTHODONTIST:  { label: 'Orthodontist',  cls: 'badge-blue'   },
  UNDERGRADUATE: { label: 'Undergraduate', cls: 'badge-purple' },
  ADMIN:         { label: 'Admin',         cls: 'badge-coral'  },
}

export default function Layout() {
  const { user, logout, isClinical, isUndergrad, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  const badge = ROLE_BADGE[user?.role] ?? { label: user?.role, cls: 'badge-gray' }

  return (
    <div style={{ display: 'flex', minHeight: '100svh' }}>
      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside style={{
        width: 220, background: 'var(--blue-dark)', color: '#fff',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        padding: '0 0 16px'
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,.12)' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#fff', letterSpacing: '-.3px' }}>
            PAR Index
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>
            System
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          <NavItem to="/dashboard" icon="⊞" label="Dashboard" />

          {isClinical() && <>
            <NavGroup label="Clinical" />
            <NavItem to="/patients" icon="👤" label="Patients" />
            <NavItem to="/training/review" icon="🔍" label="Review Submissions" />
          </>}

          {isUndergrad() && <>
            <NavGroup label="Training Dataset" />
            <NavItem to="/training"        icon="📁" label="My Submissions" />
            <NavItem to="/training/submit" icon="⬆" label="Submit Models" />
          </>}

          {isAdmin() && <>
            <NavGroup label="Administration" />
            <NavItem to="/admin" icon="⚙" label="Admin Panel" />
          </>}
        </nav>

        {/* User footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.12)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
            {user?.name}
          </div>
          <span className={`badge ${badge.cls}`} style={{ fontSize: 11 }}>
            {badge.label}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}
            style={{ marginTop: 10, width: '100%', color: 'rgba(255,255,255,.6)', justifyContent: 'center' }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────── */}
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}

function NavGroup({ label }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
      color: 'rgba(255,255,255,.35)', padding: '14px 10px 4px'
    }}>
      {label}
    </div>
  )
}

function NavItem({ to, icon, label }) {
  return (
    <NavLink to={to} style={({ isActive }) => ({
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px', borderRadius: 7, textDecoration: 'none',
      fontSize: 14, fontWeight: 500,
      background: isActive ? 'rgba(255,255,255,.13)' : 'transparent',
      color: isActive ? '#fff' : 'rgba(255,255,255,.65)',
      marginBottom: 2, transition: 'all .15s',
    })}>
      <span style={{ fontSize: 15, width: 18, textAlign: 'center' }}>{icon}</span>
      {label}
    </NavLink>
  )
}