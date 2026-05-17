import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

// Trim whitespace and strip any non-ASCII characters that would cause
// "String contains non ISO-8859-1 code point" in the browser fetch API
// when these values are sent as HTTP headers (apikey, Authorization).
function sanitizeEnvVar(value: string | undefined): string {
  return (value ?? '').trim().replace(/[^\x20-\x7E]/g, '')
}

const SUPABASE_URL = sanitizeEnvVar(process.env.NEXT_PUBLIC_SUPABASE_URL)
const SUPABASE_ANON_KEY = sanitizeEnvVar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// Only instantiate when env vars are present — avoids crashing during Next.js static build
export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null as unknown as ReturnType<typeof createBrowserClient>

export function createAdminClient() {
  return createClient(SUPABASE_URL, sanitizeEnvVar(process.env.SUPABASE_SERVICE_ROLE_KEY), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
