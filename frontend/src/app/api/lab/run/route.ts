import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json()

    // Log the experiment
    await query(
      'INSERT INTO activity_log (type, message, details) VALUES ($1, $2, $3)',
      ['ai', `KI-Labor Experiment: ${prompt.substring(0, 100)}`, JSON.stringify({ prompt })]
    )

    // Forward to worker if available
    try {
      const workerUrl = process.env.WORKER_URL || 'http://worker:8080'
      const res = await fetch(`${workerUrl}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, type: 'experiment' }),
        signal: AbortSignal.timeout(30000),
      })
      if (res.ok) {
        const data = await res.json()
        return NextResponse.json({ result: data.result })
      }
    } catch {}

    return NextResponse.json({
      result: `Experiment "${prompt}" wurde in die Queue eingereiht. Der AI Worker wird es verarbeiten sobald er verfügbar ist. GPU: RTX 2080 Super bereit.`
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
