import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { MobileNav } from '@/components/layout/mobile-nav'
import { RolePreviewBanner } from '@/components/layout/role-preview-banner'
import { PreviewAwareMain } from '@/components/layout/preview-aware-main'
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
            <RolePreviewBanner />
            <PreviewAwareMain>{children}</PreviewAwareMain>
            <MobileNav />
            <MyTasksFloat />
          </div>
        </AuthGuard>
      </SidebarProvider>
    </ThemeProvider>
  )
}
