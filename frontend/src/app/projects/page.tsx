'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import StatusBar from '@/components/StatusBar'
import { FolderKanban, Plus, TrendingUp, Clock, CheckCircle2, Loader2, Play } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

interface Project {
  id: number
  name: string
  description: string
  status: string
  budget: number
  spent: number
  config: any
  task_count: number
  completed_tasks: number
  created_at: string
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [showNew, setShowNew] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '', budget: '' })

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => setProjects(d.projects || []))
  }, [])

  const createProject = async () => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newProject, budget: parseFloat(newProject.budget) || 0 }),
    })
    if (res.ok) {
      setShowNew(false)
      setNewProject({ name: '', description: '', budget: '' })
      fetch('/api/projects').then(r => r.json()).then(d => setProjects(d.projects || []))
    }
  }

  const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
    planning: { color: 'text-blue-400 bg-blue-500/10', icon: Clock, label: 'Planung' },
    active: { color: 'text-green-400 bg-green-500/10', icon: Play, label: 'Aktiv' },
    completed: { color: 'text-emerald-400 bg-emerald-500/10', icon: CheckCircle2, label: 'Abgeschlossen' },
    paused: { color: 'text-yellow-400 bg-yellow-500/10', icon: Loader2, label: 'Pausiert' },
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 lg:ml-[240px] overflow-y-auto">
          <div className="p-6 lg:p-8 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                  <FolderKanban className="text-indigo-400" />
                  <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    Projekte
                  </span>
                </h1>
                <p className="text-[var(--text-secondary)] mt-1">{projects.length} Projekte</p>
              </div>
              <button
                onClick={() => setShowNew(!showNew)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition-colors"
              >
                <Plus size={16} /> Neues Projekt
              </button>
            </div>

            {/* New project form */}
            {showNew && (
              <div className="glass rounded-xl p-5 mb-6">
                <h3 className="font-semibold mb-4">Neues Projekt erstellen</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input
                    placeholder="Projektname"
                    value={newProject.name}
                    onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                    className="px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] focus:border-indigo-500 outline-none"
                  />
                  <input
                    placeholder="Beschreibung"
                    value={newProject.description}
                    onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                    className="px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] focus:border-indigo-500 outline-none"
                  />
                  <div className="flex gap-2">
                    <input
                      placeholder="Budget (€)"
                      type="number"
                      value={newProject.budget}
                      onChange={e => setNewProject({ ...newProject, budget: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] focus:border-indigo-500 outline-none"
                    />
                    <button onClick={createProject} className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white">
                      Erstellen
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Project cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {projects.map(p => {
                const st = statusConfig[p.status] || statusConfig.planning
                const progress = p.task_count > 0 ? (p.completed_tasks / p.task_count) * 100 : 0
                const config = typeof p.config === 'string' ? JSON.parse(p.config) : p.config
                return (
                  <div key={p.id} className="gradient-border p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-bold">{p.name}</h3>
                        <div className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs mt-1', st.color)}>
                          <st.icon size={12} />
                          {st.label}
                        </div>
                      </div>
                      <TrendingUp size={20} className="text-indigo-400" />
                    </div>

                    <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-2">{p.description}</p>

                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-[var(--text-secondary)]">Budget</span>
                          <span>{formatCurrency(parseFloat(String(p.spent)) || 0)} / {formatCurrency(parseFloat(String(p.budget)) || 0)}</span>
                        </div>
                        <div className="h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full" style={{ width: `${p.budget > 0 ? Math.min((p.spent / p.budget) * 100, 100) : 0}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-[var(--text-secondary)]">Tasks</span>
                          <span>{p.completed_tasks}/{p.task_count}</span>
                        </div>
                        <div className="h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                      </div>

                      {config?.target && (
                        <div className="mt-3 p-3 rounded-lg bg-[var(--bg-primary)]">
                          <div className="text-xs text-[var(--text-secondary)] mb-1">Ziel</div>
                          <div className="text-lg font-bold text-green-400">{formatCurrency(config.target)}</div>
                          {config.strategies && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {config.strategies.map((s: string) => (
                                <span key={s} className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-xs">{s.replace(/_/g, ' ')}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
