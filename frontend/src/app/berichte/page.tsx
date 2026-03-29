'use client'

import { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import StatusBar from '@/components/StatusBar'
import {
  ClipboardList, FileText, CheckCircle2, XCircle, Lightbulb, BarChart3,
  Bot, Clock, ChevronDown, ChevronUp, Sparkles, ArrowRight, Filter,
  FolderKanban, Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Summary {
  id: number
  project_id: number | null
  task_id: number | null
  type: 'project' | 'task'
  title: string
  content: string
  highlights: string[]
  metrics: Record<string, any>
  recommendations: string[]
  agent_contributions: Array<{ agent: string; task?: string; task_type?: string; status?: string }>
  generated_by_name: string
  project_name: string | null
  created_at: string
}

const typeConfig = {
  project: { icon: FolderKanban, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', label: 'Projektbericht' },
  task: { icon: Zap, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', label: 'Task-Bericht' },
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-[var(--text-primary)]">$1</strong>')
    .replace(/### (.*?)(\n|$)/g, '<h3 class="text-base font-semibold text-indigo-400 mt-3 mb-1">$1</h3>')
    .replace(/## (.*?)(\n|$)/g, '<h2 class="text-lg font-bold text-indigo-300 mt-4 mb-2">$1</h2>')
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-[var(--bg-primary)] rounded-lg p-3 my-2 overflow-x-auto text-xs"><code>$2</code></pre>')
    .replace(/`(.*?)`/g, '<code class="bg-[var(--bg-primary)] px-1.5 py-0.5 rounded text-indigo-300">$1</code>')
    .replace(/\n/g, '<br/>')
}

function SummaryCard({ summary, defaultExpanded = false }: { summary: Summary; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const config = typeConfig[summary.type] || typeConfig.task

  const agents = summary.agent_contributions || []
  const uniqueAgents = [...new Set(agents.map(a => a.agent))]

  return (
    <div className="glass rounded-xl overflow-hidden card-hover transition-all">
      {/* Header */}
      <div
        className="p-5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-4">
          {/* Type badge */}
          <div className={cn('p-2.5 rounded-xl border', config.color)}>
            <config.icon size={20} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full border', config.color)}>
                {config.label}
              </span>
              {summary.project_name && (
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  {summary.project_name}
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold leading-tight">{summary.title}</h3>
            <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-secondary)]">
              <span className="flex items-center gap-1">
                <Bot size={12} className="text-indigo-400" />
                {summary.generated_by_name || 'ARIA'}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatDate(summary.created_at)}
              </span>
              {uniqueAgents.length > 0 && (
                <span className="flex items-center gap-1">
                  <Sparkles size={12} className="text-amber-400" />
                  {uniqueAgents.length} Agent{uniqueAgents.length > 1 ? 'en' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Expand toggle */}
          <div className="shrink-0 p-1">
            {expanded ? <ChevronUp size={18} className="text-[var(--text-secondary)]" /> : <ChevronDown size={18} className="text-[var(--text-secondary)]" />}
          </div>
        </div>

        {/* Quick highlights (always visible) */}
        {!expanded && summary.highlights && summary.highlights.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.highlights.slice(0, 3).map((h, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                {h}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[var(--border)]">
          {/* Content */}
          <div className="p-5">
            <div
              className="text-sm text-[var(--text-secondary)] leading-relaxed prose-invert"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(summary.content) }}
            />
          </div>

          {/* Highlights */}
          {summary.highlights && summary.highlights.length > 0 && (
            <div className="px-5 pb-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 flex items-center gap-1.5">
                <Lightbulb size={12} className="text-amber-400" />
                Wichtigste Ergebnisse
              </h4>
              <div className="space-y-1.5">
                {summary.highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metrics */}
          {summary.metrics && Object.keys(summary.metrics).length > 0 && (
            <div className="px-5 pb-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 flex items-center gap-1.5">
                <BarChart3 size={12} className="text-blue-400" />
                Kennzahlen
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {Object.entries(summary.metrics).map(([key, value]) => (
                  <div key={key} className="p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-0.5">
                      {key.replace(/_/g, ' ')}
                    </div>
                    <div className="text-sm font-bold text-[var(--text-primary)]">
                      {typeof value === 'number' ? value.toLocaleString('de-DE') : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agent contributions */}
          {agents.length > 0 && (
            <div className="px-5 pb-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 flex items-center gap-1.5">
                <Bot size={12} className="text-indigo-400" />
                Beteiligte Agenten
              </h4>
              <div className="flex flex-wrap gap-2">
                {agents.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
                    <span className="font-semibold text-indigo-400">{a.agent}</span>
                    {a.task && (
                      <>
                        <ArrowRight size={10} className="text-[var(--text-tertiary)]" />
                        <span className="text-[var(--text-secondary)] truncate max-w-[200px]">{a.task}</span>
                      </>
                    )}
                    {a.status && (
                      <span className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        a.status === 'completed' ? 'bg-emerald-400' : a.status === 'failed' ? 'bg-red-400' : 'bg-yellow-400'
                      )} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {summary.recommendations && summary.recommendations.length > 0 && (
            <div className="px-5 pb-5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 flex items-center gap-1.5">
                <Sparkles size={12} className="text-purple-400" />
                Empfehlungen & Nächste Schritte
              </h4>
              <div className="space-y-1.5">
                {summary.recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <ArrowRight size={14} className="text-purple-400 mt-0.5 shrink-0" />
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function BerichtePage() {
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [filter, setFilter] = useState<'all' | 'project' | 'task'>('all')
  const [loading, setLoading] = useState(true)

  const loadSummaries = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('type', filter)
      params.set('limit', '50')
      const res = await fetch(`/api/summaries?${params}`)
      const data = await res.json()
      setSummaries(data.summaries || [])
    } catch (err) {
      console.error('Failed to load summaries:', err)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    loadSummaries()
    const interval = setInterval(loadSummaries, 10000)
    return () => clearInterval(interval)
  }, [loadSummaries])

  const projectSummaries = summaries.filter(s => s.type === 'project')
  const taskSummaries = summaries.filter(s => s.type === 'task')

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 lg:ml-[240px] overflow-y-auto">
          <div className="p-6 lg:p-8 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                  <ClipboardList className="text-indigo-400" />
                  <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    Berichte
                  </span>
                </h1>
                <p className="text-[var(--text-secondary)] mt-1">
                  Zusammenfassungen von ARIA nach Task- und Projektabschluss
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
                {(['all', 'project', 'task'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                      filter === f
                        ? 'bg-indigo-500/20 text-indigo-400'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    {f === 'all' ? 'Alle' : f === 'project' ? 'Projekte' : 'Tasks'}
                  </button>
                ))}
              </div>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="glass rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-indigo-400">{summaries.length}</div>
                <div className="text-xs text-[var(--text-secondary)]">Berichte gesamt</div>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-purple-400">{projectSummaries.length}</div>
                <div className="text-xs text-[var(--text-secondary)]">Projektberichte</div>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-blue-400">{taskSummaries.length}</div>
                <div className="text-xs text-[var(--text-secondary)]">Task-Berichte</div>
              </div>
            </div>

            {/* Summary list */}
            {loading ? (
              <div className="glass rounded-xl p-12 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-[var(--text-secondary)]">Lade Berichte...</p>
              </div>
            ) : summaries.length === 0 ? (
              <div className="glass rounded-xl p-12 text-center">
                <FileText size={48} className="mx-auto mb-4 text-[var(--text-tertiary)]" />
                <h3 className="text-lg font-semibold mb-2">Noch keine Berichte</h3>
                <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
                  Berichte werden automatisch von ARIA erstellt, nachdem ein Task oder Projekt abgeschlossen wurde.
                  Starte ein Projekt und übergib es an ARIA, um den ersten Bericht zu erhalten.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {summaries.map((s, i) => (
                  <SummaryCard key={s.id} summary={s} defaultExpanded={i === 0} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
