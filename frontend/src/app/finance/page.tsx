'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import StatusBar from '@/components/StatusBar'
import { Wallet, TrendingUp, TrendingDown, PiggyBank, ArrowUpRight } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

export default function FinancePage() {
  const [data, setData] = useState<any>({ projects: [], assets: [] })

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/assets').then(r => r.json()),
    ]).then(([p, a]) => setData({ projects: p.projects || [], assets: a.assets || [] }))
  }, [])

  const totalBudget = data.projects.reduce((s: number, p: any) => s + (parseFloat(p.budget) || 0), 0)
  const totalSpent = data.projects.reduce((s: number, p: any) => s + (parseFloat(p.spent) || 0), 0)
  const totalAssets = data.assets.reduce((s: number, a: any) => s + (parseFloat(a.value) || 0), 0)

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 lg:ml-[240px] overflow-y-auto">
          <div className="p-6 lg:p-8 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
              <Wallet className="text-indigo-400" />
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Finanzen
              </span>
            </h1>

            {/* Overview cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="glass rounded-xl p-5">
                <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm mb-2">
                  <PiggyBank size={16} /> Gesamtbudget
                </div>
                <div className="text-2xl font-bold text-green-400">{formatCurrency(totalBudget)}</div>
              </div>
              <div className="glass rounded-xl p-5">
                <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm mb-2">
                  <TrendingDown size={16} /> Ausgaben
                </div>
                <div className="text-2xl font-bold text-red-400">{formatCurrency(totalSpent)}</div>
              </div>
              <div className="glass rounded-xl p-5">
                <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm mb-2">
                  <TrendingUp size={16} /> Verfügbar
                </div>
                <div className="text-2xl font-bold">{formatCurrency(totalBudget - totalSpent)}</div>
              </div>
            </div>

            {/* Budget per project */}
            <div className="glass rounded-xl p-5 mb-6">
              <h3 className="text-lg font-semibold mb-4">Budget pro Projekt</h3>
              <div className="space-y-4">
                {data.projects.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-4">
                    <span className="text-sm font-medium w-32 shrink-0">{p.name}</span>
                    <div className="flex-1 h-3 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                        style={{ width: `${p.budget > 0 ? Math.min((p.spent / p.budget) * 100, 100) : 0}%` }}
                      />
                    </div>
                    <span className="text-sm text-[var(--text-secondary)] w-40 text-right shrink-0">
                      {formatCurrency(parseFloat(p.spent) || 0)} / {formatCurrency(parseFloat(p.budget) || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Assets */}
            {data.assets.length > 0 && (
              <div className="glass rounded-xl p-5">
                <h3 className="text-lg font-semibold mb-4">Assets</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.assets.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-primary)]">
                      <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                        <ArrowUpRight size={18} className="text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{a.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{a.type}</p>
                      </div>
                      <span className="ml-auto font-semibold">{formatCurrency(parseFloat(a.value) || 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
