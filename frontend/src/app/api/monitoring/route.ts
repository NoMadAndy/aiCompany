import { NextResponse } from 'next/server'

const WORKER_URL = process.env.WORKER_URL || 'http://worker:8080'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await fetch(`${WORKER_URL}/system/metrics`, {
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
