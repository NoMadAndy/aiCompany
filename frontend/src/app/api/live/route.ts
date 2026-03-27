import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Track last check time per session (simplified)
let lastCheck = new Date(Date.now() - 10000).toISOString()

export async function GET() {
  try {
    const res = await query(
      'SELECT type, message, details, created_at FROM activity_log WHERE created_at > $1 ORDER BY created_at DESC LIMIT 10',
      [lastCheck]
    )
    lastCheck = new Date().toISOString()

    return NextResponse.json({
      events: res.rows.map(r => ({
        type: r.type,
        message: r.message,
        data: r.details,
        timestamp: r.created_at,
      }))
    })
  } catch {
    return NextResponse.json({ events: [] })
  }
}
