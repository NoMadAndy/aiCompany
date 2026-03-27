import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'completed') as completed_tasks
      FROM projects p ORDER BY p.created_at DESC
    `)
    return NextResponse.json({ projects: res.rows })
  } catch (error: any) {
    return NextResponse.json({ projects: [], error: error.message })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, description, budget } = body
    const res = await query(
      'INSERT INTO projects (name, description, budget, owner_id) VALUES ($1, $2, $3, 1) RETURNING *',
      [name, description, budget || 0]
    )
    await query(
      'INSERT INTO activity_log (type, message, project_id) VALUES ($1, $2, $3)',
      ['project', `Neues Projekt "${name}" erstellt`, res.rows[0].id]
    )
    return NextResponse.json({ project: res.rows[0] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
