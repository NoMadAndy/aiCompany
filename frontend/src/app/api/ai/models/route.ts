import { NextResponse } from 'next/server'

const WORKER_URL = process.env.WORKER_URL || 'http://worker:8080'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await fetch(`${WORKER_URL}/ai/models`, {
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    // Fallback-Modelle wenn Worker nicht erreichbar
    return NextResponse.json({
      models: [
        { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', tier: 'flagship' },
        { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', tier: 'balanced' },
        { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', tier: 'fast' },
      ],
      default: 'claude-sonnet-4-6',
      error: error.message,
    })
  }
}
