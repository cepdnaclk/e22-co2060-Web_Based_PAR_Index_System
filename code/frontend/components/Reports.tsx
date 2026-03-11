import React from 'react'
import { motion } from 'framer-motion'
import {
    FileTextIcon,
    DownloadIcon,
    FilterIcon,
    CalendarIcon,
    BarChart3Icon,
    ArrowRightIcon,
    PrinterIcon,
    TrendingUpIcon,
    PlusIcon
} from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
}

const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.4,
            ease: [0.25, 0.46, 0.45, 0.94]
        }
    }
}

// Mock chart data for reports
const reportData = [
    { name: 'Jan', completed: 12, new: 18 },
    { name: 'Feb', completed: 19, new: 15 },
    { name: 'Mar', completed: 15, new: 22 },
    { name: 'Apr', completed: 25, new: 20 },
    { name: 'May', completed: 32, new: 28 },
    { name: 'Jun', completed: 28, new: 35 },
    { name: 'Jul', completed: 38, new: 30 }
]

const recentReports = [
    { id: 1, name: 'Monthly Clinical Overview - June 2026', type: 'PDF', date: 'Jul 1, 2026', size: '2.4 MB' },
    { id: 2, name: 'Q2 Patient PAR Progress Report', type: 'CSV', date: 'Jun 30, 2026', size: '840 KB' },
    { id: 3, name: 'Weekly STL Upload Audit', type: 'PDF', date: 'Jun 28, 2026', size: '1.1 MB' },
    { id: 4, name: 'Treatment Duration Analysis YTD', type: 'Excel', date: 'Jun 15, 2026', size: '3.2 MB' },
]

export function Reports() {
    return (
        <div className="h-full w-full overflow-y-auto bg-gray-50/50 pb-12 relative z-10 pointer-events-auto">
            <div className="max-w-[1120px] mx-auto px-6 py-8">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Clinical Reports</h1>
                        <p className="text-sm text-gray-500 mt-1">Generate and view practice analytics and clinical data.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm">
                            <CalendarIcon size={16} className="text-gray-500" />
                            Last 30 Days
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20">
                            <PlusIcon size={16} />
                            Generate New
                        </button>
                    </div>
                </div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-6"
                >
                    {/* Top Stats & Chart */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <motion.div variants={itemVariants} className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">Case Volume Overview</h3>
                                    <p className="text-sm text-gray-500">Completed vs New cases over time</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                        <span className="text-xs font-medium text-gray-600">Completed</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                                        <span className="text-xs font-medium text-gray-600">New Cases</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 min-h-[240px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={reportData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#cbd5e1" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#cbd5e1" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                            itemStyle={{ color: '#1e293b', fontSize: '13px', fontWeight: 500 }}
                                        />
                                        <Area type="monotone" dataKey="new" stroke="#94a3b8" strokeWidth={2} fillOpacity={1} fill="url(#colorNew)" />
                                        <Area type="monotone" dataKey="completed" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorCompleted)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </motion.div>

                        {/* Quick Stats Grid */}
                        <motion.div variants={itemVariants} className="grid grid-rows-2 gap-4">
                            {/* Stat 1 */}
                            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center relative overflow-hidden">
                                <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none transform translate-x-1/4 translate-y-1/4">
                                    <TrendingUpIcon size={120} />
                                </div>
                                <h4 className="text-sm font-medium text-gray-500 mb-1">Avg Treatment Time</h4>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold text-gray-900">14.2</span>
                                    <span className="text-sm text-gray-500">months</span>
                                </div>
                                <p className="text-xs font-medium text-emerald-600 mt-2 bg-emerald-50 w-max px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                    <TrendingUpIcon size={10} /> 1.2 months faster
                                </p>
                            </div>
                            {/* Stat 2 */}
                            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center relative overflow-hidden">
                                <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none transform translate-x-1/4 translate-y-1/4">
                                    <BarChart3Icon size={120} />
                                </div>
                                <h4 className="text-sm font-medium text-gray-500 mb-1">Avg Initial PAR</h4>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold text-gray-900">32.4</span>
                                    <span className="text-sm text-gray-500">score</span>
                                </div>
                                <p className="text-xs font-medium text-emerald-600 mt-2 bg-emerald-50 w-max px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                    Consistent with YTD
                                </p>
                            </div>
                        </motion.div>
                    </div>

                    {/* Recent Reports List */}
                    <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900">Recent Generated Reports</h3>
                            <button className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1">
                                View All <ArrowRightIcon size={14} />
                            </button>
                        </div>

                        <div className="divide-y divide-gray-50">
                            {recentReports.map((report) => (
                                <div key={report.id} className="p-4 sm:px-6 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                                            <FileTextIcon size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{report.name}</h4>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                <span className="font-medium bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{report.type}</span>
                                                <span>{report.size}</span>
                                                <span>•</span>
                                                <span>{report.date}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors" title="Print Report">
                                            <PrinterIcon size={16} />
                                        </button>
                                        <button className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors" title="Download Report">
                                            <DownloadIcon size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                </motion.div>
            </div>
        </div>
    )
}
