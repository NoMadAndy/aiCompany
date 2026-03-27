'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import StatusBar from '@/components/StatusBar'
import { Settings, Server, Database, Cpu, Globe, RefreshCw } from 'lucide-react'

export default function SettingsPage() {
  const [status, setStatus] = useState<any>(null)
  const [version, setVersion] = useState<any>(null)

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(setStatus)
    fetch('/version.json').then(r => r.json()).then(setVersion).catch(() => {})
  }, [])

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 lg:ml-[240px] overflow-y-auto">
          <div className="p-6 lg:p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
              <Settings className="text-indigo-400" />
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Einstellungen
              </span>
            </h1>

            <div className="space-y-6">
              {/* System Info */}
              <div className="glass rounded-xl p-5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Server size={18} className="text-indigo-400" />
                  System
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-[var(--bg-primary)]">
                    <div className="text-xs text-[var(--text-secondary)]">Version</div>
                    <div className="font-mono">{version?.version || '...'} ({version?.codename || ''})</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--bg-primary)]">
                    <div className="text-xs text-[var(--text-secondary)]">Build Date</div>
                    <div className="font-mono">{version?.buildDate || '...'}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--bg-primary)]">
                    <div className="text-xs text-[var(--text-secondary)]">Uptime</div>
                    <div className="font-mono">{status?.uptime ? `${Math.floor(status.uptime / 60)}m` : '...'}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--bg-primary)]">
                    <div className="text-xs text-[var(--text-secondary)]">GPU</div>
                    <div className="font-mono">{status?.gpu || '...'}</div>
                  </div>
                </div>
              </div>

              {/* Services */}
              <div className="glass rounded-xl p-5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Database size={18} className="text-indigo-400" />
                  Services
                </h3>
                <div className="space-y-3">
                  {['Next.js Frontend', 'PostgreSQL', 'Redis', 'Python AI Worker', 'File Watcher'].map(s => (
                    <div key={s} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-primary)]">
                      <span>{s}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-400">Aktiv</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Endpoints */}
              <div className="glass rounded-xl p-5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Globe size={18} className="text-indigo-400" />
                  Endpoints
                </h3>
                <div className="space-y-2 font-mono text-sm">
                  <div className="p-2 rounded bg-[var(--bg-primary)]">
                    <span className="text-[var(--text-secondary)]">App:</span> https://aicompany.macherwerkstatt.cc
                  </div>
                  <div className="p-2 rounded bg-[var(--bg-primary)]">
                    <span className="text-[var(--text-secondary)]">API:</span> https://aicompany.macherwerkstatt.cc/api
                  </div>
                  <div className="p-2 rounded bg-[var(--bg-primary)]">
                    <span className="text-[var(--text-secondary)]">WebSocket:</span> wss://aicompany.macherwerkstatt.cc
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
