/**
 * Bulk invite script — creates Supabase auth accounts + users rows for a list of people.
 *
 * Usage:
 *   npx tsx scripts/bulk-invite.ts
 *
 * Reads .env.local automatically. Outputs temp passwords to the console.
 * Each person gets an invite email via Resend (if configured).
 */

import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

// ─── Load .env.local ──────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnv()

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL          = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY!
const APP_URL               = process.env.NEXT_PUBLIC_APP_URL ?? 'https://perfumeexhibition.com'
const RESEND_API_KEY        = process.env.RESEND_API_KEY
const RESEND_FROM           = process.env.RESEND_FROM_ADDRESS ?? 'NOVAX Ops <noreply@perfumeexhibition.com>'

// Default page permissions — matches agency standard access profile (from invite modal)
const DEFAULT_PAGE_PERMISSIONS = [
  'clients', 'projects', 'publishing', 'approval',
  'assets', 'ai-image', 'creative-eval', 'docs', 'strategy-eval',
  'assistant', 'performance', 'workload', 'library', 'reports',
  'studio-media-buying', 'studio-copy',
]

// ─── People to invite ─────────────────────────────────────────────────────────
// Adjust `role` per person if needed. Default: copywriter.

type UserRole = 'admin' | 'ceo' | 'creative_director' | 'account_manager' | 'strategist' | 'copywriter' | 'designer' | 'social_manager'

const PEOPLE: { name: string; email: string; role: UserRole }[] = [
  { name: 'Mahmoud Ahmed',         email: 'mahmouddmooo19@gmail.com',    role: 'copywriter' },
  { name: 'Mohamed Hussien Elol',  email: 'mh1970912@gmail.com',         role: 'copywriter' },
  { name: 'Mohamed Helmi',         email: 'mo7amedmedhat357@gmail.com',   role: 'copywriter' },
  { name: 'Dina Elsharkawy',       email: 'dinaelsharkawy401@gmail.com',  role: 'copywriter' },
  { name: 'Hager Eljiar',          email: 'hagereljiar@gmail.com',        role: 'copywriter' },
  { name: 'Noura Mostafa',         email: 'nouramostafa288@gmail.com',    role: 'copywriter' },
  { name: 'Rania Mohamed',         email: 'raniamraf@gmail.com',          role: 'copywriter' },
  { name: 'Habeba Amr',            email: 'habebaamr238@gmail.com',       role: 'copywriter' },
  { name: 'Youssef Soliman',       email: 'youssefnader02@gmail.com',     role: 'copywriter' },
  { name: 'Muhammad Elshershaby',  email: 'elshershaby93@gmail.com',      role: 'copywriter' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEPT: Record<UserRole, string> = {
  admin: 'strategy', ceo: 'strategy', creative_director: 'creative',
  copywriter: 'creative', designer: 'creative',
  account_manager: 'accounts', strategist: 'strategy', social_manager: 'social',
}

const COLORS = ['#1B3D38', '#2A6B62', '#5BB4AE', '#7B5EA7', '#C45C2A', '#2563EB']

function genPassword(): string {
  return randomBytes(12).toString('base64url')
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

async function sendInviteEmail(to: string, name: string, role: string, tempPassword: string) {
  if (!RESEND_API_KEY) {
    console.log(`    [email skipped — no RESEND_API_KEY]`)
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: RESEND_FROM,
      to,
      subject: "You've been invited to NOVAX Ops",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <div style="background:#1B3D38;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:-0.5px;">NOVAX Ops</h1>
          </div>
          <p style="color:#334155;font-size:15px;">Hi ${name},</p>
          <p style="color:#334155;font-size:15px;">You've been added to the NOVAX Ops platform as <strong>${role.replace(/_/g, ' ')}</strong>. Here are your login credentials:</p>
          <div style="background:#EBF4F3;border:1px solid #9DCCC8;border-radius:10px;padding:20px;margin:20px 0;">
            <p style="margin:0 0 8px;color:#475569;font-size:13px;"><strong>Login URL:</strong><br/><a href="${APP_URL}/login" style="color:#1B3D38;">${APP_URL}/login</a></p>
            <p style="margin:0 0 8px;color:#475569;font-size:13px;"><strong>Email:</strong><br/>${to}</p>
            <p style="margin:0;color:#475569;font-size:13px;"><strong>Temporary Password:</strong><br/><code style="background:#fff;padding:4px 8px;border-radius:6px;font-size:14px;">${tempPassword}</code></p>
          </div>
          <p style="color:#64748b;font-size:13px;">You'll be prompted to set a new password on first login.</p>
        </div>
      `,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.log(`    [email failed: ${err}]`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log(`\nBulk inviting ${PEOPLE.length} people...\n`)

  const results: { name: string; email: string; password: string; status: string }[] = []

  for (const person of PEOPLE) {
    process.stdout.write(`  ${person.name} <${person.email}>... `)
    const tempPassword = genPassword()

    try {
      // 1. Create auth user via GoTrue (handles password hashing correctly)
      const { data: authData, error: authError } = await db.auth.admin.createUser({
        email: person.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          name: person.name,
          role: person.role,
          department: DEPT[person.role],
          needs_onboarding: true,
          page_permissions: DEFAULT_PAGE_PERMISSIONS,
        },
      })

      if (authError) {
        console.log(`SKIP — ${authError.message}`)
        results.push({ name: person.name, email: person.email, password: '(skipped)', status: authError.message })
        continue
      }

      // 2. Pre-create users row
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]
      await db.from('users').upsert(
        {
          auth_id:          authData.user.id,
          email:            person.email,
          name:             person.name,
          role:             person.role,
          department:       DEPT[person.role],
          initials:         initials(person.name),
          color,
          needs_onboarding: true,
          page_permissions: DEFAULT_PAGE_PERMISSIONS,
        },
        { onConflict: 'auth_id', ignoreDuplicates: false },
      )

      // 3. Send invite email
      await sendInviteEmail(person.email, person.name, person.role, tempPassword)

      console.log(`OK`)
      results.push({ name: person.name, email: person.email, password: tempPassword, status: 'created' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`ERROR — ${msg}`)
      results.push({ name: person.name, email: person.email, password: '(error)', status: msg })
    }
  }

  // ── Summary table ──────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────')
  console.log('CREDENTIALS (save these — passwords are not stored anywhere)')
  console.log('─────────────────────────────────────────────────────────────')
  for (const r of results) {
    console.log(`${r.status === 'created' ? '✓' : '✗'} ${r.name.padEnd(28)} ${r.email.padEnd(36)} ${r.password}`)
  }
  console.log('─────────────────────────────────────────────────────────────\n')
}

main().catch(err => { console.error(err); process.exit(1) })
