'use client'

import { QueryProvider } from '@/lib/query-provider'
import { AuthProvider } from '@/lib/auth-context'
import { Toaster } from 'sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>{children}</AuthProvider>
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: 'font-sans text-sm',
          },
        }}
        richColors
      />
    </QueryProvider>
  )
}
