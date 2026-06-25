'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User as SupabaseUser } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { User, UserRole } from '@/lib/types'

interface AuthContextValue {
  /** Effective user — role is overridden when admin is in preview mode */
  user: User | null
  /** Always the actually signed-in user, unaffected by preview mode */
  realUser: User | null
  session: Session | null
  loading: boolean
  /** True when the signed-in user has not yet completed first-login onboarding */
  needsOnboarding: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  /** Admin-only: the role currently being previewed, or null */
  previewRole: UserRole | null
  /** Admin-only: set to a role to activate preview mode, null to exit */
  setPreviewRole: (role: UserRole | null) => void
  /** True when admin has an active role preview */
  isPreviewMode: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  realUser: null,
  session: null,
  loading: true,
  needsOnboarding: false,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  previewRole: null,
  setPreviewRole: () => {},
  isPreviewMode: false,
})

async function fetchProfile(authUser: SupabaseUser): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, department, initials, color, page_permissions, is_super_admin, organization_id')
    .eq('auth_id', authUser.id)
    .single()
  if (error || !data) return null
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role as UserRole,
    department: data.department,
    initials: data.initials,
    color: data.color,
    page_permissions: (data.page_permissions as string[] | null) ?? null,
    is_super_admin: (data as Record<string, unknown>).is_super_admin === true,
    organization_id: (data as Record<string, unknown>).organization_id as string | undefined,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [realUser, setRealUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  // True while a session exists but the DB profile hasn't resolved yet.
  // Prevents a flash of null-user content between getSession() and fetchProfile().
  const [profileLoading, setProfileLoading] = useState(false)
  const [previewRole, setPreviewRoleState] = useState<UserRole | null>(null)

  useEffect(() => {
    if (!supabase) {
      // Dev mode: no Supabase configured — use a mock admin so role preview works
      setRealUser({
        id: 'dev-admin',
        name: 'NOVAX Admin',
        email: 'admin@novax.agency',
        role: 'admin',
        department: 'creative',
        initials: 'NA',
        color: '#1B3D38',
      })
      setLoading(false)
      return
    }

    // Primary: resolve session once on mount.
    // getSession() is raced against a 7-second timeout — if the Supabase token-refresh
    // network call hangs (slow DNS, ISP issue, connection pool), the timeout resolves
    // with null so loading is never stuck forever.
    // Profile fetch is fire-and-forget for the same reason: a slow DB query on users
    // table must not block the loading gate.
    const sessionPromise = Promise.race([
      supabase.auth.getSession(),
      new Promise<{ data: { session: null } }>((resolve) =>
        setTimeout(() => resolve({ data: { session: null } }), 7000)
      ),
    ])

    sessionPromise
      .then(({ data: { session } }) => {
        setSession(session)
        if (session?.user) {
          setProfileLoading(true)
          fetchProfile(session.user)
            .then((profile) => setRealUser(profile))
            .catch(() => setRealUser(null))
            .finally(() => setProfileLoading(false))
        }
      })
      .catch((err) => {
        console.error('[auth] getSession failed:', err)
      })
      .finally(() => {
        setLoading(false)
      })

    // Secondary: react to subsequent auth changes only.
    // INITIAL_SESSION is already handled above — skipping it avoids a double
    // profile fetch race that can leave the app in an inconsistent state.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') return

        setSession(session)
        if (session?.user) {
          try {
            setRealUser(await fetchProfile(session.user))
          } catch {
            setRealUser(null)
          }
        } else {
          setRealUser(null)
          setPreviewRoleState(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: 'Not configured' }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    if (!supabase) return
    setPreviewRoleState(null)
    await supabase.auth.signOut()
  }

  const setPreviewRole = (role: UserRole | null) => {
    if (realUser?.role !== 'admin') return
    setPreviewRoleState(role)
  }

  const isPreviewMode = !!previewRole && realUser?.role === 'admin'

  const user: User | null = isPreviewMode && realUser
    ? { ...realUser, role: previewRole! }
    : realUser

  // Check both the DB profile flag and the Supabase auth metadata (set at invite time,
  // before the users table row exists)
  const needsOnboarding =
    realUser?.needs_onboarding === true ||
    session?.user?.user_metadata?.needs_onboarding === true

  return (
    <AuthContext.Provider value={{
      user,
      realUser,
      session,
      loading: loading || profileLoading,
      needsOnboarding,
      signIn,
      signOut,
      previewRole,
      setPreviewRole,
      isPreviewMode,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
