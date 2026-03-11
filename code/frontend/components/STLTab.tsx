import React, { useCallback, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UploadCloudIcon,
  FileIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  LoaderIcon,
  ScanLineIcon,
  CrosshairIcon,
  CalculatorIcon,
  SparklesIcon,
} from 'lucide-react'
import { stlFiles } from '../data/mockData'
import { STLAnalysisTool } from './STLAnalysisTool'
import type { STLFile } from '../data/mockData'
interface STLTabProps {
  patientId: string
}
type AnalysisState = 'idle' | 'uploading' | 'analyzing' | 'complete'
type AnalysisStep = 'geometry' | 'landmarks' | 'scoring'
const statusStyles: Record<
  STLFile['status'],
  {
    icon: React.ElementType
    color: string
    bg: string
    label: string
  }
> = {
  pending: {
    icon: ClockIcon,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    label: 'Pending',
  },
  approved: {
    icon: CheckCircleIcon,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    label: 'Approved',
  },
  rejected: {
    icon: XCircleIcon,
    color: 'text-red-700',
    bg: 'bg-red-50',
    label: 'Rejected',
  },
}
const analysisSteps: {
  id: AnalysisStep
  label: string
  icon: React.ElementType
  duration: number
}[] = [
  {
    id: 'geometry',
    label: 'Scanning geometry...',
    icon: ScanLineIcon,
    duration: 1200,
  },
  {
    id: 'landmarks',
    label: 'Detecting landmarks...',
    icon: CrosshairIcon,
    duration: 1400,
  },
  {
    id: 'scoring',
    label: 'Calculating PAR scores...',
    icon: CalculatorIcon,
    duration: 1000,
  },
]
export function STLTab({ patientId }: STLTabProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [currentAnalysisStep, setCurrentAnalysisStep] = useState(0)
  const [analysisFilename, setAnalysisFilename] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const files = stlFiles[patientId] || []
  const startUploadAndAnalysis = useCallback((filename: string) => {
    setAnalysisFilename(filename)
    setAnalysisState('uploading')
    setUploadProgress(0)
    // Simulate upload progress
    let progress = 0
    const uploadInterval = setInterval(() => {
      progress += Math.random() * 15 + 5
      if (progress >= 100) {
        progress = 100
        clearInterval(uploadInterval)
        setUploadProgress(100)
        // Transition to analyzing
        setTimeout(() => {
          setAnalysisState('analyzing')
          setCurrentAnalysisStep(0)
          // Run through analysis steps
          let stepIdx = 0
          const runStep = () => {
            if (stepIdx >= analysisSteps.length) {
              setAnalysisState('complete')
              return
            }
            setCurrentAnalysisStep(stepIdx)
            setTimeout(() => {
              stepIdx++
              runStep()
            }, analysisSteps[stepIdx].duration)
          }
          runStep()
        }, 400)
      }
      setUploadProgress(progress)
    }, 120)
  }, [])
  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file && file.name.endsWith('.stl')) {
        startUploadAndAnalysis(file.name)
      }
    },
    [startUploadAndAnalysis],
  )
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        startUploadAndAnalysis(file.name)
      }
    },
    [startUploadAndAnalysis],
  )
  const handleViewFile = useCallback(
    (filename: string) => {
      startUploadAndAnalysis(filename)
    },
    [startUploadAndAnalysis],
  )
  const handleBackToList = useCallback(() => {
    setAnalysisState('idle')
    setUploadProgress(0)
    setCurrentAnalysisStep(0)
    setAnalysisFilename('')
  }, [])
  // Full-screen analysis tool
  if (analysisState === 'complete') {
    return (
      <STLAnalysisTool
        filename={analysisFilename}
        patientId={patientId}
        onBack={handleBackToList}
      />
    )
  }
  // Upload/Analyzing states
  if (analysisState === 'uploading' || analysisState === 'analyzing') {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <motion.div
          initial={{
            opacity: 0,
            scale: 0.95,
          }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-md w-full text-center"
        >
          {/* Animated icon */}
          <motion.div
            className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-5"
            animate={{
              rotate: analysisState === 'uploading' ? 0 : [0, 5, -5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {analysisState === 'uploading' ? (
              <UploadCloudIcon size={28} className="text-blue-600" />
            ) : (
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                }}
              >
                <SparklesIcon size={28} className="text-blue-600" />
              </motion.div>
            )}
          </motion.div>

          {analysisState === 'uploading' ? (
            <>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Uploading STL File
              </h3>
              <p className="text-sm text-gray-500 mb-5">{analysisFilename}</p>

              {/* Progress bar */}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                <motion.div
                  className="h-full bg-blue-600 rounded-full"
                  style={{
                    width: `${uploadProgress}%`,
                  }}
                  transition={{
                    duration: 0.1,
                  }}
                />
              </div>
              <p className="text-xs text-gray-400 tabular-nums">
                {Math.round(uploadProgress)}%
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Analyzing Model
              </h3>
              <p className="text-sm text-gray-500 mb-6">{analysisFilename}</p>

              {/* Analysis steps */}
              <div className="space-y-3 text-left">
                {analysisSteps.map((step, idx) => {
                  const StepIcon = step.icon
                  const isActive = idx === currentAnalysisStep
                  const isDone = idx < currentAnalysisStep
                  return (
                    <motion.div
                      key={step.id}
                      initial={{
                        opacity: 0,
                        x: -8,
                      }}
                      animate={{
                        opacity: 1,
                        x: 0,
                      }}
                      transition={{
                        delay: idx * 0.15,
                      }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-300 ${isActive ? 'bg-blue-50' : isDone ? 'bg-emerald-50/50' : 'bg-gray-50'}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-blue-100' : isDone ? 'bg-emerald-100' : 'bg-gray-100'}`}
                      >
                        {isDone ? (
                          <CheckCircleIcon
                            size={16}
                            className="text-emerald-600"
                          />
                        ) : isActive ? (
                          <motion.div
                            animate={{
                              rotate: 360,
                            }}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                              ease: 'linear',
                            }}
                          >
                            <LoaderIcon size={16} className="text-blue-600" />
                          </motion.div>
                        ) : (
                          <StepIcon size={16} className="text-gray-400" />
                        )}
                      </div>
                      <span
                        className={`text-sm font-medium ${isActive ? 'text-blue-700' : isDone ? 'text-emerald-700' : 'text-gray-400'}`}
                      >
                        {isDone ? step.label.replace('...', ' ✓') : step.label}
                      </span>
                    </motion.div>
                  )
                })}
              </div>
            </>
          )}
        </motion.div>
      </div>
    )
  }
  // Idle state — upload area + file list
  return (
    <div className="p-6 space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".stl"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Upload area */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 cursor-pointer
          ${isDragOver ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'}
        `}
      >
        <UploadCloudIcon
          size={28}
          className={`mx-auto mb-2 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`}
        />
        <p className="text-sm font-medium text-gray-700">
          Drop STL files here or <span className="text-blue-600">browse</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Upload to auto-analyze model and calculate PAR index
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-gray-400 px-4 py-2.5">
                  File
                </th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-gray-400 px-4 py-2.5">
                  Date
                </th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-gray-400 px-4 py-2.5">
                  Size
                </th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-gray-400 px-4 py-2.5">
                  Status
                </th>
                <th className="text-right text-[11px] font-medium uppercase tracking-wider text-gray-400 px-4 py-2.5">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {files.map((file, index) => {
                const status = statusStyles[file.status]
                const StatusIcon = status.icon
                return (
                  <motion.tr
                    key={file.id}
                    initial={{
                      opacity: 0,
                    }}
                    animate={{
                      opacity: 1,
                    }}
                    transition={{
                      delay: index * 0.05,
                    }}
                    className="border-b border-gray-50 last:border-0"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                          <FileIcon size={14} className="text-slate-500" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {file.filename}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-500 tabular-nums">
                      {new Date(file.uploadDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-500 tabular-nums">
                      {file.fileSize}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${status.bg} ${status.color}`}
                      >
                        <StatusIcon size={11} />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleViewFile(file.filename)}
                          className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-blue-50 transition-colors text-blue-600 text-xs font-medium"
                          title="Analyze"
                        >
                          <SparklesIcon size={12} />
                          Analyze
                        </button>
                        <button
                          className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
                          aria-label="View file"
                          title="View"
                        >
                          <EyeIcon size={14} />
                        </button>
                        {file.status === 'pending' && (
                          <>
                            <button
                              className="p-1.5 rounded-md hover:bg-emerald-50 transition-colors text-gray-500 hover:text-emerald-600"
                              aria-label="Approve file"
                              title="Approve"
                            >
                              <CheckCircleIcon size={14} />
                            </button>
                            <button
                              className="p-1.5 rounded-md hover:bg-red-50 transition-colors text-gray-500 hover:text-red-600"
                              aria-label="Reject file"
                              title="Reject"
                            >
                              <XCircleIcon size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {files.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-400">
          No STL files uploaded yet
        </div>
      )}
    </div>
  )
}
