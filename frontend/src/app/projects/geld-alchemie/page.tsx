'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import StatusBar from '@/components/StatusBar'
import { Flame, Play, BarChart3, TrendingUp, Zap, Target, Coins, RefreshCw } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

interface SimResult {
  week: number
  capital: number
  target_pct: number
}

interface SimData {
  results: SimResult[]
  final_capital: number
  reached_target: boolean
  weeks_needed: number
  strategy: string
  note?: string
}

const strategies = [
  { id: 'compound', name: 'Compound Growth', desc: 'Exponentielles Wachstum durch Reinvestition', icon: TrendingUp, color: 'from-green-500 to-emerald-500' },
  { id: 'arbitrage', name: 'Digital Arbitrage', desc: 'Preisunterschiede auf digitalen Märkten nutzen', icon: Zap, color: 'from-blue-500 to-cyan-500' },
  { id: 'content', name: 'KI-Content', desc: 'KI-generierte Inhalte verkaufen', icon: Coins, color: 'from-purple-500 to-pink-500' },
  { id: 'mixed', name: 'Hybrid-Strategie', desc: 'Alle Methoden kombiniert', icon: Flame, color: 'from-orange-500 to-red-500' },
]

export default function GeldAlchemiePage() {
  const [selectedStrategy, setSelectedStrategy] = useState('mixed')
  const [simData, setSimData] = useState<SimData | null>(null)
  const [running, setRunning] = useState(false)
  const [mode, setMode] = useState<'simulation' | 'real'>('simulation')

  const runSimulation = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/geld-alchemie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_capital: 100,
          target: 100000,
          weeks: 104,
          strategy: selectedStrategy,
        }),
      })
      const data = await res.json()
      setSimData(data)
    } catch (e) {
      console.error(e)
    }
    setRunning(false)
  }

  const maxCapital = simData ? Math.max(...simData.results.map(r => r.capital)) : 0
  const chartHeight = 250

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 lg:ml-[240px] overflow-y-auto">
          <div className="p-6 lg:p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Flame className="text-orange-400" />
                <span className="bg-gradient-to-r from-orange-400 via-red-400 to-pink-400 bg-clip-text text-transparent">
                  GeldAlchemie
                </span>
              </h1>
              <p className="text-[var(--text-secondary)] mt-1">
                Verwandle 100€ in 100.000€ mit KI-gestützten Strategien
              </p>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setMode('simulation')}
                className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  mode === 'simulation' ? 'bg-indigo-500 text-white' : 'glass hover:bg-[var(--bg-hover)]'
                )}
              >
                Simulation
              </button>
              <button
                onClick={() => setMode('real')}
                className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  mode === 'real' ? 'bg-red-500 text-white' : 'glass hover:bg-[var(--bg-hover)]'
                )}
              >
                Real-Modus
              </button>
            </div>

            {/* Strategy Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {strategies.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStrategy(s.id)}
                  className={cn(
                    'glass rounded-xl p-4 text-left transition-all duration-300',
                    selectedStrategy === s.id && 'ring-2 ring-indigo-500 glow-accent'
                  )}
                >
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br text-white mb-3', s.color)}>
                    <s.icon size={20} />
                  </div>
                  <div className="font-semibold text-sm">{s.name}</div>
                  <div className="text-xs text-[var(--text-secondary)] mt-1">{s.desc}</div>
                </button>
              ))}
            </div>

            {/* Run Button */}
            <button
              onClick={runSimulation}
              disabled={running}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 mb-8',
                running ? 'bg-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-lg shadow-indigo-500/25'
              )}
            >
              {running ? <RefreshCw size={18} className="animate-spin" /> : <Play size={18} />}
              {running ? 'Simuliere...' : 'Simulation starten'}
            </button>

            {/* Results */}
            {simData && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                  <div className="glass rounded-xl p-4">
                    <div className="text-xs text-[var(--text-secondary)] mb-1">Startkapital</div>
                    <div className="text-xl font-bold">{formatCurrency(100)}</div>
                  </div>
                  <div className="glass rounded-xl p-4">
                    <div className="text-xs text-[var(--text-secondary)] mb-1">Endkapital</div>
                    <div className={cn('text-xl font-bold', simData.reached_target ? 'text-green-400' : 'text-yellow-400')}>
                      {formatCurrency(simData.final_capital)}
                    </div>
                  </div>
                  <div className="glass rounded-xl p-4">
                    <div className="text-xs text-[var(--text-secondary)] mb-1">Ziel erreicht?</div>
                    <div className={cn('text-xl font-bold', simData.reached_target ? 'text-green-400' : 'text-red-400')}>
                      {simData.reached_target ? 'JA!' : 'Nein'}
                    </div>
                  </div>
                  <div className="glass rounded-xl p-4">
                    <div className="text-xs text-[var(--text-secondary)] mb-1">Dauer</div>
                    <div className="text-xl font-bold">{simData.weeks_needed} Wochen</div>
                  </div>
                </div>

                {/* Chart */}
                <div className="glass rounded-xl p-5 mb-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 size={18} className="text-indigo-400" />
                    Kapitalentwicklung
                  </h3>
                  <div className="relative" style={{ height: chartHeight + 40 }}>
                    {/* Target line */}
                    {maxCapital > 100000 && (
                      <div
                        className="absolute left-0 right-0 border-t border-dashed border-green-500/50"
                        style={{ bottom: `${(100000 / maxCapital) * chartHeight + 20}px` }}
                      >
                        <span className="absolute right-0 -top-4 text-xs text-green-400">100.000€</span>
                      </div>
                    )}
                    {/* Bars */}
                    <div className="flex items-end gap-px h-full pt-5 pb-5">
                      {simData.results.map((r, i) => {
                        const height = maxCapital > 0 ? (r.capital / maxCapital) * chartHeight : 0
                        const color = r.capital >= 100000 ? 'bg-green-500' :
                          r.capital >= 10000 ? 'bg-indigo-500' :
                          r.capital >= 1000 ? 'bg-purple-500' : 'bg-blue-500'
                        return (
                          <div
                            key={i}
                            className="flex-1 group relative"
                            style={{ height: chartHeight }}
                          >
                            <div
                              className={cn('absolute bottom-0 left-0 right-0 rounded-t transition-all duration-200 opacity-80 hover:opacity-100', color)}
                              style={{ height: Math.max(height, 1) }}
                            />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                              <div className="glass rounded px-2 py-1 text-xs whitespace-nowrap">
                                W{r.week}: {formatCurrency(r.capital)}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex justify-between text-xs text-[var(--text-secondary)] mt-1">
                      <span>Woche 1</span>
                      <span>Woche {simData.results.length}</span>
                    </div>
                  </div>
                </div>

                {/* Strategy details */}
                <div className="glass rounded-xl p-5">
                  <h3 className="text-lg font-semibold mb-3">Strategie-Details</h3>
                  <div className="text-sm text-[var(--text-secondary)] space-y-2">
                    <p><strong>Strategie:</strong> {strategies.find(s => s.id === simData.strategy)?.name || simData.strategy}</p>
                    <p><strong>Wachstumsfaktor:</strong> {(simData.final_capital / 100).toFixed(0)}x</p>
                    <p><strong>Durchschnittliches Wochenwachstum:</strong> {((Math.pow(simData.final_capital / 100, 1 / simData.weeks_needed) - 1) * 100).toFixed(1)}%</p>
                    {simData.note && <p className="text-yellow-400"><strong>Hinweis:</strong> {simData.note}</p>}
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
