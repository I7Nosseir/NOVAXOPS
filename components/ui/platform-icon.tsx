import type { SocialPlatform } from '@/lib/types'
import { PLATFORM_CONFIG } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface PlatformIconProps {
  platform: SocialPlatform
  size?: 'xs' | 'sm'
  className?: string
}

const PLATFORM_LETTERS: Record<SocialPlatform, string> = {
  instagram: 'IG',
  facebook:  'FB',
  linkedin:  'LI',
  tiktok:    'TK',
  twitter:   'X',
  youtube:   'YT',
  pinterest: 'PI',
}

export function PlatformIcon({ platform, size = 'sm', className }: PlatformIconProps) {
  const cfg = PLATFORM_CONFIG[platform]
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded font-bold text-white leading-none',
        size === 'xs' ? 'w-4 h-4 text-[8px]' : 'w-5 h-5 text-[9px]',
        className,
      )}
      style={{ background: cfg.color === '#000000' ? '#111' : cfg.color }}
    >
      {PLATFORM_LETTERS[platform]}
    </span>
  )
}

export function PlatformBadge({ platform }: { platform: SocialPlatform }) {
  const cfg = PLATFORM_CONFIG[platform]
  return (
    <div className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-200">
      <PlatformIcon platform={platform} size="xs"/>
      <span className="text-slate-600">{cfg.label}</span>
    </div>
  )
}
