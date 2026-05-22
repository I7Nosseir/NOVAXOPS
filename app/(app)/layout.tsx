import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { MobileNav } from '@/components/layout/mobile-nav'
import { ThemeProvider } from '@/lib/theme-context'
import { AuthGuard } from '@/components/layout/auth-guard'
import { SidebarProvider } from '@/lib/sidebar-context'
import { MyTasksFloat } from '@/components/tasks/my-tasks-float'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <AuthGuard>
          <div className="min-h-screen bg-slate-50 dark:bg-transparent">
            <Sidebar />
            <Header />
            <main className="lg:ml-64 pt-14 min-h-screen pb-16 lg:pb-0">
              <div className="p-4 lg:p-6">{children}</div>
            </main>
            <MobileNav />
            <MyTasksFloat />
          </div>
        </AuthGuard>
      </SidebarProvider>
    </ThemeProvider>
  )
}
