import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.CHATWOOT_WEBHOOK_SECRET
  if (!secret) return true
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  const incoming = signature.replace('sha256=', '')
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(incoming, 'hex'))
  } catch {
    return false
  }
}

// Maps Chatwoot channel type strings to our social_platform enum
function resolvePlatform(channelType: string): string {
  const t = channelType.toLowerCase()
  if (t.includes('instagram')) return 'instagram'
  if (t.includes('facebook'))  return 'facebook'
  if (t.includes('twitter'))   return 'twitter'
  if (t.includes('linkedin'))  return 'linkedin'
  if (t.includes('tiktok'))    return 'tiktok'
  if (t.includes('youtube'))   return 'youtube'
  return 'facebook' // safe fallback
}

type ChatwootPayload = {
  event?: string
  account?: { id?: number }
  // message_created payload
  id?: number
  content?: string
  message_type?: string  // 'incoming' | 'outgoing' | 'activity'
  inbox_id?: number
  conversation?: {
    id?: number
    inbox_id?: number
    channel?: string
    meta?: {
      sender?: { id?: number; name?: string; identifier?: string }
    }
  }
  sender?: { id?: number; name?: string; type?: string }
}

/**
 * POST /api/webhooks/chatwoot
 *
 * Receives inbound message events from our self-hosted Chatwoot instance.
 * Upserts a moderation_item so it appears in the moderation queue.
 *
 * Configure in Chatwoot: Settings → Integrations → Webhooks → Add new webhook.
 * Events: message_created, conversation_created
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-chatwoot-signature') ?? ''

  if (!verifySignature(rawBody, signature)) {
    console.error('[chatwoot-webhook] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: ChatwootPayload
  try {
    payload = JSON.parse(rawBody) as ChatwootPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Only handle inbound messages — skip outgoing echoes and activity events
  if (payload.event !== 'message_created') {
    return NextResponse.json({ received: true, handled: false })
  }
  if (payload.message_type !== 'incoming') {
    return NextResponse.json({ received: true, handled: false })
  }

  const messageText = payload.content?.trim()
  if (!messageText) {
    return NextResponse.json({ received: true, handled: false })
  }

  const chatwootMessageId     = payload.id
  const chatwootConversationId = payload.conversation?.id
  const chatwootInboxId       = payload.inbox_id ?? payload.conversation?.inbox_id
  const chatwootContactId     = payload.sender?.id ?? payload.conversation?.meta?.sender?.id
  const chatwootAccountId     = payload.account?.id ?? parseInt(process.env.CHATWOOT_ACCOUNT_ID ?? '0')

  const commenterName   = payload.sender?.name ?? payload.conversation?.meta?.sender?.name ?? 'Unknown'
  const commenterHandle = payload.conversation?.meta?.sender?.identifier ?? ''
  const channelType     = payload.conversation?.channel ?? ''
  const platform        = resolvePlatform(channelType)

  // Match client by chatwoot_inbox_id
  let client_id: string | null = null
  if (chatwootInboxId) {
    const { data: clientRow } = await supabase
      .from('clients')
      .select('id')
      .eq('chatwoot_inbox_id', chatwootInboxId)
      .single()
    if (clientRow) client_id = clientRow.id
  }

  // Fall back to first active client
  if (!client_id) {
    const { data: fallback } = await supabase
      .from('clients')
      .select('id')
      .eq('status', 'active')
      .limit(1)
      .single()
    if (fallback) client_id = fallback.id
  }

  if (!client_id) {
    console.error('[chatwoot-webhook] Could not resolve client for inbox_id:', chatwootInboxId)
    return NextResponse.json({ error: 'Could not resolve client' }, { status: 422 })
  }

  const { error } = await supabase.from('moderation_items').upsert({
    client_id,
    platform,
    commenter_name:          commenterName,
    commenter_handle:        commenterHandle,
    comment_text:            messageText,
    post_caption:            '',
    status:                  'pending',
    chatwoot_account_id:     chatwootAccountId,
    chatwoot_conversation_id: chatwootConversationId,
    chatwoot_message_id:     chatwootMessageId,
    chatwoot_contact_id:     chatwootContactId,
    chatwoot_inbox_id:       chatwootInboxId,
  }, { onConflict: 'chatwoot_message_id', ignoreDuplicates: true })

  if (error) {
    console.error('[chatwoot-webhook] Upsert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ received: true, handled: true })
}
