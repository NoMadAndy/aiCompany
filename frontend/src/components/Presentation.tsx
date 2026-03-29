'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ChevronLeft, ChevronRight, X, Maximize2, Minimize2, Play, Pause,
  Lightbulb, BarChart3, Bot, Sparkles, ArrowRight, CheckCircle2,
  FolderKanban, Monitor, Globe, Layers
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Summary {
  id: number
  project_id: number | null
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

interface Slide {
  type: 'title' | 'summary' | 'highlights' | 'metrics' | 'agents' | 'recommendations' | 'screenshots'
  title: string
  icon: any
}

const AGENT_COLORS: Record<string, string> = {
  ARIA: 'from-purple-500 to-indigo-600',
  NEXUS: 'from-cyan-500 to-blue-600',
  SCOUT: 'from-amber-500 to-orange-600',
  FORGE: 'from-red-500 to-rose-600',
  VAULT: 'from-emerald-500 to-green-600',
}

const APP_PAGES = [
  { name: 'Dashboard', path: '/', icon: Layers },
  { name: 'Projekte', path: '/projects', icon: FolderKanban },
  { name: 'Live-View', path: '/live', icon: Monitor },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export default function Presentation({ summary, onClose }: { summary: Summary; onClose: () => void }) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [autoPlay, setAutoPlay] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Build slides based on available data
  const slides: Slide[] = [
    { type: 'title', title: 'Titelfolie', icon: FolderKanban },
    { type: 'summary', title: 'Zusammenfassung', icon: Layers },
  ]

  if (summary.highlights && summary.highlights.length > 0) {
    slides.push({ type: 'highlights', title: 'Ergebnisse', icon: Lightbulb })
  }
  if (summary.metrics && Object.keys(summary.metrics).length > 0) {
    slides.push({ type: 'metrics', title: 'Kennzahlen', icon: BarChart3 })
  }
  if (summary.agent_contributions && summary.agent_contributions.length > 0) {
    slides.push({ type: 'agents', title: 'Team', icon: Bot })
  }
  if (summary.recommendations && summary.recommendations.length > 0) {
    slides.push({ type: 'recommendations', title: 'Empfehlungen', icon: Sparkles })
  }
  slides.push({ type: 'screenshots', title: 'App-Ansichten', icon: Monitor })

  const totalSlides = slides.length

  const goNext = useCallback(() => {
    setCurrentSlide(s => (s + 1) % totalSlides)
  }, [totalSlides])

  const goPrev = useCallback(() => {
    setCurrentSlide(s => (s - 1 + totalSlides) % totalSlides)
  }, [totalSlides])

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev() }
      if (e.key === 'Escape') onClose()
      if (e.key === 'f') {
        if (document.fullscreenElement) document.exitFullscreen()
        else containerRef.current?.requestFullscreen()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goNext, goPrev, onClose])

  // Auto-play
  useEffect(() => {
    if (!autoPlay) return
    const iv = setInterval(goNext, 6000)
    return () => clearInterval(iv)
  }, [autoPlay, goNext])

  // Fullscreen change
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else containerRef.current?.requestFullscreen()
  }

  const slide = slides[currentSlide]
  const uniqueAgents = [...new Set((summary.agent_contributions || []).map(a => a.agent))]

  const renderSlide = () => {
    switch (slide.type) {
      case 'title':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center px-12">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm mb-6">
                <FolderKanban size={16} />
                {summary.type === 'project' ? 'Projektbericht' : 'Task-Bericht'}
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-white via-indigo-200 to-purple-300 bg-clip-text text-transparent leading-tight mb-4">
                {summary.title}
              </h1>
              {summary.project_name && summary.project_name !== summary.title && (
                <p className="text-xl text-[var(--text-secondary)]">{summary.project_name}</p>
              )}
            </div>
            <div className="flex items-center gap-6 text-sm text-[var(--text-secondary)]">
              <span className="flex items-center gap-2">
                <Bot size={16} className="text-indigo-400" />
                Erstellt von {summary.generated_by_name || 'ARIA'}
              </span>
              <span>{formatDate(summary.created_at)}</span>
            </div>
            {uniqueAgents.length > 0 && (
              <div className="flex gap-3 mt-8">
                {uniqueAgents.map(agent => (
                  <div key={agent} className={cn(
                    'px-4 py-2 rounded-xl bg-gradient-to-r text-white font-semibold text-sm',
                    AGENT_COLORS[agent] || 'from-gray-500 to-gray-600'
                  )}>
                    {agent}
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      case 'summary':
        return (
          <div className="flex flex-col justify-center h-full px-12 md:px-20 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Zusammenfassung
            </h2>
            <div className="text-lg leading-relaxed text-[var(--text-secondary)] space-y-4">
              {summary.content.split('\n').filter(Boolean).map((paragraph, i) => (
                <p key={i} dangerouslySetInnerHTML={{
                  __html: paragraph
                    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                    .replace(/`(.*?)`/g, '<code class="bg-[rgba(99,102,241,0.15)] px-1.5 py-0.5 rounded text-indigo-300 text-base">$1</code>')
                }} />
              ))}
            </div>
          </div>
        )

      case 'highlights':
        return (
          <div className="flex flex-col justify-center h-full px-12 md:px-20 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-10 bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent flex items-center gap-3">
              <Lightbulb size={32} className="text-amber-400" />
              Wichtigste Ergebnisse
            </h2>
            <div className="space-y-6">
              {summary.highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-4 animate-fade-in" style={{ animationDelay: `${i * 200}ms` }}>
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30 flex items-center justify-center">
                    <CheckCircle2 size={20} className="text-emerald-400" />
                  </div>
                  <p className="text-xl leading-relaxed pt-1.5">{h}</p>
                </div>
              ))}
            </div>
          </div>
        )

      case 'metrics':
        return (
          <div className="flex flex-col justify-center h-full px-12 md:px-20">
            <h2 className="text-3xl font-bold mb-10 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-3">
              <BarChart3 size={32} className="text-blue-400" />
              Kennzahlen
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {Object.entries(summary.metrics).map(([key, value], i) => (
                <div
                  key={key}
                  className="glass rounded-2xl p-6 text-center animate-fade-in card-hover"
                  style={{ animationDelay: `${i * 150}ms` }}
                >
                  <div className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                    {typeof value === 'number' ? value.toLocaleString('de-DE') : String(value)}
                  </div>
                  <div className="text-sm text-[var(--text-secondary)] capitalize">
                    {key.replace(/_/g, ' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      case 'agents':
        return (
          <div className="flex flex-col justify-center h-full px-12 md:px-20">
            <h2 className="text-3xl font-bold mb-10 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center gap-3">
              <Bot size={32} className="text-purple-400" />
              Beteiligte Agenten
            </h2>
            <div className="space-y-4 max-w-4xl mx-auto w-full">
              {(summary.agent_contributions || []).map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 glass rounded-xl p-4 animate-fade-in"
                  style={{ animationDelay: `${i * 150}ms` }}
                >
                  <div className={cn(
                    'shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm',
                    AGENT_COLORS[a.agent] || 'from-gray-500 to-gray-600'
                  )}>
                    {a.agent.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-lg">{a.agent}</div>
                    {a.task && (
                      <div className="text-sm text-[var(--text-secondary)] truncate">{a.task}</div>
                    )}
                  </div>
                  {a.task_type && (
                    <span className="px-3 py-1 rounded-lg bg-[var(--bg-primary)] text-xs text-[var(--text-secondary)] border border-[var(--border)]">
                      {a.task_type}
                    </span>
                  )}
                  <div className={cn(
                    'w-3 h-3 rounded-full shrink-0',
                    a.status === 'completed' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                      : a.status === 'failed' ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]'
                      : 'bg-yellow-400'
                  )} />
                </div>
              ))}
            </div>
          </div>
        )

      case 'recommendations':
        return (
          <div className="flex flex-col justify-center h-full px-12 md:px-20 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-10 bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent flex items-center gap-3">
              <Sparkles size={32} className="text-purple-400" />
              Empfehlungen & Nächste Schritte
            </h2>
            <div className="space-y-5">
              {summary.recommendations.map((r, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 glass rounded-xl p-5 animate-fade-in"
                  style={{ animationDelay: `${i * 200}ms` }}
                >
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-violet-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-sm">
                    {i + 1}
                  </div>
                  <p className="text-lg leading-relaxed pt-0.5">{r}</p>
                </div>
              ))}
            </div>
          </div>
        )

      case 'screenshots':
        return (
          <div className="flex flex-col justify-center h-full px-12 md:px-20">
            <h2 className="text-3xl font-bold mb-8 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent flex items-center gap-3">
              <Monitor size={32} className="text-cyan-400" />
              App-Ansichten
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {APP_PAGES.map((page, i) => (
                <a
                  key={page.path}
                  href={page.path}
                  target="_blank"
                  rel="noopener"
                  className="group glass rounded-xl overflow-hidden animate-fade-in card-hover"
                  style={{ animationDelay: `${i * 150}ms` }}
                >
                  <div className="aspect-video bg-[var(--bg-primary)] relative overflow-hidden">
                    <iframe
                      src={page.path}
                      className="w-[200%] h-[200%] origin-top-left scale-50 pointer-events-none"
                      title={page.name}
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-secondary)] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="p-4 flex items-center gap-3">
                    <page.icon size={18} className="text-indigo-400" />
                    <span className="font-medium">{page.name}</span>
                    <Globe size={14} className="ml-auto text-[var(--text-tertiary)] group-hover:text-indigo-400 transition-colors" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] bg-[var(--bg-primary)] flex flex-col"
    >
      {/* Ambient gradient for presentation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/5 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/5 blur-[120px]" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg-hover)] transition">
            <X size={20} />
          </button>
          <span className="text-sm text-[var(--text-secondary)]">
            {summary.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoPlay(!autoPlay)}
            className={cn('p-2 rounded-lg transition', autoPlay ? 'bg-indigo-500/20 text-indigo-400' : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]')}
            title={autoPlay ? 'Autoplay stoppen' : 'Autoplay starten'}
          >
            {autoPlay ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition"
            title="Vollbild (F)"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {/* Slide content */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        {renderSlide()}
      </div>

      {/* Navigation */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 border-t border-[var(--border)]">
        <button
          onClick={goPrev}
          disabled={currentSlide === 0}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition',
            currentSlide === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[var(--bg-hover)]'
          )}
        >
          <ChevronLeft size={18} /> Zurück
        </button>

        {/* Slide dots */}
        <div className="flex items-center gap-2">
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all',
                i === currentSlide
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              )}
              title={s.title}
            >
              <s.icon size={12} />
              {i === currentSlide && <span>{s.title}</span>}
            </button>
          ))}
        </div>

        <button
          onClick={goNext}
          disabled={currentSlide === totalSlides - 1}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition',
            currentSlide === totalSlides - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[var(--bg-hover)]'
          )}
        >
          Weiter <ChevronRight size={18} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--border)]">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
          style={{ width: `${((currentSlide + 1) / totalSlides) * 100}%` }}
        />
      </div>
    </div>
  )
}
