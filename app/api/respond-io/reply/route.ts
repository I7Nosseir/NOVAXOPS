import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/respond-io/reply
 * Body: { moderation_item_id: string, reply_text: string }
 *
 * Sends a reply to a comment/DM via Respond.io API, then marks the moderation item as replied.
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

  const { data: item, error } = await supabase
    .from('moderation_items')
    .select('*')
    .eq('id', moderation_item_id)
    .single()

  if (error || !item) {
    return NextResponse.json({ error: 'Moderation item not found' }, { status: 404 })
  }

  const apiKey = process.env.RESPOND_IO_API_KEY
  if (!apiKey) {
    // Graceful degradation: mark as replied in DB even if Respond.io isn't configured
    await supabase.from('moderation_items').update({
      status: 'replied',
      final_reply: reply_text.trim(),
    }).eq('id', moderation_item_id)
    return NextResponse.json({ sent: false, reason: 'RESPOND_IO_API_KEY not configured — marked replied in DB only' })
  }

  // Respond.io v2: send message to a contact
  const contactId = item.respond_io_contact_id as string | undefined
  if (!contactId) {
    await supabase.from('moderation_items').update({
      status: 'replied',
      final_reply: reply_text.trim(),
    }).eq('id', moderation_item_id)
    return NextResponse.json({ sent: false, reason: 'No Respond.io contact ID — marked replied in DB only' })
  }

  // Note: Instagram public comment replies are NOT supported by Respond.io (Instagram API restriction).
  // Only DM replies and Facebook comment replies work.
  if (item.platform === 'instagram' && !String(item.commenter_handle ?? '').startsWith('@dm')) {
    await supabase.from('moderation_items').update({
      status: 'replied',
      final_reply: reply_text.trim(),
    }).eq('id', moderation_item_id)
    return NextResponse.json({ sent: false, reason: 'Instagram public comment replies are not supported via API. Marked as replied.' })
  }

  try {
    const respondRes = await fetch(`https://app.respond.io/api/v2/contact/${contactId}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        type: 'text',
        text: reply_text.trim(),
      }),
    })

    if (!respondRes.ok) {
      const errText = await respondRes.text().catch(() => `HTTP ${respondRes.status}`)
      return NextResponse.json({ error: `Respond.io error: ${errText}` }, { status: 502 })
    }

    await supabase.from('moderation_items').update({
      status: 'replied',
      final_reply: reply_text.trim(),
    }).eq('id', moderation_item_id)

    return NextResponse.json({ sent: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 })
  }
}
