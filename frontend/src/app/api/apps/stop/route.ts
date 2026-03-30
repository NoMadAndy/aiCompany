import { NextResponse } from 'next/server'

const WORKER_URL = process.env.WORKER_URL || 'http://worker:8080'

export async function POST(request: Request) {
  try {
    const { app_id } = await request.json()
    if (!app_id) {
      return NextResponse.json({ error: 'app_id erforderlich' }, { status: 400 })
    }

    const res = await fetch(`${WORKER_URL}/apps/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id }),
    })

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
