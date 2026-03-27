'use client'

import { useState, useEffect, useRef } from 'react'
import Sidebar from '@/components/Sidebar'
import StatusBar from '@/components/StatusBar'
import { Activity, Radio, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LiveEvent {
  id: string
  timestamp: string
  type: string
  message: string
  data?: any
}

export default function LivePage() {
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [connected, setConnected] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Poll-based live events (WebSocket upgrade in production)
    const addEvent = (type: string, message: string, data?: any) => {
      setEvents(prev => [...prev.slice(-200), {
        id: Date.now().toString() + Math.random(),
        timestamp: new Date().toISOString(),
        type, message, data
      }])
    }

    addEvent('system', 'Live-View gestartet. Warte auf Events...')
    setConnected(true)

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/live')
        if (res.ok) {
          const data = await res.json()
          if (data.events?.length) {
            data.events.forEach((e: any) => addEvent(e.type, e.message, e.data))
          }
        }
      } catch { setConnected(false) }
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 lg:ml-[240px] flex flex-col overflow-hidden">
          <div className="p-6 lg:p-8 pb-0">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Activity className="text-indigo-400" />
                <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Live-View
                </span>
              </h1>
              <div className="flex items-center gap-2">
                <Circle size={8} className={cn(
                  'animate-pulse-dot',
                  connected ? 'fill-green-400 text-green-400' : 'fill-red-400 text-red-400'
                )} />
                <span className="text-sm text-[var(--text-secondary)]">
                  {connected ? 'Live' : 'Getrennt'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 lg:px-8 pb-4">
            <div className="glass rounded-xl p-1">
              <div className="bg-[var(--bg-primary)] rounded-lg p-4 font-mono text-sm min-h-[400px]">
                {events.map((event) => (
                  <div key={event.id} className="flex gap-2 py-0.5 hover:bg-[var(--bg-hover)] px-2 rounded">
                    <span className="text-[var(--text-secondary)] shrink-0">
                      {new Date(event.timestamp).toLocaleTimeString('de-DE')}
                    </span>
                    <span className={cn(
                      'shrink-0',
                      event.type === 'system' ? 'text-indigo-400' :
                      event.type === 'task' ? 'text-yellow-400' :
                      event.type === 'ai' ? 'text-purple-400' :
                      event.type === 'error' ? 'text-red-400' : 'text-green-400'
                    )}>
                      [{event.type}]
                    </span>
                    <span>{event.message}</span>
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
