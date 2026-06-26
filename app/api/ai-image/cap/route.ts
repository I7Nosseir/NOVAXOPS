import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'

const DAILY_IMAGE_CAP = 50

export async function GET(_req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    )
    const { data: { user } } = await authClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ used: 0, limit: DAILY_IMAGE_CAP, remaining: DAILY_IMAGE_CAP })
    }

    const admin = createAdminClient()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { count } = await admin
      .from('api_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('service', 'gemini')
      .eq('endpoint', 'image_generation')
      .gte('created_at', todayStart.toISOString())

    const used = count ?? 0
    return NextResponse.json({
      used,
      limit: DAILY_IMAGE_CAP,
      remaining: Math.max(0, DAILY_IMAGE_CAP - used),
    })
  } catch {
    return NextResponse.json({ used: 0, limit: DAILY_IMAGE_CAP, remaining: DAILY_IMAGE_CAP })
  }
}
