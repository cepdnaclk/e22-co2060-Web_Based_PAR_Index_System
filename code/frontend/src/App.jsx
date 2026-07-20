// frontend/src/App.jsx
// REQUIREMENT 12: Wrap individual clinical components in ErrorBoundary.
// Never wrap the entire App in one ErrorBoundary.

import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

import ErrorBoundary   from './components/ErrorBoundary'
import Layout          from './components/Layout'
import Login           from './pages/Login'
import Register        from './pages/Register'
import Dashboard       from './pages/Dashboard'
import PatientList     from './pages/PatientList'
import PatientDetail   from './pages/PatientDetail'
import CaseDetail      from './pages/CaseDetail'
import NewCase         from './pages/NewCase'
import TrainingSubmit  from './pages/TrainingSubmit'
import TrainingList    from './pages/TrainingList'
import TrainingReview  from './pages/TrainingReview'
import AdminPanel      from './pages/AdminPanel'

function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="centered"><div className="spinner spinner-lg" /></div>
  if (!user)   return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const { user } = useAuth()

  return (
    <Routes>
      {/* Public */}
      <Route path="/login"    element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />

      {/* Protected — all roles */}
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Patients */}
        <Route path="/patients" element={
          <RequireAuth roles={['ORTHODONTIST','ADMIN']}>
            <PatientList />
          </RequireAuth>
        }/>
        <Route path="/patients/:id" element={
          <RequireAuth roles={['ORTHODONTIST','ADMIN']}>
            <PatientDetail />
          </RequireAuth>
        }/>
        <Route path="/patients/:patientId/cases/new" element={
          <RequireAuth roles={['ORTHODONTIST']}>
            <NewCase />
          </RequireAuth>
        }/>

        {/* Case detail — REQUIREMENT 12: CaseDetail uses ErrorBoundary internally
            for STLViewer, LandmarkPanel, MLStatusPanel, AutoScoreResult */}
        <Route path="/cases/:id" element={
          <RequireAuth roles={['ORTHODONTIST']}>
            {/* REQUIREMENT 12: Wrap CaseDetail's heavy clinical section */}
            <ErrorBoundary>
              <CaseDetail />
            </ErrorBoundary>
          </RequireAuth>
        }/>

        {/* Training */}
        <Route path="/training/submit" element={
          <RequireAuth roles={['UNDERGRADUATE']}>
            <TrainingSubmit />
          </RequireAuth>
        }/>
        <Route path="/training" element={
          <RequireAuth roles={['UNDERGRADUATE']}>
            <TrainingList />
          </RequireAuth>
        }/>
        <Route path="/training/review" element={
          <RequireAuth roles={['ORTHODONTIST','ADMIN']}>
            <TrainingReview />
          </RequireAuth>
        }/>

        {/* Admin */}
        <Route path="/admin" element={
          <RequireAuth roles={['ADMIN']}>
            <AdminPanel />
          </RequireAuth>
        }/>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
