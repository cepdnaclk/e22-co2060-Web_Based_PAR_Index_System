import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PatientHeader } from './PatientHeader'
import { ProgressTracker } from './ProgressTracker'
import { STLTab } from './STLTab'
import { PointTab } from './PointTab'
import { PARAnalysis } from './PARAnalysis'
import type { Patient } from '../data/mockData'
interface PatientWorkspaceProps {
  patient: Patient
}
type TabId = 'stl' | 'points' | 'par'
const tabs: {
  id: TabId
  label: string
}[] = [
    {
      id: 'stl',
      label: 'STL Management',
    },
    {
      id: 'points',
      label: 'Points',
    },
    {
      id: 'par',
      label: 'PAR Analysis',
    },
  ]
export function PatientWorkspace({ patient }: PatientWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabId>('stl')
  return (
    <div className="h-full flex flex-col">
      <PatientHeader patient={patient} />
      <ProgressTracker currentStep={patient.currentStep} />

      {/* Tab bar */}
      <div className="px-6 bg-white border-b border-gray-200">
        <div className="flex items-center gap-0 -mb-px">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative px-4 py-2.5 text-sm font-medium transition-colors duration-150
                  ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}
                `}
                role="tab"
                aria-selected={isActive}
              >
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="workspace-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-600 rounded-t-full"
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 35,
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${patient.id}-${activeTab}`}
            initial={{
              opacity: 0,
              y: 6,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -6,
            }}
            transition={{
              duration: 0.2,
            }}
          >
            {activeTab === 'stl' && <STLTab patientId={patient.id} />}
            {activeTab === 'points' && <PointTab patientId={patient.id} />}
            {activeTab === 'par' && <PARAnalysis patientId={patient.id} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
