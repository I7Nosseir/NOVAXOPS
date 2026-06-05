import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/chatwoot/reply
 * Body: { moderation_item_id: string, reply_text: string }
 *
 * Sends an outgoing reply via Chatwoot's REST API, then marks the
 * moderation item as replied in Supabase.
 *
 * Chatwoot API: POST /api/v1/accounts/{account_id}/conversations/{conversation_id}/messages
 */
export async function POST(req: NextRequest) {
  let body: { moderation_item_id?: string; reply_text?: string }
  try {
    body = await req.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { moderation_item_id, reply_text } = body
  if (!moderation_item_id || !reply_text?.trim()) {
    return NextResponse.json({ error: 'moderation_item_id and reply_text required' }, { status: 400 })
  }

  const { data: item, error: fetchError } = await supabase
    .from('moderation_items')
    .select('*')
    .eq('id', moderation_item_id)
    .single()

  if (fetchError || !item) {
    return NextResponse.json({ error: 'Moderation item not found' }, { status: 404 })
  }

  const baseUrl    = process.env.CHATWOOT_BASE_URL
  const accountId  = process.env.CHATWOOT_ACCOUNT_ID
  const apiToken   = process.env.CHATWOOT_API_TOKEN
  const conversationId = item.chatwoot_conversation_id as number | undefined

  // Graceful degradation: if Chatwoot isn't configured, mark replied in DB only
  if (!baseUrl || !accountId || !apiToken) {
    await supabase.from('moderation_items').update({
      status:      'replied',
      final_reply: reply_text.trim(),
      resolved_at: new Date().toISOString(),
    }).eq('id', moderation_item_id)
    return NextResponse.json({ sent: false, reason: 'Chatwoot not configured — marked replied in DB only' })
  }

  if (!conversationId) {
    await supabase.from('moderation_items').update({
      status:      'replied',
      final_reply: reply_text.trim(),
      resolved_at: new Date().toISOString(),
    }).eq('id', moderation_item_id)
    return NextResponse.json({ sent: false, reason: 'No chatwoot_conversation_id — marked replied in DB only' })
  }

  try {
    const chatwootRes = await fetch(
      `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'api_access_token': apiToken,
        },
        body: JSON.stringify({
          content:      reply_text.trim(),
          message_type: 'outgoing',
          private:      false,
        }),
      }
    )

    if (!chatwootRes.ok) {
      const errText = await chatwootRes.text().catch(() => `HTTP ${chatwootRes.status}`)
      console.error('[chatwoot-reply] Chatwoot API error:', errText)
      return NextResponse.json({ error: `Chatwoot error: ${errText}` }, { status: 502 })
    }

    await supabase.from('moderation_items').update({
      status:      'replied',
      final_reply: reply_text.trim(),
      resolved_at: new Date().toISOString(),
    }).eq('id', moderation_item_id)

    return NextResponse.json({ sent: true })
  } catch (err) {
    console.error('[chatwoot-reply] Network error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 })
  }
}
