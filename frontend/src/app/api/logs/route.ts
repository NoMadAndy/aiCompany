import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '100')
  const offset = parseInt(searchParams.get('offset') || '0')
  const type = searchParams.get('type')

  try {
    let sql = 'SELECT * FROM activity_log'
    const params: any[] = []

    if (type) {
      sql += ' WHERE type = $1'
      params.push(type)
    }

    sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2)
    params.push(limit, offset)

    const res = await query(sql, params)
    const countRes = await query('SELECT COUNT(*) as total FROM activity_log')

    return NextResponse.json({
      logs: res.rows,
      total: parseInt(countRes.rows[0]?.total || '0'),
    })
  } catch (error: any) {
    return NextResponse.json({ logs: [], total: 0, error: error.message })
  }
}
