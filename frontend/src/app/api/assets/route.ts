import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await query('SELECT * FROM assets ORDER BY created_at DESC')
    return NextResponse.json({ assets: res.rows })
  } catch {
    return NextResponse.json({ assets: [] })
  }
}
