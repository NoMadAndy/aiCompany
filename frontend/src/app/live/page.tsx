'use client'

import { useState, useEffect, useRef } from 'react'
import Sidebar from '@/components/Sidebar'
import StatusBar from '@/components/StatusBar'
import { Activity, Circle, CheckCircle2, Loader2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LiveEvent {
  id: string
  timestamp: string
  type: string
  message: string
  data?: any
}

interface TaskProgress {
  total: number
  completed: number
  running: number
  failed: number
  pending: number
}

const TYPE_COLORS: Record<string, string> = {
  system: 'text-indigo-400',
  task: 'text-amber-400',
  ai: 'text-purple-400',
  error: 'text-red-400',
  project: 'text-blue-400',
  finance: 'text-emerald-400',
  success: 'text-green-400',
}

export default function LivePage() {
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [progress, setProgress] = useState<TaskProgress>({ total: 0, completed: 0, running: 0, failed: 0, pending: 0 })
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const addEvent = (type: string, message: string, data?: any) => {
      setEvents(prev => [...prev.slice(-300), {
        id: Date.now().toString() + Math.random(),
        timestamp: new Date().toISOString(),
        type, message, data
      }])
    }

    addEvent('system', 'Live-View gestartet. Warte auf Events...')
    setConnected(true)

    const interval = setInterval(async () => {
      try {
        const [liveRes, taskRes] = await Promise.all([
          fetch('/api/live'),
          fetch('/api/tasks'),
        ])
        if (liveRes.ok) {
          const data = await liveRes.json()
          if (data.events?.length) {
            data.events.forEach((e: any) => addEvent(e.type, e.message, e.data))
          }
          setConnected(true)
        }
        if (taskRes.ok) {
          const tasks = await taskRes.json()
          const arr = Array.isArray(tasks) ? tasks : []
          setProgress({
            total: arr.length,
            completed: arr.filter((t: any) => t.status === 'completed').length,
            running: arr.filter((t: any) => t.status === 'running').length,
            failed: arr.filter((t: any) => t.status === 'failed').length,
            pending: arr.filter((t: any) => t.status === 'pending').length,
          })
        }
      } catch { setConnected(false) }
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  const progressPct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 lg:ml-[240px] flex flex-col overflow-hidden">
          <div className="p-6 lg:p-8 pb-0 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Activity className="text-indigo-400" />
                <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Live-View
                </span>
              </h1>
              <div className="flex items-center gap-2">
                <div className={cn('status-dot', connected ? 'status-online pulse' : 'status-busy')} />
                <span className="text-sm text-[var(--text-secondary)]">
                  {connected ? 'Live' : 'Getrennt'}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            {progress.total > 0 && (
              <div className="glass rounded-xl p-4 animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Aufgaben-Fortschritt</span>
                  <span className="text-sm font-mono text-indigo-400">{progressPct}%</span>
                </div>
                <div className="progress-bar mb-3">
                  <div
                    className={cn('progress-fill', progress.running > 0 && 'shimmer glow')}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex gap-4 text-xs text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-green-400" />
                    {progress.completed} erledigt
                  </span>
                  {progress.running > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Loader2 size={12} className="text-indigo-400 animate-spin" />
                      {progress.running} aktiv
                    </span>
                  )}
                  {progress.pending > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Clock size={12} className="text-[var(--text-tertiary)]" />
                      {progress.pending} wartend
                    </span>
                  )}
                  {progress.failed > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Circle size={12} className="text-red-400" />
                      {progress.failed} fehlgeschlagen
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Event Log */}
          <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-4">
            <div className="glass rounded-xl overflow-hidden">
              <div className="bg-[rgba(0,0,0,0.3)] p-4 font-mono text-xs min-h-[400px] space-y-0">
                {events.map((event) => (
                  <div key={event.id} className="flex gap-3 py-[3px] hover:bg-[rgba(255,255,255,0.03)] px-3 rounded transition min-w-0">
                    <span className="text-[var(--text-tertiary)] shrink-0 w-[62px]">
                      {new Date(event.timestamp).toLocaleTimeString('de-DE')}
                    </span>
                    <span className={cn('shrink-0 w-[52px] font-semibold', TYPE_COLORS[event.type] || 'text-gray-400')}>
                      [{event.type}]
                    </span>
                    <span className="text-[var(--text-secondary)] min-w-0 break-all" style={{ overflowWrap: 'anywhere' }}>
                      {event.message}
                    </span>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </div>
          </div>
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
