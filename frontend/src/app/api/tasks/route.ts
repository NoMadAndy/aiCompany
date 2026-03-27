import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

const WORKER_URL = process.env.WORKER_URL || 'http://worker:8080'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')
  const taskId = searchParams.get('task_id')

  try {
    if (taskId) {
      const res = await query(
        'SELECT t.*, e.name as employee_name FROM tasks t LEFT JOIN employees e ON t.employee_id = e.id WHERE t.id = $1',
        [parseInt(taskId)]
      )
      return NextResponse.json({ task: res.rows[0] || null })
    }

    let sql = 'SELECT t.*, e.name as employee_name FROM tasks t LEFT JOIN employees e ON t.employee_id = e.id'
    const params: any[] = []
    if (projectId) {
      sql += ' WHERE t.project_id = $1'
      params.push(parseInt(projectId))
    }
    sql += ' ORDER BY t.created_at DESC LIMIT 50'
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

    // Create task in DB
    const res = await query(
      'INSERT INTO tasks (employee_id, title, description, project_id, priority, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [employee_id, title, description || '', project_id || null, priority || 5, 'pending']
    )

    const task = res.rows[0]

    await query(
      'INSERT INTO activity_log (type, message, project_id, employee_id) VALUES ($1, $2, $3, $4)',
      ['task', `Neue Aufgabe: "${title}"`, project_id || null, employee_id]
    )

    // Trigger worker execution asynchronously
    try {
      await fetch(`${WORKER_URL}/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: task.id,
          action: title,
          employee_id: employee_id,
          project_id: project_id || null,
          params: {},
        }),
      })
    } catch (workerError: any) {
      // Worker might be unavailable - task stays pending, can be retried
      console.error('Worker trigger failed:', workerError.message)
      await query(
        'INSERT INTO activity_log (type, message) VALUES ($1, $2)',
        ['error', `Worker nicht erreichbar - Task #${task.id} wartet auf Verarbeitung`]
      )
    }

    return NextResponse.json({ task })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
