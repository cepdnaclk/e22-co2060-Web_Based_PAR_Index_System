import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../api/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // Rehydrate from localStorage on first load
  useEffect(() => {
    const stored = localStorage.getItem('par_user')
    const token  = localStorage.getItem('par_token')
    if (stored && token) {
      setUser(JSON.parse(stored))
    }
    setLoading(false)
  }, [])

  const login = (tokenData) => {
    localStorage.setItem('par_token', tokenData.token)
    localStorage.setItem('par_user', JSON.stringify(tokenData))
    setUser(tokenData)
  }

  const logout = () => {
    localStorage.removeItem('par_token')
    localStorage.removeItem('par_user')
    setUser(null)
  }

  const isRole = (...roles) => roles.includes(user?.role)

  const isClinical     = () => isRole('DENTIST', 'ORTHODONTIST', 'ADMIN')
  const isUndergrad    = () => isRole('UNDERGRADUATE', 'ADMIN')
  const isAdmin        = () => isRole('ADMIN')

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isClinical, isUndergrad, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)