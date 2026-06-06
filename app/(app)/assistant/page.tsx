'use client'

import { Sparkles } from 'lucide-react'
import { ChatPanel } from '@/components/assistant/chat-panel'

export default function AssistantPage() {
  return (
    <div className="space-y-4 h-full">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-novax-accent" />
        <h1 className="text-xl font-bold text-slate-900">AI Assistant</h1>
      </div>

      <div style={{ height: 'calc(100vh - 9rem)' }}>
        <ChatPanel open fullPage onClose={() => {}} />
      </div>
    </div>
  )
}
