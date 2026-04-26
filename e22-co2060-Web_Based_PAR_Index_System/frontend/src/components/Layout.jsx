import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_BADGE = {
  ORTHODONTIST:  { label: 'Orthodontist',  cls: 'badge-blue'   },
  UNDERGRADUATE: { label: 'Undergraduate', cls: 'badge-purple' },
  ADMIN:         { label: 'Admin',         cls: 'badge-coral'  },
}

export default function Layout() {
  const { user, isUndergrad, isAdmin, isOrthodontist } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }
  const { logout } = useAuth()
  const badge = ROLE_BADGE[user?.role] ?? { label: user?.role, cls: 'badge-gray' }
  const displayName = user?.role === 'ORTHODONTIST' ? `Dr. ${user?.name}` : user?.name

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div style={{ display: 'flex', minHeight: '100svh' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div onClick={closeSidebar} className="mobile-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40 }} />
      )}

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}
        style={{
          width: 230, background: 'var(--blue-dark)', color: '#fff',
          display: 'flex', flexDirection: 'column', flexShrink: 0,
          padding: '0 0 16px', zIndex: 50,
        }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#fff', letterSpacing: '-.3px' }}>PAR Index</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>System</div>
          </div>
          <button className="sidebar-close-btn" onClick={closeSidebar}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.6)', fontSize: 20, cursor: 'pointer', display: 'none', padding: 4 }}>✕</button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          <NavItem to="/dashboard" icon="⊞" label="Dashboard" onClick={closeSidebar} />

          {/* Orthodontist — full clinical access */}
          {isOrthodontist() && <>
            <NavGroup label="Clinical" />
            <NavItem to="/patients"        icon="👤" label="Patients"            onClick={closeSidebar} />
            <NavItem to="/training/review" icon="🔍" label="Review Submissions"  onClick={closeSidebar} />
          </>}

          {/* Admin — read-only patient view + admin panel */}
          {isAdmin() && <>
            <NavGroup label="Overview" />
            <NavItem to="/patients" icon="👤" label="Patients (View)"  onClick={closeSidebar} />
            <NavGroup label="Administration" />
            <NavItem to="/admin"    icon="⚙"  label="Admin Panel"      onClick={closeSidebar} />
          </>}

          {/* Undergraduate — training only */}
          {isUndergrad() && <>
            <NavGroup label="Training Dataset" />
            <NavItem to="/training"        icon="📁" label="My Submissions" onClick={closeSidebar} />
            <NavItem to="/training/submit" icon="⬆"  label="Submit Models"  onClick={closeSidebar} />
          </>}
        </nav>

        {/* User footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.12)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{displayName}</div>
          <span className={`badge ${badge.cls}`} style={{ fontSize: 11 }}>{badge.label}</span>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}
            style={{ marginTop: 10, width: '100%', color: 'rgba(255,255,255,.6)', justifyContent: 'center' }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────── */}
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Mobile top bar */}
        <div className="mobile-topbar" style={{
          display: 'none', alignItems: 'center', gap: 12,
          padding: '12px 16px', background: 'var(--blue-dark)',
          borderBottom: '1px solid rgba(255,255,255,.12)',
          position: 'sticky', top: 0, zIndex: 30,
        }}>
          <button onClick={() => setSidebarOpen(true)}
            style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', padding: 0 }}>
            ☰
          </button>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>PAR Index System</span>
        </div>

        <div style={{ flex: 1 }}>
          <Outlet />
        </div>
      </main>

      <style>{`
        @media (max-width: 768px) {
          .sidebar {
            position: fixed !important;
            top: 0; left: 0; bottom: 0;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
          }
          .sidebar.sidebar-open { transform: translateX(0); }
          .sidebar-close-btn    { display: block !important; }
          .mobile-overlay       { display: block !important; }
          .mobile-topbar        { display: flex !important; }
        }
      `}</style>
    </div>
  )
}

function NavGroup({ label }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
      color: 'rgba(255,255,255,.35)', padding: '14px 10px 4px',
    }}>{label}</div>
  )
}

function NavItem({ to, icon, label, onClick }) {
  return (
    <NavLink to={to} onClick={onClick} style={({ isActive }) => ({
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
