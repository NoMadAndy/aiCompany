'use client'

import { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import StatusBar from '@/components/StatusBar'
import {
  Rocket, ExternalLink, Code2, Globe, Clock, Bot, XCircle,
  Maximize2, Minimize2, FolderKanban, Play, Square, RotateCcw,
  Trash2, Container, Wifi, WifiOff, AlertCircle, Terminal, Server
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
  container_id: string | null
  port: number | null
  deploy_type: string | null
  container_status: string | null
  docker_image: string | null
  error_log: string | null
  updated_at: string | null
}

const langConfig: Record<string, { color: string; label: string }> = {
  html: { color: 'text-orange-400 bg-orange-500/10', label: 'HTML App' },
  code: { color: 'text-cyan-400 bg-cyan-500/10', label: 'Quellcode' },
  python: { color: 'text-blue-400 bg-blue-500/10', label: 'Python' },
}

const statusConfig: Record<string, { color: string; icon: typeof Wifi; label: string }> = {
  running: { color: 'text-green-400', icon: Wifi, label: 'Laeuft' },
  stopped: { color: 'text-yellow-400', icon: WifiOff, label: 'Gestoppt' },
  building: { color: 'text-blue-400', icon: Container, label: 'Baut...' },
  error: { color: 'text-red-400', icon: AlertCircle, label: 'Fehler' },
  none: { color: 'text-gray-500', icon: Server, label: 'Nicht deployed' },
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
  const [actionLoading, setActionLoading] = useState<Record<number, string>>({})
  const [logsApp, setLogsApp] = useState<DeployedApp | null>(null)
  const [logs, setLogs] = useState('')

  const fetchApps = useCallback(() => {
    fetch('/api/apps')
      .then(r => r.json())
      .then(d => setApps(d.apps || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchApps()
    const interval = setInterval(fetchApps, 5000)
    return () => clearInterval(interval)
  }, [fetchApps])

  const appAction = async (appId: number, action: 'deploy' | 'stop' | 'restart' | 'remove') => {
    setActionLoading(prev => ({ ...prev, [appId]: action }))
    try {
      const res = await fetch(`/api/apps/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId }),
      })
      await res.json()
      // Refresh nach kurzer Verzoegerung
      setTimeout(fetchApps, 1500)
    } catch (e) {
      console.error(`${action} failed:`, e)
    } finally {
      setTimeout(() => {
        setActionLoading(prev => {
          const next = { ...prev }
          delete next[appId]
          return next
        })
      }, 2000)
    }
  }

  const fetchLogs = async (app: DeployedApp) => {
    setLogsApp(app)
    try {
      const res = await fetch(`/api/apps/logs?app_id=${app.id}&tail=100`)
      const data = await res.json()
      setLogs(data.logs || 'Keine Logs verfuegbar')
    } catch {
      setLogs('Fehler beim Laden der Logs')
    }
  }

  const getAppUrl = (app: DeployedApp) => {
    if (app.deploy_type === 'docker' && app.port && app.container_status === 'running') {
      return `http://${window.location.hostname}:${app.port}`
    }
    return `/api/apps/serve?slug=${app.url_slug}`
  }

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
                Von KI-Agenten generierte Apps — Inline oder als Docker-Container
              </p>
            </div>

            {/* Stats */}
            <div className="glass rounded-xl p-4 mb-6 flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-green-400" />
                <span className="text-sm"><strong className="text-green-400">{apps.length}</strong> Apps gesamt</span>
              </div>
              <div className="flex items-center gap-2">
                <Container size={16} className="text-indigo-400" />
                <span className="text-sm">
                  <strong className="text-indigo-400">
                    {apps.filter(a => a.container_status === 'running').length}
                  </strong> Docker-Container aktiv
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Server size={16} className="text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-secondary)]">
                  Ports 4000-4100
                </span>
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
                  Erstelle ein Projekt mit einer Code-Aufgabe und uebergib es an ARIA.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {apps.map(app => {
                  const lang = langConfig[app.language] || langConfig.code
                  const status = statusConfig[app.container_status || 'none'] || statusConfig.none
                  const StatusIcon = status.icon
                  const isDocker = app.deploy_type === 'docker'
                  const isRunning = app.container_status === 'running'
                  const currentAction = actionLoading[app.id]

                  return (
                    <div key={app.id} className="glass rounded-xl overflow-hidden card-hover group">
                      {/* Preview thumbnail */}
                      <div
                        className="aspect-video bg-[var(--bg-primary)] relative overflow-hidden cursor-pointer"
                        onClick={() => setPreviewApp(app)}
                      >
                        <iframe
                          src={getAppUrl(app)}
                          className="w-[200%] h-[200%] origin-top-left scale-50 pointer-events-none"
                          title={app.name}
                          loading="lazy"
                          sandbox="allow-scripts"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-secondary)] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                          <span className="px-3 py-1.5 rounded-lg bg-indigo-500/80 text-white text-xs font-medium">
                            Vorschau oeffnen
                          </span>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-sm leading-tight">{app.name}</h3>
                          <div className="flex items-center gap-1.5">
                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', lang.color)}>
                              {lang.label}
                            </span>
                          </div>
                        </div>

                        {/* Docker Status */}
                        <div className="flex items-center gap-2 mb-2">
                          <StatusIcon size={12} className={status.color} />
                          <span className={cn('text-[11px] font-medium', status.color)}>
                            {status.label}
                          </span>
                          {isDocker && app.port && (
                            <span className="text-[10px] text-[var(--text-tertiary)] ml-auto font-mono">
                              :{app.port}
                            </span>
                          )}
                          {!isDocker && (
                            <span className="text-[10px] text-[var(--text-tertiary)] ml-auto">
                              Inline
                            </span>
                          )}
                        </div>

                        {/* Error Log */}
                        {app.error_log && (
                          <div className="text-[10px] text-red-400/80 bg-red-500/5 rounded px-2 py-1 mb-2 truncate">
                            {app.error_log}
                          </div>
                        )}

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

                        {/* Action Buttons */}
                        <div className="flex gap-1.5">
                          {/* Deploy / Restart */}
                          {!isRunning ? (
                            <button
                              onClick={() => appAction(app.id, isDocker ? 'restart' : 'deploy')}
                              disabled={!!currentAction}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition",
                                currentAction === 'deploy' || currentAction === 'restart'
                                  ? 'bg-green-500/20 text-green-300 animate-pulse'
                                  : 'bg-green-500/10 hover:bg-green-500/20 text-green-400'
                              )}
                            >
                              <Play size={12} />
                              {currentAction === 'deploy' || currentAction === 'restart' ? 'Startet...' : 'Deployen'}
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => appAction(app.id, 'restart')}
                                disabled={!!currentAction}
                                className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-medium transition"
                                title="Neustart"
                              >
                                <RotateCcw size={12} />
                              </button>
                              <button
                                onClick={() => appAction(app.id, 'stop')}
                                disabled={!!currentAction}
                                className={cn(
                                  "flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition",
                                  currentAction === 'stop'
                                    ? 'bg-yellow-500/20 text-yellow-300 animate-pulse'
                                    : 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400'
                                )}
                                title="Stoppen"
                              >
                                <Square size={12} />
                              </button>
                            </>
                          )}

                          {/* Preview */}
                          <button
                            onClick={() => setPreviewApp(app)}
                            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-medium transition"
                            title="Vorschau"
                          >
                            <Maximize2 size={12} />
                          </button>

                          {/* External Link */}
                          <a
                            href={getAppUrl(app)}
                            target="_blank"
                            rel="noopener"
                            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] text-xs transition border border-[var(--border)]"
                            title="Im neuen Tab oeffnen"
                          >
                            <ExternalLink size={12} />
                          </a>

                          {/* Logs */}
                          {isDocker && (
                            <button
                              onClick={() => fetchLogs(app)}
                              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] text-xs transition border border-[var(--border)]"
                              title="Container-Logs"
                            >
                              <Terminal size={12} />
                            </button>
                          )}

                          {/* Remove Docker */}
                          {isDocker && (
                            <button
                              onClick={() => {
                                if (confirm(`Docker-Container fuer "${app.name}" entfernen?`)) {
                                  appAction(app.id, 'remove')
                                }
                              }}
                              disabled={!!currentAction}
                              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition"
                              title="Docker-Container entfernen"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
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
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              <Globe size={16} className="text-green-400" />
              <span className="font-medium text-sm">{previewApp.name}</span>
              {previewApp.deploy_type === 'docker' && previewApp.port ? (
                <span className="text-xs text-[var(--text-secondary)] font-mono">
                  Port {previewApp.port}
                </span>
              ) : (
                <span className="text-xs text-[var(--text-secondary)]">
                  /api/apps/serve?slug={previewApp.url_slug}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <a
                href={getAppUrl(previewApp)}
                target="_blank"
                rel="noopener"
                className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition"
                title="In neuem Tab oeffnen"
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
          <div className="flex-1">
            <iframe
              src={getAppUrl(previewApp)}
              className="w-full h-full bg-white"
              title={previewApp.name}
              sandbox="allow-scripts allow-forms allow-same-origin"
            />
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {logsApp && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-8">
          <div className="glass rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-indigo-400" />
                <span className="font-medium text-sm">Container-Logs: {logsApp.name}</span>
                {logsApp.container_id && (
                  <span className="text-[10px] text-[var(--text-tertiary)] font-mono">
                    {logsApp.container_id}
                  </span>
                )}
              </div>
              <button
                onClick={() => { setLogsApp(null); setLogs('') }}
                className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition"
              >
                <XCircle size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-xs font-mono text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                {logs || 'Lade Logs...'}
              </pre>
            </div>
            <div className="px-4 py-2 border-t border-[var(--border)] flex justify-end">
              <button
                onClick={() => fetchLogs(logsApp)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-medium transition"
              >
                <RotateCcw size={12} /> Aktualisieren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
