'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { Organization, OrgBranding } from '@/lib/types'
import { DEFAULT_ORG_BRANDING } from '@/lib/types'

interface OrgContextValue {
  org: Organization | null
  branding: OrgBranding
  loading: boolean
}

const OrgContext = createContext<OrgContextValue>({
  org: null,
  branding: DEFAULT_ORG_BRANDING,
  loading: true,
})

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user?.organization_id) {
      setLoading(false)
      return
    }

    supabase
      .from('organizations')
      .select('*')
      .eq('id', user.organization_id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setOrg(data as Organization)
        setLoading(false)
      })
  }, [user?.organization_id, authLoading])

  const branding: OrgBranding = {
    ...DEFAULT_ORG_BRANDING,
    ...(org?.branding ?? {}),
  }

  return (
    <OrgContext.Provider value={{ org, branding, loading }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg(): OrgContextValue {
  return useContext(OrgContext)
}
