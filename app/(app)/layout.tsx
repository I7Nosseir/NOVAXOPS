'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { MobileNav } from '@/components/layout/mobile-nav'
import { RolePreviewBanner } from '@/components/layout/role-preview-banner'
import { PreviewAwareMain } from '@/components/layout/preview-aware-main'
import { ThemeProvider } from '@/lib/theme-context'
import { AuthGuard } from '@/components/layout/auth-guard'
import { SidebarProvider } from '@/lib/sidebar-context'
import { OrgProvider, useOrg } from '@/lib/org-context'
import { MyTasksFloat } from '@/components/tasks/my-tasks-float'
import { RoleToolsPanel } from '@/components/tools/role-tools-panel'
import { ChatPanel, AssistantFab } from '@/components/assistant/chat-panel'
import { useActivityTracker } from '@/lib/hooks/use-activity-tracker'
import { useAuth } from '@/lib/auth-context'
import { getOrgBranding, buildBrandingCSS } from '@/lib/white-label'

function ActivityTrackerWrapper() {
  const { user } = useAuth()
  useActivityTracker(user?.id)
  return null
}

function BrandingInjector() {
  const { org } = useOrg()
  const branding = getOrgBranding(org)
  const css = buildBrandingCSS(branding)
  return <style>{css}</style>
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false)
  const pathname = usePathname()

  // On the dedicated /assistant page the full-page ChatPanel is already rendered.
  // Showing the floating panel at the same time creates two simultaneous ChatPanel
  // instances with conflicting React state, which triggers error #310.
  const isAssistantPage = pathname === '/assistant'

  return (
    <ThemeProvider>
      <OrgProvider>
      <SidebarProvider>
        <AuthGuard>
          <BrandingInjector />
          <ActivityTrackerWrapper />
          <div className="min-h-screen bg-slate-50 dark:bg-transparent">
            <Sidebar />
            <Header />
            <RolePreviewBanner />
            <PreviewAwareMain>{children}</PreviewAwareMain>
            <MobileNav />

            {/* Floating action stack — bottom-right, vertical */}
            {/* Tools (top):    bottom-[8.5rem] right-6  — defined inside RoleToolsPanel */}
            {/* My Tasks (mid): bottom-[4.75rem] right-6 — defined inside MyTasksFloat   */}
            {/* AI Chat (base): bottom-6 right-6         — defined here                  */}
            <MyTasksFloat />
            <RoleToolsPanel />

            {/* Primary AI Assistant FAB — hidden on the full-page /assistant route */}
            {/* bottom-[5.5rem] on mobile lifts it above the 64px MobileNav + 24px gap */}
            {!isAssistantPage && (
              <>
                <div className="fixed bottom-[5.5rem] lg:bottom-6 right-6 z-50">
                  <AssistantFab onClick={() => setChatOpen(v => !v)} isOpen={chatOpen} />
                </div>
                <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
              </>
            )}
          </div>
        </AuthGuard>
      </SidebarProvider>
      </OrgProvider>
    </ThemeProvider>
  )
}
