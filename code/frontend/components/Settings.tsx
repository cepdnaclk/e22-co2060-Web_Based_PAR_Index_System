import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserIcon,
  BellIcon,
  ShieldIcon,
  PaletteIcon,
  CameraIcon,
  SmartphoneIcon,
  MonitorIcon,
  MoonIcon,
} from 'lucide-react'

type TabId = 'profile' | 'notifications' | 'security' | 'appearance'

interface Tab {
  id: TabId
  label: string
  icon: React.ElementType
  description: string
}

const TABS: Tab[] = [
  {
    id: 'profile',
    label: 'Profile',
    icon: UserIcon,
    description: 'Manage your personal information and preferences',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: BellIcon,
    description: 'Control how and when you receive alerts',
  },
  {
    id: 'security',
    label: 'Security',
    icon: ShieldIcon,
    description: 'Update your password and secure your account',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: PaletteIcon,
    description: 'Customize the look and feel of your workspace',
  },
]

// Reusable Toggle Component
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: () => void
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-11 h-6 rounded-full relative cursor-pointer flex-shrink-0 transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        checked ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <motion.div
        layout
        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
        animate={{
          left: checked ? '22px' : '4px',
        }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 30,
        }}
      />
    </button>
  )
}

export function Settings() {
  const [activeTab, setActiveTab] = useState<TabId>('profile')
  const [isSaving, setIsSaving] = useState(false)

  // State: Profile
  const [firstName, setFirstName] = useState('John')
  const [lastName, setLastName] = useState('Doe')
  const [email, setEmail] = useState('dr.doe@orthoclinic.com')
  const [timezone, setTimezone] = useState('America/New_York')

  // State: Notifications
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [weeklyReports, setWeeklyReports] = useState(false)
  const [smsAlerts, setSmsAlerts] = useState(false)

  // State: Security
  const [twoFactor, setTwoFactor] = useState(true)

  // State: Appearance
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')
  const [compactMode, setCompactMode] = useState(false)

  const handleSave = () => {
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
    }, 800)
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50/50">
      <div className="max-w-5xl mx-auto p-6 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            Settings
          </h2>
          <p className="text-sm text-gray-500 mt-1.5">
            Manage your account details, security, and workspace preferences.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:w-64 flex-shrink-0">
            <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all relative whitespace-nowrap lg:whitespace-normal group ${
                      isActive
                        ? 'text-blue-700 bg-blue-50/80'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-blue-50/80 rounded-xl"
                        initial={false}
                        transition={{
                          type: 'spring',
                          stiffness: 400,
                          damping: 30,
                        }}
                      />
                    )}
                    <div className="relative z-10 flex items-center gap-3 w-full">
                      <Icon
                        size={18}
                        className={
                          isActive
                            ? 'text-blue-600'
                            : 'text-gray-400 group-hover:text-gray-500 transition-colors'
                        }
                      />
                      <span className="font-medium text-sm">{tab.label}</span>
                    </div>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative min-h-[400px]">
              {/* Header of Content Area */}
              <div className="px-6 py-5 border-b border-gray-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {TABS.find((t) => t.id === activeTab)?.label}
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {TABS.find((t) => t.id === activeTab)?.description}
                  </p>
                </div>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center justify-center min-w-[120px] px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors focus:ring-4 focus:ring-blue-100 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <motion.div
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                    />
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-8"
                  >
                    {activeTab === 'profile' && (
                      <div className="space-y-8">
                        {/* Avatar */}
                        <div className="flex items-center gap-6">
                          <div className="relative group cursor-pointer">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-100 to-violet-100 flex items-center justify-center text-blue-600 text-2xl font-bold shadow-inner">
                              {firstName[0]}
                              {lastName[0]}
                            </div>
                            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <CameraIcon size={20} className="text-white" />
                            </div>
                          </div>
                          <div>
                            <div className="flex gap-3">
                              <button className="px-3 py-1.5 bg-white border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                                Change
                              </button>
                              <button className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
                                Remove
                              </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              JPG, GIF or PNG. 1MB max.
                            </p>
                          </div>
                        </div>

                        {/* Form */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">
                              First Name
                            </label>
                            <input
                              type="text"
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">
                              Last Name
                            </label>
                            <input
                              type="text"
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm"
                            />
                          </div>
                          <div className="space-y-1.5 md:col-span-2">
                            <label className="text-sm font-medium text-gray-700">
                              Email Address
                            </label>
                            <input
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm"
                            />
                          </div>
                          
                        </div>
                      </div>
                    )}

                    {activeTab === 'notifications' && (
                      <div className="space-y-6">
                        <div className="flex items-start justify-between p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all bg-gray-50/30">
                          <div className="pr-6">
                            <h4 className="text-sm font-medium text-gray-900">
                              Email Alerts
                            </h4>
                            <p className="text-sm text-gray-500 mt-1">
                              Receive emails when PAR analyses are completed or
                              cases need your review.
                            </p>
                          </div>
                          <Toggle
                            checked={emailAlerts}
                            onChange={() => setEmailAlerts(!emailAlerts)}
                          />
                        </div>

                        <div className="flex items-start justify-between p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all bg-gray-50/30">
                          <div className="pr-6">
                            <h4 className="text-sm font-medium text-gray-900">
                              Weekly Reports
                            </h4>
                            <p className="text-sm text-gray-500 mt-1">
                              Receive a detailed summary of clinic activity
                              every Monday morning.
                            </p>
                          </div>
                          <Toggle
                            checked={weeklyReports}
                            onChange={() => setWeeklyReports(!weeklyReports)}
                          />
                        </div>

                        <div className="flex items-start justify-between p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all bg-gray-50/30">
                          <div className="pr-6">
                            <h4 className="text-sm font-medium text-gray-900">
                              SMS Notifications
                            </h4>
                            <p className="text-sm text-gray-500 mt-1">
                              Get text messages for critical alerts or scheduled
                              patient appointments.
                            </p>
                          </div>
                          <Toggle
                            checked={smsAlerts}
                            onChange={() => setSmsAlerts(!smsAlerts)}
                          />
                        </div>
                      </div>
                    )}

                    {activeTab === 'security' && (
                      <div className="space-y-8">
                        <div className="space-y-4">
                          <h4 className="text-sm font-medium text-gray-900">
                            Change Password
                          </h4>
                          <div className="space-y-4">
                            <input
                              type="password"
                              placeholder="Current password"
                              className="w-full max-w-md block px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm"
                            />
                            <input
                              type="password"
                              placeholder="New password"
                              className="w-full max-w-md block px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm"
                            />
                            <input
                              type="password"
                              placeholder="Confirm new password"
                              className="w-full max-w-md block px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm"
                            />
                          </div>
                        </div>

                        <div className="pt-6 border-t border-gray-100">
                          <div className="flex items-start justify-between">
                            <div className="pr-6">
                              <h4 className="text-sm font-medium text-gray-900">
                                Two-Factor Authentication
                              </h4>
                              <p className="text-sm text-gray-500 mt-1">
                                Add an extra layer of security to your account
                                by requiring a code upon login.
                              </p>
                            </div>
                            <Toggle
                              checked={twoFactor}
                              onChange={() => setTwoFactor(!twoFactor)}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'appearance' && (
                      <div className="space-y-8">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-4">
                            Theme
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                              {
                                id: 'light',
                                label: 'Light',
                                icon: MonitorIcon,
                              },
                              {
                                id: 'dark',
                                label: 'Dark',
                                icon: MoonIcon,
                              },
                              {
                                id: 'system',
                                label: 'System',
                                icon: SmartphoneIcon,
                              },
                            ].map((t) => {
                              const Icon = t.icon
                              const isActive = theme === t.id
                              return (
                                <button
                                  key={t.id}
                                  onClick={() => setTheme(t.id as 'light' | 'dark' | 'system')}
                                  className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                                    isActive
                                      ? 'border-blue-600 bg-blue-50/30'
                                      : 'border-gray-100 hover:border-gray-200 bg-white'
                                  }`}
                                >
                                  <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                      isActive
                                        ? 'bg-blue-100 text-blue-600'
                                        : 'bg-gray-100 text-gray-500'
                                    }`}
                                  >
                                    <Icon size={18} />
                                  </div>
                                  <span
                                    className={`text-sm font-medium ${
                                      isActive
                                        ? 'text-blue-700'
                                        : 'text-gray-600'
                                    }`}
                                  >
                                    {t.label}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <div className="pt-6 border-t border-gray-100">
                          <div className="flex items-start justify-between">
                            <div className="pr-6">
                              <h4 className="text-sm font-medium text-gray-900">
                                Compact Mode
                              </h4>
                              <p className="text-sm text-gray-500 mt-1">
                                Reduce spacing to fit more content on the screen.
                              </p>
                            </div>
                            <Toggle
                              checked={compactMode}
                              onChange={() => setCompactMode(!compactMode)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
