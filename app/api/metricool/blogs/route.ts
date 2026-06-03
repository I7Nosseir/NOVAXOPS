import { NextResponse } from 'next/server'
import { getBlogs } from '@/lib/metricool'

export async function GET() {
  if (!process.env.METRICOOL_API_TOKEN || !process.env.METRICOOL_USER_ID) {
    return NextResponse.json(
      { error: 'Metricool not configured — add METRICOOL_API_TOKEN and METRICOOL_USER_ID.' },
      { status: 503 }
    )
  }

  try {
    const blogs = await getBlogs()
    return NextResponse.json({ blogs })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch Metricool blogs'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
