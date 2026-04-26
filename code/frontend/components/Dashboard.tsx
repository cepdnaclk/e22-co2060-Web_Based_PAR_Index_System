import React, { useMemo, Children, Component } from 'react'
import { motion } from 'framer-motion'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import {
  TrendingUpIcon,
  UsersIcon,
  ClockIcon,
  ActivityIcon,
  UploadCloudIcon,
  TrendingDownIcon,
  CheckCircleIcon,
  CalendarIcon,
  FileTextIcon,
  CheckIcon,
  PlusIcon,
  ArrowUpRightIcon,
} from 'lucide-react'
import {
  dashboardMetrics,
  activityFeed,
  patients,
  STATUS_CONFIG,
} from '../data/mockData'
import type { PatientStatus } from '../data/mockData'
interface DashboardProps {
  onAddPatient?: () => void
}
const iconMap: Record<string, React.ElementType> = {
  upload: UploadCloudIcon,
  'trending-down': TrendingDownIcon,
  'check-circle': CheckCircleIcon,
  calendar: CalendarIcon,
  'file-text': FileTextIcon,
  check: CheckIcon,
}
const activityTypeColors: Record<
  string,
  {
    dot: string
    bg: string
  }
> = {
  'stl-upload': {
    dot: 'bg-blue-500',
    bg: 'bg-blue-50',
  },
  'par-update': {
    dot: 'bg-amber-500',
    bg: 'bg-amber-50',
  },
  'status-change': {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50',
  },
  appointment: {
    dot: 'bg-violet-500',
    bg: 'bg-violet-50',
  },
  note: {
    dot: 'bg-gray-400',
    bg: 'bg-gray-100',
  },
}
const sparklineData = [
  {
    v: 28,
  },
  {
    v: 35,
  },
  {
    v: 32,
  },
  {
    v: 40,
  },
  {
    v: 38,
  },
  {
    v: 42,
  },
  {
    v: 47,
  },
]
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
    },
  },
}
const cardVariants = {
  hidden: {
    opacity: 0,
    y: 16,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
}
const feedItemVariants = {
  hidden: {
    opacity: 0,
    x: -12,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
}
export function Dashboard({ onAddPatient }: DashboardProps) {
  const {
    totalCases,
    awaitingSTL,
    avgPAR,
    completedThisMonth,
    parPending,
    activeTrend,
  } = dashboardMetrics
  // PAR gauge
  const gaugePercent = Math.min(avgPAR / 40, 1)
  const gaugeColor =
    avgPAR <= 10
      ? '#10b981'
      : avgPAR <= 20
        ? '#f59e0b'
        : avgPAR <= 30
          ? '#f97316'
          : '#ef4444'
  const severityLabel =
    avgPAR <= 10
      ? 'Mild'
      : avgPAR <= 20
        ? 'Moderate'
        : avgPAR <= 30
          ? 'Severe'
          : 'Very Severe'
  const circumference = 2 * Math.PI * 44
  const strokeDashoffset = circumference - gaugePercent * circumference * 0.75
  // Cases by status
  const statusCounts = useMemo(() => {
    const counts: Record<PatientStatus, number> = {
      active: 0,
      'awaiting-stl': 0,
      completed: 0,
      'on-hold': 0,
    }
    patients.forEach((p) => {
      counts[p.status]++
    })
    return counts
  }, [])
  const totalPatients = patients.length
  const statusEntries: {
    key: PatientStatus
    count: number
    pct: number
  }[] = (Object.keys(statusCounts) as PatientStatus[]).map((key) => ({
    key,
    count: statusCounts[key],
    pct: totalPatients > 0 ? (statusCounts[key] / totalPatients) * 100 : 0,
  }))
  const barColors: Record<PatientStatus, string> = {
    active: 'bg-emerald-500',
    'awaiting-stl': 'bg-amber-500',
    completed: 'bg-blue-500',
    'on-hold': 'bg-gray-400',
  }
  return (
    <div className="overflow-y-auto pb-8 h-full">
      <div className="p-6 max-w-[1120px] mx-auto min-h-min">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Clinical practice overview
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onAddPatient}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors duration-150"
            >
              <PlusIcon size={15} />
              Add Patient
            </button>
          </div>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          {/* Row 1: Hero + PAR Gauge */}
          <div className="grid grid-cols-4 gap-4">
            {/* Hero — Total Active Cases */}
            <motion.div
              variants={cardVariants}
              className="col-span-3 bg-gradient-to-br from-slate-50 via-white to-blue-50/60 rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden relative"
            >
              {/* Subtle decorative ring */}
              <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full border border-blue-100/50 opacity-60" />
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full border border-blue-100/40 opacity-40" />

              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center">
                      <UsersIcon size={16} className="text-blue-600" />
                    </div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                      Total Active Cases
                    </p>
                  </div>
                  <div className="flex items-baseline gap-3 mt-3">
                    <span className="text-5xl font-bold tabular-nums text-gray-900 tracking-tight">
                      {totalCases}
                    </span>
                    <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <TrendingUpIcon size={12} />+{activeTrend}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    <span className="font-medium text-gray-700">
                      {completedThisMonth}
                    </span>{' '}
                    completed this month
                  </p>
                </div>

                {/* Sparkline */}
                <div className="w-44 h-20 mt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparklineData}>
                      <defs>
                        <linearGradient
                          id="sparkGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#3b82f6"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="100%"
                            stopColor="#3b82f6"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#sparkGrad)"
                        dot={false}
                        animationDuration={1200}
                        animationEasing="ease-out"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>

            {/* PAR Gauge */}
            <motion.div
              variants={cardVariants}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center justify-center"
            >
              <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">
                Avg PAR Score
              </p>
              <div className="relative w-28 h-28">
                <svg
                  viewBox="0 0 100 100"
                  className="w-full h-full -rotate-[135deg]"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth="7"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * 0.25}
                    strokeLinecap="round"
                  />
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke={gaugeColor}
                    strokeWidth="7"
                    strokeDasharray={circumference}
                    strokeLinecap="round"
                    initial={{
                      strokeDashoffset: circumference,
                    }}
                    animate={{
                      strokeDashoffset,
                    }}
                    transition={{
                      duration: 1.2,
                      ease: 'easeOut',
                      delay: 0.3,
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold tabular-nums text-gray-900 tracking-tight">
                    {avgPAR}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: gaugeColor,
                  }}
                />
                <span className="text-xs font-medium text-gray-600">
                  {severityLabel}
                </span>
              </div>
            </motion.div>
          </div>

          {/* Row 2: Secondary Metrics + Cases by Status */}
          <div className="grid grid-cols-4 gap-4">
            {/* Awaiting STL */}
            <motion.div
              variants={cardVariants}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <div className="h-0.5 bg-amber-400 rounded-full mx-4 mt-3" />
              <div className="p-5 pt-4">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
                  <ClockIcon size={18} className="text-amber-600" />
                </div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-1">
                  Awaiting STL
                </p>
                <span className="text-3xl font-bold tabular-nums text-gray-900 tracking-tight">
                  {awaitingSTL}
                </span>
                <p className="text-xs text-gray-500 mt-1.5">
                  Files pending review
                </p>
              </div>
            </motion.div>

            {/* PAR Pending */}
            <motion.div
              variants={cardVariants}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <div className="h-0.5 bg-orange-400 rounded-full mx-4 mt-3" />
              <div className="p-5 pt-4">
                <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center mb-3">
                  <ActivityIcon size={18} className="text-orange-600" />
                </div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-1">
                  PAR Pending
                </p>
                <span className="text-3xl font-bold tabular-nums text-gray-900 tracking-tight">
                  {parPending}
                </span>
                <p className="text-xs text-gray-500 mt-1.5">
                  Scores need updating
                </p>
              </div>
            </motion.div>

            {/* Completed This Month */}
            <motion.div
              variants={cardVariants}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <div className="h-0.5 bg-emerald-400 rounded-full mx-4 mt-3" />
              <div className="p-5 pt-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                  <CheckCircleIcon size={18} className="text-emerald-600" />
                </div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-1">
                  Completed
                </p>
                <span className="text-3xl font-bold tabular-nums text-gray-900 tracking-tight">
                  {completedThisMonth}
                </span>
                <p className="text-xs text-gray-500 mt-1.5">
                  Finished this month
                </p>
              </div>
            </motion.div>

            {/* Cases by Status */}
            <motion.div
              variants={cardVariants}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
            >
              <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-3">
                Cases by Status
              </p>

              {/* Stacked bar */}
              <div className="flex h-2.5 rounded-full overflow-hidden mb-4">
                {statusEntries.map((entry) => (
                  <motion.div
                    key={entry.key}
                    className={`${barColors[entry.key]} first:rounded-l-full last:rounded-r-full`}
                    initial={{
                      width: 0,
                    }}
                    animate={{
                      width: `${entry.pct}%`,
                    }}
                    transition={{
                      duration: 0.8,
                      ease: 'easeOut',
                      delay: 0.5,
                    }}
                  />
                ))}
              </div>

              {/* Legend */}
              <div className="space-y-2">
                {statusEntries.map((entry) => {
                  const config = STATUS_CONFIG[entry.key]
                  return (
                    <div
                      key={entry.key}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                        <span className="text-xs text-gray-600">
                          {config.label}
                        </span>
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-gray-900">
                        {entry.count}
                      </span>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          </div>

          {/* Row 3: Activity Feed */}
          <motion.div
            variants={cardVariants}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                Recent Activity
              </p>
              <button className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
                View all
                <ArrowUpRightIcon size={12} />
              </button>
            </div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="relative"
            >
              {/* Timeline line */}
              <div className="absolute left-[11px] top-3 bottom-3 w-px bg-gray-100" />

              <div className="space-y-0">
                {activityFeed.map((item) => {
                  const IconComponent = iconMap[item.icon] || ActivityIcon
                  const typeColor =
                    activityTypeColors[item.type] || activityTypeColors.note
                  return (
                    <motion.div
                      key={item.id}
                      variants={feedItemVariants}
                      className="flex items-start gap-3.5 py-2.5 group relative"
                    >
                      {/* Timeline dot */}
                      <div className="relative z-10 flex-shrink-0 mt-1">
                        <div
                          className={`w-[9px] h-[9px] rounded-full ${typeColor.dot} ring-[3px] ring-white`}
                        />
                      </div>

                      {/* Icon */}
                      <div
                        className={`w-7 h-7 rounded-lg ${typeColor.bg} flex items-center justify-center flex-shrink-0`}
                      >
                        <IconComponent size={13} className="text-gray-600" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 leading-snug">
                          <span className="font-medium text-gray-900">
                            {item.patientName}
                          </span>
                          {' — '}
                          {item.message}
                        </p>
                      </div>

                      {/* Timestamp */}
                      <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0 tabular-nums mt-0.5">
                        {item.timestamp}
                      </span>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
