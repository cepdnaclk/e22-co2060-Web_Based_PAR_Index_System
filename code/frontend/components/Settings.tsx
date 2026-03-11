import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
    UserIcon,
    BellIcon,
    ShieldIcon,
    PaletteIcon,
    MonitorIcon,
    MoonIcon,
    Volume2Icon,
    SaveIcon,
    CheckCircle2Icon
} from 'lucide-react'

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

export function Settings() {
    const [activeTab, setActiveTab] = useState('profile')
    const [isSaved, setIsSaved] = useState(false)

    const handleSave = () => {
        setIsSaved(true)
        setTimeout(() => setIsSaved(false), 2000)
    }

    const tabs = [
        { id: 'profile', icon: UserIcon, label: 'Profile' },
        { id: 'notifications', icon: BellIcon, label: 'Notifications' },
        { id: 'appearance', icon: PaletteIcon, label: 'Appearance' },
        { id: 'security', icon: ShieldIcon, label: 'Security' }
    ]

    return (
        <div className="h-full w-full overflow-y-auto bg-gray-50/50 pb-12 relative z-10 pointer-events-auto">
            <div className="max-w-4xl mx-auto px-6 py-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
                        <p className="text-sm text-gray-500 mt-1">Configure your workspace preferences and account settings.</p>
                    </div>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20 active:scale-95"
                    >
                        {isSaved ? <CheckCircle2Icon size={18} /> : <SaveIcon size={18} />}
                        {isSaved ? 'Saved!' : 'Save Changes'}
                    </button>
                </div>

                <div className="flex flex-col md:flex-row gap-8">
                    {/* Sidebar */}
                    <div className="w-full md:w-64 flex-shrink-0 space-y-1">
                        {tabs.map((tab) => {
                            const Icon = tab.icon
                            const isActive = activeTab === tab.id
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                    w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200
                    ${isActive
                                            ? 'bg-white text-blue-700 shadow-sm border border-gray-100'
                                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                        }
                  `}
                                >
                                    <Icon size={18} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                                    {tab.label}
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeTabIndicator"
                                            className="absolute left-0 w-1 h-6 bg-blue-600 rounded-r-full"
                                        />
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {/* Content */}
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="flex-1"
                        key={activeTab} // re-animate on tab change
                    >
                        {activeTab === 'profile' && (
                            <div className="space-y-6">
                                <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">First Name</label>
                                                <input type="text" defaultValue="Dr. Sarah" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-gray-900" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Name</label>
                                                <input type="text" defaultValue="Jenkins" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-gray-900" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                                            <input type="email" defaultValue="sarah.jenkins@orthocase.com" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-gray-900" />
                                        </div>
                                    </div>
                                </motion.div>

                                <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Clinic Setup</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Clinic Name</label>
                                            <input type="text" defaultValue="Jenkins Orthodontics" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-gray-900" />
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        )}

                        {activeTab === 'appearance' && (
                            <div className="space-y-6">
                                <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Theme</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        {/* Light Theme */}
                                        <button className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-blue-600 bg-blue-50/20 hover:bg-blue-50/50 transition-colors relative">
                                            <div className="absolute right-3 top-3 w-4 h-4 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center">
                                                <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                            </div>
                                            <MonitorIcon size={24} className="text-blue-600" />
                                            <span className="text-sm font-medium text-blue-900">System</span>
                                        </button>
                                        {/* Dark Theme placeholder */}
                                        <button className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-gray-100 hover:border-gray-200 transition-colors grayscale opacity-60 cursor-not-allowed hidden sm:flex">
                                            <MoonIcon size={24} className="text-gray-400" />
                                            <span className="text-sm font-medium text-gray-500">Dark (Coming soon)</span>
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )}

                        {activeTab === 'notifications' && (
                            <div className="space-y-6">
                                <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Alerts</h3>
                                    <div className="space-y-4">
                                        {[
                                            { title: 'New STL Analysis', desc: 'Get notified when a new layout is ready for review.', active: true },
                                            { title: 'Case Completed', desc: 'Alert when a patient case is marked as completed.', active: true },
                                            { title: 'Daily Summary', desc: 'Receive a daily digest of clinic activities.', active: false }
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                                                </div>
                                                <div className={`w-11 h-6 rounded-full flex items-center px-1 transition-colors cursor-pointer ${item.active ? 'bg-blue-600' : 'bg-gray-300'}`}>
                                                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${item.active ? 'translate-x-5' : 'translate-x-0'}`} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="space-y-6">
                                <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Password</h3>
                                    <div className="space-y-4">
                                        <button className="px-4 py-2 border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 rounded-xl text-sm font-medium transition-colors">
                                            Change Password
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    )
}
