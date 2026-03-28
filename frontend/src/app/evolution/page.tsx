'use client'

import { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import StatusBar from '@/components/StatusBar'
import { useAuth } from '@/components/AuthProvider'
import {
  GitBranch, Check, X, RotateCcw, Clock, FileCode,
  ChevronDown, ChevronRight, Brain
} from 'lucide-react'

interface CodeChange {
  id: number
  proposed_by_name: string
  approved_by_name: string | null
  file_path: string
  description: string
  old_content: string | null
  new_content: string
  diff_summary: string | null
  status: string
  applied_at: string | null
  created_at: string
}

interface Memory {
  id: number
  employee_name: string
  category: string
  content: string
  context: string | null
  relevance_score: number
  times_used: number
  created_at: string
}

export default function EvolutionPage() {
  const { user } = useAuth()
  const [changes, setChanges] = useState<CodeChange[]>([])
  const [memories, setMemories] = useState<Memory[]>([])
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [filter, setFilter] = useState<string>('all')
  const [memoryTab, setMemoryTab] = useState(false)

  const loadChanges = useCallback(async () => {
    try {
      const url = filter === 'all' ? '/api/evolve' : `/api/evolve?status=${filter}`
      const res = await fetch(url)
      if (res.ok) setChanges(await res.json())
    } catch {}
  }, [filter])

  const loadMemories = useCallback(async () => {
    try {
      const res = await fetch('/api/memory')
      if (res.ok) {
        const data = await res.json()
        setMemories(data.memories || [])
      }
    } catch {}
  }, [])

  useEffect(() => { loadChanges() }, [loadChanges])
  useEffect(() => { if (memoryTab) loadMemories() }, [memoryTab, loadMemories])

  const handleAction = async (changeId: number, action: string) => {
    try {
      await fetch('/api/evolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change_id: changeId, action }),
      })
      loadChanges()
    } catch {}
  }

  const isAdmin = user?.role === 'admin'

  const statusColors: Record<string, string> = {
    proposed: 'bg-amber-500/10 text-amber-400',
    approved: 'bg-blue-500/10 text-blue-400',
    applied: 'bg-green-500/10 text-green-400',
    rejected: 'bg-red-500/10 text-red-400',
    rolled_back: 'bg-gray-500/10 text-gray-400',
  }

  const statusLabels: Record<string, string> = {
    proposed: 'Vorgeschlagen',
    approved: 'Genehmigt',
    applied: 'Angewendet',
    rejected: 'Abgelehnt',
    rolled_back: 'Zurückgesetzt',
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 lg:ml-[240px] overflow-y-auto">
          <div className="p-6 lg:p-8 max-w-5xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <GitBranch className="text-indigo-400" />
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Evolution
              </span>
            </h1>

            {/* Tab Toggle */}
            <div className="flex gap-1 mb-6 bg-[var(--bg-secondary)] rounded-lg p-1">
              <button
                onClick={() => setMemoryTab(false)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
                  !memoryTab ? 'bg-indigo-600 text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <FileCode size={16} /> Code-Änderungen
              </button>
              <button
                onClick={() => setMemoryTab(true)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
                  memoryTab ? 'bg-indigo-600 text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Brain size={16} /> Agent-Erinnerungen
              </button>
            </div>

            {!memoryTab ? (
              <>
                {/* Filter */}
                <div className="flex gap-2 mb-4 overflow-x-auto">
                  {['all', 'proposed', 'applied', 'rejected', 'rolled_back'].map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                        filter === f ? 'bg-indigo-600 text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      {f === 'all' ? 'Alle' : statusLabels[f] || f}
                    </button>
                  ))}
                </div>

                {/* Changes List */}
                <div className="space-y-3">
                  {changes.length === 0 ? (
                    <div className="glass rounded-xl p-8 text-center text-[var(--text-secondary)]">
                      <GitBranch size={48} className="mx-auto mb-3 opacity-30" />
                      <p>Noch keine Code-Änderungen vorgeschlagen.</p>
                      <p className="text-sm mt-2">ARIA wird Verbesserungen vorschlagen, sobald sie Muster erkennt.</p>
                    </div>
                  ) : (
                    changes.map(change => (
                      <div key={change.id} className="glass rounded-xl overflow-hidden">
                        <div
                          onClick={() => setExpanded(e => ({ ...e, [change.id]: !e[change.id] }))}
                          className="p-4 cursor-pointer hover:bg-[var(--bg-hover)] transition flex items-start gap-3"
                        >
                          {expanded[change.id] ? <ChevronDown size={18} className="mt-0.5 text-[var(--text-secondary)]" /> : <ChevronRight size={18} className="mt-0.5 text-[var(--text-secondary)]" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{change.description}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[change.status] || ''}`}>
                                {statusLabels[change.status] || change.status}
                              </span>
                            </div>
                            <div className="text-xs text-[var(--text-secondary)] mt-1 flex gap-3">
                              <span className="font-mono">{change.file_path}</span>
                              <span>von {change.proposed_by_name}</span>
                              <span>{new Date(change.created_at).toLocaleString('de')}</span>
                            </div>
                          </div>

                          {/* Actions */}
                          {isAdmin && change.status === 'proposed' && (
                            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => handleAction(change.id, 'approve')}
                                className="p-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition"
                                title="Genehmigen & Anwenden"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={() => handleAction(change.id, 'reject')}
                                className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                                title="Ablehnen"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          )}
                          {isAdmin && change.status === 'applied' && (
                            <div onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => handleAction(change.id, 'rollback')}
                                className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition"
                                title="Zurücksetzen"
                              >
                                <RotateCcw size={16} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Expanded: Diff */}
                        {expanded[change.id] && (
                          <div className="border-t border-[var(--border)] p-4 bg-[var(--bg-primary)]">
                            {change.diff_summary && (
                              <pre className="text-xs font-mono whitespace-pre-wrap text-[var(--text-secondary)] mb-3">
                                {change.diff_summary}
                              </pre>
                            )}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                              {change.old_content && (
                                <div>
                                  <div className="text-xs text-red-400 mb-1 font-medium">Vorher</div>
                                  <pre className="text-xs font-mono bg-red-500/5 border border-red-500/10 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap">
                                    {change.old_content.slice(0, 2000)}
                                    {change.old_content.length > 2000 && '\n...'}
                                  </pre>
                                </div>
                              )}
                              <div>
                                <div className="text-xs text-green-400 mb-1 font-medium">Nachher</div>
                                <pre className="text-xs font-mono bg-green-500/5 border border-green-500/10 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap">
                                  {change.new_content.slice(0, 2000)}
                                  {change.new_content.length > 2000 && '\n...'}
                                </pre>
                              </div>
                            </div>
                            {change.approved_by_name && (
                              <div className="text-xs text-[var(--text-secondary)] mt-3">
                                Genehmigt von {change.approved_by_name}
                                {change.applied_at && ` am ${new Date(change.applied_at).toLocaleString('de')}`}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              /* Agent Memories */
              <div className="space-y-3">
                {memories.length === 0 ? (
                  <div className="glass rounded-xl p-8 text-center text-[var(--text-secondary)]">
                    <Brain size={48} className="mx-auto mb-3 opacity-30" />
                    <p>Noch keine Erinnerungen gespeichert.</p>
                    <p className="text-sm mt-2">Agenten lernen aus jeder abgeschlossenen Aufgabe.</p>
                  </div>
                ) : (
                  memories.map(m => (
                    <div key={m.id} className="glass rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-indigo-400">{m.employee_name}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              m.category === 'learning' ? 'bg-green-500/10 text-green-400' :
                              m.category === 'mistake' ? 'bg-red-500/10 text-red-400' :
                              'bg-blue-500/10 text-blue-400'
                            }`}>
                              {m.category === 'learning' ? 'Erkenntnis' :
                               m.category === 'mistake' ? 'Fehler' : 'Muster'}
                            </span>
                          </div>
                          <p className="text-sm">{m.content}</p>
                          {m.context && (
                            <p className="text-xs text-[var(--text-secondary)] mt-1">Kontext: {m.context}</p>
                          )}
                        </div>
                        <div className="text-right text-xs text-[var(--text-secondary)] whitespace-nowrap">
                          <div>Score: {m.relevance_score.toFixed(1)}</div>
                          <div>{m.times_used}x genutzt</div>
                          <div className="mt-1">{new Date(m.created_at).toLocaleDateString('de')}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
