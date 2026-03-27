import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

const WORKER_URL = process.env.WORKER_URL || 'http://worker:8080'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { project_id } = body

    if (!project_id) {
      return NextResponse.json({ error: 'project_id required' }, { status: 400 })
    }

    // Verify project exists
    const project = await query('SELECT id, name, status FROM projects WHERE id = $1', [project_id])
    if (project.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Log delegation
    await query(
      'INSERT INTO activity_log (type, message, project_id, employee_id) VALUES ($1, $2, $3, $4)',
      ['project', `Projekt "${project.rows[0].name}" an ARIA (Koordinator) übergeben`, project_id, 1]
    )

    // Trigger worker coordination
    try {
      const workerRes = await fetch(`${WORKER_URL}/coordinate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id }),
      })
      const workerData = await workerRes.json()
      return NextResponse.json({ status: 'coordinating', ...workerData })
    } catch (workerError: any) {
      return NextResponse.json(
        { error: 'Worker nicht erreichbar', details: workerError.message },
        { status: 503 }
      )
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
