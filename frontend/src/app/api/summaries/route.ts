import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

const WORKER_URL = process.env.WORKER_URL || 'http://worker:8080'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')
  const type = searchParams.get('type')
  const limit = parseInt(searchParams.get('limit') || '20')

  try {
    // Try fetching from worker first (has richer data)
    try {
      const params = new URLSearchParams()
      if (projectId) params.set('project_id', projectId)
      if (type) params.set('type', type)
      params.set('limit', String(limit))

      const workerRes = await fetch(`${WORKER_URL}/summaries?${params}`, { cache: 'no-store' })
      if (workerRes.ok) {
        const data = await workerRes.json()
        return NextResponse.json(data)
      }
    } catch {
      // Worker unavailable, fall back to direct DB query
    }

    // Direct DB fallback
    let sql = `
      SELECT s.*, p.name as project_name, e.name as generated_by_name
      FROM summaries s
      LEFT JOIN projects p ON s.project_id = p.id
      LEFT JOIN employees e ON s.generated_by = e.id
      WHERE 1=1
    `
    const params: any[] = []
    let paramIdx = 1

    if (projectId) {
      sql += ` AND s.project_id = $${paramIdx++}`
      params.push(parseInt(projectId))
    }
    if (type) {
      sql += ` AND s.type = $${paramIdx++}`
      params.push(type)
    }
    sql += ` ORDER BY s.created_at DESC LIMIT $${paramIdx++}`
    params.push(limit)

    const res = await query(sql, params)
    return NextResponse.json({ summaries: res.rows, count: res.rows.length })
  } catch (error: any) {
    return NextResponse.json({ summaries: [], error: error.message })
  }
}
