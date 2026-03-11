import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileBarChartIcon,
  ChevronDownIcon,
  PrinterIcon,
  DownloadIcon,
  FileTextIcon,
} from 'lucide-react'
import { STATUS_CONFIG } from '../data/mockData'
import type { Patient } from '../data/mockData'
interface PatientHeaderProps {
  patient: Patient
}
export function PatientHeader({ patient }: PatientHeaderProps) {
  const [reportsOpen, setReportsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const statusConfig = STATUS_CONFIG[patient.status]
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setReportsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  const calculateAge = (dob: string) => {
    const today = new Date()
    const birth = new Date(dob)
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  }
  return (
    <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
            {patient.name
              .split(' ')
              .map((n) => n[0])
              .join('')}
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-semibold text-gray-900">
                {patient.name}
              </h1>
              <span
                className={`
                inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium
                ${statusConfig.bg} ${statusConfig.color}
              `}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`}
                />
                {statusConfig.label}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
              <span>
                Age {calculateAge(patient.dateOfBirth)} · DOB{' '}
                {formatDate(patient.dateOfBirth)}
              </span>
              <span className="w-px h-3 bg-gray-200" />
              <span>Started {formatDate(patient.startDate)}</span>
              <span className="w-px h-3 bg-gray-200" />
              <span>{patient.assignedDoctor}</span>
            </div>
          </div>
        </div>

        {/* Reports dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setReportsOpen(!reportsOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileBarChartIcon size={15} />
            Reports
            <ChevronDownIcon
              size={14}
              className={`transition-transform duration-150 ${reportsOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {reportsOpen && (
              <motion.div
                initial={{
                  opacity: 0,
                  y: -4,
                  scale: 0.97,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  y: -4,
                  scale: 0.97,
                }}
                transition={{
                  duration: 0.12,
                }}
                className="absolute right-0 top-[calc(100%+4px)] w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-30"
              >
                <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <FileTextIcon size={14} className="text-gray-400" />
                  Treatment Summary
                </button>
                <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <DownloadIcon size={14} className="text-gray-400" />
                  Export PAR Data
                </button>
                <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <PrinterIcon size={14} className="text-gray-400" />
                  Print Record
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
