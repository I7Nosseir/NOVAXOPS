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
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  previewRole: null,
  setPreviewRole: () => {},
  isPreviewMode: false,
})

async function fetchProfile(authUser: SupabaseUser): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, department, initials, color')
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
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [realUser, setRealUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [previewRole, setPreviewRoleState] = useState<UserRole | null>(null)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) setRealUser(await fetchProfile(session.user))
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_, session) => {
        setSession(session)
        if (session?.user) {
          setRealUser(await fetchProfile(session.user))
        } else {
          setRealUser(null)
          setPreviewRoleState(null)
        }
        setLoading(false)
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

  return (
    <AuthContext.Provider value={{
      user,
      realUser,
      session,
      loading,
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
