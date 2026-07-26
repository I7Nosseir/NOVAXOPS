'use client'

import { useAuth } from '@/lib/auth-context'

/**
 * Replaces the static <main> in layout.
 * Adds pt-9 (36px banner height) on top of the base pt-14 when preview mode is active,
 * so content never slides under the RolePreviewBanner.
 */
export function PreviewAwareMain({ children }: { children: React.ReactNode }) {
  const { isPreviewMode } = useAuth()
  return (
    <main
      className={`lg:ml-64 min-h-screen pb-16 lg:pb-0 transition-[padding-top] duration-200 ${
        isPreviewMode ? 'pt-[92px]' : 'pt-14'
      }`}
    >
      <div className="p-4 lg:p-6">{children}</div>
    </main>
  )
}
