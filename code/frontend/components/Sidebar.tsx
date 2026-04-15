import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboardIcon,
  UsersIcon,
  FileBarChartIcon,
  SettingsIcon,
} from 'lucide-react'
interface SidebarProps {
  activeNav: string
  onNavChange: (nav: string) => void
}
const navItems = [
  {
    id: 'dashboard',
    icon: LayoutDashboardIcon,
    label: 'Dashboard',
  },
  {
    id: 'cases',
    icon: UsersIcon,
    label: 'Cases',
  },
  {
    id: 'reports',
    icon: FileBarChartIcon,
    label: 'Reports',
  },
  {
    id: 'settings',
    icon: SettingsIcon,
    label: 'Settings',
  },
]
export function Sidebar({ activeNav, onNavChange }: SidebarProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  return (
    <nav
      className="relative w-[60px] min-h-screen flex flex-col items-center py-4 z-50 flex-shrink-0"
      style={{
        backgroundColor: '#1E293B',
      }}
      aria-label="Main navigation"
    >
      {/* Logo mark */}
      <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center mb-8">
        <span className="text-white font-bold text-sm">OC</span>
      </div>

      {/* Nav items */}
      <div className="flex flex-col items-center gap-1 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeNav === item.id
          return (
            <div
              key={item.id}
              className="relative"
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <button
                onClick={() => onNavChange(item.id)}
                className={`
                  relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-150
                  ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}
                `}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="absolute left-[-14px] w-[3px] h-5 rounded-r-full bg-blue-500"
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 35,
                    }}
                  />
                )}
                <Icon
                  size={20}
                  className={`transition-colors duration-150 ${isActive ? 'text-white' : 'text-slate-400'}`}
                />
              </button>

              {/* Tooltip */}
              <AnimatePresence>
                {hoveredItem === item.id && (
                  <motion.div
                    initial={{
                      opacity: 0,
                      x: -4,
                    }}
                    animate={{
                      opacity: 1,
                      x: 0,
                    }}
                    exit={{
                      opacity: 0,
                      x: -4,
                    }}
                    transition={{
                      duration: 0.15,
                    }}
                    className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-md whitespace-nowrap shadow-lg pointer-events-none z-50"
                  >
                    {item.label}
                    <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      {/* Bottom indicator dot */}
      <div
        className="w-2 h-2 rounded-full bg-emerald-500 mb-2"
        title="System online"
      />
    </nav>
  )
}
