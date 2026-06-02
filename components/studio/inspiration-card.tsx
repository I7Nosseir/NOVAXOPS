'use client'

import { ExternalLink, Star, Play, Hash, TrendingUp, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TrendingContentItem } from '@/app/api/studio/trending-content/route'

const VELOCITY_CONFIG: Record<TrendingContentItem['velocity'], { label: string; className: string }> = {
  rising_fast: { label: 'Rising fast', className: 'bg-red-500 text-white'     },
  rising:      { label: 'Rising',      className: 'bg-amber-500 text-white'   },
  peaking:     { label: 'Peaking',     className: 'bg-emerald-500 text-white' },
  stable:      { label: 'Stable',      className: 'bg-slate-400 text-white'   },
}

const PLATFORM_CONFIG: Record<TrendingContentItem['platform'], { label: string }> = {
  youtube:   { label: 'YouTube'        },
  tiktok:    { label: 'TikTok'         },
  instagram: { label: 'Instagram'      },
  reddit:    { label: 'Reddit'         },
  trendsmcp: { label: 'Cross-platform' },
}

const FORMAT_COLORS: Record<string, string> = {
  Tutorial:       'bg-blue-50 text-blue-600',
  Review:         'bg-purple-50 text-purple-600',
  Educational:    'bg-indigo-50 text-indigo-600',
  Vlog:           'bg-pink-50 text-pink-600',
  Transformation: 'bg-rose-50 text-rose-600',
  'Product Demo': 'bg-orange-50 text-orange-600',
  Comparison:     'bg-cyan-50 text-cyan-600',
  Challenge:      'bg-yellow-50 text-yellow-600',
  Entertainment:  'bg-fuchsia-50 text-fuchsia-600',
  News:           'bg-slate-100 text-slate-600',
  Ranking:        'bg-teal-50 text-teal-600',
  General:        'bg-slate-100 text-slate-500',
}

function formatViewCount(n: number, type: TrendingContentItem['content_type']): string {
  const label = type === 'hashtag' ? 'videos' : 'views'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B ${label}`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M ${label}`
  if (n >= 1_000)         return `${Math.round(n / 1_000)}K ${label}`
  return `${n} ${label}`
}

function PlatformPlaceholderIcon({ platform }: { platform: TrendingContentItem['platform'] }) {
  if (platform === 'youtube')   return <Play       className="w-8 h-8 text-white/60" />
  if (platform === 'tiktok')    return <Hash       className="w-8 h-8 text-white/60" />
  if (platform === 'instagram') return <Globe      className="w-8 h-8 text-white/60" />
  if (platform === 'trendsmcp') return <TrendingUp className="w-8 h-8 text-white/60" />
  return                               <Globe      className="w-8 h-8 text-white/60" />
}

export interface InspirationCardProps {
  item:                TrendingContentItem
  isSaved:             boolean
  clientId?:           string
  onSave:              (item: TrendingContentItem) => void
  onUnsave:            (item: TrendingContentItem) => void
  onUseAsInspiration?: (item: TrendingContentItem) => void
}

export function InspirationCard({ item, isSaved, onSave, onUnsave, onUseAsInspiration }: InspirationCardProps) {
  const velocityConf  = VELOCITY_CONFIG[item.velocity]
  const platformConf  = PLATFORM_CONFIG[item.platform]
  const formatClass   = FORMAT_COLORS[item.content_format ?? ''] ?? FORMAT_COLORS.General

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
              const fb = img.nextElementSibling as HTMLElement | null
              if (fb) fb.style.display = 'flex'
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
        <span className={cn('absolute top-2 right-2 text-[10px] font-medium rounded-md px-2 py-0.5', velocityConf.className)}>
          {velocityConf.label}
        </span>

        {/* AI score badge */}
        {item.ai_score != null && (
          <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-bold rounded-md px-1.5 py-0.5">
            {item.ai_score}/10
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col min-w-0">

        {/* Format badge */}
        {item.content_format && item.content_format !== 'General' && (
          <span className={cn('self-start text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1.5', formatClass)}>
            {item.content_format}
          </span>
        )}

        <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2 mb-1 break-words">
          {item.title}
        </p>

        <div className="flex items-center gap-2 flex-wrap min-w-0 mb-1">
          {(item.channel || item.hashtag) && (
            <p className="text-xs text-slate-400 truncate min-w-0">
              {item.channel ?? `#${item.hashtag}`}
            </p>
          )}
          {item.view_count != null && item.view_count > 0 && (
            <p className="text-xs text-slate-400 shrink-0">
              {formatViewCount(item.view_count, item.content_type)}
            </p>
          )}
        </div>

        {/* AI insight */}
        {item.ai_insight ? (
          <p className="text-xs text-novax-muted leading-relaxed line-clamp-2 flex-1 break-words">
            {item.ai_insight}
          </p>
        ) : (
          <p className="text-xs text-slate-400 italic leading-relaxed line-clamp-2 flex-1 break-words">
            {item.why_trending}
          </p>
        )}
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
            className="flex items-center gap-1 text-xs text-slate-500 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors shrink-0"
          >
            Use
          </button>
        )}

        <div className="flex-1" />

        <button
          onClick={() => isSaved ? onUnsave(item) : onSave(item)}
          aria-label={isSaved ? 'Unsave' : 'Save'}
          className={cn(
            'flex items-center gap-1 text-xs border rounded-lg px-3 py-1.5 transition-colors',
            isSaved
              ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50',
          )}
        >
          <Star className={cn('w-3.5 h-3.5', isSaved ? 'fill-amber-400 text-amber-400' : '')} />
          {isSaved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  )
}
