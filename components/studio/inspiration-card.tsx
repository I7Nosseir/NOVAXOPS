'use client'

import { ExternalLink, Star, Play, Hash, TrendingUp, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TrendingContentItem } from '@/app/api/studio/trending-content/route'

// ── Velocity config ───────────────────────────────────────────

const VELOCITY_CONFIG: Record<
  TrendingContentItem['velocity'],
  { label: string; className: string }
> = {
  rising_fast: { label: 'Rising fast', className: 'bg-red-500 text-white'      },
  rising:      { label: 'Rising',      className: 'bg-amber-500 text-white'    },
  peaking:     { label: 'Peaking',     className: 'bg-emerald-500 text-white'  },
  stable:      { label: 'Stable',      className: 'bg-slate-400 text-white'    },
}

// ── Platform config ───────────────────────────────────────────

const PLATFORM_CONFIG: Record<
  TrendingContentItem['platform'],
  { label: string }
> = {
  youtube:   { label: 'YouTube'          },
  tiktok:    { label: 'TikTok'           },
  reddit:    { label: 'Reddit'           },
  trendsmcp: { label: 'Cross-platform'   },
}

// ── View count formatter ──────────────────────────────────────

function formatViewCount(n: number, contentType: TrendingContentItem['content_type']): string {
  const label = contentType === 'hashtag' ? 'videos' : 'views'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B ${label}`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M ${label}`
  if (n >= 1_000)         return `${Math.round(n / 1_000)}K ${label}`
  return `${n} ${label}`
}

// ── Platform thumbnail placeholder icon ──────────────────────

function PlatformPlaceholderIcon({ platform }: { platform: TrendingContentItem['platform'] }) {
  if (platform === 'youtube')   return <Play       className="w-8 h-8 text-white/60" />
  if (platform === 'tiktok')    return <Hash       className="w-8 h-8 text-white/60" />
  if (platform === 'trendsmcp') return <TrendingUp className="w-8 h-8 text-white/60" />
  return                               <Globe      className="w-8 h-8 text-white/60" />
}

// ── Props ─────────────────────────────────────────────────────

export interface InspirationCardProps {
  item:       TrendingContentItem
  isSaved:    boolean
  clientId?:  string
  onSave:     (item: TrendingContentItem) => void
  onUnsave:   (item: TrendingContentItem) => void
  onUseAsInspiration?: (item: TrendingContentItem) => void
}

// ── Component ─────────────────────────────────────────────────

export function InspirationCard({
  item,
  isSaved,
  onSave,
  onUnsave,
  onUseAsInspiration,
}: InspirationCardProps) {
  const velocityConf = VELOCITY_CONFIG[item.velocity]
  const platformConf = PLATFORM_CONFIG[item.platform]

  function handleSaveToggle() {
    if (isSaved) {
      onUnsave(item)
    } else {
      onSave(item)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-novax-border hover:shadow-sm transition-all flex flex-col">

      {/* Thumbnail */}
      <div className="relative h-40 bg-slate-100 shrink-0">
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt={item.title}
            className="w-full h-full object-cover"
            onError={e => {
              const img = e.currentTarget
              img.style.display = 'none'
              const fallback = img.nextElementSibling as HTMLElement | null
              if (fallback) fallback.style.display = 'flex'
            }}
          />
        ) : null}
        <div
          className="w-full h-full bg-gradient-to-br from-[#1B3D38] to-[#2A6B62] items-center justify-center"
          style={{ display: item.thumbnail_url ? 'none' : 'flex' }}
        >
          <PlatformPlaceholderIcon platform={item.platform} />
        </div>

        {/* Platform badge */}
        <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-medium rounded-md px-2 py-0.5">
          {platformConf.label}
        </span>

        {/* Velocity badge */}
        <span
          className={cn(
            'absolute top-2 right-2 text-[10px] font-medium rounded-md px-2 py-0.5',
            velocityConf.className,
          )}
        >
          {velocityConf.label}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col min-w-0">
        <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2 mb-1 break-words">
          {item.title}
        </p>

        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {(item.channel || item.hashtag) && (
            <p className="text-xs text-slate-400 truncate min-w-0">
              {item.channel ? item.channel : `#${item.hashtag}`}
            </p>
          )}
          {item.view_count != null && item.view_count > 0 && (
            <p className="text-xs text-slate-400 shrink-0">
              {formatViewCount(item.view_count, item.content_type)}
            </p>
          )}
        </div>

        <p className="text-xs text-novax-muted italic mt-2 line-clamp-2 flex-1 break-words">
          {item.why_trending}
        </p>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 flex items-center gap-2">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-novax-muted border border-novax-border rounded-lg px-3 py-1.5 hover:bg-novax-light transition-colors shrink-0"
        >
          Open
          <ExternalLink className="w-3 h-3" />
        </a>

        {onUseAsInspiration && (
          <button
            onClick={() => onUseAsInspiration(item)}
            title="Use as inspiration in Content Studio"
            className="flex items-center gap-1 text-xs text-slate-500 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors shrink-0"
          >
            Use
          </button>
        )}

        <div className="flex-1" />

        <button
          onClick={handleSaveToggle}
          aria-label={isSaved ? 'Unsave' : 'Save'}
          className={cn(
            'flex items-center gap-1 text-xs border rounded-lg px-3 py-1.5 transition-colors',
            isSaved
              ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50',
          )}
        >
          <Star
            className={cn('w-3.5 h-3.5', isSaved ? 'fill-amber-400 text-amber-400' : '')}
          />
          {isSaved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  )
}
