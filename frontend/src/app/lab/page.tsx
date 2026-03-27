'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import StatusBar from '@/components/StatusBar'
import { Beaker, Cpu, Zap, Play, Terminal, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function LabPage() {
  const [prompt, setPrompt] = useState('')
  const [output, setOutput] = useState<string[]>([])
  const [running, setRunning] = useState(false)

  const runExperiment = async () => {
    if (!prompt) return
    setRunning(true)
    setOutput(prev => [...prev, `> ${prompt}`, 'Starte Experiment...'])

    try {
      const res = await fetch('/api/lab/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      setOutput(prev => [...prev, data.result || data.error || 'Experiment abgeschlossen.'])
    } catch (e: any) {
      setOutput(prev => [...prev, `Fehler: ${e.message}`])
    }
    setRunning(false)
    setPrompt('')
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 lg:ml-[240px] overflow-y-auto">
          <div className="p-6 lg:p-8 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Beaker className="text-indigo-400" />
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                KI-Labor
              </span>
            </h1>
            <p className="text-[var(--text-secondary)] mb-8">
              Experimentiere mit KI-Modellen und GPU-beschleunigten Aufgaben
            </p>

            {/* GPU Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="glass rounded-xl p-4 flex items-center gap-3">
                <Cpu size={24} className="text-green-400" />
                <div>
                  <div className="text-sm font-medium">NVIDIA RTX 2080S</div>
                  <div className="text-xs text-[var(--text-secondary)]">8 GB VRAM</div>
                </div>
              </div>
              <div className="glass rounded-xl p-4 flex items-center gap-3">
                <Zap size={24} className="text-yellow-400" />
                <div>
                  <div className="text-sm font-medium">CUDA Ready</div>
                  <div className="text-xs text-[var(--text-secondary)]">PyTorch + Transformers</div>
                </div>
              </div>
              <div className="glass rounded-xl p-4 flex items-center gap-3">
                <Brain size={24} className="text-purple-400" />
                <div>
                  <div className="text-sm font-medium">FORGE Agent</div>
                  <div className="text-xs text-[var(--text-secondary)]">ML Engineer bereit</div>
                </div>
              </div>
            </div>

            {/* Terminal */}
            <div className="glass rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
                <Terminal size={16} className="text-indigo-400" />
                <span className="text-sm font-medium">KI-Labor Terminal</span>
                {running && <span className="ml-auto text-xs text-yellow-400 animate-pulse">Läuft...</span>}
              </div>

              <div className="bg-[var(--bg-primary)] p-4 font-mono text-sm min-h-[300px] max-h-[500px] overflow-y-auto">
                <div className="text-green-400 mb-2">AI Company KI-Labor v0.1.0</div>
                <div className="text-[var(--text-secondary)] mb-4">GPU: NVIDIA RTX 2080 Super | CUDA bereit</div>
                {output.map((line, i) => (
                  <div key={i} className={cn(
                    'py-0.5',
                    line.startsWith('>') ? 'text-indigo-400' :
                    line.startsWith('Fehler') ? 'text-red-400' : 'text-[var(--text-primary)]'
                  )}>
                    {line}
                  </div>
                ))}
              </div>

              <div className="flex items-center border-t border-[var(--border)]">
                <span className="px-3 text-indigo-400 font-mono text-sm">$</span>
                <input
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runExperiment()}
                  placeholder="Experiment oder Aufgabe eingeben..."
                  disabled={running}
                  className="flex-1 bg-transparent py-3 px-2 outline-none text-sm font-mono"
                />
                <button
                  onClick={runExperiment}
                  disabled={running}
                  className="px-4 py-3 text-indigo-400 hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <Play size={16} />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
