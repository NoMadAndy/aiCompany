import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const tasksRes = await query("SELECT COUNT(*) as count FROM tasks WHERE status IN ('pending', 'running')")
    return NextResponse.json({
      cpu: 0,
      gpu: 'RTX 2080S',
      tasks: parseInt(tasksRes.rows[0]?.count || '0'),
      uptime: process.uptime(),
      version: '0.1.0',
    })
  } catch {
    return NextResponse.json({ cpu: 0, gpu: 'unknown', tasks: 0, uptime: 0, version: '0.1.0' })
  }
}
