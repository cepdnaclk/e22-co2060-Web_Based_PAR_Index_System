import React, { Component } from 'react'
import { motion } from 'framer-motion'
import { parData } from '../data/mockData'
interface PARAnalysisProps {
  patientId: string
}
function getSeverityColor(score: number): string {
  if (score <= 10) return '#10b981'
  if (score <= 20) return '#f59e0b'
  if (score <= 30) return '#f97316'
  return '#ef4444'
}
function getSeverityLabel(score: number): string {
  if (score <= 10) return 'Mild'
  if (score <= 20) return 'Moderate'
  if (score <= 30) return 'Severe'
  return 'Very Severe'
}
function getSeverityBg(score: number): string {
  if (score <= 10) return 'bg-emerald-50 text-emerald-700'
  if (score <= 20) return 'bg-amber-50 text-amber-700'
  if (score <= 30) return 'bg-orange-50 text-orange-700'
  return 'bg-red-50 text-red-700'
}
export function PARAnalysis({ patientId }: PARAnalysisProps) {
  const data = parData[patientId]
  if (!data) {
    return (
      <div className="p-6 text-center py-16 text-sm text-gray-400">
        No PAR analysis data available for this patient.
      </div>
    )
  }
  const totalColor = getSeverityColor(data.totalScore)
  const totalLabel = getSeverityLabel(data.totalScore)
  return (
    <div className="p-6">
      {/* Total PAR Score banner */}
      <motion.div
        initial={{
          opacity: 0,
          y: 8,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.3,
        }}
        className="bg-white rounded-xl border border-gray-200 p-5 mb-4 flex items-center justify-between"
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1">
            Total PAR Score
          </p>
          <div className="flex items-baseline gap-3">
            <span
              className="text-4xl font-bold tabular-nums"
              style={{
                color: totalColor,
              }}
            >
              {data.totalScore}
            </span>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getSeverityBg(data.totalScore)}`}
            >
              {totalLabel}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Assessed on{' '}
            {new Date(data.date).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Mini severity scale */}
        <div className="hidden sm:flex items-center gap-1.5">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-gray-500">0-10</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-[10px] text-gray-500">11-20</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <span className="text-[10px] text-gray-500">21-30</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-[10px] text-gray-500">31+</span>
          </div>
        </div>
      </motion.div>

      {/* Split view */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Results table */}
        <motion.div
          initial={{
            opacity: 0,
            x: -8,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
          transition={{
            duration: 0.3,
            delay: 0.1,
          }}
          className="bg-white rounded-xl border border-gray-200 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Component Scores
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left text-[11px] font-medium text-gray-400 px-4 py-2">
                  Component
                </th>
                <th className="text-center text-[11px] font-medium text-gray-400 px-4 py-2">
                  Score
                </th>
                <th className="text-center text-[11px] font-medium text-gray-400 px-4 py-2">
                  Max
                </th>
                <th className="text-left text-[11px] font-medium text-gray-400 px-4 py-2 w-24">
                  Bar
                </th>
              </tr>
            </thead>
            <tbody>
              {data.components.map((comp, index) => {
                const percent = (comp.score / comp.maxScore) * 100
                const barColor = getSeverityColor(
                  comp.score * (40 / comp.maxScore),
                )
                return (
                  <motion.tr
                    key={comp.name}
                    initial={{
                      opacity: 0,
                    }}
                    animate={{
                      opacity: 1,
                    }}
                    transition={{
                      delay: 0.15 + index * 0.04,
                    }}
                    className="border-b border-gray-50 last:border-0"
                  >
                    <td className="px-4 py-2.5 text-sm text-gray-900 font-medium">
                      {comp.name}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="text-sm font-semibold tabular-nums text-gray-900">
                        {comp.score}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-sm text-gray-400 tabular-nums">
                      {comp.maxScore}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{
                            backgroundColor: barColor,
                          }}
                          initial={{
                            width: 0,
                          }}
                          animate={{
                            width: `${percent}%`,
                          }}
                          transition={{
                            duration: 0.5,
                            delay: 0.2 + index * 0.05,
                            ease: 'easeOut',
                          }}
                        />
                      </div>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </motion.div>

        {/* Right: Severity visualization */}
        <motion.div
          initial={{
            opacity: 0,
            x: 8,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
          transition={{
            duration: 0.3,
            delay: 0.15,
          }}
          className="bg-white rounded-xl border border-gray-200 p-5"
        >
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-4">
            Score Distribution
          </h3>

          {/* Horizontal bar chart */}
          <div className="space-y-3">
            {data.components.map((comp, index) => {
              const percent = (comp.score / comp.maxScore) * 100
              const color = getSeverityColor(comp.score * (40 / comp.maxScore))
              return (
                <div key={comp.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600 truncate pr-2">
                      {comp.name}
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-gray-900">
                      {comp.score}/{comp.maxScore}
                    </span>
                  </div>
                  <div className="w-full h-5 bg-gray-50 rounded-md overflow-hidden relative">
                    <motion.div
                      className="h-full rounded-md flex items-center justify-end pr-1.5"
                      style={{
                        backgroundColor: color + '20',
                      }}
                      initial={{
                        width: 0,
                      }}
                      animate={{
                        width: `${Math.max(percent, 8)}%`,
                      }}
                      transition={{
                        duration: 0.6,
                        delay: 0.3 + index * 0.06,
                        ease: [0.25, 0.46, 0.45, 0.94],
                      }}
                    >
                      <motion.div
                        className="h-3 rounded-sm"
                        style={{
                          backgroundColor: color,
                          width: '100%',
                        }}
                        initial={{
                          scaleX: 0,
                        }}
                        animate={{
                          scaleX: 1,
                        }}
                        transition={{
                          duration: 0.4,
                          delay: 0.5 + index * 0.06,
                        }}
                      />
                    </motion.div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Severity breakdown */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <h4 className="text-xs font-medium text-gray-400 mb-3">
              Severity Classification
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <div>
                  <p className="text-xs font-semibold text-emerald-700">Mild</p>
                  <p className="text-[10px] text-emerald-600">PAR 0–10</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <div>
                  <p className="text-xs font-semibold text-amber-700">
                    Moderate
                  </p>
                  <p className="text-[10px] text-amber-600">PAR 11–20</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <div>
                  <p className="text-xs font-semibold text-orange-700">
                    Severe
                  </p>
                  <p className="text-[10px] text-orange-600">PAR 21–30</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <div>
                  <p className="text-xs font-semibold text-red-700">
                    Very Severe
                  </p>
                  <p className="text-[10px] text-red-600">PAR 31+</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
