'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderKanban, Users, Bot, FileText,
  ScrollText, Activity, Settings, ChevronLeft, ChevronRight,
  Wallet, Beaker, Menu, X, GitBranch, LogOut, User, ClipboardList, Rocket, Monitor
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/AuthProvider'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projekte', icon: FolderKanban },
  { href: '/agents', label: 'KI-Agenten', icon: Bot },
  { href: '/employees', label: 'Mitarbeiter', icon: Users },
  { href: '/finance', label: 'Finanzen', icon: Wallet },
  { href: '/lab', label: 'KI-Labor', icon: Beaker },
  { href: '/evolution', label: 'Evolution', icon: GitBranch },
  { href: '/berichte', label: 'Berichte', icon: ClipboardList },
  { href: '/apps', label: 'Apps', icon: Rocket },
  { href: '/logs', label: 'Logs', icon: ScrollText },
  { href: '/changelog', label: 'Changelog', icon: FileText },
  { href: '/live', label: 'Live-View', icon: Activity },
  { href: '/monitoring', label: 'Monitoring', icon: Monitor },
  { href: '/settings', label: 'Einstellungen', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuth()

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg glass"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed top-0 left-0 h-full z-40 transition-all duration-300 flex flex-col',
        'bg-[var(--bg-secondary)] border-r border-[var(--border)]',
        collapsed ? 'w-[68px]' : 'w-[240px]',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-sm">
              AI
            </div>
            {!collapsed && (
              <span className="font-semibold text-lg bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                AI Company
              </span>
            )}
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                  'hover:bg-[var(--bg-hover)] group',
                  isActive && 'bg-indigo-500/10 text-indigo-400 glow-accent'
                )}
              >
                <item.icon size={20} className={cn(
                  'shrink-0 transition-colors',
                  isActive ? 'text-indigo-400' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                )} />
                {!collapsed && (
                  <span className={cn(
                    'text-sm font-medium transition-colors',
                    isActive ? 'text-indigo-400' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                  )}>
                    {item.label}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User info + logout */}
        {user && (
          <div className="border-t border-[var(--border)] p-2">
            <div className={cn(
              'flex items-center gap-2 px-2 py-2 rounded-lg',
              collapsed ? 'justify-center' : ''
            )}>
              <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                <User size={14} className="text-indigo-400" />
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{user.name}</div>
                  <div className="text-[10px] text-[var(--text-secondary)] truncate">{user.role}</div>
                </div>
              )}
              {!collapsed && (
                <button
                  onClick={logout}
                  title="Abmelden"
                  className="p-1.5 rounded hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-400 transition"
                >
                  <LogOut size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center h-10 border-t border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </aside>
    </>
  )
}
