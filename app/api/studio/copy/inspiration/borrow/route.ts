// ============================================================
// POST /api/studio/copy/inspiration/borrow
//
// Marks a pin as "selected for reference" and records which
// structural element the copywriter wants to borrow.
// Updates pinterest_pins.user_rating = 'selected'.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  let body: { pin_id: string; element_borrowed: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { pin_id, element_borrowed } = body
  if (!pin_id) {
    return NextResponse.json({ error: 'pin_id is required' }, { status: 400 })
  }
  if (!element_borrowed) {
    return NextResponse.json({ error: 'element_borrowed is required' }, { status: 400 })
  }

  const supabase = db()

  const { error } = await supabase
    .from('pinterest_pins')
    .update({ user_rating: 'selected' })
    .eq('id', pin_id)

  if (error) {
    console.error('[borrow] pin update failed:', error.message)
    return NextResponse.json({ error: 'Failed to save reference' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
