import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')

  try {
    let sql = 'SELECT t.*, e.name as employee_name FROM tasks t LEFT JOIN employees e ON t.employee_id = e.id'
    const params: any[] = []
    if (projectId) {
      sql += ' WHERE t.project_id = $1'
      params.push(parseInt(projectId))
    }
    sql += ' ORDER BY t.created_at DESC'
    const res = await query(sql, params)
    return NextResponse.json({ tasks: res.rows })
  } catch (error: any) {
    return NextResponse.json({ tasks: [], error: error.message })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { employee_id, title, description, project_id, priority } = body
    const res = await query(
      'INSERT INTO tasks (employee_id, title, description, project_id, priority, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [employee_id, title, description || '', project_id || null, priority || 5, 'pending']
    )

    await query(
      'INSERT INTO activity_log (type, message, project_id, employee_id) VALUES ($1, $2, $3, $4)',
      ['task', `Neue Aufgabe: "${title}"`, project_id || null, employee_id]
    )

    return NextResponse.json({ task: res.rows[0] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
