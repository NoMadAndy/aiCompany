'use client'

import { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import StatusBar from '@/components/StatusBar'
import { Bot, Zap, Brain, Code, Search, Shield, Send, Loader2, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Employee {
  id: number
  name: string
  role: string
  department: string
  skills: string[]
  status: string
  system_prompt: string
  model: string
  total_tasks: number
  completed_tasks: number
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

const deptColors: Record<string, string> = {
  Management: 'from-purple-500 to-pink-500',
  Engineering: 'from-blue-500 to-cyan-500',
  Research: 'from-green-500 to-emerald-500',
  'AI Lab': 'from-orange-500 to-red-500',
  Finance: 'from-yellow-500 to-amber-500',
}

const deptIcons: Record<string, any> = {
  Management: Brain,
  Engineering: Code,
  Research: Search,
  'AI Lab': Zap,
  Finance: Shield,
}

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-yellow-400', label: 'Wartend' },
  running: { icon: Loader2, color: 'text-blue-400', label: 'Läuft...' },
  completed: { icon: CheckCircle, color: 'text-green-400', label: 'Fertig' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Fehler' },
}

function TaskCard({ task }: { task: Task }) {
  const [expanded, setExpanded] = useState(task.status === 'completed' || task.status === 'failed')
  const config = statusConfig[task.status] || statusConfig.pending
  const StatusIcon = config.icon
  const result = task.result

  return (
    <div className="glass rounded-lg p-4 transition-all duration-300">
      <div className="flex items-start gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <StatusIcon size={18} className={cn(config.color, task.status === 'running' && 'animate-spin')} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{task.title}</span>
            <span className={cn('text-xs px-1.5 py-0.5 rounded', config.color, 'bg-current/10')}>
              {config.label}
            </span>
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">
            {new Date(task.created_at).toLocaleString('de-DE')}
            {task.completed_at && ` — ${Math.round((new Date(task.completed_at).getTime() - new Date(task.created_at).getTime()) / 1000)}s`}
          </div>
        </div>
        {result && (
          expanded ? <ChevronUp size={16} className="text-[var(--text-secondary)] shrink-0" /> : <ChevronDown size={16} className="text-[var(--text-secondary)] shrink-0" />
        )}
      </div>

      {expanded && result && (
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          {result.summary ? (
            <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed prose-invert max-w-none"
              dangerouslySetInnerHTML={{
                __html: result.summary
                  .replace(/\*\*(.*?)\*\*/g, '<strong class="text-[var(--text-primary)]">$1</strong>')
                  .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-[var(--bg-primary)] rounded p-3 my-2 text-xs overflow-x-auto"><code>$2</code></pre>')
                  .replace(/`(.*?)`/g, '<code class="bg-[var(--bg-primary)] px-1 rounded text-xs">$1</code>')
                  .replace(/\n/g, '<br/>')
              }}
            />
          ) : result.error ? (
            <div className="text-sm text-red-400">{result.error}</div>
          ) : (
            <pre className="text-xs text-[var(--text-secondary)] overflow-auto max-h-40">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
          {result.task_type && (
            <div className="mt-2 text-xs text-[var(--text-secondary)]">
              Typ: <span className="font-mono">{result.task_type}</span>
              {result.sources_count !== undefined && ` — ${result.sources_count} Quellen`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AgentsPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selected, setSelected] = useState<Employee | null>(null)
  const [taskInput, setTaskInput] = useState('')
  const [sending, setSending] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks')
      const data = await res.json()
      setTasks(data.tasks || [])
    } catch {}
  }, [])

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setEmployees(d.employees || []))
    loadTasks()
  }, [loadTasks])

  // Poll for task updates when there are running tasks
  useEffect(() => {
    const hasRunning = tasks.some(t => t.status === 'running' || t.status === 'pending')
    if (!hasRunning) return

    const interval = setInterval(loadTasks, 2000)
    return () => clearInterval(interval)
  }, [tasks, loadTasks])

  const assignTask = async () => {
    if (!selected || !taskInput || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: selected.id, title: taskInput }),
      })
      const data = await res.json()
      if (data.task) {
        setTasks(prev => [data.task, ...prev])
        setTaskInput('')
        // Start polling
        setTimeout(loadTasks, 1000)
      }
    } catch (err) {
      console.error('Failed to assign task:', err)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 lg:ml-[240px] overflow-y-auto">
          <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Bot className="text-indigo-400" />
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                KI-Agenten
              </span>
            </h1>
            <p className="text-[var(--text-secondary)] mb-8">
              Dein virtuelles Team von spezialisierten KI-Mitarbeitern
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Agents Grid */}
              <div className="lg:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {employees.map(emp => {
                    const skills = typeof emp.skills === 'string' ? JSON.parse(emp.skills) : emp.skills
                    const Icon = deptIcons[emp.department] || Bot
                    const isSelected = selected?.id === emp.id
                    return (
                      <div
                        key={emp.id}
                        onClick={() => setSelected(isSelected ? null : emp)}
                        className={cn(
                          'glass rounded-xl p-5 cursor-pointer transition-all duration-300 hover:scale-[1.02]',
                          isSelected && 'ring-2 ring-indigo-500 glow-accent'
                        )}
                      >
                        <div className="flex items-start gap-3 mb-4">
                          <div className={cn(
                            'w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br text-white',
                            deptColors[emp.department] || 'from-gray-500 to-gray-600'
                          )}>
                            <Icon size={24} />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg">{emp.name}</h3>
                            <p className="text-sm text-[var(--text-secondary)]">{emp.role}</p>
                          </div>
                          <span className={cn(
                            'ml-auto px-2 py-0.5 rounded-full text-xs',
                            emp.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'
                          )}>
                            {emp.status}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1 mb-3">
                          {(skills || []).map((skill: string) => (
                            <span key={skill} className="px-2 py-0.5 rounded bg-[var(--bg-primary)] text-xs text-[var(--text-secondary)]">
                              {skill}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                          <span>{emp.total_tasks || 0} Tasks</span>
                          <span>{emp.completed_tasks || 0} erledigt</span>
                          <span className="ml-auto font-mono">{emp.model}</span>
                        </div>

                        {isSelected && (
                          <div className="mt-4 pt-4 border-t border-[var(--border)]" onClick={e => e.stopPropagation()}>
                            <p className="text-xs text-[var(--text-secondary)] mb-3 italic">
                              &ldquo;{emp.system_prompt}&rdquo;
                            </p>
                            <div className="flex gap-2">
                              <input
                                placeholder="Aufgabe zuweisen..."
                                value={taskInput}
                                onChange={e => setTaskInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && assignTask()}
                                className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-sm outline-none focus:border-indigo-500"
                                disabled={sending}
                              />
                              <button
                                onClick={assignTask}
                                disabled={sending || !taskInput}
                                className="p-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white transition-colors"
                              >
                                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Task Feed */}
              <div className="lg:col-span-1">
                <div className="glass rounded-xl p-5 sticky top-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Zap size={18} className="text-indigo-400" />
                    Task-Verlauf
                    {tasks.some(t => t.status === 'running') && (
                      <span className="ml-auto flex items-center gap-1 text-xs text-blue-400">
                        <Loader2 size={12} className="animate-spin" />
                        Verarbeitung...
                      </span>
                    )}
                  </h3>
                  <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto">
                    {tasks.length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)] text-center py-8">
                        Noch keine Aufgaben. Wähle einen Agenten und weise eine Aufgabe zu.
                      </p>
                    ) : (
                      tasks.slice(0, 20).map(task => (
                        <TaskCard key={task.id} task={task} />
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
