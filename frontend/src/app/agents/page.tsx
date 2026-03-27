'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import StatusBar from '@/components/StatusBar'
import { Bot, Zap, Brain, Code, Search, Shield, Send } from 'lucide-react'
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

export default function AgentsPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selected, setSelected] = useState<Employee | null>(null)
  const [taskInput, setTaskInput] = useState('')

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setEmployees(d.employees || []))
  }, [])

  const assignTask = async () => {
    if (!selected || !taskInput) return
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: selected.id, title: taskInput }),
    })
    setTaskInput('')
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 lg:ml-[240px] overflow-y-auto">
          <div className="p-6 lg:p-8 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Bot className="text-indigo-400" />
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                KI-Agenten
              </span>
            </h1>
            <p className="text-[var(--text-secondary)] mb-8">
              Dein virtuelles Team von spezialisierten KI-Mitarbeitern
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {employees.map(emp => {
                const skills = typeof emp.skills === 'string' ? JSON.parse(emp.skills) : emp.skills
                const Icon = deptIcons[emp.department] || Bot
                return (
                  <div
                    key={emp.id}
                    onClick={() => setSelected(selected?.id === emp.id ? null : emp)}
                    className={cn(
                      'glass rounded-xl p-5 cursor-pointer transition-all duration-300 hover:scale-[1.02]',
                      selected?.id === emp.id && 'ring-2 ring-indigo-500 glow-accent'
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

                    {selected?.id === emp.id && (
                      <div className="mt-4 pt-4 border-t border-[var(--border)]">
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
                          />
                          <button onClick={assignTask} className="p-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white">
                            <Send size={16} />
                          </button>
                        </div>
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
