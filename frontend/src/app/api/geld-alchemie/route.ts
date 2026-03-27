import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: any = {}
  try {
    body = await request.json()
    const workerUrl = process.env.WORKER_URL || 'http://worker:8080'
    const res = await fetch(`${workerUrl}/geld-alchemie/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    // Fallback simulation when worker is not available
    const startCapital = body?.start_capital || 100
    const results = []
    let capital = startCapital
    for (let week = 1; week <= 52; week++) {
      const growth = 1 + (Math.random() * 0.3 - 0.05)
      capital *= growth
      results.push({ week, capital: Math.round(capital * 100) / 100, target_pct: Math.round((capital / 100000) * 10000) / 100 })
      if (capital >= 100000) break
    }
    return NextResponse.json({
      results,
      final_capital: Math.round(capital * 100) / 100,
      reached_target: capital >= 100000,
      weeks_needed: results.length,
      strategy: 'mixed',
      note: 'Fallback-Simulation (Worker offline)',
    })
  }
}
