import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

// Only instantiate when env vars are present — avoids crashing during Next.js static build
export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null as unknown as ReturnType<typeof createBrowserClient>

export function createAdminClient() {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
