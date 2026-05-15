import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { ThemeProvider } from '@/lib/theme-context'
import { AuthGuard } from '@/components/layout/auth-guard'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthGuard>
        <div className="min-h-screen" style={{ background: 'var(--main-bg)' }}>
          <Sidebar />
          <Header />
          <main className="ml-64 pt-14 min-h-screen">
            <div className="p-6">{children}</div>
          </main>
        </div>
      </AuthGuard>
    </ThemeProvider>
  )
}
