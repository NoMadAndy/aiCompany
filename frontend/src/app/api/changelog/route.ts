import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { readFileSync } from 'fs'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Try DB first
    const res = await query('SELECT * FROM changelog ORDER BY created_at DESC')
    if (res.rows.length > 0) {
      return NextResponse.json({ entries: res.rows })
    }
  } catch {}

  // Fallback to CHANGELOG.md
  try {
    const md = readFileSync('/app/CHANGELOG.md', 'utf-8')
    return NextResponse.json({ markdown: md })
  } catch {
    return NextResponse.json({ entries: [], markdown: '# Changelog\n\nNoch keine Einträge.' })
  }
}
