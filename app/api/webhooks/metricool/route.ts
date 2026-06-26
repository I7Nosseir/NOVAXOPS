import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/webhooks/metricool
 *
 * Receives publish-confirmation events from Metricool.
 * Configure this URL in Metricool Settings → Webhooks.
 *
 * Handled events:
 *   post_published — mark post as published, record published_at
 *   post_failed    — mark post as failed
 *
 * Metricool sends no webhook secret by default. If you configure one,
 * add METRICOOL_WEBHOOK_SECRET to env and verify it here.
 */
export async function POST(req: NextRequest) {
  // Validate webhook secret if configured
  const webhookSecret = process.env.METRICOOL_WEBHOOK_SECRET
  if (webhookSecret) {
    const incomingSecret = req.headers.get('x-webhook-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
    if (incomingSecret !== webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { event, postId, publishedAt } = body as {
    event?: string
    postId?: string
    publishedAt?: string
  }

  if (!postId) {
    // Not a post event — acknowledge and ignore
    return NextResponse.json({ received: true })
  }

  if (event === 'post_published') {
    const { error } = await supabase
      .from('scheduled_posts')
      .update({
        status: 'published',
        published_at: publishedAt ?? new Date().toISOString(),
      })
      .eq('metricool_post_id', postId)

    if (error) {
      console.error('[metricool webhook] DB update failed:', error.message)
      return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
    }
  }

  if (event === 'post_failed') {
    await supabase
      .from('scheduled_posts')
      .update({ status: 'failed' })
      .eq('metricool_post_id', postId)
  }

  return NextResponse.json({ received: true })
}
