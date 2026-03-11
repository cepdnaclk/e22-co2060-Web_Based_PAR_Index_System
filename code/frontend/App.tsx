import React, { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MenuIcon, ArrowLeftIcon } from 'lucide-react'
import { Sidebar } from './components/Sidebar'
import { PatientList } from './components/PatientList'
import { Dashboard } from './components/Dashboard'
import { PatientWorkspace } from './components/PatientWorkspace'
import { RegisterPatient } from './components/RegisterPatient'
import type { Patient } from './data/mockData'
type Breakpoint = 'mobile' | 'tablet' | 'desktop'
function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop')
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth
      if (w < 768) setBreakpoint('mobile')
      else if (w < 1024) setBreakpoint('tablet')
      else setBreakpoint('desktop')
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return breakpoint
}
export function App() {
  const [activeNav, setActiveNav] = useState('cases')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'content'>('list')
  const breakpoint = useBreakpoint()
  const handleSelectPatient = useCallback(
    (patient: Patient | null) => {
      setSelectedPatient(patient)
      if (patient) {
        setActiveNav('cases')
        if (breakpoint === 'mobile') {
          setMobileView('content')
        }
      }
    },
    [breakpoint],
  )
  const handleNavChange = useCallback((nav: string) => {
    setActiveNav(nav)
    if (nav === 'dashboard') {
      setSelectedPatient(null)
    }
  }, [])
  const handleAddPatient = useCallback(() => {
    setActiveNav('register')
    setSelectedPatient(null)
  }, [])
  const handleBackFromRegister = useCallback(() => {
    setActiveNav('dashboard')
  }, [])
  const handleBackToList = useCallback(() => {
    if (breakpoint === 'mobile') {
      setMobileView('list')
    }
  }, [breakpoint])
  // Mobile layout
  if (breakpoint === 'mobile') {
    return (
      <div className="h-screen w-screen bg-gray-50 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
          {activeNav === 'register' ? (
            <button
              onClick={handleBackFromRegister}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600"
            >
              <ArrowLeftIcon size={16} />
              Back
            </button>
          ) : mobileView === 'content' && selectedPatient ? (
            <button
              onClick={handleBackToList}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600"
            >
              <ArrowLeftIcon size={16} />
              Back
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-[10px]">OC</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                OrthoCase
              </span>
            </div>
          )}

          {/* Mobile nav pills */}
          {activeNav !== 'register' && (
            <div className="flex items-center gap-1">
              {['dashboard', 'cases'].map((nav) => (
                <button
                  key={nav}
                  onClick={() => {
                    handleNavChange(nav)
                    if (nav === 'cases') setMobileView('list')
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${activeNav === nav ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                >
                  {nav === 'dashboard' ? 'Home' : 'Cases'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mobile content */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeNav === 'register' ? (
              <motion.div
                key="register"
                initial={{
                  opacity: 0,
                  x: 20,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                }}
                exit={{
                  opacity: 0,
                  x: -20,
                }}
                className="h-full overflow-y-auto"
              >
                <RegisterPatient onBack={handleBackFromRegister} />
              </motion.div>
            ) : activeNav === 'dashboard' ? (
              <motion.div
                key="dashboard"
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: 1,
                }}
                exit={{
                  opacity: 0,
                }}
                className="h-full overflow-y-auto"
              >
                <Dashboard onAddPatient={handleAddPatient} />
              </motion.div>
            ) : mobileView === 'list' ? (
              <motion.div
                key="list"
                initial={{
                  opacity: 0,
                  x: -20,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                }}
                exit={{
                  opacity: 0,
                  x: -20,
                }}
                className="h-full"
              >
                <PatientList
                  selectedPatientId={selectedPatient?.id || null}
                  onSelectPatient={handleSelectPatient}
                  isMobile={false}
                />
              </motion.div>
            ) : selectedPatient ? (
              <motion.div
                key="workspace"
                initial={{
                  opacity: 0,
                  x: 20,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                }}
                exit={{
                  opacity: 0,
                  x: 20,
                }}
                className="h-full"
              >
                <PatientWorkspace patient={selectedPatient} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    )
  }
  // Tablet layout
  if (breakpoint === 'tablet') {
    return (
      <div className="h-screen w-screen bg-gray-50 flex overflow-hidden">
        <Sidebar activeNav={activeNav} onNavChange={handleNavChange} />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tablet header with drawer toggle */}
          {activeNav === 'cases' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
              <button
                onClick={() => setDrawerOpen(!drawerOpen)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Toggle patient list"
              >
                <MenuIcon size={18} className="text-gray-600" />
              </button>
              <span className="text-xs font-medium text-gray-500">
                {selectedPatient ? selectedPatient.name : 'Select a patient'}
              </span>
            </div>
          )}

          {/* Main content */}
          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              {activeNav === 'register' ? (
                <motion.div
                  key="register"
                  initial={{
                    opacity: 0,
                  }}
                  animate={{
                    opacity: 1,
                  }}
                  exit={{
                    opacity: 0,
                  }}
                  className="h-full overflow-y-auto"
                >
                  <RegisterPatient onBack={handleBackFromRegister} />
                </motion.div>
              ) : activeNav === 'dashboard' || !selectedPatient ? (
                <motion.div
                  key="dashboard"
                  initial={{
                    opacity: 0,
                  }}
                  animate={{
                    opacity: 1,
                  }}
                  exit={{
                    opacity: 0,
                  }}
                  className="h-full overflow-y-auto"
                >
                  <Dashboard onAddPatient={handleAddPatient} />
                </motion.div>
              ) : activeNav === 'cases' && selectedPatient ? (
                <motion.div
                  key={`workspace-${selectedPatient.id}`}
                  initial={{
                    opacity: 0,
                  }}
                  animate={{
                    opacity: 1,
                  }}
                  exit={{
                    opacity: 0,
                  }}
                  className="h-full"
                >
                  <PatientWorkspace patient={selectedPatient} />
                </motion.div>
              ) : activeNav === 'reports' ? (
                <motion.div
                  key="reports"
                  initial={{
                    opacity: 0,
                  }}
                  animate={{
                    opacity: 1,
                  }}
                  exit={{
                    opacity: 0,
                  }}
                  className="h-full flex items-center justify-center"
                >
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-400">Reports</p>
                    <p className="text-xs text-gray-300 mt-1">Coming soon</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="settings"
                  initial={{
                    opacity: 0,
                  }}
                  animate={{
                    opacity: 1,
                  }}
                  exit={{
                    opacity: 0,
                  }}
                  className="h-full flex items-center justify-center"
                >
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-400">
                      Settings
                    </p>
                    <p className="text-xs text-gray-300 mt-1">Coming soon</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Drawer patient list */}
            <PatientList
              selectedPatientId={selectedPatient?.id || null}
              onSelectPatient={(p) => {
                handleSelectPatient(p)
                setDrawerOpen(false)
              }}
              isDrawer
              isOpen={drawerOpen}
              onClose={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      </div>
    )
  }
  // Desktop layout
  return (
    <div className="h-screen w-screen bg-gray-50 flex overflow-hidden">
      <Sidebar activeNav={activeNav} onNavChange={handleNavChange} />

      <div className="flex-1 flex overflow-hidden">
        {/* Patient list panel (always visible on desktop for cases) */}
        {activeNav === 'cases' && (
          <PatientList
            selectedPatientId={selectedPatient?.id || null}
            onSelectPatient={handleSelectPatient}
          />
        )}

        {/* Main content area */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {activeNav === 'register' ? (
              <motion.div
                key="register"
                initial={{
                  opacity: 0,
                  x: 12,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                }}
                exit={{
                  opacity: 0,
                  x: -12,
                }}
                transition={{
                  duration: 0.25,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                className="h-full overflow-y-auto"
              >
                <RegisterPatient onBack={handleBackFromRegister} />
              </motion.div>
            ) : activeNav === 'dashboard' ||
              (activeNav === 'cases' && !selectedPatient) ? (
              <motion.div
                key="dashboard"
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: 1,
                }}
                exit={{
                  opacity: 0,
                }}
                transition={{
                  duration: 0.2,
                }}
                className="absolute inset-0 overflow-y-auto"
              >
                <Dashboard onAddPatient={handleAddPatient} />
              </motion.div>
            ) : activeNav === 'cases' && selectedPatient ? (
              <motion.div
                key={`workspace-${selectedPatient.id}`}
                initial={{
                  opacity: 0,
                  x: 12,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                }}
                exit={{
                  opacity: 0,
                  x: -12,
                }}
                transition={{
                  duration: 0.25,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                className="h-full"
              >
                <PatientWorkspace patient={selectedPatient} />
              </motion.div>
            ) : activeNav === 'reports' ? (
              <motion.div
                key="reports"
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: 1,
                }}
                exit={{
                  opacity: 0,
                }}
                className="h-full flex items-center justify-center"
              >
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <span className="text-gray-400 text-lg">📊</span>
                  </div>
                  <p className="text-sm font-medium text-gray-500">Reports</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Generate and view clinical reports
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="settings"
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: 1,
                }}
                exit={{
                  opacity: 0,
                }}
                className="h-full flex items-center justify-center"
              >
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <span className="text-gray-400 text-lg">⚙️</span>
                  </div>
                  <p className="text-sm font-medium text-gray-500">Settings</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Configure your workspace preferences
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
