'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronUp, ChevronDown, Minus, X, Activity, Filter } from 'lucide-react'

interface LogEvent {
  id: number
  type: string
  message: string
  created_at: string
}

type PanelState = 'hidden' | 'collapsed' | 'compact' | 'expanded'

const TYPE_COLORS: Record<string, string> = {
  system: 'text-indigo-400',
  task: 'text-amber-400',
  ai: 'text-purple-400',
  error: 'text-red-400',
  project: 'text-blue-400',
  finance: 'text-emerald-400',
}

const TYPE_LABELS: Record<string, string> = {
  system: 'SYS',
  task: 'TASK',
  ai: 'AI',
  error: 'ERR',
  project: 'PROJ',
  finance: 'FIN',
}

export default function LogPanel() {
  const [state, setState] = useState<PanelState>('collapsed')
  const [events, setEvents] = useState<LogEvent[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [newCount, setNewCount] = useState(0)
  const bodyRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)

  // Poll for events
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/logs?limit=100')
        if (res.ok) {
          const data = await res.json()
          const logs = data.logs || data || []
          if (logs.length > prevCountRef.current && prevCountRef.current > 0) {
            setNewCount(n => n + (logs.length - prevCountRef.current))
          }
          prevCountRef.current = logs.length
          setEvents(logs)
        }
      } catch {}
    }
    load()
    const iv = setInterval(load, 3000)
    return () => clearInterval(iv)
  }, [])

  // Auto-scroll
  useEffect(() => {
    if (bodyRef.current && state !== 'collapsed' && state !== 'hidden') {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [events, state])

  // Keyboard shortcut: Ctrl+` to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault()
        setState(s => s === 'hidden' ? 'compact' : s === 'compact' ? 'expanded' : 'hidden')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const toggle = () => {
    if (state === 'collapsed') {
      setState('compact')
      setNewCount(0)
    } else if (state === 'compact') {
      setState('expanded')
    } else {
      setState('collapsed')
    }
  }

  const filteredEvents = filter === 'all' ? events : events.filter(e => e.type === filter)

  const height = state === 'hidden' ? 0 : state === 'collapsed' ? 36 : state === 'compact' ? 220 : '50vh'

  if (state === 'hidden') {
    return (
      <button
        onClick={() => setState('collapsed')}
        className="fixed bottom-4 right-4 z-50 p-2.5 rounded-full glass-elevated text-[var(--text-secondary)] hover:text-indigo-400 transition"
        title="Logs anzeigen (Ctrl+`)"
      >
        <Activity size={16} />
        {newCount > 0 && <span className="absolute -top-1 -right-1 log-badge text-[10px] min-w-[16px] h-[16px]">{newCount}</span>}
      </button>
    )
  }

  return (
    <div className="log-panel" style={{ height }}>
      {/* Header */}
      <div className="log-panel-header" onClick={toggle}>
        <div className="flex items-center gap-3">
          <Activity size={14} className="text-indigo-400" />
          <span className="text-micro">LIVE LOGS</span>
          {(state === 'collapsed' && newCount > 0) && <span className="log-badge">{newCount}</span>}
          {state !== 'collapsed' && <span className="text-[10px] text-[var(--text-tertiary)]">{filteredEvents.length} Einträge</span>}
        </div>
        <div className="flex items-center gap-1">
          {state !== 'collapsed' && (
            <button
              onClick={e => { e.stopPropagation(); setState('collapsed') }}
              className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
            >
              <Minus size={14} />
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); setState('hidden') }}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
          >
            <X size={14} />
          </button>
          {state === 'collapsed' ? <ChevronUp size={14} className="text-[var(--text-secondary)]" /> : <ChevronDown size={14} className="text-[var(--text-secondary)]" />}
        </div>
      </div>

      {/* Filters + Body */}
      {state !== 'collapsed' && (
        <>
          <div className="flex gap-1 px-3 py-1.5 border-b border-[rgba(255,255,255,0.05)] flex-shrink-0">
            <Filter size={12} className="text-[var(--text-tertiary)] mr-1 mt-0.5" />
            {['all', 'system', 'task', 'ai', 'error', 'project', 'finance'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                  filter === f
                    ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-transparent'
                }`}
              >
                {f === 'all' ? 'Alle' : (TYPE_LABELS[f] || f).toUpperCase()}
              </button>
            ))}
          </div>

          <div ref={bodyRef} className="log-panel-body">
            {filteredEvents.map(event => (
              <div key={event.id} className="log-entry">
                <span className="text-[var(--text-tertiary)] flex-shrink-0 w-[60px]">
                  {new Date(event.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className={`flex-shrink-0 w-[36px] font-semibold text-[10px] uppercase ${TYPE_COLORS[event.type] || 'text-gray-400'}`}>
                  {TYPE_LABELS[event.type] || event.type}
                </span>
                <span className="text-[var(--text-secondary)] break-words">{event.message}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
