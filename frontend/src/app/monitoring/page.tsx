'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import StatusBar from '@/components/StatusBar'
import {
  Cpu, Activity, Server, Box, Brain,
  CheckCircle, XCircle, AlertTriangle, Clock, Zap,
  Users, FolderKanban, Play, Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface RecentTask {
  id: number
  title: string
  status: string
  model: string
  backend: string
  completed_at: string | null
  task_type: string
}

interface Metrics {
  ai: {
    claude_api: string
    local_model: string
    local_model_name: string
    gpu_available: boolean
    active_backend: string
  }
  gpu: {
    available: boolean
    device: string
    memory: string
    vram_used: string
    cuda_version: string
  }
  server: {
    cpu_percent: number
    memory_used_gb: number
    memory_total_gb: number
    uptime_hours: number
  }
  projects: Array<{
    id: number; name: string; status: string
    budget: number; spent: number
    tasks_total: number; tasks_completed: number
    tasks_running: number; tasks_failed: number
    progress: number
  }>
  agents: Array<{
    id: number; name: string; role: string; status: string
    tasks_total: number; tasks_completed: number
    tasks_failed: number; tasks_running: number
    success_rate: number
  }>
  containers: {
    running: number; stopped: number; error: number
    building: number; total: number; apps_total: number
  }
  model_usage: {
    claude: number; local: number; offline: number; unknown: number
    recent_tasks: RecentTask[]
  }
  timestamp: string
  error?: string
}

interface ApiTestResult {
  success: boolean
  response?: string
  model?: string
  latency_ms: number
  error?: string
  usage?: { input_tokens: number; output_tokens: number }
}

const AGENT_COLORS: Record<string, string> = {
  ARIA: 'text-purple-400',
  NEXUS: 'text-cyan-400',
  SCOUT: 'text-amber-400',
  FORGE: 'text-orange-400',
  VAULT: 'text-emerald-400',
}

const BACKEND_LABEL: Record<string, { label: string; color: string }> = {
  claude: { label: 'Claude API', color: 'bg-green-500/20 text-green-400' },
  local: { label: 'Lokal', color: 'bg-amber-500/20 text-amber-400' },
  offline: { label: 'Offline', color: 'bg-red-500/20 text-red-400' },
  unknown: { label: 'Unbekannt', color: 'bg-gray-500/20 text-gray-400' },
}

export default function MonitoringPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [apiTest, setApiTest] = useState<ApiTestResult | null>(null)
  const [apiTesting, setApiTesting] = useState(false)

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/monitoring')
      const data = await res.json()
      if (!data.error) {
        setMetrics(data)
        setLastUpdate(new Date().toLocaleTimeString('de-DE'))
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  const runApiTest = async () => {
    setApiTesting(true)
    setApiTest(null)
    try {
      const res = await fetch('/api/monitoring/test')
      const data = await res.json()
      setApiTest(data)
    } catch (e: any) {
      setApiTest({ success: false, error: e.message, latency_ms: 0 })
    } finally {
      setApiTesting(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 10000)
    return () => clearInterval(interval)
  }, [])

  const memPercent = metrics?.server
    ? Math.round((metrics.server.memory_used_gb / Math.max(metrics.server.memory_total_gb, 0.1)) * 100)
    : 0

  const vramUsed = metrics?.gpu?.vram_used ? parseFloat(metrics.gpu.vram_used) : 0
  const vramTotal = metrics?.gpu?.memory ? parseFloat(metrics.gpu.memory) : 8
  const vramPercent = Math.round((vramUsed / Math.max(vramTotal, 0.1)) * 100)

  const modelTotal = metrics?.model_usage
    ? metrics.model_usage.claude + metrics.model_usage.local + metrics.model_usage.offline + metrics.model_usage.unknown
    : 0

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar />
      <main className="flex-1 lg:ml-[240px] flex flex-col h-screen">
        <StatusBar />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                System Monitoring
              </h1>
              <p className="text-[var(--text-secondary)] text-sm mt-1">
                Echtzeit-Ueberwachung aller Systeme
              </p>
            </div>
            <div className="text-xs text-[var(--text-secondary)]">
              Letztes Update: {lastUpdate || '...'}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
            </div>
          ) : metrics ? (
            <>
              {/* AI Engine + GPU + Server Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* AI Engine */}
                <div className="glass rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Brain size={20} className="text-purple-400" />
                    <h2 className="font-semibold">KI-Engine</h2>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[var(--text-secondary)]">Aktives Backend</span>
                      <span className={cn('text-sm font-mono px-2 py-0.5 rounded',
                        metrics.ai.active_backend === 'claude' ? 'bg-green-500/20 text-green-400' :
                        metrics.ai.active_backend === 'local' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-red-500/20 text-red-400'
                      )}>
                        {metrics.ai.active_backend === 'claude' ? 'Claude API' :
                         metrics.ai.active_backend === 'local' ? 'Lokal' : 'Offline'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[var(--text-secondary)]">Claude API</span>
                      <span className={cn('text-sm',
                        metrics.ai.claude_api === 'available' ? 'text-green-400' : 'text-red-400'
                      )}>
                        {metrics.ai.claude_api === 'available' ? 'Verfuegbar' : 'Nicht konfiguriert'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[var(--text-secondary)]">Lokales Modell</span>
                      <span className="text-sm font-mono text-[var(--text-secondary)]">
                        {metrics.ai.local_model_name || metrics.ai.local_model}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[var(--text-secondary)]">GPU</span>
                      <span className={cn('text-sm', metrics.ai.gpu_available ? 'text-green-400' : 'text-red-400')}>
                        {metrics.ai.gpu_available ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </div>
                    {/* API Live-Test */}
                    <div className="pt-2 border-t border-[var(--border)]">
                      <button
                        onClick={runApiTest}
                        disabled={apiTesting}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm
                                   bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors
                                   disabled:opacity-50"
                      >
                        {apiTesting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                        {apiTesting ? 'Teste...' : 'API Live-Test'}
                      </button>
                      {apiTest && (
                        <div className={cn('mt-2 p-2 rounded text-xs font-mono',
                          apiTest.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                        )}>
                          {apiTest.success ? (
                            <>
                              <div>Antwort: {apiTest.response}</div>
                              <div>Modell: {apiTest.model}</div>
                              <div>Latenz: {apiTest.latency_ms}ms</div>
                              {apiTest.usage && (
                                <div>Tokens: {apiTest.usage.input_tokens} in / {apiTest.usage.output_tokens} out</div>
                              )}
                            </>
                          ) : (
                            <div>Fehler: {apiTest.error}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* GPU */}
                <div className="glass rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap size={20} className="text-amber-400" />
                    <h2 className="font-semibold">GPU</h2>
                  </div>
                  {metrics.gpu.available ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-[var(--text-secondary)]">Geraet</span>
                        <span className="text-sm font-mono">{metrics.gpu.device}</span>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-[var(--text-secondary)]">VRAM</span>
                          <span>{metrics.gpu.vram_used} / {metrics.gpu.memory}</span>
                        </div>
                        <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-500',
                              vramPercent > 80 ? 'bg-red-500' : vramPercent > 50 ? 'bg-amber-500' : 'bg-green-500'
                            )}
                            style={{ width: `${vramPercent}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-[var(--text-secondary)]">CUDA</span>
                        <span className="text-sm font-mono">{metrics.gpu.cuda_version}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-[var(--text-secondary)] py-4">
                      <Cpu size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Keine GPU verfuegbar</p>
                    </div>
                  )}
                </div>

                {/* Server */}
                <div className="glass rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Server size={20} className="text-cyan-400" />
                    <h2 className="font-semibold">Server</h2>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[var(--text-secondary)]">CPU</span>
                        <span>{metrics.server.cpu_percent}%</span>
                      </div>
                      <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500',
                            metrics.server.cpu_percent > 80 ? 'bg-red-500' :
                            metrics.server.cpu_percent > 50 ? 'bg-amber-500' : 'bg-cyan-500'
                          )}
                          style={{ width: `${Math.min(metrics.server.cpu_percent, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[var(--text-secondary)]">RAM</span>
                        <span>{metrics.server.memory_used_gb} / {metrics.server.memory_total_gb} GB</span>
                      </div>
                      <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500',
                            memPercent > 80 ? 'bg-red-500' : memPercent > 50 ? 'bg-amber-500' : 'bg-cyan-500'
                          )}
                          style={{ width: `${memPercent}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[var(--text-secondary)]">Uptime</span>
                      <span className="text-sm font-mono">
                        {metrics.server.uptime_hours > 24
                          ? `${Math.floor(metrics.server.uptime_hours / 24)}d ${Math.round(metrics.server.uptime_hours % 24)}h`
                          : `${metrics.server.uptime_hours}h`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Model Usage Stats + Container Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Model Usage */}
                <div className="glass rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Brain size={20} className="text-cyan-400" />
                    <h2 className="font-semibold">Modell-Nutzung (letzte 50 Tasks)</h2>
                  </div>
                  {modelTotal > 0 ? (
                    <div className="space-y-3">
                      {/* Bar chart */}
                      <div className="flex h-6 rounded-full overflow-hidden bg-[var(--bg-primary)]">
                        {metrics.model_usage.claude > 0 && (
                          <div
                            className="bg-green-500 flex items-center justify-center text-xs font-mono text-white"
                            style={{ width: `${(metrics.model_usage.claude / modelTotal) * 100}%` }}
                            title={`Claude: ${metrics.model_usage.claude}`}
                          >
                            {metrics.model_usage.claude > 2 && metrics.model_usage.claude}
                          </div>
                        )}
                        {metrics.model_usage.local > 0 && (
                          <div
                            className="bg-amber-500 flex items-center justify-center text-xs font-mono text-white"
                            style={{ width: `${(metrics.model_usage.local / modelTotal) * 100}%` }}
                            title={`Lokal: ${metrics.model_usage.local}`}
                          >
                            {metrics.model_usage.local > 2 && metrics.model_usage.local}
                          </div>
                        )}
                        {(metrics.model_usage.offline + metrics.model_usage.unknown) > 0 && (
                          <div
                            className="bg-gray-500 flex items-center justify-center text-xs font-mono text-white"
                            style={{ width: `${((metrics.model_usage.offline + metrics.model_usage.unknown) / modelTotal) * 100}%` }}
                          />
                        )}
                      </div>
                      <div className="flex gap-4 text-xs">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          Claude API: {metrics.model_usage.claude}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          Lokal: {metrics.model_usage.local}
                        </span>
                        {(metrics.model_usage.offline + metrics.model_usage.unknown) > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-gray-500" />
                            Andere: {metrics.model_usage.offline + metrics.model_usage.unknown}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">Noch keine Tasks mit Modell-Tracking</p>
                  )}
                </div>

                {/* Container Overview */}
                <div className="glass rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Box size={20} className="text-blue-400" />
                    <h2 className="font-semibold">Container & Apps</h2>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    <div className="text-center p-2 rounded-lg bg-[var(--bg-primary)]">
                      <div className="text-xl font-bold">{metrics.containers.apps_total}</div>
                      <div className="text-[10px] text-[var(--text-secondary)]">Gesamt</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-green-500/10">
                      <div className="text-xl font-bold text-green-400">{metrics.containers.running}</div>
                      <div className="text-[10px] text-green-400/70">Running</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-amber-500/10">
                      <div className="text-xl font-bold text-amber-400">{metrics.containers.stopped}</div>
                      <div className="text-[10px] text-amber-400/70">Stopped</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-blue-500/10">
                      <div className="text-xl font-bold text-blue-400">{metrics.containers.building}</div>
                      <div className="text-[10px] text-blue-400/70">Building</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-red-500/10">
                      <div className="text-xl font-bold text-red-400">{metrics.containers.error}</div>
                      <div className="text-[10px] text-red-400/70">Error</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Tasks with Model Info */}
              {metrics.model_usage.recent_tasks.length > 0 && (
                <div className="glass rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity size={20} className="text-cyan-400" />
                    <h2 className="font-semibold">Letzte Tasks — Modell-Zuordnung</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[var(--text-secondary)] border-b border-[var(--border)]">
                          <th className="text-left py-2 px-3">#</th>
                          <th className="text-left py-2 px-3">Task</th>
                          <th className="text-left py-2 px-3">Typ</th>
                          <th className="text-center py-2 px-3">Status</th>
                          <th className="text-left py-2 px-3">Modell</th>
                          <th className="text-left py-2 px-3">Backend</th>
                          <th className="text-right py-2 px-3">Zeit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.model_usage.recent_tasks.map(t => {
                          const b = BACKEND_LABEL[t.backend] || BACKEND_LABEL.unknown
                          return (
                            <tr key={t.id} className="border-b border-[var(--border)]/30 hover:bg-[var(--bg-hover)]">
                              <td className="py-2 px-3 text-[var(--text-secondary)] font-mono">{t.id}</td>
                              <td className="py-2 px-3 max-w-[250px] truncate">{t.title}</td>
                              <td className="py-2 px-3">
                                <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-secondary)]">
                                  {t.task_type || '-'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                {t.status === 'completed' ? (
                                  <CheckCircle size={14} className="inline text-green-400" />
                                ) : t.status === 'failed' ? (
                                  <XCircle size={14} className="inline text-red-400" />
                                ) : (
                                  <Clock size={14} className="inline text-amber-400" />
                                )}
                              </td>
                              <td className="py-2 px-3 font-mono text-xs">{t.model}</td>
                              <td className="py-2 px-3">
                                <span className={cn('text-xs px-2 py-0.5 rounded', b.color)}>
                                  {b.label}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right text-xs text-[var(--text-secondary)]">
                                {t.completed_at
                                  ? new Date(t.completed_at).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
                                  : '-'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Projects Progress */}
              <div className="glass rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FolderKanban size={20} className="text-blue-400" />
                  <h2 className="font-semibold">Projekt-Fortschritt</h2>
                </div>
                {metrics.projects.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">Keine Projekte vorhanden</p>
                ) : (
                  <div className="space-y-4">
                    {metrics.projects.map(p => (
                      <div key={p.id} className="p-3 rounded-lg bg-[var(--bg-primary)]">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{p.name}</span>
                            <span className={cn('text-xs px-2 py-0.5 rounded',
                              p.status === 'active' ? 'bg-green-500/20 text-green-400' :
                              p.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-gray-500/20 text-gray-400'
                            )}>{p.status}</span>
                          </div>
                          <span className="text-sm font-mono">{p.progress}%</span>
                        </div>
                        <div className="h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden mb-2">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all duration-500"
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                        <div className="flex gap-4 text-xs text-[var(--text-secondary)]">
                          <span className="flex items-center gap-1">
                            <CheckCircle size={12} className="text-green-400" />
                            {p.tasks_completed} erledigt
                          </span>
                          <span className="flex items-center gap-1">
                            <Activity size={12} className="text-cyan-400" />
                            {p.tasks_running} aktiv
                          </span>
                          <span className="flex items-center gap-1">
                            <XCircle size={12} className="text-red-400" />
                            {p.tasks_failed} fehlgeschlagen
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {p.tasks_total} gesamt
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Agent Performance */}
              <div className="glass rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Users size={20} className="text-purple-400" />
                  <h2 className="font-semibold">Agenten-Performance</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[var(--text-secondary)] border-b border-[var(--border)]">
                        <th className="text-left py-2 px-3">Agent</th>
                        <th className="text-left py-2 px-3">Rolle</th>
                        <th className="text-center py-2 px-3">Status</th>
                        <th className="text-center py-2 px-3">Erledigt</th>
                        <th className="text-center py-2 px-3">Aktiv</th>
                        <th className="text-center py-2 px-3">Fehler</th>
                        <th className="text-center py-2 px-3">Erfolgsrate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.agents.map(a => (
                        <tr key={a.id} className="border-b border-[var(--border)]/30 hover:bg-[var(--bg-hover)]">
                          <td className={cn('py-2 px-3 font-mono font-bold', AGENT_COLORS[a.name] || 'text-white')}>
                            {a.name}
                          </td>
                          <td className="py-2 px-3 text-[var(--text-secondary)]">{a.role}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={cn('inline-block w-2 h-2 rounded-full',
                              a.status === 'active' ? 'bg-green-400' : 'bg-gray-500'
                            )} />
                          </td>
                          <td className="py-2 px-3 text-center text-green-400">{a.tasks_completed}</td>
                          <td className="py-2 px-3 text-center text-cyan-400">{a.tasks_running}</td>
                          <td className="py-2 px-3 text-center text-red-400">{a.tasks_failed}</td>
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                                <div
                                  className={cn('h-full rounded-full',
                                    a.success_rate >= 80 ? 'bg-green-500' :
                                    a.success_rate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                  )}
                                  style={{ width: `${a.success_rate}%` }}
                                />
                              </div>
                              <span className="font-mono text-xs">{a.success_rate}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="glass rounded-xl p-8 text-center">
              <AlertTriangle size={32} className="mx-auto mb-3 text-amber-400" />
              <p className="text-[var(--text-secondary)]">Metriken konnten nicht geladen werden</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
