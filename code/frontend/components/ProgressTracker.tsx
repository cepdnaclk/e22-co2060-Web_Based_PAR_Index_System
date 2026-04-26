import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PROGRESS_STEPS } from '../data/mockData'
interface ProgressTrackerProps {
  currentStep: number
}
export function ProgressTracker({ currentStep }: ProgressTrackerProps) {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null)
  return (
    <div className="px-6 py-3 bg-white border-b border-gray-100">
      <div className="flex items-center gap-0">
        {PROGRESS_STEPS.map((step, index) => {
          const isCompleted = index < currentStep
          const isCurrent = index === currentStep
          const isFuture = index > currentStep
          return (
            <div
              key={step}
              className="flex items-center flex-1 last:flex-initial"
            >
              {/* Step dot + label */}
              <div
                className="relative flex flex-col items-center"
                onMouseEnter={() => setHoveredStep(index)}
                onMouseLeave={() => setHoveredStep(null)}
              >
                <div
                  className={`
                    w-3 h-3 rounded-full transition-all duration-200 relative z-10
                    ${isCompleted ? 'bg-blue-600' : ''}
                    ${isCurrent ? 'bg-blue-600 pulse-dot' : ''}
                    ${isFuture ? 'bg-gray-200' : ''}
                  `}
                />

                {/* Tooltip label */}
                <AnimatePresence>
                  {hoveredStep === index && (
                    <motion.div
                      initial={{
                        opacity: 0,
                        y: 4,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      exit={{
                        opacity: 0,
                        y: 4,
                      }}
                      transition={{
                        duration: 0.12,
                      }}
                      className="absolute top-[calc(100%+6px)] px-2 py-1 bg-gray-900 text-white text-[10px] font-medium rounded whitespace-nowrap shadow-lg z-20"
                    >
                      {step}
                      <div className="absolute top-[-3px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-gray-900 rotate-45" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Step number label (compact) */}
                <span
                  className={`
                  text-[9px] mt-1 font-medium tabular-nums
                  ${isCompleted || isCurrent ? 'text-blue-600' : 'text-gray-300'}
                `}
                >
                  {index + 1}
                </span>
              </div>

              {/* Connector line */}
              {index < PROGRESS_STEPS.length - 1 && (
                <div className="flex-1 h-[2px] mx-1 relative">
                  <div className="absolute inset-0 bg-gray-200 rounded-full" />
                  {isCompleted && (
                    <motion.div
                      className="absolute inset-0 bg-blue-600 rounded-full"
                      initial={{
                        scaleX: 0,
                      }}
                      animate={{
                        scaleX: 1,
                      }}
                      transition={{
                        duration: 0.4,
                        delay: index * 0.08,
                      }}
                      style={{
                        transformOrigin: 'left',
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
