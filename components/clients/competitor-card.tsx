'use client'

import { RefreshCw, Trash2, Users, TrendingUp, Clock, ExternalLink, MapPin, Globe } from 'lucide-react'
import { cn, formatNumber, timeAgo } from '@/lib/utils'
import type { CompetitorSnapshot } from '@/lib/types'

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-50   text-pink-700   border-pink-200',
  tiktok:    'bg-slate-900 text-white       border-slate-800',
  linkedin:  'bg-blue-50   text-blue-700   border-blue-200',
  youtube:   'bg-red-50    text-red-700    border-red-200',
  facebook:  'bg-blue-50   text-blue-600   border-blue-200',
  twitter:   'bg-slate-50  text-slate-700  border-slate-200',
}

function platformColor(platform: string) {
  return PLATFORM_COLORS[platform.toLowerCase()] ?? 'bg-slate-50 text-slate-600 border-slate-200'
}

interface Props {
  snapshot: CompetitorSnapshot
  syncing:  boolean
  onDelete: (id: string) => void
  onSync:   (id: string, handle: string, platform: string) => Promise<void>
}

export function CompetitorCard({ snapshot, syncing, onDelete, onSync }: Props) {
  const notYetSynced = snapshot.followers === 0 && snapshot.avg_er === 0

  const openUrl = () => {
    if (snapshot.social_url) {
      window.open(snapshot.social_url, '_blank')
      return
    }
    const base: Record<string, string> = {
      instagram: 'https://instagram.com/',
      tiktok:    'https://tiktok.com/@',
      linkedin:  'https://linkedin.com/company/',
      youtube:   'https://youtube.com/@',
      facebook:  'https://facebook.com/',
      twitter:   'https://twitter.com/',
    }
    const handle = snapshot.competitor_handle.replace('@', '')
    window.open((base[snapshot.platform.toLowerCase()] ?? 'https://') + handle, '_blank')
  }

  return (
    <div className="flex items-start gap-3 p-3.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-novax-light border border-novax-border flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-novax">
          {snapshot.competitor_handle.replace('@', '').slice(0, 2).toUpperCase()}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        {/* Name row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-sm text-slate-900 truncate">
            {snapshot.competitor_handle}
          </span>
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', platformColor(snapshot.platform))}>
            {snapshot.platform}
          </span>
          {snapshot.scope && (
            <span className={cn(
              'flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border',
              snapshot.scope === 'local'
                ? 'bg-blue-50 text-blue-600 border-blue-200'
                : 'bg-purple-50 text-purple-600 border-purple-200',
            )}>
              {snapshot.scope === 'local'
                ? <MapPin className="w-2.5 h-2.5"/>
                : <Globe className="w-2.5 h-2.5"/>}
              {snapshot.scope === 'local' ? 'Local' : 'Global'}
            </span>
          )}
        </div>

        {/* Strategy snippet */}
        {snapshot.platform_strategy && (
          <p className="text-[11px] text-slate-500 mt-1 leading-snug line-clamp-2">
            {snapshot.platform_strategy}
          </p>
        )}

        {/* Metrics row */}
        {notYetSynced ? (
          <p className="text-[10px] text-slate-400 mt-1.5 italic">Not yet synced — click Sync to fetch metrics</p>
        ) : (
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-slate-600">
              <Users className="w-3 h-3 text-slate-400"/>
              <span className="font-semibold">{formatNumber(snapshot.followers)}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-600">
              <TrendingUp className="w-3 h-3 text-slate-400"/>
              <span className="font-semibold">{snapshot.avg_er.toFixed(1)}%</span>
              <span className="text-slate-400">ER</span>
            </div>
            {snapshot.posting_frequency > 0 && (
              <div className="flex items-center gap-1 text-xs text-slate-600">
                <Clock className="w-3 h-3 text-slate-400"/>
                <span className="font-semibold">{snapshot.posting_frequency}×/wk</span>
              </div>
            )}
            <span className="text-[10px] text-slate-400">
              Synced {timeAgo(snapshot.captured_at)}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button onClick={() => onSync(snapshot.id, snapshot.competitor_handle, snapshot.platform)}
          disabled={syncing}
          title="Sync metrics"
          className="p-1.5 rounded-lg text-slate-400 hover:text-novax hover:bg-novax-light transition-colors disabled:opacity-40">
          <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')}/>
        </button>
        <button onClick={openUrl} title="View on platform"
          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors">
          <ExternalLink className="w-3.5 h-3.5"/>
        </button>
        <button onClick={() => onDelete(snapshot.id)} title="Remove competitor"
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
          <Trash2 className="w-3.5 h-3.5"/>
        </button>
      </div>
    </div>
  )
}
