'use client'

import { useState, useEffect, useRef } from 'react'
import Sidebar from '@/components/Sidebar'
import StatusBar from '@/components/StatusBar'
import { ScrollText, RefreshCw, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogEntry {
  id: number
  type: string
  message: string
  details: any
  created_at: string
}

const typeColors: Record<string, string> = {
  system: 'text-indigo-400',
  project: 'text-green-400',
  task: 'text-yellow-400',
  error: 'text-red-400',
  ai: 'text-purple-400',
  finance: 'text-emerald-400',
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<string>('')
  const [autoScroll, setAutoScroll] = useState(true)
  const topRef = useRef<HTMLDivElement>(null)

  const fetchLogs = () => {
    const url = filter ? `/api/logs?type=${filter}` : '/api/logs'
    fetch(url).then(r => r.json()).then(d => setLogs(d.logs || []))
  }

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 3000)
    return () => clearInterval(interval)
  }, [filter])

  useEffect(() => {
    if (autoScroll) topRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, autoScroll])

  const types = ['system', 'project', 'task', 'error', 'ai', 'finance']

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 lg:ml-[240px] flex flex-col overflow-hidden">
          <div className="p-6 lg:p-8 pb-0">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <ScrollText className="text-indigo-400" />
                <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  System Logs
                </span>
              </h1>
              <div className="flex items-center gap-2">
                <button onClick={fetchLogs} className="p-2 rounded-lg glass hover:bg-[var(--bg-hover)] transition-colors">
                  <RefreshCw size={16} />
                </button>
                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={cn('p-2 rounded-lg glass transition-colors', autoScroll && 'text-indigo-400 glow-accent')}
                  title={autoScroll ? 'Auto-Scroll aktiv (neueste oben)' : 'Auto-Scroll deaktiviert'}
                >
                  <ArrowUp size={16} />
                </button>
              </div>
            </div>
            <div className="flex gap-2 mb-4 flex-wrap">
              <button
                onClick={() => setFilter('')}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  !filter ? 'bg-indigo-500 text-white' : 'glass hover:bg-[var(--bg-hover)]'
                )}
              >
                Alle
              </button>
              {types.map(t => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    filter === t ? 'bg-indigo-500 text-white' : 'glass hover:bg-[var(--bg-hover)]'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 lg:px-8 pb-4">
            <div className="glass rounded-xl font-mono text-sm">
              <div ref={topRef} />
              {logs.map((log) => (
                <div key={log.id} className="log-line flex gap-3 px-4 py-2 border-b border-[var(--border)]/50">
                  <span className="text-[var(--text-secondary)] shrink-0 w-[140px]">
                    {new Date(log.created_at).toLocaleString('de-DE')}
                  </span>
                  <span className={cn('shrink-0 w-[70px] font-semibold', typeColors[log.type] || 'text-gray-400')}>
                    [{log.type}]
                  </span>
                  <span className="text-[var(--text-primary)]">{log.message}</span>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-center py-12 text-[var(--text-secondary)]">Keine Logs vorhanden</div>
              )}
            </div>
          </div>
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
