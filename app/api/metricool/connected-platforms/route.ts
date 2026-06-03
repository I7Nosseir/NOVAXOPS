import { NextRequest, NextResponse } from 'next/server'
import { CLIENTS } from '@/lib/mock-data'

const ALL_NETWORKS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'youtube']

async function resolveBlogId(clientId: string): Promise<string | null> {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
      const { data } = await supabase
        .from('clients')
        .select('metricool_blog_id')
        .eq('id', clientId)
        .single()
      if (data?.metricool_blog_id) return String(data.metricool_blog_id)
    } catch { /* fall through */ }
  }
  const mock = CLIENTS.find(c => c.id === clientId)
  return (mock as unknown as Record<string, unknown>)?.metricool_blog_id as string | null ?? null
}

export async function GET(req: NextRequest) {
  const clientId = new URL(req.url).searchParams.get('client_id')
  if (!clientId) {
    return NextResponse.json({ error: 'client_id required' }, { status: 400 })
  }

  // Metricool not configured — report all as available so the selector isn't blocked
  if (!process.env.METRICOOL_API_TOKEN || !process.env.METRICOOL_USER_ID) {
    return NextResponse.json({ connected: ALL_NETWORKS, disconnected: [], configured: false })
  }

  const blogId = await resolveBlogId(clientId)
  if (!blogId) {
    return NextResponse.json({ connected: [], disconnected: ALL_NETWORKS, configured: true })
  }

  try {
    const { getConnectedNetworks } = await import('@/lib/metricool')
    const connected    = await getConnectedNetworks(blogId)
    const disconnected = ALL_NETWORKS.filter(n => !connected.includes(n))
    return NextResponse.json({ connected, disconnected, configured: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Probe failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
