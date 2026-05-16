# Auth & Role System — Action Plan

> **Goal:** Build the login page, session middleware, real useAuth() from Supabase session, role-based UI enforcement, and wire the invite flow end-to-end.

---

## Current State Audit

### What exists
| Piece | Status |
|-------|--------|
| `useAuth()` hook | Exists — returns a hardcoded mock user |
| Invite user modal UI | Done — `components/settings/invite-user-modal.tsx` |
| Role checks in settings page | Done — `currentUser?.role === 'admin'` |
| `users` table in Supabase | Exists |
| `lib/supabase.ts` | Exists (Supabase client set up) |
| `lib/auth-context.tsx` | Exists |

### What is missing
| Piece | Status |
|-------|--------|
| `/login` page | Does not exist |
| `middleware.ts` | Unknown — not seen in codebase |
| `useAuth()` reads real Supabase session | Returns hardcoded mock user |
| Role enforcement in UI (Integrations tab hidden, vendor names masked) | Not enforced — all roles see everything |
| `useInviteUser()` hook | Does not exist |
| `/api/auth/invite` route | Does not exist |
| Password change / user profile | Not built |

---

## Phase 1 — Login Page

**File to create:** `app/login/page.tsx`

### Layout

- No sidebar, no header — standalone page
- NOVAX logo mark + "NOVAX Ops" wordmark centered
- Email + password fields
- "Sign In" button
- Error message display (invalid credentials)
- "Forgot password?" link → triggers Supabase `resetPasswordForEmail()`

### Logic

```ts
const { error } = await supabase.auth.signInWithPassword({ email, password })
if (error) setError(error.message)
else router.push('/dashboard')
```

### Files to create

| File | Purpose |
|------|---------|
| `app/login/page.tsx` | Login form |
| `app/login/layout.tsx` | Standalone layout (no sidebar) |

---

## Phase 2 — Session Middleware

**File to create:** `middleware.ts` (at project root, next to `next.config.ts`)

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => req.cookies.get(name)?.value, set: () => {}, remove: () => {} } }
  )

  const { data: { session } } = await supabase.auth.getSession()

  const isLoginPage = req.nextUrl.pathname === '/login'
  const isPublicApproval = req.nextUrl.pathname.startsWith('/approval/')
  const isApiRoute = req.nextUrl.pathname.startsWith('/api/')

  if (!session && !isLoginPage && !isPublicApproval && !isApiRoute) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (session && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
}
```

### Dependencies

```
npm install @supabase/ssr
```

---

## Phase 3 — Real useAuth()

**File:** `lib/auth-context.tsx`

### Current (mock)

The current auth context returns a hardcoded user from `USERS[0]` or similar.

### Replacement

```ts
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@/lib/types'

interface AuthState {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({ user: null, loading: true, signOut: async () => {} })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) fetchUser(session.user.id)
      else setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) fetchUser(session.user.id)
      else { setUser(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchUser(id: string) {
    const { data } = await supabase.from('users').select('*').eq('id', id).single()
    setUser(data ? mapUser(data) : null)
    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
```

### Sign out

Add a sign-out option to the sidebar user section or settings:

```ts
const { signOut } = useAuth()
// <button onClick={signOut}>Sign out</button>
```

---

## Phase 4 — Role Enforcement in UI

**Hide or mask features based on `user.role`.**

### Rules to enforce

| Feature | Condition to show |
|---------|------------------|
| Integrations tab in Settings | `user.role === 'admin'` |
| Real vendor names (Metricool, Respond.io, Higgsfield) | `user.role === 'admin' \|\| user.role === 'ceo'` |
| Audit log | `user.role === 'admin' \|\| user.role === 'ceo'` |
| AI cost data (dashboard + settings) | `['admin','ceo','creative_director'].includes(user.role)` |
| Invite member button | `user.role === 'admin'` |
| Client create/edit | `['admin','creative_director','account_manager'].includes(user.role)` |

### Helper function

**Add to `lib/utils.ts`:**

```ts
export function hasRole(user: User | null, roles: UserRole[]): boolean {
  if (!user) return false
  return roles.includes(user.role)
}
```

### Apply in components

**Settings page:**
```tsx
const { user } = useAuth()
// Hide Integrations tab:
{hasRole(user, ['admin']) && <TabsTrigger value="integrations">Integrations</TabsTrigger>}
```

**Vendor name masking:**
```tsx
const vendorName = hasRole(user, ['admin', 'ceo']) ? 'Metricool' : 'Scheduling Platform'
```

### Files to edit

| File | Change |
|------|--------|
| `app/(app)/settings/page.tsx` | Hide Integrations tab + audit log |
| `app/(app)/dashboard/page.tsx` | Hide AI cost if insufficient role |
| `components/layout/sidebar.tsx` | (Check if any nav items need role-gating) |
| `lib/utils.ts` | Add `hasRole()` helper |

---

## Phase 5 — Invite User Flow

**Wire the existing invite modal to a real API route.**

### New hook: `useInviteUser()`

**File to create:** `lib/hooks/use-users.ts` (add to existing)

```ts
export function useInviteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, role, department }: { email: string; role: UserRole; department: Department }) => {
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, department }),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
```

### API route

**File to create:** `app/api/auth/invite/route.ts`

```ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Use service role key to bypass RLS for admin operations
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  // Verify caller is admin
  const session = await getSessionFromRequest(req)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, role, department } = await req.json()

  // Invite via Supabase Auth (sends magic link email)
  const { data, error } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
    data: { role, department },  // stored in user metadata, synced to users table via trigger
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ user: data.user })
}
```

### Supabase trigger: auto-create users row on invite

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role, department, name, initials, color)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'copywriter'),
    COALESCE(NEW.raw_user_meta_data->>'department', 'creative'),
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    UPPER(LEFT(split_part(NEW.email, '@', 1), 2)),
    '#6366f1'  -- default color, user can change later
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Files to create / edit

| File | Change |
|------|--------|
| `lib/hooks/use-users.ts` | Add `useInviteUser()` |
| `app/api/auth/invite/route.ts` | Create |
| `components/settings/invite-user-modal.tsx` | Wire to `useInviteUser()` |
| Supabase SQL editor | Create trigger |

---

## Phase 6 — Password Reset & Profile

**Minimum viable user profile in Settings > Security tab.**

### Password reset flow

1. User clicks "Change Password" in Security tab.
2. Calls `supabase.auth.updateUser({ password: newPassword })`.
3. Shows success message.

### Profile fields editable

In Settings > Team tab, clicking your own row opens an edit modal:
- Display name
- Avatar color picker (from a palette of 10 colors)

These write to the `users` table directly via `useUpdateUser()` mutation.

---

## Build Order

```
Phase 1a  Create app/login/page.tsx
Phase 1b  Create app/login/layout.tsx

Phase 2a  npm install @supabase/ssr
Phase 2b  Create middleware.ts
Phase 2c  Test redirect to /login when not authenticated

Phase 3a  Rewrite lib/auth-context.tsx
Phase 3b  Test useAuth() returns real session user
Phase 3c  Add sign-out button to sidebar

Phase 4a  Add hasRole() to lib/utils.ts
Phase 4b  Enforce Integrations tab visibility
Phase 4c  Enforce vendor name masking
Phase 4d  Enforce AI cost visibility
Phase 4e  Enforce invite/client edit buttons

Phase 5a  Add useInviteUser() to use-users.ts
Phase 5b  Create /api/auth/invite/route.ts
Phase 5c  Run trigger SQL in Supabase
Phase 5d  Wire invite modal to useInviteUser()

Phase 6a  Password reset in Security tab
Phase 6b  Display name editing
```

---

## File Map

| File | Phase | Type |
|------|-------|------|
| `app/login/page.tsx` | 1 | Create |
| `app/login/layout.tsx` | 1 | Create |
| `middleware.ts` | 2 | Create |
| `lib/auth-context.tsx` | 3 | Edit |
| `lib/utils.ts` | 4 | Edit |
| `app/(app)/settings/page.tsx` | 4 | Edit |
| `app/(app)/dashboard/page.tsx` | 4 | Edit |
| `lib/hooks/use-users.ts` | 5 | Edit |
| `app/api/auth/invite/route.ts` | 5 | Create |
| `components/settings/invite-user-modal.tsx` | 5 | Edit |
| Supabase SQL editor | 5 | SQL |

---

## Scope Boundary

- **No OAuth / SSO** — email + password only.
- **No 2FA** — the Security tab shows a "2FA" status check but implementation is out of scope.
- **No per-client user assignment** — RLS is role-based, not client-assignment-based.
- **No session expiry UI** — Supabase handles token refresh silently; no "session expired" modal needed.
