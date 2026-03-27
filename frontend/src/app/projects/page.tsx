'use client'

import { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import StatusBar from '@/components/StatusBar'
import {
  FolderKanban, Plus, TrendingUp, Clock, CheckCircle2, Loader2, Play,
  Brain, Send, ChevronDown, ChevronUp, Zap, XCircle
} from 'lucide-react'
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

interface Task {
  id: number
  title: string
  status: string
  result: any
  employee_name: string
  created_at: string
  completed_at: string | null
}

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  planning: { color: 'text-blue-400 bg-blue-500/10', icon: Clock, label: 'Planung' },
  active: { color: 'text-green-400 bg-green-500/10', icon: Play, label: 'Aktiv' },
  completed: { color: 'text-emerald-400 bg-emerald-500/10', icon: CheckCircle2, label: 'Abgeschlossen' },
  paused: { color: 'text-yellow-400 bg-yellow-500/10', icon: Loader2, label: 'Pausiert' },
}

const taskStatusConfig: Record<string, { icon: any; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-yellow-400', label: 'Wartend' },
  running: { icon: Loader2, color: 'text-blue-400', label: 'Läuft...' },
  completed: { icon: CheckCircle2, color: 'text-green-400', label: 'Fertig' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Fehler' },
}

function ProjectTaskItem({ task }: { task: Task }) {
  const [expanded, setExpanded] = useState(false)
  const config = taskStatusConfig[task.status] || taskStatusConfig.pending
  const StatusIcon = config.icon

  return (
    <div className="p-3 rounded-lg bg-[var(--bg-primary)] transition-all">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <StatusIcon size={14} className={cn(config.color, task.status === 'running' && 'animate-spin')} />
        <span className="text-sm flex-1 truncate">{task.title}</span>
        {task.employee_name && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)] shrink-0">
            {task.employee_name}
          </span>
        )}
        {task.result && (
          expanded ? <ChevronUp size={12} className="text-[var(--text-secondary)]" /> : <ChevronDown size={12} className="text-[var(--text-secondary)]" />
        )}
      </div>
      {expanded && task.result?.summary && (
        <div className="mt-2 pt-2 border-t border-[var(--border)] text-xs text-[var(--text-secondary)] whitespace-pre-wrap max-h-60 overflow-y-auto"
          dangerouslySetInnerHTML={{
            __html: task.result.summary
              .replace(/\*\*(.*?)\*\*/g, '<strong class="text-[var(--text-primary)]">$1</strong>')
              .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-[var(--bg-secondary)] rounded p-2 my-1 overflow-x-auto"><code>$2</code></pre>')
              .replace(/`(.*?)`/g, '<code class="bg-[var(--bg-secondary)] px-1 rounded">$1</code>')
              .replace(/\n/g, '<br/>')
          }}
        />
      )}
    </div>
  )
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [showNew, setShowNew] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '', budget: '' })
  const [coordinating, setCoordinating] = useState<Set<number>>(new Set())
  const [expandedProject, setExpandedProject] = useState<number | null>(null)
  const [projectTasks, setProjectTasks] = useState<Record<number, Task[]>>({})

  const loadProjects = useCallback(async () => {
    const res = await fetch('/api/projects')
    const data = await res.json()
    setProjects(data.projects || [])
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Load tasks for expanded project
  useEffect(() => {
    if (!expandedProject) return
    const loadTasks = async () => {
      const res = await fetch(`/api/tasks?project_id=${expandedProject}`)
      const data = await res.json()
      setProjectTasks(prev => ({ ...prev, [expandedProject]: data.tasks || [] }))
    }
    loadTasks()
    const interval = setInterval(loadTasks, 3000)
    return () => clearInterval(interval)
  }, [expandedProject])

  // Poll projects while coordinating
  useEffect(() => {
    if (coordinating.size === 0) return
    const interval = setInterval(() => {
      loadProjects()
      // Also refresh tasks for coordinating projects
      coordinating.forEach(async (pid) => {
        const res = await fetch(`/api/tasks?project_id=${pid}`)
        const data = await res.json()
        setProjectTasks(prev => ({ ...prev, [pid]: data.tasks || [] }))

        // Stop coordinating when all tasks are done
        const tasks = data.tasks || []
        if (tasks.length > 0 && tasks.every((t: Task) => t.status === 'completed' || t.status === 'failed')) {
          setCoordinating(prev => {
            const next = new Set(prev)
            next.delete(pid)
            return next
          })
        }
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [coordinating, loadProjects])

  const createProject = async () => {
    if (!newProject.name) return
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newProject, budget: parseFloat(newProject.budget) || 0 }),
    })
    if (res.ok) {
      setShowNew(false)
      setNewProject({ name: '', description: '', budget: '' })
      loadProjects()
    }
  }

  const coordinateProject = async (projectId: number) => {
    setCoordinating(prev => new Set(prev).add(projectId))
    setExpandedProject(projectId)

    try {
      await fetch('/api/projects/coordinate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      })
    } catch (err) {
      console.error('Coordination failed:', err)
      setCoordinating(prev => {
        const next = new Set(prev)
        next.delete(projectId)
        return next
      })
    }
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
                <div className="space-y-3">
                  <input
                    placeholder="Projektname"
                    value={newProject.name}
                    onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] focus:border-indigo-500 outline-none"
                  />
                  <textarea
                    placeholder="Beschreibung — Was soll erreicht werden? Je detaillierter, desto bessere Aufgaben erstellt ARIA."
                    value={newProject.description}
                    onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] focus:border-indigo-500 outline-none resize-none"
                  />
                  <div className="flex gap-3">
                    <input
                      placeholder="Budget (€)"
                      type="number"
                      value={newProject.budget}
                      onChange={e => setNewProject({ ...newProject, budget: e.target.value })}
                      className="w-40 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] focus:border-indigo-500 outline-none"
                    />
                    <button onClick={createProject} className="px-5 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition-colors">
                      Erstellen
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Project cards */}
            <div className="space-y-5">
              {projects.map(p => {
                const st = statusConfig[p.status] || statusConfig.planning
                const progress = p.task_count > 0 ? (p.completed_tasks / p.task_count) * 100 : 0
                const config = typeof p.config === 'string' ? JSON.parse(p.config) : p.config
                const isCoordinating = coordinating.has(p.id)
                const isExpanded = expandedProject === p.id
                const tasks = projectTasks[p.id] || []
                const runningTasks = tasks.filter(t => t.status === 'running')
                const completedTasks = tasks.filter(t => t.status === 'completed')

                return (
                  <div key={p.id} className="gradient-border p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold">{p.name}</h3>
                          <div className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs', st.color)}>
                            <st.icon size={12} className={isCoordinating ? 'animate-spin' : ''} />
                            {isCoordinating ? 'ARIA koordiniert...' : st.label}
                          </div>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2">{p.description}</p>
                      </div>

                      <div className="flex gap-2 shrink-0 ml-4">
                        {/* Koordinator-Button */}
                        {!isCoordinating && (
                          <button
                            onClick={() => coordinateProject(p.id)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 transition-all text-sm"
                            title="ARIA übernimmt die Koordination"
                          >
                            <Brain size={16} />
                            An ARIA übergeben
                          </button>
                        )}
                        {isCoordinating && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 text-purple-400 text-sm">
                            <Loader2 size={16} className="animate-spin" />
                            ARIA arbeitet...
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress bars */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
                          <span>
                            {p.completed_tasks}/{p.task_count}
                            {runningTasks.length > 0 && (
                              <span className="text-blue-400 ml-2">({runningTasks.length} laufen)</span>
                            )}
                          </span>
                        </div>
                        <div className="h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Config info */}
                    {config?.target && (
                      <div className="p-3 rounded-lg bg-[var(--bg-primary)] mb-4">
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="text-xs text-[var(--text-secondary)]">Ziel</div>
                            <div className="text-lg font-bold text-green-400">{formatCurrency(config.target)}</div>
                          </div>
                          {config.strategies && (
                            <div className="flex flex-wrap gap-1">
                              {config.strategies.map((s: string) => (
                                <span key={s} className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-xs">{s.replace(/_/g, ' ')}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Task list */}
                    {tasks.length > 0 && (
                      <div>
                        <button
                          onClick={() => setExpandedProject(isExpanded ? null : p.id)}
                          className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-3"
                        >
                          <Zap size={14} className="text-indigo-400" />
                          {tasks.length} Aufgaben ({completedTasks.length} fertig)
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {isExpanded && (
                          <div className="space-y-2 max-h-[500px] overflow-y-auto">
                            {tasks.map(task => (
                              <ProjectTaskItem key={task.id} task={task} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
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
