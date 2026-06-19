import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { reportError } from '@/lib/error-reporter'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const secret = request.headers.get('x-cron-secret') ?? new URL(request.url).searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    // Reset monthly org credits where reset_at has passed
    const { error: monthlyErr } = await supabase.rpc('reset_monthly_credits')
    if (monthlyErr) throw monthlyErr

    // Reset daily user credits where reset_today < today
    const { error: dailyErr } = await supabase.rpc('reset_daily_user_credits')
    if (dailyErr) throw dailyErr

    return NextResponse.json({ ok: true, reset_at: new Date().toISOString() })
  } catch (error) {
    await reportError({ route: '/api/cron/reset-credits', error, severity: 'error' })
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 })
  }
}
