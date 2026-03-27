'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import StatusBar from '@/components/StatusBar'
import {
  TrendingUp, Users, FolderKanban, Bot, Activity,
  ArrowUpRight, Zap, DollarSign, Clock
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

interface DashboardData {
  stats: { employees: number; projects: number; tasks: number; budget: number }
  activities: Array<{ id: number; type: string; message: string; created_at: string }>
  employees: Array<{ id: number; name: string; role: string; status: string }>
  projects: Array<{ id: number; name: string; status: string; budget: number; spent: number }>
}

function StatCard({ icon: Icon, label, value, trend, color }: any) {
  return (
    <div className="glass rounded-xl p-5 hover:bg-[var(--bg-hover)] transition-all duration-300 group">
      <div className="flex items-start justify-between">
        <div className={cn('p-2.5 rounded-lg', color)}>
          <Icon size={20} className="text-white" />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-xs text-green-400">
            <ArrowUpRight size={12} />
            {trend}
          </div>
        )}
      </div>
      <div className="mt-4">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-[var(--text-secondary)] mt-1">{label}</div>
      </div>
    </div>
  )
}

function ActivityFeed({ activities }: { activities: DashboardData['activities'] }) {
  return (
    <div className="glass rounded-xl p-5">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Activity size={18} className="text-indigo-400" />
        Live-Aktivität
      </h3>
      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {activities.map((a) => (
          <div key={a.id} className="flex gap-3 p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
            <div className={cn(
              'w-2 h-2 rounded-full mt-2 shrink-0',
              a.type === 'system' ? 'bg-indigo-400' :
              a.type === 'project' ? 'bg-green-400' :
              a.type === 'task' ? 'bg-yellow-400' : 'bg-gray-400'
            )} />
            <div className="min-w-0">
              <p className="text-sm">{a.message}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {new Date(a.created_at).toLocaleString('de-DE')}
              </p>
            </div>
          </div>
        ))}
        {activities.length === 0 && (
          <p className="text-sm text-[var(--text-secondary)] text-center py-8">Keine Aktivitäten</p>
        )}
      </div>
    </div>
  )
}

function EmployeeList({ employees }: { employees: DashboardData['employees'] }) {
  const colors: Record<string, string> = {
    'Chief AI Officer': 'from-purple-500 to-pink-500',
    'Senior Developer': 'from-blue-500 to-cyan-500',
    'Research Analyst': 'from-green-500 to-emerald-500',
    'ML Engineer': 'from-orange-500 to-red-500',
    'Finance Manager': 'from-yellow-500 to-amber-500',
  }
  return (
    <div className="glass rounded-xl p-5">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Users size={18} className="text-indigo-400" />
        Team
      </h3>
      <div className="space-y-3">
        {employees.map((e) => (
          <div key={e.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br',
              colors[e.role] || 'from-gray-500 to-gray-600'
            )}>
              {e.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{e.name}</p>
              <p className="text-xs text-[var(--text-secondary)]">{e.role}</p>
            </div>
            <div className="ml-auto">
              <span className={cn(
                'px-2 py-0.5 rounded-full text-xs',
                e.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'
              )}>
                {e.status === 'active' ? 'Aktiv' : 'Inaktiv'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 lg:ml-[240px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-[var(--text-secondary)]">Lade Dashboard...</span>
          </div>
        </main>
      </div>
    )
  }

  const stats = data?.stats || { employees: 0, projects: 0, tasks: 0, budget: 0 }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 lg:ml-[240px] overflow-y-auto">
          <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Dashboard
              </h1>
              <p className="text-[var(--text-secondary)] mt-1">
                Willkommen bei AI Company — Deine virtuelle KI-Firma
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard icon={Users} label="Mitarbeiter" value={stats.employees} color="bg-gradient-to-br from-purple-500 to-pink-500" />
              <StatCard icon={FolderKanban} label="Projekte" value={stats.projects} color="bg-gradient-to-br from-blue-500 to-cyan-500" />
              <StatCard icon={Zap} label="Aktive Tasks" value={stats.tasks} color="bg-gradient-to-br from-orange-500 to-red-500" />
              <StatCard icon={DollarSign} label="Budget" value={formatCurrency(stats.budget)} color="bg-gradient-to-br from-green-500 to-emerald-500" />
            </div>

            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ActivityFeed activities={data?.activities || []} />
              </div>
              <div>
                <EmployeeList employees={data?.employees || []} />
              </div>
            </div>

            {/* Projects */}
            {data?.projects && data.projects.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FolderKanban size={18} className="text-indigo-400" />
                  Aktive Projekte
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.projects.map((p) => (
                    <div key={p.id} className="gradient-border p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-lg">{p.name}</h4>
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-xs mt-1 inline-block',
                            p.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'
                          )}>
                            {p.status}
                          </span>
                        </div>
                        <TrendingUp size={20} className="text-indigo-400" />
                      </div>
                      <div className="mt-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-[var(--text-secondary)]">Budget</span>
                          <span>{formatCurrency(p.spent)} / {formatCurrency(p.budget)}</span>
                        </div>
                        <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min((p.spent / p.budget) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
