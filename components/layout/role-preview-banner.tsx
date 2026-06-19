'use client'

import { X, Eye } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import type { UserRole } from '@/lib/types'

const ROLE_LABELS: Record<UserRole, string> = {
  admin:             'Admin',
  ceo:               'CEO',
  creative_director: 'Creative Director',
  account_manager:   'Account Manager',
  strategist:        'Strategist',
  copywriter:        'Copywriter',
  designer:          'Designer',
  video_editor:      'Video Editor',
  web_developer:     'Web Developer',
  social_manager:    'Social Manager',
}

export function RolePreviewBanner() {
  const { isPreviewMode, previewRole, setPreviewRole } = useAuth()
  if (!isPreviewMode || !previewRole) return null

  return (
    <div
      className="fixed left-0 lg:left-64 right-0 z-30 h-9 flex items-center justify-between px-4 lg:px-6"
      style={{
        top: '56px',
        background: 'linear-gradient(90deg, rgba(22,51,48,0.98) 0%, rgba(37,92,84,0.98) 100%)',
        borderBottom: '1px solid rgba(91,180,174,0.28)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Eye className="w-3.5 h-3.5 shrink-0" style={{ color: '#5BB4AE' }} />
        <span className="text-sm font-medium text-white truncate">
          Previewing as{' '}
          <span className="font-semibold" style={{ color: '#5BB4AE' }}>
            {ROLE_LABELS[previewRole]}
          </span>
        </span>
        <span className="hidden md:inline text-[11px] text-white/40 shrink-0">
          — UI reflects this role's permissions and visibility
        </span>
      </div>

      <button
        onClick={() => setPreviewRole(null)}
        className="flex items-center gap-1.5 text-xs text-white/55 hover:text-white transition-colors shrink-0 ml-4"
      >
        <X className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Exit Preview</span>
      </button>
    </div>
  )
}
