import React, { useCallback, useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SearchIcon, XIcon, ChevronLeftIcon } from 'lucide-react'
import { patients as allPatients, STATUS_CONFIG } from '../data/mockData'
import type { Patient, PatientStatus } from '../data/mockData'
interface PatientListProps {
  selectedPatientId: string | null
  onSelectPatient: (patient: Patient | null) => void
  isDrawer?: boolean
  isOpen?: boolean
  onClose?: () => void
  isMobile?: boolean
}
type FilterStatus = 'all' | PatientStatus
const filterChips: {
  id: FilterStatus
  label: string
}[] = [
  {
    id: 'all',
    label: 'All',
  },
  {
    id: 'active',
    label: 'Active',
  },
  {
    id: 'awaiting-stl',
    label: 'Awaiting STL',
  },
  {
    id: 'completed',
    label: 'Completed',
  },
  {
    id: 'on-hold',
    label: 'On Hold',
  },
]
export function PatientList({
  selectedPatientId,
  onSelectPatient,
  isDrawer = false,
  isOpen = true,
  onClose,
  isMobile = false,
}: PatientListProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [panelWidth, setPanelWidth] = useState(280)
  const isResizing = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const filteredPatients = allPatients.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || p.status === filter
    return matchesSearch && matchesFilter
  })
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const newWidth = e.clientX - 60 // subtract sidebar width
      setPanelWidth(Math.max(240, Math.min(400, newWidth)))
    }
    const handleMouseUp = () => {
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])
  const panelContent = (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-3 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          {isMobile && (
            <button
              onClick={onClose}
              className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close patient list"
            >
              <ChevronLeftIcon size={18} className="text-gray-500" />
            </button>
          )}
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Patients
          </h2>
          <span className="text-xs tabular-nums text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
            {filteredPatients.length}
          </span>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <SearchIcon
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search patients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all placeholder:text-gray-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 transition-colors"
              aria-label="Clear search"
            >
              <XIcon size={12} className="text-gray-400" />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              onClick={() => setFilter(chip.id)}
              className={`
                px-2 py-1 text-[11px] font-medium rounded-md whitespace-nowrap transition-all duration-150
                ${filter === chip.id ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
              `}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Patient list */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-scrolling-touch px-1.5 py-1">
        <AnimatePresence mode="popLayout">
          {filteredPatients.map((patient, index) => {
            const statusConfig = STATUS_CONFIG[patient.status]
            const isSelected = selectedPatientId === patient.id
            return (
              <motion.button
                key={patient.id}
                layout
                initial={{
                  opacity: 0,
                  y: 8,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  scale: 0.95,
                }}
                transition={{
                  duration: 0.2,
                  delay: index * 0.02,
                }}
                onClick={() => {
                  onSelectPatient(patient)
                  if (isMobile && onClose) onClose()
                }}
                className={`
                  w-full text-left px-2.5 py-2 rounded-lg mb-0.5 transition-colors duration-100 group
                  ${isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}
                `}
                aria-selected={isSelected}
                role="option"
              >
                <div className="flex items-center gap-2.5">
                  {/* Avatar placeholder */}
                  <div
                    className={`
                    w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0
                    ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}
                  `}
                  >
                    {patient.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-sm font-medium truncate ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}
                      >
                        {patient.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusConfig.dot}`}
                      />
                      <span className="text-[11px] text-gray-500 truncate">
                        {statusConfig.label}
                      </span>
                    </div>
                  </div>

                  {/* PAR score */}
                  <div className="flex-shrink-0 text-right">
                    <div
                      className={`
                      text-xs font-mono font-semibold tabular-nums
                      ${patient.parScore <= 10 ? 'text-emerald-600' : patient.parScore <= 20 ? 'text-amber-600' : patient.parScore <= 30 ? 'text-orange-600' : 'text-red-600'}
                    `}
                    >
                      {patient.parScore}
                    </div>
                    <div className="text-[10px] text-gray-400">PAR</div>
                  </div>
                </div>
              </motion.button>
            )
          })}
        </AnimatePresence>

        {filteredPatients.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-400">
            No patients found
          </div>
        )}
      </div>
    </div>
  )
  // Mobile: full screen overlay
  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{
              x: '-100%',
            }}
            animate={{
              x: 0,
            }}
            exit={{
              x: '-100%',
            }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 40,
            }}
            className="fixed inset-0 z-40 bg-white"
          >
            {panelContent}
          </motion.div>
        )}
      </AnimatePresence>
    )
  }
  // Tablet: slide-over drawer
  if (isDrawer) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
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
              className="fixed inset-0 bg-black/20 z-30"
              onClick={onClose}
            />
            <motion.div
              initial={{
                x: '-100%',
              }}
              animate={{
                x: 0,
              }}
              exit={{
                x: '-100%',
              }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 40,
              }}
              className="fixed left-[60px] top-0 bottom-0 w-[300px] bg-white border-r border-gray-200 z-40 shadow-xl"
            >
              {panelContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    )
  }
  // Desktop: resizable panel
  return (
    <div
      ref={panelRef}
      className="relative max-h-screen bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto"
      style={{
        width: panelWidth,
      }}
    >
      {panelContent}

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="resize-handle absolute right-0 top-0 bottom-0 w-1 hover:bg-blue-500/30 transition-colors duration-150 z-10"
      >
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-gray-300 opacity-0 hover:opacity-100 transition-opacity" />
      </div>
    </div>
  )
}
