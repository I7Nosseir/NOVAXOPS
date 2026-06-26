import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.RESPOND_IO_WEBHOOK_SECRET
  if (!secret) return true // skip verification if secret not configured
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  const sig = signature.replace('sha256=', '')
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'))
  } catch {
    return false
  }
}

type RespondIoPayload = {
  event?: string
  data?: {
    contact?: { id?: string; name?: string; phone?: string; externalId?: string }
    message?: { id?: string; text?: string; type?: string; channel?: string; channelId?: string }
    contactId?: string
    channelId?: string
  }
}

/**
 * POST /api/webhooks/respond-io
 *
 * Receives incoming comment/DM events from Respond.io.
 * Upserts a moderation_item so it appears in the moderation queue.
 *
 * Configure in Respond.io: Settings → Webhooks → add this URL.
 * Event types we handle: message.created (inbound message)
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-respond-io-signature') ?? ''

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: RespondIoPayload
  try {
    payload = JSON.parse(rawBody) as RespondIoPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Only handle inbound messages
  if (payload.event !== 'message.created') {
    return NextResponse.json({ received: true, handled: false })
  }

  const contact = payload.data?.contact
  const message = payload.data?.message
  const channelId = payload.data?.channelId ?? message?.channelId ?? ''

  if (!message?.text || !contact) {
    return NextResponse.json({ received: true, handled: false })
  }

  // Determine platform from channel
  const channel = (message.channel ?? '').toLowerCase()
  const platform = channel.includes('instagram') ? 'instagram'
    : channel.includes('facebook') ? 'facebook'
    : channel.includes('linkedin') ? 'linkedin'
    : channel.includes('tiktok') ? 'tiktok'
    : channel.includes('twitter') ? 'twitter'
    : 'facebook'

  // Try to match to a client by respond_io_channel_id
  let client_id: string | null = null
  if (channelId) {
    const { data: clientRow } = await supabase
      .from('clients')
      .select('id')
      .eq('respond_io_channel_id', channelId)
      .single()
    if (clientRow) client_id = clientRow.id
  }

  if (!client_id) {
    return NextResponse.json({ error: 'Could not resolve client' }, { status: 422 })
  }

  const commenterName = contact.name ?? contact.externalId ?? 'Unknown'
  const commenterHandle = contact.externalId ?? contact.id ?? ''

  await supabase.from('moderation_items').upsert({
    client_id,
    platform,
    commenter_name: commenterName,
    commenter_handle: commenterHandle,
    comment_text: message.text,
    post_caption: '',
    status: 'pending',
    respond_io_contact_id: contact.id,
    respond_io_message_id: message.id,
  }, { onConflict: 'respond_io_message_id', ignoreDuplicates: true })

  return NextResponse.json({ received: true, handled: true })
}
