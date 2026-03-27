'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import StatusBar from '@/components/StatusBar'
import { FileText, Plus, Check, AlertTriangle, Bug, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChangelogEntry {
  id: number
  version: string
  title: string
  description: string
  changes: Array<{ type: string; text: string }>
  created_at: string
}

const typeIcons: Record<string, any> = {
  added: { icon: Plus, color: 'text-green-400', bg: 'bg-green-500/10' },
  changed: { icon: Sparkles, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  fixed: { icon: Bug, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  removed: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
}

export default function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([])
  const [markdown, setMarkdown] = useState('')

  useEffect(() => {
    fetch('/api/changelog')
      .then(r => r.json())
      .then(data => {
        if (data.entries?.length) setEntries(data.entries)
        if (data.markdown) setMarkdown(data.markdown)
      })
  }, [])

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 lg:ml-[240px] overflow-y-auto">
          <div className="p-6 lg:p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <FileText className="text-indigo-400" />
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Changelog
              </span>
            </h1>
            <p className="text-[var(--text-secondary)] mb-8">
              Alle Änderungen an AI Company
            </p>

            {/* Timeline */}
            <div className="relative">
              <div className="absolute left-[19px] top-0 bottom-0 w-px bg-[var(--border)]" />

              {entries.map((entry) => (
                <div key={entry.id} className="relative pl-12 pb-10">
                  <div className="absolute left-2.5 w-4 h-4 rounded-full bg-indigo-500 border-4 border-[var(--bg-primary)] z-10" />
                  <div className="glass rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-sm font-mono font-semibold">
                        v{entry.version}
                      </span>
                      <span className="text-lg font-semibold">{entry.title}</span>
                      <span className="text-xs text-[var(--text-secondary)] ml-auto">
                        {new Date(entry.created_at).toLocaleDateString('de-DE')}
                      </span>
                    </div>
                    {entry.description && (
                      <p className="text-sm text-[var(--text-secondary)] mb-4">{entry.description}</p>
                    )}
                    <div className="space-y-2">
                      {(typeof entry.changes === 'string' ? JSON.parse(entry.changes) : entry.changes)?.map((change: any, i: number) => {
                        const t = typeIcons[change.type] || typeIcons.added
                        return (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <span className={cn('px-2 py-0.5 rounded text-xs font-medium', t.bg, t.color)}>
                              {change.type}
                            </span>
                            <span>{change.text}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}

              {entries.length === 0 && markdown && (
                <div className="glass rounded-xl p-6">
                  <pre className="whitespace-pre-wrap text-sm font-mono text-[var(--text-secondary)]">
                    {markdown}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
