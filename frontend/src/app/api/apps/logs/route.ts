import { NextResponse } from 'next/server'

const WORKER_URL = process.env.WORKER_URL || 'http://worker:8080'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const appId = searchParams.get('app_id')
  const tail = searchParams.get('tail') || '50'

  if (!appId) {
    return NextResponse.json({ error: 'app_id erforderlich' }, { status: 400 })
  }

  try {
    const res = await fetch(`${WORKER_URL}/apps/${appId}/logs?tail=${tail}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
