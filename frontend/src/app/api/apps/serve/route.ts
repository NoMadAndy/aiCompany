import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  if (!slug) {
    return new NextResponse('Missing slug', { status: 400 })
  }

  try {
    const res = await query(
      'SELECT code, name, language FROM deployed_apps WHERE url_slug = $1 AND status = $2',
      [slug, 'active']
    )

    if (res.rows.length === 0) {
      return new NextResponse('App not found', { status: 404 })
    }

    const app = res.rows[0]

    return new NextResponse(app.code, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-App-Name': app.name,
      },
    })
  } catch (error: any) {
    return new NextResponse(`Error: ${error.message}`, { status: 500 })
  }
}
