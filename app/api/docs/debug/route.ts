import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/docs/debug — temporary diagnostic endpoint
// REMOVE THIS FILE once the 500 is resolved
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return NextResponse.json({
      ok: false,
      step: 'env',
      error: `Missing: ${!url ? 'NEXT_PUBLIC_SUPABASE_URL ' : ''}${!key ? 'SUPABASE_SERVICE_ROLE_KEY' : ''}`,
    })
  }

  try {
    const db = createClient(url, key)

    // Test 1: can we reach Supabase at all?
    const { error: pingErr } = await db.from('clients').select('id').limit(1)
    if (pingErr) {
      return NextResponse.json({ ok: false, step: 'ping_clients', error: pingErr.message, code: pingErr.code })
    }

    // Test 2: does the documents table exist?
    const { error: docsErr } = await db.from('documents').select('id').limit(1)
    if (docsErr) {
      return NextResponse.json({ ok: false, step: 'query_documents', error: docsErr.message, code: docsErr.code })
    }

    // Test 3: can we insert?
    const { data: inserted, error: insertErr } = await db
      .from('documents')
      .insert({ title: '__debug_test__' })
      .select('id')
      .single()
    if (insertErr) {
      return NextResponse.json({ ok: false, step: 'insert_documents', error: insertErr.message, code: insertErr.code })
    }

    // Clean up the test row
    await db.from('documents').delete().eq('id', inserted.id)

    return NextResponse.json({ ok: true, message: 'Documents table is reachable and writable' })
  } catch (err) {
    return NextResponse.json({ ok: false, step: 'exception', error: err instanceof Error ? err.message : String(err) })
  }
}
