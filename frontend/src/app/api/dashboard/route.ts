import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [employeesRes, projectsRes, tasksRes, activitiesRes] = await Promise.all([
      query('SELECT id, name, role, status FROM employees ORDER BY id'),
      query('SELECT id, name, status, budget::float, spent::float FROM projects ORDER BY created_at DESC'),
      query("SELECT COUNT(*) as count FROM tasks WHERE status IN ('pending', 'running')"),
      query('SELECT id, type, message, created_at FROM activity_log ORDER BY created_at DESC LIMIT 20'),
    ])

    const totalBudget = projectsRes.rows.reduce((sum: number, p: any) => sum + (p.budget || 0), 0)

    return NextResponse.json({
      stats: {
        employees: employeesRes.rows.length,
        projects: projectsRes.rows.length,
        tasks: parseInt(tasksRes.rows[0]?.count || '0'),
        budget: totalBudget,
      },
      employees: employeesRes.rows,
      projects: projectsRes.rows,
      activities: activitiesRes.rows,
    })
  } catch (error: any) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({
      stats: { employees: 0, projects: 0, tasks: 0, budget: 0 },
      employees: [],
      projects: [],
      activities: [{ id: 0, type: 'error', message: `DB-Verbindung fehlgeschlagen: ${error.message}`, created_at: new Date().toISOString() }],
    })
  }
}
