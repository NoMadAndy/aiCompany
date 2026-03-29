import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await query(
      `SELECT a.id, a.task_id, a.project_id, a.name, a.description, a.language, a.status,
              a.url_slug, a.created_at, e.name as deployed_by_name, p.name as project_name
       FROM deployed_apps a
       LEFT JOIN employees e ON a.deployed_by = e.id
       LEFT JOIN projects p ON a.project_id = p.id
       WHERE a.status = 'active'
       ORDER BY a.created_at DESC`
    )
    return NextResponse.json({ apps: res.rows })
  } catch (error: any) {
    return NextResponse.json({ apps: [], error: error.message })
  }
}
