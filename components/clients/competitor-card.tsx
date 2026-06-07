'use client'

import { useState } from 'react'
import { RefreshCw, Trash2, Users, TrendingUp, Clock, ExternalLink } from 'lucide-react'
import { cn, formatNumber, timeAgo } from '@/lib/utils'
import type { CompetitorSnapshot } from '@/lib/types'

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-50 text-pink-700 border-pink-200',
  tiktok:    'bg-slate-900 text-white border-slate-800',
  linkedin:  'bg-blue-50 text-blue-700 border-blue-200',
  youtube:   'bg-red-50 text-red-700 border-red-200',
  facebook:  'bg-blue-50 text-blue-600 border-blue-200',
  twitter:   'bg-slate-50 text-slate-700 border-slate-200',
}

function platformColor(platform: string) {
  return PLATFORM_COLORS[platform.toLowerCase()] ?? 'bg-slate-50 text-slate-600 border-slate-200'
}

interface Props {
  snapshot: CompetitorSnapshot
  onDelete: (id: string) => void
  onSync: (id: string, handle: string, platform: string) => Promise<void>
}

export function CompetitorCard({ snapshot, onDelete, onSync }: Props) {
  const [syncing, setSyncing] = useState(false)
  const notYetSynced = snapshot.followers === 0 && snapshot.avg_er === 0

  const handleSync = async () => {
    setSyncing(true)
    try { await onSync(snapshot.id, snapshot.competitor_handle, snapshot.platform) }
    finally { setSyncing(false) }
  }

  return (
    <div className="flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
      {/* Avatar placeholder */}
      <div className="w-10 h-10 rounded-full bg-novax-light border border-novax-border flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-novax">
          {snapshot.competitor_handle.replace('@', '').slice(0, 2).toUpperCase()}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-slate-900">{snapshot.competitor_handle}</span>
          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', platformColor(snapshot.platform))}>
            {snapshot.platform}
          </span>
          {notYetSynced && (
            <span className="text-[10px] text-slate-400 italic">Not yet synced</span>
          )}
        </div>

        {!notYetSynced && (
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-slate-600">
              <Users className="w-3 h-3 text-slate-400"/>
              <span className="font-semibold">{formatNumber(snapshot.followers)}</span>
              <span className="text-slate-400">followers</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-600">
              <TrendingUp className="w-3 h-3 text-slate-400"/>
              <span className="font-semibold">{snapshot.avg_er.toFixed(1)}%</span>
              <span className="text-slate-400">avg ER</span>
            </div>
            {snapshot.posting_frequency > 0 && (
              <div className="flex items-center gap-1 text-xs text-slate-600">
                <Clock className="w-3 h-3 text-slate-400"/>
                <span className="font-semibold">{snapshot.posting_frequency}×/week</span>
              </div>
            )}
          </div>
        )}

        <p className="text-[10px] text-slate-400 mt-1.5">
          {notYetSynced ? 'Click Sync to fetch metrics' : `Synced ${timeAgo(snapshot.captured_at)}`}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button onClick={handleSync} disabled={syncing}
          title="Sync metrics"
          className="p-1.5 rounded-lg text-slate-400 hover:text-novax hover:bg-novax-light transition-colors disabled:opacity-40">
          <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')}/>
        </button>
        <button
          title="View on platform"
          onClick={() => {
            const base: Record<string, string> = {
              instagram: 'https://instagram.com/',
              tiktok: 'https://tiktok.com/@',
              linkedin: 'https://linkedin.com/company/',
              youtube: 'https://youtube.com/@',
              facebook: 'https://facebook.com/',
              twitter: 'https://twitter.com/',
            }
            const handle = snapshot.competitor_handle.replace('@', '')
            const url = (base[snapshot.platform.toLowerCase()] ?? 'https://') + handle
            window.open(url, '_blank')
          }}
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
