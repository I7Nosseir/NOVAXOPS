'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { MobileNav } from '@/components/layout/mobile-nav'
import { RolePreviewBanner } from '@/components/layout/role-preview-banner'
import { PreviewAwareMain } from '@/components/layout/preview-aware-main'
import { ThemeProvider } from '@/lib/theme-context'
import { AuthGuard } from '@/components/layout/auth-guard'
import { SidebarProvider } from '@/lib/sidebar-context'
import { MyTasksFloat } from '@/components/tasks/my-tasks-float'
import { RoleToolsPanel } from '@/components/tools/role-tools-panel'
import { ChatPanel, AssistantFab } from '@/components/assistant/chat-panel'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false)

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

            {/* Floating action stack — bottom-right, vertical */}
            {/* Tools (top):    bottom-[8.5rem] right-6  — defined inside RoleToolsPanel */}
            {/* My Tasks (mid): bottom-[4.75rem] right-6 — defined inside MyTasksFloat   */}
            {/* AI Chat (base): bottom-6 right-6         — defined here                  */}
            <MyTasksFloat />
            <RoleToolsPanel />

            {/* Primary AI Assistant FAB */}
            <div className="fixed bottom-6 right-6 z-50">
              <AssistantFab onClick={() => setChatOpen(v => !v)} isOpen={chatOpen} />
            </div>

            {/* AI Assistant panel */}
            <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
          </div>
        </AuthGuard>
      </SidebarProvider>
    </ThemeProvider>
  )
}
