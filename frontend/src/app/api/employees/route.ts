import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await query(`
      SELECT e.*,
        (SELECT COUNT(*) FROM tasks t WHERE t.employee_id = e.id) as total_tasks,
        (SELECT COUNT(*) FROM tasks t WHERE t.employee_id = e.id AND t.status = 'completed') as completed_tasks
      FROM employees e ORDER BY e.id
    `)
    return NextResponse.json({ employees: res.rows })
  } catch (error: any) {
    return NextResponse.json({ employees: [], error: error.message })
  }
}
