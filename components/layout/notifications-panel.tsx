'use client'

import { useEffect, useRef } from 'react'
import { CheckSquare, MessageSquare, AlertCircle, Globe, Zap, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/lib/hooks/use-notifications'

const TYPE_CONFIG = {
  approval:   { icon: AlertCircle, color: 'text-amber-500',  bg: 'bg-amber-50' },
  moderation: { icon: MessageSquare, color: 'text-blue-500',  bg: 'bg-blue-50' },
  task:       { icon: CheckSquare, color: 'text-novax-muted', bg: 'bg-novax-light' },
  ai:         { icon: Zap,         color: 'text-purple-500', bg: 'bg-purple-50' },
  published:  { icon: Globe,       color: 'text-emerald-500',bg: 'bg-emerald-50' },
}

interface Props { onClose: () => void }

export function NotificationsPanel({ onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { notifications } = useNotifications()
  const unread = notifications.filter(n => !n.read).length

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-slate-900 text-sm">Notifications</p>
          {unread > 0 && (
            <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-novax text-white text-[10px] font-bold">
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button className="text-xs text-novax-muted hover:text-novax font-medium transition-colors">Mark all read</button>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-50">
        {notifications.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">No recent activity</p>
        ) : (
          notifications.map(n => {
            const cfg = TYPE_CONFIG[n.type as keyof typeof TYPE_CONFIG]
            const Icon = cfg.icon
            return (
              <div key={n.id} className={cn('flex gap-3 px-4 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors', !n.read && 'bg-novax-light/30')}>
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', cfg.bg)}>
                  <Icon className={cn('w-3.5 h-3.5', cfg.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('text-xs font-semibold', n.read ? 'text-slate-700' : 'text-slate-900')}>{n.title}</p>
                    <span className="text-[10px] text-slate-400 shrink-0">{n.time}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{n.body}</p>
                </div>
                {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-novax shrink-0 mt-2" />}
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
        <button className="text-xs text-novax-muted hover:text-novax font-medium transition-colors w-full text-center">
          View all notifications
        </button>
      </div>
    </div>
  )
}
