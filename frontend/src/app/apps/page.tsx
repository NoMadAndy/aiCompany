'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import StatusBar from '@/components/StatusBar'
import {
  Rocket, ExternalLink, Code2, Globe, Clock, Bot, XCircle,
  Maximize2, Minimize2, FolderKanban
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DeployedApp {
  id: number
  task_id: number | null
  project_id: number | null
  name: string
  description: string
  language: string
  status: string
  url_slug: string
  deployed_by_name: string
  project_name: string | null
  created_at: string
}

const langConfig: Record<string, { color: string; label: string }> = {
  html: { color: 'text-orange-400 bg-orange-500/10', label: 'HTML App' },
  code: { color: 'text-cyan-400 bg-cyan-500/10', label: 'Quellcode' },
  python: { color: 'text-blue-400 bg-blue-500/10', label: 'Python' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export default function AppsPage() {
  const [apps, setApps] = useState<DeployedApp[]>([])
  const [loading, setLoading] = useState(true)
  const [previewApp, setPreviewApp] = useState<DeployedApp | null>(null)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    fetch('/api/apps')
      .then(r => r.json())
      .then(d => setApps(d.apps || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 lg:ml-[240px] overflow-y-auto">
          <div className="p-6 lg:p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Rocket className="text-indigo-400" />
                <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Deployed Apps
                </span>
              </h1>
              <p className="text-[var(--text-secondary)] mt-1">
                Von KI-Agenten generierte und automatisch deployed Apps
              </p>
            </div>

            {/* Stats */}
            <div className="glass rounded-xl p-4 mb-6 flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-green-400" />
                <span className="text-sm"><strong className="text-green-400">{apps.length}</strong> Apps aktiv</span>
              </div>
              <div className="flex items-center gap-2">
                <Code2 size={16} className="text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-secondary)]">Automatisch deployed nach Code-Generierung</span>
              </div>
            </div>

            {/* App Grid */}
            {loading ? (
              <div className="glass rounded-xl p-12 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-[var(--text-secondary)]">Lade Apps...</p>
              </div>
            ) : apps.length === 0 ? (
              <div className="glass rounded-xl p-12 text-center">
                <Rocket size={48} className="mx-auto mb-4 text-[var(--text-tertiary)]" />
                <h3 className="text-lg font-semibold mb-2">Noch keine Apps deployed</h3>
                <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
                  Apps werden automatisch deployed, wenn ein KI-Agent Code generiert.
                  Erstelle ein Projekt mit einer Code-Aufgabe und übergib es an ARIA.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {apps.map(app => {
                  const lang = langConfig[app.language] || langConfig.code
                  return (
                    <div key={app.id} className="glass rounded-xl overflow-hidden card-hover group">
                      {/* Preview thumbnail */}
                      <div
                        className="aspect-video bg-[var(--bg-primary)] relative overflow-hidden cursor-pointer"
                        onClick={() => setPreviewApp(app)}
                      >
                        <iframe
                          src={`/api/apps/serve?slug=${app.url_slug}`}
                          className="w-[200%] h-[200%] origin-top-left scale-50 pointer-events-none"
                          title={app.name}
                          loading="lazy"
                          sandbox="allow-scripts"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-secondary)] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                          <span className="px-3 py-1.5 rounded-lg bg-indigo-500/80 text-white text-xs font-medium">
                            Vorschau öffnen
                          </span>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-sm leading-tight">{app.name}</h3>
                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', lang.color)}>
                            {lang.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[10px] text-[var(--text-tertiary)] mb-3">
                          <span className="flex items-center gap-1">
                            <Bot size={10} /> {app.deployed_by_name || 'NEXUS'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={10} /> {formatDate(app.created_at)}
                          </span>
                          {app.project_name && (
                            <span className="flex items-center gap-1">
                              <FolderKanban size={10} /> {app.project_name}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => setPreviewApp(app)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-medium transition"
                          >
                            <Maximize2 size={12} /> Öffnen
                          </button>
                          <a
                            href={`/api/apps/serve?slug=${app.url_slug}`}
                            target="_blank"
                            rel="noopener"
                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] text-xs transition border border-[var(--border)]"
                          >
                            <ExternalLink size={12} /> Neuer Tab
                          </a>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>
      <StatusBar />

      {/* App Preview Modal */}
      {previewApp && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              <Globe size={16} className="text-green-400" />
              <span className="font-medium text-sm">{previewApp.name}</span>
              <span className="text-xs text-[var(--text-secondary)]">
                /api/apps/serve?slug={previewApp.url_slug}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/api/apps/serve?slug=${previewApp.url_slug}`}
                target="_blank"
                rel="noopener"
                className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition"
                title="In neuem Tab öffnen"
              >
                <ExternalLink size={16} />
              </a>
              <button
                onClick={() => setFullscreen(!fullscreen)}
                className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition"
              >
                {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button
                onClick={() => { setPreviewApp(null); setFullscreen(false) }}
                className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition"
              >
                <XCircle size={16} />
              </button>
            </div>
          </div>

          {/* App iframe */}
          <div className="flex-1">
            <iframe
              src={`/api/apps/serve?slug=${previewApp.url_slug}`}
              className="w-full h-full bg-white"
              title={previewApp.name}
              sandbox="allow-scripts allow-forms allow-same-origin"
            />
          </div>
        </div>
      )}
    </div>
  )
}
