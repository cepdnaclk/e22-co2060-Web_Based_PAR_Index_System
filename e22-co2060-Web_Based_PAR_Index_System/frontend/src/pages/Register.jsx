import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api/api'
import { useAuth } from '../context/AuthContext'

const ROLES = [
  { value: 'ADMIN',         label: 'Administrator',          desc: 'View patient details and assigned orthodontists' },
  { value: 'ORTHODONTIST',  label: 'Orthodontist',           desc: 'Full clinical access for orthodontic cases' },
  { value: 'UNDERGRADUATE', label: 'Dental Undergraduate',   desc: 'Submit 3D models for ML training dataset' },
]

export default function Register() {
  const { login }   = useAuth()
  const navigate    = useNavigate()
  const [form, setForm]     = useState({ name: '', email: '', password: '', role: 'ADMIN' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    try {
      const { data } = await authApi.register(form)
      login(data)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50)', padding: '24px 16px' }}>
      <div className="card" style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--blue-dark)' }}>Create Account</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>PAR Index System</div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="form-group">
            <label>Full name</label>
            <input name="name" value={form.name} onChange={handle} required />
          </div>
          <div className="form-group">
            <label>Email address</label>
            <input name="email" type="email" value={form.email} onChange={handle} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input name="password" type="password" value={form.password} onChange={handle} required />
            <span className="form-hint">Minimum 8 characters</span>
          </div>

          {/* Role cards */}
          <div className="form-group">
            <label>I am a…</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              {ROLES.map(r => (
                <label key={r.value} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
                  border: `1.5px solid ${form.role === r.value ? 'var(--blue-mid)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  background: form.role === r.value ? 'var(--blue-pale)' : '#fff',
                  transition: 'all .15s',
                }}>
                  <input type="radio" name="role" value={r.value}
                    checked={form.role === r.value} onChange={handle}
                    style={{ width: 'auto', marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--blue-dark)' }}>{r.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{r.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button className="btn btn-primary w-full" style={{ justifyContent: 'center', marginTop: 8 }} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Create account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--blue-mid)', fontWeight: 500 }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}